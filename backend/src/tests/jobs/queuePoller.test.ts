import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/redis', () => ({
  redis: {
    smembers: vi.fn(),
    lindex: vi.fn(),
    hget: vi.fn(),
    hset: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    lpop: vi.fn(),
    rpush: vi.fn(),
    ltrim: vi.fn(),
    expire: vi.fn(),
    lrange: vi.fn(),
  },
}));

vi.mock('../../services/spotify', () => ({
  getCurrentlyPlaying: vi.fn(),
  getTrackInfo: vi.fn(),
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
    r.hget.mockResolvedValueOnce('host-token');
    vi.mocked(spotifyModule.getCurrentlyPlaying).mockResolvedValue(null);
    r.get.mockResolvedValue(null);
    r.lindex.mockResolvedValue(null);

    await pollQueues();

    expect(r.lpop).not.toHaveBeenCalled();
    expect(r.rpush).not.toHaveBeenCalled();
  });

  it('pops queue[0] when currentUri matches queue[0]', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    r.hget.mockResolvedValueOnce('host-token');
    vi.mocked(spotifyModule.getCurrentlyPlaying).mockResolvedValue({ uri: 'spotify:track:t1' });
    r.get.mockResolvedValue('spotify:track:t1'); // storedUri already t1 — skips now_playing update
    r.lindex.mockResolvedValue('track-1');
    r.hget.mockResolvedValueOnce(JSON.stringify({ uri: 'spotify:track:t1' }));
    r.lpop.mockResolvedValue('track-1');
    r.rpush.mockResolvedValue(1);
    r.ltrim.mockResolvedValue('OK');
    r.expire.mockResolvedValue(1);
    r.lrange.mockResolvedValueOnce([]);          // queue after pop
    r.lrange.mockResolvedValueOnce(['track-1']); // history after push
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);

    await pollQueues();

    expect(r.lpop).toHaveBeenCalledWith('queue:room-1');
    expect(ioEmit).toHaveBeenCalledWith('queue_updated', { queue: [], history: ['track-1'] });
  });

  it('does not pop when currentUri does not match queue[0]', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    r.hget.mockResolvedValueOnce('host-token');
    vi.mocked(spotifyModule.getCurrentlyPlaying).mockResolvedValue({ uri: 'spotify:track:t2' });
    r.get.mockResolvedValue('spotify:track:t1');
    r.lindex.mockResolvedValue('track-1');
    r.hget.mockResolvedValueOnce(JSON.stringify({ uri: 'spotify:track:t1' }));
    r.hget.mockResolvedValueOnce(JSON.stringify({ id: 't2', name: 'New', artists: [], album: '', albumArt: '', uri: 'spotify:track:t2', durationMs: 0 }));
    r.set.mockResolvedValue('OK');
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);

    await pollQueues();

    expect(r.lpop).not.toHaveBeenCalled();
  });

  it('pushes to history and trims when track is popped', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    r.hget.mockResolvedValueOnce('host-token');
    vi.mocked(spotifyModule.getCurrentlyPlaying).mockResolvedValue({ uri: 'spotify:track:t1' });
    r.get.mockResolvedValue('spotify:track:t1'); // storedUri already t1 — skips now_playing update
    r.lindex.mockResolvedValue('track-1');
    r.hget.mockResolvedValueOnce(JSON.stringify({ uri: 'spotify:track:t1' }));
    r.lpop.mockResolvedValue('track-1');
    r.rpush.mockResolvedValue(1);
    r.ltrim.mockResolvedValue('OK');
    r.expire.mockResolvedValue(1);
    r.lrange.mockResolvedValueOnce([]);
    r.lrange.mockResolvedValueOnce(['track-1']);
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);

    await pollQueues();

    expect(r.rpush).toHaveBeenCalledWith('history:room-1', 'track-1');
    expect(r.ltrim).toHaveBeenCalledWith('history:room-1', -20, -1);
  });

  it('broadcasts now_playing_updated when URI changes', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    r.hget.mockResolvedValueOnce('host-token');
    vi.mocked(spotifyModule.getCurrentlyPlaying).mockResolvedValue({ uri: 'spotify:track:t2' });
    r.get.mockResolvedValue('spotify:track:t1');
    r.lindex.mockResolvedValue(null);
    r.hget.mockResolvedValueOnce(JSON.stringify({ id: 't2', name: 'New Track', artists: ['Art'], album: 'Al', albumArt: '', uri: 'spotify:track:t2', durationMs: 0 }));
    r.set.mockResolvedValue('OK');
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);

    await pollQueues();

    expect(ioEmit).toHaveBeenCalledWith('now_playing_updated', expect.objectContaining({
      trackId: 't2',
      meta: expect.objectContaining({ name: 'New Track' }),
    }));
  });

  it('calls getTrackInfo and caches when track not in queue_meta', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    r.hget.mockResolvedValueOnce('host-token');
    vi.mocked(spotifyModule.getCurrentlyPlaying).mockResolvedValue({ uri: 'spotify:track:ext' });
    r.get.mockResolvedValue('spotify:track:old');
    r.lindex.mockResolvedValue(null);
    r.hget.mockResolvedValueOnce(null);
    vi.mocked(spotifyModule.getTrackInfo).mockResolvedValue({ id: 'ext', name: 'External', artists: ['X'], album: 'A', albumArt: '', uri: 'spotify:track:ext', durationMs: 200 });
    r.hset.mockResolvedValue(1);
    r.set.mockResolvedValue('OK');
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);

    await pollQueues();

    expect(spotifyModule.getTrackInfo).toHaveBeenCalledWith('ext', 'host-token');
    expect(r.hset).toHaveBeenCalledWith('queue_meta:room-1', 'ext', expect.any(String));
    expect(ioEmit).toHaveBeenCalledWith('now_playing_updated', expect.objectContaining({ trackId: 'ext' }));
  });

  it('broadcasts now_playing_updated with nulls when playback stops', async () => {
    r.smembers.mockResolvedValue(['room-1']);
    r.hget.mockResolvedValueOnce('host-token');
    vi.mocked(spotifyModule.getCurrentlyPlaying).mockResolvedValue(null);
    r.get.mockResolvedValue('spotify:track:t1');
    r.lindex.mockResolvedValue(null);
    r.del.mockResolvedValue(1);
    const ioEmit = vi.fn();
    vi.mocked(ioModule.getIo).mockReturnValue({ to: vi.fn(() => ({ emit: ioEmit })) } as never);

    await pollQueues();

    expect(ioEmit).toHaveBeenCalledWith('now_playing_updated', { trackId: null, meta: null });
  });
});
