import { createHash } from 'crypto';

export interface ChainInput {
  tenantId: string;
  sequenceNumber: number;
  serviceMode: 'ONSITE' | 'TAKEAWAY';
  items: unknown[];
  totalHt: number;
  totalTtc: number;
  vatDetails: unknown[];
  payments: unknown[];
  isExpenseNote: boolean;
  isCancellation: boolean;
  cancelledRef: string | null;
  createdAt: string; // ISO
}

/**
 * Calcule le hash SHA-256 d'un ticket en incluant le hash du ticket précédent.
 * C'est le chaînage qui garantit l'intégrité de la séquence (blockchain simplifiée).
 */
export function computeHash(data: ChainInput, prevHash: string): string {
  const payload = JSON.stringify({ ...data, prevHash });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Hash initial pour le premier ticket d'un tenant (pas de ticket précédent).
 */
export const GENESIS_HASH = '0'.repeat(64);
