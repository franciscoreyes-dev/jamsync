<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSocketStore } from '@/stores/socket';
import { useQueueStore } from '@/stores/queue';
import { useRoomStore } from '@/stores/room';
import { useUserStore } from '@/stores/user';
import { useSpotifySearch } from '@/composables/useSpotifySearch';
import { useVoting } from '@/composables/useVoting';
import type { TrackMeta } from '@/types/socket';
import { Check, LogOut, Music, Plus } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import RoomHeader from '@/components/room/RoomHeader.vue';
import SuggestionCard from '@/components/queue/SuggestionCard.vue';

const route = useRoute();
const router = useRouter();
const socket = useSocketStore();
const queue = useQueueStore();
const room = useRoomStore();
const user = useUserStore();

watch(() => socket.roomClosed, (closed) => {
  if (closed) router.replace('/');
});
const { query, results } = useSpotifySearch();
const { vote } = useVoting();

const code = route.params.code as string;

onMounted(() => {
  socket.connect(code, user.userId);
});

onUnmounted(() => {
  socket.leaveRoom({ roomId: room.roomId ?? code, userId: user.userId });
  socket.disconnect();
});

function leave() {
  socket.leaveRoom({ roomId: room.roomId ?? code, userId: user.userId });
  socket.disconnect();
  router.replace('/');
}

const suggestions = computed(() =>
  Object.entries(queue.suggestions).filter(([, entry]) => !entry.muted)
);
const approvedQueue = computed(() =>
  queue.queue.map((trackId) => ({ trackId, meta: queue.queueMetadata[trackId] ?? null }))
);
const userSuggestionCount = computed(() =>
  suggestions.value.filter(([, entry]) => entry.meta.suggestedBy === user.userId).length
);

// Track IDs that just got approved (for slide-in animation)
const newlyApproved = ref<Set<string>>(new Set());

function suggest(track: TrackMeta) {
  socket.suggestTrack({ trackId: track.id, trackMeta: track });
}

</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <RoomHeader
      :name="room.name ?? 'Jamsync'"
      :participant-count="room.participantCount"
    >
      <template #actions>
        <Button data-testid="leave-btn" size="sm" variant="ghost" class="flex items-center gap-1.5" @click="leave">
          <LogOut class="w-3.5 h-3.5" />Leave
        </Button>
      </template>
    </RoomHeader>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-6 max-w-lg mx-auto w-full">

      <!-- Search -->
      <section class="space-y-3">
        <Input
          v-model="query"
          data-testid="search-input"
          placeholder="Search for a song…"
        />

        <TransitionGroup name="slide-down" tag="div" class="space-y-2">
          <Card
            v-for="track in results"
            :key="track.id"
            :data-testid="`result-${track.id}`"
            class="overflow-hidden"
          >
            <CardContent class="py-3 flex items-center gap-3">
              <img
                v-if="track.albumArt"
                :src="track.albumArt"
                :alt="track.name"
                class="w-10 h-10 rounded object-cover flex-shrink-0"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">{{ track.name }}</p>
                <p class="text-xs text-zinc-500 truncate">{{ track.artists.join(', ') }}</p>
              </div>
              <Button
                :data-testid="`suggest-btn-${track.id}`"
                size="sm"
                class="flex items-center gap-1"
                :disabled="room.maxSuggestions > 0 && userSuggestionCount >= room.maxSuggestions || undefined"
                @click="suggest(track)"
              >
                <Plus class="w-3.5 h-3.5" />Suggest
              </Button>
            </CardContent>
          </Card>
        </TransitionGroup>
      </section>

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
            @vote="vote"
          />
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
                <Music class="w-4 h-4" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">{{ meta?.name ?? trackId }}</p>
                <p v-if="meta" class="text-xs text-zinc-500 truncate">{{ meta.artists.join(', ') }}</p>
              </div>
              <span class="text-green-500 text-xs font-semibold flex items-center gap-1"><Check class="w-3.5 h-3.5" />Queued</span>
            </CardContent>
          </Card>
        </TransitionGroup>
      </section>

    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

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
