import type { FastifyInstance } from 'fastify';
import { createTicket } from '../services/ticket.service.js';
import { generateClientPdf, generateKitchenPdf } from '../services/print.service.js';

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
    const query = request.query as {
      limit?: string;
      offset?: string;
      search?: string;
      from?: string;
      to?: string;
    };
    const limit = Math.min(parseInt(query.limit ?? '50', 10), 100);
    const offset = parseInt(query.offset ?? '0', 10);

    const where: Record<string, unknown> = { tenantId: request.user.tenantId };

    if (query.search) {
      const seq = parseInt(query.search, 10);
      if (!isNaN(seq)) {
        where.sequenceNumber = seq;
      }
    }

    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.gte = new Date(query.from);
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setDate(toDate.getDate() + 1);
        createdAt.lt = toDate;
      }
      where.createdAt = createdAt;
    }

    const [tickets, total] = await Promise.all([
      fastify.prisma.ticket.findMany({
        where,
        orderBy: { sequenceNumber: 'desc' },
        take: limit,
        skip: offset,
      }),
      fastify.prisma.ticket.count({ where }),
    ]);

    return reply.send({ tickets, total });
  });

  // GET /tickets/export — Export CSV des tickets (MUST be before :id route)
  fastify.get('/tickets/export', async (request, reply) => {
    const query = request.query as { from?: string; to?: string; format?: string };

    if (query.format !== 'csv') {
      return reply.status(400).send({ error: 'Format non supporté. Utilisez format=csv', code: 'BAD_FORMAT' });
    }

    const where: Record<string, unknown> = { tenantId: request.user.tenantId };
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.gte = new Date(query.from);
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setDate(toDate.getDate() + 1);
        createdAt.lt = toDate;
      }
      where.createdAt = createdAt;
    }

    const tickets = await fastify.prisma.ticket.findMany({
      where,
      orderBy: { sequenceNumber: 'asc' },
    });

    const header = 'date,numero,mode,totalHt,totalTtc,tva5_5,tva10,tva20,paiement,annule,motif';
    const rows = tickets.map((t) => {
      const date = new Date(t.createdAt).toISOString().split('T')[0];
      const vatDetails = t.vatDetails as { rate: number; amount: number }[];
      const tva55 = vatDetails.find((v) => v.rate === 5.5)?.amount ?? 0;
      const tva10 = vatDetails.find((v) => v.rate === 10)?.amount ?? 0;
      const tva20 = vatDetails.find((v) => v.rate === 20)?.amount ?? 0;
      const payments = (t.payments as { method: string; amount: number }[])
        .map((p) => `${p.method}:${p.amount}`)
        .join('+');
      const annule = t.cancelled ? 'oui' : 'non';
      const motif = t.cancellationReason ? `"${t.cancellationReason.replace(/"/g, '""')}"` : '';

      return `${date},${t.sequenceNumber},${t.serviceMode},${t.totalHt},${t.totalTtc},${tva55},${tva10},${tva20},${payments},${annule},${motif}`;
    });

    const csv = [header, ...rows].join('\n');
    const from = query.from ?? 'all';
    const to = query.to ?? 'all';

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="tickets-${from}-${to}.csv"`)
      .send(csv);
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

  // POST /tickets/:id/print — Génère un PDF ticket client
  fastify.post('/tickets/:id/print', async (request, reply) => {
    const { id } = request.params as { id: string };

    const ticket = await fastify.prisma.ticket.findFirst({
      where: { id, tenantId: request.user.tenantId },
    });

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket non trouvé', code: 'NOT_FOUND' });
    }

    const tenant = await fastify.prisma.tenant.findUniqueOrThrow({
      where: { id: request.user.tenantId },
      select: { name: true, address: true, siret: true, vatNumber: true, phone: true },
    });

    const pdfBuffer = await generateClientPdf(ticket, tenant);

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="ticket-${ticket.sequenceNumber}.pdf"`)
      .send(pdfBuffer);
  });

  // POST /tickets/:id/print-kitchen — Génère un PDF ticket cuisine
  fastify.post('/tickets/:id/print-kitchen', async (request, reply) => {
    const { id } = request.params as { id: string };

    const ticket = await fastify.prisma.ticket.findFirst({
      where: { id, tenantId: request.user.tenantId },
    });

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket non trouvé', code: 'NOT_FOUND' });
    }

    const pdfBuffer = await generateKitchenPdf(ticket);

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="cuisine-${ticket.sequenceNumber}.pdf"`)
      .send(pdfBuffer);
  });

  // POST /tickets/:id/cancel — Annulation d'un ticket (ISCA compliant)
  fastify.post('/tickets/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reason: string } | null;

    if (!body?.reason || body.reason.trim().length === 0) {
      return reply.status(400).send({ error: 'Le motif d\'annulation est requis', code: 'MISSING_REASON' });
    }

    const reason = body.reason.trim();

    try {
      const original = await fastify.prisma.ticket.findFirst({
        where: { id, tenantId: request.user.tenantId },
      });

      if (!original) {
        return reply.status(404).send({ error: 'Ticket non trouvé', code: 'NOT_FOUND' });
      }

      if (original.cancelled) {
        return reply.status(409).send({ error: 'Ce ticket est déjà annulé', code: 'ALREADY_CANCELLED' });
      }

      if (original.isCancellation) {
        return reply.status(400).send({ error: 'Impossible d\'annuler un ticket d\'annulation', code: 'CANCEL_CANCEL' });
      }

      // Create cancellation ticket with negative items (ISCA: new ticket, never delete)
      const items = (original.items as { name: string; qty: number; priceHt: number; vatRate: number; supplements?: { name: string; priceHt: number; qty: number }[] }[]).map((item) => ({
        ...item,
        priceHt: -item.priceHt,
        supplements: item.supplements?.map((s) => ({ ...s, priceHt: -s.priceHt })),
      }));

      const payments = (original.payments as { method: string; amount: number }[]).map((p) => ({
        method: p.method as 'cash' | 'card' | 'meal_voucher' | 'check',
        amount: -p.amount,
      }));

      const cancellationTicket = await createTicket(fastify.prisma, {
        tenantId: request.user.tenantId,
        serviceMode: original.serviceMode,
        items,
        payments,
        isCancellation: true,
        cancelledRef: original.id,
        userId: request.user.userId,
      });

      // Mark original ticket as cancelled
      await fastify.prisma.ticket.update({
        where: { id: original.id },
        data: {
          cancelled: true,
          cancelledTicketId: cancellationTicket.id,
          cancellationReason: reason,
        },
      });

      return reply.status(201).send(cancellationTicket);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'annulation';
      return reply.status(400).send({ error: message, code: 'CANCEL_ERROR' });
    }
  });
}
