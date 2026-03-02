import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signe un hash de ticket avec la clé secrète du tenant (HMAC-SHA256).
 * Garantit l'authenticité : seul le détenteur de la clé peut signer.
 */
export function signTicket(hash: string, tenantSecret: string): string {
  return createHmac('sha256', tenantSecret).update(hash).digest('hex');
}

/**
 * Vérifie la signature d'un ticket (timing-safe pour éviter les attaques par timing).
 */
export function verifySignature(
  hash: string,
  signature: string,
  tenantSecret: string,
): boolean {
  const expected = signTicket(hash, tenantSecret);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
