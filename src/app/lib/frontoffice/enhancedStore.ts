'use client';

import { GuestProfile, RatePlan, Folio, Charge, EventPackage, EventBooking } from './types';
import { trackEvent } from '../analytics/trackEvent';
import { housekeepingStore } from '../housekeeping/store';
import { useSettingsStore } from '../settings/store';
import { computeSalesTax } from '../tax/engine';

// HotelBiz-style enhanced interfaces
interface RoomPreferences {
  quietRoom: boolean;
  accessibleRoom: boolean;
  highFloor: boolean;
  nearElevator: boolean;
  connectingRooms: boolean;
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
  guests: GuestProfile[] = [];
  marketCodes: string[] = ['INTERNET', 'BOOKING.COM', 'EXPEDIA', 'DIRECTINN', 'WALK IN', 'CORPORATE', 'TRAVEL AGENT'];
  folios: Folio[] = [];
  guestPreferences: Map<string, GuestPreferences> = new Map();
  private listeners: Array<() => void> = [];

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
    const settings = useSettingsStore.getState();
    const ratePlan = settings.roomManagement.ratePlans.find(rp => rp.id === ratePlanId);
    if (!ratePlan || ratePlan.rateType !== 'event_conference') {
      throw new Error('Invalid event conference rate plan');
    }

    const baseRoomRate = ratePlan.basePrice;

    // Apply seasonal rates — `seasonalAdjustment` is a direct multiplier (e.g. 1.2 = 120% of
    // base, matching the "Multiplier (e.g., 1.2)" label on the Seasonal Rates editor in
    // Settings → Rooms & Pricing), not an additive percentage. It previously got wrapped in
    // `(1 + seasonalAdjustment)` here, turning a configured "1.2x" season into 2.2x.
    const seasonalAdjustment = this.calculateRatePlanSeasonalAdjustment(ratePlan, startDate);
    const adjustedRoomRate = baseRoomRate * seasonalAdjustment;
    
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
      const eventPackage = settings.roomManagement.eventPackages.find(ep => ep.id === packageId);
      if (eventPackage) {
        packageCost = eventPackage.basePrice * attendees * duration;
        
        // Apply seasonal pricing to package — same direct-multiplier convention as room rates.
        const packageSeasonalAdjustment = this.calculatePackageSeasonalAdjustment(eventPackage, startDate);
        packageCost *= packageSeasonalAdjustment;
      }
    }
    
    // Calculate taxes using the canonical stacked tax engine (NHIL + GETFund + Tourism + VAT)
    const taxes = computeSalesTax(totalRoomCost + packageCost).totalTax;
    
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
   * Calculate seasonal adjustment for rate plans (existing logic)
   */
  private calculateRatePlanSeasonalAdjustment(ratePlan: RatePlan, date: string): number {
    const targetDate = new Date(date);
    const seasonalRate = ratePlan.seasonalRates?.find(sr => {
      const start = new Date(sr.startDate);
      const end = new Date(sr.endDate);
      return targetDate >= start && targetDate <= end;
    });
    
    return seasonalRate ? seasonalRate.multiplier : 1;
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
    
    return seasonalPricing ? seasonalPricing.multiplier : 1;
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
