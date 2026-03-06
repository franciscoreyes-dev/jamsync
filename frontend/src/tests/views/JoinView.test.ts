import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('socket.io-client', () => ({ io: vi.fn() }));

import { api } from '@/lib/api';
import JoinView from '@/views/JoinView.vue';

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/join/:code', name: 'join', component: JoinView },
      { path: '/room/:code', name: 'guest', component: { template: '<div/>' } },
    ],
  });
}

describe('JoinView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetches room info on mount and displays the room name', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { name: 'Sunday Vibes' } });
    const router = buildRouter();
    await router.push('/join/JAM-ABCD');
    const wrapper = mount(JoinView, { global: { plugins: [router] } });
    await flushPromises();

    expect(api.get).toHaveBeenCalledWith('/rooms/JAM-ABCD');
    expect(wrapper.find('[data-testid="room-name"]').text()).toBe('Sunday Vibes');
  });

  it('shows an error message when the room is not found', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Not Found'));
    const router = buildRouter();
    await router.push('/join/JAM-XXXX');
    const wrapper = mount(JoinView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.find('[data-testid="error-msg"]').exists()).toBe(true);
  });

  it('navigates to /room/:code when join is clicked', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { name: 'Chill Room' } });
    const router = buildRouter();
    await router.push('/join/JAM-ABCD');
    const wrapper = mount(JoinView, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find('[data-testid="join-btn"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('guest');
    expect(router.currentRoute.value.params.code).toBe('JAM-ABCD');
  });
});
