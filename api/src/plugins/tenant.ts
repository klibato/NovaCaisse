import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
  }
}

async function tenantPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('tenantId', '');

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // tenantId is injected after JWT authentication in preHandler
    // This hook just ensures the decorator exists
    if (request.user?.tenantId) {
      request.tenantId = request.user.tenantId;
    }
  });
}

export default fp(tenantPlugin, {
  name: 'tenant',
});
