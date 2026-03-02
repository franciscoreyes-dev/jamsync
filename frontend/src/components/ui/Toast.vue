<script setup lang="ts">
defineProps<{ id: string; message: string; variant: 'success' | 'error' | 'info' }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <div
    :data-testid="`toast-${id}`"
    class="flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur bg-zinc-900/95 max-w-sm w-full"
    :class="{
      'border-green-500/40': variant === 'success',
      'border-red-500/40': variant === 'error',
      'border-zinc-600/40': variant === 'info',
    }"
  >
    <span
      class="text-sm flex-1 text-white leading-snug"
      :class="{
        'text-green-400': variant === 'success',
        'text-red-400': variant === 'error',
        'text-zinc-300': variant === 'info',
      }"
    >{{ message }}</span>
    <button
      class="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 text-xs mt-0.5"
      @click="$emit('close')"
    >✕</button>
  </div>
</template>
