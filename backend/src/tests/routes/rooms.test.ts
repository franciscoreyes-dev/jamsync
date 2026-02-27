import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AppError } from '../../errors';
import { roomsRoutes } from '../../routes/rooms';
import { signJwt } from '../../lib/jwt';

vi.mock('../../services/room', () => ({
  createRoom: vi.fn(),
  getRoomByCode: vi.fn(),
  updateRoom: vi.fn(),
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

describe('PATCH /rooms/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without a JWT', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'PATCH', url: '/rooms/room-1', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with updated values on success', async () => {
    vi.mocked(roomService.updateRoom).mockResolvedValue({ roomId: 'room-1', voteThreshold: 5, maxSuggestions: 3 });
    const token = signJwt({ hostId: 'h1' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/rooms/room-1',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { voteThreshold: 5 },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(roomService.updateRoom)).toHaveBeenCalledWith({ roomId: 'room-1', hostId: 'h1', voteThreshold: 5 });
    expect(JSON.parse(res.body)).toEqual({ roomId: 'room-1', voteThreshold: 5, maxSuggestions: 3 });
  });

  it('returns 403 when UNAUTHORIZED is thrown', async () => {
    vi.mocked(roomService.updateRoom).mockRejectedValue(new AppError('UNAUTHORIZED', 403));
    const token = signJwt({ hostId: 'h2' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/rooms/room-1',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { maxSuggestions: 2 },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when ROOM_NOT_FOUND is thrown', async () => {
    vi.mocked(roomService.updateRoom).mockRejectedValue(new AppError('ROOM_NOT_FOUND', 404));
    const token = signJwt({ hostId: 'h1' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/rooms/bad-id',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { voteThreshold: 3 },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /rooms/:code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with room info for a valid code', async () => {
    vi.mocked(roomService.getRoomByCode).mockResolvedValue({
      roomId: 'room-1',
      name: 'Friday Jams',
      status: 'active',
      voteThreshold: 3,
      maxSuggestions: 5,
    });

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/rooms/JAM-ABCD' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      roomId: 'room-1',
      name: 'Friday Jams',
      status: 'active',
      voteThreshold: 3,
      maxSuggestions: 5,
    });
  });

  it('returns 404 when code is not found', async () => {
    vi.mocked(roomService.getRoomByCode).mockRejectedValue(new AppError('ROOM_NOT_FOUND', 404));

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/rooms/JAM-XXXX' });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('ROOM_NOT_FOUND');
  });
});
