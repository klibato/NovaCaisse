import type { PrismaClient, ServiceMode } from '@prisma/client';
import { computeHash, GENESIS_HASH, type ChainInput } from '../isca/chain.js';
import { signTicket } from '../isca/signature.js';
import { computeTtc, computeVatAmount } from '../lib/utils.js';

interface TicketItem {
  name: string;
  qty: number;
  priceHt: number;
  vatRate: number;
  supplements?: { name: string; priceHt: number; qty: number }[];
}

interface Payment {
  method: 'cash' | 'card' | 'meal_voucher' | 'check';
  amount: number;
}

interface CreateTicketInput {
  tenantId: string;
  serviceMode: ServiceMode;
  items: TicketItem[];
  payments: Payment[];
  isExpenseNote?: boolean;
  isCancellation?: boolean;
  cancelledRef?: string;
  userId?: string;
}

interface VatDetail {
  rate: number;
  baseHt: number;
  amount: number;
}

export interface CreatedTicket {
  id: string;
  sequenceNumber: number;
  serviceMode: ServiceMode;
  items: TicketItem[];
  totalHt: number;
  totalTtc: number;
  vatDetails: VatDetail[];
  payments: Payment[];
  hash: string;
  prevHash: string;
  signature: string;
  createdAt: Date;
}

/**
 * Crée un ticket dans une transaction atomique PostgreSQL.
 * 1. Verrouille le dernier ticket du tenant (SELECT FOR UPDATE)
 * 2. Calcule sequenceNumber = last + 1
 * 3. Calcule les totaux HT/TTC/TVA
 * 4. Chaîne le hash SHA-256 avec le ticket précédent
 * 5. Signe avec HMAC-SHA256
 * 6. INSERT ticket + audit_log
 */
export async function createTicket(
  prisma: PrismaClient,
  input: CreateTicketInput,
): Promise<CreatedTicket> {
  return prisma.$transaction(async (tx) => {
    // 1. Récupérer le tenant (pour le secret HMAC)
    const tenant = await tx.tenant.findUniqueOrThrow({
      where: { id: input.tenantId },
      select: { tenantSecret: true },
    });

    // 2. Verrouiller et récupérer le dernier ticket via raw query
    const lastTickets = await tx.$queryRaw<
      { sequenceNumber: number; hash: string }[]
    >`
      SELECT "sequenceNumber", "hash"
      FROM "Ticket"
      WHERE "tenantId" = ${input.tenantId}
      ORDER BY "sequenceNumber" DESC
      LIMIT 1
      FOR UPDATE
    `;

    const lastTicket = lastTickets[0] ?? null;
    const sequenceNumber = lastTicket ? lastTicket.sequenceNumber + 1 : 1;
    const prevHash = lastTicket ? lastTicket.hash : GENESIS_HASH;

    // 3. Calculer les totaux
    const { totalHt, totalTtc, vatDetails } = computeTotals(input.items);

    // 4. Vérifier que les paiements couvrent le total TTC
    const totalPayments = input.payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPayments !== totalTtc) {
      throw new Error(
        `Total paiements (${totalPayments}) != total TTC (${totalTtc})`,
      );
    }

    // 5. Calculer le hash et la signature
    const now = new Date();
    const chainInput: ChainInput = {
      tenantId: input.tenantId,
      sequenceNumber,
      serviceMode: input.serviceMode,
      items: input.items,
      totalHt,
      totalTtc,
      vatDetails,
      payments: input.payments,
      isExpenseNote: input.isExpenseNote ?? false,
      isCancellation: input.isCancellation ?? false,
      cancelledRef: input.cancelledRef ?? null,
      createdAt: now.toISOString(),
    };

    const hash = computeHash(chainInput, prevHash);
    const signature = signTicket(hash, tenant.tenantSecret);

    // 6. Insérer le ticket
    const ticket = await tx.ticket.create({
      data: {
        tenantId: input.tenantId,
        sequenceNumber,
        serviceMode: input.serviceMode,
        items: input.items as unknown as Record<string, unknown>[],
        totalHt,
        totalTtc,
        vatDetails: vatDetails as unknown as Record<string, unknown>[],
        payments: input.payments as unknown as Record<string, unknown>[],
        isExpenseNote: input.isExpenseNote ?? false,
        isCancellation: input.isCancellation ?? false,
        cancelledRef: input.cancelledRef ?? null,
        hash,
        prevHash,
        signature,
        userId: input.userId ?? null,
        createdAt: now,
      },
    });

    // 7. Audit log
    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        action: 'ticket.create',
        details: {
          sequenceNumber,
          totalTtc,
          serviceMode: input.serviceMode,
          isCancellation: input.isCancellation ?? false,
        },
      },
    });

    return {
      id: ticket.id,
      sequenceNumber: ticket.sequenceNumber,
      serviceMode: ticket.serviceMode,
      items: input.items,
      totalHt,
      totalTtc,
      vatDetails,
      payments: input.payments,
      hash: ticket.hash,
      prevHash: ticket.prevHash,
      signature: ticket.signature,
      createdAt: ticket.createdAt,
    };
  });
}

/**
 * Calcule les totaux HT, TTC et la ventilation TVA à partir des items.
 */
function computeTotals(items: TicketItem[]): {
  totalHt: number;
  totalTtc: number;
  vatDetails: VatDetail[];
} {
  const vatMap = new Map<number, { baseHt: number; amount: number }>();
  let totalHt = 0;

  for (const item of items) {
    // Prix de base * quantité
    let itemHt = item.priceHt * item.qty;

    // Ajouter les suppléments
    if (item.supplements) {
      for (const supp of item.supplements) {
        itemHt += supp.priceHt * supp.qty * item.qty;
      }
    }

    totalHt += itemHt;

    // Agréger par taux de TVA
    const existing = vatMap.get(item.vatRate) ?? { baseHt: 0, amount: 0 };
    existing.baseHt += itemHt;
    existing.amount += computeVatAmount(itemHt, item.vatRate);
    vatMap.set(item.vatRate, existing);
  }

  const vatDetails: VatDetail[] = Array.from(vatMap.entries()).map(
    ([rate, data]) => ({
      rate,
      baseHt: data.baseHt,
      amount: data.amount,
    }),
  );

  const totalTtc = totalHt + vatDetails.reduce((sum, v) => sum + v.amount, 0);

  return { totalHt, totalTtc, vatDetails };
}
