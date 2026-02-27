import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth';
import { roomsRoutes } from './routes/rooms';
import { spotifyRoutes } from './routes/spotify';
import { setupSocket } from './socket';
import { AppError } from './errors';

const fastify = Fastify({ logger: true });

fastify.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({ code: error.code });
  }
  const status = (error as { statusCode?: number }).statusCode ?? 500;
  if (status < 500) {
    return reply.code(status).send({ code: 'VALIDATION_ERROR' });
  }
  fastify.log.error(error);
  return reply.code(500).send({ code: 'INTERNAL_ERROR' });
});

async function start() {
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(roomsRoutes, { prefix: '/rooms' });
  await fastify.register(spotifyRoutes, { prefix: '/spotify' });
  setupSocket(fastify);

  const port = Number(process.env.PORT ?? 3000);
  await fastify.listen({ port, host: '0.0.0.0' });
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
