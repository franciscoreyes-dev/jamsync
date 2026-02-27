<script setup lang="ts">
import { computed } from 'vue';
import { useSocketStore } from '@/stores/socket';
import { useQueueStore } from '@/stores/queue';
import { useSpotifySearch } from '@/composables/useSpotifySearch';
import { useVoting } from '@/composables/useVoting';
import type { TrackMeta } from '@/types/socket';

const socket = useSocketStore();
const queue = useQueueStore();
const { query, results } = useSpotifySearch();
const { vote } = useVoting();

const suggestions = computed(() => Object.entries(queue.suggestions));
const approvedQueue = computed(() =>
  queue.queue.map((trackId) => ({ trackId, meta: queue.queueMetadata[trackId] ?? null }))
);

function suggest(track: TrackMeta) {
  socket.suggestTrack({ trackId: track.id, trackMeta: track });
}
</script>

<template>
  <div>
    <input v-model="query" data-testid="search-input" type="text" />

    <div v-for="track in results" :key="track.id" :data-testid="`result-${track.id}`">
      <span>{{ track.name }}</span>
      <button :data-testid="`suggest-btn-${track.id}`" @click="suggest(track)">Suggest</button>
    </div>

    <div v-for="[trackId, entry] in suggestions" :key="trackId" :data-testid="`suggestion-${trackId}`">
      <span>{{ entry.meta.name }}</span>
      <span :data-testid="`vote-count-${trackId}`">{{ entry.voteCount }}</span>
      <button
        :data-testid="`vote-btn-${trackId}`"
        :disabled="entry.votedByMe || undefined"
        @click="vote(trackId)"
      >
        Vote
      </button>
    </div>

    <div v-for="{ trackId, meta } in approvedQueue" :key="trackId" :data-testid="`queue-item-${trackId}`">
      <img v-if="meta?.albumArt" :src="meta.albumArt" :alt="meta.name" />
      <span>{{ meta?.name ?? trackId }}</span>
      <span v-if="meta">{{ meta.artists.join(', ') }}</span>
    </div>
  </div>
</template>
