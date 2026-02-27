import { defineStore } from 'pinia';
import { ref } from 'vue';

const STORAGE_KEY = 'jamsync_user_id';

export const useUserStore = defineStore('user', () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  const id = stored ?? crypto.randomUUID();
  if (!stored) localStorage.setItem(STORAGE_KEY, id);

  const userId = ref(id);

  return { userId };
});
