<script setup lang="ts">
import { Trash2, Volume2, VolumeX } from 'lucide-vue-next';
import type { SuggestionEntry } from '@/stores/queue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import VoteButton from './VoteButton.vue';

const props = defineProps<{
  trackId: string;
  entry: SuggestionEntry;
  threshold: number;
  isHost?: boolean;
}>();

const emit = defineEmits<{
  vote: [trackId: string];
  remove: [trackId: string];
  mute: [userId: string];
  unmute: [userId: string];
}>();

function voteProgress(): number {
  if (!props.threshold) return 0;
  return Math.min((props.entry.voteCount / props.threshold) * 100, 100);
}
</script>

<template>
  <Card
    :data-testid="`suggestion-${trackId}`"
    class="overflow-hidden"
    :class="{ 'opacity-50': entry.muted && isHost }"
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
            <span class="opacity-50"> / {{ threshold }}</span>
          </Badge>
          <!-- Host controls -->
          <template v-if="isHost">
            <Button
              v-if="!entry.muted"
              :data-testid="`mute-btn-${trackId}`"
              size="sm"
              variant="ghost"
              class="flex items-center gap-1"
              @click="emit('mute', entry.meta.suggestedBy)"
            >
              <VolumeX class="w-3.5 h-3.5" />Mute
            </Button>
            <Button
              v-else
              :data-testid="`unmute-btn-${trackId}`"
              size="sm"
              variant="ghost"
              class="flex items-center gap-1"
              @click="emit('unmute', entry.meta.suggestedBy)"
            >
              <Volume2 class="w-3.5 h-3.5" />Unmute
            </Button>
            <Button
              :data-testid="`remove-btn-${trackId}`"
              size="sm"
              variant="destructive"
              class="flex items-center gap-1"
              @click="emit('remove', trackId)"
            >
              <Trash2 class="w-3.5 h-3.5" />Remove
            </Button>
          </template>
          <!-- Guest vote button -->
          <VoteButton
            v-else
            :data-testid="`vote-btn-${trackId}`"
            :voted="entry.votedByMe"
            :disabled="entry.votedByMe"
            @click="emit('vote', trackId)"
          />
        </div>
      </div>
      <div class="h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          class="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
          :style="{ width: `${voteProgress()}%` }"
        />
      </div>
    </CardContent>
  </Card>
</template>
