'use client';

/**
 * Revenue reporting policy — avoid double-counting when combining departmental
 * capture (integration.ts) with guest folio checkout (simpleFlow.ts).
 *
 * Guest-stay revenue recognition (IFRS 15): each folio charge on its own day (guest_folio),
 * plus no-show penalties. Stays checked out before that rule used one entry at checkout.
 * Walk-in / events revenue: departmental capture at point of sale.
 */

export const REVENUE_SOURCE_GROUPS = {
  /** Folio charges and payments posted as they happen (server, folioLedgerServer.ts). */
  GUEST_FOLIO_DAILY: 'guest_folio',
  /** Older stays: one invoice + JEs at checkout. */
  GUEST_FOLIO_CHECKOUT: 'front_office_checkout',
  /** No-show penalty — direct GL, not checkout */
  GUEST_NOSHOW: 'front_office_noshow',
  /** Per-charge or per-payment capture from front_office, restaurant, bar, conference, etc. */
  DEPARTMENTAL_REALTIME: [
    'front_office',
    'restaurant',
    'bar',
    'room_service',
    'conference',
    'spa',
    'other',
  ] as const,
  /** Manual NHIA / insurance / presets */
  ACCOUNTING_PRESETS: 'accounting_preset',
} as const;

/** Authoritative revenue recognition for guest folio stays (IFRS 15 — as delivered, older stays at checkout). */
export const AUTHORITATIVE_GUEST_REVENUE_SOURCES = [
  REVENUE_SOURCE_GROUPS.GUEST_FOLIO_DAILY,
  REVENUE_SOURCE_GROUPS.GUEST_FOLIO_CHECKOUT,
  REVENUE_SOURCE_GROUPS.GUEST_NOSHOW,
] as const;

export function revenueSourceGroup(sourceModule?: string): 'folio_checkout' | 'departmental' | 'preset' | 'unknown' {
  if (!sourceModule) return 'unknown';
  if (sourceModule === REVENUE_SOURCE_GROUPS.GUEST_FOLIO_CHECKOUT) return 'folio_checkout';
  if (sourceModule === REVENUE_SOURCE_GROUPS.GUEST_FOLIO_DAILY) return 'folio_checkout';
  if (sourceModule === REVENUE_SOURCE_GROUPS.GUEST_NOSHOW) return 'folio_checkout';
  if (sourceModule === REVENUE_SOURCE_GROUPS.ACCOUNTING_PRESETS) return 'preset';
  if ((REVENUE_SOURCE_GROUPS.DEPARTMENTAL_REALTIME as readonly string[]).includes(sourceModule)) return 'departmental';
  return 'unknown';
}

/**
 * Revenue P&L rollups: guest folio revenue at checkout/no-show; walk-in at departmental capture.
 * Excludes `front_office` operational folio builders that duplicate checkout.
 */
export function isAuthoritativeRevenueSource(sourceModule?: string): boolean {
  if (!sourceModule) return true;
  if ((AUTHORITATIVE_GUEST_REVENUE_SOURCES as readonly string[]).includes(sourceModule)) return true;
  if (sourceModule === REVENUE_SOURCE_GROUPS.ACCOUNTING_PRESETS) return true;
  if (sourceModule === 'front_office') return false;
  if ((REVENUE_SOURCE_GROUPS.DEPARTMENTAL_REALTIME as readonly string[]).includes(sourceModule)) return true;
  return true;
}
