import { randomUUID } from 'crypto';
import { AppError } from '../errors';
import { getHostSession, deleteHostSession, redis } from './redis';
import { getIo } from '../lib/io';

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

  const existingRoomId = await redis.get(`host_room:${session.spotifyId}`);
  if (existingRoomId) {
    const existingRoom = await redis.hgetall(`room:${existingRoomId}`);
    if (existingRoom?.status === 'active') {
      await deleteHostSession(hostId);
      return { roomId: existingRoomId, code: existingRoom.code };
    }
  }

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
    code,
    spotifyId: session.spotifyId,
    createdAt: new Date().toISOString(),
  });
  await redis.expire(`room:${roomId}`, 86400);
  await redis.set(`code:${code}`, roomId, 'EX', 86400);
  await redis.set(`host_room:${session.spotifyId}`, roomId, 'EX', 86400);
  await redis.sadd('active_rooms', roomId);
  await deleteHostSession(hostId);

  return { roomId, code };
}

export interface RoomInfo {
  roomId: string;
  name: string;
  status: string;
  voteThreshold: number;
  maxSuggestions: number;
}

export interface UpdateRoomInput {
  roomId: string;
  hostId: string;
  voteThreshold?: number;
  maxSuggestions?: number;
}

export interface UpdateRoomResult {
  roomId: string;
  voteThreshold: number;
  maxSuggestions: number;
}

export async function updateRoom(input: UpdateRoomInput): Promise<UpdateRoomResult> {
  const { roomId, hostId, voteThreshold, maxSuggestions } = input;

  const room = await redis.hgetall(`room:${roomId}`);
  if (!room?.hostId) throw new AppError('ROOM_NOT_FOUND', 404);
  if (room.hostId !== hostId) throw new AppError('UNAUTHORIZED', 403);

  if (voteThreshold !== undefined) {
    await redis.hset(`room:${roomId}`, 'voteThreshold', String(voteThreshold));
  }
  if (maxSuggestions !== undefined) {
    await redis.hset(`room:${roomId}`, 'maxSuggestions', String(maxSuggestions));
  }

  return {
    roomId,
    voteThreshold: voteThreshold ?? Number(room.voteThreshold),
    maxSuggestions: maxSuggestions ?? Number(room.maxSuggestions),
  };
}

export interface DeleteRoomInput {
  roomId: string;
  hostId: string;
}

export async function deleteRoom(input: DeleteRoomInput): Promise<void> {
  const { hostId } = input;

  const resolved = await redis.get(`code:${input.roomId}`);
  const roomId = resolved ?? input.roomId;

  const room = await redis.hgetall(`room:${roomId}`);
  if (!room?.hostId) throw new AppError('ROOM_NOT_FOUND', 404);
  if (room.hostId !== hostId) throw new AppError('UNAUTHORIZED', 403);

  await redis.del(
    `room:${roomId}`, `queue:${roomId}`, `suggestions:${roomId}`,
    `queue_meta:${roomId}`, `users:${roomId}`, `code:${room.code}`,
    `host_room:${room.spotifyId}`, `history:${roomId}`
  );
  await redis.srem('active_rooms', roomId);

  getIo()?.to(roomId).emit('room_closed', { roomId });
}

export async function getRoomByCode(code: string): Promise<RoomInfo> {
  const roomId = await redis.get(`code:${code}`);
  if (!roomId) throw new AppError('ROOM_NOT_FOUND', 404);

  const room = await redis.hgetall(`room:${roomId}`);
  if (!room.name) throw new AppError('ROOM_NOT_FOUND', 404);

  return {
    roomId,
    name: room.name,
    status: room.status,
    voteThreshold: Number(room.voteThreshold),
    maxSuggestions: Number(room.maxSuggestions),
  };
}
