import type { PrismaClient } from '@prisma/client';

interface TicketExportRow {
  sequenceNumber: number;
  date: string;
  serviceMode: string;
  totalHt: number;
  totalTtc: number;
  vatDetails: string;
  payments: string;
  isExpenseNote: boolean;
  isCancellation: boolean;
  cancelledRef: string | null;
  hash: string;
  prevHash: string;
  signature: string;
}

/**
 * Exporte le Journal des Données de Caisse (JDC) pour une période donnée.
 * Format : JSON ou CSV (tableau de tickets avec toutes les données ISCA).
 */
export async function exportJDC(
  prisma: PrismaClient,
  tenantId: string,
  startDate: Date,
  endDate: Date,
  format: 'json' | 'csv' = 'json',
): Promise<string> {
  const tickets = await prisma.ticket.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate, lt: endDate },
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  const rows: TicketExportRow[] = tickets.map((t) => ({
    sequenceNumber: t.sequenceNumber,
    date: t.createdAt.toISOString(),
    serviceMode: t.serviceMode,
    totalHt: t.totalHt,
    totalTtc: t.totalTtc,
    vatDetails: JSON.stringify(t.vatDetails),
    payments: JSON.stringify(t.payments),
    isExpenseNote: t.isExpenseNote,
    isCancellation: t.isCancellation,
    cancelledRef: t.cancelledRef,
    hash: t.hash,
    prevHash: t.prevHash,
    signature: t.signature,
  }));

  if (format === 'csv') {
    return toCsv(rows);
  }

  return JSON.stringify(rows, null, 2);
}

function toCsv(rows: TicketExportRow[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]) as (keyof TicketExportRow)[];
  const headerLine = headers.join(';');
  const dataLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        const str = String(val ?? '');
        // Escape semicolons and quotes in CSV
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(';'),
  );

  return [headerLine, ...dataLines].join('\n');
}
