import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useQueueStore } from '@/stores/queue';
import type { RoomStatePayload, SuggestionItem, TrackMeta } from '@/types/socket';

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

  it('setFromRoomState populates queueMetadata from queueMeta', () => {
    const store = useQueueStore();
    const stateWithMeta: RoomStatePayload = {
      ...ROOM_STATE,
      queueMeta: {
        'track-2': { id: 'track-2', name: 'Save Your Tears', artists: ['The Weeknd'], album: 'After Hours', albumArt: '', uri: 'spotify:track:2', durationMs: 215000 },
      },
    };
    store.setFromRoomState(stateWithMeta);
    expect(store.queueMetadata['track-2'].name).toBe('Save Your Tears');
    expect(store.queueMetadata['track-2'].artists).toEqual(['The Weeknd']);
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

  it('setFromRoomState resets queueMetadata from previous state', () => {
    const store = useQueueStore();
    store.setQueueMeta('old-track', { id: 'old-track', name: 'Old', artists: [], album: '', albumArt: '', uri: '', durationMs: 0 });

    store.setFromRoomState({ ...ROOM_STATE, queue: [], suggestions: [], queueMeta: {} });

    expect(store.queueMetadata).toEqual({});
  });

  it('setFromRoomState populates muted flag on suggestions', () => {
    const store = useQueueStore();
    const stateWithMuted: RoomStatePayload = {
      ...ROOM_STATE,
      suggestions: [{ ...TRACK_META, voteCount: 1, muted: true }],
    };
    store.setFromRoomState(stateWithMuted);
    expect(store.suggestions['track-1'].muted).toBe(true);
  });

  it('muteSuggestions sets muted=true for given trackIds', () => {
    const store = useQueueStore();
    store.setFromRoomState({ ...ROOM_STATE, suggestions: [{ ...TRACK_META, voteCount: 1, muted: false }] } as RoomStatePayload);
    store.muteSuggestions([TRACK_META.id]);
    expect(store.suggestions[TRACK_META.id].muted).toBe(true);
  });

  it('unmuteSuggestions sets muted=false for given trackIds', () => {
    const store = useQueueStore();
    store.setFromRoomState({ ...ROOM_STATE, suggestions: [{ ...TRACK_META, voteCount: 1, muted: true }] } as RoomStatePayload);
    store.unmuteSuggestions([TRACK_META.id]);
    expect(store.suggestions[TRACK_META.id].muted).toBe(false);
  });

  it('setFromRoomState populates nowPlaying when included in payload', () => {
    const store = useQueueStore();
    const meta: TrackMeta = { id: 't1', name: 'Song', artists: ['Art'], album: 'Al', albumArt: '', uri: 'spotify:track:t1', durationMs: 0 };
    store.setFromRoomState({
      ...ROOM_STATE,
      nowPlaying: { trackId: 't1', meta },
      history: ['t1'],
      queueMeta: { t1: meta },
    } as RoomStatePayload);

    expect(store.nowPlaying).toEqual({ trackId: 't1', meta });
    expect(store.history).toHaveLength(1);
    expect(store.history[0].trackId).toBe('t1');
  });

  it('setNowPlaying sets nowPlaying state', () => {
    const store = useQueueStore();
    const meta: TrackMeta = { id: 't2', name: 'New', artists: [], album: '', albumArt: '', uri: 'spotify:track:t2', durationMs: 0 };
    store.setNowPlaying({ trackId: 't2', meta });
    expect(store.nowPlaying).toEqual({ trackId: 't2', meta });
  });

  it('setNowPlaying clears nowPlaying on null trackId', () => {
    const store = useQueueStore();
    store.setNowPlaying({ trackId: 't1', meta: null });
    store.setNowPlaying({ trackId: null, meta: null });
    expect(store.nowPlaying).toBeNull();
  });

  it('addSuggestion respects votedByMe parameter', () => {
    const store = useQueueStore();
    store.addSuggestion(
      { trackId: 't1', trackMeta: { id: 't1', name: 'S', artists: [], album: '', albumArt: '', uri: '', durationMs: 0, suggestedBy: 'me' }, voteCount: 1 },
      true
    );
    expect(store.suggestions['t1'].votedByMe).toBe(true);
    expect(store.suggestions['t1'].voteCount).toBe(1);
  });
});
