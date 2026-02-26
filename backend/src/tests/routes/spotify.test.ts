import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AppError } from '../../errors';
import { spotifyRoutes } from '../../routes/spotify';

vi.mock('../../services/spotify', () => ({
  searchTracks: vi.fn(),
}));

import * as spotifyService from '../../services/spotify';

async function buildApp() {
  const app = Fastify();
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ code: error.code });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status < 500) {
      return reply.code(status).send({ code: 'VALIDATION_ERROR' });
    }
    return reply.code(500).send({ code: 'INTERNAL_ERROR' });
  });
  await app.register(spotifyRoutes, { prefix: '/spotify' });
  return app;
}

describe('GET /spotify/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with tracks for a valid query', async () => {
    const mockTrack = {
      id: 'track-1',
      name: 'Blinding Lights',
      artists: ['The Weeknd'],
      album: 'After Hours',
      albumArt: 'https://image.jpg',
      uri: 'spotify:track:track-1',
      durationMs: 200000,
    };
    vi.mocked(spotifyService.searchTracks).mockResolvedValue([mockTrack]);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/spotify/search?q=blinding+lights' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([mockTrack]);
  });

  it('returns 400 when q is missing', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/spotify/search' });

    expect(res.statusCode).toBe(400);
  });

  it('passes limit query param to searchTracks', async () => {
    vi.mocked(spotifyService.searchTracks).mockResolvedValue([]);

    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/spotify/search?q=test&limit=5' });

    expect(vi.mocked(spotifyService.searchTracks)).toHaveBeenCalledWith('test', 5);
  });
});
