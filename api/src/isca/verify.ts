import type { PrismaClient } from '@prisma/client';
import { computeHash, GENESIS_HASH, type ChainInput } from './chain.js';
import { verifySignature } from './signature.js';

export interface VerificationResult {
  valid: boolean;
  totalTickets: number;
  errors: VerificationError[];
}

export interface VerificationError {
  sequenceNumber: number;
  ticketId: string;
  type: 'HASH_MISMATCH' | 'CHAIN_BROKEN' | 'SIGNATURE_INVALID' | 'SEQUENCE_GAP';
  expected?: string;
  actual?: string;
}

/**
 * Vérifie l'intégrité complète de la chaîne de tickets d'un tenant.
 * Recalcule chaque hash et vérifie le chaînage + signatures.
 */
export async function verifyChainIntegrity(
  prisma: PrismaClient,
  tenantId: string,
): Promise<VerificationResult> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { tenantSecret: true },
  });

  const tickets = await prisma.ticket.findMany({
    where: { tenantId },
    orderBy: { sequenceNumber: 'asc' },
  });

  const errors: VerificationError[] = [];

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const expectedSeq = i + 1;

    // Vérifier la continuité de la séquence
    if (ticket.sequenceNumber !== expectedSeq) {
      errors.push({
        sequenceNumber: ticket.sequenceNumber,
        ticketId: ticket.id,
        type: 'SEQUENCE_GAP',
        expected: String(expectedSeq),
        actual: String(ticket.sequenceNumber),
      });
    }

    // Recalculer le hash attendu
    const prevHash = i === 0 ? GENESIS_HASH : tickets[i - 1].hash;
    const chainInput: ChainInput = {
      tenantId: ticket.tenantId,
      sequenceNumber: ticket.sequenceNumber,
      serviceMode: ticket.serviceMode,
      items: ticket.items as unknown[],
      totalHt: ticket.totalHt,
      totalTtc: ticket.totalTtc,
      vatDetails: ticket.vatDetails as unknown[],
      payments: ticket.payments as unknown[],
      isExpenseNote: ticket.isExpenseNote,
      isCancellation: ticket.isCancellation,
      cancelledRef: ticket.cancelledRef,
      createdAt: ticket.createdAt.toISOString(),
    };

    const expectedHash = computeHash(chainInput, prevHash);

    // Vérifier que le prevHash stocké est correct
    if (ticket.prevHash !== prevHash) {
      errors.push({
        sequenceNumber: ticket.sequenceNumber,
        ticketId: ticket.id,
        type: 'CHAIN_BROKEN',
        expected: prevHash,
        actual: ticket.prevHash,
      });
    }

    // Vérifier le hash du ticket
    if (ticket.hash !== expectedHash) {
      errors.push({
        sequenceNumber: ticket.sequenceNumber,
        ticketId: ticket.id,
        type: 'HASH_MISMATCH',
        expected: expectedHash,
        actual: ticket.hash,
      });
    }

    // Vérifier la signature HMAC
    if (!verifySignature(ticket.hash, ticket.signature, tenant.tenantSecret)) {
      errors.push({
        sequenceNumber: ticket.sequenceNumber,
        ticketId: ticket.id,
        type: 'SIGNATURE_INVALID',
      });
    }
  }

  return {
    valid: errors.length === 0,
    totalTickets: tickets.length,
    errors,
  };
}
