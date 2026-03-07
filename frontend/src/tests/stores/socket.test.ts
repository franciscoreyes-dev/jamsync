import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { Socket } from 'socket.io-client';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
vi.mock('@/stores/toast', () => ({ useToastStore: vi.fn() }));

import { io } from 'socket.io-client';
import { useSocketStore } from '@/stores/socket';
import { useRoomStore } from '@/stores/room';
import { useQueueStore } from '@/stores/queue';
import { useToastStore } from '@/stores/toast';
import type { RoomStatePayload, SuggestionItem } from '@/types/socket';

const mockAddToast = vi.fn();
vi.mocked(useToastStore).mockReturnValue({ addToast: mockAddToast, toasts: [], removeToast: vi.fn() } as never);

const TRACK_META: SuggestionItem = {
  id: 'track-1', name: 'Song', artists: ['Artist'], album: 'Album',
  albumArt: '', uri: 'spotify:track:1', durationMs: 180000, suggestedBy: 'user-a',
};

const ROOM_STATE: RoomStatePayload = {
  roomId: 'room-1', name: 'Jam', status: 'active',
  voteThreshold: 3, maxSuggestions: 3, queue: [], suggestions: [], participantCount: 1,
};

let capturedHandlers: Record<string, (...args: unknown[]) => void>;
let mockSocket: { on: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };

beforeEach(() => {
  setActivePinia(createPinia());
  capturedHandlers = {};
  mockSocket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      capturedHandlers[event] = handler;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  vi.mocked(io).mockReturnValue(mockSocket as unknown as Socket);
});

describe('connect', () => {
  it('calls io() with correct URL and auth', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { roomCode: 'JAM-1234', userId: 'user-1' } })
    );
  });

  it('emits join_room immediately after connecting', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    expect(mockSocket.emit).toHaveBeenCalledWith('join_room');
  });

  it('sets connected=true on connect event', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['connect']();
    expect(store.connected).toBe(true);
  });

  it('sets connected=false on disconnect event', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['connect']();
    capturedHandlers['disconnect']();
    expect(store.connected).toBe(false);
  });
});

describe('room_state event', () => {
  it('updates room store', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['room_state'](ROOM_STATE);
    const room = useRoomStore();
    expect(room.roomId).toBe('room-1');
    expect(room.name).toBe('Jam');
    expect(room.participantCount).toBe(1);
  });

  it('initializes queue store', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['room_state']({ ...ROOM_STATE, queue: ['track-2'] });
    const queue = useQueueStore();
    expect(queue.queue).toEqual(['track-2']);
  });
});

describe('suggestion_added event', () => {
  it('adds suggestion to queue store', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['suggestion_added']({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 0 });
    const queue = useQueueStore();
    expect(queue.suggestions['track-1']).toBeDefined();
    expect(queue.suggestions['track-1'].voteCount).toBe(0);
  });
});

describe('vote_updated event', () => {
  it('updates voteCount while preserving existing votedByMe', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 0 });
    queue.updateVote('track-1', 0, true); // user already voted optimistically
    capturedHandlers['vote_updated']({ trackId: 'track-1', voteCount: 2, threshold: 3 });
    expect(queue.suggestions['track-1'].voteCount).toBe(2);
    expect(queue.suggestions['track-1'].votedByMe).toBe(true); // preserved
  });
});

describe('track_approved event', () => {
  it('removes the track from suggestions', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 0 });
    capturedHandlers['track_approved']({ trackId: 'track-1', trackMeta: TRACK_META });
    expect(queue.suggestions['track-1']).toBeUndefined();
  });

  it('stores track metadata in queueMetadata', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    const queue = useQueueStore();
    capturedHandlers['track_approved']({ trackId: 'track-1', trackMeta: TRACK_META });
    expect(queue.queueMetadata['track-1']).toMatchObject({ name: 'Song', albumArt: '' });
  });
});

describe('queue_updated event', () => {
  it('replaces the queue', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['queue_updated']({ queue: ['track-1', 'track-2'] });
    const queue = useQueueStore();
    expect(queue.queue).toEqual(['track-1', 'track-2']);
  });
});

describe('user_joined / user_left events', () => {
  it('user_joined updates participantCount', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['user_joined']({ userId: 'user-2', participantCount: 5 });
    expect(useRoomStore().participantCount).toBe(5);
  });

  it('user_left updates participantCount', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['user_left']({ userId: 'user-2', participantCount: 3 });
    expect(useRoomStore().participantCount).toBe(3);
  });
});

describe('emit helpers', () => {
  it('suggestTrack emits suggest_track with payload', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    store.suggestTrack({ trackId: 'track-1', trackMeta: TRACK_META });
    expect(mockSocket.emit).toHaveBeenCalledWith('suggest_track', { trackId: 'track-1', trackMeta: TRACK_META });
  });

  it('voteTrack emits vote_track with payload', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    store.voteTrack({ trackId: 'track-1' });
    expect(mockSocket.emit).toHaveBeenCalledWith('vote_track', { trackId: 'track-1' });
  });

  it('removeSuggestion emits remove_suggestion with payload', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    store.removeSuggestion({ roomId: 'room-1', trackId: 'track-1' });
    expect(mockSocket.emit).toHaveBeenCalledWith('remove_suggestion', { roomId: 'room-1', trackId: 'track-1' });
  });

  it('updateThreshold emits update_threshold with payload', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    store.updateThreshold({ roomId: 'room-1', threshold: 5 });
    expect(mockSocket.emit).toHaveBeenCalledWith('update_threshold', { roomId: 'room-1', threshold: 5 });
  });

  it('muteUser emits mute_user with payload', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    store.muteUser({ roomId: 'room-1', userId: 'user-2' });
    expect(mockSocket.emit).toHaveBeenCalledWith('mute_user', { roomId: 'room-1', userId: 'user-2' });
  });
});

describe('room_updated event', () => {
  it('updates voteThreshold in room store', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['room_updated']({ voteThreshold: 5 });
    expect(useRoomStore().voteThreshold).toBe(5);
  });
});

describe('connect guard', () => {
  it('does not create a new socket if already connected', () => {
    const store = useSocketStore();
    vi.mocked(io).mockClear();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['connect'](); // mark as connected
    store.connect('JAM-1234', 'user-1'); // second call while connected
    expect(vi.mocked(io)).toHaveBeenCalledTimes(1); // only the first call created a socket
  });
});

describe('suggestion_removed event', () => {
  it('removes the suggestion from queue store', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 1 });
    capturedHandlers['suggestion_removed']({ trackId: 'track-1' });
    expect(queue.suggestions['track-1']).toBeUndefined();
  });
});

describe('disconnect', () => {
  it('calls socket.disconnect() and clears state', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['connect']();
    store.disconnect();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(store.connected).toBe(false);
  });
});

describe('room_closed event', () => {
  it('sets roomClosed to true', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['room_closed']({ roomId: 'room-1' });
    expect(store.roomClosed).toBe(true);
  });
});

describe('leaveRoom', () => {
  it('emits leave_room with roomId and userId', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    store.leaveRoom({ roomId: 'room-1', userId: 'user-1' });
    expect(mockSocket.emit).toHaveBeenCalledWith('leave_room', { roomId: 'room-1', userId: 'user-1' });
  });
});

describe('disconnect', () => {
  it('resets connected, roomClosed and error so connect can be called again', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['room_closed']?.();
    expect(store.roomClosed).toBe(true);

    store.disconnect();

    expect(store.roomClosed).toBe(false);
    expect(store.error).toBeNull();
    expect(store.connected).toBe(false);
  });

  it('allows connect() to be called again after disconnect', () => {
    const store = useSocketStore();
    store.connect('JAM-OLD', 'user-1');
    store.disconnect();

    vi.mocked(io).mockClear();
    store.connect('JAM-NEW', 'user-1');

    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { roomCode: 'JAM-NEW', userId: 'user-1' } })
    );
  });
});

describe('user_muted event', () => {
  it('calls queue.muteSuggestions with the track IDs', () => {
    const store = useSocketStore();
    const queue = useQueueStore();
    store.connect('JAM-1234', 'user-1');
    const muteStub = vi.spyOn(queue, 'muteSuggestions').mockImplementation(() => {});
    capturedHandlers['user_muted']({ userId: 'user-a', trackIds: ['t1', 't2'] });
    expect(muteStub).toHaveBeenCalledWith(['t1', 't2']);
  });
});

describe('user_unmuted event', () => {
  it('calls queue.unmuteSuggestions with the track IDs', () => {
    const store = useSocketStore();
    const queue = useQueueStore();
    store.connect('JAM-1234', 'user-1');
    const unmuteStub = vi.spyOn(queue, 'unmuteSuggestions').mockImplementation(() => {});
    capturedHandlers['user_unmuted']({ userId: 'user-a', trackIds: ['t1'] });
    expect(unmuteStub).toHaveBeenCalledWith(['t1']);
  });
});

describe('suggestion_added', () => {
  it('sets votedByMe=true when suggestedBy matches current userId', () => {
    const store = useSocketStore();
    const queue = useQueueStore();
    store.connect('JAM-1234', 'user-me');
    const addStub = vi.spyOn(queue, 'addSuggestion');

    capturedHandlers['suggestion_added']({
      trackId: 't1',
      trackMeta: { id: 't1', name: 'S', artists: [], album: '', albumArt: '', uri: '', durationMs: 0, suggestedBy: 'user-me' },
      voteCount: 1,
    });

    expect(addStub).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('sets votedByMe=false when suggestedBy is a different user', () => {
    const store = useSocketStore();
    const queue = useQueueStore();
    store.connect('JAM-1234', 'user-me');
    const addStub = vi.spyOn(queue, 'addSuggestion');

    capturedHandlers['suggestion_added']({
      trackId: 't2',
      trackMeta: { id: 't2', name: 'S', artists: [], album: '', albumArt: '', uri: '', durationMs: 0, suggestedBy: 'user-other' },
      voteCount: 1,
    });

    expect(addStub).toHaveBeenCalledWith(expect.anything(), false);
  });
});

describe('now_playing_updated event', () => {
  it('calls queue.setNowPlaying with the payload', () => {
    const store = useSocketStore();
    const queue = useQueueStore();
    store.connect('JAM-1234', 'user-1');
    const stub = vi.spyOn(queue, 'setNowPlaying');

    capturedHandlers['now_playing_updated']({ trackId: 't1', meta: null });

    expect(stub).toHaveBeenCalledWith({ trackId: 't1', meta: null });
  });
});

describe('toast integration', () => {
  it('track_approved fires a success toast', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['track_approved']({ trackId: 'track-1', trackMeta: TRACK_META });
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('error event fires an error toast with the error code as message', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['error']({ code: 'ALREADY_VOTED' });
    expect(mockAddToast).toHaveBeenCalledWith({ message: 'ALREADY_VOTED', variant: 'error' });
  });

  it('user_joined fires an info toast', () => {
    const store = useSocketStore();
    store.connect('JAM-1234', 'user-1');
    capturedHandlers['user_joined']({ userId: 'user-2', participantCount: 3 });
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'info' }));
  });
});
