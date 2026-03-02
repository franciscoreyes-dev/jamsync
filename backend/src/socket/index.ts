import { Server } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { roomMiddleware } from './middleware';
import { registerHandlers } from './handlers';
import { setIo } from '../lib/io';

export function setupSocket(fastify: FastifyInstance): void {
  const io = new Server(fastify.server, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    },
  });

  setIo(io);
  io.use(roomMiddleware);

  io.on('connection', (socket) => {
    registerHandlers(io, socket);
  });
}
