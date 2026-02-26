import 'dotenv/config';
import Fastify from 'fastify';
import { corsPlugin } from './plugins/cors';
import { authRoutes } from './routes/auth';
import { AppError } from './errors';

const fastify = Fastify({ logger: true });

fastify.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({ code: error.code });
  }
  fastify.log.error(error);
  return reply.code(500).send({ code: 'INTERNAL_ERROR' });
});

async function start() {
  await fastify.register(corsPlugin);
  await fastify.register(authRoutes, { prefix: '/auth' });

  const port = Number(process.env.PORT ?? 3000);
  await fastify.listen({ port, host: '0.0.0.0' });
}

start();
