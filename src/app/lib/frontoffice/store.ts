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
import { postFirstNightAtCheckIn } from './roomCharges';
import { runNightAudit, type NightAuditResult } from './nightAudit';
import { postNoShowPenaltyToLedger } from '../accounting/simpleFlow';

class FrontOfficeStore {
  reservations: Reservation[] = [];
  guests: GuestProfile[] = [];
  billingPersons: BillingPerson[] = [];
  private hydratedGuests: boolean = false;
  private hydratedFromApi: boolean = false;
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
  /** Hotel business date (rolls at night audit). ISO yyyy-mm-dd */
  businessDate: string = new Date().toISOString().slice(0, 10);
  lastNightAuditAt?: string;
  nightAuditHistory: import('./nightAudit').NightAuditRun[] = [];
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

  // Public helper for UI/other modules
  generateId(prefix: 'RES'|'CI'|'IH'|'CO'|'INV'|'PAY'|'CHG') { return this.makeId(prefix); }

  constructor() {
    this.loadNightAuditState();
    // Settings are now managed centrally via useSettingsStore
    // Initialize with some sample billing persons
    this.billingPersons = [
      {
        id: 'bp-corporate-1',
        name: 'Ghana Telecom Ltd',
        company: 'Ghana Telecom Ltd',
        position: 'Travel Manager',
        phone: '+233 30 123 4567',
        email: 'travel@ghanatelecom.com',
        address: '123 High Street, Accra',
        city: 'Accra',
        country: 'Ghana',
        taxId: 'GH123456789',
        billingRelationship: 'corporate_account',
        isCorporateAccount: true,
        corporateAccountNumber: 'CORP-001',
        paymentMethod: 'corporate_billing',
        creditLimit: 50000,
        paymentTerms: 'Net 30',
        notes: 'Major corporate client with monthly billing. Contact John Mensah for urgent matters.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'bp-travel-agent-1',
        name: 'Accra Travel Agency',
        company: 'Accra Travel Agency',
        position: 'Booking Agent',
        phone: '+233 24 987 6543',
        email: 'bookings@accratravel.com',
        address: '456 Airport Road, Accra',
        city: 'Accra',
        country: 'Ghana',
        taxId: 'GH987654321',
        billingRelationship: 'travel_agent',
        isCorporateAccount: false,
        paymentMethod: 'bank_transfer',
        paymentTerms: 'Immediate',
        notes: 'Reliable travel agency. Send invoices to accounts@accratravel.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'bp-company-1',
        name: 'Kumasi Mining Corporation',
        company: 'Kumasi Mining Corporation',
        position: 'HR Manager',
        phone: '+233 32 555 1234',
        email: 'hr@kumasimining.com',
        address: '789 Mining Road, Kumasi',
        city: 'Kumasi',
        country: 'Ghana',
        taxId: 'GH555123456',
        billingRelationship: 'company',
        isCorporateAccount: false,
        paymentMethod: 'bank_transfer',
        creditLimit: 25000,
        paymentTerms: 'Net 15',
        notes: 'Regular client for employee training programs. Prefer email communication.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Load persisted guests from storage to prevent data loss on refresh
    try {
      const rawGuests = (typeof window !== 'undefined') ? (localStorage.getItem('fo.guests') || sessionStorage.getItem('fo.guests')) : null;
      if (rawGuests) {
        const parsed: GuestProfile[] = JSON.parse(rawGuests);
        if (Array.isArray(parsed)) {
          // Normalize legacy records for corporate company phone/email display
          this.guests = parsed.map((g: any) => {
            const isCorp = !!(g?.companyName || g?.isCorporate);
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

  subscribe(l: () => void) { this.listeners.push(l); this.ensureHydratedFromApi(); return () => { this.listeners = this.listeners.filter(x => x !== l); }; }

  // ---------------------------------------------------------------------------
  // Server persistence (write-through cache). The in-memory arrays remain the
  // synchronous read source for the UI; mutations are mirrored to the database
  // through the API using the store's own ids so DB and client stay aligned.
  // ---------------------------------------------------------------------------
  private tenant(): string | null { return getClientTenantSubdomain(); }

  private enqueueWrite(fn: () => Promise<unknown>) {
    if (typeof window === 'undefined' || !this.tenant()) return;
    this.writeQueue = this.writeQueue.then(fn).catch(e => console.warn('FO: persist failed', e));
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

  // Upsert a folio (the in-house subledger) after any charge/payment mutation.
  // Called from the folio helpers, which funnel through updateFolioBalances.
  // Skipped until hydration so the constructor's demo seed folios are never
  // written to the database (mirrors how seeded reservations/guests behave).
  persistFolio(folio: Folio) {
    if (!this.hydratedFromApi) return;
    const t = this.tenant(); if (!t || !folio?.id || !folio?.reservationId) return;
    this.enqueueWrite(() => apiHelpers.upsertFolioViaApi(this as any, t, folio));
  }

  // Pulls reservations + guests from the database and adopts them when present.
  // During the transition we only replace local data when the server has rows,
  // so an empty DB doesn't wipe seed data.
  private async pullFromApi() {
    const t = this.tenant(); if (!t) return;
    try {
      const res = await fetch('/api/reservations', { headers: { 'x-tenant-subdomain': t } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reservations) && data.reservations.length > 0) {
          this.reservations = data.reservations.map((r: Reservation) => this.ensureReservationRates(r));
          this.reservations.forEach((r) => {
            if (r.status === 'checked-in') {
              try { this.ensureFolioRoomCharges(r.id); } catch {}
            }
          });
          this.notify();
        }
      }
    } catch (e) { console.warn('FO: reservation sync failed', e); }
    try {
      const res = await fetch('/api/guests', { headers: { 'x-tenant-subdomain': t } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.guests) && data.guests.length > 0) {
          const byId = new Map<string, GuestProfile>();
          this.guests.forEach(g => byId.set(g.id, g));
          data.guests.forEach((g: GuestProfile) => byId.set(g.id, g));
          this.guests = Array.from(byId.values());
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
          data.folios.forEach((f: Folio) => byId.set(f.id, f));
          this.folios = Array.from(byId.values());
          this.notify();
        }
      }
    } catch (e) { console.warn('FO: folio sync failed', e); }
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
  syncRoomsFromSettings() {
    try {
      const settings = useSettingsStore.getState();
      const cfgRooms = settings.roomManagement.rooms || [];
      // Sync room types and rate plans from settings so FO has authoritative data
      const cfgRoomTypes = settings.roomManagement.roomTypes || [];
      const cfgRatePlans = settings.roomManagement.ratePlans || [];
      this.roomTypes = cfgRoomTypes.map(rt => ({ id: rt.id, name: rt.name, baseRate: rt.baseRate }));
      this.ratePlans = cfgRatePlans.map(rp => ({
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
      this.rooms = mapped;
      this.notify();
      trackEvent('FO.Rooms.SyncedFromSettings', { count: mapped.length });
      trackEvent('FO.RatePlans.SyncedFromSettings' as any, { count: this.ratePlans.length });
      trackEvent('FO.RoomTypes.SyncedFromSettings' as any, { count: this.roomTypes.length });
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
      id: `G-${Date.now().toString().slice(-6)}`,
      serialNumber,
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

  private loadNightAuditState() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('fo.nightAudit');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.businessDate) this.businessDate = parsed.businessDate;
      if (Array.isArray(parsed.nightAuditHistory)) this.nightAuditHistory = parsed.nightAuditHistory;
      if (parsed.lastNightAuditAt) this.lastNightAuditAt = parsed.lastNightAuditAt;
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
        }),
      );
    } catch {}
  }

  /** End-of-day close — posts room charges, processes no-shows, rolls business date. */
  executeNightAudit(): NightAuditResult {
    const result = runNightAudit(this as any);
    this.persistNightAuditState();
    return result;
  }

  createBillingPerson(bp: Omit<BillingPerson,'id'|'createdAt'|'updatedAt'>) {
    const billingPerson: BillingPerson = {
      ...bp,
      id: `BP-${Date.now().toString().slice(-6)}`,
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
      id: `R-${Date.now().toString().slice(-6)}`, 
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
            this.addFolioCharge(folio.id, { id: `C-${Date.now().toString().slice(-6)}`, description: 'Cancellation Penalty', amount: penalty });
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

    this.reservations = this.reservations.map(r => 
      r.id === id 
        ? { 
            ...r, 
            status: 'checked-in', 
            roomId: assignedRoomId || r.roomId || 'TBD',
            updatedAt: new Date().toISOString(),
            ...(assignedRoomId ? { checkInTime: new Date().toISOString() } as any : {})
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
      const checkInEventId = `EVT-CI-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`;
      logAudit({
        area: 'frontdesk',
        action: 'status',
        entity: 'Reservation',
        entityId: id,
        details: 'Reservation checked in',
        meta: { eventId: checkInEventId, eventType: 'check-in', autoAssignedRoom: assignedRoomId }
      });
    } catch {}
    this.persistReservationPatch(id, { status: 'checked-in', roomId: assignedRoomId || res?.roomId || 'TBD' });
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

    res.status = 'checked-out';
    res.updatedAt = new Date().toISOString();
    (res as any).checkOutTime = new Date().toISOString();
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
      const checkOutEventId = `EVT-CO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`;
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
    this.persistReservationPatch(reservationId, { status: 'checked-out' });
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
  postCorporateReceipt(payer: string, reservationIds: string[], totalAmount: number, reference?: string) { return folioHelpers.postCorporateReceipt(this as any, payer, reservationIds, totalAmount, reference); }

  private getTaxRates() { return folioHelpers.getTaxRates(this as any); }

  addCharge(reservationId: string, description: string, amount: number) { folioHelpers.addCharge(this as any, reservationId, description, amount); }

  addPayment(reservationId: string, method: 'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'|'Check', amount: number, options?: { invoiceId?: string; creditApplied?: number; notes?: string; processedBy?: string; ref?: string; }) { folioHelpers.addPayment(this as any, reservationId, method, amount, options); }

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

  applyCreditPayment(reservationId: string, amount: number, notes?: string) {
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
      processedBy: 'Front Desk'
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
      (plan as { priceType?: string } | undefined)?.priceType || 'subtotal'
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

  // Simple weekday/weekend rate calculator; can be extended with seasons
  calculateRateBreakdown(roomTypeId: string, arrival: string, departure: string, base?: number, priceType?: string) {
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
    const nightlyNet = (() => {
      if (typeof base === 'number' && !isNaN(base)) return resolveNightlyNet(base, resolvedPriceType);
      if (activePlan && typeof planBase === 'number') {
        return resolveNightlyNet(planBase, planType);
      }
      return roomTypeBase;
    })();
    const nightlyGross = resolveNightlyGross(
      typeof base === 'number' && !isNaN(base)
        ? base
        : (activePlan && typeof planBase === 'number' ? planBase : roomTypeBase),
      resolvedPriceType
    );
    for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      nightly.push({
        date: d.toISOString().slice(0, 10),
        base: parseFloat(nightlyNet.toFixed(2)),
        total: parseFloat(nightlyGross.toFixed(2)),
      });
    }
    return nightly;
  }

  // Guest management methods
  updateGuest(id: string, updatedFields: Partial<Omit<GuestProfile, 'id' | 'serialNumber' | 'createdAt' | 'updatedAt'>>) {
    const index = this.guests.findIndex(g => g.id === id);
    if (index !== -1) {
      this.guests[index] = {
        ...this.guests[index],
        ...updatedFields,
        updatedAt: new Date().toISOString()
      };
      this.persistGuests();
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

  deleteGuest(id: string) {
    const index = this.guests.findIndex(g => g.id === id);
    if (index !== -1) {
      const deleted = this.guests.splice(index, 1)[0];
      this.persistGuests();
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
      const isCorporate = !!(reservation.companyName || reservation.billingPersonName);
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
            if (fee > 0) this.addFolioCharge(folio.id, { id: `C-${Date.now().toString().slice(-6)}`, description: 'Late Checkout Fee', amount: fee });
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
        : this.calculateRateBreakdown(res.roomTypeId, res.arrival, res.departure);
      const nightlyGross = breakdown[0]?.total ?? 0;
      let charge = 0;
      switch (rm.noShowChargeType) {
        case 'first_night': charge = folioAmountFromGrossDerived(nightlyGross); break;
        case 'percent_reservation': {
          const totalGross = breakdown.reduce((s, d) => s + (d.total || 0), 0);
          charge = folioAmountFromGrossDerived(Math.max(0, (rm.noShowChargeValue || 0) / 100 * totalGross));
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
      const chargeId = `C-NS-${Date.now().toString().slice(-6)}`;
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
        reservation.departure
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


