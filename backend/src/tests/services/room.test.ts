import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../errors';

vi.mock('../../services/redis', () => ({
  getHostSession: vi.fn(),
  deleteHostSession: vi.fn(),
  redis: {
    hset: vi.fn(),
    expire: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    hgetall: vi.fn(),
  },
}));

import { createRoom, getRoomByCode } from '../../services/room';
import * as redisModule from '../../services/redis';

const redisMock = redisModule.redis as unknown as {
  hset: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  hgetall: ReturnType<typeof vi.fn>;
};

describe('createRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws SESSION_EXPIRED when no session exists', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue(null);

    await expect(
      createRoom({ hostId: 'h1', name: 'My Room', voteThreshold: 3, maxSuggestions: 3 })
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED', statusCode: 401 });
  });

  it('returns roomId (UUID) and JAM-XXXX code on success', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue({ hostToken: 'at', hostRefreshToken: 'rt' });
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.set.mockResolvedValue('OK');
    vi.mocked(redisModule.deleteHostSession).mockResolvedValue();

    const result = await createRoom({ hostId: 'h1', name: 'Test Room', voteThreshold: 3, maxSuggestions: 3 });

    expect(result.roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(result.code).toMatch(/^JAM-[A-Z0-9]{4}$/);
  });

  it('stores room hash with all required fields', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue({ hostToken: 'at', hostRefreshToken: 'rt' });
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.set.mockResolvedValue('OK');
    vi.mocked(redisModule.deleteHostSession).mockResolvedValue();

    const result = await createRoom({ hostId: 'h1', name: 'Test Room', voteThreshold: 5, maxSuggestions: 2 });

    expect(redisMock.hset).toHaveBeenCalledWith(
      `room:${result.roomId}`,
      expect.objectContaining({
        hostId: 'h1',
        hostToken: 'at',
        hostRefreshToken: 'rt',
        name: 'Test Room',
        voteThreshold: '5',
        maxSuggestions: '2',
        status: 'active',
      })
    );
    expect(redisMock.expire).toHaveBeenCalledWith(`room:${result.roomId}`, 86400);
  });

  it('stores code:{JAM-XXXX} → roomId mapping with 24h TTL', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue({ hostToken: 'at', hostRefreshToken: 'rt' });
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.set.mockResolvedValue('OK');
    vi.mocked(redisModule.deleteHostSession).mockResolvedValue();

    const result = await createRoom({ hostId: 'h1', name: 'Test Room', voteThreshold: 3, maxSuggestions: 3 });

    expect(redisMock.set).toHaveBeenCalledWith(`code:${result.code}`, result.roomId, 'EX', 86400);
  });

  it('deletes session:{hostId} after creating room', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue({ hostToken: 'at', hostRefreshToken: 'rt' });
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.set.mockResolvedValue('OK');
    vi.mocked(redisModule.deleteHostSession).mockResolvedValue();

    await createRoom({ hostId: 'h1', name: 'Test Room', voteThreshold: 3, maxSuggestions: 3 });

    expect(vi.mocked(redisModule.deleteHostSession)).toHaveBeenCalledWith('h1');
  });
});

describe('getRoomByCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns room info for a valid code', async () => {
    redisMock.get.mockResolvedValue('room-uuid-1');
    redisMock.hgetall.mockResolvedValue({
      name: 'Friday Jams',
      status: 'active',
      voteThreshold: '3',
      maxSuggestions: '5',
    });

    const result = await getRoomByCode('JAM-ABCD');

    expect(result).toEqual({
      roomId: 'room-uuid-1',
      name: 'Friday Jams',
      status: 'active',
      voteThreshold: 3,
      maxSuggestions: 5,
    });
  });

  it('throws ROOM_NOT_FOUND when code does not exist', async () => {
    redisMock.get.mockResolvedValue(null);

    await expect(getRoomByCode('JAM-XXXX')).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
      statusCode: 404,
    });
  });
});
