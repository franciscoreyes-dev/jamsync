import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/stores/socket', () => ({ useSocketStore: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: vi.fn() }));

import { useSocketStore } from '@/stores/socket';
import { useQueueStore } from '@/stores/queue';
import { useVoting } from '@/composables/useVoting';

const mockVoteTrack = vi.fn();
const TRACK_META = {
  id: 'track-1', name: 'Song', artists: [], album: '', albumArt: '', uri: 'uri', durationMs: 0, suggestedBy: 'u',
};

describe('useVoting', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(useSocketStore).mockReturnValue({ voteTrack: mockVoteTrack } as never);
    vi.clearAllMocks();
  });

  it('does nothing if trackId not found in suggestions', () => {
    const { vote } = useVoting();
    vote('nonexistent');
    expect(mockVoteTrack).not.toHaveBeenCalled();
  });

  it('does nothing if already voted', () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 1 });
    queue.updateVote('track-1', 1, true);

    const { vote } = useVoting();
    vote('track-1');

    expect(mockVoteTrack).not.toHaveBeenCalled();
    expect(queue.suggestions['track-1'].voteCount).toBe(1);
  });

  it('increments voteCount and sets votedByMe=true optimistically', () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 2 });

    const { vote } = useVoting();
    vote('track-1');

    expect(queue.suggestions['track-1'].voteCount).toBe(3);
    expect(queue.suggestions['track-1'].votedByMe).toBe(true);
  });

  it('emits vote_track via socketStore', () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 0 });

    const { vote } = useVoting();
    vote('track-1');

    expect(mockVoteTrack).toHaveBeenCalledWith({ trackId: 'track-1' });
  });
});
