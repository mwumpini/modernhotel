'use client';

import { useComplianceStore } from '../../compliance/store';
import { stayNightDates } from '../folioLedger';

export type PriceType = 'subtotal' | 'gross_total';

// Room-rate tax context — matches what the Room Rate Builder's live preview
// (RoomConfigurationDashboard.tsx) already uses, so a rate plan's preview and the
// actual charge posted at check-in can never diverge.
const ROOM_TAX_CATEGORY = 'HOTEL';
const ROOM_TAX_CONTEXT = { domain: 'sales' as const, operation: 'external' as const };

function grossFromExclusive(exclusive: number, category = ROOM_TAX_CATEGORY, context?: Record<string, any>): number {
  if (!(exclusive > 0)) return 0;
  const { total } = useComplianceStore.getState().calculateTax(exclusive, category, { ...ROOM_TAX_CONTEXT, ...context });
  return total;
}

/**
 * Given a tax-inclusive (gross) amount, find the tax-exclusive subtotal whose
 * compliance-computed total equals it. Needed for `gross_total`-priced rate plans,
 * where the guest-facing price is fixed and tax must be backed out of it. Binary
 * search rather than algebraic inversion since the compliance engine can stack
 * multiple rules (additive + compound) with no closed-form inverse in general.
 */
export function reverseToSubtotalFromGross(gross: number, category = ROOM_TAX_CATEGORY, context?: Record<string, any>): number {
  if (!(gross > 0)) return 0;
  const ctx = { ...ROOM_TAX_CONTEXT, ...context };
  let lo = 0;
  let hi = gross * 2;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const { total } = useComplianceStore.getState().calculateTax(mid, category, ctx);
    if (total > gross) hi = mid; else lo = mid;
  }
  return lo;
}

function exclusiveFromGross(gross: number): number {
  if (gross <= 0) return 0;
  return Math.round(reverseToSubtotalFromGross(gross) * 100) / 100;
}

/** Nights owed for a stay. Same-day check-out is 1 night; the next morning is still 1 night. */
export function calculateStayNights(arrival: string, departure: string): number {
  return stayNightDates(arrival, departure).length;
}

/** Tax-exclusive nightly from a rate-plan price and its priceType. */
export function resolveNightlyNet(price: number, priceType?: string): number {
  if (!price || price <= 0) return 0;
  if (priceType === 'gross_total') return exclusiveFromGross(price);
  return price;
}

/**
 * Tax-inclusive nightly from a rate-plan price and its priceType. `taxExempt` (from the
 * reservation — government/diplomatic/NGO guests) makes gross collapse to net: the
 * room's underlying value doesn't change, but no tax is added on top of it.
 */
export function resolveNightlyGross(price: number, priceType?: string, taxExempt?: boolean): number {
  if (!price || price <= 0) return 0;
  if (taxExempt) return resolveNightlyNet(price, priceType);
  if (priceType === 'gross_total') return price;
  return grossFromExclusive(price);
}

/**
 * Convert a gross-derived fee/penalty into a tax-exclusive folio amount.
 * Flat fees entered by staff are already exclusive and should pass through unchanged.
 * For an exempt reservation, `grossAmount` was already computed tax-free (equal to net)
 * by whatever derived it, so it passes through unchanged too rather than incorrectly
 * backing out tax a second time.
 */
export function folioAmountFromGrossDerived(grossAmount: number, taxExempt?: boolean): number {
  if (!grossAmount || grossAmount <= 0) return 0;
  if (taxExempt) return grossAmount;
  return exclusiveFromGross(grossAmount);
}

export type RateBreakdownDay = { date: string; base: number; total: number; roomId?: string };

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

/** Price each night's stored room rate through the tax engine. The saved total is not the tax. */
export function quoteFromRateBreakdown(breakdown: RateBreakdownDay[], taxExempt?: boolean): ReservationQuote {
  const cents = (amount: number) => Math.round(amount * 100) / 100;
  const priced = breakdown.map((day) => {
    const base = cents(day.base || 0);
    const total = base > 0
      ? cents(resolveNightlyGross(base, 'subtotal', !!taxExempt))
      : cents(day.total || 0);
    return { ...day, base, total };
  });
  return quoteFromBreakdown(priced);
}
