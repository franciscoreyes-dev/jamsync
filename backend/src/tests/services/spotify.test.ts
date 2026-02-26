import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { AppError } from '../../errors';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

// Provide env vars used inside the service
process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
process.env.SPOTIFY_REDIRECT_URI = 'http://localhost:3000/auth/callback';

import { exchangeCode, getMe, refreshHostToken } from '../../services/spotify';

describe('exchangeCode', () => {
  it('returns tokens on successful exchange', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 },
    });
    const tokens = await exchangeCode('valid-code');
    expect(tokens).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresIn: 3600 });
  });

  it('throws AppError(OAUTH_FAILED) when Spotify rejects the code', async () => {
    mockedAxios.post.mockRejectedValue(new Error('bad_request'));
    await expect(exchangeCode('bad-code')).rejects.toBeInstanceOf(AppError);
    await expect(exchangeCode('bad-code')).rejects.toMatchObject({ code: 'OAUTH_FAILED' });
  });
});

describe('getMe', () => {
  it('returns the user object', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { id: 'u1', display_name: 'Host', product: 'premium' },
    });
    const me = await getMe('access-token');
    expect(me.product).toBe('premium');
    expect(me.id).toBe('u1');
  });
});

describe('refreshHostToken', () => {
  it('returns a new access token', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'new-at', expires_in: 3600 },
    });
    const result = await refreshHostToken('refresh-token');
    expect(result.accessToken).toBe('new-at');
    expect(result.expiresIn).toBe(3600);
  });
});
