'use client';

import { Reservation, GuestProfile, RoomType, RoomEntity, RatePlan, Folio, Charge, Payment, BillingPerson, StayReason, EventResource, EventPackage, EventBooking } from './types';
import { trackEvent } from '../analytics/trackEvent';
import { postRoomRevenue, postPayment } from '../accounting/journal';
import { housekeepingStore } from '../housekeeping/store';
import { useSettingsStore } from '../settings/store';

// HotelBiz-style enhanced interfaces
interface RoomPreferences {
  quietRoom: boolean;
  accessibleRoom: boolean;
  highFloor: boolean;
  nearElevator: boolean;
  connectingRooms: boolean;
}

interface PricingRecommendation {
  recommendedRate: number;
  confidence: number;
  factors: string[];
  demandLevel: 'low' | 'medium' | 'high';
}

interface GuestPreferences {
  roomPreferences: RoomPreferences;
  dietaryRestrictions: string[];
  specialRequests: string[];
  preferredLanguage: string;
  vipStatus: boolean;
}

interface TaxCalculation {
  vat: number;
  nhil: number;
  getfund: number;
  total: number;
}

interface FolioSplit {
  charges: Charge[];
  description: string;
  responsibleParty: string;
}

export class EnhancedFrontOfficeStore {
  reservations: Reservation[] = [];
  guests: GuestProfile[] = [];
  roomTypes: RoomType[] = [
    { id: 'rt-standard', name: 'Standard', baseRate: 600 },
    { id: 'rt-deluxe', name: 'Deluxe', baseRate: 800 },
    { id: 'rt-suite', name: 'Suite', baseRate: 1200 },
    { id: 'rt-presidential', name: 'Presidential Suite', baseRate: 2500 },
  ];
  rooms: RoomEntity[] = [
    { id: '101', roomTypeId: 'rt-standard', floor: '1', accessible: false, nearElevator: false },
    { id: '102', roomTypeId: 'rt-standard', floor: '1', accessible: true, nearElevator: false },
    { id: '201', roomTypeId: 'rt-deluxe', floor: '2', accessible: false, nearElevator: true },
    { id: '202', roomTypeId: 'rt-deluxe', floor: '2', accessible: false, nearElevator: false },
    { id: '301', roomTypeId: 'rt-suite', floor: '3', accessible: false, nearElevator: false },
    { id: '401', roomTypeId: 'rt-presidential', floor: '4', accessible: true, nearElevator: false },
  ];
  ratePlans: RatePlan[] = [
    { id: 'rp-bar', name: 'BAR', roomTypeId: 'rt-standard', basePrice: 600, isActive: true, marketSegment: 'general' },
    { id: 'rp-bar-deluxe', name: 'BAR', roomTypeId: 'rt-deluxe', basePrice: 800, isActive: true, marketSegment: 'general' },
    { id: 'rp-bar-suite', name: 'BAR', roomTypeId: 'rt-suite', basePrice: 1200, isActive: true, marketSegment: 'general' },
    { id: 'rp-bar-presidential', name: 'BAR', roomTypeId: 'rt-presidential', basePrice: 2500, isActive: true, marketSegment: 'general' },
  ];
  marketCodes: string[] = ['INTERNET', 'BOOKING.COM', 'EXPEDIA', 'DIRECTINN', 'WALK IN', 'CORPORATE', 'TRAVEL AGENT'];
  folios: Folio[] = [];
  guestPreferences: Map<string, GuestPreferences> = new Map();
  private listeners: Array<() => void> = [];

  // NEW: Event Management
  eventResources: EventResource[] = [];
  eventPackages: EventPackage[] = [];
  eventBookings: EventBooking[] = [];

  constructor() {
    // Clean slate - no demo data initialization
    // this.initializeDemoData();
  }

  private initializeDemoData() {
    // Initialize with demo guest preferences
    this.guestPreferences.set('G001', {
      roomPreferences: {
        quietRoom: true,
        accessibleRoom: false,
        highFloor: true,
        nearElevator: false,
        connectingRooms: false
      },
      dietaryRestrictions: ['vegetarian'],
      specialRequests: ['extra pillows', 'late checkout'],
      preferredLanguage: 'English',
      vipStatus: true
    });
  }

  subscribe(l: () => void) { 
    this.listeners.push(l); 
    return () => { this.listeners = this.listeners.filter(x => x !== l); }; 
  }
  
  private notify() { this.listeners.forEach(l => l()); }

  // Enhanced guest creation with preferences
  createGuest(g: Omit<GuestProfile,'id'|'serialNumber'>, preferences?: GuestPreferences) {
    const settings = useSettingsStore.getState();
    const serialNumber = settings.getNextClientNumber();
    const guest: GuestProfile = { 
      ...g, 
      id: `G-${Date.now().toString().slice(-6)}`,
      serialNumber 
    };
    
    this.guests.push(guest);
    
    if (preferences) {
      this.guestPreferences.set(guest.id, preferences);
    }
    
    this.notify(); 
    trackEvent('FO.Guest.Created', { 
      id: guest.id, 
      serialNumber: guest.serialNumber, 
      name: guest.name,
      vipStatus: preferences?.vipStatus || false
    });
    
    return guest;
  }

  // Smart room assignment with HotelBiz-style algorithm
  assignOptimalRoom(
    guestId: string,
    roomTypeId: string,
    preferences?: RoomPreferences
  ): RoomEntity | null {
    const availableRooms = this.rooms.filter(room => 
      room.roomTypeId === roomTypeId && 
      this.isRoomAvailable(room.id)
    );

    if (availableRooms.length === 0) return null;

    const guestPrefs = preferences || this.guestPreferences.get(guestId)?.roomPreferences;
    
    const scoredRooms = availableRooms.map(room => ({
      room,
      score: this.calculateRoomScore(room, guestPrefs)
    }));

    return scoredRooms.sort((a, b) => b.score - a.score)[0]?.room || null;
  }

  // NEW: Event Rate Management Methods
  
  /**
   * Calculate event conference rate with package pricing
   * Integrates with existing seasonal rates and applies event-specific discounts
   */
  calculateEventRate(
    ratePlanId: string,
    eventType: string,
    attendees: number,
    duration: number,
    startDate: string,
    packageId?: string
  ): {
    roomRate: number;
    packageCost: number;
    totalCost: number;
    breakdown: {
      baseRoomRate: number;
      seasonalAdjustment: number;
      eventDiscount: number;
      packagePrice: number;
      taxes: number;
    };
  } {
    const ratePlan = this.ratePlans.find(rp => rp.id === ratePlanId);
    if (!ratePlan || ratePlan.rateType !== 'event_conference') {
      throw new Error('Invalid event conference rate plan');
    }

    const settings = useSettingsStore.getState();
    const baseRoomRate = ratePlan.basePrice;
    
    // Apply seasonal rates (existing logic)
    const seasonalAdjustment = this.calculateRatePlanSeasonalAdjustment(ratePlan, startDate);
    const adjustedRoomRate = baseRoomRate * (1 + seasonalAdjustment);
    
    // Apply event-specific pricing
    let eventDiscount = 0;
    if (ratePlan.eventSpecific?.isEventRate) {
      // Example: Corporate conference gets 15% discount
      eventDiscount = adjustedRoomRate * 0.15;
    }
    
    const finalRoomRate = adjustedRoomRate - eventDiscount;
    const totalRoomCost = finalRoomRate * duration * attendees;
    
    // Calculate package cost if applicable
    let packageCost = 0;
    if (packageId) {
      const eventPackage = this.eventPackages.find(ep => ep.id === packageId);
      if (eventPackage) {
        packageCost = eventPackage.basePrice * attendees * duration;
        
        // Apply seasonal pricing to package
        const packageSeasonalAdjustment = this.calculatePackageSeasonalAdjustment(eventPackage, startDate);
        packageCost *= (1 + packageSeasonalAdjustment);
      }
    }
    
    // Calculate taxes (using existing compliance settings)
    const compliance = settings.getCurrentCountryCompliance();
    const taxRate = (compliance?.taxRates.vat || 0) / 100;
    const taxes = (totalRoomCost + packageCost) * taxRate;
    
    const totalCost = totalRoomCost + packageCost + taxes;
    
    return {
      roomRate: finalRoomRate,
      packageCost,
      totalCost,
      breakdown: {
        baseRoomRate,
        seasonalAdjustment,
        eventDiscount,
        packagePrice: packageCost,
        taxes
      }
    };
  }

  /**
   * Create event booking with integrated rate management
   */
  createEventBooking(bookingData: Omit<EventBooking, 'id' | 'createdAt' | 'updatedAt'>): EventBooking {
    const eventBooking: EventBooking = {
      ...bookingData,
      id: `event_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Calculate total cost using event rate management
    if (bookingData.ratePlanId) {
      const rateCalculation = this.calculateEventRate(
        bookingData.ratePlanId,
        bookingData.eventType,
        bookingData.attendees,
        this.calculateDuration(bookingData.startDate, bookingData.endDate),
        bookingData.startDate,
        bookingData.packageId
      );
      
      eventBooking.totalCost = rateCalculation.totalCost;
    }

    this.eventBookings.push(eventBooking);
    this.notify();
    
    trackEvent('FO.EventBooking.Created', {
      id: eventBooking.id,
      eventType: eventBooking.eventType,
      attendees: eventBooking.attendees,
      totalCost: eventBooking.totalCost
    });
    
    return eventBooking;
  }

  updateEventBooking(id: string, updates: Partial<EventBooking>): EventBooking | null {
    const index = this.eventBookings.findIndex(event => event.id === id);
    if (index === -1) {
      return null;
    }

    const current = this.eventBookings[index];
    const mergedCostBreakdown = updates.costBreakdown
      ? {
          ...current.costBreakdown,
          ...updates.costBreakdown,
          accommodation: {
            ...current.costBreakdown.accommodation,
            ...(updates.costBreakdown.accommodation ?? {})
          },
          package: {
            ...current.costBreakdown.package,
            ...(updates.costBreakdown.package ?? {})
          },
          services: {
            ...current.costBreakdown.services,
            ...(updates.costBreakdown.services ?? {})
          }
        }
      : current.costBreakdown;

    const updated: EventBooking = {
      ...current,
      ...updates,
      costBreakdown: mergedCostBreakdown,
      resources: updates.resources ?? current.resources,
      rooms: updates.rooms ?? current.rooms,
      updatedAt: new Date().toISOString()
    };

    this.eventBookings[index] = updated;
    this.notify();

    trackEvent('FO.EventBooking.Updated', {
      id: updated.id,
      eventType: updated.eventType,
      attendees: updated.attendees,
      totalCost: updated.totalCost
    });

    return updated;
  }

  /**
   * Get available event resources for a specific date range
   */
  getAvailableEventResources(
    startDate: string,
    endDate: string,
    resourceType?: EventResource['type']
  ): EventResource[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return this.eventResources.filter(resource => {
      if (!resource.isActive) return false;
      if (resourceType && resource.type !== resourceType) return false;
      
      // Check if resource is available for the requested dates
      const dayOfWeek = start.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];
      
      return resource.availability[dayName as keyof typeof resource.availability];
    });
  }

  /**
   * Get event packages by category with pricing
   */
  getEventPackagesByCategory(category: EventPackage['category']): EventPackage[] {
    return this.eventPackages.filter(pkg => 
      pkg.category === category && pkg.isActive
    );
  }

  /**
   * Calculate seasonal adjustment for rate plans (existing logic)
   */
  private calculateRatePlanSeasonalAdjustment(ratePlan: RatePlan, date: string): number {
    const targetDate = new Date(date);
    const seasonalRate = ratePlan.seasonalRates?.find(sr => {
      const start = new Date(sr.startDate);
      const end = new Date(sr.endDate);
      return targetDate >= start && targetDate <= end;
    });
    
    return seasonalRate ? seasonalRate.multiplier : 0;
  }

  /**
   * Calculate seasonal adjustment for event packages
   */
  private calculatePackageSeasonalAdjustment(pkg: EventPackage, date: string): number {
    const targetDate = new Date(date);
    const seasonalPricing = pkg.seasonalPricing.find(sp => {
      const start = new Date(sp.startDate);
      const end = new Date(sp.endDate);
      return targetDate >= start && targetDate <= end;
    });
    
    return seasonalPricing ? seasonalPricing.multiplier : 0;
  }

  /**
   * Calculate duration between two dates
   */
  private calculateDuration(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private calculateRoomScore(room: RoomEntity, preferences?: RoomPreferences): number {
    if (!preferences) return 50; // Default score

    let score = 50;

    // VIP guests get higher floors
    if (preferences.highFloor) {
      score += parseInt(room.floor || '0', 10) * 10;
    }

    // Prefer rooms away from elevators for quiet guests
    if (preferences.quietRoom && !room.nearElevator) {
      score += 30;
    }

    // Accessibility considerations
    if (preferences.accessibleRoom && room.accessible) {
      score += 100;
    }

    // Floor preference
    if (preferences.highFloor && parseInt(room.floor || '0', 10) >= 3) {
      score += 20;
    }

    return score;
  }

  private isRoomAvailable(roomId: string): boolean {
    const reservation = this.reservations.find(r => 
      r.roomId === roomId && 
      ['confirmed', 'checked-in'].includes(r.status)
    );
    return !reservation;
  }

  // Enhanced reservation creation with smart room assignment
  createReservation(r: Omit<Reservation,'id'|'createdAt'|'updatedAt'|'status'> & { 
    status?: Reservation['status'];
    preferences?: RoomPreferences;
  }) {
    const settings = useSettingsStore.getState();
    const res: Reservation = { 
      ...r, 
      id: `R-${Date.now().toString().slice(-6)}`, 
      resId: settings.getNextReservationNumber(),
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString(), 
      status: r.status || 'pending' 
    };

    // Auto-assign room if preferences are provided
    if (r.preferences && r.roomTypeId) {
      const optimalRoom = this.assignOptimalRoom(r.guestId, r.roomTypeId, r.preferences);
      if (optimalRoom) {
        res.roomId = optimalRoom.id;
      }
    }

    this.reservations.unshift(res); 
    this.notify(); 
    
    trackEvent('FO.Reservation.Created', { 
      id: res.id, 
      guest: res.guestName, 
      arrival: res.arrival, 
      departure: res.departure,
      roomAssigned: !!res.roomId
    }); 
    
    return res;
  }

  // Advanced folio management with HotelBiz features
  createSplitFolio(
    reservationId: string,
    splits: FolioSplit[]
  ): Folio[] {
    const newFolios: Folio[] = [];
    
    splits.forEach((split, index) => {
      const folio: Folio = {
        id: `F-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        reservationId,
        charges: split.charges,
        payments: [],
        currency: 'GHS',
        status: 'active',
        type: 'split',
        description: split.description,
        responsibleParty: split.responsibleParty
      };
      
      newFolios.push(folio);
      this.folios.push(folio);
    });

    this.notify();
    trackEvent('FO.Folio.Split', { reservationId, splitCount: splits.length });
    
    return newFolios;
  }

  // Ghana-specific tax calculations
  calculateTaxes(charges: Charge[]): TaxCalculation {
    const taxableAmount = charges.reduce((sum, charge) => 
      charge.taxable ? sum + charge.amount : sum, 0
    );
    
    return {
      vat: taxableAmount * 0.125, // 12.5% VAT
      nhil: taxableAmount * 0.025, // 2.5% NHIL
      getfund: taxableAmount * 0.025, // 2.5% GETFund
      total: taxableAmount * 0.175
    };
  }

  // Revenue optimization with dynamic pricing
  suggestDynamicPricing(
    roomTypeId: string,
    date: string,
    demandLevel: 'low' | 'medium' | 'high'
  ): PricingRecommendation {
    const roomType = this.roomTypes.find(rt => rt.id === roomTypeId);
    if (!roomType) {
      throw new Error(`Room type ${roomTypeId} not found`);
    }

    const demandMultipliers = {
      low: 0.8,
      medium: 1.0,
      high: 1.3
    };

    const baseRate = roomType.baseRate;
    const demandMultiplier = demandMultipliers[demandLevel];
    const seasonalAdjustment = this.calculateSeasonalAdjustment(date);
    
    const recommendedRate = Math.round(baseRate * demandMultiplier * seasonalAdjustment);

    return {
      recommendedRate,
      confidence: this.calculatePricingConfidence(demandLevel, seasonalAdjustment),
      factors: ['demand', 'seasonality', 'competition'],
      demandLevel
    };
  }

  private calculateSeasonalAdjustment(date: string): number {
    const month = new Date(date).getMonth();
    
    // Ghana tourism seasons
    const seasonalRates: { [key: number]: number } = {
      0: 1.2,   // January - Peak season
      1: 1.1,   // February - Peak season
      2: 1.0,   // March - Regular season
      3: 0.9,   // April - Low season
      4: 0.8,   // May - Low season
      5: 0.9,   // June - Low season
      6: 1.0,   // July - Regular season
      7: 1.1,   // August - Peak season
      8: 1.2,   // September - Peak season
      9: 1.1,   // October - Peak season
      10: 1.0,  // November - Regular season
      11: 1.2   // December - Peak season
    };

    return seasonalRates[month] || 1.0;
  }

  private calculatePricingConfidence(demandLevel: string, seasonalAdjustment: number): number {
    let confidence = 70; // Base confidence
    
    // Adjust based on demand level
    if (demandLevel === 'high') confidence += 15;
    if (demandLevel === 'low') confidence -= 10;
    
    // Adjust based on seasonal factors
    if (seasonalAdjustment > 1.1) confidence += 10;
    if (seasonalAdjustment < 0.9) confidence += 5;
    
    return Math.min(confidence, 100);
  }

  // Enhanced check-in with express option
  expressCheckIn(reservationId: string): boolean {
    const reservation = this.reservations.find(r => r.id === reservationId);
    if (!reservation || reservation.status !== 'confirmed') {
      return false;
    }

    // Auto-assign room if not already assigned
    if (!reservation.roomId && reservation.roomTypeId) {
      const guestPrefs = this.guestPreferences.get(reservation.guestId);
      const optimalRoom = this.assignOptimalRoom(
        reservation.guestId, 
        reservation.roomTypeId, 
        guestPrefs?.roomPreferences
      );
      
      if (optimalRoom) {
        reservation.roomId = optimalRoom.id;
      }
    }

    reservation.status = 'checked-in';
    reservation.updatedAt = new Date().toISOString();
    
    this.notify();
    trackEvent('FO.Reservation.ExpressCheckIn', { id: reservationId });
    
    return true;
  }

  // Group booking management
  createGroupReservation(
    groupLeader: GuestProfile,
    groupMembers: Omit<GuestProfile, 'id'|'serialNumber'>[],
    groupDetails: {
      arrival: string;
      departure: string;
      roomTypeId: string;
      specialRequests: string[];
    }
  ): Reservation[] {
    const reservations: Reservation[] = [];
    
    // Create main group reservation
    const groupReservation = this.createReservation({
      ...groupDetails,
      guestId: groupLeader.id,
      guestName: groupLeader.name || `${groupLeader.firstName} ${groupLeader.lastName}`,
      groupId: `GRP-${Date.now()}`,
      groupSize: groupMembers.length + 1,
      isGroupLeader: true,
      stayReason: 'group' as any,
      stayReasonDetails: 'Group booking'
    });
    
    reservations.push(groupReservation);
    
    // Create individual reservations for group members
    groupMembers.forEach((member, index) => {
      const memberGuest = this.createGuest(member);
      const memberReservation = this.createReservation({
        ...groupDetails,
        guestId: memberGuest.id,
        guestName: memberGuest.name || `${memberGuest.firstName} ${memberGuest.lastName}`,
        groupId: groupReservation.groupId,
        groupSize: groupMembers.length + 1,
        isGroupLeader: false,
        linkedReservationId: groupReservation.id,
        stayReason: 'group' as any,
        stayReasonDetails: 'Group booking'
      });
      
      reservations.push(memberReservation);
    });
    
    trackEvent('FO.GroupReservation.Created', { 
      groupId: groupReservation.groupId, 
      groupSize: reservations.length 
    });
    
    return reservations;
  }

  // Upsell services tracking
  addUpsellService(
    reservationId: string,
    service: {
      name: string;
      amount: number;
      description: string;
      category: 'room-upgrade' | 'amenity' | 'service' | 'transport';
    }
  ) {
    const folio = this.getOrCreateFolio(reservationId);
    
    const charge: Charge = {
      id: `C-${Date.now()}`,
      description: service.description,
      amount: service.amount,
      category: service.category,
      taxable: true,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0]
    };
    
    folio.charges.push(charge);
    this.notify();
    
    trackEvent('FO.UpsellService.Added', { 
      reservationId, 
      service: service.name, 
      amount: service.amount 
    });
  }

  // Enhanced methods from original store
  getNextClientNumber(): string {
    const settings = useSettingsStore.getState();
    return settings.getNextClientNumber();
  }

  updateReservation(res: Reservation) { 
    this.reservations = this.reservations.map(r => 
      r.id === res.id ? { ...res, updatedAt: new Date().toISOString() } : r
    ); 
    this.notify(); 
    trackEvent('FO.Reservation.Updated', { id: res.id }); 
  }
  
  cancelReservation(id: string) { 
    this.reservations = this.reservations.map(r => 
      r.id === id ? { ...r, status: 'cancelled', updatedAt: new Date().toISOString() } : r
    ); 
    this.notify(); 
    trackEvent('FO.Reservation.Cancelled', { id }); 
  }
  
  assignRoom(id: string, roomId: string) { 
    this.reservations = this.reservations.map(r => 
      r.id === id ? { ...r, roomId } : r
    ); 
    this.notify(); 
  }
  
  checkIn(id: string) {
    const res = this.reservations.find(r => r.id === id);
    this.reservations = this.reservations.map(r => 
      r.id === id ? { ...r, status: 'checked-in' } : r
    );
    this.notify();
    
    if (res?.roomId) {
      housekeepingStore.updateRoomStatus(res.roomId, 'occupied', 'FrontDesk', `Guest ${res.guestName} checked in`);
    }
    
    trackEvent('FO.Reservation.CheckedIn', { id });
  }
  
  checkOut(id: string) {
    const res = this.reservations.find(r => r.id === id);
    this.reservations = this.reservations.map(r => 
      r.id === id ? { ...r, status: 'checked-out' } : r
    );
    this.notify();
    
    if (res?.roomId) {
      housekeepingStore.updateRoomStatus(res.roomId, 'dirty', 'FrontDesk', 'Guest checked out');
      housekeepingStore.createTask({ 
        roomNumber: res.roomId, 
        roomTypeId: res.roomTypeId, 
        taskType: 'turnover', 
        priority: 'high', 
        estimatedMinutes: 45, 
        checklist: ['Change linens', 'Clean bathroom', 'Vacuum floor', 'Restock amenities'] 
      });
    }
    
    trackEvent('FO.Reservation.CheckedOut', { id });
  }

  // Folio helpers
  getOrCreateFolio(reservationId: string): Folio {
    let f = this.folios.find(x => x.reservationId === reservationId);
    if (!f) {
      f = { 
        id: `F-${Date.now().toString().slice(-6)}`, 
        reservationId, 
        charges: [], 
        payments: [], 
        currency: 'GHS',
        status: 'active',
        type: 'main'
      };
      this.folios.unshift(f); 
      this.notify();
    }
    return f;
  }

  // Maintenance flow
  reportMaintenance(roomId: string, category: 'plumbing'|'electrical'|'hvac'|'furniture'|'appliances'|'structural'|'other', description: string) {
    housekeepingStore.updateRoomStatus(roomId, 'out-of-order', 'FrontDesk', description);
    housekeepingStore.createMaintenanceRequest({ 
      roomNumber: roomId, 
      reportedBy: 'Front Desk', 
      category, 
      priority: 'high', 
      description 
    });
    trackEvent('FO.Maintenance.Reported', { roomId, category });
  }

  // Rate Plan Management
  addRatePlan(ratePlan: RatePlan) {
    this.ratePlans.push(ratePlan);
    this.notify();
    trackEvent('FO.RatePlan.Created', { id: ratePlan.id, name: ratePlan.name });
  }

  updateRatePlan(id: string, updates: Partial<RatePlan>) {
    this.ratePlans = this.ratePlans.map(rp => 
      rp.id === id ? { ...rp, ...updates, updatedAt: new Date().toISOString() } : rp
    );
    this.notify();
    trackEvent('FO.RatePlan.Updated', { id });
  }

  deleteRatePlan(id: string) {
    this.ratePlans = this.ratePlans.filter(rp => rp.id !== id);
    this.notify();
    trackEvent('FO.RatePlan.Deleted', { id });
  }
}

// Export singleton instance
export const enhancedFrontOfficeStore = new EnhancedFrontOfficeStore();
