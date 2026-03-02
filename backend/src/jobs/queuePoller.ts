import { redis } from '../services/redis';
import { getCurrentlyPlaying } from '../services/spotify';
import { getIo } from '../lib/io';

async function processRoom(roomId: string): Promise<void> {
  const trackId = await redis.lindex(`queue:${roomId}`, 0);
  if (!trackId) return;

  const metaJson = await redis.hget(`queue_meta:${roomId}`, trackId);
  if (!metaJson) return;
  const meta = JSON.parse(metaJson) as { uri: string };

  const hostToken = await redis.hget(`room:${roomId}`, 'hostToken');
  if (!hostToken) return;

  const current = await getCurrentlyPlaying(hostToken);
  const currentUri = current?.uri ?? null;
  const storedUri = await redis.get(`now_playing:${roomId}`);

  if (currentUri) {
    await redis.set(`now_playing:${roomId}`, currentUri, 'EX', 86400);
  }

  if (storedUri === meta.uri && currentUri !== meta.uri) {
    await redis.lpop(`queue:${roomId}`);
    const updatedQueue = await redis.lrange(`queue:${roomId}`, 0, -1);
    getIo()?.to(roomId).emit('queue_updated', { queue: updatedQueue });
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
