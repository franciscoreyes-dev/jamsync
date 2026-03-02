import { redis } from '../services/redis';
import { deleteRoom } from '../services/room';

const SIX_HOURS_MS = 6 * 3600 * 1000;

async function processRoom(roomId: string): Promise<void> {
  const room = await redis.hgetall(`room:${roomId}`);
  if (!room?.hostId || !room?.createdAt) return;

  const age = Date.now() - new Date(room.createdAt).getTime();
  if (age < SIX_HOURS_MS) return;

  await deleteRoom({ roomId, hostId: room.hostId });
}

export async function cleanupRooms(): Promise<void> {
  const roomIds = await redis.smembers('active_rooms');
  await Promise.allSettled(roomIds.map(processRoom));
}

export function startRoomCleanup(): NodeJS.Timeout {
  return setInterval(() => {
    cleanupRooms().catch(() => {});
  }, 3_600_000);
}
