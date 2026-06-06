'use client';

/**
 * Night audit — end-of-day close for front office.
 *
 * Room charges post here (POST_NIGHTLY_VIA_AUDIT). GL for guest stays remains at
 * checkout; no-show penalties post GL directly from markNoShow().
 */

import { trackEvent } from '../analytics/trackEvent';
import { logAudit } from '../analytics/auditLogStore';
import { postRoomChargeForDate } from './roomCharges';
import { getZonedClockParts } from './propertyTime';
import { resolvePropertyTimezone } from './propertyTimeClient';
import type { Reservation } from './types';

type StoreLike = {
  reservations: Reservation[];
  businessDate: string;
  lastNightAuditAt?: string;
  nightAuditHistory: NightAuditRun[];
  markNoShow: (reservationId: string) => void;
  notify: () => void;
  getOrCreateFolio: (id: string) => {
    id: string;
    charges?: Array<{ description?: string; date?: string; amount?: number; tax?: number }>;
    payments?: Array<{ amount?: number; date?: string; status?: string }>;
  };
  addFolioCharge: (folioId: string, charge: Record<string, unknown>) => void;
  updateFolioBalances: (folio: unknown) => void;
  calculateRateBreakdown: (
    roomTypeId: string,
    arrival: string,
    departure: string,
  ) => Array<{ date: string; base: number; total: number }>;
  ratePlans: Array<{ roomTypeId: string; basePrice?: number; price?: number }>;
};

export type NightAuditRun = {
  id: string;
  businessDate: string;
  completedAt: string;
  roomChargesPosted: number;
  noShowsProcessed: number;
  checkedInCount: number;
  folioChargesTotal: number;
  folioPaymentsTotal: number;
  status: 'completed' | 'failed';
  error?: string;
};

export type NightAuditResult = NightAuditRun;

function nextCalendarDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function sumFolioActivity(store: StoreLike, businessDate: string) {
  let charges = 0;
  let payments = 0;
  for (const r of store.reservations) {
    if (r.status !== 'checked-in' && r.status !== 'checked-out') continue;
    const folio = store.getOrCreateFolio(r.id);
    for (const c of folio.charges || []) {
      if ((c.date || '').slice(0, 10) === businessDate) {
        charges += (c.amount || 0) + (c.tax || 0);
      }
    }
    for (const p of folio.payments || []) {
      if (p.status === 'completed' && (p.date || '').slice(0, 10) === businessDate) {
        payments += p.amount || 0;
      }
    }
  }
  return { charges, payments };
}

/**
 * Run full night audit for the current business date, then roll to the next day.
 * Idempotent room posting: re-run safe for the same business date.
 */
export function runNightAudit(store: StoreLike): NightAuditResult {
  const businessDate = store.businessDate;
  const run: NightAuditRun = {
    id: `NA-${businessDate}-${Date.now().toString().slice(-6)}`,
    businessDate,
    completedAt: new Date().toISOString(),
    roomChargesPosted: 0,
    noShowsProcessed: 0,
    checkedInCount: 0,
    folioChargesTotal: 0,
    folioPaymentsTotal: 0,
    status: 'completed',
  };

  try {
    // Step 2 — Post room charges for in-house guests (business date = night being closed)
    const inHouse = store.reservations.filter((r) => r.status === 'checked-in');
    run.checkedInCount = inHouse.length;
    for (const r of inHouse) {
      if (postRoomChargeForDate(store, r.id, businessDate)) {
        run.roomChargesPosted += 1;
      }
    }

    // Step 6 — Process no-shows (expected arrivals who never checked in)
    const expected = store.reservations.filter(
      (r) =>
        r.arrival.slice(0, 10) === businessDate &&
        (r.status === 'confirmed' || r.status === 'pending'),
    );
    for (const r of expected) {
      store.markNoShow(r.id);
      run.noShowsProcessed += 1;
    }

    // Step 4 — Reconcile folio activity for the business day
    const activity = sumFolioActivity(store, businessDate);
    run.folioChargesTotal = activity.charges;
    run.folioPaymentsTotal = activity.payments;

    // Step 1 & 9 — Roll business date
    store.businessDate = nextCalendarDate(businessDate);
    store.lastNightAuditAt = run.completedAt;
    store.nightAuditHistory = [run, ...(store.nightAuditHistory || [])].slice(0, 30);
    store.notify();

    trackEvent('FO.NightAudit.Completed' as any, {
      businessDate,
      roomChargesPosted: run.roomChargesPosted,
      noShowsProcessed: run.noShowsProcessed,
    });
    try {
      logAudit({
        area: 'frontdesk',
        action: 'other',
        entity: 'NightAudit',
        entityId: run.id,
        details: `Night audit closed ${businessDate}: ${run.roomChargesPosted} room charge(s), ${run.noShowsProcessed} no-show(s)`,
        severity: 'medium',
      });
    } catch {}
  } catch (e) {
    run.status = 'failed';
    run.error = e instanceof Error ? e.message : String(e);
    store.nightAuditHistory = [run, ...(store.nightAuditHistory || [])].slice(0, 30);
    store.notify();
    console.warn('[NightAudit] failed', e);
  }

  return run;
}

/** True when a successful night audit already closed this business date. */
export function hasCompletedNightAuditForDate(
  store: Pick<StoreLike, 'nightAuditHistory'>,
  businessDate: string,
): boolean {
  return (store.nightAuditHistory || []).some(
    (r) => r.businessDate === businessDate && r.status === 'completed',
  );
}

const AUTO_RUN_STORAGE_KEY = 'fo.nightAudit.lastAutoRunDate';

/** Whether property local time is in the 1:00am auto-run window (1:00–1:02). */
export function isNightAuditScheduleWindow(now = new Date(), timeZone?: string): boolean {
  const tz = timeZone || resolvePropertyTimezone();
  const { hour, minute } = getZonedClockParts(now, tz);
  // Production window: 1:00–1:02 property local time.
  // To test before go-live: temporarily change hour/minute below to match the
  // current property clock, verify scheduler logs in the browser console, then restore.
  return hour === 1 && minute < 3;
}

/** Prevent duplicate auto-runs within the same calendar day. */
export function wasAutoRunAttemptedToday(now = new Date()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = localStorage.getItem(AUTO_RUN_STORAGE_KEY);
    return key === now.toISOString().slice(0, 10);
  } catch {
    return false;
  }
}

export function markAutoRunAttempted(now = new Date()): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTO_RUN_STORAGE_KEY, now.toISOString().slice(0, 10));
  } catch {}
}
