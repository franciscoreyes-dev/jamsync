import { FastifyPluginAsync } from 'fastify';
import { requireJwt } from '../lib/require-jwt';
import { createRoom, getRoomByCode, updateRoom, deleteRoom } from '../services/room';

export const roomsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: { name?: string; voteThreshold?: number; maxSuggestions?: number };
  }>(
    '/',
    {
      preHandler: [requireJwt],
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            voteThreshold: { type: 'number', minimum: 1, maximum: 10 },
            maxSuggestions: { type: 'number', minimum: 1, maximum: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const { hostId } = request.user;
      const {
        name = 'My Jam Session',
        voteThreshold = 3,
        maxSuggestions = 3,
      } = request.body;

      const result = await createRoom({ hostId, name, voteThreshold, maxSuggestions });
      return reply.code(201).send(result);
    }
  );

  fastify.patch<{
    Params: { id: string };
    Body: { voteThreshold?: number; maxSuggestions?: number };
  }>(
    '/:id',
    {
      preHandler: [requireJwt],
      schema: {
        body: {
          type: 'object',
          properties: {
            voteThreshold: { type: 'number', minimum: 1, maximum: 10 },
            maxSuggestions: { type: 'number', minimum: 1, maximum: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const { hostId } = request.user;
      const { id: roomId } = request.params;
      const { voteThreshold, maxSuggestions } = request.body;
      const result = await updateRoom({ roomId, hostId, voteThreshold, maxSuggestions });
      return reply.code(200).send(result);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireJwt] },
    async (request, reply) => {
      const { hostId } = request.user;
      const { id: roomId } = request.params;
      await deleteRoom({ roomId, hostId });
      return reply.code(204).send();
    }
  );

  fastify.get<{ Params: { code: string } }>('/:code', async (request) => {
    return getRoomByCode(request.params.code);
  });
};
