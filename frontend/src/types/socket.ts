export interface TrackMeta {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string;
  uri: string;
  durationMs: number;
}

export interface SuggestionItem extends TrackMeta {
  suggestedBy: string;
}

// Server → Client

export interface RoomStatePayload {
  roomId: string;
  code?: string;
  name: string;
  status: string;
  voteThreshold: number;
  maxSuggestions: number;
  queue: string[];
  suggestions: Array<SuggestionItem & { voteCount: number }>;
  participantCount: number;
}

export interface SuggestionAddedPayload {
  trackId: string;
  trackMeta: SuggestionItem;
  voteCount: number;
}

export interface VoteUpdatedPayload {
  trackId: string;
  voteCount: number;
  threshold: number;
}

export interface TrackApprovedPayload {
  trackId: string;
  trackMeta: SuggestionItem;
}

export interface QueueUpdatedPayload {
  queue: string[];
}

export interface UserJoinedPayload {
  userId: string;
  participantCount: number;
}

export interface UserLeftPayload {
  userId: string;
  participantCount: number;
}

export interface ErrorPayload {
  code: string;
}

// Client → Server

export interface SuggestTrackPayload {
  trackId: string;
  trackMeta: TrackMeta;
}

export interface VoteTrackPayload {
  trackId: string;
}
