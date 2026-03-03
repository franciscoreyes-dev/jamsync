<script setup lang="ts">
import Badge from '@/components/ui/Badge.vue';
import Slider from '@/components/ui/Slider.vue';

const props = defineProps<{ modelValue: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

function onChange(event: Event) {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-white">Vote Threshold</span>
      <Badge>{{ modelValue }} votes</Badge>
    </div>
    <Slider
      :model-value="props.modelValue"
      data-testid="threshold-slider"
      :min="1"
      :max="10"
      :step="1"
      @change="onChange"
    />
    <div class="flex justify-between text-xs text-zinc-600">
      <span>1</span>
      <span>10</span>
    </div>
  </div>
</template>
