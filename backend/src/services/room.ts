import { randomUUID } from 'crypto';
import { AppError } from '../errors';
import { getHostSession, deleteHostSession, redis } from './redis';

export interface CreateRoomInput {
  hostId: string;
  name: string;
  voteThreshold: number;
  maxSuggestions: number;
}

export interface CreateRoomResult {
  roomId: string;
  code: string;
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const suffix = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `JAM-${suffix}`;
}

export async function createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
  const { hostId, name, voteThreshold, maxSuggestions } = input;

  const session = await getHostSession(hostId);
  if (!session) throw new AppError('SESSION_EXPIRED', 401);

  const roomId = randomUUID();
  const code = generateCode();

  await redis.hset(`room:${roomId}`, {
    hostId,
    hostToken: session.hostToken,
    hostRefreshToken: session.hostRefreshToken,
    name,
    voteThreshold: String(voteThreshold),
    maxSuggestions: String(maxSuggestions),
    status: 'active',
    createdAt: new Date().toISOString(),
  });
  await redis.expire(`room:${roomId}`, 86400);
  await redis.set(`code:${code}`, roomId, 'EX', 86400);
  await deleteHostSession(hostId);

  return { roomId, code };
}
