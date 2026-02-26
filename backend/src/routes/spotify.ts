import { FastifyPluginAsync } from 'fastify';
import { searchTracks } from '../services/spotify';

export const spotifyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { q: string; limit?: number } }>(
    '/search',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 1 },
            limit: { type: 'number', minimum: 1, maximum: 50 },
          },
        },
      },
    },
    async (request) => {
      const { q, limit = 10 } = request.query;
      return searchTracks(q, limit);
    }
  );
};
