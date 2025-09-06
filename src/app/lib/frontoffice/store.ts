'use client';

import { Reservation, GuestProfile, RoomType, RoomEntity, RatePlan, Folio, BillingPerson, StayReason } from './types';
import { trackEvent } from '../analytics/trackEvent';
import { logAudit } from '../analytics/auditLogStore';
import { postRoomRevenue, postPayment } from '../accounting/journal';
import { housekeepingStore } from '../housekeeping/store';
import { useSettingsStore } from '../settings/store';

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

    // Initial rooms sync from settings
    try {
      this.syncRoomsFromSettings();
      // Subscribe to settings changes so rooms reflect Settings in real-time
      useSettingsStore.subscribe((state) => state.roomManagement.rooms, () => {
        this.syncRoomsFromSettings();
      });
    } catch (e) {
      console.warn('FO: Room sync subscription failed', e);
    }
  }

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
      const mapped = cfgRooms.map(r => ({
        id: r.number,
        roomTypeId: r.typeId,
        floor: r.floor || ''
      }));
      this.rooms = mapped;
      this.notify();
      trackEvent('FO.Rooms.SyncedFromSettings', { count: mapped.length });
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
  async syncReservationsFromApi(tenantSubdomain: string) {
    try {
      const res = await fetch('/api/reservations', {
        headers: { 'x-tenant-subdomain': tenantSubdomain }
      });
      if (!res.ok) return;
      const data = await res.json();
      const mapped: Reservation[] = (data.reservations || []).map((r: any) => ({
        id: r.id,
        guestId: r.guestId,
        guestName: r.guest?.name || 'Guest',
        roomTypeId: 'rt-standard',
        ratePlanId: undefined,
        arrival: new Date(r.checkInDate).toISOString(),
        departure: new Date(r.checkOutDate).toISOString(),
        status: (r.status as any) || 'pending',
        source: r.source || 'Direct',
        roomId: r.roomId || undefined,
        adults: r.adults ?? 1,
        children: r.children ?? 0,
        isGuaranteed: false,
        remarksToGuest: undefined,
        marketCodes: [],
        internalNotes: undefined,
        stayReason: 'personal',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }));
      this.reservations = mapped;
      this.notify();
    } catch (e) {
      console.error('Failed to sync reservations from API', e);
    }
  }

  // Create reservation via API helpers
  async createGuestAndReservationViaApi(tenantSubdomain: string, payload: {
    guestName: string;
    guestPhone?: string;
    guestEmail?: string;
    arrival: string;
    departure: string;
    adults?: number;
    children?: number;
    source?: string;
  }) {
    try {
      const guestResp = await fetch('/api/guests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-subdomain': tenantSubdomain
        },
        body: JSON.stringify({
          name: payload.guestName,
          phone: payload.guestPhone,
          email: payload.guestEmail,
          nationality: 'Ghana'
        })
      });
      if (!guestResp.ok) throw new Error('Failed to create guest');
      const guest = await guestResp.json();

      const resResp = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-subdomain': tenantSubdomain
        },
        body: JSON.stringify({
          guestId: guest.id,
          checkInDate: payload.arrival,
          checkOutDate: payload.departure,
          adults: payload.adults ?? 1,
          children: payload.children ?? 0,
          status: 'confirmed',
          source: payload.source || 'Direct'
        })
      });
      if (!resResp.ok) throw new Error('Failed to create reservation');
      await this.syncReservationsFromApi(tenantSubdomain);
    } catch (e) {
      console.error('Failed to create reservation via API', e);
    }
  }

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
  cancelReservation(id: string) { this.reservations = this.reservations.map(r => r.id === id ? { ...r, status: 'cancelled', updatedAt: new Date().toISOString() } : r); this.notify(); trackEvent('FO.Reservation.Cancelled', { id }); }
  assignRoom(id: string, roomId: string) { this.reservations = this.reservations.map(r => r.id === id ? { ...r, roomId } : r); this.notify(); }
  checkIn(id: string) {
    const res = this.reservations.find(r => r.id === id);
    this.reservations = this.reservations.map(r => r.id === id ? { ...r, status: 'checked-in' } : r);
    this.notify();
    if (res?.roomId) {
      housekeepingStore.updateRoomStatus(res.roomId, 'occupied', 'FrontDesk', `Guest ${res.guestName} checked in`);
    }
    trackEvent('FO.Reservation.CheckedIn', { id });
  }
  checkOut(id: string) {
    const res = this.reservations.find(r => r.id === id);
    this.reservations = this.reservations.map(r => r.id === id ? { ...r, status: 'checked-out' } : r);
    this.notify();
    if (res?.roomId) {
      housekeepingStore.updateRoomStatus(res.roomId, 'dirty', 'FrontDesk', 'Guest checked out');
      housekeepingStore.createTask({ roomNumber: res.roomId, roomTypeId: res.roomTypeId, taskType: 'turnover', priority: 'high', estimatedMinutes: 45, checklist: ['Change linens', 'Clean bathroom', 'Vacuum floor', 'Restock amenities'] });
    }
    trackEvent('FO.Reservation.CheckedOut', { id });
  }

  // Folio helpers
  getOrCreateFolio(reservationId: string): Folio {
    let f = this.folios.find(x => x.reservationId === reservationId);
    if (!f) {
      f = { id: `F-${Date.now().toString().slice(-6)}`, reservationId, charges: [], payments: [], currency: 'GHS' };
      this.folios.unshift(f); this.notify();
    }
    return f;
  }

  // Maintenance flow
  reportMaintenance(roomId: string, category: 'plumbing'|'electrical'|'hvac'|'furniture'|'appliances'|'structural'|'other', description: string) {
    housekeepingStore.updateRoomStatus(roomId, 'out-of-order', 'FrontDesk', description);
    housekeepingStore.createMaintenanceRequest({ roomNumber: roomId, reportedBy: 'Front Desk', category, priority: 'high', description });
  }

  private getTaxRates() {
    const vat = Number(localStorage.getItem('tax.vat') || '12.5');
    const nhil = Number(localStorage.getItem('tax.nhil') || '2.5');
    const levy = Number(localStorage.getItem('tax.tourism') || '1.0');
    return { vat, nhil, levy };
  }

  addCharge(reservationId: string, description: string, amount: number) {
    const f = this.getOrCreateFolio(reservationId);
    const { vat, nhil, levy } = this.getTaxRates();
    const tax = amount * (vat + nhil + levy) / 100;
    f.charges.push({ id: `C-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), description, amount, tax });
    this.notify();
    trackEvent('FO.Folio.ChargePosted', { reservationId, description, amount, tax });
    if (description.toLowerCase().includes('room')) {
      postRoomRevenue(reservationId, amount, tax);
    }
  }

  addPayment(reservationId: string, method: 'Cash'|'Card'|'Mobile Money', amount: number) {
    const f = this.getOrCreateFolio(reservationId);
    f.payments.push({ id: `P-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), method, amount });
    this.notify();
    trackEvent('FO.Folio.PaymentReceived', { reservationId, method, amount });
    postPayment(reservationId, method, amount);
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
    const defaultBase = base ?? (this.ratePlans.find(rp => rp.roomTypeId === roomTypeId)?.price || this.roomTypes.find(rt => rt.id === roomTypeId)?.baseRate || 0);
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay(); // 0 Sun..6 Sat
      const isWeekend = dow === 5 || dow === 6; // Fri/Sat
      const rate = isWeekend ? defaultBase * 1.07 : defaultBase; // +7% weekend bump
      nightly.push({ date: d.toISOString().slice(0,10), base: Math.round(rate), total: Math.round(rate) });
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
        const createdAt = new Date(c.createdAt);
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
      id: reservationData.id || `res-${Date.now()}`,
      guestName: reservationData.guestName,
      guestPhone: reservationData.guestPhone,
      guestEmail: reservationData.guestEmail,
      roomType: reservationData.roomType,
      arrival: reservationData.arrival,
      departure: reservationData.departure,
      adults: reservationData.adults,
      children: reservationData.children,
      specialRequests: reservationData.specialRequests,
      status: reservationData.status as any,
      source: reservationData.source,
      createdAt: reservationData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Set default values for required fields
      nationality: 'Ghana',
      idType: 'passport',
      idNumber: `WALKIN-${Date.now()}`,
      emergencyContactName: reservationData.guestName,
      emergencyContactRelationship: 'self',
      emergencyContactPhone: reservationData.guestPhone,
      roomTypeId: this.roomTypes.find(rt => rt.name === reservationData.roomType)?.id || 'rt-standard',
      ratePlanId: this.ratePlans.find(rp => rp.roomTypeId === (this.roomTypes.find(rt => rt.name === reservationData.roomType)?.id || 'rt-standard'))?.id,
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
      roomType: newReservation.roomType
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
      }
      
      // If checking out, add check-out time
      if (newStatus === 'checked-out') {
        (reservation as any).checkOutTime = new Date().toISOString();
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
      reservation.status = 'checked-out';
      reservation.updatedAt = new Date().toISOString();
      (reservation as any).checkOutTime = new Date().toISOString();
      (reservation as any).checkoutNotes = checkoutNotes;
      
      this.notify();
      
      trackEvent('FO.Reservation.CheckedOut', {
        reservationId: reservationId,
        guestName: reservation.guestName,
        checkoutNotes
      });

      return reservation;
    }
    return null;
  }

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


