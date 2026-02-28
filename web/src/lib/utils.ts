import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

export function computeTtc(amountHt: number, vatRate: number): number {
  return Math.round(amountHt * (1 + vatRate / 100));
}

export function computeVatAmount(amountHt: number, vatRate: number): number {
  return Math.round(amountHt * vatRate / 100);
}

export function formatPrice(cents: number): string {
  return `${centsToEuros(cents)} €`;
}
