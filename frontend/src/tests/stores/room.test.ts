import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRoomStore } from '@/stores/room';
import type { RoomStatePayload } from '@/types/socket';

const PAYLOAD: RoomStatePayload = {
  roomId: 'room-1',
  name: 'My Jam',
  status: 'active',
  voteThreshold: 3,
  maxSuggestions: 2,
  queue: [],
  suggestions: [],
  participantCount: 5,
};

describe('useRoomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('has null/zero initial state', () => {
    const store = useRoomStore();
    expect(store.roomId).toBeNull();
    expect(store.name).toBeNull();
    expect(store.status).toBeNull();
    expect(store.voteThreshold).toBe(0);
    expect(store.maxSuggestions).toBe(0);
    expect(store.participantCount).toBe(0);
  });

  it('setRoomState populates all fields from payload', () => {
    const store = useRoomStore();
    store.setRoomState(PAYLOAD);
    expect(store.roomId).toBe('room-1');
    expect(store.name).toBe('My Jam');
    expect(store.status).toBe('active');
    expect(store.voteThreshold).toBe(3);
    expect(store.maxSuggestions).toBe(2);
    expect(store.participantCount).toBe(5);
  });

  it('setParticipantCount updates participantCount', () => {
    const store = useRoomStore();
    store.setParticipantCount(12);
    expect(store.participantCount).toBe(12);
  });

  it('setVoteThreshold updates voteThreshold', () => {
    const store = useRoomStore();
    store.setVoteThreshold(7);
    expect(store.voteThreshold).toBe(7);
  });
});
