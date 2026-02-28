import type { FastifyInstance } from 'fastify';
import { rbac } from '../hooks/rbac.hook.js';

const productSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'priceHt'],
    properties: {
      name: { type: 'string' as const, minLength: 1 },
      priceHt: { type: 'integer' as const, minimum: 0 },
      vatRate: { type: 'number' as const, default: 10.0 },
      categoryId: { type: 'string' as const, nullable: true },
      imageUrl: { type: 'string' as const, nullable: true },
      supplements: {
        type: 'array' as const,
        nullable: true,
        items: {
          type: 'object' as const,
          required: ['name', 'priceHt', 'maxQty'],
          properties: {
            name: { type: 'string' as const },
            priceHt: { type: 'integer' as const, minimum: 0 },
            maxQty: { type: 'integer' as const, minimum: 1 },
          },
        },
      },
    },
  },
};

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /products
  fastify.get('/products', async (request, reply) => {
    const query = request.query as { includeInactive?: string };
    const whereClause: Record<string, unknown> = {
      tenantId: request.user.tenantId,
    };
    if (query.includeInactive !== 'true') {
      whereClause.active = true;
    }

    const products = await fastify.prisma.product.findMany({
      where: whereClause,
      include: { category: { select: { id: true, name: true, color: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(products);
  });

  // GET /products/:id
  fastify.get('/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await fastify.prisma.product.findFirst({
      where: { id, tenantId: request.user.tenantId },
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    if (!product) {
      return reply.status(404).send({ error: 'Produit non trouvé', code: 'NOT_FOUND' });
    }

    return reply.send(product);
  });

  // POST /products
  fastify.post(
    '/products',
    { schema: productSchema, preHandler: rbac(['OWNER', 'MANAGER']) },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        priceHt: number;
        vatRate?: number;
        categoryId?: string | null;
        imageUrl?: string | null;
        supplements?: { name: string; priceHt: number; maxQty: number }[] | null;
      };

      const product = await fastify.prisma.product.create({
        data: {
          tenantId: request.user.tenantId,
          name: body.name,
          priceHt: body.priceHt,
          vatRate: body.vatRate ?? 10.0,
          categoryId: body.categoryId ?? null,
          imageUrl: body.imageUrl ?? null,
          supplements: body.supplements ?? undefined,
        },
        include: { category: { select: { id: true, name: true, color: true } } },
      });

      await fastify.prisma.auditLog.create({
        data: {
          tenantId: request.user.tenantId,
          userId: request.user.userId,
          action: 'product.create',
          details: { productId: product.id, name: product.name },
        },
      });

      return reply.status(201).send(product);
    },
  );

  // PUT /products/:id
  fastify.put(
    '/products/:id',
    { preHandler: rbac(['OWNER', 'MANAGER']) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const existing = await fastify.prisma.product.findFirst({
        where: { id, tenantId: request.user.tenantId },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Produit non trouvé', code: 'NOT_FOUND' });
      }

      const product = await fastify.prisma.product.update({
        where: { id },
        data: body,
        include: { category: { select: { id: true, name: true, color: true } } },
      });

      await fastify.prisma.auditLog.create({
        data: {
          tenantId: request.user.tenantId,
          userId: request.user.userId,
          action: 'product.update',
          details: { productId: product.id },
        },
      });

      return reply.send(product);
    },
  );

  // DELETE /products/:id (soft delete)
  fastify.delete(
    '/products/:id',
    { preHandler: rbac(['OWNER', 'MANAGER']) },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await fastify.prisma.product.findFirst({
        where: { id, tenantId: request.user.tenantId },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Produit non trouvé', code: 'NOT_FOUND' });
      }

      await fastify.prisma.product.update({
        where: { id },
        data: { active: false },
      });

      await fastify.prisma.auditLog.create({
        data: {
          tenantId: request.user.tenantId,
          userId: request.user.userId,
          action: 'product.delete',
          details: { productId: id },
        },
      });

      return reply.status(204).send();
    },
  );
}
