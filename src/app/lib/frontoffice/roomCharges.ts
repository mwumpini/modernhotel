'use client';

/**
 * Room charge policy: POST_NIGHTLY_VIA_AUDIT
 *
 * - Check-in posts the first night only (immediate folio visibility).
 * - Night audit posts one room charge per business date (idempotent by date).
 * - Extend-stay updates rateBreakdown; new nights are picked up by night audit.
 */

import type { Reservation } from './types';
import { roundMoney2 } from '../tax/engine';
import { genId } from './helpers/ids';

type StoreLike = {
  reservations: Reservation[];
  getOrCreateFolio: (reservationId: string) => { id: string; charges?: Array<{ description?: string; date?: string }> };
  addFolioCharge: (folioId: string, charge: Record<string, unknown>) => void;
  updateFolioBalances: (folio: unknown) => void;
  calculateRateBreakdown: (roomTypeId: string, arrival: string, departure: string) => Array<{ date: string; base: number; total: number }>;
  ratePlans: Array<{ roomTypeId: string; basePrice?: number; price?: number }>;
};

export const ROOM_CHARGE_DESCRIPTION = 'Room Charge';

export function isRoomLine(description?: string): boolean {
  return (description || '').toLowerCase().includes('room');
}

export function getRoomChargeDatesOnFolio(folio: { charges?: Array<{ description?: string; date?: string }> }): Set<string> {
  return new Set(
    (folio.charges || [])
      .filter((c) => isRoomLine(c.description))
      .map((c) => (c.date || '').slice(0, 10))
      .filter(Boolean),
  );
}

export function resolveRateForDate(store: StoreLike, reservation: Reservation, date: string): number {
  return resolveDayPricing(store, reservation, date).base;
}

/**
 * Net + gross for a stay date, both from the same rate-breakdown entry. Gross-priced
 * plans store their exact manager-entered total in `.total` — reusing it (rather than
 * re-deriving tax from the already-rounded `.base` independently) avoids a double
 * rounding gap, e.g. a ₵500.00 gross rate landing on the folio as ₵499.99.
 */
function resolveDayPricing(store: StoreLike, reservation: Reservation, date: string): { base: number; gross?: number } {
  const breakdown =
    reservation.rateBreakdown?.length
      ? reservation.rateBreakdown
      : store.calculateRateBreakdown(reservation.roomTypeId, reservation.arrival, reservation.departure);
  const day = breakdown.find((n) => n.date === date);
  if (typeof day?.base === 'number') return { base: day.base, gross: day.total };
  const fallback = store.ratePlans.find((rp) => rp.roomTypeId === reservation.roomTypeId);
  return { base: fallback?.basePrice ?? fallback?.price ?? 0 };
}

/** Idempotent: skip if a room line already exists for businessDate. */
export function postRoomChargeForDate(
  store: StoreLike,
  reservationId: string,
  businessDate: string,
): boolean {
  const reservation = store.reservations.find((r) => r.id === reservationId);
  if (!reservation || reservation.status !== 'checked-in') return false;

  const arrival = reservation.arrival.slice(0, 10);
  const departure = reservation.departure.slice(0, 10);
  if (businessDate < arrival || businessDate >= departure) return false;

  const folio = store.getOrCreateFolio(reservationId);
  const existing = getRoomChargeDatesOnFolio(folio);
  if (existing.has(businessDate)) return false;

  const { base: amount, gross } = resolveDayPricing(store, reservation, businessDate);
  if (amount <= 0) return false;

  store.addFolioCharge(folio.id, {
    id: genId('C-RM'),
    date: businessDate,
    description: ROOM_CHARGE_DESCRIPTION,
    amount,
    category: 'room',
    ...(typeof gross === 'number' && gross >= amount ? { tax: roundMoney2(gross - amount) } : {}),
  });
  store.updateFolioBalances(folio);
  return true;
}

/** First night at check-in — only when no room lines exist yet. */
export function postFirstNightAtCheckIn(store: StoreLike, reservationId: string): boolean {
  const reservation = store.reservations.find((r) => r.id === reservationId);
  if (!reservation) return false;
  const folio = store.getOrCreateFolio(reservationId);
  if (getRoomChargeDatesOnFolio(folio).size > 0) return false;
  return postRoomChargeForDate(store, reservationId, reservation.arrival.slice(0, 10));
}
