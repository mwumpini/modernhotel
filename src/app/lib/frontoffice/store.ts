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
import { useSettingsStore } from '../settings/store';
import * as apiHelpers from './helpers/api';
import * as seedHelpers from './helpers/seed';
import * as invoiceHelpers from './helpers/invoice';
import { getClientTenantSubdomain } from '../api/clientTenant';
import {
  folioAmountFromGrossDerived,
  isValidRateBreakdown,
  quoteFromBreakdown,
  resolveNightlyGross,
  resolveNightlyNet,
  type ReservationQuote,
} from './helpers/rates';
import { isCorporateGuest } from './helpers/guests';
import { postFirstNightAtCheckIn } from './roomCharges';
import { type NightAuditResult } from './nightAudit';
import { postNoShowPenaltyToLedger } from '../accounting/simpleFlow';
import { DEMO_BILLING_PERSONS, isDemoFixturesEnabled } from '../demo';
import { notifyError } from '../notifications/notify';
import { genId } from './helpers/ids';

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
  private hydratedNightAuditState: boolean = false;
  private lastRefreshFromApiAt: number = 0;
  // Serializes API writes so a reservation's POST always lands before its PATCH.
  private writeQueue: Promise<unknown> = Promise.resolve();
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
   *  checked-in reservations. Event bookings themselves aren't persisted
   *  anywhere today (they live only in that component's own React state for
   *  the session), so this is in-memory too — consistent with that, not a
   *  regression from it. */
  inHouseGroups: Array<{ id: string; eventId: string; eventName?: string; pax: number; checkedInAt: string }> = [];
  addInHouseGroup(eventId: string, pax: number, eventName?: string) {
    this.inHouseGroups = this.inHouseGroups.filter(g => g.eventId !== eventId);
    this.inHouseGroups.push({ id: genId('IHG'), eventId, eventName, pax: pax || 0, checkedInAt: new Date().toISOString() });
    this.notify();
  }
  removeInHouseGroup(eventId: string) {
    this.inHouseGroups = this.inHouseGroups.filter(g => g.eventId !== eventId);
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
    this.enqueueWrite(async () => {
      const saved = await apiHelpers.upsertFolioViaApi(this as any, t, folio);
      if (saved?.id) {
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
  private async pullFromApi() {
    if (Date.now() - this.lastRefreshFromApiAt < FrontOfficeStore.MIN_REFRESH_INTERVAL_MS) return;
    this.lastRefreshFromApiAt = Date.now();
    const t = this.tenant(); if (!t) return;
    try {
      const res = await fetch('/api/reservations', { headers: { 'x-tenant-subdomain': t } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reservations) && data.reservations.length > 0) {
          // Merge by id (like guests/folios below) instead of replacing the array
          // wholesale. A reservation created locally moments before this GET
          // resolves may not have finished its own async POST to the server yet;
          // a wholesale replace would silently drop it from view until whatever
          // later refresh happens to catch it after the POST lands.
          const byId = new Map<string, Reservation>();
          this.reservations.forEach((r) => byId.set(r.id, r));
          data.reservations.forEach((r: Reservation) => byId.set(r.id, this.ensureReservationRates(r)));
          this.reservations = Array.from(byId.values());
          this.reservations.forEach((r) => {
            if (r.status === 'checked-in') {
              try { this.ensureFolioRoomCharges(r.id); } catch {}
            }
          });
          // A prior checkout may have failed only at the GL-post step (invoiceStatus
          // stuck at 'gl_pending'); retry those now that folios/reservations are fresh.
          try { this.retryAllPendingGlPosts(); } catch (e) { console.warn('FO: retryAllPendingGlPosts failed', e); }
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
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.guests) && data.guests.length > 0) {
          const byId = new Map<string, GuestProfile>();
          this.guests.forEach(g => byId.set(g.id, g));
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
        if (Array.isArray(data.folios) && data.folios.length > 0) {
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
          });
          this.folios = Array.from(byId.values());
          this.notify();
        }
      }
    } catch (e) { console.warn('FO: folio sync failed', e); }
    try {
      const res = await fetch('/api/frontoffice/day-ledger', { headers: { 'x-tenant-subdomain': t } });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.currentBusinessDate === 'string') this.businessDate = data.currentBusinessDate;
      }
    } catch (e) { console.warn('FO: business date sync failed', e); }
    // Reached only once the reservations/guests/folios fetches above have all
    // been attempted (success or failure) — see the hydrationComplete field
    // comment for why persistFolio needs this instead of hydratedFromApi.
    this.hydrationComplete = true;
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
  async refreshFromApi() {
    if (typeof window === 'undefined') return;
    try { await this.writeQueue; } catch {}
    await this.pullFromApi();
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
        // Avoid overwriting non-empty storage with empty in edge cases
        if (this.guests.length === 0 && existing) {
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
    const serialNumber = settings.getNextClientNumber();
    const guest: GuestProfile = { 
      ...g, 
      id: genId('G'),
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
      if (parsed.businessDate) this.businessDate = parsed.businessDate;
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
    this.notify();
    trackEvent('FO.ClientService.Added' as any, { clientId: service.clientId, serviceName: service.serviceName, type: service.serviceType });
    return service;
  }

  updateClientService(serviceId: string, updates: Partial<{ serviceName: string; serviceType: 'amenity'|'package'|'contract'; rate: number; notes?: string; contractStart?: string; contractEnd?: string; status: 'active'|'inactive'|'expired'; isActive: boolean; }>) {
    const idx = this.clientServices.findIndex(s => s.id === serviceId);
    if (idx === -1) return null;
    this.clientServices[idx] = { ...this.clientServices[idx], ...updates };
    this.notify();
    trackEvent('FO.ClientService.Updated' as any, { id: serviceId });
    return this.clientServices[idx];
  }

  deleteClientServicesForClient(clientId: string) {
    const before = this.clientServices.length;
    this.clientServices = (this.clientServices || []).filter(s => s.clientId !== clientId);
    const removed = before - this.clientServices.length;
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
          const nightlyGross = (res.rateBreakdown && res.rateBreakdown[0]?.total) ? res.rateBreakdown[0].total : 0;
          let penalty = 0;
          switch (policy.lateCancellationFeeType) {
            case 'first_night': penalty = folioAmountFromGrossDerived(nightlyGross); break;
            case 'percent_reservation': {
              const remainingGross = (res.rateBreakdown || []).reduce((s, d) => s + (d.total || 0), 0);
              penalty = folioAmountFromGrossDerived(Math.max(0, (policy.lateCancellationFeeValue || 0) / 100 * remainingGross));
              break;
            }
            case 'flat': penalty = Math.max(0, policy.lateCancellationFeeValue || 0); break;
            default: penalty = 0;
          }
          if (penalty > 0) {
            this.addFolioCharge(folio.id, { id: genId('C'), description: 'Cancellation Penalty', amount: penalty });
          }
        }
      }
    } catch {}
  }
  assignRoom(id: string, roomId: string) { this.reservations = this.reservations.map(r => r.id === id ? { ...r, roomId } : r); this.notify(); this.persistReservationPatch(id, { roomId }); }

  // Date-range availability against the hydrated in-memory reservations. Mirrors
  // the server-authoritative check so the UI never assigns a room that already
  // has an overlapping active booking (the API guard is the backstop).
  isRoomFreeForRange(roomNumber: string, arrival: string, departure: string, excludeId?: string): boolean {
    const start = new Date(arrival).getTime();
    const end = new Date(departure).getTime();
    return !this.reservations.some(r =>
      r.id !== excludeId &&
      r.roomId === roomNumber &&
      (r.status === 'confirmed' || r.status === 'checked-in') &&
      new Date(r.arrival).getTime() < end &&
      new Date(r.departure).getTime() > start
    );
  }

  // Smart room selection: among rooms of the reservation's type that are vacant
  // AND free for the stay's dates, prefer those matching the guest's stored
  // preferences (floor, accessibility) and VIP status.
  pickOptimalRoomNumber(res: Reservation): string | undefined {
    try {
      const matchingVacant = housekeepingStore
        .getRoomsByStatus('vacant')
        .filter(room => room.roomTypeId === res.roomTypeId);
      const vacant = matchingVacant.length > 0
        ? matchingVacant
        : housekeepingStore.getRoomsByStatus('vacant');
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

  checkIn(id: string) {
    const res = this.reservations.find(r => r.id === id);

    // Auto-assign a room if none is assigned yet so Check-Ins view reflects immediately
    let assignedRoomId = (res?.roomId && res.roomId !== 'TBD') ? res.roomId : undefined;
    const settings = (() => { try { return useSettingsStore.getState(); } catch { return undefined as any; } })();
    const shouldAutoAssign = settings?.roomSettings?.autoAssignRooms !== false;
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
    const policyEnabled = !!settingsState?.roomManagement?.earlyCheckoutPolicyEnabled;
    if (!policyEnabled || !res) return;

    const folio = this.getOrCreateFolio(reservationId);
    const todayISO = new Date().toISOString().slice(0, 10);
    const kept: any[] = [];
    const removed: any[] = [];
    for (const ch of folio.charges) {
      const isRoom = (ch.description || '').toLowerCase().includes('room');
      const dateOnly = (ch.date || '').slice(0, 10);
      if (isRoom && dateOnly && dateOnly > todayISO) {
        removed.push(ch);
        continue;
      }
      kept.push(ch);
    }
    if (removed.length > 0) {
      folio.charges = kept;
      this.updateFolioBalances(folio);
      try { trackEvent('FO.Folio.RoomChargesRemovedEarlyCheckout' as any, { reservationId, removed: removed.length }); } catch {}
      try { logAudit({ area: 'frontdesk', action: 'update', entity: 'Folio', entityId: reservationId, details: `Removed ${removed.length} future room charge(s) due to early checkout`, severity: 'medium' }); } catch {}
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

  voidCharge(reservationId: string, chargeId: string, reason: string) { return folioHelpers.voidCharge(this as any, reservationId, chargeId, reason); }

  refundPayment(reservationId: string, paymentId: string, amount: number, reason?: string) { return folioHelpers.refundPayment(this as any, reservationId, paymentId, amount, reason); }

  // Allocate a single corporate/company receipt across multiple reservations' folios
  postCorporateReceipt(payer: string, reservationIds: string[], totalAmount: number, reference?: string, processedBy?: string) { return folioHelpers.postCorporateReceipt(this as any, payer, reservationIds, totalAmount, reference, processedBy); }

  private getTaxRates() { return folioHelpers.getTaxRates(this as any); }

  addCharge(reservationId: string, description: string, amount: number, forceExempt?: boolean) { folioHelpers.addCharge(this as any, reservationId, description, amount, forceExempt); }

  addPayment(reservationId: string, method: 'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'|'Check', amount: number, options?: { invoiceId?: string; creditApplied?: number; notes?: string; processedBy?: string; ref?: string; }) {
    return folioHelpers.addPayment(this as any, reservationId, method, amount, options);
  }
  updateFolioPayment(reservationId: string, paymentId: string, patch: { amount?: number; method?: 'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'|'Check'; notes?: string; ref?: string; }) {
    return folioHelpers.updateFolioPayment(this as any, reservationId, paymentId, patch);
  }
  removeFolioPayment(reservationId: string, paymentId: string) {
    return folioHelpers.removeFolioPayment(this as any, reservationId, paymentId);
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

    guest.creditBalance = Math.max(0, (guest.creditBalance || 0) - amount);
    guest.lastCreditUpdate = new Date().toISOString();
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
    this.addPayment(reservationId, method, amount);
    this.updateReservation(res);
  }

  /** Canonical quote for tables and billing screens — always returns computed rates. */
  getReservationQuote(reservation: Reservation): ReservationQuote {
    if (isValidRateBreakdown(reservation.rateBreakdown)) {
      return quoteFromBreakdown(reservation.rateBreakdown as any);
    }
    const breakdown = this.calculateRateBreakdownForReservation(reservation);
    return quoteFromBreakdown(breakdown);
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
    try {
      const rm = useSettingsStore.getState().roomManagement;
      if (rm?.postFirstNightAtCheckin) {
        postFirstNightAtCheckIn(this as any, reservationId);
      }
    } catch {}
  }

  // Weekday/weekend rate calculator with per-night seasonal rate-plan overrides.
  calculateRateBreakdown(roomTypeId: string, arrival: string, departure: string, base?: number, priceType?: string, taxExempt?: boolean) {
    const start = new Date(arrival);
    const end = new Date(departure);
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

    for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
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
        if (rm?.lateCheckoutFeeEnabled) {
          const outHour = new Date().getHours();
          const stdHour = Number(rm.standardCheckOutHour ?? 11);
          const grace = Number(rm.lateCheckoutGraceMinutes ?? 0);
          const crossed = outHour > stdHour || (outHour === stdHour && new Date().getMinutes() > grace);
          if (crossed) {
            const folio = this.getOrCreateFolio(reservationId);
            const nightlyGross = (reservation.rateBreakdown && reservation.rateBreakdown[0]?.total) ? reservation.rateBreakdown[0].total : 0;
            let fee = 0;
            if ((rm.lateCheckoutFeeType || 'flat') === 'percent_of_nightly') {
              fee = folioAmountFromGrossDerived(Math.max(0, (rm.lateCheckoutFeeValue || 0) / 100 * nightlyGross));
            } else {
              fee = Math.max(0, rm.lateCheckoutFeeValue || 0);
            }
            if (fee > 0) this.addFolioCharge(folio.id, { id: genId('C'), description: 'Late Checkout Fee', amount: fee });
          }
        }
      } catch {}

      this.finalizeCheckout(reservationId, checkoutNotes);
      return reservation;
    }
    return null;
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
      const nightlyGross = breakdown[0]?.total ?? 0;
      let charge = 0;
      switch (rm.noShowChargeType) {
        case 'first_night': charge = folioAmountFromGrossDerived(nightlyGross, res.taxExempt); break;
        case 'percent_reservation': {
          const totalGross = breakdown.reduce((s, d) => s + (d.total || 0), 0);
          charge = folioAmountFromGrossDerived(Math.max(0, (rm.noShowChargeValue || 0) / 100 * totalGross), res.taxExempt);
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

  // Extend stay for a reservation
  extendStay(reservationId: string, additionalNights: number) {
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (reservation) {
      const currentDeparture = new Date(reservation.departure);
      currentDeparture.setDate(currentDeparture.getDate() + additionalNights);
      reservation.departure = currentDeparture.toISOString().split('T')[0];
      reservation.updatedAt = new Date().toISOString();
      reservation.rateBreakdown = this.calculateRateBreakdown(
        reservation.roomTypeId,
        reservation.arrival,
        reservation.departure,
        undefined,
        undefined,
        reservation.taxExempt
      );
      this.notify();
      this.persistReservationPatch(reservationId, { departure: reservation.departure });

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
}

export const frontOfficeStore = new FrontOfficeStore();


