import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Socket } from 'socket.io';

vi.mock('../../services/redis', () => ({
  redis: {
    get: vi.fn(),
    hget: vi.fn(),
  },
}));

import { roomMiddleware } from '../../socket/middleware';
import * as redisModule from '../../services/redis';

const redisMock = redisModule.redis as unknown as {
  get: ReturnType<typeof vi.fn>;
  hget: ReturnType<typeof vi.fn>;
};

function makeSocket(auth: Record<string, unknown>): Socket {
  return {
    handshake: { auth },
    data: {},
  } as unknown as Socket;
}

describe('roomMiddleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls next(error MISSING_AUTH) when roomCode is absent', async () => {
    const next = vi.fn();
    await roomMiddleware(makeSocket({ userId: 'u1' }), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'MISSING_AUTH' }));
  });

  it('calls next(error MISSING_AUTH) when userId is absent', async () => {
    const next = vi.fn();
    await roomMiddleware(makeSocket({ roomCode: 'JAM-ABCD' }), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'MISSING_AUTH' }));
  });

  it('calls next(error ROOM_NOT_FOUND) when code has no Redis entry', async () => {
    redisMock.get.mockResolvedValue(null);
    const next = vi.fn();
    await roomMiddleware(makeSocket({ roomCode: 'JAM-XXXX', userId: 'u1' }), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'ROOM_NOT_FOUND' }));
  });

  it('calls next(error ROOM_CLOSED) when room status is not active', async () => {
    redisMock.get.mockResolvedValue('room-1');
    redisMock.hget.mockResolvedValue('closed');
    const next = vi.fn();
    await roomMiddleware(makeSocket({ roomCode: 'JAM-ABCD', userId: 'u1' }), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'ROOM_CLOSED' }));
  });

  it('attaches roomId + userId to socket.data and calls next() with no error', async () => {
    redisMock.get.mockResolvedValue('room-uuid-1');
    redisMock.hget.mockResolvedValue('active');
    const socket = makeSocket({ roomCode: 'JAM-ABCD', userId: 'user-1' });
    const next = vi.fn();
    await roomMiddleware(socket, next);
    expect(socket.data).toMatchObject({ roomId: 'room-uuid-1', userId: 'user-1' });
    expect(next).toHaveBeenCalledWith();
  });
});
