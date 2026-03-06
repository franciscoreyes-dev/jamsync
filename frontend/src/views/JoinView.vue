<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';

const route = useRoute();
const router = useRouter();

const code = route.params.code as string;
const roomName = ref<string | null>(null);
const error = ref(false);

onMounted(async () => {
  try {
    const { data } = await api.get(`/rooms/${code}`);
    roomName.value = data.name;
  } catch {
    error.value = true;
  }
});

function join() {
  router.push(`/room/${code}`);
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center">
        <span class="text-green-500 text-2xl">♫</span>
        <h1 class="text-2xl font-bold text-white mt-1">Join Room</h1>
        <p class="text-zinc-500 text-sm mt-1 font-mono tracking-widest">{{ code }}</p>
      </div>

      <div v-if="error">
        <Card>
          <CardContent class="text-center py-8">
            <p class="text-zinc-400 text-sm" data-testid="error-msg">Room not found.</p>
            <Button
              variant="ghost"
              class="mt-4"
              @click="router.push('/')"
            >
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>

      <div v-else class="space-y-4">
        <Card>
          <CardContent class="py-6 text-center">
            <p class="text-zinc-500 text-xs uppercase tracking-wider mb-1">You're joining</p>
            <p class="text-white font-semibold text-lg" data-testid="room-name">{{ roomName ?? '...' }}</p>
          </CardContent>
        </Card>

        <Button
          data-testid="join-btn"
          class="w-full"
          @click="join"
        >
          Join Session
        </Button>
      </div>
    </div>
  </div>
</template>
