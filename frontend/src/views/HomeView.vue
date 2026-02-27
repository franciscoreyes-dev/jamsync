<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const code = ref('');

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function joinByCode() {
  const normalized = code.value.trim().toUpperCase();
  if (!normalized) return;
  router.push(`/join/${normalized}`);
}
</script>

<template>
  <div>
    <a :href="`${apiUrl}/auth/spotify`" data-testid="create-room">Create Room</a>
    <input v-model="code" data-testid="code-input" type="text" />
    <button data-testid="join-btn" @click="joinByCode">Join</button>
  </div>
</template>
