'use client';

import { grossFromExclusive, exclusiveFromGross } from '../../tax/engine';

export type PriceType = 'subtotal' | 'gross_total';

/** Nights between arrival and departure (departure day is not charged). */
export function calculateStayNights(arrival: string, departure: string): number {
  const start = new Date(arrival);
  const end = new Date(departure);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Tax-exclusive nightly from a rate-plan price and its priceType. */
export function resolveNightlyNet(price: number, priceType?: string): number {
  if (!price || price <= 0) return 0;
  if (priceType === 'gross_total') return exclusiveFromGross(price);
  return price;
}

/** Tax-inclusive nightly from a rate-plan price and its priceType. */
export function resolveNightlyGross(price: number, priceType?: string): number {
  if (!price || price <= 0) return 0;
  if (priceType === 'gross_total') return price;
  return grossFromExclusive(price);
}

/**
 * Convert a gross-derived fee/penalty into a tax-exclusive folio amount.
 * Flat fees entered by staff are already exclusive and should pass through unchanged.
 */
export function folioAmountFromGrossDerived(grossAmount: number): number {
  if (!grossAmount || grossAmount <= 0) return 0;
  return exclusiveFromGross(grossAmount);
}

export type RateBreakdownDay = { date: string; base: number; total: number };

export type ReservationQuote = {
  nightlyGross: number;
  nightlyNet: number;
  nights: number;
  subtotal: number;
  tax: number;
  grandTotal: number;
  breakdown: RateBreakdownDay[];
};

export function isValidRateBreakdown(breakdown?: Array<{ base?: number; total?: number }>): boolean {
  return !!(breakdown?.length && breakdown.some((d) => (d.total || 0) > 0 || (d.base || 0) > 0));
}

export function quoteFromBreakdown(breakdown: RateBreakdownDay[]): ReservationQuote {
  const nights = breakdown.length;
  const subtotal = breakdown.reduce((s, d) => s + (d.base || 0), 0);
  const grandTotal = breakdown.reduce((s, d) => s + (d.total || 0), 0);
  return {
    nightlyGross: breakdown[0]?.total || 0,
    nightlyNet: breakdown[0]?.base || 0,
    nights,
    subtotal,
    tax: grandTotal - subtotal,
    grandTotal,
    breakdown,
  };
}
