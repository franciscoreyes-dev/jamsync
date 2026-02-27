import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const STORAGE_KEY = 'jamsync_user_id';

describe('useUserStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('generates a UUID and persists it in localStorage on first load', async () => {
    const { useUserStore } = await import('@/stores/user');
    const store = useUserStore();
    expect(store.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(store.userId);
  });

  it('reuses the UUID already in localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'pre-existing-uuid');
    const { useUserStore } = await import('@/stores/user');
    const store = useUserStore();
    expect(store.userId).toBe('pre-existing-uuid');
  });

  it('returns the same userId on repeated calls within the same Pinia instance', async () => {
    const { useUserStore } = await import('@/stores/user');
    const a = useUserStore();
    const b = useUserStore();
    expect(a.userId).toBe(b.userId);
  });
});
