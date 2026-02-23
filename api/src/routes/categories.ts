import type { FastifyInstance } from 'fastify';
import { rbac } from '../hooks/rbac.hook.js';

const categorySchema = {
  body: {
    type: 'object' as const,
    required: ['name'],
    properties: {
      name: { type: 'string' as const, minLength: 1 },
      color: { type: 'string' as const, pattern: '^#[0-9a-fA-F]{6}$' },
      position: { type: 'integer' as const, minimum: 0 },
    },
  },
};

export default async function categoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /categories
  fastify.get('/categories', async (request, reply) => {
    const query = request.query as { includeInactive?: string };
    const whereClause: Record<string, unknown> = {
      tenantId: request.user.tenantId,
    };
    if (query.includeInactive !== 'true') {
      whereClause.active = true;
    }

    const categories = await fastify.prisma.category.findMany({
      where: whereClause,
      include: { _count: { select: { products: true } } },
      orderBy: { position: 'asc' },
    });

    return reply.send(categories);
  });

  // GET /categories/:id
  fastify.get('/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const category = await fastify.prisma.category.findFirst({
      where: { id, tenantId: request.user.tenantId },
      include: { products: { where: { active: true } } },
    });

    if (!category) {
      return reply.status(404).send({ error: 'Catégorie non trouvée', code: 'NOT_FOUND' });
    }

    return reply.send(category);
  });

  // POST /categories
  fastify.post(
    '/categories',
    { schema: categorySchema, preHandler: rbac(['OWNER', 'MANAGER']) },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        color?: string;
        position?: number;
      };

      // Auto-position si non spécifié
      let position = body.position;
      if (position === undefined) {
        const maxPos = await fastify.prisma.category.aggregate({
          where: { tenantId: request.user.tenantId },
          _max: { position: true },
        });
        position = (maxPos._max.position ?? -1) + 1;
      }

      const category = await fastify.prisma.category.create({
        data: {
          tenantId: request.user.tenantId,
          name: body.name,
          color: body.color ?? '#3498db',
          position,
        },
      });

      return reply.status(201).send(category);
    },
  );

  // PUT /categories/:id
  fastify.put(
    '/categories/:id',
    { preHandler: rbac(['OWNER', 'MANAGER']) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const existing = await fastify.prisma.category.findFirst({
        where: { id, tenantId: request.user.tenantId },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Catégorie non trouvée', code: 'NOT_FOUND' });
      }

      const category = await fastify.prisma.category.update({
        where: { id },
        data: body,
      });

      return reply.send(category);
    },
  );

  // DELETE /categories/:id (soft delete)
  fastify.delete(
    '/categories/:id',
    { preHandler: rbac(['OWNER', 'MANAGER']) },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await fastify.prisma.category.findFirst({
        where: { id, tenantId: request.user.tenantId },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Catégorie non trouvée', code: 'NOT_FOUND' });
      }

      await fastify.prisma.category.update({
        where: { id },
        data: { active: false },
      });

      return reply.status(204).send();
    },
  );
}
