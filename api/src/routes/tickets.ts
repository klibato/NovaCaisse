import type { FastifyInstance } from 'fastify';
import { createTicket } from '../services/ticket.service.js';

const createTicketSchema = {
  body: {
    type: 'object' as const,
    required: ['serviceMode', 'items', 'payments'],
    properties: {
      serviceMode: { type: 'string' as const, enum: ['ONSITE', 'TAKEAWAY'] },
      items: {
        type: 'array' as const,
        minItems: 1,
        items: {
          type: 'object' as const,
          required: ['name', 'qty', 'priceHt', 'vatRate'],
          properties: {
            name: { type: 'string' as const },
            qty: { type: 'integer' as const, minimum: 1 },
            priceHt: { type: 'integer' as const, minimum: 0 },
            vatRate: { type: 'number' as const },
            supplements: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                required: ['name', 'priceHt', 'qty'],
                properties: {
                  name: { type: 'string' as const },
                  priceHt: { type: 'integer' as const, minimum: 0 },
                  qty: { type: 'integer' as const, minimum: 1 },
                },
              },
            },
          },
        },
      },
      payments: {
        type: 'array' as const,
        minItems: 1,
        items: {
          type: 'object' as const,
          required: ['method', 'amount'],
          properties: {
            method: {
              type: 'string' as const,
              enum: ['cash', 'card', 'meal_voucher', 'check'],
            },
            amount: { type: 'integer' as const, minimum: 0 },
          },
        },
      },
      isExpenseNote: { type: 'boolean' as const },
      isCancellation: { type: 'boolean' as const },
      cancelledRef: { type: 'string' as const },
    },
  },
};

export default async function ticketRoutes(fastify: FastifyInstance) {
  // Toutes les routes tickets nécessitent l'authentification
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /tickets
  fastify.post('/tickets', { schema: createTicketSchema }, async (request, reply) => {
    const body = request.body as {
      serviceMode: 'ONSITE' | 'TAKEAWAY';
      items: {
        name: string;
        qty: number;
        priceHt: number;
        vatRate: number;
        supplements?: { name: string; priceHt: number; qty: number }[];
      }[];
      payments: { method: 'cash' | 'card' | 'meal_voucher' | 'check'; amount: number }[];
      isExpenseNote?: boolean;
      isCancellation?: boolean;
      cancelledRef?: string;
    };

    try {
      const ticket = await createTicket(fastify.prisma, {
        tenantId: request.user.tenantId,
        serviceMode: body.serviceMode,
        items: body.items,
        payments: body.payments,
        isExpenseNote: body.isExpenseNote,
        isCancellation: body.isCancellation,
        cancelledRef: body.cancelledRef,
        userId: request.user.userId,
      });

      return reply.status(201).send(ticket);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur interne';
      return reply.status(400).send({ error: message, code: 'TICKET_ERROR' });
    }
  });

  // GET /tickets
  fastify.get('/tickets', async (request, reply) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit ?? '50', 10), 100);
    const offset = parseInt(query.offset ?? '0', 10);

    const tickets = await fastify.prisma.ticket.findMany({
      where: { tenantId: request.user.tenantId },
      orderBy: { sequenceNumber: 'desc' },
      take: limit,
      skip: offset,
    });

    return reply.send(tickets);
  });

  // GET /tickets/:id
  fastify.get('/tickets/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const ticket = await fastify.prisma.ticket.findFirst({
      where: { id, tenantId: request.user.tenantId },
    });

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket non trouvé', code: 'NOT_FOUND' });
    }

    return reply.send(ticket);
  });
}
