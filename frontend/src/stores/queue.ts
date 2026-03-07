import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { NowPlayingUpdatedPayload, RoomStatePayload, SuggestionAddedPayload, SuggestionItem, TrackMeta } from '@/types/socket';

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
  const nowPlaying = ref<{ trackId: string; meta: TrackMeta } | null>(null);
  const history = ref<Array<{ trackId: string; meta: TrackMeta | null }>>([]);

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
    nowPlaying.value = data.nowPlaying ?? null;
    history.value = (data.history ?? []).map((trackId) => ({
      trackId,
      meta: (data.queueMeta?.[trackId] as TrackMeta) ?? null,
    }));
  }

  function addSuggestion({ trackId, trackMeta, voteCount }: SuggestionAddedPayload, votedByMe = false) {
    suggestions.value[trackId] = { meta: trackMeta, voteCount, votedByMe, muted: false };
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

  function setNowPlaying(payload: NowPlayingUpdatedPayload) {
    if (!payload.trackId) {
      nowPlaying.value = null;
      return;
    }
    nowPlaying.value = { trackId: payload.trackId, meta: payload.meta };
  }

  return { queue, suggestions, queueMetadata, nowPlaying, history, setFromRoomState, addSuggestion, updateVote, approveSuggestion, updateQueue, setQueueMeta, muteSuggestions, unmuteSuggestions, setNowPlaying };
});
