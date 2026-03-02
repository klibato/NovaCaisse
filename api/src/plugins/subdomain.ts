import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    tenantSlug: string | null;
    tenantIdFromSlug: string | null;
  }
}

async function subdomainPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('tenantSlug', null);
  fastify.decorateRequest('tenantIdFromSlug', null);

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Read slug from X-Tenant-Slug header (sent by frontend)
    const slugHeader = request.headers['x-tenant-slug'] as string | undefined;

    if (slugHeader) {
      request.tenantSlug = slugHeader;

      // Resolve tenant by slug
      const tenant = await fastify.prisma.tenant.findUnique({
        where: { slug: slugHeader },
        select: { id: true },
      });

      if (tenant) {
        request.tenantIdFromSlug = tenant.id;
      }
    }
  });
}

export default fp(subdomainPlugin, {
  name: 'subdomain',
  dependencies: ['prisma'],
});
