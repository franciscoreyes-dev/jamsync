import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RoomStatePayload, SuggestionAddedPayload, SuggestionItem, TrackMeta } from '@/types/socket';

export interface SuggestionEntry {
  meta: SuggestionItem;
  voteCount: number;
  votedByMe: boolean;
  muted: boolean;
}

export const useQueueStore = defineStore('queue', () => {
  const queue = ref<string[]>([]);
  const suggestions = ref<Record<string, SuggestionEntry>>({});
  const queueMetadata = ref<Record<string, TrackMeta>>({});

  function setFromRoomState(data: RoomStatePayload) {
    queue.value = data.queue;
    suggestions.value = {};
    queueMetadata.value = {};
    for (const s of data.suggestions) {
      const { voteCount, muted, ...meta } = s;
      suggestions.value[s.id] = { meta, voteCount, votedByMe: false, muted: muted ?? false };
    }
    if (data.queueMeta) {
      for (const [trackId, meta] of Object.entries(data.queueMeta)) {
        queueMetadata.value[trackId] = meta;
      }
    }
  }

  function addSuggestion({ trackId, trackMeta, voteCount }: SuggestionAddedPayload) {
    suggestions.value[trackId] = { meta: trackMeta, voteCount, votedByMe: false, muted: false };
  }

  function muteSuggestions(trackIds: string[]) {
    for (const id of trackIds) {
      const entry = suggestions.value[id];
      if (entry) entry.muted = true;
    }
  }

  function unmuteSuggestions(trackIds: string[]) {
    for (const id of trackIds) {
      const entry = suggestions.value[id];
      if (entry) entry.muted = false;
    }
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

  function setQueueMeta(trackId: string, meta: TrackMeta) {
    queueMetadata.value[trackId] = meta;
  }

  return { queue, suggestions, queueMetadata, setFromRoomState, addSuggestion, updateVote, approveSuggestion, updateQueue, setQueueMeta, muteSuggestions, unmuteSuggestions };
});
