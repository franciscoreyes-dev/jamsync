import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import AuthErrorView from '@/views/AuthErrorView.vue';

async function mountWithReason(reason: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/auth/error', name: 'auth-error', component: AuthErrorView }],
  });
  await router.push(`/auth/error?reason=${reason}`);
  return mount(AuthErrorView, { global: { plugins: [router] } });
}

describe('AuthErrorView', () => {
  it('renders PREMIUM_REQUIRED reason', async () => {
    const wrapper = await mountWithReason('PREMIUM_REQUIRED');
    expect(wrapper.text()).toContain('PREMIUM_REQUIRED');
  });

  it('renders OAUTH_FAILED reason', async () => {
    const wrapper = await mountWithReason('OAUTH_FAILED');
    expect(wrapper.text()).toContain('OAUTH_FAILED');
  });

  it('renders MISSING_TOKEN reason', async () => {
    const wrapper = await mountWithReason('MISSING_TOKEN');
    expect(wrapper.text()).toContain('MISSING_TOKEN');
  });
});
