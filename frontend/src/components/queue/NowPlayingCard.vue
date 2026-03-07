<script setup lang="ts">
import type { TrackMeta } from '@/types/socket';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';

defineProps<{
  trackId: string | null;
  meta: TrackMeta | null;
}>();
</script>

<template>
  <Card v-if="trackId" class="overflow-hidden border-green-500/30" data-testid="now-playing-card">
    <CardContent class="py-3 flex items-center gap-3">
      <img
        v-if="meta?.albumArt"
        :src="meta.albumArt"
        :alt="meta?.name"
        class="w-12 h-12 rounded object-cover flex-shrink-0"
      />
      <div
        v-else
        class="w-12 h-12 rounded bg-zinc-800 flex-shrink-0"
      />
      <div class="flex-1 min-w-0">
        <p class="text-xs text-green-500 font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
          Now Playing
        </p>
        <p class="text-sm font-medium text-white truncate">{{ meta?.name ?? trackId }}</p>
        <p v-if="meta?.artists?.length" class="text-xs text-zinc-500 truncate">{{ meta.artists.join(', ') }}</p>
      </div>
    </CardContent>
  </Card>
</template>
