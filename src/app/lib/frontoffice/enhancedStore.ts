'use client';

import { Reservation, GuestProfile, RoomType, RoomEntity, RatePlan, Folio, Charge, Payment } from './types';
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
    { id: 'rp-bar', name: 'BAR', roomTypeId: 'rt-standard', price: 600 },
    { id: 'rp-bar-deluxe', name: 'BAR', roomTypeId: 'rt-deluxe', price: 800 },
    { id: 'rp-bar-suite', name: 'BAR', roomTypeId: 'rt-suite', price: 1200 },
    { id: 'rp-bar-presidential', name: 'BAR', roomTypeId: 'rt-presidential', price: 2500 },
  ];
  marketCodes: string[] = ['INTERNET', 'BOOKING.COM', 'EXPEDIA', 'DIRECTINN', 'WALK IN', 'CORPORATE', 'TRAVEL AGENT'];
  folios: Folio[] = [];
  guestPreferences: Map<string, GuestPreferences> = new Map();
  private listeners: Array<() => void> = [];

  constructor() {
    this.initializeDemoData();
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

  private calculateRoomScore(room: RoomEntity, preferences?: RoomPreferences): number {
    if (!preferences) return 50; // Default score

    let score = 50;

    // VIP guests get higher floors
    if (preferences.highFloor) {
      score += parseInt(room.floor) * 10;
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
    if (preferences.highFloor && parseInt(room.floor) >= 3) {
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
    const res: Reservation = { 
      ...r, 
      id: `R-${Date.now().toString().slice(-6)}`, 
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
    const seasonalRates = {
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
      guestName: groupLeader.name,
      groupId: `GRP-${Date.now()}`,
      groupSize: groupMembers.length + 1,
      isGroupLeader: true
    });
    
    reservations.push(groupReservation);
    
    // Create individual reservations for group members
    groupMembers.forEach((member, index) => {
      const memberGuest = this.createGuest(member);
      const memberReservation = this.createReservation({
        ...groupDetails,
        guestId: memberGuest.id,
        guestName: memberGuest.name,
        groupId: groupReservation.groupId,
        groupSize: groupMembers.length + 1,
        isGroupLeader: false,
        linkedReservationId: groupReservation.id
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
      timestamp: new Date().toISOString()
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
}

// Export singleton instance
export const enhancedFrontOfficeStore = new EnhancedFrontOfficeStore();
