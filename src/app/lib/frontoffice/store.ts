'use client';

/**
 * FrontOfficeStore
 *
 * Central in-memory state for Front Office domain (reservations, folios, guests, rooms).
 *
 * Design:
 * - UI reads via instance fields and subscribes using store.subscribe.
 * - Heavy domain logic (folios, API, seeding, invoices) is delegated to helpers
 *   in ./helpers to keep this file short and maintainable.
 * - All mutations call notify() so subscribed dashboards/components react.
 */

import { Reservation, GuestProfile, RoomType, RoomEntity, RatePlan, Folio, BillingPerson } from './types';
import { trackEvent } from '../analytics/trackEvent';
import { logAudit } from '../analytics/auditLogStore';
import * as folioHelpers from './helpers/folio';
import { housekeepingStore } from '../housekeeping/store';
import { autoAssignRoomsEnabled, useSettingsStore } from '../settings/store';
import * as apiHelpers from './helpers/api';
import * as seedHelpers from './helpers/seed';
import * as invoiceHelpers from './helpers/invoice';
import { getClientTenantSubdomain } from '../api/clientTenant';
import {
  isValidRateBreakdown,
  quoteFromRateBreakdown,
  resolveNightlyGross,
  resolveNightlyNet,
  type ReservationQuote,
} from './helpers/rates';
import { isCorporateGuest } from './helpers/guests';
import { postFirstNightAtCheckIn } from './roomCharges';
import { nextCalendarDate, previousCalendarDate, roundCents, stayNightDates } from './folioLedger';
import { isLateCheckoutNow } from './lateCheckout';
import { depositBlocksConfirm, planEarlyCheckout, requiredDeposit } from './operationalPolicies';
import { type NightAuditResult } from './nightAudit';
import { postNoShowPenaltyToLedger } from '../accounting/simpleFlow';
import { DEMO_BILLING_PERSONS, DEMO_RESERVATION_IDS as demoReservationIds, isDemoFixturesEnabled } from '../demo';
import { notifyError } from '../notifications/notify';
import { genId } from './helpers/ids';
import { createRecordSync, loadRecords } from '../api/tenantRecords';

function localStayDate(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** The fields PUT /api/folios stores — used to skip re-sending an unchanged folio. */
/** A record only this browser has, made so recently that its save may still be on the way. */
const UNSYNCED_GRACE_MS = 2 * 60 * 1000;
function isFreshLocal(rec: { createdAt?: string }): boolean {
  const t = Date.parse(rec.createdAt || '');
  return Number.isFinite(t) && Date.now() - t < UNSYNCED_GRACE_MS;
}

function folioSignature(f: Folio): string {
  return JSON.stringify([
    f.reservationId, f.status, f.currency || 'GHS', f.type ?? null, f.description ?? null,
    f.responsibleParty ?? null, f.creditBalance ?? null, f.charges || [], f.payments || [],
  ]);
}

class FrontOfficeStore {
  reservations: Reservation[] = [];
  guests: GuestProfile[] = [];
  billingPersons: BillingPerson[] = [];
  private hydratedGuests: boolean = false;
  // Set the instant ensureHydratedFromApi() is entered — guards against firing
  // pullFromApi() more than once, nothing more. NOT safe as an "is real data
  // loaded yet" check: see hydrationComplete below for why persistFolio needs
  // a separately-timed flag.
  private hydratedFromApi: boolean = false;
  // Set only once pullFromApi()'s folios fetch has actually resolved (or
  // failed) — unlike hydratedFromApi, which flips true synchronously before
  // that fetch even starts. persistFolio gates on this one: getOrCreateFolio
  // finding no match in a still-empty/still-loading self.folios during that
  // window would otherwise create a folio with a fresh, non-deterministic id
  // that duplicates one the server already has once the real data lands —
  // this was confirmed as the root cause of hundreds of duplicate GuestFolio
  // rows per reservation in production data.
  private hydrationComplete: boolean = false;
  // Last folio content known to be on the server (loaded by pullFromApi, or
  // queued/saved by persistFolio), keyed by folio id. updateFolioBalances()
  // runs on every render of several billing screens, so without this every
  // render PUT every folio unchanged — hundreds of thousands of no-op writes
  // and FOLIO_UPSERTED audit rows. Also marks which local folios the server
  // knows about (see the phantom-folio drop in pullFromApi).
  private folioServerSig = new Map<string, string>();
  /** True only after day-ledger has supplied the stored business date. */
  private businessDateSynced = false;
  private hydratedNightAuditState: boolean = false;
  private lastRefreshFromApiAt: number = 0;
  private pullInFlight: Promise<void> | null = null;
  private liveRefreshUsers = 0;
  private liveRefreshTimer: number | null = null;
  /** How often an open front-desk screen re-reads reservations and folios. */
  private static readonly LIVE_REFRESH_MS = 15_000;
  // Serializes API writes so a reservation's POST always lands before its PATCH.
  private writeQueue: Promise<unknown> = Promise.resolve();
  /** Counts saves, so a refresh can tell that one was made while it was loading. */
  private writesStarted = 0;
  clientServices: Array<{
    id: string;
    clientId: string;
    serviceName: string;
    serviceType: 'amenity' | 'package' | 'contract';
    rate: number;
    notes?: string;
    contractStart?: string;
    contractEnd?: string;
    status: 'active' | 'inactive' | 'expired';
    isActive: boolean;
    createdAt: string;
  }> = [];
  roomTypes: RoomType[] = [];
  rooms: RoomEntity[] = [];
  ratePlans: RatePlan[] = [];
  marketCodes: string[] = ['INTERNET', 'BOOKING.COM', 'EXPEDIA', 'DIRECTINN', 'WALK IN'];
  folios: Folio[] = [];
  /** Bulk accommodation event bookings (headcounts only, no individual guest/
   *  room records — see EventsConferencesMainDashboard's checkInEventGroup)
   *  that have been checked in as a group, so the Executive dashboard's
   *  In-House Guests KPI can include their pax alongside individually
   *  checked-in reservations. */
  inHouseGroups: Array<{ id: string; eventId: string; eventName?: string; pax: number; checkedInAt: string }> = [];
  // Both lists are kept on the server (TenantRecord) and loaded with the rest in runPullFromApi.
  private inHouseGroupSync = createRecordSync<{ id: string; eventId: string; eventName?: string; pax: number; checkedInAt: string }>('fo.inHouseGroup');
  private clientServiceSync = createRecordSync<FrontOfficeStore['clientServices'][number]>('fo.clientService');
  addInHouseGroup(eventId: string, pax: number, eventName?: string) {
    this.inHouseGroups = this.inHouseGroups.filter(g => g.eventId !== eventId);
    this.inHouseGroups.push({ id: genId('IHG'), eventId, eventName, pax: pax || 0, checkedInAt: new Date().toISOString() });
    this.inHouseGroupSync.push(this.inHouseGroups);
    this.notify();
  }
  removeInHouseGroup(eventId: string) {
    this.inHouseGroups = this.inHouseGroups.filter(g => g.eventId !== eventId);
    this.inHouseGroupSync.push(this.inHouseGroups);
    this.notify();
  }
  getInHouseGroupPax(): number {
    return this.inHouseGroups.reduce((s, g) => s + (g.pax || 0), 0);
  }
  /** Hotel business date (rolls at night audit). ISO yyyy-mm-dd */
  businessDate: string = new Date().toISOString().slice(0, 10);
  lastNightAuditAt?: string;
  nightAuditHistory: import('./nightAudit').NightAuditRun[] = [];
  wakeUpCalls: import('./types').WakeUpCall[] = [];
  private listeners: Array<() => void> = [];
  
  // Simple global sequential ID generator persisted in localStorage for human-friendly IDs
  private nextSequence(): number {
    try {
      const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('global.seq') : null;
      const n = raw ? parseInt(raw, 10) : 0;
      const next = isNaN(n) ? 1 : n + 1;
      if (typeof localStorage !== 'undefined') localStorage.setItem('global.seq', String(next));
      return next;
    } catch {
      return Number(String(Date.now()).slice(-6));
    }
  }

  private makeId(prefix: 'RES'|'CI'|'IH'|'CO'|'INV'|'PAY'|'CHG'): string {
    const seq = this.nextSequence();
    return `${prefix}-${seq.toString().padStart(6,'0')}`;
  }

  constructor() {
    // Settings are now managed centrally via useSettingsStore
    this.billingPersons = isDemoFixturesEnabled() ? [...DEMO_BILLING_PERSONS] : [];

    // Load persisted guests from storage to prevent data loss on refresh
    try {
      const rawGuests = (typeof window !== 'undefined') ? (localStorage.getItem('fo.guests') || sessionStorage.getItem('fo.guests')) : null;
      if (rawGuests) {
        const parsed: GuestProfile[] = JSON.parse(rawGuests);
        if (Array.isArray(parsed)) {
          // Normalize legacy records for corporate company phone/email display
          this.guests = parsed.map((g: any) => {
            const isCorp = isCorporateGuest(g);
            if (isCorp) {
              const corpMeta = g.corporateMeta || {};
              const contact = corpMeta.contactPerson || {};
              if (!g.companyPhone && contact.phone) {
                g.companyPhone = contact.phone;
              }
              if (!g.companyEmail && corpMeta.terms?.accountsEmail) {
                g.companyEmail = corpMeta.terms.accountsEmail;
              }
            }
            return g as GuestProfile;
          });
        }
      }
    } catch (e) {
      console.warn('FO: Failed to load guests from storage', e);
    } finally {
      // Mark guests as hydrated before any store notifications fire
      this.hydratedGuests = true;
    }

    // Initialize sample reservations for testing
    this.initializeSampleReservations();

    // Initial rooms sync from settings
    try {
      this.syncRoomsFromSettings();
      // Subscribe to settings changes so rooms reflect Settings in real-time
      useSettingsStore.subscribe(() => {
        this.syncRoomsFromSettings();
      });
    } catch (e) {
      console.warn('FO: Room sync subscription failed', e);
    }
  }

  // Initialize sample reservations for testing
  private initializeSampleReservations() {
    seedHelpers.initializeSampleReservations(this as any);
    this.reservations = this.reservations.map((r) => this.ensureReservationRates(r));
    this.reservations.forEach((r) => {
      if (r.status === 'checked-in') {
        try { this.ensureFolioRoomCharges(r.id); } catch {}
      }
    });
    const seedFolio = (reservationId: string, charges: number[], payments: Array<{ method: 'Cash'|'Card'|'Mobile Money'|'Corporate Account'|'Bank Transfer'|'Check'|'Credit'; amount?: number }>) => {
      charges.forEach(amount => this.addCharge(reservationId, 'Room Charge', amount));
      const f = this.getOrCreateFolio(reservationId);
      this.updateFolioBalances(f);
      payments.forEach(p => {
        const val = typeof p.amount === 'number' ? p.amount : (this.getOrCreateFolio(reservationId).balance || 0);
        if (val > 0) this.addPayment(reservationId, p.method, val);
      });
    };
    seedFolio('R-004', [600, 150, 100], [ { method: 'Card' } ]);
    seedFolio('R-005', [800, 250], [ { method: 'Corporate Account' } ]);
    seedFolio('R-006', [1000, 300, 100], [ { method: 'Cash', amount: 700 } ]);
  }

  subscribe(l: () => void) { this.listeners.push(l); this.ensureHydratedFromApi(); this.ensureHydratedNightAuditState(); return () => { this.listeners = this.listeners.filter(x => x !== l); }; }

  // ---------------------------------------------------------------------------
  // Server persistence (write-through cache). The in-memory arrays remain the
  // synchronous read source for the UI; mutations are mirrored to the database
  // through the API using the store's own ids so DB and client stay aligned.
  // ---------------------------------------------------------------------------
  private tenant(): string | null { return getClientTenantSubdomain(); }

  // A failed write (network blip, brief server hiccup) used to be silently
  // dropped forever — the in-memory charge/reservation stayed correct on
  // screen but the database never got it, so it vanished on the next reload.
  // Retry a few times with backoff before giving up; this fixes the common
  // transient case without needing a full offline write queue.
  private async withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, i)));
        }
      }
    }
    throw lastErr;
  }

  private enqueueWrite(fn: () => Promise<unknown>) {
    if (typeof window === 'undefined' || !this.tenant()) return;
    this.writesStarted += 1;
    this.writeQueue = this.writeQueue
      .then(() => this.withRetry(fn))
      .catch(e => {
        console.warn('FO: persist failed after retries', e);
        notifyError('A change (reservation, folio, or guest update) could not be saved. Check your connection and try the action again.');
      });
  }

  private persistNewReservation(r: Reservation) {
    const t = this.tenant(); if (!t) return;
    this.enqueueWrite(() => apiHelpers.createReservationViaApi(this as any, t, r));
  }

  private persistReservationPatch(id: string, patch: Partial<Reservation>) {
    const t = this.tenant(); if (!t) return;
    this.enqueueWrite(() => apiHelpers.updateReservationViaApi(this as any, t, id, patch));
  }

  private persistNewGuest(g: GuestProfile) {
    const t = this.tenant(); if (!t) return;
    this.enqueueWrite(() => apiHelpers.createGuestViaApi(this as any, t, g));
  }

  private persistGuestPatch(id: string, patch: Partial<GuestProfile>) {
    const t = this.tenant(); if (!t) return;
    this.enqueueWrite(() => apiHelpers.updateGuestViaApi(this as any, t, id, patch));
  }

  private persistGuestDelete(id: string) {
    const t = this.tenant(); if (!t) return;
    this.enqueueWrite(() => apiHelpers.deleteGuestViaApi(this as any, t, id));
  }

  isRoomBookable(roomNumber: string): boolean {
    try {
      const rm = useSettingsStore.getState().roomManagement;
      const room = (rm.rooms || []).find((r) => r.number === roomNumber || r.id === roomNumber);
      if (room && room.isActive === false) return false;
      const typeId = room?.typeId;
      if (typeId) {
        const type = (rm.roomTypes || []).find((t) => t.id === typeId);
        if (type && type.isActive === false) return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  reservationUsesRoom(room: { id: string; number?: string }): boolean {
    return this.reservations.some((r) => r.roomId === room.number || r.roomId === room.id);
  }

  roomTypeHasHistory(typeId: string): boolean {
    return this.reservations.some((r) => r.roomTypeId === typeId);
  }

  getActiveGuests(): GuestProfile[] {
    return this.guests.filter((g) => g.isActive !== false);
  }

  guestHasHistory(id: string): boolean {
    if (this.reservations.some((r) => r.guestId === id)) return true;
    if (this.folios.some((f) => {
      const res = this.reservations.find((r) => r.id === f.reservationId);
      return res?.guestId === id;
    })) return true;
    if (this.clientServices.some((s) => s.clientId === id)) return true;
    return false;
  }

  // Upsert a folio (the in-house subledger) after any charge/payment mutation.
  // Called from the folio helpers, which funnel through updateFolioBalances.
  // Skipped until hydration genuinely completes (hydrationComplete, not
  // hydratedFromApi — see field comment) so neither the constructor's demo
  // seed folios nor a getOrCreateFolio() race-created phantom folio (created
  // because self.folios hadn't finished loading yet) get written to the
  // database as a duplicate of a folio the server already has.
  persistFolio(folio: Folio) {
    if (!this.hydrationComplete) return;
    const t = this.tenant(); if (!t || !folio?.id || !folio?.reservationId) return;
    const sig = folioSignature(folio);
    if (this.folioServerSig.get(folio.id) === sig) return;
    this.folioServerSig.set(folio.id, sig);
    this.enqueueWrite(async () => {
      let saved: Folio;
      try {
        saved = await apiHelpers.upsertFolioViaApi(this as any, t, folio);
      } catch (e) {
        if (this.folioServerSig.get(folio.id) === sig) this.folioServerSig.delete(folio.id);
        throw e;
      }
      if (saved?.id) {
        this.folioServerSig.set(saved.id, folioSignature(saved));
        const idx = this.folios.findIndex((f) => f.id === saved.id);
        if (idx >= 0) this.folios[idx] = saved;
        else this.folios.unshift(saved);
        this.notify();
      }
    });
  }

  // Pulls reservations + guests from the database and adopts them when present.
  // During the transition we only replace local data when the server has rows,
  // so an empty DB doesn't wipe seed data.
  //
  // Throttled at the source (not just in refreshFromApi's focus/visibility
  // wrapper) because subscribe() also reaches this indirectly via
  // ensureHydratedFromApi() — every new subscriber's mount effect notifying
  // (housekeeping, orders, kitchen ops, etc.) can cascade into re-subscribing
  // this store too, and without a floor here that turns into the same
  // uncontrolled repeat-fetch loop refreshFromApi's throttle was added for.
  private async pullFromApi(force = false) {
    if (this.pullInFlight) return this.pullInFlight;
    if (!force && Date.now() - this.lastRefreshFromApiAt < FrontOfficeStore.MIN_REFRESH_INTERVAL_MS) return;
    this.lastRefreshFromApiAt = Date.now();
    let job!: Promise<void>;
    job = this.runPullFromApi().finally(() => {
      if (this.pullInFlight === job) this.pullInFlight = null;
    });
    this.pullInFlight = job;
    return job;
  }

  private async runPullFromApi() {
    const t = this.tenant(); if (!t) return;
    // A refresh must never show an edit going back to its old value: wait for saves still on
    // their way, and skip this round's copy if a new save was made while it loaded.
    try { await this.writeQueue; } catch {}
    const writesAtStart = this.writesStarted;
    const savedMeanwhile = () => this.writesStarted !== writesAtStart;
    try {
      const res = await fetch('/api/reservations', { headers: { 'x-tenant-subdomain': t } });
      if (res.ok && !savedMeanwhile()) {
        const data = await res.json();
        if (Array.isArray(data.reservations)) {
          // Merge by id (like guests/folios below) instead of replacing the array
          // wholesale. A reservation created locally moments before this GET
          // resolves may not have finished its own async POST to the server yet;
          // a wholesale replace would silently drop it from view until whatever
          // later refresh happens to catch it after the POST lands.
          const byId = new Map<string, Reservation>();
          this.reservations.forEach((r) => byId.set(r.id, r));
          data.reservations.forEach((r: Reservation) => byId.set(r.id, this.ensureReservationRates(r)));
          // The tenant has real reservations now, so the placeholder demo ones (initializeSampleReservations)
          // no longer serve their purpose — a fixed set of fake ids (never persisted server-side) that would
          // otherwise sit in this merge forever, since nothing with a matching id ever arrives to replace them.
          demoReservationIds.forEach((id) => byId.delete(id));
          // The server is the record. A stay it doesn't have was removed (or cleared) there,
          // unless this browser made it moments ago and its save is still on the way.
          const serverResIds = new Set(data.reservations.map((r: Reservation) => r.id));
          byId.forEach((r, id) => { if (!serverResIds.has(id) && !isFreshLocal(r)) byId.delete(id); });
          this.reservations = Array.from(byId.values());
          // First-night room charges and the gl_pending retry both read folios, so
          // they run at the end of this pull, once /api/folios has landed — see below.
          // The resId counter only lives in this browser's localStorage — raise it past
          // whatever the server already has so a fresh/reset browser can't hand out a
          // resId a previous session already used (root cause of duplicate resIds).
          try { useSettingsStore.getState().reconcileNumberFloor('reservation', this.reservations.map((r) => r.resId)); } catch {}
          this.notify();
        }
      }
    } catch (e) { console.warn('FO: reservation sync failed', e); }
    try {
      const res = await fetch('/api/guests?includeInactive=true', { headers: { 'x-tenant-subdomain': t } });
      if (res.ok && !savedMeanwhile()) {
        const data = await res.json();
        if (Array.isArray(data.guests)) {
          const byId = new Map<string, GuestProfile>();
          const serverGuestIds = new Set(data.guests.map((g: GuestProfile) => g.id));
          this.guests.forEach(g => { if (serverGuestIds.has(g.id) || isFreshLocal(g)) byId.set(g.id, g); });
          data.guests.forEach((g: GuestProfile) => byId.set(g.id, g));
          this.guests = Array.from(byId.values());
          try { useSettingsStore.getState().reconcileNumberFloor('client', this.guests.map((g) => g.serialNumber)); } catch {}
          this.notify();
        }
      }
    } catch (e) { console.warn('FO: guest sync failed', e); }
    try {
      const res = await fetch('/api/folios', { headers: { 'x-tenant-subdomain': t } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.folios)) {
          const byId = new Map<string, Folio>();
          this.folios.forEach(f => byId.set(f.id, f));
          data.folios.forEach((f: Folio) => {
            // This GET can be in flight when a local charge/payment lands (e.g. via
            // addCharge -> updateFolioBalances -> persistFolio) and resolve with a
            // snapshot taken before that write reached the database — blindly
            // preferring the server copy would silently erase the just-added line
            // (a swimming pool charge, say) the moment this pull's response arrives.
            // Keep whichever copy actually has more charges/payments recorded.
            const local = byId.get(f.id);
            const localCount = (local?.charges?.length || 0) + (local?.payments?.length || 0);
            const serverCount = (f.charges?.length || 0) + (f.payments?.length || 0);
            byId.set(f.id, serverCount >= localCount ? f : (local as Folio));
            if (serverCount >= localCount) this.folioServerSig.set(f.id, folioSignature(f));
          });
          // A folio the server has never seen (no signature) for a reservation the
          // server already has a main folio for is a phantom: getOrCreateFolio() made
          // it (and ensureFolioRoomCharges may have put a Room Charge on it) before
          // this fetch landed. Keeping it let findMainFolio pick it over the real
          // one, and the next updateFolioBalances() persisted it as yet another
          // GuestFolio row — one per checked-in reservation per page load.
          const serverMainFor = new Set(
            (data.folios as Folio[]).filter((f) => f.type !== 'split').map((f) => f.reservationId),
          );
          const serverIds = new Set((data.folios as Folio[]).map((f) => f.id));
          byId.forEach((f, id) => {
            if (!serverIds.has(id) && f.type !== 'split' && serverMainFor.has(f.reservationId) && !this.folioServerSig.has(id)) {
              byId.delete(id);
            }
          });
          // A bill the server doesn't have, for a stay that is no longer here, was cleared.
          const liveResIds = new Set(this.reservations.map((r) => r.id));
          byId.forEach((f, id) => { if (!serverIds.has(id) && !liveResIds.has(f.reservationId)) byId.delete(id); });
          this.folios = Array.from(byId.values());
          try { useSettingsStore.getState().reconcileNumberFloor('folio', this.folios.map((f) => f.id)); } catch {}
          this.notify();
        }
      }
    } catch (e) { console.warn('FO: folio sync failed', e); }
    try {
      const res = await fetch('/api/frontoffice/day-ledger', { headers: { 'x-tenant-subdomain': t } });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.currentBusinessDate === 'string') {
          this.businessDate = data.currentBusinessDate;
          this.businessDateSynced = true;
          this.persistNightAuditState();
        }
      }
    } catch (e) { console.warn('FO: business date sync failed', e); }
    const [services, groups] = await Promise.all([
      loadRecords<FrontOfficeStore['clientServices'][number]>('fo.clientService'),
      loadRecords<FrontOfficeStore['inHouseGroups'][number]>('fo.inHouseGroup'),
    ]);
    if (services) { this.clientServices = services; this.clientServiceSync.prime(services); }
    if (groups) { this.inHouseGroups = groups; this.inHouseGroupSync.prime(groups); }
    if (services || groups) this.notify();
    // Reached only once the reservations/guests/folios fetches above have all
    // been attempted (success or failure) — see the hydrationComplete field
    // comment for why persistFolio needs this instead of hydratedFromApi.
    this.hydrationComplete = true;
    // This browser's saved guest list now matches the server (cleared guests drop out).
    this.persistGuests();
    this.reservations.forEach((r) => {
      if (r.status === 'checked-in') {
        try { this.ensureFolioRoomCharges(r.id); } catch {}
      }
    });
    // A prior checkout may have failed only at the GL-post step (invoiceStatus
    // stuck at 'gl_pending'); retry those now that folios/reservations are fresh.
    try { this.retryAllPendingGlPosts(); } catch (e) { console.warn('FO: retryAllPendingGlPosts failed', e); }
  }

  // Hydrate once on the client, then keep fresh when the tab regains focus so
  // multiple front-desk terminals converge on the database state.
  private ensureHydratedFromApi() {
    if (this.hydratedFromApi || typeof window === 'undefined') return;
    this.hydratedFromApi = true;
    void this.pullFromApi();
    window.addEventListener('focus', () => { void this.refreshFromApi(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.refreshFromApi();
    });
  }

  // Drain pending writes, then re-pull so a refresh never clobbers unsaved edits.
  // Wired to window focus/visibilitychange (see ensureHydratedFromApi) — the
  // actual rate limiting against overly-frequent triggers lives in
  // pullFromApi() itself, since that's reachable through more than one path.
  private static readonly MIN_REFRESH_INTERVAL_MS = 10_000;
  async refreshFromApi(opts?: { force?: boolean }) {
    if (typeof window === 'undefined') return;
    try { await this.writeQueue; } catch {}
    await this.pullFromApi(!!opts?.force);
  }

  /**
   * While a front-desk screen is open: load immediately, then every 15s.
   * Clicking back into the window still refreshes through the focus listener.
   * Callers must pair begin with end (a refcount, so nested screens share one timer).
   */
  beginLiveRefresh() {
    if (typeof window === 'undefined') return;
    this.ensureHydratedFromApi();
    this.liveRefreshUsers += 1;
    if (this.liveRefreshUsers !== 1) return;
    void this.refreshFromApi({ force: true });
    this.liveRefreshTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void this.refreshFromApi();
    }, FrontOfficeStore.LIVE_REFRESH_MS);
  }

  endLiveRefresh() {
    this.liveRefreshUsers = Math.max(0, this.liveRefreshUsers - 1);
    if (this.liveRefreshUsers > 0 || this.liveRefreshTimer == null) return;
    window.clearInterval(this.liveRefreshTimer);
    this.liveRefreshTimer = null;
  }
  notify() {
    // Only persist after initial hydration to avoid overwriting stored data with empty arrays
    if (this.hydratedGuests) {
      try { this.persistGuests(); } catch {}
    }
    this.listeners.forEach(l => l());
  }

  private persistGuests() {
    try {
      if (typeof window !== 'undefined') {
        const serialized = JSON.stringify(this.guests);
        const existing = localStorage.getItem('fo.guests');
        // Avoid overwriting non-empty storage with empty before the server has answered.
        if (this.guests.length === 0 && existing && !this.hydrationComplete) {
          const parsed = JSON.parse(existing);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return;
          }
        }
        localStorage.setItem('fo.guests', serialized);
        try { sessionStorage.setItem('fo.guests', serialized); } catch {}
      }
    } catch (e) {
      console.warn('FO: Failed to persist guests', e);
    }
  }

  // Mirror rooms from Settings -> Front Office
  //
  // Subscribed to the ENTIRE settings store (see the constructor), so this
  // runs on every settings change, not just room-related ones — including a
  // folio-numbering counter bump from getOrCreateFolio(). Notifying
  // unconditionally on every call turned that into a reentrant loop: this
  // store's own notify() re-runs any subscriber that creates a folio (e.g.
  // check-outs' loadCheckOuts), which bumps the counter again, which
  // triggers this subscription again — recursing until the call stack
  // overflows. Only notify when rooms/roomTypes/ratePlans actually changed.
  syncRoomsFromSettings() {
    try {
      const settings = useSettingsStore.getState();
      const cfgRooms = settings.roomManagement.rooms || [];
      // Sync room types and rate plans from settings so FO has authoritative data
      const cfgRoomTypes = settings.roomManagement.roomTypes || [];
      const cfgRatePlans = settings.roomManagement.ratePlans || [];
      const nextRoomTypes = cfgRoomTypes.map(rt => ({ id: rt.id, name: rt.name, baseRate: rt.baseRate }));
      const nextRatePlans = cfgRatePlans.map(rp => ({
        id: rp.id,
        name: rp.name,
        roomTypeId: rp.roomTypeId,
        basePrice: rp.basePrice,
        price: rp.basePrice,
        priceType: (rp as { priceType?: string }).priceType,
        isActive: rp.isActive,
        marketSegment: rp.marketSegment,
        rateType: rp.rateType as any,
        eventSpecific: rp.eventSpecific,
        restrictions: rp.restrictions,
        seasonalRates: rp.seasonalRates,
        dayOfWeekRates: rp.dayOfWeekRates
      }));
      const mapped = cfgRooms.map(r => ({
        id: r.number,
        roomTypeId: r.typeId,
        floor: r.floor || ''
      }));

      const roomsChanged = JSON.stringify(mapped) !== JSON.stringify(this.rooms);
      const roomTypesChanged = JSON.stringify(nextRoomTypes) !== JSON.stringify(this.roomTypes);
      const ratePlansChanged = JSON.stringify(nextRatePlans) !== JSON.stringify(this.ratePlans);
      if (!roomsChanged && !roomTypesChanged && !ratePlansChanged) return;

      this.roomTypes = nextRoomTypes;
      this.ratePlans = nextRatePlans;
      this.rooms = mapped;
      this.notify();
      if (roomsChanged) trackEvent('FO.Rooms.SyncedFromSettings', { count: mapped.length });
      if (ratePlansChanged) trackEvent('FO.RatePlans.SyncedFromSettings' as any, { count: this.ratePlans.length });
      if (roomTypesChanged) trackEvent('FO.RoomTypes.SyncedFromSettings' as any, { count: this.roomTypes.length });
    } catch (e) {
      console.error('FO: Failed to sync rooms from settings', e);
    }
  }

  // Room management (in-memory for now)
  addRoom(room: { id: string; roomTypeId: string; floor?: string }) {
    // Prevent duplicates by id
    if (this.rooms.some(r => r.id === room.id)) {
      return;
    }
    this.rooms = [...this.rooms, { id: room.id, roomTypeId: room.roomTypeId, floor: room.floor }];
    this.notify();
    trackEvent('FO.Room.Created', { id: room.id, roomTypeId: room.roomTypeId, floor: room.floor });
  }

  // Load reservations from API and map to local model
  async syncReservationsFromApi(tenantSubdomain: string) { return apiHelpers.syncReservationsFromApi(this as any, tenantSubdomain); }

  // Create reservation via API helpers
  async createGuestAndReservationViaApi(tenantSubdomain: string, payload: { guestName: string; guestPhone?: string; guestEmail?: string; arrival: string; departure: string; adults?: number; children?: number; source?: string; }) { return apiHelpers.createGuestAndReservationViaApi(this as any, tenantSubdomain, payload); }

  createGuest(g: Omit<GuestProfile,'id'|'serialNumber'>) {
    const settings = useSettingsStore.getState();
    const serialNumber = settings.getNextModuleNumber(
      'frontOffice',
      isCorporateGuest(g) ? 'corporateGuest' : 'personalGuest',
    );
    const guest: GuestProfile = { 
      ...g, 
      id: genId('G'),
      createdAt: g.createdAt || new Date().toISOString(),
      serialNumber,
      isActive: g.isActive !== false,
      // Generate self-reservation token
      selfReservationToken: this.generateSelfCheckinToken(),
      selfReservationExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };
    this.guests.push(guest);
    this.persistGuests();
    this.notify();
    trackEvent('FO.Guest.Created', { 
      id: guest.id, 
      serialNumber: guest.serialNumber, 
      name: `${guest.firstName} ${guest.lastName}` 
    });
    try {
      logAudit({
        area: 'frontdesk',
        action: 'create',
        entity: 'Client',
        entityId: guest.id,
        details: `Created client ${guest.firstName} ${guest.lastName}`,
        severity: 'low',
        meta: { serialNumber: guest.serialNumber, nationality: guest.nationality }
      });
    } catch {}
    this.persistNewGuest(guest);
    return guest;
  }

  generateSelfCheckinToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  getGuestBySelfCheckinToken(token: string): GuestProfile | null {
    return this.guests.find(g => g.selfReservationToken === token && 
      (!g.selfReservationExpiry || new Date(g.selfReservationExpiry) > new Date())) || null;
  }

  getBusinessDate(): string {
    return this.businessDate;
  }

  /** The automatic close must not use the clock date before the server date has loaded. */
  hasServerBusinessDate(): boolean {
    return this.businessDateSynced;
  }

  // Deferred to after mount (see subscribe()), not read synchronously in the
  // constructor — the constructor also runs during SSR, and a stored
  // businessDate that has drifted from the server's default "today" would
  // make the client's first render diverge from the SSR-ed HTML and fail
  // hydration (React then discards and regenerates the whole tree).
  //
  // subscribe() itself isn't a safe-enough gate on its own: other store
  // singletons (e.g. housekeeping/store.ts) call frontOfficeStore.subscribe()
  // synchronously in their own module-scope constructor, which on the client
  // runs while the page's JS bundle is still loading — before React's first
  // hydration render even starts. The setTimeout pushes the actual state
  // load past that synchronous window, so it can never win the race against
  // the hydration diff no matter which caller triggers subscribe() first.
  private ensureHydratedNightAuditState() {
    if (this.hydratedNightAuditState || typeof window === 'undefined') return;
    this.hydratedNightAuditState = true;
    setTimeout(() => {
      this.loadNightAuditState();
      this.notify();
    }, 0);
  }

  private loadNightAuditState() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('fo.nightAudit');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.businessDate && !this.businessDateSynced) this.businessDate = parsed.businessDate;
      if (Array.isArray(parsed.nightAuditHistory)) this.nightAuditHistory = parsed.nightAuditHistory;
      if (parsed.lastNightAuditAt) this.lastNightAuditAt = parsed.lastNightAuditAt;
      if (Array.isArray(parsed.wakeUpCalls)) this.wakeUpCalls = parsed.wakeUpCalls;
    } catch {}
  }

  persistNightAuditState() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        'fo.nightAudit',
        JSON.stringify({
          businessDate: this.businessDate,
          nightAuditHistory: this.nightAuditHistory,
          lastNightAuditAt: this.lastNightAuditAt,
          wakeUpCalls: this.wakeUpCalls,
        }),
      );
    } catch {}
  }

  scheduleWakeUpCall(reservationId: string, date: string, time: string, notes?: string) {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res) return null;
    const call: import('./types').WakeUpCall = {
      id: genId('WC'),
      reservationId,
      guestName: res.guestName,
      roomNumber: res.roomId || 'TBD',
      date,
      time,
      status: 'scheduled',
      notes,
      createdAt: new Date().toISOString(),
    };
    this.wakeUpCalls = [call, ...this.wakeUpCalls];
    this.persistNightAuditState();
    this.notify();
    return call;
  }

  completeWakeUpCall(id: string, completedBy?: string) {
    this.wakeUpCalls = this.wakeUpCalls.map(c => c.id === id ? { ...c, status: 'completed', completedBy: completedBy || 'Front Desk' } : c);
    this.persistNightAuditState();
    this.notify();
  }

  cancelWakeUpCall(id: string) {
    this.wakeUpCalls = this.wakeUpCalls.map(c => c.id === id ? { ...c, status: 'cancelled' } : c);
    this.persistNightAuditState();
    this.notify();
  }

  /** End-of-day close — server posts room charges onto GuestFolio, then reconstructs the day. */
  async executeNightAudit(): Promise<NightAuditResult> {
    const failed = (error: string): NightAuditResult => ({
      id: `NA-${this.businessDate}-fail`,
      businessDate: this.businessDate,
      completedAt: new Date().toISOString(),
      roomChargesPosted: 0,
      noShowsProcessed: 0,
      checkedInCount: 0,
      folioChargesTotal: 0,
      folioPaymentsTotal: 0,
      status: 'failed',
      error,
    });
    const t = this.tenant();
    if (!t) return failed('Missing tenant');
    try {
      const res = await fetch('/api/frontoffice/night-audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-subdomain': t },
        body: JSON.stringify({ businessDate: this.businessDate }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) return failed(data.error || `HTTP ${res.status}`);
      const r = data.result || {};
      const run: NightAuditResult = {
        id: r.logId || `NA-${r.businessDate}`,
        businessDate: r.businessDate,
        completedAt: r.completedAt,
        roomChargesPosted: r.roomChargesPosted || 0,
        noShowsProcessed: r.noShowsMarked || 0,
        checkedInCount: r.checkedInCount || 0,
        folioChargesTotal: r.folioChargesTotal || 0,
        folioPaymentsTotal: r.folioPaymentsTotal || 0,
        status: r.status === 'failed' ? 'failed' : 'completed',
        error: Array.isArray(r.errors) && r.errors.length ? r.errors.join('; ') : undefined,
        daysClosed: Array.isArray(r.daysClosed) ? r.daysClosed : undefined,
      };
      if (r.nextBusinessDate) this.businessDate = r.nextBusinessDate;
      this.lastNightAuditAt = run.completedAt;
      this.nightAuditHistory = [run, ...(this.nightAuditHistory || [])].slice(0, 30);
      this.persistNightAuditState();
      this.notify();
      await this.refreshFromApi();
      return run;
    } catch (e) {
      return failed(e instanceof Error ? e.message : String(e));
    }
  }

  createBillingPerson(bp: Omit<BillingPerson,'id'|'createdAt'|'updatedAt'>) {
    const billingPerson: BillingPerson = {
      ...bp,
      id: genId('BP'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.billingPersons.push(billingPerson);
    this.notify();
    trackEvent('FO.BillingPerson.Created', { 
      id: billingPerson.id, 
      name: billingPerson.name, 
      company: billingPerson.company,
      relationship: billingPerson.billingRelationship 
    });
    return billingPerson;
  }

  updateBillingPerson(bp: BillingPerson) {
    const index = this.billingPersons.findIndex(x => x.id === bp.id);
    if (index !== -1) {
      this.billingPersons[index] = { ...bp, updatedAt: new Date().toISOString() };
      this.notify();
      trackEvent('FO.BillingPerson.Updated', { 
        id: bp.id, 
        name: bp.name, 
        company: bp.company,
        relationship: bp.billingRelationship 
      });
    }
    return this.billingPersons[index];
  }

  deleteBillingPerson(id: string) {
    const index = this.billingPersons.findIndex(x => x.id === id);
    if (index !== -1) {
      const deleted = this.billingPersons.splice(index, 1)[0];
      this.notify();
      trackEvent('FO.BillingPerson.Deleted', { 
        id: deleted.id, 
        name: deleted.name, 
        company: deleted.company 
      });
      return deleted;
    }
    return null;
  }

  // Client Services management
  addClientService(service: {
    id: string;
    clientId: string;
    serviceName: string;
    serviceType: 'amenity' | 'package' | 'contract';
    rate: number;
    notes?: string;
    contractStart?: string;
    contractEnd?: string;
    status: 'active' | 'inactive' | 'expired';
    isActive: boolean;
    createdAt: string;
  }) {
    this.clientServices.push(service);
    this.clientServiceSync.push(this.clientServices);
    this.notify();
    trackEvent('FO.ClientService.Added' as any, { clientId: service.clientId, serviceName: service.serviceName, type: service.serviceType });
    return service;
  }

  updateClientService(serviceId: string, updates: Partial<{ serviceName: string; serviceType: 'amenity'|'package'|'contract'; rate: number; notes?: string; contractStart?: string; contractEnd?: string; status: 'active'|'inactive'|'expired'; isActive: boolean; }>) {
    const idx = this.clientServices.findIndex(s => s.id === serviceId);
    if (idx === -1) return null;
    this.clientServices[idx] = { ...this.clientServices[idx], ...updates };
    this.clientServiceSync.push(this.clientServices);
    this.notify();
    trackEvent('FO.ClientService.Updated' as any, { id: serviceId });
    return this.clientServices[idx];
  }

  deleteClientServicesForClient(clientId: string) {
    const before = this.clientServices.length;
    this.clientServices = (this.clientServices || []).filter(s => s.clientId !== clientId);
    const removed = before - this.clientServices.length;
    this.clientServiceSync.push(this.clientServices);
    this.notify();
    if (removed > 0) trackEvent('FO.ClientService.DeletedForClient' as any, { clientId, removed });
  }

  getNextClientNumber(): string {
    const settings = useSettingsStore.getState();
    return settings.getNextClientNumber();
  }

  createReservation(r: Omit<Reservation,'id'|'createdAt'|'updatedAt'|'status'> & { status?: Reservation['status'] }) {
    // Ensure required fields have default values
    const settings = useSettingsStore.getState();
    const reservation: Reservation = {
      ...r,
      id: genId('R'),
      resId: settings.getNextReservationNumber(),
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString(), 
      status: r.status || 'pending',
      stayReason: r.stayReason || 'personal',
      adults: r.adults || 1,
      children: r.children || 0
    };
    this.ensureReservationRates(reservation);
    const quotedStay = this.getReservationQuote(reservation).grandTotal;
    const depositPaid = reservation.deposit?.amount || 0;
    if (depositBlocksConfirm(depositPaid, requiredDeposit(quotedStay, settings.roomManagement), settings.roomManagement)) {
      reservation.status = 'pending';
    }

    this.reservations.unshift(reservation); 
    this.notify(); 
    
    // Enhanced tracking with new fields
    trackEvent('FO.Reservation.Created', { 
      id: reservation.id, 
      guest: reservation.guestName, 
      arrival: reservation.arrival, 
      departure: reservation.departure,
      stayReason: reservation.stayReason,
      hasBillingPerson: !!reservation.billingPersonId,
      companyName: reservation.companyName
    }); 

    this.persistNewReservation(reservation);
    return reservation;
  }

  updateReservation(res: Reservation) { this.reservations = this.reservations.map(r => r.id === res.id ? { ...res, updatedAt: new Date().toISOString() } : r); this.notify(); trackEvent('FO.Reservation.Updated', { id: res.id }); this.persistReservationPatch(res.id, res); }
  cancelReservation(id: string) {
    const settingsState = (() => { try { return useSettingsStore.getState(); } catch { return undefined as any; } })();
    const policy = settingsState?.roomManagement;
    this.reservations = this.reservations.map(r => r.id === id ? { ...r, status: 'cancelled', updatedAt: new Date().toISOString() } : r);
    this.notify();
    trackEvent('FO.Reservation.Cancelled', { id });
    this.persistReservationPatch(id, { status: 'cancelled' });
    try {
      if (policy?.cancellationPolicyEnabled) {
        const res = this.reservations.find(r => r.id === id);
        if (!res) return;
        // Compute hours before arrival
        const arrival = new Date(res.arrival);
        const now = new Date();
        const diffHrs = (arrival.getTime() - now.getTime()) / 36e5;
        if (diffHrs < (policy.freeCancellationHours ?? 0)) {
          // Late cancellation → post penalty according to fee type
          const folio = this.getOrCreateFolio(id);
          const breakdown = res.rateBreakdown || [];
          const nightlyNet = breakdown[0]?.base ?? 0;
          const nightlyGross = breakdown[0]?.total ?? nightlyNet;
          const stayNet = breakdown.reduce((s, d) => s + (d.base || 0), 0);
          const stayGross = breakdown.reduce((s, d) => s + (d.total || 0), 0);
          let penalty = 0;
          let quotedTax: number | undefined;
          switch (policy.lateCancellationFeeType) {
            case 'first_night':
              penalty = nightlyNet;
              quotedTax = res.taxExempt ? 0 : roundCents(Math.max(0, nightlyGross - nightlyNet));
              break;
            case 'percent_reservation': {
              const penaltyGross = Math.max(0, ((policy.lateCancellationFeeValue || 0) / 100) * stayGross);
              const ratio = stayGross > 0 ? penaltyGross / stayGross : 0;
              penalty = roundCents(stayNet * ratio);
              quotedTax = res.taxExempt ? 0 : roundCents(Math.max(0, penaltyGross - penalty));
              break;
            }
            case 'flat': penalty = Math.max(0, policy.lateCancellationFeeValue || 0); break;
            default: penalty = 0;
          }
          if (penalty > 0) {
            this.addFolioCharge(folio.id, {
              id: genId('C'),
              description: 'Cancellation Penalty',
              amount: penalty,
              ...(quotedTax != null ? { tax: quotedTax } : {}),
              category: 'room',
            });
          }
        }
      }
    } catch {}
  }

  deleteReservation(id: string) {
    const res = this.reservations.find(r => r.id === id);
    if (!res || res.status !== 'pending') return false;
    const folio = this.folios?.find(f => f.id === id);
    const hasMoney = (folio?.charges?.length || 0) > 0 || (folio?.payments?.length || 0) > 0;
    if (hasMoney) return false;
    this.reservations = this.reservations.filter(r => r.id !== id);
    this.folios = (this.folios || []).filter(f => f.id !== id);
    this.notify();
    trackEvent('FO.Reservation.Deleted', { id });
    const t = this.tenant();
    if (t) this.enqueueWrite(() => apiHelpers.deleteReservationViaApi(t, id));
    return true;
  }

  /**
   * True once a stay's money is in Accounting: the checkout invoice (with its
   * journal entries) or a night-audit no-show penalty. Voiding the folio alone
   * would leave that revenue and cash in the books, so such a stay is reversed
   * in Accounting → Accounts Receivable instead.
   */
  stayPostedToBooks(id: string) {
    const res = this.reservations.find(r => r.id === id);
    if (!res) return false;
    if (res.invoiceGenerated) return true;
    if (res.status === 'no-show') {
      const folio = this.folios?.find(f => f.id === id);
      return (folio?.charges?.length || 0) > 0 || (folio?.payments?.length || 0) > 0;
    }
    return false;
  }

  voidReservation(id: string, reason = 'Void') {
    const res = this.reservations.find(r => r.id === id);
    if (!res || res.status === 'void' || res.status === 'cancelled' || res.status === 'pending') return false;
    if (this.stayPostedToBooks(id)) return false;
    const folio = this.getOrCreateFolio(id);
    for (const charge of [...(folio.charges || [])]) {
      if (String(charge.description || '').startsWith('VOID ')) continue;
      if ((charge.amount || 0) < 0) continue;
      this.voidCharge(id, charge.id, reason);
    }
    for (const payment of [...(folio.payments || [])]) {
      if ((payment as any).status === 'completed') {
        this.refundPayment(id, payment.id, payment.amount, reason);
      }
    }
    const roomId = res.roomId && res.roomId !== 'TBD' ? res.roomId : '';
    if (roomId && (res.status === 'checked-in' || res.status === 'checked-out')) {
      try { housekeepingStore.updateRoomStatus(roomId, 'dirty', 'FrontDesk', 'Stay voided'); } catch {}
    }
    this.reservations = this.reservations.map(r => r.id === id ? { ...r, status: 'void', roomId: '', updatedAt: new Date().toISOString() } : r);
    this.notify();
    trackEvent('FO.Reservation.Voided', { id });
    this.persistReservationPatch(id, { status: 'void', roomId: '' });
    return true;
  }

  assignRoom(id: string, roomId: string, options?: { keepRate?: boolean }) {
    const stay = this.reservations.find((r) => r.id === id);
    const previous = stay?.roomId && stay.roomId !== 'TBD' ? stay.roomId : '';
    const moving = !!previous && previous !== roomId && !!roomId && roomId !== 'TBD';
    const keepRate = options?.keepRate !== false;
    const today = localStayDate();
    const nextTypeId = this.rooms.find((room) => room.id === roomId)?.roomTypeId;
    this.reservations = this.reservations.map((r) => {
      if (r.id !== id) return r;
      if (!moving) return { ...r, roomId };
      const repriced = !keepRate && nextTypeId
        ? new Map(this.calculateRateBreakdown(nextTypeId, r.arrival, r.departure, undefined, undefined, r.taxExempt).map((night) => [night.date.slice(0, 10), night]))
        : null;
      const rateBreakdown = (r.rateBreakdown || []).map((night) => {
        const date = night.date.slice(0, 10);
        if (date < today) return { ...night, roomId: night.roomId || previous };
        const next = repriced?.get(date);
        return next ? { ...night, roomId, base: next.base, total: next.total } : { ...night, roomId };
      });
      return { ...r, roomId, roomTypeId: nextTypeId || r.roomTypeId, rateBreakdown };
    });
    this.notify();
    const next = this.reservations.find((r) => r.id === id);
    this.persistReservationPatch(id, moving
      ? { roomId, roomTypeId: next?.roomTypeId, rateBreakdown: next?.rateBreakdown }
      : { roomId });
  }

  // Date-range availability against the hydrated in-memory reservations. Mirrors
  // the server-authoritative check so the UI never assigns a room that already
  // has an overlapping active booking (the API guard is the backstop).
  isRoomFreeForRange(roomNumber: string, arrival: string, departure: string, excludeId?: string): boolean {
    const requested = new Set(stayNightDates(arrival, departure));
    if (requested.size === 0) return true;
    return !this.reservations.some(r =>
      r.id !== excludeId &&
      r.roomId === roomNumber &&
      // Same statuses the server treats as holding a room (isRoomAvailable).
      (r.status === 'pending' || r.status === 'confirmed' || r.status === 'checked-in') &&
      stayNightDates(r.arrival, r.departure).some((night) => requested.has(night))
    );
  }

  // Smart room selection: among rooms of the reservation's type that are vacant
  // AND free for the stay's dates, prefer those matching the guest's stored
  // preferences (floor, accessibility) and VIP status.
  pickOptimalRoomNumber(res: Reservation): string | undefined {
    try {
      const ready = housekeepingStore.getRoomsReadyToAssign();
      const matchingReady = ready.filter(room => room.roomTypeId === res.roomTypeId);
      const vacant = matchingReady.length > 0 ? matchingReady : ready;
      // Exclude rooms with a date-overlapping active reservation
      const candidates = vacant.filter(room =>
        this.isRoomBookable(room.roomNumber) &&
        this.isRoomFreeForRange(room.roomNumber, res.arrival, res.departure, res.id)
      );
      if (candidates.length === 0) return undefined;

      const guest = this.guests.find(g => g.id === res.guestId);
      const prefs = guest?.preferences;
      const isVip = !!(guest?.vipStatus && guest.vipStatus !== 'none');

      const scoreFor = (roomNumber: string): number => {
        const attrs = this.rooms.find(r => r.id === roomNumber);
        const floorNum = parseInt(attrs?.floor || '0', 10);
        let score = 50;
        if (prefs?.preferredFloor === 'high' || isVip) score += floorNum * 10;
        if (prefs?.preferredFloor === 'low') score += Math.max(0, 30 - floorNum * 10);
        if (prefs?.disability && attrs?.accessible) score += 100;
        return score;
      };

      return [...candidates]
        .sort((a, b) => scoreFor(b.roomNumber) - scoreFor(a.roomNumber))[0]?.roomNumber;
    } catch {
      return undefined;
    }
  }

  checkIn(id: string, options?: { leaveRoomOpen?: boolean }) {
    const res = this.reservations.find(r => r.id === id);

    // Auto-assign a room if none is assigned yet so Check-Ins view reflects immediately.
    // leaveRoomOpen is the clerk's override: check in and keep the room unassigned.
    let assignedRoomId = (res?.roomId && res.roomId !== 'TBD') ? res.roomId : undefined;
    const shouldAutoAssign = !options?.leaveRoomOpen && autoAssignRoomsEnabled();
    try {
      if (!assignedRoomId && res && shouldAutoAssign) {
        assignedRoomId = this.pickOptimalRoomNumber(res);
      }
    } catch {}

    const checkedInAt = assignedRoomId ? new Date().toISOString() : undefined;
    this.reservations = this.reservations.map(r =>
      r.id === id
        ? {
            ...r,
            status: 'checked-in',
            roomId: assignedRoomId || r.roomId || 'TBD',
            updatedAt: new Date().toISOString(),
            ...(assignedRoomId ? { checkInTime: new Date().toISOString(), checkedInAt } : {})
          }
        : r
    );
    this.notify();
    // POST_NIGHTLY_VIA_AUDIT: optional first night at check-in (setting); else night audit only.
    try {
      const rm = useSettingsStore.getState().roomManagement;
      if (rm?.postFirstNightAtCheckin) {
        postFirstNightAtCheckIn(this as any, id);
      }
    } catch (e) {
      console.warn('FO: first-night room charge failed', e);
    }

    if (assignedRoomId) {
      try { housekeepingStore.updateRoomStatus(assignedRoomId, 'occupied', 'FrontDesk', `Guest ${res?.guestName || ''} checked in`); } catch {}
    }

    trackEvent('FO.Reservation.CheckedIn', { id, autoAssignedRoom: !!assignedRoomId, autoAssignEnabled: shouldAutoAssign });
    try {
      const checkInEventId = genId('EVT-CI');
      logAudit({
        area: 'frontdesk',
        action: 'status',
        entity: 'Reservation',
        entityId: id,
        details: 'Reservation checked in',
        meta: { eventId: checkInEventId, eventType: 'check-in', autoAssignedRoom: assignedRoomId }
      });
    } catch {}
    this.persistReservationPatch(id, {
      status: 'checked-in',
      roomId: assignedRoomId || res?.roomId || 'TBD',
      ...(checkedInAt ? { checkedInAt } : {}),
    });
  }
  private applyEarlyCheckoutAdjustments(reservationId: string) {
    const res = this.reservations.find(r => r.id === reservationId);
    const settingsState = (() => { try { return useSettingsStore.getState(); } catch { return undefined as any; } })();
    const policy = settingsState?.roomManagement;
    if (!policy?.earlyCheckoutPolicyEnabled || !res) return;

    const folio = this.getOrCreateFolio(reservationId);
    const plan = planEarlyCheckout(folio.charges || [], policy);
    if (plan.remove.length > 0) {
      folio.charges = plan.keep;
      this.updateFolioBalances(folio);
      try { trackEvent('FO.Folio.RoomChargesRemovedEarlyCheckout' as any, { reservationId, removed: plan.remove.length }); } catch {}
      const note = policy.earlyCheckoutNote ? ` ${policy.earlyCheckoutNote}` : '';
      try { logAudit({ area: 'frontdesk', action: 'update', entity: 'Folio', entityId: reservationId, details: `Removed ${plan.remove.length} unused room charge(s) due to early checkout.${note}`, severity: 'medium' }); } catch {}
    }
    if (plan.penalty > 0) {
      this.addFolioCharge(folio.id, {
        id: genId('C'),
        description: 'Early Checkout Penalty',
        amount: plan.penalty,
        category: 'room',
      });
    }
  }

  private finalizeCheckout(reservationId: string, checkoutNotes?: string) {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res) return;

    try { this.applyEarlyCheckoutAdjustments(reservationId); } catch {}

    const checkedOutAt = new Date().toISOString();
    res.status = 'checked-out';
    res.updatedAt = checkedOutAt;
    (res as any).checkOutTime = checkedOutAt;
    res.checkedOutAt = checkedOutAt;
    if (checkoutNotes !== undefined) (res as any).checkoutNotes = checkoutNotes;

    this.notify();

    if (res.roomId) {
      try {
        housekeepingStore.updateRoomStatus(res.roomId, 'dirty', 'FrontDesk', 'Guest checked out');
        housekeepingStore.createTask({ roomNumber: res.roomId, roomTypeId: res.roomTypeId, taskType: 'turnover', priority: 'high', estimatedMinutes: 45, checklist: ['Change linens', 'Clean bathroom', 'Vacuum floor', 'Restock amenities'] });
      } catch {}
    }

    trackEvent('FO.Reservation.CheckedOut', { id: reservationId, reservationId, guestName: res.guestName, checkoutNotes });
    try {
      const checkOutEventId = genId('EVT-CO');
      logAudit({
        area: 'frontdesk',
        action: 'status',
        entity: 'Reservation',
        entityId: reservationId,
        details: 'Reservation checked out',
        meta: { eventId: checkOutEventId, eventType: 'check-out' }
      });
    } catch {}

    try { this.generateAccountingInvoiceForReservation(reservationId); } catch (e) { console.warn('FO: Auto-invoice generation failed', e); }
    // generateAccountingInvoiceForReservation mutates res.invoiceGenerated/invoiceStatus
    // (and, on a failed GL post, res.pendingGlPost) in place — persist the result so a
    // 'gl_pending' reservation is recoverable after a reload, not just for this session.
    this.persistReservationPatch(reservationId, {
      status: 'checked-out',
      checkedOutAt,
      invoiceGenerated: res.invoiceGenerated,
      invoiceGeneratedDate: res.invoiceGeneratedDate,
      invoiceNumber: res.invoiceNumber,
      invoiceStatus: res.invoiceStatus,
      pendingGlPost: (res as any).pendingGlPost ?? null,
    });
  }

  checkOut(id: string) {
    this.finalizeCheckout(id);
  }

  // Express check-in: one-tap arrival for confirmed/pending reservations. Routes
  // through the canonical checkIn so folio charges, housekeeping sync, and the
  // accounting hand-off all happen.
  expressCheckIn(id: string): boolean {
    const res = this.reservations.find(r => r.id === id);
    if (!res || (res.status !== 'confirmed' && res.status !== 'pending')) return false;
    this.checkIn(id);
    trackEvent('FO.Reservation.ExpressCheckIn', { id });
    return true;
  }

  // Group booking: links existing reservations under a shared groupId, marking
  // the first as the leader and the rest as members. Returns the new groupId.
  linkReservationsAsGroup(reservationIds: string[]): string | null {
    if (reservationIds.length < 2) return null;
    const groupId = `GRP-${Date.now()}`;
    const groupSize = reservationIds.length;
    const [leaderId, ...memberIds] = reservationIds;
    const now = new Date().toISOString();

    this.reservations = this.reservations.map(r => {
      if (r.id === leaderId) {
        return { ...r, groupId, groupSize, isGroupLeader: true, updatedAt: now };
      }
      if (memberIds.includes(r.id)) {
        return { ...r, groupId, groupSize, isGroupLeader: false, linkedReservationId: leaderId, updatedAt: now };
      }
      return r;
    });

    this.notify();
    trackEvent('FO.GroupReservation.Created', { groupId, groupSize });
    this.persistReservationPatch(leaderId, { groupId, groupSize, isGroupLeader: true });
    memberIds.forEach(mid => this.persistReservationPatch(mid, { groupId, groupSize, isGroupLeader: false, linkedReservationId: leaderId }));
    return groupId;
  }

  // Folio helpers
  getOrCreateFolio(reservationId: string): Folio { return folioHelpers.getOrCreateFolio(this as any, reservationId); }

  getFolioById(folioId: string): Folio | undefined { return folioHelpers.getFolioById(this as any, folioId); }

  updateFolioBalances(folio: Folio) { folioHelpers.updateFolioBalances(this as any, folio); }

  addFolioCharge(folioId: string, charge: { id: string; description: string; amount: number; date?: string; tax?: number; category?: string; reference?: string }) { folioHelpers.addFolioCharge(this as any, folioId, charge); }

  // Best practice: close folio hands off to Accounts (auto-post invoice)
  closeFolio(reservationId: string, options?: { postInvoice?: boolean }) { return folioHelpers.closeFolio(this as any, reservationId, options); }

  // Maintenance flow
  reportMaintenance(roomId: string, category: 'plumbing'|'electrical'|'hvac'|'furniture'|'appliances'|'structural'|'other', description: string) {
    housekeepingStore.updateRoomStatus(roomId, 'out-of-order', 'FrontDesk', description);
    housekeepingStore.createMaintenanceRequest({ roomNumber: roomId, reportedBy: 'Front Desk', category, priority: 'high', description });
  }

  // --- Folio advanced operations ---
  transferCharge(fromReservationId: string, chargeId: string, toReservationId: string, note?: string) { return folioHelpers.transferCharge(this as any, fromReservationId, chargeId, toReservationId, note); }

  splitCharge(reservationId: string, chargeId: string, targetReservationId: string, amountToMove: number, note?: string) { return folioHelpers.splitCharge(this as any, reservationId, chargeId, targetReservationId, amountToMove, note); }

  voidCharge(reservationId: string, chargeId: string, reason: string) {
    const folio = this.getOrCreateFolio(reservationId);
    const existing = (folio.charges || []).find((c) => c.id === chargeId);
    const ok = folioHelpers.voidCharge(this as any, reservationId, chargeId, reason);
    if (ok && existing) {
      void invoiceHelpers.voidFolioChargeInAccounting(this as any, reservationId, existing).catch((e) =>
        console.warn('FO: voided folio charge was not adjusted in Accounting', e),
      );
    }
    return ok;
  }

  unvoidCharge(reservationId: string, voidLineId: string) {
    const folio = this.getOrCreateFolio(reservationId);
    const line = (folio.charges || []).find((charge) => charge.id === voidLineId) as any;
    const original = line?.voidsChargeId
      ? (folio.charges || []).find((charge) => charge.id === line.voidsChargeId)
      : undefined;
    const result = folioHelpers.unvoidCharge(this as any, reservationId, voidLineId);
    if (result && original) {
      void invoiceHelpers.unvoidFolioChargeInAccounting(this as any, reservationId, original).catch((error) =>
        console.warn('FO: unvoided folio charge was not restored in Accounting', error),
      );
    }
    return result;
  }

  refundPayment(reservationId: string, paymentId: string, amount: number, reason?: string) {
    const folio = this.getOrCreateFolio(reservationId);
    const existing = (folio.payments || []).find((p) => p.id === paymentId);
    const voidAmount = existing ? Math.min(amount || existing.amount, existing.amount) : amount;
    const ok = folioHelpers.refundPayment(this as any, reservationId, paymentId, amount, reason);
    if (ok) {
      void invoiceHelpers.voidFolioReceiptInAccounting(this as any, reservationId, {
        id: paymentId,
        amount: voidAmount,
        ref: existing?.ref,
      }).catch((e) => console.warn('FO: voided folio payment was not voided in Accounting', e));
    }
    return ok;
  }

  unvoidPayment(reservationId: string, paymentId: string) {
    const folio = this.getOrCreateFolio(reservationId);
    const existing = (folio.payments || []).find((payment) => payment.id === paymentId);
    const ok = folioHelpers.unvoidPayment(this as any, reservationId, paymentId);
    if (ok && existing) {
      void invoiceHelpers.unvoidFolioReceiptInAccounting(this as any, reservationId, {
        id: paymentId,
        amount: existing.amount,
        ref: existing.ref,
      }).catch((error) => console.warn('FO: unvoided folio payment was not restored in Accounting', error));
    }
    return ok;
  }

  // Allocate a single corporate/company receipt across multiple reservations' folios
  postCorporateReceipt(payer: string, reservationIds: string[], totalAmount: number, reference?: string, processedBy?: string) { return folioHelpers.postCorporateReceipt(this as any, payer, reservationIds, totalAmount, reference, processedBy); }

  postCompanyReceipt(payer: string, allocations: Array<{ reservationId: string; amount: number }>, reference: string, method: 'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'|'Check', processedBy?: string) {
    return folioHelpers.postCompanyReceipt(this as any, payer, allocations, reference, method, processedBy);
  }

  private getTaxRates() { return folioHelpers.getTaxRates(this as any); }

  addCharge(reservationId: string, description: string, amount: number, forceExempt?: boolean, taxCategory?: string, reference?: string) { folioHelpers.addCharge(this as any, reservationId, description, amount, forceExempt, taxCategory, reference); }

  addPayment(reservationId: string, method: 'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'|'Check', amount: number, options?: { invoiceId?: string; creditApplied?: number; notes?: string; processedBy?: string; ref?: string; }) {
    const payment = folioHelpers.addPayment(this as any, reservationId, method, amount, options);
    try { invoiceHelpers.postFolioReceiptAfterInvoice(this as any, reservationId, payment); } catch (e) { console.warn('FO: later receipt was not posted to Accounting', e); }
    return payment;
  }
  updateFolioCharge(reservationId: string, chargeId: string, patch: { description?: string; amount?: number }) {
    return folioHelpers.updateFolioCharge(this as any, reservationId, chargeId, patch);
  }
  updateFolioPayment(reservationId: string, paymentId: string, patch: { amount?: number; method?: 'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'|'Check'; notes?: string; ref?: string; }) {
    return folioHelpers.updateFolioPayment(this as any, reservationId, paymentId, patch);
  }
  removeFolioPayment(reservationId: string, paymentId: string) {
    const existing = (this.folios || [])
      .filter((folio) => folio.reservationId === reservationId)
      .flatMap((folio) => folio.payments || [])
      .find((payment) => payment.id === paymentId);
    const ok = folioHelpers.removeFolioPayment(this as any, reservationId, paymentId);
    if (ok && existing) {
      void invoiceHelpers.deleteFolioReceiptFromAccounting(this as any, reservationId, {
        id: paymentId,
        amount: existing.amount,
        ref: existing.ref,
      }).catch((e) => console.warn('FO: deleted folio payment was not removed from Accounting', e));
    }
    return ok;
  }

  // Credit management methods
  addCreditToGuest(guestId: string, amount: number, reason: string, processedBy: string = 'Front Desk') {
    const guest = this.guests.find(g => g.id === guestId);
    if (!guest) return false;
    
    const currentBalance = guest.creditBalance || 0;
    const newBalance = currentBalance + amount;
    
    // Check if new balance exceeds credit limit
    if (guest.creditLimit && newBalance > guest.creditLimit) {
      return false; // Credit limit exceeded
    }
    
    guest.creditBalance = newBalance;
    guest.lastCreditUpdate = new Date().toISOString();
    guest.creditStatus = guest.creditStatus || 'active';
    
    this.notify();
    trackEvent('FO.Guest.Updated', { 
      guestId, 
      action: 'credit_added',
      amount, 
      newBalance, 
      reason,
      processedBy 
    });
    
    try {
      logAudit({
        area: 'frontdesk',
        action: 'update',
        entity: 'Guest',
        entityId: guestId,
        details: `Added ₵${amount} credit. Reason: ${reason}`,
        severity: 'medium',
        meta: { amount, reason, newBalance, action_type: 'credit_add' }
      });
    } catch {}
    
    return true;
  }

  applyCreditPayment(reservationId: string, amount: number, notes?: string, processedBy?: string) {
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (!reservation) return false;

    const guest = this.guests.find(g => g.id === reservation.guestId);
    if (!guest || !guest.creditBalance || guest.creditBalance < amount) {
      return false; // Insufficient credit
    }

    // Apply credit payment
    this.addPayment(reservationId, 'Credit', amount, {
      creditApplied: amount,
      notes: notes || 'Credit payment applied',
      processedBy: processedBy || 'Front Desk'
    });

    try { this.persistGuests?.(); } catch {}
    
    return true;
  }

  getGuestCreditBalance(guestId: string): number {
    const guest = this.guests.find(g => g.id === guestId);
    return guest?.creditBalance || 0;
  }

  // Reservation financial helpers
  addDeposit(reservationId: string, amount: number, method: 'Cash'|'Card'|'Mobile Money') {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res) return;
    res.deposit = { amount, method, date: new Date().toISOString() };
    res.isGuaranteed = amount > 0;
    const rm = useSettingsStore.getState().roomManagement;
    const stayTotal = this.getReservationQuote(res).grandTotal;
    if (
      res.status === 'pending' &&
      rm?.depositPolicyEnabled &&
      rm.requireDepositToConfirm &&
      !depositBlocksConfirm(amount, requiredDeposit(stayTotal, rm), rm)
    ) {
      res.status = 'confirmed';
    }
    this.addPayment(reservationId, method, amount);
    this.updateReservation(res);
  }

  /** Canonical quote for tables and billing screens — always returns computed rates. */
  getReservationQuote(reservation: Reservation): ReservationQuote {
    const breakdown = isValidRateBreakdown(reservation.rateBreakdown)
      ? reservation.rateBreakdown
      : this.calculateRateBreakdownForReservation(reservation);
    return quoteFromRateBreakdown(breakdown as any, reservation.taxExempt);
  }

  /** Attach a rate breakdown when missing so tables and folio posting have amounts. */
  ensureReservationRates(reservation: Reservation): Reservation {
    if (!isValidRateBreakdown(reservation.rateBreakdown)) {
      reservation.rateBreakdown = this.calculateRateBreakdownForReservation(reservation);
    }
    return reservation;
  }

  calculateRateBreakdownForReservation(reservation: Reservation) {
    const settings = useSettingsStore.getState();
    const cfgPlans = settings.roomManagement.ratePlans || [];
    const plan = reservation.ratePlanId
      ? (this.ratePlans.find((rp) => rp.id === reservation.ratePlanId)
        ?? cfgPlans.find((rp) => rp.id === reservation.ratePlanId))
      : undefined;
    return this.calculateRateBreakdown(
      reservation.roomTypeId,
      reservation.arrival,
      reservation.departure,
      plan?.basePrice,
      (plan as { priceType?: string } | undefined)?.priceType || 'subtotal',
      reservation.taxExempt
    );
  }

  /** Legacy helper — posts first night only when setting enabled. */
  ensureFolioRoomCharges(reservationId: string) {
    const reservation = this.reservations.find((r) => r.id === reservationId);
    if (!reservation || reservation.status !== 'checked-in') return;
    // Server-backed: wait for the real folios. Posting now would put the charge on
    // a phantom folio (the real one isn't loaded yet) — pullFromApi calls this
    // again for every checked-in reservation once they have landed.
    if (!this.hydrationComplete && this.tenant()) {
      this.ensureHydratedFromApi();
      return;
    }
    try {
      const rm = useSettingsStore.getState().roomManagement;
      if (rm?.postFirstNightAtCheckin) {
        postFirstNightAtCheckIn(this as any, reservationId);
      }
    } catch {}
  }

  // Weekday/weekend rate calculator with per-night seasonal rate-plan overrides.
  calculateRateBreakdown(roomTypeId: string, arrival: string, departure: string, base?: number, priceType?: string, taxExempt?: boolean) {
    const nightly: { date: string; base: number; total: number }[] = [];
    const settings = useSettingsStore.getState();
    const cfgRoomTypes = settings.roomManagement.roomTypes || [];
    const cfgRatePlans = settings.roomManagement.ratePlans || [];
    const defaultRpId = (settings.roomManagement.defaultRatePlanByRoomType || {})[roomTypeId];
    const defaultRp = defaultRpId
      ? (this.ratePlans.find((rp) => rp.id === defaultRpId) ?? cfgRatePlans.find((rp) => rp.id === defaultRpId))
      : undefined;
    const anyPlan = this.ratePlans.find((rp) => rp.roomTypeId === roomTypeId)
      ?? cfgRatePlans.find((rp) => rp.roomTypeId === roomTypeId);
    const activePlan = defaultRp || anyPlan;
    const roomTypeBase = this.roomTypes.find((rt) => rt.id === roomTypeId)?.baseRate
      ?? cfgRoomTypes.find((rt) => rt.id === roomTypeId)?.baseRate
      ?? 0;
    const planBase = activePlan
      ? ((activePlan as RatePlan).basePrice ?? (activePlan as { price?: number }).price)
      : undefined;
    const planType = (activePlan as { priceType?: string } | undefined)?.priceType || 'subtotal';
    const resolvedPriceType = priceType || planType;
    const hasExplicitBase = typeof base === 'number' && !isNaN(base);
    const seasonalRates = (activePlan as RatePlan | undefined)?.seasonalRates;

    // Seasonal overrides configured on the active rate plan (Settings → Rooms & Pricing) apply
    // per night — a stay spanning a season boundary is only priced at the season's multiplier
    // for the nights actually inside it. Multiplier is a direct factor (1.2 = 120% of base),
    // matching the "Multiplier (e.g., 1.2)" label on that editor. Skipped when the caller
    // passed an explicit `base` override, since that's already the exact rate to charge.
    const seasonalMultiplierFor = (dateStr: string): number => {
      if (hasExplicitBase || !seasonalRates?.length) return 1;
      const d = new Date(dateStr);
      const season = seasonalRates.find((sr) => d >= new Date(sr.startDate) && d <= new Date(sr.endDate));
      return season ? season.multiplier : 1;
    };

    for (const dateStr of stayNightDates(arrival, departure)) {
      const seasonMult = seasonalMultiplierFor(dateStr);
      const rawBase = hasExplicitBase
        ? (base as number)
        : (activePlan && typeof planBase === 'number' ? planBase : roomTypeBase) * seasonMult;
      const net = hasExplicitBase || (activePlan && typeof planBase === 'number')
        ? resolveNightlyNet(rawBase, hasExplicitBase ? resolvedPriceType : planType)
        : rawBase;
      const gross = resolveNightlyGross(rawBase, resolvedPriceType, taxExempt);
      nightly.push({
        date: dateStr,
        base: parseFloat(net.toFixed(2)),
        total: parseFloat(gross.toFixed(2)),
      });
    }
    return nightly;
  }

  // Guest management methods
  updateGuest(id: string, updatedFields: Partial<Omit<GuestProfile, 'id' | 'serialNumber' | 'createdAt' | 'updatedAt'>>) {
    const index = this.guests.findIndex(g => g.id === id);
    if (index !== -1) {
      // Enforce the signature's Omit at runtime too — a caller that bypasses the type
      // (an `as any` cast) must not be able to clobber a guest's id/serialNumber/createdAt.
      const { id: _id, serialNumber: _sn, createdAt: _ca, ...safeFields } = updatedFields as Partial<GuestProfile>;
      this.guests[index] = {
        ...this.guests[index],
        ...safeFields,
        updatedAt: new Date().toISOString()
      };
      this.persistGuests();
      this.persistGuestPatch(id, safeFields);
      this.notify();
      trackEvent('FO.Guest.Updated', {
        id: id,
        name: `${this.guests[index].firstName} ${this.guests[index].lastName}`,
        nationality: this.guests[index].nationality
      });
      try {
        logAudit({
          area: 'frontdesk',
          action: 'update',
          entity: 'Client',
          entityId: id,
          details: 'Updated client profile',
          severity: 'low',
          meta: { fields: Object.keys(updatedFields || {}) }
        });
      } catch {}
      return this.guests[index];
    }
    return null;
  }

  retireGuest(id: string) {
    return this.updateGuest(id, { isActive: false } as any);
  }

  deleteGuest(id: string) {
    if (this.guestHasHistory(id)) {
      return this.retireGuest(id);
    }
    const index = this.guests.findIndex(g => g.id === id);
    if (index !== -1) {
      const deleted = this.guests.splice(index, 1)[0];
      this.persistGuests();
      this.persistGuestDelete(id);
      this.notify();
      trackEvent('FO.Guest.Deleted', { 
        id: deleted.id, 
        name: `${deleted.firstName} ${deleted.lastName}` 
      });
      try {
        logAudit({
          area: 'frontdesk',
          action: 'delete',
          entity: 'Client',
          entityId: deleted.id,
          details: 'Deleted client profile',
          severity: 'medium',
          meta: { name: `${deleted.firstName} ${deleted.lastName}` }
        });
      } catch {}
      return deleted;
    }
    return null;
  }

  // Create client from reservation data
  createClientFromReservation(reservationId: string, clientData: Omit<GuestProfile, 'id' | 'serialNumber'>) {
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const newClient = this.createGuest(clientData);
    
    // Update the reservation to link it to the new client
    reservation.guestId = newClient.id;
    this.notify();

    trackEvent('FO.Client.CreatedFromReservation', {
      clientId: newClient.id,
      reservationId: reservationId,
      clientName: `${newClient.firstName} ${newClient.lastName}`
    });

    return newClient;
  }

  // Get reservations without linked clients
  getReservationsWithoutClients(): Reservation[] {
    return this.reservations.filter(r => !r.guestId);
  }

  // Get client analytics
  getClientAnalytics() {
    const clients = this.guests;
    const reservations = this.reservations;
    
    return {
      totalClients: clients.length,
      activeClients: clients.filter(c => 
        reservations.some(r => r.guestId === c.id)
      ).length,
      newClientsThisMonth: clients.filter(c => {
        const createdAt = new Date(c.createdAt || new Date().toISOString());
        const now = new Date();
        return createdAt.getMonth() === now.getMonth() && 
               createdAt.getFullYear() === now.getFullYear();
      }).length,
      averageReservationsPerClient: clients.length > 0 
        ? reservations.length / clients.length 
        : 0
    };
  }

  // Add new reservation (for walk-ins)
  addReservation(reservationData: Partial<Reservation> & { guestName: string; guestPhone: string; guestEmail?: string; roomType: string; arrival: string; departure: string; adults: number; children: number; status: string; source: string }) {
    const newReservation: Reservation = {
      id: reservationData.id || this.makeId('RES'),
      guestId: (reservationData as any).guestId || undefined,
      guestName: reservationData.guestName,
      guestPhone: reservationData.guestPhone,
      guestEmail: reservationData.guestEmail,
      roomTypeId: this.roomTypes.find(rt => rt.name === reservationData.roomType)?.id || reservationData.roomType,
      arrival: reservationData.arrival,
      departure: reservationData.departure,
      adults: reservationData.adults,
      children: reservationData.children,
      remarksToGuest: (reservationData as any).specialRequests,
      status: reservationData.status as any,
      source: reservationData.source,
      createdAt: reservationData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Minimal required defaults
      ratePlanId: this.ratePlans.find(rp => rp.roomTypeId === (this.roomTypes.find(rt => rt.name === reservationData.roomType)?.id || reservationData.roomType))?.id || undefined,
      isGuaranteed: false,
      stayReason: 'leisure',
      marketCodes: ['WALK IN']
    };

    this.reservations.push(newReservation);
    this.notify();
    
    trackEvent('FO.Reservation.Created', {
      reservationId: newReservation.id,
      guestName: newReservation.guestName,
      source: newReservation.source,
      roomType: newReservation.roomTypeId
    });

    return newReservation;
  }

  // Update reservation status
  updateReservationStatus(reservationId: string, newStatus: string) {
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (!reservation) return null;

    const previousStatus = reservation.status;

    // Route lifecycle transitions through the canonical handlers so that folio
    // room charges, housekeeping sync, and the accounting hand-off happen
    // regardless of which screen triggers the status change (e.g. Quick Check-In).
    if (newStatus === 'checked-in') {
      this.checkIn(reservationId);
      return this.reservations.find(r => r.id === reservationId) || null;
    }
    if (newStatus === 'checked-out') {
      this.checkOut(reservationId);
      return this.reservations.find(r => r.id === reservationId) || null;
    }

    reservation.status = newStatus as any;
    reservation.updatedAt = new Date().toISOString();
    this.notify();

    trackEvent('FO.Reservation.StatusUpdated', {
      reservationId: reservationId,
      guestName: reservation.guestName,
      oldStatus: previousStatus,
      newStatus: newStatus
    });

    this.persistReservationPatch(reservationId, { status: newStatus as Reservation['status'] });
    return reservation;
  }

  // Process checkout for a reservation
  processCheckout(reservationId: string, checkoutNotes?: string) {
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (reservation) {
      // Enforce corporate billing requirements: if company will pay later, require references
      // Pay-later policy from Settings (both | corporate | individual). Default 'both'
      const settingsState = (() => { try { return useSettingsStore.getState(); } catch { return undefined as any; } })();
      const policy = settingsState?.roomManagement?.payLaterPolicy || 'both';
      const requireCorporateReference = !!settingsState?.roomManagement?.requireCorporateReference;
      // Corporate status is primarily the guest's own designation (set on the Add/Edit
      // Client form) — reservation.companyName/billingPersonName is an additional signal
      // for reservations billed to a company that wasn't itself created as a corporate guest.
      const guest = this.guests.find(g => g.id === reservation.guestId);
      const isCorporate = isCorporateGuest(guest) || !!(reservation.companyName || reservation.billingPersonName);
      const payLaterAllowed = (policy === 'both') || (policy === 'corporate' && isCorporate) || (policy === 'individual' && !isCorporate);
      if (isCorporate && payLaterAllowed && requireCorporateReference) {
        const hasReference = Boolean((reservation as any).projectCode || (reservation as any).costCenter || (reservation as any).poNumber);
        if (!hasReference) {
          console.warn('FO: Corporate checkout blocked - missing PO/Project Code/Cost Center');
          try {
            logAudit({
              area: 'frontdesk',
              action: 'other',
              entity: 'Reservation',
              entityId: reservationId,
              details: 'Corporate checkout blocked: missing billing reference (PO/Project Code/Cost Center)',
              severity: 'medium'
            });
          } catch {}
          trackEvent('FO.Checkout.Blocked.Corporate' as any, { reservationId, reason: 'missing_billing_reference' });
          // Do not change status; return null to signal failure to caller
          return null;
        }
      }

      // Apply late checkout fee if applicable
      try {
        const settingsState = (() => { try { return useSettingsStore.getState(); } catch { return undefined as any; } })();
        const rm = settingsState?.roomManagement;
        if (isLateCheckoutNow(rm) && !reservation.waiveLateCheckoutFee) {
            const folio = this.getOrCreateFolio(reservationId);
            const night = reservation.rateBreakdown?.[0];
            const nightlyNet = night?.base ?? 0;
            const nightlyGross = night?.total ?? nightlyNet;
            let fee = 0;
            let quotedTax: number | undefined;
            if ((rm.lateCheckoutFeeType || 'flat') === 'percent_of_nightly') {
              const penaltyGross = Math.max(0, ((rm.lateCheckoutFeeValue || 0) / 100) * nightlyGross);
              const ratio = nightlyGross > 0 ? penaltyGross / nightlyGross : 0;
              fee = roundCents(nightlyNet * ratio);
              quotedTax = reservation.taxExempt ? 0 : roundCents(Math.max(0, penaltyGross - fee));
            } else {
              fee = Math.max(0, rm.lateCheckoutFeeValue || 0);
            }
            if (fee > 0) {
              this.addFolioCharge(folio.id, {
                id: genId('C'),
                description: 'Late Checkout Fee',
                amount: fee,
                ...(quotedTax != null ? { tax: quotedTax } : {}),
              });
            }
        }
      } catch {}

      this.finalizeCheckout(reservationId, checkoutNotes);
      return reservation;
    }
    return null;
  }

  // Per-guest waiver. Front office checkout still runs; the late fee is skipped.
  setLateCheckoutWaiver(reservationId: string, waive: boolean) {
    if (!useSettingsStore.getState().hasPermission('frontdesk.waive-late-checkout')) return false;
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (!reservation || reservation.status !== 'checked-in') return false;
    reservation.waiveLateCheckoutFee = waive;
    reservation.updatedAt = new Date().toISOString();
    this.notify();
    this.persistReservationPatch(reservationId, { waiveLateCheckoutFee: waive });
    return true;
  }

  // Marks a company-billed stay as still with the guest, or presented for the company to pay.
  // The balance stays on this stay. It is not copied onto another guest.
  setCompanyBillStatus(reservationId: string, status: 'waiting_on_guest' | 'with_company') {
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (!reservation) return false;
    reservation.companyBillStatus = status;
    reservation.updatedAt = new Date().toISOString();
    this.notify();
    this.persistReservationPatch(reservationId, { companyBillStatus: status });
    try {
      logAudit({
        area: 'frontdesk',
        action: 'update',
        entity: 'Reservation',
        entityId: reservationId,
        details: status === 'with_company' ? 'Bill presented to the company' : 'Bill is still with the guest',
        severity: 'low',
      });
    } catch {}
    return true;
  }

  // Mark No-Show per policy — folio penalty, direct GL, close folio (not checkout).
  markNoShow(reservationId: string) {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res || res.status === 'no-show') return;
    const settingsState = (() => { try { return useSettingsStore.getState(); } catch { return undefined as any; } })();
    const rm = settingsState?.roomManagement;

    this.reservations = this.reservations.map(r => r.id === reservationId ? { ...r, status: 'no-show', updatedAt: new Date().toISOString() } : r);
    this.notify();
    trackEvent('FO.Reservation.NoShow' as any, { reservationId });
    this.persistReservationPatch(reservationId, { status: 'no-show' });

    try {
      if (!rm?.noShowPolicyEnabled) {
        this.closeFolio(reservationId, { postInvoice: false });
        return;
      }

      const breakdown = res.rateBreakdown?.length
        ? res.rateBreakdown
        : this.calculateRateBreakdown(res.roomTypeId, res.arrival, res.departure, undefined, undefined, res.taxExempt);
      const nightlyNet = breakdown[0]?.base ?? 0;
      const nightlyGross = breakdown[0]?.total ?? nightlyNet;
      const stayNet = breakdown.reduce((s, d) => s + (d.base || 0), 0);
      const stayGross = breakdown.reduce((s, d) => s + (d.total || 0), 0);
      let charge = 0;
      let quotedTax: number | undefined;
      switch (rm.noShowChargeType) {
        case 'first_night':
          charge = nightlyNet;
          quotedTax = res.taxExempt ? 0 : roundCents(Math.max(0, nightlyGross - nightlyNet));
          break;
        case 'percent_reservation': {
          const penaltyGross = Math.max(0, ((rm.noShowChargeValue || 0) / 100) * stayGross);
          const ratio = stayGross > 0 ? penaltyGross / stayGross : 0;
          charge = roundCents(stayNet * ratio);
          quotedTax = res.taxExempt ? 0 : roundCents(Math.max(0, penaltyGross - charge));
          break;
        }
        case 'flat': charge = Math.max(0, rm.noShowChargeValue || 0); break;
        default: charge = 0;
      }

      if (charge <= 0) {
        this.closeFolio(reservationId, { postInvoice: false });
        return;
      }

      const folio = this.getOrCreateFolio(reservationId);
      const chargeId = genId('C-NS');
      this.addFolioCharge(folio.id, {
        id: chargeId,
        description: 'No-Show Charge',
        amount: charge,
        ...(quotedTax != null ? { tax: quotedTax } : {}),
        category: 'room',
        date: this.businessDate,
      });
      this.updateFolioBalances(this.getOrCreateFolio(reservationId));

      const updated = this.getOrCreateFolio(reservationId);
      const nsLine = updated.charges.find(c => c.id === chargeId);
      const taxAmount = nsLine?.tax || 0;
      const total = charge + taxAmount;

      const cardCollected = res.isGuaranteed
        ? { amount: total, date: new Date().toISOString() }
        : undefined;

      if (res.isGuaranteed) {
        this.addPayment(reservationId, 'Card', total, {
          notes: 'No-show penalty — card guarantee',
          processedBy: 'Night Audit',
          ref: `NS-${res.resId || reservationId}`,
        });
      }

      postNoShowPenaltyToLedger({
        reservationId,
        reference: String(res.resId || reservationId),
        guestLabel: res.guestName || 'Guest',
        subtotal: charge,
        taxAmount,
        total,
        cardCollected,
      });

      this.closeFolio(reservationId, { postInvoice: false });
    } catch (e) {
      console.warn('FO: markNoShow GL failed', e);
    }
  }

  // Generate an accounting invoice from a reservation folio and mark reservation
  private generateAccountingInvoiceForReservation(reservationId: string) { return invoiceHelpers.generateAccountingInvoiceForReservation(this as any, reservationId); }

  // Re-attempt a stuck GL post for one reservation (invoiceStatus === 'gl_pending').
  retryPendingGlPost(reservationId: string) { return invoiceHelpers.retryPendingGlPost(this as any, reservationId); }

  // Re-attempt GL posts for every reservation currently stuck in 'gl_pending'.
  retryAllPendingGlPosts() { return invoiceHelpers.retryAllPendingGlPosts(this as any); }

  // Keep a night's room when the stay dates are rebuilt. New nights stay with the current room.
  private withNightRooms<T extends { date: string }>(reservation: Reservation, breakdown: T[]) {
    const previous = new Map((reservation.rateBreakdown || []).map((night) => [night.date.slice(0, 10), night.roomId]));
    return breakdown.map((night) => {
      const roomId = previous.get(night.date.slice(0, 10));
      return roomId ? { ...night, roomId } : night;
    });
  }

  // Extend stay for a reservation
  extendStay(reservationId: string, additionalNights: number) {
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (reservation) {
      let departure = reservation.departure.slice(0, 10);
      const extra = Math.max(0, Math.floor(additionalNights));
      for (let i = 0; i < extra; i++) departure = nextCalendarDate(departure);
      reservation.departure = departure;
      reservation.updatedAt = new Date().toISOString();
      reservation.rateBreakdown = this.withNightRooms(reservation, this.calculateRateBreakdown(
        reservation.roomTypeId,
        reservation.arrival,
        reservation.departure,
        undefined,
        undefined,
        reservation.taxExempt
      ));
      this.notify();
      this.persistReservationPatch(reservationId, { departure: reservation.departure, rateBreakdown: reservation.rateBreakdown });

      trackEvent('FO.Reservation.Updated', {
        reservationId: reservationId,
        guestName: reservation.guestName,
        action: 'extend_stay',
        additionalNights,
        newDeparture: reservation.departure
      });

      return reservation;
    }
    return null;
  }

  // Move the departure date earlier. The caller voids room charges for nights that come off.
  shortenStay(reservationId: string, nights: number) {
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (!reservation) return null;
    let departure = reservation.departure.slice(0, 10);
    const drop = Math.max(0, Math.floor(nights));
    if (drop === 0) return reservation;
    for (let i = 0; i < drop; i++) departure = previousCalendarDate(departure);
    if (departure <= reservation.arrival.slice(0, 10)) return null;
    reservation.departure = departure;
    reservation.updatedAt = new Date().toISOString();
    reservation.rateBreakdown = this.withNightRooms(reservation, this.calculateRateBreakdown(
      reservation.roomTypeId,
      reservation.arrival,
      reservation.departure,
      undefined,
      undefined,
      reservation.taxExempt
    ));
    this.notify();
    this.persistReservationPatch(reservationId, { departure: reservation.departure, rateBreakdown: reservation.rateBreakdown });
    trackEvent('FO.Reservation.Updated', {
      reservationId,
      guestName: reservation.guestName,
      action: 'shorten_stay',
      nights: drop,
      newDeparture: reservation.departure,
    });
    return reservation;
  }
}

export const frontOfficeStore = new FrontOfficeStore();


