import axios from 'axios';
import { AppError } from '../errors';

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
  } catch {
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
