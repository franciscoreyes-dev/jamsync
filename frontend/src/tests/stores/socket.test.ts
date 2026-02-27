import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { Socket } from 'socket.io-client';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

import { io } from 'socket.io-client';
import { useSocketStore } from '@/stores/socket';
import { useRoomStore } from '@/stores/room';
import { useQueueStore } from '@/stores/queue';
import type { RoomStatePayload, SuggestionItem } from '@/types/socket';

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
