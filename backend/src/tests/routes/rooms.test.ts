import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AppError } from '../../errors';
import { roomsRoutes } from '../../routes/rooms';
import { signJwt } from '../../lib/jwt';

vi.mock('../../services/room', () => ({
  createRoom: vi.fn(),
}));

import * as roomService from '../../services/room';

process.env.JWT_SECRET = 'test-secret';

async function buildApp() {
  const app = Fastify();
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ code: error.code });
    }
    return reply.code(500).send({ code: 'INTERNAL_ERROR' });
  });
  await app.register(roomsRoutes, { prefix: '/rooms' });
  return app;
}

describe('POST /rooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without a JWT', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/rooms', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 SESSION_EXPIRED when createRoom throws it', async () => {
    vi.mocked(roomService.createRoom).mockRejectedValue(new AppError('SESSION_EXPIRED', 401));
    const token = signJwt({ hostId: 'h1' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: {},
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('SESSION_EXPIRED');
  });

  it('calls createRoom with defaults and returns 201', async () => {
    vi.mocked(roomService.createRoom).mockResolvedValue({ roomId: 'room-1', code: 'JAM-ABCD' });
    const token = signJwt({ hostId: 'h1' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: {},
    });

    expect(res.statusCode).toBe(201);
    expect(vi.mocked(roomService.createRoom)).toHaveBeenCalledWith({
      hostId: 'h1',
      name: 'My Jam Session',
      voteThreshold: 3,
      maxSuggestions: 3,
    });
    expect(JSON.parse(res.body)).toEqual({ roomId: 'room-1', code: 'JAM-ABCD' });
  });

  it('passes provided body values to createRoom', async () => {
    vi.mocked(roomService.createRoom).mockResolvedValue({ roomId: 'room-2', code: 'JAM-XYZW' });
    const token = signJwt({ hostId: 'h1' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { name: 'Friday Night', voteThreshold: 5, maxSuggestions: 2 },
    });

    expect(res.statusCode).toBe(201);
    expect(vi.mocked(roomService.createRoom)).toHaveBeenCalledWith({
      hostId: 'h1',
      name: 'Friday Night',
      voteThreshold: 5,
      maxSuggestions: 2,
    });
  });
});
