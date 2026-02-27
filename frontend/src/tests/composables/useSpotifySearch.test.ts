import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
  getAuthHeader: vi.fn(() => ({})),
}));

import { api } from '@/lib/api';
import { useSpotifySearch } from '@/composables/useSpotifySearch';

describe('useSpotifySearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty query, empty results, and loading=false', () => {
    const { query, results, loading } = useSpotifySearch();
    expect(query.value).toBe('');
    expect(results.value).toEqual([]);
    expect(loading.value).toBe(false);
  });

  it('does not call API before 300ms', async () => {
    const { query } = useSpotifySearch();
    query.value = 'test';
    await nextTick();
    vi.advanceTimersByTime(299);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('calls GET /spotify/search after 300ms debounce', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 't1', name: 'Blinding Lights' }] });
    const { query, results } = useSpotifySearch();

    query.value = 'blinding lights';
    await nextTick();
    vi.advanceTimersByTime(300);
    await flushPromises();

    expect(api.get).toHaveBeenCalledWith('/spotify/search', { params: { q: 'blinding lights' } });
    expect(results.value).toEqual([{ id: 't1', name: 'Blinding Lights' }]);
  });

  it('resets the debounce timer on each keystroke', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    const { query } = useSpotifySearch();

    query.value = 'bl';
    await nextTick();
    vi.advanceTimersByTime(200);

    query.value = 'bli';
    await nextTick();
    vi.advanceTimersByTime(200); // only 200ms since last change — should not fire

    expect(api.get).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100); // now 300ms since last change
    await flushPromises();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('clears results immediately when query becomes empty', async () => {
    const { query, results } = useSpotifySearch();

    // Prime: set a non-empty query so the watcher has something to react to
    query.value = 'test';
    await nextTick();
    vi.clearAllTimers(); // cancel the pending debounce
    results.value = [{ id: 't1' } as never]; // simulate results already populated

    query.value = '';
    await nextTick();

    expect(results.value).toEqual([]);
    expect(api.get).not.toHaveBeenCalled();
  });
});
