import type { FastifyInstance } from 'fastify';
import { rbac } from '../hooks/rbac.hook.js';

const menuSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'priceHt'],
    properties: {
      name: { type: 'string' as const, minLength: 1 },
      priceHt: { type: 'integer' as const, minimum: 0 },
      vatRateOnsite: { type: 'number' as const, default: 10.0 },
      vatRateTakeaway: { type: 'number' as const, default: 5.5 },
      categoryId: { type: 'string' as const, nullable: true },
      imageUrl: { type: 'string' as const, nullable: true },
      items: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          required: ['productId'],
          properties: {
            productId: { type: 'string' as const },
            isChoice: { type: 'boolean' as const, default: false },
            choiceGroup: { type: 'string' as const, nullable: true },
            position: { type: 'integer' as const, minimum: 0 },
          },
        },
      },
    },
  },
};

export default async function menuRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /menus
  fastify.get('/menus', async (request, reply) => {
    const query = request.query as { includeInactive?: string };
    const whereClause: Record<string, unknown> = {
      tenantId: request.user.tenantId,
    };
    if (query.includeInactive !== 'true') {
      whereClause.active = true;
    }

    const menus = await fastify.prisma.menu.findMany({
      where: whereClause,
      include: {
        items: {
          include: { product: { select: { id: true, name: true, priceHt: true } } },
          orderBy: { position: 'asc' },
        },
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(menus);
  });

  // GET /menus/:id
  fastify.get('/menus/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const menu = await fastify.prisma.menu.findFirst({
      where: { id, tenantId: request.user.tenantId },
      include: {
        items: {
          include: { product: true },
          orderBy: { position: 'asc' },
        },
        category: { select: { id: true, name: true, color: true } },
      },
    });

    if (!menu) {
      return reply.status(404).send({ error: 'Menu non trouvé', code: 'NOT_FOUND' });
    }

    return reply.send(menu);
  });

  // POST /menus
  fastify.post(
    '/menus',
    { schema: menuSchema, preHandler: rbac(['OWNER', 'MANAGER']) },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        priceHt: number;
        vatRateOnsite?: number;
        vatRateTakeaway?: number;
        categoryId?: string | null;
        imageUrl?: string | null;
        items?: {
          productId: string;
          isChoice?: boolean;
          choiceGroup?: string | null;
          position?: number;
        }[];
      };

      const menu = await fastify.prisma.menu.create({
        data: {
          tenantId: request.user.tenantId,
          name: body.name,
          priceHt: body.priceHt,
          vatRateOnsite: body.vatRateOnsite ?? 10.0,
          vatRateTakeaway: body.vatRateTakeaway ?? 5.5,
          categoryId: body.categoryId ?? null,
          imageUrl: body.imageUrl ?? null,
          items: body.items
            ? {
                create: body.items.map((item, idx) => ({
                  productId: item.productId,
                  isChoice: item.isChoice ?? false,
                  choiceGroup: item.choiceGroup ?? null,
                  position: item.position ?? idx,
                })),
              }
            : undefined,
        },
        include: {
          items: {
            include: { product: { select: { id: true, name: true, priceHt: true } } },
            orderBy: { position: 'asc' },
          },
          category: { select: { id: true, name: true, color: true } },
        },
      });

      return reply.status(201).send(menu);
    },
  );

  // PUT /menus/:id
  fastify.put(
    '/menus/:id',
    { preHandler: rbac(['OWNER', 'MANAGER']) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        priceHt?: number;
        vatRateOnsite?: number;
        vatRateTakeaway?: number;
        categoryId?: string | null;
        imageUrl?: string | null;
        items?: {
          productId: string;
          isChoice?: boolean;
          choiceGroup?: string | null;
          position?: number;
        }[];
      };

      const existing = await fastify.prisma.menu.findFirst({
        where: { id, tenantId: request.user.tenantId },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Menu non trouvé', code: 'NOT_FOUND' });
      }

      // Si items fournis, on supprime les anciens et recrée
      const { items, ...menuData } = body;

      const menu = await fastify.prisma.$transaction(async (tx) => {
        if (items) {
          await tx.menuItem.deleteMany({ where: { menuId: id } });
          await tx.menuItem.createMany({
            data: items.map((item, idx) => ({
              menuId: id,
              productId: item.productId,
              isChoice: item.isChoice ?? false,
              choiceGroup: item.choiceGroup ?? null,
              position: item.position ?? idx,
            })),
          });
        }

        return tx.menu.update({
          where: { id },
          data: menuData,
          include: {
            items: {
              include: { product: { select: { id: true, name: true, priceHt: true } } },
              orderBy: { position: 'asc' },
            },
            category: { select: { id: true, name: true, color: true } },
          },
        });
      });

      return reply.send(menu);
    },
  );

  // DELETE /menus/:id (soft delete)
  fastify.delete(
    '/menus/:id',
    { preHandler: rbac(['OWNER', 'MANAGER']) },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await fastify.prisma.menu.findFirst({
        where: { id, tenantId: request.user.tenantId },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Menu non trouvé', code: 'NOT_FOUND' });
      }

      await fastify.prisma.menu.update({
        where: { id },
        data: { active: false },
      });

      return reply.status(204).send();
    },
  );
}
