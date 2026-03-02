<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib/api';

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  const raw = route.query.token;
  const token = typeof raw === 'string' ? raw : undefined;

  if (!token) {
    router.replace({ name: 'auth-error', query: { reason: 'MISSING_TOKEN' } });
    return;
  }

  localStorage.setItem('jamsync_token', token);

  try {
    const { data } = await api.post<{ roomId: string; code: string }>('/rooms', {
      name: 'My Jam Session',
      voteThreshold: 3,
      maxSuggestions: 3,
    });
    router.replace({ name: 'host', params: { id: data.code } });
  } catch {
    router.replace({ name: 'auth-error', query: { reason: 'ROOM_CREATE_FAILED' } });
  }
});
</script>

<template>
  <div><!-- loading --></div>
</template>
