<script setup lang="ts">
import { cn } from '@/lib/utils';
const props = defineProps<{ class?: string }>();
</script>

<template>
  <div :class="cn('rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm', props.class)">
    <slot />
  </div>
</template>
