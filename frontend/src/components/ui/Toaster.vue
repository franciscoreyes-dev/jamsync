<script setup lang="ts">
import { useToastStore } from '@/stores/toast';
import Toast from './Toast.vue';

const toast = useToastStore();
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      <TransitionGroup name="toast-slide">
        <div
          v-for="t in toast.toasts"
          :key="t.id"
          class="pointer-events-auto"
        >
          <Toast
            :id="t.id"
            :message="t.message"
            :variant="t.variant"
            @close="toast.removeToast(t.id)"
          />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-slide-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(24px) scale(0.95);
}
.toast-slide-leave-active {
  transition: all 0.2s ease;
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
