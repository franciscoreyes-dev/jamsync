import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Server, Socket } from 'socket.io';

vi.mock('../../services/redis', () => ({
  redis: {
    sadd: vi.fn(),
    scard: vi.fn(),
    srem: vi.fn(),
    hgetall: vi.fn(),
    hget: vi.fn(),
    hset: vi.fn(),
    hdel: vi.fn(),
    rpush: vi.fn(),
    lrange: vi.fn(),
  },
}));

vi.mock('../../services/spotify', () => ({
  addToQueue: vi.fn(),
  refreshHostToken: vi.fn(),
}));

import { registerHandlers } from '../../socket/handlers';
import * as redisModule from '../../services/redis';
import * as spotifyModule from '../../services/spotify';

const r = redisModule.redis as unknown as Record<string, ReturnType<typeof vi.fn>>;

// Capture handlers registered via socket.on()
function makeSocket(roomId = 'room-1', userId = 'user-1') {
  const captured: Record<string, (...args: unknown[]) => Promise<void>> = {};
  const socketEmit = vi.fn();
  const socketToEmit = vi.fn();
  return {
    data: { roomId, userId },
    on: vi.fn((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      captured[event] = handler;
    }),
    emit: socketEmit,
    join: vi.fn(),
    to: vi.fn(() => ({ emit: socketToEmit })),
    _captured: captured,
    _emit: socketEmit,
    _toEmit: socketToEmit,
  } as unknown as Socket & {
    _captured: Record<string, (...args: unknown[]) => Promise<void>>;
    _emit: ReturnType<typeof vi.fn>;
    _toEmit: ReturnType<typeof vi.fn>;
  };
}

function makeIo() {
  const ioEmit = vi.fn();
  return {
    io: { to: vi.fn(() => ({ emit: ioEmit })) } as unknown as Server,
    ioEmit,
  };
}

describe('join_room', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds userId to users SET, joins room, emits room_state and broadcasts user_joined', async () => {
    const socket = makeSocket();
    const { io, ioEmit } = makeIo();

    r.sadd.mockResolvedValue(1);
    r.hgetall
      .mockResolvedValueOnce({ name: 'Test Room', status: 'active', voteThreshold: '3', maxSuggestions: '3' })
      .mockResolvedValueOnce(null); // suggestions empty
    r.lrange.mockResolvedValue([]);
    r.scard.mockResolvedValue(1);

    registerHandlers(io, socket);
    await socket._captured['join_room']();

    expect(r.sadd).toHaveBeenCalledWith('users:room-1', 'user-1');
    expect(socket.join).toHaveBeenCalledWith('room-1');
    expect(socket._emit).toHaveBeenCalledWith('room_state', expect.objectContaining({ name: 'Test Room' }));
    expect(socket._toEmit).toHaveBeenCalledWith('user_joined', expect.objectContaining({ userId: 'user-1' }));
  });
});

describe('suggest_track', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects with MAX_SUGGESTIONS_REACHED when user is at the limit', async () => {
    const socket = makeSocket();
    const { io } = makeIo();

    r.hget.mockResolvedValue('2'); // maxSuggestions = 2
    r.hgetall.mockResolvedValue({
      'track-a': JSON.stringify({ uri: 'uri-a', suggestedBy: 'user-1' }),
      'track-b': JSON.stringify({ uri: 'uri-b', suggestedBy: 'user-1' }),
    });

    registerHandlers(io, socket);
    await socket._captured['suggest_track']({
      trackId: 'track-c',
      trackMeta: { id: 'track-c', name: 'Song C', artists: ['Artist'], album: 'Album', albumArt: '', uri: 'uri-c', durationMs: 180000 },
    });

    expect(socket._emit).toHaveBeenCalledWith('error', { code: 'MAX_SUGGESTIONS_REACHED' });
    expect(r.hset).not.toHaveBeenCalled();
  });

  it('saves metadata to suggestions hash and broadcasts suggestion_added', async () => {
    const socket = makeSocket();
    const { io, ioEmit } = makeIo();

    r.hget.mockResolvedValue('3'); // maxSuggestions = 3
    r.hgetall.mockResolvedValue(null); // no existing suggestions
    r.hset.mockResolvedValue(1);

    registerHandlers(io, socket);
    const trackMeta = { id: 'track-1', name: 'Song', artists: ['Artist'], album: 'Album', albumArt: '', uri: 'spotify:track:1', durationMs: 200000 };
    await socket._captured['suggest_track']({ trackId: 'track-1', trackMeta });

    expect(r.hset).toHaveBeenCalledWith(
      'suggestions:room-1',
      'track-1',
      expect.stringContaining('"uri":"spotify:track:1"')
    );
    expect(ioEmit).toHaveBeenCalledWith('suggestion_added', expect.objectContaining({ trackId: 'track-1' }));
  });
});

describe('vote_track', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits error ALREADY_VOTED when user has already voted', async () => {
    const socket = makeSocket();
    const { io } = makeIo();

    r.sadd.mockResolvedValue(0); // already voted

    registerHandlers(io, socket);
    await socket._captured['vote_track']({ trackId: 'track-1' });

    expect(socket._emit).toHaveBeenCalledWith('error', { code: 'ALREADY_VOTED' });
  });

  it('broadcasts vote_updated with current voteCount and threshold', async () => {
    const socket = makeSocket();
    const { io, ioEmit } = makeIo();

    r.sadd.mockResolvedValue(1);
    r.scard.mockResolvedValue(2);
    r.hget.mockResolvedValueOnce('3'); // voteThreshold — threshold not met so no further hget calls

    registerHandlers(io, socket);
    await socket._captured['vote_track']({ trackId: 'track-1' });

    expect(ioEmit).toHaveBeenCalledWith('vote_updated', { trackId: 'track-1', voteCount: 2, threshold: 3 });
  });

  it('moves track to queue, calls addToQueue, broadcasts track_approved + queue_updated when threshold met', async () => {
    const socket = makeSocket();
    const { io, ioEmit } = makeIo();

    r.sadd.mockResolvedValue(1);
    r.scard.mockResolvedValue(3); // voteCount = 3
    r.hget
      .mockResolvedValueOnce('3')                                              // voteThreshold
      .mockResolvedValueOnce(JSON.stringify({ uri: 'spotify:track:1', name: 'Song' })) // trackMeta
      .mockResolvedValueOnce('host-access-token');                             // hostToken
    r.hdel.mockResolvedValue(1);
    r.rpush.mockResolvedValue(1);
    r.lrange.mockResolvedValue(['track-1']);
    vi.mocked(spotifyModule.addToQueue).mockResolvedValue(undefined);

    registerHandlers(io, socket);
    await socket._captured['vote_track']({ trackId: 'track-1' });

    expect(r.hdel).toHaveBeenCalledWith('suggestions:room-1', 'track-1');
    expect(r.rpush).toHaveBeenCalledWith('queue:room-1', 'track-1');
    expect(spotifyModule.addToQueue).toHaveBeenCalledWith('spotify:track:1', 'host-access-token');
    expect(ioEmit).toHaveBeenCalledWith('track_approved', expect.objectContaining({ trackId: 'track-1' }));
    expect(ioEmit).toHaveBeenCalledWith('queue_updated', expect.objectContaining({ queue: ['track-1'] }));
  });
});

describe('disconnect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes userId from users SET and broadcasts user_left', async () => {
    const socket = makeSocket();
    const { io, ioEmit } = makeIo();

    r.srem.mockResolvedValue(1);
    r.scard.mockResolvedValue(2);

    registerHandlers(io, socket);
    await socket._captured['disconnect']();

    expect(r.srem).toHaveBeenCalledWith('users:room-1', 'user-1');
    expect(ioEmit).toHaveBeenCalledWith('user_left', expect.objectContaining({ userId: 'user-1' }));
  });
});
