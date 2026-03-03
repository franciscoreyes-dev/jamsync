<script setup lang="ts">
import { Check, ThumbsUp } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';

defineProps<{
  voted: boolean;
  disabled?: boolean;
}>();

defineEmits<{ click: [] }>();
</script>

<template>
  <Button
    size="sm"
    variant="ghost"
    :disabled="disabled || undefined"
    @click="$emit('click')"
  >
    <Check v-if="voted" class="w-3 h-3" />
    <ThumbsUp v-else class="w-3 h-3" />
  </Button>
</template>
