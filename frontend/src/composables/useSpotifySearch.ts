import { ref, watch } from 'vue';
import { api } from '@/lib/api';
import type { TrackMeta } from '@/types/socket';

export function useSpotifySearch() {
  const query = ref('');
  const results = ref<TrackMeta[]>([]);
  const loading = ref(false);

  let timer: ReturnType<typeof setTimeout>;

  watch(query, (q) => {
    clearTimeout(timer);
    if (!q.trim()) {
      results.value = [];
      return;
    }
    timer = setTimeout(async () => {
      loading.value = true;
      try {
        const { data } = await api.get('/spotify/search', { params: { q } });
        results.value = data;
      } finally {
        loading.value = false;
      }
    }, 300);
  });

  return { query, results, loading };
}
