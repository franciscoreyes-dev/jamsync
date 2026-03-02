<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSocketStore } from '@/stores/socket';
import { useUserStore } from '@/stores/user';
import { useRoomStore } from '@/stores/room';
import { useQueueStore } from '@/stores/queue';
import { getHostIdFromJwt } from '@/lib/utils';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Slider from '@/components/ui/Slider.vue';
import QrcodeVue from 'qrcode.vue';

const route = useRoute();
const socket = useSocketStore();
const user = useUserStore();
const room = useRoomStore();
const queue = useQueueStore();

const roomId = route.params.id as string;

onMounted(() => {
  const hostId = getHostIdFromJwt();
  socket.connect(roomId, hostId ?? user.userId);
});

const suggestions = computed(() => Object.entries(queue.suggestions));
const approvedQueue = computed(() =>
  queue.queue.map((trackId) => ({ trackId, meta: queue.queueMetadata[trackId] ?? null }))
);

const joinUrl = computed(() => {
  const base = import.meta.env.VITE_FRONTEND_URL ?? window.location.origin;
  const code = room.code ?? roomId;
  return `${base}/join/${code}`;
});

// Participant count pulse animation
const participantPulse = ref(false);
watch(
  () => room.participantCount,
  () => {
    participantPulse.value = true;
    setTimeout(() => { participantPulse.value = false; }, 600);
  },
);

function remove(trackId: string) {
  socket.removeSuggestion({ roomId, trackId });
}

function onThresholdChange(event: Event) {
  const threshold = Number((event.target as HTMLInputElement).value);
  socket.updateThreshold({ roomId, threshold });
}

function voteProgress(voteCount: number): number {
  const threshold = room.voteThreshold;
  if (!threshold) return 0;
  return Math.min((voteCount / threshold) * 100, 100);
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <!-- Header -->
    <header class="border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur z-10">
      <div class="flex items-center gap-2">
        <span class="text-green-500 text-lg">♫</span>
        <span class="font-semibold text-white">{{ room.name ?? 'Jamsync' }}</span>
        <Badge variant="secondary" class="ml-1">Host</Badge>
      </div>
      <div
        class="flex items-center gap-1.5 transition-transform"
        :class="{ 'scale-125': participantPulse }"
      >
        <span class="w-2 h-2 rounded-full bg-green-500 inline-block" />
        <span class="text-zinc-300 text-sm font-medium" data-testid="participant-count">{{ room.participantCount }}</span>
        <span class="text-zinc-500 text-xs">online</span>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-6 max-w-2xl mx-auto w-full">

      <!-- Room info + QR code -->
      <Card>
        <CardContent class="py-4 flex items-center gap-6">
          <div class="flex-1 space-y-1">
            <p class="text-xs text-zinc-500 uppercase tracking-wider">Room code</p>
            <p class="text-2xl font-mono font-bold text-white tracking-widest">{{ room.code ?? roomId }}</p>
            <p class="text-xs text-zinc-500">Share this code or QR to invite guests</p>
          </div>
          <div class="bg-white p-2 rounded-lg flex-shrink-0">
            <QrcodeVue
              :value="joinUrl"
              :size="96"
              level="M"
            />
          </div>
        </CardContent>
      </Card>

      <!-- Threshold control -->
      <Card>
        <CardContent class="py-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-white">Vote Threshold</span>
            <Badge>{{ room.voteThreshold }} votes</Badge>
          </div>
          <Slider
            :model-value="room.voteThreshold"
            data-testid="threshold-slider"
            :min="1"
            :max="10"
            :step="1"
            @change="onThresholdChange"
          />
          <div class="flex justify-between text-xs text-zinc-600">
            <span>1</span>
            <span>10</span>
          </div>
        </CardContent>
      </Card>

      <!-- Suggestions -->
      <section v-if="suggestions.length" class="space-y-2">
        <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Suggestions</h2>
        <TransitionGroup name="suggestion-list" tag="div" class="space-y-2">
          <Card
            v-for="[trackId, entry] in suggestions"
            :key="trackId"
            :data-testid="`suggestion-${trackId}`"
            class="overflow-hidden"
          >
            <CardContent class="py-3 space-y-2">
              <div class="flex items-center gap-3">
                <img
                  v-if="entry.meta.albumArt"
                  :src="entry.meta.albumArt"
                  :alt="entry.meta.name"
                  class="w-10 h-10 rounded object-cover flex-shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-white truncate">{{ entry.meta.name }}</p>
                  <p class="text-xs text-zinc-500 truncate">{{ entry.meta.artists.join(', ') }}</p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <Badge>
                    <span :data-testid="`vote-count-${trackId}`">{{ entry.voteCount }}</span>
                    <span class="opacity-50"> / {{ room.voteThreshold }}</span>
                  </Badge>
                  <Button
                    :data-testid="`remove-btn-${trackId}`"
                    size="sm"
                    variant="destructive"
                    @click="remove(trackId)"
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <!-- Vote progress bar -->
              <div class="h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  class="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
                  :style="{ width: `${voteProgress(entry.voteCount)}%` }"
                />
              </div>
            </CardContent>
          </Card>
        </TransitionGroup>
      </section>

      <!-- Approved Queue -->
      <section v-if="approvedQueue.length" class="space-y-2">
        <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Up Next</h2>
        <TransitionGroup name="queue-slide" tag="div" class="space-y-2">
          <Card
            v-for="{ trackId, meta } in approvedQueue"
            :key="trackId"
            :data-testid="`queue-item-${trackId}`"
            class="overflow-hidden"
          >
            <CardContent class="py-3 flex items-center gap-3">
              <img
                v-if="meta?.albumArt"
                :src="meta.albumArt"
                :alt="meta.name"
                class="w-10 h-10 rounded object-cover flex-shrink-0"
              />
              <div class="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-600" v-else>
                ♪
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">{{ meta?.name ?? trackId }}</p>
                <p v-if="meta" class="text-xs text-zinc-500 truncate">{{ meta.artists.join(', ') }}</p>
              </div>
              <span class="text-green-500 text-xs font-semibold">✓</span>
            </CardContent>
          </Card>
        </TransitionGroup>
      </section>

    </div>
  </div>
</template>

<style scoped>
.suggestion-list-enter-active,
.suggestion-list-leave-active {
  transition: all 0.3s ease;
}
.suggestion-list-enter-from,
.suggestion-list-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

.queue-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.queue-slide-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}
.queue-slide-leave-active {
  transition: all 0.2s ease;
}
.queue-slide-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
