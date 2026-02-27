import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomeView },
      { path: '/join/:code', name: 'join', component: { template: '<div/>' } },
    ],
  });
}

describe('HomeView', () => {
  beforeEach(async () => {
    const router = buildRouter();
    await router.push('/');
  });

  it('renders a link that points to the backend OAuth endpoint', async () => {
    const router = buildRouter();
    await router.push('/');
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    const link = wrapper.find('[data-testid="create-room"]');
    expect(link.attributes('href')).toMatch(/\/auth\/spotify/);
  });

  it('navigates to /join/:code when code is entered and join is triggered', async () => {
    const router = buildRouter();
    await router.push('/');
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await wrapper.find('[data-testid="code-input"]').setValue('JAM-ABCD');
    await wrapper.find('[data-testid="join-btn"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('join');
    expect(router.currentRoute.value.params.code).toBe('JAM-ABCD');
  });

  it('trims and uppercases the code before navigating', async () => {
    const router = buildRouter();
    await router.push('/');
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await wrapper.find('[data-testid="code-input"]').setValue('  jam-abcd  ');
    await wrapper.find('[data-testid="join-btn"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.params.code).toBe('JAM-ABCD');
  });

  it('does not navigate when code is empty', async () => {
    const router = buildRouter();
    await router.push('/');
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await wrapper.find('[data-testid="join-btn"]').trigger('click');
    expect(router.currentRoute.value.name).toBe('home');
  });
});
