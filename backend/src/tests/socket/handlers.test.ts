import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Server, Socket } from 'socket.io';

vi.mock('../../services/redis', () => ({
  redis: {
    sadd: vi.fn(),
    scard: vi.fn(),
    srem: vi.fn(),
    smembers: vi.fn(),
    sismember: vi.fn(),
    hgetall: vi.fn(),
    hget: vi.fn(),
    hset: vi.fn(),
    hdel: vi.fn(),
    rpush: vi.fn(),
    lrange: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../../services/spotify', () => ({
  addToQueue: vi.fn(),
  refreshHostToken: vi.fn(),
}));

import { registerHandlers } from '../../socket/handlers';
import * as redisModule from '../../services/redis';
import * as spotifyModule from '../../services/spotify';

const r = redisModule.redis as unknown as Record<string, ReturnType<typeof vi.fn>> & {
  smembers: ReturnType<typeof vi.fn>;
  sismember: ReturnType<typeof vi.fn>;
};

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
      .mockResolvedValueOnce(null)  // suggestions empty
      .mockResolvedValueOnce(null); // queue_meta empty
    r.lrange.mockResolvedValue([]);
    r.smembers.mockResolvedValue([]);
    r.scard.mockResolvedValue(1);

    registerHandlers(io, socket);
    await socket._captured['join_room']();

    expect(r.sadd).toHaveBeenCalledWith('users:room-1', 'user-1');
    expect(socket.join).toHaveBeenCalledWith('room-1');
    expect(socket._emit).toHaveBeenCalledWith('room_state', expect.objectContaining({ name: 'Test Room', queueMeta: {} }));
    expect(socket._toEmit).toHaveBeenCalledWith('user_joined', expect.objectContaining({ userId: 'user-1' }));
  });
});

describe('suggest_track', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects with MAX_SUGGESTIONS_REACHED when user is at the limit', async () => {
    const socket = makeSocket();
    const { io } = makeIo();

    r.sismember.mockResolvedValue(0); // not muted
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

    r.sismember.mockResolvedValue(0); // not muted
    r.hget.mockResolvedValueOnce('3'); // maxSuggestions = 3
    r.hgetall.mockResolvedValue(null); // no existing suggestions
    r.hset.mockResolvedValue(1);
    r.sadd.mockResolvedValue(1);        // auto-vote SADD
    r.scard.mockResolvedValue(1);       // voteCount = 1
    r.hget.mockResolvedValueOnce('3'); // voteThreshold = 3 (threshold > 1)
    r.lrange.mockResolvedValue([]);

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

  it('emits USER_MUTED error when sender is muted', async () => {
    const socket = makeSocket('room-1', 'muted-user');
    const { io } = makeIo();
    r.sismember.mockResolvedValue(1);     // is muted — handler returns early, hget never called
    registerHandlers(io, socket);
    await socket._captured['suggest_track']({
      trackId: 't1',
      trackMeta: { id: 't1', uri: 'u', name: 'S', artists: [], album: '', albumArt: '', durationMs: 0 },
    });
    expect(socket._emit).toHaveBeenCalledWith('error', { code: 'USER_MUTED' });
  });

  it('auto-votes for the suggester and emits suggestion_added with voteCount=1 when threshold > 1', async () => {
    const socket = makeSocket('room-1', 'user-1');
    const { io, ioEmit } = makeIo();
    r.hget.mockResolvedValueOnce('3');  // maxSuggestions
    r.sismember.mockResolvedValue(0);   // not muted
    r.hgetall.mockResolvedValue({});    // no existing suggestions
    r.hset.mockResolvedValue(1);
    r.sadd.mockResolvedValue(1);        // auto-vote
    r.scard.mockResolvedValue(1);       // voteCount = 1
    r.hget.mockResolvedValueOnce('3'); // voteThreshold = 3
    r.lrange.mockResolvedValue([]);
    registerHandlers(io, socket);

    await socket._captured['suggest_track']({
      trackId: 't1',
      trackMeta: { id: 't1', uri: 'spotify:track:t1', name: 'Song', artists: [], album: '', albumArt: '', durationMs: 0 },
    });

    expect(r.sadd).toHaveBeenCalledWith('votes:room-1:t1', 'user-1');
    expect(ioEmit).toHaveBeenCalledWith('suggestion_added', expect.objectContaining({ trackId: 't1', voteCount: 1 }));
    expect(ioEmit).toHaveBeenCalledWith('vote_updated', expect.objectContaining({ trackId: 't1', voteCount: 1, threshold: 3 }));
  });

  it('auto-approves immediately and emits track_approved when threshold=1', async () => {
    const socket = makeSocket('room-1', 'user-1');
    const { io, ioEmit } = makeIo();
    r.hget.mockResolvedValueOnce('3');  // maxSuggestions
    r.sismember.mockResolvedValue(0);
    r.hgetall.mockResolvedValue({});
    r.hset.mockResolvedValue(1);
    r.sadd.mockResolvedValue(1);
    r.scard.mockResolvedValue(1);
    r.hget.mockResolvedValueOnce('1'); // voteThreshold = 1
    r.hdel.mockResolvedValue(1);
    r.rpush.mockResolvedValue(1);
    r.lrange.mockResolvedValue(['t1']);
    vi.mocked(spotifyModule.addToQueue).mockResolvedValue(undefined);
    registerHandlers(io, socket);

    await socket._captured['suggest_track']({
      trackId: 't1',
      trackMeta: { id: 't1', uri: 'spotify:track:t1', name: 'Song', artists: [], album: '', albumArt: '', durationMs: 0 },
    });

    expect(ioEmit).toHaveBeenCalledWith('track_approved', expect.objectContaining({ trackId: 't1' }));
    expect(ioEmit).toHaveBeenCalledWith('queue_updated', { queue: ['t1'] });
    expect(ioEmit).not.toHaveBeenCalledWith('suggestion_added', expect.anything());
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

    const trackMetaJson = JSON.stringify({ uri: 'spotify:track:1', name: 'Song' });
    r.sadd.mockResolvedValue(1);
    r.scard.mockResolvedValue(3); // voteCount = 3
    r.hget
      .mockResolvedValueOnce('3')             // voteThreshold
      .mockResolvedValueOnce(trackMetaJson)    // trackMeta from suggestions
      .mockResolvedValueOnce('host-token');    // hostToken in addToQueueWithRefresh
    r.hdel.mockResolvedValue(1);
    r.rpush.mockResolvedValue(1);
    r.hset.mockResolvedValue(1);
    r.lrange.mockResolvedValue(['track-1']);
    vi.mocked(spotifyModule.addToQueue).mockResolvedValue(undefined);

    registerHandlers(io, socket);
    await socket._captured['vote_track']({ trackId: 'track-1' });

    expect(r.hdel).toHaveBeenCalledWith('suggestions:room-1', 'track-1');
    expect(r.rpush).toHaveBeenCalledWith('queue:room-1', 'track-1');
    expect(r.hset).toHaveBeenCalledWith('queue_meta:room-1', 'track-1', trackMetaJson);
    expect(spotifyModule.addToQueue).toHaveBeenCalledWith('spotify:track:1', 'host-token');
    expect(ioEmit).toHaveBeenCalledWith('track_approved', expect.objectContaining({ trackId: 'track-1' }));
    expect(ioEmit).toHaveBeenCalledWith('queue_updated', expect.objectContaining({ queue: ['track-1'] }));
  });
});

describe('remove_suggestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits UNAUTHORIZED when caller is not the host', async () => {
    const socket = makeSocket('room-1', 'user-NOT-host');
    const { io } = makeIo();
    r.hget.mockResolvedValueOnce('user-host'); // hostId
    registerHandlers(io, socket);
    await socket._captured['remove_suggestion']({ trackId: 'track-1' });
    expect(socket._emit).toHaveBeenCalledWith('error', { code: 'UNAUTHORIZED' });
    expect(r.hdel).not.toHaveBeenCalled();
  });

  it('deletes suggestion from Redis and broadcasts suggestion_removed', async () => {
    const socket = makeSocket('room-1', 'user-host');
    const { io, ioEmit } = makeIo();
    r.hget.mockResolvedValueOnce('user-host'); // hostId
    r.hdel.mockResolvedValue(1);
    registerHandlers(io, socket);
    await socket._captured['remove_suggestion']({ trackId: 'track-1' });
    expect(r.hdel).toHaveBeenCalledWith('suggestions:room-1', 'track-1');
    expect(ioEmit).toHaveBeenCalledWith('suggestion_removed', { trackId: 'track-1' });
  });
});

describe('update_threshold', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits UNAUTHORIZED when caller is not the host', async () => {
    const socket = makeSocket('room-1', 'user-NOT-host');
    const { io } = makeIo();
    r.hget.mockResolvedValueOnce('user-host'); // hostId
    registerHandlers(io, socket);
    await socket._captured['update_threshold']({ threshold: 5 });
    expect(socket._emit).toHaveBeenCalledWith('error', { code: 'UNAUTHORIZED' });
    expect(r.hset).not.toHaveBeenCalled();
  });

  it('updates voteThreshold in Redis and broadcasts room_updated', async () => {
    const socket = makeSocket('room-1', 'user-host');
    const { io, ioEmit } = makeIo();
    r.hget.mockResolvedValueOnce('user-host'); // hostId
    r.hset.mockResolvedValue(1);
    registerHandlers(io, socket);
    await socket._captured['update_threshold']({ threshold: 5 });
    expect(r.hset).toHaveBeenCalledWith('room:room-1', 'voteThreshold', 5);
    expect(ioEmit).toHaveBeenCalledWith('room_updated', { voteThreshold: 5 });
  });
});

describe('leave_room', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes user from users SET and broadcasts user_left', async () => {
    const socket = makeSocket();
    const { io, ioEmit } = makeIo();
    r.srem.mockResolvedValue(1);
    r.scard.mockResolvedValue(3);
    registerHandlers(io, socket);
    await socket._captured['leave_room']();
    expect(r.srem).toHaveBeenCalledWith('users:room-1', 'user-1');
    expect(ioEmit).toHaveBeenCalledWith('user_left', { userId: 'user-1', participantCount: 3 });
  });
});

describe('mute_user', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits UNAUTHORIZED when caller is not the host', async () => {
    const socket = makeSocket('room-1', 'user-NOT-host');
    const { io } = makeIo();
    r.hget.mockResolvedValueOnce('user-host'); // hostId
    registerHandlers(io, socket);
    await socket._captured['mute_user']({ userId: 'target-user' });
    expect(socket._emit).toHaveBeenCalledWith('error', { code: 'UNAUTHORIZED' });
    expect(r.sadd).not.toHaveBeenCalled();
  });

  it('adds user to muted set, does NOT delete suggestions, broadcasts user_muted with trackIds', async () => {
    const socket = makeSocket('room-1', 'user-host');
    const { io, ioEmit } = makeIo();
    r.hget.mockResolvedValueOnce('user-host'); // hostId
    r.sadd.mockResolvedValue(1);
    r.hgetall.mockResolvedValue({
      'track-1': JSON.stringify({ suggestedBy: 'target-user', name: 'Song A' }),
      'track-2': JSON.stringify({ suggestedBy: 'user-other', name: 'Song B' }),
      'track-3': JSON.stringify({ suggestedBy: 'target-user', name: 'Song C' }),
    });
    registerHandlers(io, socket);
    await socket._captured['mute_user']({ userId: 'target-user' });
    expect(r.sadd).toHaveBeenCalledWith('muted:room-1', 'target-user');
    expect(r.hdel).not.toHaveBeenCalled();
    expect(ioEmit).toHaveBeenCalledWith('user_muted', {
      userId: 'target-user',
      trackIds: expect.arrayContaining(['track-1', 'track-3']),
    });
  });
});

describe('unmute_user', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits UNAUTHORIZED when caller is not the host', async () => {
    const socket = makeSocket('room-1', 'user-NOT-host');
    const { io } = makeIo();
    r.hget.mockResolvedValueOnce('user-host');
    registerHandlers(io, socket);
    await socket._captured['unmute_user']({ userId: 'target-user' });
    expect(socket._emit).toHaveBeenCalledWith('error', { code: 'UNAUTHORIZED' });
    expect(r.srem).not.toHaveBeenCalled();
  });

  it('removes user from muted set and broadcasts user_unmuted with their track IDs', async () => {
    const socket = makeSocket('room-1', 'user-host');
    const { io, ioEmit } = makeIo();
    r.hget.mockResolvedValueOnce('user-host');
    r.srem.mockResolvedValue(1);
    r.hgetall.mockResolvedValue({
      'track-1': JSON.stringify({ suggestedBy: 'target-user', name: 'Song A' }),
      'track-2': JSON.stringify({ suggestedBy: 'user-other', name: 'Song B' }),
    });
    registerHandlers(io, socket);
    await socket._captured['unmute_user']({ userId: 'target-user' });
    expect(r.srem).toHaveBeenCalledWith('muted:room-1', 'target-user');
    expect(ioEmit).toHaveBeenCalledWith('user_unmuted', {
      userId: 'target-user',
      trackIds: ['track-1'],
    });
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
