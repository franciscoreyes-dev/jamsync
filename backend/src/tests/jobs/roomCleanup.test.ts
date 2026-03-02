import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/redis', () => ({
  redis: {
    smembers: vi.fn(),
    hgetall: vi.fn(),
  },
}));

vi.mock('../../services/room', () => ({
  deleteRoom: vi.fn(),
}));

import { cleanupRooms } from '../../jobs/roomCleanup';
import * as redisModule from '../../services/redis';
import * as roomModule from '../../services/room';

const r = redisModule.redis as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('cleanupRooms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when active_rooms is empty', async () => {
    r.smembers.mockResolvedValue([]);
    await cleanupRooms();
    expect(roomModule.deleteRoom).not.toHaveBeenCalled();
  });

  it('skips rooms created less than 6h ago', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    const recentTs = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    r.hgetall.mockResolvedValue({ hostId: 'h1', status: 'active', createdAt: recentTs });

    await cleanupRooms();

    expect(roomModule.deleteRoom).not.toHaveBeenCalled();
  });

  it('deletes rooms older than 6h', async () => {
    r.smembers.mockResolvedValue(['room-old']);
    const oldTs = new Date(Date.now() - 7 * 3600 * 1000).toISOString();
    r.hgetall.mockResolvedValue({ hostId: 'h1', status: 'active', createdAt: oldTs });
    vi.mocked(roomModule.deleteRoom).mockResolvedValue(undefined);

    await cleanupRooms();

    expect(roomModule.deleteRoom).toHaveBeenCalledWith({ roomId: 'room-old', hostId: 'h1' });
  });

  it('skips rooms with no data (already expired from Redis)', async () => {
    r.smembers.mockResolvedValue(['room-ghost']);
    r.hgetall.mockResolvedValue(null);

    await cleanupRooms();

    expect(roomModule.deleteRoom).not.toHaveBeenCalled();
  });
});
