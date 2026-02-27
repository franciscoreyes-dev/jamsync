import type { Socket } from 'socket.io';
import { redis } from '../services/redis';

export async function roomMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const { roomCode, userId } = socket.handshake.auth as {
    roomCode?: string;
    userId?: string;
  };

  if (!roomCode || !userId) {
    return next(new Error('MISSING_AUTH'));
  }

  const roomId = await redis.get(`code:${roomCode}`);
  if (!roomId) {
    return next(new Error('ROOM_NOT_FOUND'));
  }

  const status = await redis.hget(`room:${roomId}`, 'status');
  if (status !== 'active') {
    return next(new Error('ROOM_CLOSED'));
  }

  socket.data.roomId = roomId;
  socket.data.userId = userId;
  next();
}
