import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { AppError } from '../../errors';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

vi.mock('../../services/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Provide env vars used inside the service
process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
process.env.SPOTIFY_REDIRECT_URI = 'http://localhost:3000/auth/callback';

import { exchangeCode, getMe, refreshHostToken, getAppToken, searchTracks, getCurrentlyPlaying, getTrackInfo } from '../../services/spotify';
import * as redisModule from '../../services/redis';

const redisMock = redisModule.redis as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

describe('exchangeCode', () => {
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

  it('returns a new access token', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'new-at', expires_in: 3600 },
    });
    const result = await refreshHostToken('refresh-token');
    expect(result.accessToken).toBe('new-at');
    expect(result.expiresIn).toBe(3600);
  });
});

describe('getAppToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns cached token when spotify:app_token exists in Redis', async () => {
    redisMock.get.mockResolvedValue('cached-token');

    const token = await getAppToken();

    expect(token).toBe('cached-token');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('fetches a new token when cache is empty and stores it with expires_in TTL', async () => {
    redisMock.get.mockResolvedValue(null);
    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'new-app-token', expires_in: 3600 },
    });
    redisMock.set.mockResolvedValue('OK');

    const token = await getAppToken();

    expect(token).toBe('new-app-token');
    expect(redisMock.set).toHaveBeenCalledWith('spotify:app_token', 'new-app-token', 'EX', 3600);
  });
});

describe('getCurrentlyPlaying', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns track uri when something is playing', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      data: { item: { uri: 'spotify:track:abc123' } },
    });
    const result = await getCurrentlyPlaying('token');
    expect(result).toEqual({ uri: 'spotify:track:abc123' });
  });

  it('returns null when nothing is playing (204)', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({ status: 204, data: null });
    const result = await getCurrentlyPlaying('token');
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('network'));
    const result = await getCurrentlyPlaying('token');
    expect(result).toBeNull();
  });
});

describe('searchTracks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns formatted tracks using the app token', async () => {
    redisMock.get.mockResolvedValue('app-token');
    mockedAxios.get.mockResolvedValue({
      data: {
        tracks: {
          items: [
            {
              id: 'track-1',
              name: 'Blinding Lights',
              artists: [{ name: 'The Weeknd' }],
              album: { name: 'After Hours', images: [{ url: 'https://image.jpg' }] },
              uri: 'spotify:track:track-1',
              duration_ms: 200000,
            },
          ],
        },
      },
    });

    const tracks = await searchTracks('blinding lights', 5);

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toEqual({
      id: 'track-1',
      name: 'Blinding Lights',
      artists: ['The Weeknd'],
      album: 'After Hours',
      albumArt: 'https://image.jpg',
      uri: 'spotify:track:track-1',
      durationMs: 200000,
    });
  });
});

describe('getTrackInfo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns TrackMeta for a valid track', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        id: 'track-abc',
        name: 'Test Song',
        artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
        album: { name: 'Album X', images: [{ url: 'https://img.com/art.jpg' }] },
        uri: 'spotify:track:track-abc',
        duration_ms: 210000,
      },
    });

    const result = await getTrackInfo('track-abc', 'host-token');

    expect(result).toEqual({
      id: 'track-abc',
      name: 'Test Song',
      artists: ['Artist A', 'Artist B'],
      album: 'Album X',
      albumArt: 'https://img.com/art.jpg',
      uri: 'spotify:track:track-abc',
      durationMs: 210000,
    });
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/tracks/track-abc'),
      expect.objectContaining({ headers: { Authorization: 'Bearer host-token' } })
    );
  });

  it('returns result with empty albumArt when album has no images', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        id: 't1', name: 'S', artists: [{ name: 'A' }],
        album: { name: 'Al', images: [] },
        uri: 'spotify:track:t1', duration_ms: 100,
      },
    });
    const result = await getTrackInfo('t1', 'tok');
    expect(result?.albumArt).toBe('');
  });

  it('returns null on error', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));
    const result = await getTrackInfo('bad-id', 'tok');
    expect(result).toBeNull();
  });
});
