import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RoomStatePayload, SuggestionAddedPayload, SuggestionItem } from '@/types/socket';

export interface SuggestionEntry {
  meta: SuggestionItem;
  voteCount: number;
  votedByMe: boolean;
}

export const useQueueStore = defineStore('queue', () => {
  const queue = ref<string[]>([]);
  const suggestions = ref<Record<string, SuggestionEntry>>({});

  function setFromRoomState(data: RoomStatePayload) {
    queue.value = data.queue;
    suggestions.value = {};
    for (const s of data.suggestions) {
      const { voteCount, ...meta } = s;
      suggestions.value[s.id] = { meta, voteCount, votedByMe: false };
    }
  }

  function addSuggestion({ trackId, trackMeta, voteCount }: SuggestionAddedPayload) {
    suggestions.value[trackId] = { meta: trackMeta, voteCount, votedByMe: false };
  }

  function updateVote(trackId: string, voteCount: number, votedByMe: boolean) {
    const entry = suggestions.value[trackId];
    if (!entry) return;
    entry.voteCount = voteCount;
    entry.votedByMe = votedByMe;
  }

  function approveSuggestion(trackId: string) {
    delete suggestions.value[trackId];
  }

  function updateQueue(q: string[]) {
    queue.value = q;
  }

  return { queue, suggestions, setFromRoomState, addSuggestion, updateVote, approveSuggestion, updateQueue };
});
