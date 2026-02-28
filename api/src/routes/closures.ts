import type { FastifyInstance } from 'fastify';
import { generateClosure } from '../isca/closure.js';

export default async function closureRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /closures/daily — Clôture journalière
  fastify.post('/closures/daily', async (request, reply) => {
    const body = request.body as { date?: string } | null;
    const targetDate = body?.date ? new Date(body.date) : new Date();

    try {
      // Vérifier qu'une clôture n'existe pas déjà
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const existing = await fastify.prisma.closure.findUnique({
        where: {
          tenantId_type_date: {
            tenantId: request.user.tenantId,
            type: 'DAILY',
            date: startOfDay,
          },
        },
      });

      if (existing) {
        return reply.status(409).send({
          error: 'Une clôture journalière existe déjà pour cette date',
          code: 'CLOSURE_EXISTS',
        });
      }

      const result = await generateClosure(
        fastify.prisma,
        request.user.tenantId,
        'DAILY',
        targetDate,
      );

      return reply.status(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur clôture';
      return reply.status(400).send({ error: message, code: 'CLOSURE_ERROR' });
    }
  });

  // POST /closures/monthly — Clôture mensuelle
  fastify.post('/closures/monthly', async (request, reply) => {
    const body = request.body as { date?: string } | null;
    const targetDate = body?.date ? new Date(body.date) : new Date();

    try {
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const existing = await fastify.prisma.closure.findUnique({
        where: {
          tenantId_type_date: {
            tenantId: request.user.tenantId,
            type: 'MONTHLY',
            date: startOfMonth,
          },
        },
      });

      if (existing) {
        return reply.status(409).send({
          error: 'Une clôture mensuelle existe déjà pour ce mois',
          code: 'CLOSURE_EXISTS',
        });
      }

      const result = await generateClosure(
        fastify.prisma,
        request.user.tenantId,
        'MONTHLY',
        targetDate,
      );

      return reply.status(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur clôture';
      return reply.status(400).send({ error: message, code: 'CLOSURE_ERROR' });
    }
  });

  // GET /closures — Liste paginée
  fastify.get('/closures', async (request, reply) => {
    const query = request.query as { limit?: string; offset?: string; type?: string };
    const limit = Math.min(parseInt(query.limit ?? '50', 10), 100);
    const offset = parseInt(query.offset ?? '0', 10);

    const where: Record<string, unknown> = { tenantId: request.user.tenantId };
    if (query.type && ['DAILY', 'MONTHLY', 'YEARLY'].includes(query.type)) {
      where.type = query.type;
    }

    const [closures, total] = await Promise.all([
      fastify.prisma.closure.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      fastify.prisma.closure.count({ where }),
    ]);

    return reply.send({ closures, total });
  });

  // GET /closures/:id — Détail
  fastify.get('/closures/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const closure = await fastify.prisma.closure.findFirst({
      where: { id, tenantId: request.user.tenantId },
    });

    if (!closure) {
      return reply.status(404).send({ error: 'Clôture non trouvée', code: 'NOT_FOUND' });
    }

    return reply.send(closure);
  });
}
