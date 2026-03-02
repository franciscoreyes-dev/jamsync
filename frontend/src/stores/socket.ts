import { defineStore } from 'pinia';
import { ref } from 'vue';
import { io, type Socket } from 'socket.io-client';
import { useRoomStore } from './room';
import { useQueueStore } from './queue';
import type {
  RoomStatePayload,
  SuggestionAddedPayload,
  VoteUpdatedPayload,
  TrackApprovedPayload,
  QueueUpdatedPayload,
  UserJoinedPayload,
  UserLeftPayload,
  SuggestTrackPayload,
  VoteTrackPayload,
} from '@/types/socket';

export const useSocketStore = defineStore('socket', () => {
  const socket = ref<Socket | null>(null);
  const connected = ref(false);
  const error = ref<string | null>(null);

  let _lastRoomCode = '';
  let _lastUserId = '';
  let _reconnectAttempts = 0;
  const MAX_RECONNECT = 3;
  const RECONNECT_DELAY_MS = 2000;

  function connect(roomCode: string, userId: string) {
    if (connected.value) return;

    _lastRoomCode = roomCode;
    _lastUserId = userId;
    _reconnectAttempts = 0;

    const s = io(import.meta.env.VITE_API_URL ?? 'http://localhost:3000', {
      auth: { roomCode, userId },
    });

    socket.value = s;

    const room = useRoomStore();
    const queue = useQueueStore();

    s.on('connect', () => { connected.value = true; _reconnectAttempts = 0; });
    s.on('disconnect', () => {
      connected.value = false;
      if (_reconnectAttempts < MAX_RECONNECT) {
        _reconnectAttempts++;
        setTimeout(() => {
          if (!connected.value && _lastRoomCode) {
            connect(_lastRoomCode, _lastUserId);
          }
        }, RECONNECT_DELAY_MS);
      }
    });

    s.on('room_state', (data: RoomStatePayload) => {
      room.setRoomState(data);
      queue.setFromRoomState(data);
    });

    s.on('suggestion_added', (data: SuggestionAddedPayload) => {
      queue.addSuggestion(data);
    });

    s.on('vote_updated', (data: VoteUpdatedPayload) => {
      const existing = queue.suggestions[data.trackId];
      queue.updateVote(data.trackId, data.voteCount, existing?.votedByMe ?? false);
    });

    s.on('track_approved', (data: TrackApprovedPayload) => {
      queue.approveSuggestion(data.trackId);
      queue.setQueueMeta(data.trackId, data.trackMeta);
    });

    s.on('suggestion_removed', (data: { trackId: string }) => {
      queue.approveSuggestion(data.trackId);
    });

    s.on('queue_updated', (data: QueueUpdatedPayload) => {
      queue.updateQueue(data.queue);
    });

    s.on('user_joined', (data: UserJoinedPayload) => {
      room.setParticipantCount(data.participantCount);
    });

    s.on('user_left', (data: UserLeftPayload) => {
      room.setParticipantCount(data.participantCount);
    });

    s.on('room_updated', (data: { voteThreshold?: number }) => {
      if (data.voteThreshold !== undefined) room.setVoteThreshold(data.voteThreshold);
    });

    s.on('error', (data: { code: string }) => {
      error.value = data.code;
    });

    s.emit('join_room');
  }

  function disconnect() {
    socket.value?.disconnect();
    socket.value = null;
    connected.value = false;
  }

  function suggestTrack(payload: SuggestTrackPayload) {
    socket.value?.emit('suggest_track', payload);
  }

  function voteTrack(payload: VoteTrackPayload) {
    socket.value?.emit('vote_track', payload);
  }

  function removeSuggestion(payload: { roomId: string; trackId: string }) {
    socket.value?.emit('remove_suggestion', payload);
  }

  function updateThreshold(payload: { roomId: string; threshold: number }) {
    socket.value?.emit('update_threshold', payload);
  }

  return { socket, connected, error, connect, disconnect, suggestTrack, voteTrack, removeSuggestion, updateThreshold };
});
