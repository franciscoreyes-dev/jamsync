<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

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
  <div class="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
    <div class="w-full max-w-sm space-y-8">
      <div class="text-center space-y-2">
        <div class="flex items-center justify-center gap-2 mb-1">
          <span class="text-green-500 text-3xl leading-none">♫</span>
          <h1 class="text-3xl font-bold text-white tracking-tight">Jamsync</h1>
        </div>
        <p class="text-zinc-500 text-sm">Collaborative playlists · Real-time</p>
      </div>

      <a
        :href="`${apiUrl}/auth/spotify`"
        data-testid="create-room"
        class="flex items-center justify-center gap-2 h-11 w-full rounded-md bg-green-500 text-black font-semibold text-sm hover:bg-green-400 active:bg-green-600 transition-colors no-underline"
      >
        Create a Room with Spotify
      </a>

      <div class="flex items-center gap-3">
        <div class="flex-1 h-px bg-zinc-800" />
        <span class="text-zinc-600 text-xs uppercase tracking-wider">or join</span>
        <div class="flex-1 h-px bg-zinc-800" />
      </div>

      <div class="space-y-3">
        <Input
          v-model="code"
          data-testid="code-input"
          placeholder="JAM-XXXX"
          class="text-center uppercase tracking-widest font-mono"
        />
        <Button
          data-testid="join-btn"
          variant="secondary"
          class="w-full"
          @click="joinByCode"
        >
          Join Room
        </Button>
      </div>
    </div>
  </div>
</template>
