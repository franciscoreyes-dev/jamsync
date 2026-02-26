import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { exchangeCode, getMe, refreshHostToken } from '../services/spotify';
import { saveHostSession, deleteHostSession, redis } from '../services/redis';
import { AppError } from '../errors';
import { signJwt } from '../lib/jwt';
import { requireJwt } from '../lib/require-jwt';

const SCOPES = [
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/spotify', async (_request, reply) => {
    const params = new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      response_type: 'code',
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      scope: SCOPES,
    });
    return reply.redirect(`https://accounts.spotify.com/authorize?${params}`);
  });

  fastify.get<{ Querystring: { code?: string; error?: string } }>(
    '/callback',
    async (request, reply) => {
      const { code, error } = request.query;
      const frontendError = (reason: string) =>
        reply.redirect(`${process.env.FRONTEND_URL}/auth/error?reason=${reason}`);

      if (error || !code) return frontendError('OAUTH_FAILED');

      try {
        const tokens = await exchangeCode(code);
        const me = await getMe(tokens.accessToken);

        if (me.product !== 'premium') return frontendError('PREMIUM_REQUIRED');

        const hostId = randomUUID();
        await saveHostSession(hostId, {
          hostToken: tokens.accessToken,
          hostRefreshToken: tokens.refreshToken,
        });

        const jwtToken = signJwt({ hostId });
        return reply.redirect(`${process.env.FRONTEND_URL}/host/new?token=${jwtToken}`);
      } catch (err) {
        if (err instanceof AppError && err.code === 'PREMIUM_REQUIRED') {
          return frontendError('PREMIUM_REQUIRED');
        }
        return frontendError('OAUTH_FAILED');
      }
    }
  );

  fastify.post<{ Body: { roomId: string } }>(
    '/refresh',
    {
      preHandler: [requireJwt],
      schema: {
        body: {
          type: 'object',
          required: ['roomId'],
          properties: { roomId: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const { roomId } = request.body;
      const hostRefreshToken = await redis.hget(`room:${roomId}`, 'hostRefreshToken');
      if (!hostRefreshToken) throw new AppError('ROOM_NOT_FOUND', 404);

      const { accessToken } = await refreshHostToken(hostRefreshToken);
      await redis.hset(`room:${roomId}`, 'hostToken', accessToken);
      return { success: true };
    }
  );

  fastify.delete(
    '/logout',
    { preHandler: [requireJwt] },
    async (request, reply) => {
      const { hostId } = request.user;
      await deleteHostSession(hostId);
      return reply.code(204).send();
    }
  );
};
