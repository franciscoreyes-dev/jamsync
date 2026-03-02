import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RoomStatePayload } from '@/types/socket';

export const useRoomStore = defineStore('room', () => {
  const roomId = ref<string | null>(null);
  const code = ref<string | null>(null);
  const name = ref<string | null>(null);
  const status = ref<string | null>(null);
  const voteThreshold = ref(0);
  const maxSuggestions = ref(0);
  const participantCount = ref(0);

  function setRoomState(data: RoomStatePayload) {
    roomId.value = data.roomId;
    if (data.code) code.value = data.code;
    name.value = data.name;
    status.value = data.status;
    voteThreshold.value = data.voteThreshold;
    maxSuggestions.value = data.maxSuggestions;
    participantCount.value = data.participantCount;
  }

  function setParticipantCount(n: number) {
    participantCount.value = n;
  }

  return { roomId, code, name, status, voteThreshold, maxSuggestions, participantCount, setRoomState, setParticipantCount };
});
