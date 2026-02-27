import type { Server, Socket } from 'socket.io';
import { redis } from '../services/redis';
import { addToQueue, refreshHostToken } from '../services/spotify';

interface SuggestPayload {
  trackId: string;
  trackMeta: {
    id: string;
    name: string;
    artists: string[];
    album: string;
    albumArt: string;
    uri: string;
    durationMs: number;
  };
}

interface VotePayload {
  trackId: string;
}

async function getRoomState(roomId: string) {
  const [room, queue, suggestionsRaw] = await Promise.all([
    redis.hgetall(`room:${roomId}`),
    redis.lrange(`queue:${roomId}`, 0, -1),
    redis.hgetall(`suggestions:${roomId}`),
  ]);

  const suggestions = await Promise.all(
    Object.entries(suggestionsRaw ?? {}).map(async ([trackId, metaJson]) => {
      const voteCount = await redis.scard(`votes:${roomId}:${trackId}`);
      return { ...(JSON.parse(metaJson) as Record<string, unknown>), voteCount };
    })
  );

  const participantCount = await redis.scard(`users:${roomId}`);

  return {
    roomId,
    name: room.name,
    status: room.status,
    voteThreshold: Number(room.voteThreshold),
    maxSuggestions: Number(room.maxSuggestions),
    queue,
    suggestions,
    participantCount,
  };
}

async function addToQueueWithRefresh(trackUri: string, roomId: string): Promise<void> {
  const hostToken = await redis.hget(`room:${roomId}`, 'hostToken');
  if (!hostToken) return;

  try {
    await addToQueue(trackUri, hostToken);
  } catch (err) {
    if ((err as { response?: { status?: number } }).response?.status !== 401) return;
    const refreshToken = await redis.hget(`room:${roomId}`, 'hostRefreshToken');
    if (!refreshToken) return;
    const { accessToken } = await refreshHostToken(refreshToken);
    await redis.hset(`room:${roomId}`, 'hostToken', accessToken);
    await addToQueue(trackUri, accessToken);
  }
}

export function registerHandlers(io: Server, socket: Socket): void {
  const { roomId, userId } = socket.data as { roomId: string; userId: string };

  socket.on('join_room', async () => {
    try {
      await redis.sadd(`users:${roomId}`, userId);
      socket.join(roomId);

      const state = await getRoomState(roomId);
      socket.emit('room_state', state);
      socket.to(roomId).emit('user_joined', { userId, participantCount: state.participantCount });
    } catch {
      socket.emit('error', { code: 'INTERNAL_ERROR' });
    }
  });

  socket.on('suggest_track', async ({ trackId, trackMeta }: SuggestPayload) => {
    try {
      const maxSuggestionsStr = await redis.hget(`room:${roomId}`, 'maxSuggestions');
      const maxSuggestions = Number(maxSuggestionsStr ?? 3);

      const existing = await redis.hgetall(`suggestions:${roomId}`);
      const userCount = Object.values(existing ?? {}).filter((json) => {
        const meta = JSON.parse(json) as { suggestedBy?: string };
        return meta.suggestedBy === userId;
      }).length;

      if (userCount >= maxSuggestions) {
        socket.emit('error', { code: 'MAX_SUGGESTIONS_REACHED' });
        return;
      }

      const stored = { ...trackMeta, suggestedBy: userId };
      await redis.hset(`suggestions:${roomId}`, trackId, JSON.stringify(stored));
      io.to(roomId).emit('suggestion_added', { trackId, trackMeta: stored, voteCount: 0 });
    } catch {
      socket.emit('error', { code: 'INTERNAL_ERROR' });
    }
  });

  socket.on('vote_track', async ({ trackId }: VotePayload) => {
    try {
      const added = await redis.sadd(`votes:${roomId}:${trackId}`, userId);
      if (!added) {
        socket.emit('error', { code: 'ALREADY_VOTED' });
        return;
      }

      const voteCount = await redis.scard(`votes:${roomId}:${trackId}`);
      const thresholdStr = await redis.hget(`room:${roomId}`, 'voteThreshold');
      const threshold = Number(thresholdStr ?? 3);

      io.to(roomId).emit('vote_updated', { trackId, voteCount, threshold });

      if (voteCount >= threshold) {
        const trackMetaJson = await redis.hget(`suggestions:${roomId}`, trackId);
        if (!trackMetaJson) return;
        const trackMeta = JSON.parse(trackMetaJson) as { uri: string };

        await Promise.all([
          redis.hdel(`suggestions:${roomId}`, trackId),
          redis.rpush(`queue:${roomId}`, trackId),
        ]);

        await addToQueueWithRefresh(trackMeta.uri, roomId);

        const queue = await redis.lrange(`queue:${roomId}`, 0, -1);
        io.to(roomId).emit('track_approved', { trackId, trackMeta });
        io.to(roomId).emit('queue_updated', { queue });
      }
    } catch {
      socket.emit('error', { code: 'INTERNAL_ERROR' });
    }
  });

  socket.on('disconnect', async () => {
    try {
      await redis.srem(`users:${roomId}`, userId);
      const participantCount = await redis.scard(`users:${roomId}`);
      io.to(roomId).emit('user_left', { userId, participantCount });
    } catch {
      // ignore — cleanup best-effort
    }
  });
}
