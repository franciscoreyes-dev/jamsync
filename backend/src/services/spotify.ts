import axios from 'axios';
import { AppError } from '../errors';
import { redis } from './redis';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';

function basicAuth(): string {
  const id = process.env.SPOTIFY_CLIENT_ID!;
  const secret = process.env.SPOTIFY_CLIENT_SECRET!;
  return Buffer.from(`${id}:${secret}`).toString('base64');
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  product: string;
}

export async function exchangeCode(code: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
  });

  try {
    const { data } = await axios.post(`${SPOTIFY_ACCOUNTS}/api/token`, body.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: unknown; status?: number } };
    console.error('[exchangeCode] Spotify error:', axiosErr.response?.status, axiosErr.response?.data);
    throw new AppError('OAUTH_FAILED', 400);
  }
}

export async function getMe(accessToken: string): Promise<SpotifyUser> {
  const { data } = await axios.get(`${SPOTIFY_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function refreshHostToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const { data } = await axios.post(`${SPOTIFY_ACCOUNTS}/api/token`, body.toString(), {
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function getAppToken(): Promise<string> {
  const cached = await redis.get('spotify:app_token');
  if (cached) return cached;

  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const { data } = await axios.post(`${SPOTIFY_ACCOUNTS}/api/token`, body.toString(), {
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  await redis.set('spotify:app_token', data.access_token, 'EX', data.expires_in);
  return data.access_token as string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string;
  uri: string;
  durationMs: number;
}

interface RawTrackItem {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string }> };
  uri: string;
  duration_ms: number;
}

export async function addToQueue(trackUri: string, hostToken: string): Promise<void> {
  await axios.post(
    `${SPOTIFY_API}/me/player/queue?uri=${encodeURIComponent(trackUri)}`,
    null,
    { headers: { Authorization: `Bearer ${hostToken}` } }
  );
}

export async function getCurrentlyPlaying(
  hostToken: string
): Promise<{ uri: string } | null> {
  try {
    const { status, data } = await axios.get(`${SPOTIFY_API}/me/player/currently-playing`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    if (status === 204 || !data?.item) return null;
    return { uri: data.item.uri as string };
  } catch {
    return null;
  }
}

export async function getTrackInfo(spotifyTrackId: string, hostToken: string): Promise<SpotifyTrack | null> {
  try {
    const { data } = await axios.get(`${SPOTIFY_API}/tracks/${spotifyTrackId}`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const track = data as RawTrackItem;
    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map((a) => a.name),
      album: track.album.name,
      albumArt: track.album.images?.[0]?.url ?? '',
      uri: track.uri,
      durationMs: track.duration_ms,
    };
  } catch {
    return null;
  }
}

export async function searchTracks(q: string, limit = 10): Promise<SpotifyTrack[]> {
  const token = await getAppToken();
  const params = new URLSearchParams({ q, type: 'track', limit: String(limit) });
  const { data } = await axios.get(`${SPOTIFY_API}/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return (data.tracks.items as RawTrackItem[]).map((item) => ({
    id: item.id,
    name: item.name,
    artists: item.artists.map((a) => a.name),
    album: item.album.name,
    albumArt: item.album.images[0]?.url ?? '',
    uri: item.uri,
    durationMs: item.duration_ms,
  }));
}
