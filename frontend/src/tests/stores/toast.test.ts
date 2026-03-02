import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useToastStore } from '@/stores/toast';

describe('useToastStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts with empty toasts array', () => {
    const store = useToastStore();
    expect(store.toasts).toEqual([]);
  });

  it('addToast pushes a toast with unique id, message and variant', () => {
    const store = useToastStore();
    store.addToast({ message: 'Hello', variant: 'success' });
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].message).toBe('Hello');
    expect(store.toasts[0].variant).toBe('success');
    expect(store.toasts[0].id).toBeTruthy();
  });

  it('addToast defaults variant to info', () => {
    const store = useToastStore();
    store.addToast({ message: 'Info' });
    expect(store.toasts[0].variant).toBe('info');
  });

  it('two addToast calls produce distinct ids', () => {
    const store = useToastStore();
    store.addToast({ message: 'A' });
    store.addToast({ message: 'B' });
    expect(store.toasts[0].id).not.toBe(store.toasts[1].id);
  });

  it('removeToast removes only the matching toast', () => {
    const store = useToastStore();
    store.addToast({ message: 'A' });
    store.addToast({ message: 'B' });
    const idToRemove = store.toasts[0].id;
    store.removeToast(idToRemove);
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].message).toBe('B');
  });
});
