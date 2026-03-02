<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps<{
  modelValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
  change: [event: Event];
}>();
</script>

<template>
  <input
    type="range"
    :value="modelValue"
    :min="min ?? 0"
    :max="max ?? 100"
    :step="step ?? 1"
    :disabled="disabled"
    :class="cn(
      'w-full h-2 rounded-lg appearance-none cursor-pointer',
      'bg-zinc-700',
      '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
      '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500',
      '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform',
      '[&::-webkit-slider-thumb]:hover:scale-125',
      '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full',
      '[&::-moz-range-thumb]:bg-green-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer',
      props.class
    )"
    @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    @change="emit('change', $event)"
  />
</template>
