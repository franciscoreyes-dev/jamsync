import { redis } from '../services/redis';
import { getCurrentlyPlaying, getTrackInfo } from '../services/spotify';
import { getIo } from '../lib/io';

async function processRoom(roomId: string): Promise<void> {
  const hostToken = await redis.hget(`room:${roomId}`, 'hostToken');
  if (!hostToken) return;

  const current = await getCurrentlyPlaying(hostToken);
  const currentUri = current?.uri ?? null;
  const storedUri = await redis.get(`now_playing:${roomId}`);

  const trackId = await redis.lindex(`queue:${roomId}`, 0);
  if (trackId) {
    const metaJson = await redis.hget(`queue_meta:${roomId}`, trackId);
    if (metaJson) {
      const meta = JSON.parse(metaJson) as { uri: string };
      if (storedUri === meta.uri && currentUri !== meta.uri) {
        await redis.lpop(`queue:${roomId}`);
        await redis.rpush(`history:${roomId}`, trackId);
        await redis.ltrim(`history:${roomId}`, -20, -1);
        await redis.expire(`history:${roomId}`, 86400);
        const updatedQueue = await redis.lrange(`queue:${roomId}`, 0, -1);
        getIo()?.to(roomId).emit('queue_updated', { queue: updatedQueue });
      }
    }
  }

  if (currentUri !== storedUri) {
    if (currentUri) {
      await redis.set(`now_playing:${roomId}`, currentUri, 'EX', 86400);
      const npTrackId = currentUri.split(':')[2];
      const cachedMetaJson = await redis.hget(`queue_meta:${roomId}`, npTrackId);
      let meta = cachedMetaJson ? JSON.parse(cachedMetaJson) : null;
      if (!meta) {
        meta = await getTrackInfo(npTrackId, hostToken);
        if (meta) {
          await redis.hset(`queue_meta:${roomId}`, npTrackId, JSON.stringify(meta));
        }
      }
      getIo()?.to(roomId).emit('now_playing_updated', { trackId: npTrackId, meta });
    } else {
      await redis.del(`now_playing:${roomId}`);
      getIo()?.to(roomId).emit('now_playing_updated', { trackId: null, meta: null });
    }
  }
}

export async function pollQueues(): Promise<void> {
  const roomIds = await redis.smembers('active_rooms');
  await Promise.allSettled(roomIds.map(processRoom));
}

export function startQueuePoller(): NodeJS.Timeout {
  return setInterval(() => {
    pollQueues().catch(() => {});
  }, 10_000);
}
