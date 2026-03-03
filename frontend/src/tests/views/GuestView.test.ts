import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';

vi.mock('@/stores/socket', () => ({ useSocketStore: vi.fn() }));
vi.mock('@/stores/user', () => ({ useUserStore: vi.fn() }));
vi.mock('@/composables/useSpotifySearch', () => ({ useSpotifySearch: vi.fn() }));
vi.mock('@/composables/useVoting', () => ({ useVoting: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: vi.fn() }));

import { useSocketStore } from '@/stores/socket';
import { useUserStore } from '@/stores/user';
import { useSpotifySearch } from '@/composables/useSpotifySearch';
import { useVoting } from '@/composables/useVoting';
import { useQueueStore } from '@/stores/queue';
import { useRoomStore } from '@/stores/room';
import GuestView from '@/views/GuestView.vue';

const mockSuggestTrack = vi.fn();
const mockVote = vi.fn();
const mockConnect = vi.fn();
const mockLeaveRoom = vi.fn();
const mockDisconnect = vi.fn();

const TRACK_META = {
  id: 'track-1', name: 'Blinding Lights', artists: ['The Weeknd'],
  album: 'After Hours', albumArt: '', uri: 'spotify:track:1', durationMs: 200000, suggestedBy: 'u',
};

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/room/:code', name: 'guest', component: GuestView }],
  });
}

describe('GuestView', () => {
  let queryRef: ReturnType<typeof ref<string>>;
  let resultsRef: ReturnType<typeof ref>;

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());

    queryRef = ref('');
    resultsRef = ref([]);

    vi.mocked(useSocketStore).mockReturnValue({ suggestTrack: mockSuggestTrack, connect: mockConnect, leaveRoom: mockLeaveRoom, disconnect: mockDisconnect } as never);
    vi.mocked(useUserStore).mockReturnValue({ userId: 'u' } as never);
    vi.mocked(useSpotifySearch).mockReturnValue({ query: queryRef, results: resultsRef, loading: ref(false) } as never);
    vi.mocked(useVoting).mockReturnValue({ vote: mockVote } as never);
  });

  it('connects to socket on mount with room code and userId', async () => {
    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    mount(GuestView, { global: { plugins: [router] } });

    expect(mockConnect).toHaveBeenCalledWith('JAM-ABCD', expect.any(String));
  });

  it('renders a search input bound to useSpotifySearch query', async () => {
    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });
    expect(wrapper.find('[data-testid="search-input"]').exists()).toBe(true);
  });

  it('shows a result card and suggest button per search result', async () => {
    resultsRef.value = [TRACK_META];
    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="result-track-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="suggest-btn-track-1"]').exists()).toBe(true);
  });

  it('calls suggestTrack when suggest button is clicked', async () => {
    resultsRef.value = [TRACK_META];
    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });

    await wrapper.find('[data-testid="suggest-btn-track-1"]').trigger('click');

    expect(mockSuggestTrack).toHaveBeenCalledWith({ trackId: 'track-1', trackMeta: TRACK_META });
  });

  it('renders suggestion cards with vote count', async () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 2 });

    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="suggestion-track-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="vote-count-track-1"]').text()).toBe('2');
  });

  it('vote button is enabled when not voted', async () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 0 });

    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="vote-btn-track-1"]').attributes('disabled')).toBeUndefined();
  });

  it('vote button is disabled when already voted', async () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 1 });
    queue.updateVote('track-1', 1, true);

    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="vote-btn-track-1"]').attributes('disabled')).toBeDefined();
  });

  it('renders approved queue items with name and artist', async () => {
    const queue = useQueueStore();
    queue.updateQueue(['track-1']);
    queue.setQueueMeta('track-1', TRACK_META);

    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="queue-item-track-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="queue-item-track-1"]').text()).toContain('Blinding Lights');
    expect(wrapper.find('[data-testid="queue-item-track-1"]').text()).toContain('The Weeknd');
  });

  it('renders a leave button in the header', async () => {
    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });
    expect(wrapper.find('[data-testid="leave-btn"]').exists()).toBe(true);
  });

  it('calls leaveRoom when leave button is clicked', async () => {
    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });
    await wrapper.find('[data-testid="leave-btn"]').trigger('click');
    expect(mockLeaveRoom).toHaveBeenCalled();
  });

  it('calls leaveRoom on unmount', async () => {
    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });
    wrapper.unmount();
    expect(mockLeaveRoom).toHaveBeenCalled();
  });

  it('calls vote when vote button is clicked', async () => {
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 0 });

    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });

    await wrapper.find('[data-testid="vote-btn-track-1"]').trigger('click');

    expect(mockVote).toHaveBeenCalledWith('track-1');
  });

  it('suggest button is disabled when user has reached maxSuggestions', async () => {
    resultsRef.value = [TRACK_META];
    const queue = useQueueStore();
    queue.addSuggestion({ trackId: 'track-1', trackMeta: TRACK_META, voteCount: 0 });
    const room = useRoomStore();
    room.setRoomState({ roomId: 'r', name: 'Jam', status: 'active', voteThreshold: 3, maxSuggestions: 1, queue: [], suggestions: [], participantCount: 0 });

    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="suggest-btn-track-1"]').attributes('disabled')).toBeDefined();
  });

  it('suggest button is enabled when user is under maxSuggestions', async () => {
    resultsRef.value = [TRACK_META];
    const room = useRoomStore();
    room.setRoomState({ roomId: 'r', name: 'Jam', status: 'active', voteThreshold: 3, maxSuggestions: 3, queue: [], suggestions: [], participantCount: 0 });

    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="suggest-btn-track-1"]').attributes('disabled')).toBeUndefined();
  });

  it('calls socket.disconnect when leave button is clicked', async () => {
    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });
    await wrapper.find('[data-testid="leave-btn"]').trigger('click');
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('does not render suggestions with muted=true', async () => {
    const queue = useQueueStore();
    queue.suggestions = {
      'track-visible': { meta: { ...TRACK_META, id: 'track-visible' }, voteCount: 0, votedByMe: false, muted: false },
      'track-muted': { meta: { ...TRACK_META, id: 'track-muted' }, voteCount: 0, votedByMe: false, muted: true },
    };

    const router = buildRouter();
    await router.push('/room/JAM-ABCD');
    const wrapper = mount(GuestView, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="suggestion-track-visible"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="suggestion-track-muted"]').exists()).toBe(false);
  });
});
