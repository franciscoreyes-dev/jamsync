import { FastifyPluginAsync } from 'fastify';
import cors from '@fastify/cors';

export const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
};
