import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { exchangeCode, getMe, refreshHostToken } from '../services/spotify';
import { saveHostSession, deleteHostSession, redis } from '../services/redis';
import { AppError } from '../errors';
import { signJwt, verifyJwt } from '../lib/jwt';

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

async function requireJwt(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return reply.code(401).send({ code: 'INVALID_TOKEN' });
  }
  try {
    const payload = verifyJwt(auth.slice(7));
    request.user = payload;
  } catch {
    return reply.code(401).send({ code: 'INVALID_TOKEN' });
  }
}

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
    { preHandler: [requireJwt] },
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
