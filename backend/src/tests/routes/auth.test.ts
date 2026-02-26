import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { authRoutes } from '../../routes/auth';

// ── mock services so no real network/Redis calls happen ──────────────────────
vi.mock('../../services/spotify', () => ({
  exchangeCode: vi.fn(),
  getMe: vi.fn(),
  refreshHostToken: vi.fn(),
}));

vi.mock('../../services/redis', () => ({
  saveHostSession: vi.fn(),
  getHostSession: vi.fn(),
  deleteHostSession: vi.fn(),
  redis: { hget: vi.fn(), hset: vi.fn() },
}));

import * as spotifyService from '../../services/spotify';
import * as redisService from '../../services/redis';

process.env.SPOTIFY_CLIENT_ID = 'cid';
process.env.SPOTIFY_REDIRECT_URI = 'http://localhost:3000/auth/callback';
process.env.JWT_SECRET = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

async function buildApp() {
  const app = Fastify();
  await app.register(authRoutes, { prefix: '/auth' });
  return app;
}

// ── GET /auth/spotify ─────────────────────────────────────────────────────────
describe('GET /auth/spotify', () => {
  it('redirects to Spotify with correct params', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/spotify' });
    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain('accounts.spotify.com/authorize');
    expect(location).toContain('client_id=cid');
    expect(location).toContain('user-modify-playback-state');
  });
});

// ── GET /auth/callback ────────────────────────────────────────────────────────
describe('GET /auth/callback', () => {
  it('redirects to /host/new with JWT on premium account', async () => {
    vi.mocked(spotifyService.exchangeCode).mockResolvedValue({
      accessToken: 'at', refreshToken: 'rt', expiresIn: 3600,
    });
    vi.mocked(spotifyService.getMe).mockResolvedValue({
      id: 'u1', display_name: 'Host', product: 'premium',
    });
    vi.mocked(redisService.saveHostSession).mockResolvedValue();

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/callback?code=valid-code' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('/host/new?token=');
  });

  it('redirects to error page when not premium', async () => {
    vi.mocked(spotifyService.exchangeCode).mockResolvedValue({
      accessToken: 'at', refreshToken: 'rt', expiresIn: 3600,
    });
    vi.mocked(spotifyService.getMe).mockResolvedValue({
      id: 'u1', display_name: 'Host', product: 'free',
    });

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/callback?code=free-code' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('reason=PREMIUM_REQUIRED');
  });

  it('redirects to error page when no code param', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/callback?error=access_denied' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('reason=OAUTH_FAILED');
  });
});

// ── DELETE /auth/logout ───────────────────────────────────────────────────────
describe('DELETE /auth/logout', () => {
  it('returns 204 with a valid JWT', async () => {
    vi.mocked(redisService.deleteHostSession).mockResolvedValue();
    const { signJwt } = await import('../../lib/jwt');
    const token = signJwt({ hostId: 'h1' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(204);
    expect(vi.mocked(redisService.deleteHostSession)).toHaveBeenCalledWith('h1');
  });

  it('returns 401 without a token', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: '/auth/logout' });
    expect(res.statusCode).toBe(401);
  });
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────
describe('POST /auth/refresh', () => {
  it('returns 200 and updates the token in Redis', async () => {
    vi.mocked(redisService.redis.hget as ReturnType<typeof vi.fn>).mockResolvedValue('rt');
    vi.mocked(spotifyService.refreshHostToken).mockResolvedValue({
      accessToken: 'new-at', expiresIn: 3600,
    });
    vi.mocked(redisService.redis.hset as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const { signJwt } = await import('../../lib/jwt');
    const token = signJwt({ hostId: 'h1' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { roomId: 'room-1' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
  });

  it('returns 404 when room does not exist in Redis', async () => {
    vi.mocked(redisService.redis.hget as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { signJwt } = await import('../../lib/jwt');
    const token = signJwt({ hostId: 'h1' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { roomId: 'ghost-room' },
    });

    expect(res.statusCode).toBe(404);
  });
});
