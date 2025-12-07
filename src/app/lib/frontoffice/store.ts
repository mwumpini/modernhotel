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

import { Reservation, GuestProfile, RoomType, RoomEntity, RatePlan, Folio, FolioPayment, BillingPerson, StayReason } from './types';
import { trackEvent } from '../analytics/trackEvent';
import { logAudit } from '../analytics/auditLogStore';
import { postRoomRevenue, postPayment } from '../accounting/journal';
import * as folioHelpers from './helpers/folio';
import { housekeepingStore } from '../housekeeping/store';
import { useSettingsStore } from '../settings/store';
import { useAccountingStore } from '../accounting/store';
import * as apiHelpers from './helpers/api';
import * as seedHelpers from './helpers/seed';
import * as invoiceHelpers from './helpers/invoice';

class FrontOfficeStore {
  reservations: Reservation[] = [];
  guests: GuestProfile[] = [];
  billingPersons: BillingPerson[] = [];
  private hydratedGuests: boolean = false;
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
  private initializeSampleReservations() { seedHelpers.initializeSampleReservations(this as any); const seedFolio = (reservationId: string, charges: number[], payments: Array<{ method: 'Cash'|'Card'|'Mobile Money'|'Corporate Account'|'Bank Transfer'|'Check'|'Credit'; amount?: number }>) => { charges.forEach(amount => this.addCharge(reservationId, 'Room Charge', amount)); const f = this.getOrCreateFolio(reservationId); this.updateFolioBalances(f); payments.forEach(p => { const val = typeof p.amount === 'number' ? p.amount : (this.getOrCreateFolio(reservationId).balance || 0); if (val > 0) this.addPayment(reservationId, p.method, val); }); }; seedFolio('R-004', [600, 150, 100], [ { method: 'Card' } ]); seedFolio('R-005', [800, 250], [ { method: 'Corporate Account' } ]); seedFolio('R-006', [1000, 300, 100], [ { method: 'Cash', amount: 700 } ]); }

  subscribe(l: () => void) { this.listeners.push(l); return () => { this.listeners = this.listeners.filter(x => x !== l); }; }
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

  processSelfCheckin(token: string, checkinData: { specialRequests?: string; vehicleInfo?: string; emergencyContact?: string }) {
    const guest = this.getGuestBySelfCheckinToken(token);
    if (!guest) {
      throw new Error('Invalid or expired self-checkin token');
    }

    // TODO: Update reservation status to 'checked-in'
    // TODO: Generate room access code
    // TODO: Send welcome message

    trackEvent('FO.Guest.SelfCheckinProcessed', {
      guest: `${guest.firstName} ${guest.lastName}`,
      token: token
    });

    return { success: true, guest: guest.name };
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
    
    return reservation;
  }

  updateReservation(res: Reservation) { this.reservations = this.reservations.map(r => r.id === res.id ? { ...res, updatedAt: new Date().toISOString() } : r); this.notify(); trackEvent('FO.Reservation.Updated', { id: res.id }); }
  cancelReservation(id: string) {
    const settingsState = (() => { try { return useSettingsStore.getState(); } catch { return undefined as any; } })();
    const policy = settingsState?.roomManagement;
    this.reservations = this.reservations.map(r => r.id === id ? { ...r, status: 'cancelled', updatedAt: new Date().toISOString() } : r);
    this.notify();
    trackEvent('FO.Reservation.Cancelled', { id });
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
          const nightly = (res.rateBreakdown && res.rateBreakdown[0]?.total) ? res.rateBreakdown[0].total : 0;
          let penalty = 0;
          switch (policy.lateCancellationFeeType) {
            case 'first_night': penalty = nightly; break;
            case 'percent_reservation': {
              const remainingTotal = (res.rateBreakdown || []).reduce((s, d) => s + (d.total || 0), 0);
              penalty = Math.max(0, (policy.lateCancellationFeeValue || 0) / 100 * remainingTotal);
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
  assignRoom(id: string, roomId: string) { this.reservations = this.reservations.map(r => r.id === id ? { ...r, roomId } : r); this.notify(); }
  checkIn(id: string) {
    const res = this.reservations.find(r => r.id === id);

    // Auto-assign a room if none is assigned yet so Check-Ins view reflects immediately
    let assignedRoomId = (res?.roomId && res.roomId !== 'TBD') ? res.roomId : undefined;
    const settings = (() => { try { return useSettingsStore.getState(); } catch { return undefined as any; } })();
    const shouldAutoAssign = settings?.roomSettings?.autoAssignRooms !== false;
    try {
      if (!assignedRoomId && res && shouldAutoAssign) {
        // Prefer vacant rooms matching the reservation's room type
        const matchingVacant = housekeepingStore
          .getRoomsByStatus('vacant')
          .filter(room => room.roomTypeId === res.roomTypeId);
        const fallbackVacant = housekeepingStore.getRoomsByStatus('vacant');
        const candidate = matchingVacant[0] || fallbackVacant[0];
        if (candidate) assignedRoomId = candidate.roomNumber;
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
    // Auto-post nightly room charges to folio based on reservation rate breakdown
    try {
      const reservation = this.reservations.find(r => r.id === id);
      if (reservation) {
        // Ensure we have a rate breakdown; compute if missing
        const breakdown = (reservation.rateBreakdown && reservation.rateBreakdown.length > 0)
          ? reservation.rateBreakdown
          : this.calculateRateBreakdown(reservation.roomTypeId, reservation.arrival, reservation.departure);

        const folio = this.getOrCreateFolio(reservation.id);
        const existingDates = new Set((folio.charges || [])
          .filter(c => (c.description || '').toLowerCase().includes('room'))
          .map(c => c.date));

        for (const day of breakdown) {
          if (!existingDates.has(day.date)) {
            this.addFolioCharge(folio.id, {
              id: `C-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*1000)}`,
              date: day.date,
              description: 'Room Charge',
              amount: day.total,
            });
          }
        }
        this.updateFolioBalances(folio);
      }
    } catch (e) {
      console.warn('FO: Failed to auto-post room charges on check-in', e);
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
  }
  checkOut(id: string) {
    const res = this.reservations.find(r => r.id === id);
    // Early checkout handling: remove future room charges if policy is enabled
    try {
      const settingsState = (() => { try { return useSettingsStore.getState(); } catch { return undefined as any; } })();
      const policyEnabled = !!settingsState?.roomManagement?.earlyCheckoutPolicyEnabled;
      if (policyEnabled && res) {
        const folio = this.getOrCreateFolio(id);
        const today = new Date();
        const todayISO = today.toISOString().slice(0,10);
        // Keep charges up to yesterday (or today if posted earlier), drop any future-dated room charges
        const kept: any[] = [];
        const removed: any[] = [];
        for (const ch of folio.charges) {
          const isRoom = (ch.description || '').toLowerCase().includes('room');
          const dateOnly = (ch.date || '').slice(0,10);
          if (isRoom) {
            if (dateOnly && dateOnly > todayISO) {
              removed.push(ch);
              continue;
            }
          }
          kept.push(ch);
        }
        if (removed.length > 0) {
          folio.charges = kept;
          this.updateFolioBalances(folio);
          try { trackEvent('FO.Folio.RoomChargesRemovedEarlyCheckout' as any, { reservationId: id, removed: removed.length }); } catch {}
          try { logAudit({ area: 'frontdesk', action: 'update', entity: 'Folio', entityId: id, details: `Removed ${removed.length} future room charge(s) due to early checkout`, severity: 'medium' }); } catch {}
        }
      }
    } catch {}

    this.reservations = this.reservations.map(r => r.id === id ? { ...r, status: 'checked-out' } : r);
    this.notify();
    if (res?.roomId) {
      housekeepingStore.updateRoomStatus(res.roomId, 'dirty', 'FrontDesk', 'Guest checked out');
      housekeepingStore.createTask({ roomNumber: res.roomId, roomTypeId: res.roomTypeId, taskType: 'turnover', priority: 'high', estimatedMinutes: 45, checklist: ['Change linens', 'Clean bathroom', 'Vacuum floor', 'Restock amenities'] });
    }
    trackEvent('FO.Reservation.CheckedOut', { id });
    try {
      const checkOutEventId = `EVT-CO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`;
      logAudit({
        area: 'frontdesk',
        action: 'status',
        entity: 'Reservation',
        entityId: id,
        details: 'Reservation checked out',
        meta: { eventId: checkOutEventId, eventType: 'check-out' }
      });
    } catch {}

    // Auto-generate accounting invoice at checkout
    try { this.generateAccountingInvoiceForReservation(id); } catch (e) { console.warn('FO: Auto-invoice generation failed', e); }
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

  // Simple weekday/weekend rate calculator; can be extended with seasons
  calculateRateBreakdown(roomTypeId: string, arrival: string, departure: string, base?: number) {
    const start = new Date(arrival);
    const end = new Date(departure);
    const nightly: { date: string; base: number; total: number }[] = [];
    // Prefer default rate plan from settings if available (treated as gross per-night)
    const settings = useSettingsStore.getState();
    const defaultRpId = (settings.roomManagement.defaultRatePlanByRoomType || {})[roomTypeId];
    const defaultRp = defaultRpId ? this.ratePlans.find(rp => rp.id === defaultRpId) : undefined;
    // Determine nightly gross base: plan.basePrice (gross) if available; otherwise convert roomType baseRate (net) to gross
    // Compute gross factor from layered settings (fallback to approx if not available)
    const layeredRates = (() => {
      try { return (this as any).getTaxRates(); } catch { return { vat: 12.5, nhil: 2.5, getfund: 0, covid: 0, levy: 1.0 }; }
    })();
    const subtotalFor1 = 1;
    const levies = subtotalFor1 * (Number(layeredRates.nhil || 0) / 100)
      + subtotalFor1 * (Number(layeredRates.getfund || 0) / 100)
      + subtotalFor1 * (Number(layeredRates.covid || 0) / 100);
    const vatOnLevied = (subtotalFor1 + levies) * (Number(layeredRates.vat || 0) / 100);
    const tourism = subtotalFor1 * (Number(layeredRates.levy || 0) / 100);
    const GHANA_GROSS_FACTOR = 1 + levies + vatOnLevied + tourism;
    const roomTypeBase = this.roomTypes.find(rt => rt.id === roomTypeId)?.baseRate || 0;
    const defaultBaseGross = (() => {
      if (typeof base === 'number' && !isNaN(base)) return base;
      if (defaultRp && typeof (defaultRp.basePrice ?? defaultRp.price) === 'number') return (defaultRp.basePrice ?? defaultRp.price) as number;
      const anyPlan = this.ratePlans.find(rp => rp.roomTypeId === roomTypeId);
      if (anyPlan && typeof (anyPlan.basePrice ?? anyPlan.price) === 'number') return (anyPlan.basePrice ?? anyPlan.price) as number;
      return roomTypeBase * GHANA_GROSS_FACTOR;
    })();
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const rate = defaultBaseGross; // use layered gross from settings
      const val = parseFloat(rate.toFixed(2));
      nightly.push({ date: d.toISOString().slice(0,10), base: val, total: val });
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
    if (reservation) {
      reservation.status = newStatus as any;
      reservation.updatedAt = new Date().toISOString();
      
      // If checking in, add check-in time
      if (newStatus === 'checked-in') {
        (reservation as any).checkInTime = new Date().toISOString();
        try {
          const checkInEventId = `EVT-CI-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`;
          logAudit({
            area: 'frontdesk',
            action: 'status',
            entity: 'Reservation',
            entityId: reservationId,
            details: 'Reservation checked in',
            meta: { eventId: checkInEventId, eventType: 'check-in' }
          });
        } catch {}
      }
      
      // If checking out, add check-out time
      if (newStatus === 'checked-out') {
        (reservation as any).checkOutTime = new Date().toISOString();
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
      }
      
      this.notify();
      
      trackEvent('FO.Reservation.StatusUpdated', {
        reservationId: reservationId,
        guestName: reservation.guestName,
        oldStatus: reservation.status,
        newStatus: newStatus
      });

      return reservation;
    }
    return null;
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
            const nightly = (reservation.rateBreakdown && reservation.rateBreakdown[0]?.total) ? reservation.rateBreakdown[0].total : 0;
            let fee = 0;
            if ((rm.lateCheckoutFeeType || 'flat') === 'percent_of_nightly') {
              fee = Math.max(0, (rm.lateCheckoutFeeValue || 0) / 100 * nightly);
            } else {
              fee = Math.max(0, rm.lateCheckoutFeeValue || 0);
            }
            if (fee > 0) this.addFolioCharge(folio.id, { id: `C-${Date.now().toString().slice(-6)}`, description: 'Late Checkout Fee', amount: fee });
          }
        }
      } catch {}

      reservation.status = 'checked-out';
      reservation.updatedAt = new Date().toISOString();
      (reservation as any).checkOutTime = new Date().toISOString();
      (reservation as any).checkoutNotes = checkoutNotes;
      
      // Keep housekeeping in sync (mirror logic from checkOut)
      try {
        if (reservation.roomId) {
          housekeepingStore.updateRoomStatus(reservation.roomId, 'dirty', 'FrontDesk', 'Guest checked out');
          housekeepingStore.createTask({ roomNumber: reservation.roomId, roomTypeId: reservation.roomTypeId, taskType: 'turnover', priority: 'high', estimatedMinutes: 45, checklist: ['Change linens', 'Clean bathroom', 'Vacuum floor', 'Restock amenities'] });
        }
      } catch {}

      this.notify();
      
      trackEvent('FO.Reservation.CheckedOut', {
        reservationId: reservationId,
        guestName: reservation.guestName,
        checkoutNotes
      });

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

      // Auto-generate accounting invoice at checkout
      try { this.generateAccountingInvoiceForReservation(reservationId); } catch (e) { console.warn('FO: Auto-invoice generation failed', e); }

      return reservation;
    }
    return null;
  }

  // Mark No-Show per policy (charges if configured)
  markNoShow(reservationId: string) {
    const res = this.reservations.find(r => r.id === reservationId);
    if (!res) return;
    const settingsState = (() => { try { return useSettingsStore.getState(); } catch { return undefined as any; } })();
    const rm = settingsState?.roomManagement;
    this.reservations = this.reservations.map(r => r.id === reservationId ? { ...r, status: 'no-show', updatedAt: new Date().toISOString() } : r);
    this.notify();
    trackEvent('FO.Reservation.NoShow' as any, { reservationId });
    try {
      if (rm?.noShowPolicyEnabled) {
        const folio = this.getOrCreateFolio(reservationId);
        const nightly = (res.rateBreakdown && res.rateBreakdown[0]?.total) ? res.rateBreakdown[0].total : 0;
        let charge = 0;
        switch (rm.noShowChargeType) {
          case 'first_night': charge = nightly; break;
          case 'percent_reservation': {
            const total = (res.rateBreakdown || []).reduce((s, d) => s + (d.total || 0), 0);
            charge = Math.max(0, (rm.noShowChargeValue || 0) / 100 * total);
            break;
          }
          case 'flat': charge = Math.max(0, rm.noShowChargeValue || 0); break;
          default: charge = 0;
        }
        if (charge > 0) this.addFolioCharge(folio.id, { id: `C-${Date.now().toString().slice(-6)}`, description: 'No-Show Charge', amount: charge });
      }
    } catch {}
  }

  // Generate an accounting invoice from a reservation folio and mark reservation
  private generateAccountingInvoiceForReservation(reservationId: string) { return invoiceHelpers.generateAccountingInvoiceForReservation(this as any, reservationId); }

  // Extend stay for a reservation
  extendStay(reservationId: string, additionalNights: number) {
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (reservation) {
      const currentDeparture = new Date(reservation.departure);
      currentDeparture.setDate(currentDeparture.getDate() + additionalNights);
      reservation.departure = currentDeparture.toISOString();
      reservation.updatedAt = new Date().toISOString();
      
      this.notify();
      
      trackEvent('FO.Reservation.Updated', {
        reservationId: reservationId,
        guestName: reservation.guestName,
        action: 'extend_stay',
        additionalNights,
        newDeparture: currentDeparture.toISOString()
      });

      return reservation;
    }
    return null;
  }
}

export const frontOfficeStore = new FrontOfficeStore();


