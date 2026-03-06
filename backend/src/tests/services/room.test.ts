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
    del: vi.fn(),
    sadd: vi.fn(),
    srem: vi.fn(),
  },
}));

vi.mock('../../lib/io', () => ({
  getIo: vi.fn(),
}));

import { createRoom, getRoomByCode, updateRoom, deleteRoom } from '../../services/room';
import * as redisModule from '../../services/redis';
import * as ioModule from '../../lib/io';

const redisMock = redisModule.redis as unknown as {
  hset: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  hgetall: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  sadd: ReturnType<typeof vi.fn>;
  srem: ReturnType<typeof vi.fn>;
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
    vi.mocked(redisModule.getHostSession).mockResolvedValue({ hostToken: 'at', hostRefreshToken: 'rt', spotifyId: 'spotify-user-1' });
    redisMock.get.mockResolvedValue(null);
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.set.mockResolvedValue('OK');
    vi.mocked(redisModule.deleteHostSession).mockResolvedValue();

    const result = await createRoom({ hostId: 'h1', name: 'Test Room', voteThreshold: 3, maxSuggestions: 3 });

    expect(result.roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(result.code).toMatch(/^JAM-[A-Z0-9]{4}$/);
  });

  it('stores room hash with all required fields', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue({ hostToken: 'at', hostRefreshToken: 'rt', spotifyId: 'spotify-user-1' });
    redisMock.get.mockResolvedValue(null);
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
        code: result.code,
        spotifyId: 'spotify-user-1',
      })
    );
    expect(redisMock.expire).toHaveBeenCalledWith(`room:${result.roomId}`, 86400);
  });

  it('stores code:{JAM-XXXX} → roomId mapping with 24h TTL', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue({ hostToken: 'at', hostRefreshToken: 'rt', spotifyId: 'spotify-user-1' });
    redisMock.get.mockResolvedValue(null);
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.set.mockResolvedValue('OK');
    vi.mocked(redisModule.deleteHostSession).mockResolvedValue();

    const result = await createRoom({ hostId: 'h1', name: 'Test Room', voteThreshold: 3, maxSuggestions: 3 });

    expect(redisMock.set).toHaveBeenCalledWith(`code:${result.code}`, result.roomId, 'EX', 86400);
  });

  it('deletes session:{hostId} after creating room', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue({ hostToken: 'at', hostRefreshToken: 'rt', spotifyId: 'spotify-user-1' });
    redisMock.get.mockResolvedValue(null);
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.set.mockResolvedValue('OK');
    vi.mocked(redisModule.deleteHostSession).mockResolvedValue();

    await createRoom({ hostId: 'h1', name: 'Test Room', voteThreshold: 3, maxSuggestions: 3 });

    expect(vi.mocked(redisModule.deleteHostSession)).toHaveBeenCalledWith('h1');
  });

  it('adds roomId to active_rooms SET', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue({ hostToken: 'at', hostRefreshToken: 'rt', spotifyId: 'spotify-user-1' });
    redisMock.get.mockResolvedValue(null);
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.set.mockResolvedValue('OK');
    redisMock.sadd.mockResolvedValue(1);

    const result = await createRoom({ hostId: 'h1', name: 'Test', voteThreshold: 3, maxSuggestions: 3 });

    expect(redisMock.sadd).toHaveBeenCalledWith('active_rooms', result.roomId);
  });

  it('returns existing room when host already has an active room', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue({
      hostToken: 'at', hostRefreshToken: 'rt', spotifyId: 'spotify-user-1'
    });
    redisMock.get.mockResolvedValue('existing-room-id');
    redisMock.hgetall.mockResolvedValue({ status: 'active', code: 'JAM-ABCD', spotifyId: 'spotify-user-1' });
    vi.mocked(redisModule.deleteHostSession).mockResolvedValue();

    const result = await createRoom({ hostId: 'h1', name: 'New Room', voteThreshold: 3, maxSuggestions: 3 });

    expect(result).toEqual({ roomId: 'existing-room-id', code: 'JAM-ABCD' });
    expect(redisMock.hset).not.toHaveBeenCalled();
  });

  it('sets host_room:{spotifyId} key when creating a new room', async () => {
    vi.mocked(redisModule.getHostSession).mockResolvedValue({
      hostToken: 'at', hostRefreshToken: 'rt', spotifyId: 'spotify-user-1'
    });
    redisMock.get.mockResolvedValue(null);
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.set.mockResolvedValue('OK');
    redisMock.sadd.mockResolvedValue(1);
    vi.mocked(redisModule.deleteHostSession).mockResolvedValue();

    const result = await createRoom({ hostId: 'h1', name: 'Test', voteThreshold: 3, maxSuggestions: 3 });

    expect(redisMock.set).toHaveBeenCalledWith('host_room:spotify-user-1', result.roomId, 'EX', 86400);
  });
});

describe('updateRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws ROOM_NOT_FOUND when roomId does not exist', async () => {
    redisMock.hgetall.mockResolvedValue(null);
    await expect(
      updateRoom({ roomId: 'bad-id', hostId: 'h1', voteThreshold: 5 })
    ).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND', statusCode: 404 });
  });

  it('throws UNAUTHORIZED when hostId does not match', async () => {
    redisMock.hgetall.mockResolvedValue({ hostId: 'h1', voteThreshold: '3', maxSuggestions: '3' });
    await expect(
      updateRoom({ roomId: 'room-1', hostId: 'h2', voteThreshold: 5 })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 403 });
  });

  it('updates voteThreshold in Redis and returns updated values', async () => {
    redisMock.hgetall.mockResolvedValue({ hostId: 'h1', voteThreshold: '3', maxSuggestions: '3' });
    redisMock.hset.mockResolvedValue(1);
    const result = await updateRoom({ roomId: 'room-1', hostId: 'h1', voteThreshold: 5 });
    expect(redisMock.hset).toHaveBeenCalledWith('room:room-1', 'voteThreshold', '5');
    expect(result).toEqual({ roomId: 'room-1', voteThreshold: 5, maxSuggestions: 3 });
  });

  it('updates maxSuggestions in Redis and returns updated values', async () => {
    redisMock.hgetall.mockResolvedValue({ hostId: 'h1', voteThreshold: '3', maxSuggestions: '3' });
    redisMock.hset.mockResolvedValue(1);
    const result = await updateRoom({ roomId: 'room-1', hostId: 'h1', maxSuggestions: 2 });
    expect(redisMock.hset).toHaveBeenCalledWith('room:room-1', 'maxSuggestions', '2');
    expect(result).toEqual({ roomId: 'room-1', voteThreshold: 3, maxSuggestions: 2 });
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

describe('deleteRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws ROOM_NOT_FOUND when room does not exist', async () => {
    redisMock.hgetall.mockResolvedValue(null);

    await expect(deleteRoom({ roomId: 'room-1', hostId: 'h1' })).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('throws UNAUTHORIZED when hostId does not match', async () => {
    redisMock.hgetall.mockResolvedValue({ hostId: 'h1', code: 'JAM-ABCD', spotifyId: 'spotify-user-1' });

    await expect(deleteRoom({ roomId: 'room-1', hostId: 'h2' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 403,
    });
  });

  it('deletes room keys from Redis and broadcasts room_closed', async () => {
    redisMock.hgetall.mockResolvedValue({ hostId: 'h1', code: 'JAM-ABCD', spotifyId: 'spotify-user-1' });
    redisMock.del.mockResolvedValue(1);
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);

    await deleteRoom({ roomId: 'room-1', hostId: 'h1' });

    expect(redisMock.del).toHaveBeenCalledWith(
      'room:room-1', 'queue:room-1', 'suggestions:room-1',
      'queue_meta:room-1', 'users:room-1', 'code:JAM-ABCD',
      'host_room:spotify-user-1', 'history:room-1'
    );
    expect(ioEmit).toHaveBeenCalledWith('room_closed', { roomId: 'room-1' });
  });

  it('removes roomId from active_rooms SET on deletion', async () => {
    redisMock.get.mockResolvedValue(null);
    redisMock.hgetall.mockResolvedValue({ hostId: 'h1', code: 'JAM-ABCD', spotifyId: 'spotify-user-1' });
    redisMock.del.mockResolvedValue(1);
    redisMock.srem.mockResolvedValue(1);
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);

    await deleteRoom({ roomId: 'room-1', hostId: 'h1' });

    expect(redisMock.srem).toHaveBeenCalledWith('active_rooms', 'room-1');
  });

  it('resolves room code to UUID before deletion', async () => {
    redisMock.get.mockResolvedValue('room-uuid-1');
    redisMock.hgetall.mockResolvedValue({ hostId: 'h1', code: 'JAM-ABCD', spotifyId: 'spotify-user-1' });
    redisMock.del.mockResolvedValue(1);
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);

    await deleteRoom({ roomId: 'JAM-ABCD', hostId: 'h1' });

    expect(redisMock.get).toHaveBeenCalledWith('code:JAM-ABCD');
    expect(redisMock.hgetall).toHaveBeenCalledWith('room:room-uuid-1');
    expect(redisMock.del).toHaveBeenCalledWith(
      'room:room-uuid-1', 'queue:room-uuid-1', 'suggestions:room-uuid-1',
      'queue_meta:room-uuid-1', 'users:room-uuid-1', 'code:JAM-ABCD',
      'host_room:spotify-user-1', 'history:room-uuid-1'
    );
    expect(ioEmit).toHaveBeenCalledWith('room_closed', { roomId: 'room-uuid-1' });
  });

  it('removes host_room, history, and code keys on deletion', async () => {
    redisMock.get.mockResolvedValue(null);
    redisMock.hgetall.mockResolvedValue({ hostId: 'h1', code: 'JAM-ABCD', spotifyId: 'spotify-user-1' });
    redisMock.del.mockResolvedValue(1);
    redisMock.srem.mockResolvedValue(1);
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);

    await deleteRoom({ roomId: 'room-1', hostId: 'h1' });

    expect(redisMock.del).toHaveBeenCalledWith(
      'room:room-1', 'queue:room-1', 'suggestions:room-1',
      'queue_meta:room-1', 'users:room-1', 'code:JAM-ABCD',
      'host_room:spotify-user-1', 'history:room-1'
    );
  });
});
