import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useQueueStore } from '@/stores/queue';
import type { RoomStatePayload, SuggestionItem } from '@/types/socket';

const TRACK_META: SuggestionItem = {
  id: 'track-1',
  name: 'Blinding Lights',
  artists: ['The Weeknd'],
  album: 'After Hours',
  albumArt: 'https://example.com/art.jpg',
  uri: 'spotify:track:1',
  durationMs: 200000,
  suggestedBy: 'user-1',
};

const ROOM_STATE: RoomStatePayload = {
  roomId: 'room-1',
  name: 'My Jam',
  status: 'active',
  voteThreshold: 3,
  maxSuggestions: 3,
  queue: ['track-2', 'track-3'],
  suggestions: [{ ...TRACK_META, voteCount: 2 }],
  participantCount: 4,
};

describe('useQueueStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('has empty initial state', () => {
    const store = useQueueStore();
    expect(store.queue).toEqual([]);
    expect(store.suggestions).toEqual({});
  });

  it('setFromRoomState initializes queue and suggestions', () => {
    const store = useQueueStore();
    store.setFromRoomState(ROOM_STATE);
    expect(store.queue).toEqual(['track-2', 'track-3']);
    expect(store.suggestions['track-1']).toMatchObject({
      voteCount: 2,
      votedByMe: false,
    });
    expect(store.suggestions['track-1'].meta.name).toBe('Blinding Lights');
  });

  it('addSuggestion adds an entry with votedByMe=false', () => {
    const store = useQueueStore();
    store.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 0 });
    expect(store.suggestions['track-1']).toMatchObject({
      voteCount: 0,
      votedByMe: false,
    });
    expect(store.suggestions['track-1'].meta.name).toBe('Blinding Lights');
  });

  it('updateVote updates voteCount and votedByMe', () => {
    const store = useQueueStore();
    store.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 0 });
    store.updateVote('track-1', 2, true);
    expect(store.suggestions['track-1'].voteCount).toBe(2);
    expect(store.suggestions['track-1'].votedByMe).toBe(true);
  });

  it('updateVote is a no-op for unknown trackId', () => {
    const store = useQueueStore();
    expect(() => store.updateVote('unknown', 1, true)).not.toThrow();
  });

  it('approveSuggestion removes the track from suggestions', () => {
    const store = useQueueStore();
    store.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 0 });
    store.approveSuggestion('track-1');
    expect(store.suggestions['track-1']).toBeUndefined();
  });

  it('setQueueMeta stores metadata for an approved track', () => {
    const store = useQueueStore();
    store.setQueueMeta('track-1', TRACK_META);
    expect(store.queueMetadata['track-1'].name).toBe('Blinding Lights');
    expect(store.queueMetadata['track-1'].albumArt).toBe('https://example.com/art.jpg');
  });

  it('queueMetadata starts empty', () => {
    const store = useQueueStore();
    expect(store.queueMetadata).toEqual({});
  });

  it('updateQueue replaces the queue array', () => {
    const store = useQueueStore();
    store.setFromRoomState(ROOM_STATE);
    store.updateQueue(['track-5', 'track-6', 'track-7']);
    expect(store.queue).toEqual(['track-5', 'track-6', 'track-7']);
  });
});
