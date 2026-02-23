/**
 * Calcule le TTC à partir du HT et du taux de TVA
 * Tous les montants sont en centimes
 */
export function computeTtc(amountHt: number, vatRate: number): number {
  return Math.round(amountHt * (1 + vatRate / 100));
}

/**
 * Calcule le montant de TVA
 */
export function computeVatAmount(amountHt: number, vatRate: number): number {
  return Math.round((amountHt * vatRate) / 100);
}

/**
 * Formatte un montant en centimes vers euros (ex: 850 -> "8.50")
 */
export function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Genere un ISO date string (YYYY-MM-DD)
 */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}
