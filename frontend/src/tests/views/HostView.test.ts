import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/stores/socket', () => ({ useSocketStore: vi.fn() }));
vi.mock('@/stores/user', () => ({ useUserStore: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
vi.mock('qrcode.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/lib/api', () => ({ api: { delete: vi.fn().mockResolvedValue({}) } }));

import { useSocketStore } from '@/stores/socket';
import { useUserStore } from '@/stores/user';
import { useQueueStore } from '@/stores/queue';
import { useRoomStore } from '@/stores/room';
import { api } from '@/lib/api';
import HostView from '@/views/HostView.vue';

const mockConnect = vi.fn();
const mockRemoveSuggestion = vi.fn();
const mockUpdateThreshold = vi.fn();
const mockMuteUser = vi.fn();
const mockUnmuteUser = vi.fn();

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
      muteUser: mockMuteUser,
      unmuteUser: mockUnmuteUser,
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

  it('renders approved queue items with name and artist', async () => {
    const queue = useQueueStore();
    queue.updateQueue(['track-1']);
    queue.setQueueMeta('track-1', TRACK_META);

    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="queue-item-track-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="queue-item-track-1"]').text()).toContain('Blinding Lights');
    expect(wrapper.find('[data-testid="queue-item-track-1"]').text()).toContain('The Weeknd');
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

  it('renders a Close Room button', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });
    expect(wrapper.find('[data-testid="close-room-btn"]').exists()).toBe(true);
  });

  it('clicking Close Room calls api.delete with the roomId', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });
    await wrapper.find('[data-testid="close-room-btn"]').trigger('click');
    expect(vi.mocked(api.delete)).toHaveBeenCalledWith('/rooms/room-abc');
  });

  it('changing threshold slider calls updateThreshold', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });

    const slider = wrapper.find('[data-testid="threshold-slider"]');
    await slider.setValue('5');

    expect(mockUpdateThreshold).toHaveBeenCalledWith({ roomId: 'room-abc', threshold: 5 });
  });

  it('renders a mute button per suggestion', async () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 1 });

    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="mute-btn-track-1"]').exists()).toBe(true);
  });

  it('clicking mute button calls muteUser with roomId and suggestedBy userId', async () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 1 });

    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });

    await wrapper.find('[data-testid="mute-btn-track-1"]').trigger('click');

    expect(mockMuteUser).toHaveBeenCalledWith({ roomId: 'room-abc', userId: 'u' });
  });

  it('shows Unmute button for muted suggestions and hides Mute button', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });
    const queueStore = useQueueStore();
    queueStore.suggestions = {
      'track-muted': {
        meta: { ...TRACK_META, id: 'track-muted', suggestedBy: 'user-a' },
        voteCount: 1,
        votedByMe: false,
        muted: true,
      },
    };
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="unmute-btn-track-muted"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="mute-btn-track-muted"]').exists()).toBe(false);
  });

  it('calls socket.unmuteUser when Unmute button is clicked', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });
    const queueStore = useQueueStore();
    queueStore.suggestions = {
      'track-muted': {
        meta: { ...TRACK_META, id: 'track-muted', suggestedBy: 'user-a' },
        voteCount: 1,
        votedByMe: false,
        muted: true,
      },
    };
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-testid="unmute-btn-track-muted"]').trigger('click');
    expect(mockUnmuteUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a' })
    );
  });

  it('renders NowPlayingCard when nowPlaying is set', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });
    const queueStore = useQueueStore();
    queueStore.nowPlaying = {
      trackId: 't1',
      meta: { id: 't1', name: 'Playing Song', artists: ['Artist'], album: 'Al', albumArt: '', uri: 'spotify:track:t1', durationMs: 0 },
    };
    await nextTick();
    expect(wrapper.find('[data-testid="now-playing-card"]').exists()).toBe(true);
  });

  it('renders history section when history has items', async () => {
    const router = buildRouter();
    await router.push('/host/room-abc');
    const wrapper = mount(HostView, { global: { plugins: [router] } });
    const queueStore = useQueueStore();
    queueStore.history = [{
      trackId: 't1',
      meta: { id: 't1', name: 'Old Song', artists: ['A'], album: 'Al', albumArt: '', uri: '', durationMs: 0 },
    }];
    await nextTick();
    expect(wrapper.find('[data-testid="history-section"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="queue-item-t1"]').exists()).toBe(true);
  });
});
