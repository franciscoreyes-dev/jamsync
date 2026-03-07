<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSocketStore } from '@/stores/socket';
import { useUserStore } from '@/stores/user';
import { useRoomStore } from '@/stores/room';
import { useQueueStore } from '@/stores/queue';
import { getHostIdFromJwt } from '@/lib/utils';
import { api } from '@/lib/api';
import { X } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import QrcodeVue from 'qrcode.vue';
import RoomHeader from '@/components/room/RoomHeader.vue';
import SuggestionCard from '@/components/queue/SuggestionCard.vue';
import QueueCard from '@/components/queue/QueueCard.vue';
import ThresholdSlider from '@/components/host/ThresholdSlider.vue';
import NowPlayingCard from '@/components/queue/NowPlayingCard.vue';

const route = useRoute();
const router = useRouter();
const socket = useSocketStore();
const user = useUserStore();
const room = useRoomStore();
const queue = useQueueStore();

const roomId = route.params.id as string;

watch(() => socket.roomClosed, (closed) => {
  if (closed) router.replace('/');
});

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

function mute(userId: string) {
  socket.muteUser({ roomId, userId });
}

function unmute(userId: string) {
  socket.unmuteUser({ roomId, userId });
}

async function closeRoom() {
  await api.delete(`/rooms/${roomId}`);
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <RoomHeader
      :name="room.name ?? 'Jamsync'"
      :participant-count="room.participantCount"
      :pulse="participantPulse"
      :is-host="true"
    >
      <template #actions>
        <Button data-testid="close-room-btn" size="sm" variant="destructive" class="flex items-center gap-1.5" @click="closeRoom">
          <X class="w-3.5 h-3.5" /><span class="hidden sm:inline">Close Room</span>
        </Button>
      </template>
    </RoomHeader>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-6 max-w-2xl mx-auto w-full">

      <NowPlayingCard
        :track-id="queue.nowPlaying?.trackId ?? null"
        :meta="queue.nowPlaying?.meta ?? null"
      />

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
        <CardContent class="py-4">
          <ThresholdSlider
            :model-value="room.voteThreshold"
            @update:model-value="(v) => socket.updateThreshold({ roomId, threshold: v })"
          />
        </CardContent>
      </Card>

      <!-- Suggestions -->
      <section v-if="suggestions.length" class="space-y-2">
        <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Suggestions</h2>
        <TransitionGroup name="suggestion-list" tag="div" class="space-y-2">
          <SuggestionCard
            v-for="[trackId, entry] in suggestions"
            :key="trackId"
            :track-id="trackId"
            :entry="entry"
            :threshold="room.voteThreshold"
            :is-host="true"
            @remove="remove"
            @mute="mute"
            @unmute="unmute"
          />
        </TransitionGroup>
      </section>

      <!-- Approved Queue -->
      <section v-if="approvedQueue.length" class="space-y-2">
        <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Up Next</h2>
        <TransitionGroup name="queue-slide" tag="div" class="space-y-2">
          <QueueCard
            v-for="{ trackId, meta } in approvedQueue"
            :key="trackId"
            :track-id="trackId"
            :meta="meta"
          />
        </TransitionGroup>
      </section>

      <!-- History -->
      <section v-if="queue.history.length" class="space-y-2" data-testid="history-section">
        <h2 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recently Played</h2>
        <div class="space-y-2">
          <QueueCard
            v-for="{ trackId, meta } in queue.history.slice().reverse()"
            :key="trackId"
            :track-id="trackId"
            :meta="meta"
          />
        </div>
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
