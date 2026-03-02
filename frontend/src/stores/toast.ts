import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Toast {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'info';
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);

  function addToast(payload: { message: string; variant?: Toast['variant'] }): string {
    const id = crypto.randomUUID();
    toasts.value.push({ id, message: payload.message, variant: payload.variant ?? 'info' });
    setTimeout(() => removeToast(id), 4000);
    return id;
  }

  function removeToast(id: string): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return { toasts, addToast, removeToast };
});
