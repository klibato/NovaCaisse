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
      optionGroups: {
        type: 'array' as const,
        nullable: true,
        items: {
          type: 'object' as const,
          required: ['name'],
          properties: {
            name: { type: 'string' as const },
            required: { type: 'boolean' as const },
            multiple: { type: 'boolean' as const },
            maxChoices: { type: 'integer' as const, minimum: 1 },
            position: { type: 'integer' as const },
            choices: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                required: ['name'],
                properties: {
                  name: { type: 'string' as const },
                  priceHt: { type: 'integer' as const, minimum: 0 },
                  position: { type: 'integer' as const },
                },
              },
            },
          },
        },
      },
    },
  },
};

interface OptionChoiceInput {
  name: string;
  priceHt?: number;
  position?: number;
}

interface OptionGroupInput {
  name: string;
  required?: boolean;
  multiple?: boolean;
  maxChoices?: number;
  position?: number;
  choices?: OptionChoiceInput[];
}

const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true, color: true } },
  optionGroups: {
    orderBy: { position: 'asc' as const },
    include: {
      choices: {
        orderBy: { position: 'asc' as const },
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
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(products);
  });

  // GET /products/:id
  fastify.get('/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await fastify.prisma.product.findFirst({
      where: { id, tenantId: request.user.tenantId },
      include: PRODUCT_INCLUDE,
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
        optionGroups?: OptionGroupInput[] | null;
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
          optionGroups: body.optionGroups
            ? {
                create: body.optionGroups.map((g, gi) => ({
                  tenantId: request.user.tenantId,
                  name: g.name,
                  required: g.required ?? true,
                  multiple: g.multiple ?? false,
                  maxChoices: g.maxChoices ?? 1,
                  position: g.position ?? gi,
                  choices: {
                    create: (g.choices ?? []).map((c, ci) => ({
                      name: c.name,
                      priceHt: c.priceHt ?? 0,
                      position: c.position ?? ci,
                    })),
                  },
                })),
              }
            : undefined,
        },
        include: PRODUCT_INCLUDE,
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
      const body = request.body as {
        name?: string;
        priceHt?: number;
        vatRate?: number;
        categoryId?: string | null;
        imageUrl?: string | null;
        supplements?: { name: string; priceHt: number; maxQty: number }[] | null;
        optionGroups?: OptionGroupInput[] | null;
      };

      const existing = await fastify.prisma.product.findFirst({
        where: { id, tenantId: request.user.tenantId },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Produit non trouvé', code: 'NOT_FOUND' });
      }

      // If optionGroups provided, replace all (delete old, create new)
      if (body.optionGroups !== undefined) {
        await fastify.prisma.optionGroup.deleteMany({
          where: { productId: id },
        });

        if (body.optionGroups && body.optionGroups.length > 0) {
          for (let gi = 0; gi < body.optionGroups.length; gi++) {
            const g = body.optionGroups[gi];
            await fastify.prisma.optionGroup.create({
              data: {
                tenantId: request.user.tenantId,
                productId: id,
                name: g.name,
                required: g.required ?? true,
                multiple: g.multiple ?? false,
                maxChoices: g.maxChoices ?? 1,
                position: g.position ?? gi,
                choices: {
                  create: (g.choices ?? []).map((c, ci) => ({
                    name: c.name,
                    priceHt: c.priceHt ?? 0,
                    position: c.position ?? ci,
                  })),
                },
              },
            });
          }
        }
      }

      const product = await fastify.prisma.product.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.priceHt !== undefined && { priceHt: body.priceHt }),
          ...(body.vatRate !== undefined && { vatRate: body.vatRate }),
          ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
          ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
          ...(body.supplements !== undefined && { supplements: body.supplements ?? undefined }),
        },
        include: PRODUCT_INCLUDE,
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

  // DELETE /products/:id (hard delete)
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

      await fastify.prisma.$transaction(async (tx) => {
        await tx.menuItem.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
      });

      await fastify.prisma.auditLog.create({
        data: {
          tenantId: request.user.tenantId,
          userId: request.user.userId,
          action: 'product.delete',
          details: { productId: id, name: existing.name },
        },
      });

      return reply.status(204).send();
    },
  );

  // PATCH /products/:id/toggle
  fastify.patch(
    '/products/:id/toggle',
    { preHandler: rbac(['OWNER', 'MANAGER']) },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await fastify.prisma.product.findFirst({
        where: { id, tenantId: request.user.tenantId },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Produit non trouvé', code: 'NOT_FOUND' });
      }

      const product = await fastify.prisma.product.update({
        where: { id },
        data: { active: !existing.active },
        include: PRODUCT_INCLUDE,
      });

      await fastify.prisma.auditLog.create({
        data: {
          tenantId: request.user.tenantId,
          userId: request.user.userId,
          action: 'product.toggle',
          details: { productId: id, active: product.active },
        },
      });

      return reply.send(product);
    },
  );
}
