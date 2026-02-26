import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJwt } from './jwt';

export async function requireJwt(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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
