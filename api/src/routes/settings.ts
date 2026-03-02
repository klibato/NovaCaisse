import type { FastifyInstance } from 'fastify';

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /settings — retourne les infos du tenant
  fastify.get('/settings', async (request, reply) => {
    const tenant = await fastify.prisma.tenant.findUnique({
      where: { id: request.user.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        siret: true,
        address: true,
        vatNumber: true,
        phone: true,
        email: true,
        logoUrl: true,
      },
    });

    if (!tenant) {
      return reply.status(404).send({ error: 'Tenant non trouvé', code: 'NOT_FOUND' });
    }

    return reply.send(tenant);
  });

  // PUT /settings — modifier les infos (OWNER uniquement)
  fastify.put('/settings', async (request, reply) => {
    if (request.user.role !== 'OWNER') {
      return reply.status(403).send({ error: 'Seul le propriétaire peut modifier les paramètres', code: 'FORBIDDEN' });
    }

    const body = request.body as {
      name?: string;
      address?: string;
      siret?: string;
      vatNumber?: string;
      phone?: string;
      email?: string;
    };

    const tenant = await fastify.prisma.tenant.update({
      where: { id: request.user.tenantId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.siret !== undefined && { siret: body.siret }),
        ...(body.vatNumber !== undefined && { vatNumber: body.vatNumber || null }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.email !== undefined && { email: body.email }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        siret: true,
        address: true,
        vatNumber: true,
        phone: true,
        email: true,
        logoUrl: true,
      },
    });

    await fastify.prisma.auditLog.create({
      data: {
        tenantId: request.user.tenantId,
        userId: request.user.userId,
        action: 'settings.update',
        details: body,
        ip: request.ip,
      },
    });

    return reply.send(tenant);
  });

  // GET /tenants/by-slug/:slug — route publique pour résoudre un tenant par slug
  fastify.get(
    '/tenants/by-slug/:slug',
    { preHandler: [] }, // No auth required
    async (request, reply) => {
      const { slug } = request.params as { slug: string };

      const tenant = await fastify.prisma.tenant.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'Restaurant non trouvé', code: 'NOT_FOUND' });
      }

      return reply.send(tenant);
    },
  );
}
