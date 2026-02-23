import { createHash } from 'crypto';
import type { PrismaClient, ClosureType } from '@prisma/client';

interface VatDetail {
  rate: number;
  baseHt: number;
  amount: number;
}

interface PaymentDetail {
  method: string;
  amount: number;
}

interface ClosureTotals {
  totalHt: number;
  totalTtc: number;
  vatDetails: VatDetail[];
  ticketCount: number;
  paymentBreakdown: PaymentDetail[];
}

/**
 * Génère une clôture Z (journalière, mensuelle ou annuelle).
 * Somme tous les tickets de la période pour le tenant.
 */
export async function generateClosure(
  prisma: PrismaClient,
  tenantId: string,
  type: ClosureType,
  date: Date,
): Promise<{ id: string; totals: ClosureTotals; hash: string }> {
  const { startDate, endDate } = getDateRange(type, date);

  const tickets = await prisma.ticket.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate, lt: endDate },
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  // Agréger les totaux
  const vatMap = new Map<number, { baseHt: number; amount: number }>();
  const paymentMap = new Map<string, number>();
  let totalHt = 0;
  let totalTtc = 0;

  for (const ticket of tickets) {
    totalHt += ticket.totalHt;
    totalTtc += ticket.totalTtc;

    // Agréger TVA
    const vatDetails = ticket.vatDetails as VatDetail[];
    for (const vat of vatDetails) {
      const existing = vatMap.get(vat.rate) ?? { baseHt: 0, amount: 0 };
      existing.baseHt += vat.baseHt;
      existing.amount += vat.amount;
      vatMap.set(vat.rate, existing);
    }

    // Agréger paiements
    const payments = ticket.payments as PaymentDetail[];
    for (const payment of payments) {
      const existing = paymentMap.get(payment.method) ?? 0;
      paymentMap.set(payment.method, existing + payment.amount);
    }
  }

  const totals: ClosureTotals = {
    totalHt,
    totalTtc,
    vatDetails: Array.from(vatMap.entries()).map(([rate, data]) => ({
      rate,
      baseHt: data.baseHt,
      amount: data.amount,
    })),
    ticketCount: tickets.length,
    paymentBreakdown: Array.from(paymentMap.entries()).map(([method, amount]) => ({
      method,
      amount,
    })),
  };

  const hash = createHash('sha256')
    .update(JSON.stringify({ tenantId, type, date: startDate.toISOString(), totals }))
    .digest('hex');

  const closure = await prisma.closure.create({
    data: {
      tenantId,
      type,
      date: startDate,
      totals: totals as unknown as Record<string, unknown>,
      hash,
    },
  });

  return { id: closure.id, totals, hash };
}

function getDateRange(type: ClosureType, date: Date): { startDate: Date; endDate: Date } {
  const d = new Date(date);

  switch (type) {
    case 'DAILY': {
      const startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endDate = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      return { startDate, endDate };
    }
    case 'MONTHLY': {
      const startDate = new Date(d.getFullYear(), d.getMonth(), 1);
      const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      return { startDate, endDate };
    }
    case 'YEARLY': {
      const startDate = new Date(d.getFullYear(), 0, 1);
      const endDate = new Date(d.getFullYear() + 1, 0, 1);
      return { startDate, endDate };
    }
  }
}
