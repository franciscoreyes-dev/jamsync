import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/redis', () => ({
  redis: {
    smembers: vi.fn(),
    lindex: vi.fn(),
    hget: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    lpop: vi.fn(),
    lrange: vi.fn(),
  },
}));

vi.mock('../../services/spotify', () => ({
  getCurrentlyPlaying: vi.fn(),
  refreshHostToken: vi.fn(),
}));

vi.mock('../../lib/io', () => ({
  getIo: vi.fn(),
}));

import { pollQueues } from '../../jobs/queuePoller';
import * as redisModule from '../../services/redis';
import * as spotifyModule from '../../services/spotify';
import * as ioModule from '../../lib/io';

const r = redisModule.redis as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('pollQueues', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when active_rooms is empty', async () => {
    r.smembers.mockResolvedValue([]);
    await pollQueues();
    expect(r.lindex).not.toHaveBeenCalled();
  });

  it('does nothing when queue is empty for a room', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    r.lindex.mockResolvedValue(null);
    await pollQueues();
    expect(spotifyModule.getCurrentlyPlaying).not.toHaveBeenCalled();
  });

  it('does nothing when currently playing URI matches queue[0] (still playing)', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    r.lindex.mockResolvedValue('track-1');
    r.hget.mockResolvedValueOnce(JSON.stringify({ uri: 'spotify:track:t1' })); // queue_meta
    r.hget.mockResolvedValueOnce('host-token'); // hostToken
    r.get.mockResolvedValue('spotify:track:t1'); // now_playing = same as queue[0]
    vi.mocked(spotifyModule.getCurrentlyPlaying).mockResolvedValue({ uri: 'spotify:track:t1' });
    r.set.mockResolvedValue('OK');

    await pollQueues();

    expect(r.lpop).not.toHaveBeenCalled();
  });

  it('pops queue[0] and broadcasts queue_updated when track changes away from queue[0]', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    r.lindex.mockResolvedValue('track-1');
    r.hget.mockResolvedValueOnce(JSON.stringify({ uri: 'spotify:track:t1' })); // queue_meta
    r.hget.mockResolvedValueOnce('host-token'); // hostToken
    r.get.mockResolvedValue('spotify:track:t1'); // now_playing was queue[0]
    vi.mocked(spotifyModule.getCurrentlyPlaying).mockResolvedValue({ uri: 'spotify:track:t2' }); // different now
    r.lpop.mockResolvedValue('track-1');
    r.lrange.mockResolvedValue(['track-2']);
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);
    r.set.mockResolvedValue('OK');

    await pollQueues();

    expect(r.lpop).toHaveBeenCalledWith('queue:room-1');
    expect(ioEmit).toHaveBeenCalledWith('queue_updated', { queue: ['track-2'] });
  });

  it('does not pop when stored now_playing does not match queue[0]', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    r.lindex.mockResolvedValue('track-1');
    r.hget.mockResolvedValueOnce(JSON.stringify({ uri: 'spotify:track:t1' }));
    r.hget.mockResolvedValueOnce('host-token');
    r.get.mockResolvedValue('spotify:track:different'); // was NOT our queue[0]
    vi.mocked(spotifyModule.getCurrentlyPlaying).mockResolvedValue({ uri: 'spotify:track:t2' });
    r.set.mockResolvedValue('OK');

    await pollQueues();

    expect(r.lpop).not.toHaveBeenCalled();
  });
});
