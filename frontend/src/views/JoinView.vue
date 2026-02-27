<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/lib/api';
import { useSocketStore } from '@/stores/socket';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const router = useRouter();
const socket = useSocketStore();
const user = useUserStore();

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
  socket.connect(code, user.userId);
  router.push(`/room/${code}`);
}
</script>

<template>
  <div>
    <p v-if="error" data-testid="error-msg">Room not found.</p>
    <template v-else>
      <p data-testid="room-name">{{ roomName }}</p>
      <button data-testid="join-btn" @click="join">Join</button>
    </template>
  </div>
</template>
