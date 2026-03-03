<script setup lang="ts">
import { Check, Music } from 'lucide-vue-next';
import type { TrackMeta } from '@/types/socket';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';

defineProps<{
  trackId: string;
  meta: TrackMeta | null;
}>();
</script>

<template>
  <Card
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
      <div
        v-else
        class="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-600"
      >
        <Music class="w-4 h-4" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-white truncate">{{ meta?.name ?? trackId }}</p>
        <p v-if="meta" class="text-xs text-zinc-500 truncate">{{ meta.artists.join(', ') }}</p>
      </div>
      <span class="text-green-500 text-xs font-semibold flex items-center gap-1">
        <Check class="w-3.5 h-3.5" />Queued
      </span>
    </CardContent>
  </Card>
</template>
