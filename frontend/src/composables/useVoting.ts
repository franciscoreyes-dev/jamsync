import { useQueueStore } from '@/stores/queue';
import { useSocketStore } from '@/stores/socket';

export function useVoting() {
  const queue = useQueueStore();
  const socket = useSocketStore();

  function vote(trackId: string) {
    const entry = queue.suggestions[trackId];
    if (!entry || entry.votedByMe) return;

    queue.updateVote(trackId, entry.voteCount + 1, true);
    socket.voteTrack({ trackId });
  }

  return { vote };
}
