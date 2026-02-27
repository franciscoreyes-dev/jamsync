<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useSocketStore } from '@/stores/socket';
import { useUserStore } from '@/stores/user';
import { useRoomStore } from '@/stores/room';
import { useQueueStore } from '@/stores/queue';

const route = useRoute();
const socket = useSocketStore();
const user = useUserStore();
const room = useRoomStore();
const queue = useQueueStore();

const roomId = route.params.id as string;

onMounted(() => {
  socket.connect(roomId, user.userId);
});

const suggestions = computed(() => Object.entries(queue.suggestions));
const approvedQueue = computed(() =>
  queue.queue.map((trackId) => ({ trackId, meta: queue.queueMetadata[trackId] ?? null }))
);

function remove(trackId: string) {
  socket.removeSuggestion({ roomId, trackId });
}

function onThresholdChange(event: Event) {
  const threshold = Number((event.target as HTMLInputElement).value);
  socket.updateThreshold({ roomId, threshold });
}
</script>

<template>
  <div>
    <span data-testid="participant-count">{{ room.participantCount }}</span>

    <input
      type="range"
      min="1"
      max="10"
      data-testid="threshold-slider"
      :value="room.voteThreshold"
      @change="onThresholdChange"
    />

    <div v-for="[trackId, entry] in suggestions" :key="trackId" :data-testid="`suggestion-${trackId}`">
      <span>{{ entry.meta.name }}</span>
      <span :data-testid="`vote-count-${trackId}`">{{ entry.voteCount }}</span>
      <button :data-testid="`remove-btn-${trackId}`" @click="remove(trackId)">Remove</button>
    </div>

    <div v-for="{ trackId, meta } in approvedQueue" :key="trackId" :data-testid="`queue-item-${trackId}`">
      <img v-if="meta?.albumArt" :src="meta.albumArt" :alt="meta.name" />
      <span>{{ meta?.name ?? trackId }}</span>
      <span v-if="meta">{{ meta.artists.join(', ') }}</span>
    </div>
  </div>
</template>
