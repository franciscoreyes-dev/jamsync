<script setup lang="ts">
import { AudioLines } from 'lucide-vue-next';
import Badge from '@/components/ui/Badge.vue';

defineProps<{
  name: string;
  participantCount: number;
  pulse?: boolean;
  isHost?: boolean;
}>();
</script>

<template>
  <header class="border-b border-zinc-800 px-3 sm:px-4 py-3 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur z-10 gap-2">
    <div class="flex items-center gap-2 min-w-0">
      <AudioLines class="w-4 h-4 text-green-500 flex-shrink-0" />
      <span class="hidden sm:block font-semibold text-white truncate">{{ name || 'Jamsync' }}</span>
      <Badge v-if="isHost" variant="secondary" class="hidden sm:inline-flex">Host</Badge>
    </div>
    <div class="flex items-center gap-2 flex-shrink-0">
      <div
        class="flex items-center gap-1 transition-transform"
        :class="{ 'scale-125': pulse }"
      >
        <template v-if="isHost">
          <span class="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" />
          <span class="text-zinc-300 text-sm font-medium" data-testid="participant-count">{{ participantCount }}</span>
          <span class="hidden sm:inline text-zinc-500 text-xs">online</span>
        </template>
        <Badge v-else variant="secondary">
          <span data-testid="participant-count">{{ participantCount }}</span><span class="hidden sm:inline"> online</span>
        </Badge>
      </div>
      <slot name="actions" />
    </div>
  </header>
</template>
