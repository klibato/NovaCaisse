import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER';
  name: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Non autorisé', code: 'UNAUTHORIZED' });
      }
    },
  );
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['@fastify/jwt'],
});
