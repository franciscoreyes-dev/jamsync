import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/stores/socket', () => ({ useSocketStore: vi.fn() }));
vi.mock('@/stores/user', () => ({ useUserStore: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: vi.fn() }));

import { useSocketStore } from '@/stores/socket';
import { useUserStore } from '@/stores/user';
import { useQueueStore } from '@/stores/queue';
import { useRoomStore } from '@/stores/room';
import HostView from '@/views/HostView.vue';

const mockConnect = vi.fn();
const mockRemoveSuggestion = vi.fn();
const mockUpdateThreshold = vi.fn();

const TRACK_META = {
  id: 'track-1', name: 'Blinding Lights', artists: ['The Weeknd'],
  album: 'After Hours', albumArt: '', uri: 'spotify:track:1', durationMs: 200000, suggestedBy: 'u',
};

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/host/:id', name: 'host', component: HostView }],
  });
}

describe('HostView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    vi.mocked(useSocketStore).mockReturnValue({
      connect: mockConnect,
      removeSuggestion: mockRemoveSuggestion,
      updateThreshold: mockUpdateThreshold,
    } as never);
    vi.mocked(useUserStore).mockReturnValue({ userId: 'user-host' } as never);
  });

  it('calls socketStore.connect on mount with roomId and userId', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    mount(HostView, { global: { plugins: [router] } });

    expect(mockConnect).toHaveBeenCalledWith('room-abc', 'user-host');
  });

  it('displays the participant count from roomStore', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });
    const room = useRoomStore();
    room.setParticipantCount(7);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="participant-count"]').text()).toBe('7');
  });

  it('renders suggestion cards with vote count', async () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 2 });

    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="suggestion-track-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="vote-count-track-1"]').text()).toBe('2');
  });

  it('clicking Remove calls removeSuggestion with roomId and trackId', async () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 1 });

    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });

    await wrapper.find('[data-testid="remove-btn-track-1"]').trigger('click');

    expect(mockRemoveSuggestion).toHaveBeenCalledWith({ roomId: 'room-abc', trackId: 'track-1' });
  });

  it('threshold slider reflects current voteThreshold from roomStore', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });
    const room = useRoomStore();
    room.setRoomState({ roomId: 'room-abc', name: 'Jam', status: 'active', voteThreshold: 4, maxSuggestions: 3, queue: [], suggestions: [], participantCount: 0 });
    await wrapper.vm.$nextTick();

    const slider = wrapper.find('[data-testid="threshold-slider"]');
    expect((slider.element as HTMLInputElement).value).toBe('4');
  });

  it('changing threshold slider calls updateThreshold', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });

    const slider = wrapper.find('[data-testid="threshold-slider"]');
    await slider.setValue('5');

    expect(mockUpdateThreshold).toHaveBeenCalledWith({ roomId: 'room-abc', threshold: 5 });
  });
});
