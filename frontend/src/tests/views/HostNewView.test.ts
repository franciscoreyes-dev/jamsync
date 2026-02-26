import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import HostNewView from '@/views/HostNewView.vue';
import * as apiModule from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn() },
  getAuthHeader: vi.fn(() => ({})),
}));

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/host/new', name: 'host-new', component: HostNewView },
      { path: '/host/:id', name: 'host', component: { template: '<div />' } },
      { path: '/auth/error', name: 'auth-error', component: { template: '<div />' } },
    ],
  });
}

describe('HostNewView', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('redirects to auth-error when token is missing', async () => {
    const router = buildRouter();
    await router.push('/host/new');
    mount(HostNewView, { global: { plugins: [router] } });
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('auth-error');
    expect(router.currentRoute.value.query.reason).toBe('MISSING_TOKEN');
  });

  it('stores the JWT in localStorage', async () => {
    vi.mocked(apiModule.api.post).mockResolvedValue({ data: { roomId: 'r1' } });
    const router = buildRouter();
    await router.push('/host/new?token=my-jwt');
    mount(HostNewView, { global: { plugins: [router] } });
    await flushPromises();

    expect(localStorage.getItem('jamsync_token')).toBe('my-jwt');
  });

  it('calls POST /rooms with default payload', async () => {
    vi.mocked(apiModule.api.post).mockResolvedValue({ data: { roomId: 'r1' } });
    const router = buildRouter();
    await router.push('/host/new?token=my-jwt');
    mount(HostNewView, { global: { plugins: [router] } });
    await flushPromises();

    expect(vi.mocked(apiModule.api.post)).toHaveBeenCalledWith('/rooms', {
      name: 'My Jam Session',
      voteThreshold: 3,
      maxSuggestions: 3,
    });
  });

  it('redirects to /host/:id on success', async () => {
    vi.mocked(apiModule.api.post).mockResolvedValue({ data: { roomId: 'room-abc' } });
    const router = buildRouter();
    await router.push('/host/new?token=my-jwt');
    mount(HostNewView, { global: { plugins: [router] } });
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('host');
    expect(router.currentRoute.value.params.id).toBe('room-abc');
  });

  it('redirects to auth-error on POST /rooms failure', async () => {
    vi.mocked(apiModule.api.post).mockRejectedValue(new Error('server error'));
    const router = buildRouter();
    await router.push('/host/new?token=my-jwt');
    mount(HostNewView, { global: { plugins: [router] } });
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('auth-error');
    expect(router.currentRoute.value.query.reason).toBe('ROOM_CREATE_FAILED');
  });
});
