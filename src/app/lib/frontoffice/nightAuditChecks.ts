'use client';

/**
 * Read-only checks for the Night Audit page — surfaced so front desk can fix
 * them before running the audit, rather than discovering post-hoc that a
 * room charge was silently skipped (postRoomChargeForDate skips a $0 rate)
 * or that a guest never got checked out.
 */

import type { Reservation, FolioCharge, FolioPayment } from './types';
import { resolveRateForDate, type StoreLike } from './roomCharges';
import { chargeNet, isPostedRoomCharge } from './folioLedger';

export type NightAuditDiscrepancy = {
  reservationId: string;
  guestName: string;
  roomId?: string;
  type: 'no-rate' | 'no-room' | 'overdue-departure';
  message: string;
};

/** In-house reservations with a problem that would affect tonight's audit or billing. */
export function checkNightAuditDiscrepancies(store: StoreLike, businessDate: string): NightAuditDiscrepancy[] {
  const issues: NightAuditDiscrepancy[] = [];
  for (const r of store.reservations) {
    if (r.status !== 'checked-in') continue;

    if (!r.roomId) {
      issues.push({ reservationId: r.id, guestName: r.guestName, type: 'no-room', message: 'Checked in with no room assigned' });
    }

    const departureDate = r.departure.slice(0, 10);
    if (departureDate < businessDate) {
      issues.push({ reservationId: r.id, guestName: r.guestName, roomId: r.roomId, type: 'overdue-departure', message: `Departure was ${departureDate} — still checked in` });
      continue; // rate check below assumes tonight is within the stay; an overdue stay already covers the concern
    }

    if (businessDate >= r.arrival.slice(0, 10) && businessDate < departureDate) {
      const rate = resolveRateForDate(store, r, businessDate);
      if (rate <= 0) {
        issues.push({ reservationId: r.id, guestName: r.guestName, roomId: r.roomId, type: 'no-rate', message: 'No rate configured for tonight — room charge will be skipped' });
      }
    }
  }
  return issues;
}

export type DailyRevenue = {
  roomCharges: number;
  otherCharges: number;
  taxTotal: number;
  totalCharges: number;
  paymentsByMethod: { cash: number; card: number; mobileMoney: number; other: number };
  totalPayments: number;
};

/**
 * Today's folio activity, broken down — independent of whether night audit has
 * run yet (unlike NightAuditRun.folioChargesTotal, which is only known after
 * the fact). Scoped to checked-in/checked-out reservations, matching
 * nightAudit.ts's sumFolioActivity.
 */
export function computeDailyRevenue(
  store: { reservations: Reservation[]; getOrCreateFolio: (reservationId: string) => { charges?: FolioCharge[]; payments?: FolioPayment[] } },
  businessDate: string,
): DailyRevenue {
  const result: DailyRevenue = {
    roomCharges: 0,
    otherCharges: 0,
    taxTotal: 0,
    totalCharges: 0,
    paymentsByMethod: { cash: 0, card: 0, mobileMoney: 0, other: 0 },
    totalPayments: 0,
  };

  for (const r of store.reservations) {
    if (r.status !== 'checked-in' && r.status !== 'checked-out') continue;
    const folio = store.getOrCreateFolio(r.id);

    for (const c of folio.charges || []) {
      if ((c.date || '').slice(0, 10) !== businessDate) continue;
      const net = chargeNet(c as any);
      if (isPostedRoomCharge(c)) result.roomCharges += net;
      else result.otherCharges += net;
      result.taxTotal += c.tax || 0;
    }

    for (const p of folio.payments || []) {
      if ((p.status || 'completed') !== 'completed' || (p.date || '').slice(0, 10) !== businessDate) continue;
      switch (p.method) {
        case 'Cash': result.paymentsByMethod.cash += p.amount || 0; break;
        case 'Card': result.paymentsByMethod.card += p.amount || 0; break;
        case 'Mobile Money': result.paymentsByMethod.mobileMoney += p.amount || 0; break;
        default: result.paymentsByMethod.other += p.amount || 0; break;
      }
    }
  }

  result.totalCharges = result.roomCharges + result.otherCharges + result.taxTotal;
  result.totalPayments = result.paymentsByMethod.cash + result.paymentsByMethod.card + result.paymentsByMethod.mobileMoney + result.paymentsByMethod.other;
  return result;
}
