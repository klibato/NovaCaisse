import type { FastifyInstance } from 'fastify';

interface TicketItem {
  name: string;
  qty: number;
  priceHt: number;
  vatRate: number;
  supplements?: { name: string; priceHt: number; qty: number }[];
}

interface PaymentDetail {
  method: string;
  amount: number;
}

type Period = 'today' | 'week' | 'month' | 'year';

function getDateRange(period: Period, now: Date): { start: Date; end: Date } {
  const d = new Date(now);
  switch (period) {
    case 'today': {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      return { start, end };
    }
    case 'week': {
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1; // lundi = 0
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      return { start, end };
    }
    case 'month': {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      return { start, end };
    }
    case 'year': {
      const start = new Date(d.getFullYear(), 0, 1);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      return { start, end };
    }
  }
}

function getPrevDateRange(period: Period, now: Date): { start: Date; end: Date } {
  const d = new Date(now);
  switch (period) {
    case 'today': {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return { start, end };
    }
    case 'week': {
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const thisWeekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek);
      const start = new Date(thisWeekStart.getTime() - 7 * 86400000);
      const end = new Date(thisWeekStart.getTime());
      return { start, end };
    }
    case 'month': {
      const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const end = new Date(d.getFullYear(), d.getMonth(), 1);
      return { start, end };
    }
    case 'year': {
      const start = new Date(d.getFullYear() - 1, 0, 1);
      const end = new Date(d.getFullYear(), 0, 1);
      return { start, end };
    }
  }
}

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /dashboard/stats?period=today|week|month|year
  fastify.get('/dashboard/stats', async (request, reply) => {
    const query = request.query as { period?: string };
    const period = (['today', 'week', 'month', 'year'].includes(query.period ?? '')
      ? query.period
      : 'today') as Period;

    const now = new Date();
    const { start, end } = getDateRange(period, now);
    const prev = getPrevDateRange(period, now);

    const tenantId = request.user.tenantId;

    // Fetch current period tickets
    const tickets = await fastify.prisma.ticket.findMany({
      where: { tenantId, createdAt: { gte: start, lt: end } },
      select: {
        totalHt: true,
        totalTtc: true,
        items: true,
        payments: true,
        createdAt: true,
      },
    });

    // Fetch previous period tickets (for comparison)
    const prevTickets = await fastify.prisma.ticket.findMany({
      where: { tenantId, createdAt: { gte: prev.start, lt: prev.end } },
      select: { totalTtc: true },
    });

    // Aggregate current period
    let caHt = 0;
    let caTtc = 0;
    const productCounts = new Map<string, number>();
    const paymentTotals = new Map<string, number>();
    const dailyCA = new Map<string, number>();

    for (const ticket of tickets) {
      caHt += ticket.totalHt;
      caTtc += ticket.totalTtc;

      // Top produits
      const items = ticket.items as unknown as TicketItem[];
      for (const item of items) {
        productCounts.set(item.name, (productCounts.get(item.name) ?? 0) + item.qty);
      }

      // Ventilation paiements
      const payments = ticket.payments as unknown as PaymentDetail[];
      for (const p of payments) {
        paymentTotals.set(p.method, (paymentTotals.get(p.method) ?? 0) + p.amount);
      }

      // CA par jour
      const dayKey = ticket.createdAt.toISOString().split('T')[0];
      dailyCA.set(dayKey, (dailyCA.get(dayKey) ?? 0) + ticket.totalTtc);
    }

    const nombreTickets = tickets.length;
    const panierMoyen = nombreTickets > 0 ? Math.round(caTtc / nombreTickets) : 0;

    // Top 5 produits
    const topProduits = Array.from(productCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    // Ventilation paiements
    const ventilationPaiements = Array.from(paymentTotals.entries())
      .map(([method, amount]) => ({ method, amount }));

    // Comparaison avec la période précédente
    const prevCaTtc = prevTickets.reduce((s, t) => s + t.totalTtc, 0);
    const comparaison = prevCaTtc > 0
      ? Math.round(((caTtc - prevCaTtc) / prevCaTtc) * 10000) / 100
      : caTtc > 0 ? 100 : 0;

    // CA par jour (trié)
    const caParJour = Array.from(dailyCA.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({ date, total }));

    return reply.send({
      caHt,
      caTtc,
      nombreTickets,
      panierMoyen,
      topProduits,
      ventilationPaiements,
      comparaison,
      caParJour,
    });
  });
}
