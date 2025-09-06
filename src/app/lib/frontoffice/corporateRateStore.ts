'use client';

import { CorporateClient, CorporateRateAgreement, EventPackage, EventBooking, RoomType } from './types';
import { trackEvent } from '../analytics/trackEvent';

export interface RateCalculationResult {
  accommodation: {
    baseCost: number;
    corporateDiscount: number;
    seasonalAdjustment: number;
    finalCost: number;
    rateType: 'corporate' | 'standard' | 'negotiated';
    appliedAgreement?: string;
  };
  package: {
    baseCost: number;
    corporateDiscount: number;
    seasonalAdjustment: number;
    finalCost: number;
    rateType: 'corporate' | 'standard' | 'negotiated';
  };
  services: {
    dinner: number;
    shuttle: number;
    equipment: number;
    other: number;
  };
  taxes: number;
  totalCost: number;
  breakdown: {
    roomRates: Array<{
      roomTypeId: string;
      roomTypeName: string;
      baseRate: number;
      appliedRate: number;
      discount: number;
      nights: number;
      total: number;
    }>;
    packageDetails: Array<{
      packageId: string;
      packageName: string;
      basePrice: number;
      appliedPrice: number;
      attendees: number;
      days: number;
      total: number;
    }>;
    serviceDetails: Array<{
      service: string;
      basePrice: number;
      appliedPrice: number;
      quantity: number;
      total: number;
    }>;
  };
}

export class CorporateRateStore {
  corporateClients: CorporateClient[] = [];
  rateAgreements: CorporateRateAgreement[] = [];
  
  private listeners: Array<() => void> = [];

  constructor() {
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Demo corporate clients with realistic Ghana examples
    const snvGhana: CorporateClient = {
      id: 'corp_snv_ghana',
      organizationName: 'SNV Ghana',
      industry: 'International Development',
      contactPerson: {
        name: 'Kwame Asante',
        position: 'Country Director',
        phone: '+233 24 123 4567',
        email: 'k.asante@snv.org',
        whatsapp: true
      },
      billingInfo: {
        address: 'Plot 4, Ring Road Central, Accra',
        city: 'Accra',
        country: 'Ghana',
        taxId: 'GH-123456789-0001',
        vatNumber: 'GH123456789',
        paymentTerms: 'Net 30',
        creditLimit: 50000,
        preferredPaymentMethod: 'corporate_billing'
      },
      contractDetails: {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        status: 'active',
        specialTerms: 'Priority booking for development projects',
        notes: 'Major partner for rural development initiatives'
      },
      rateAgreements: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const ghanaHealthService: CorporateClient = {
      id: 'corp_ghs',
      organizationName: 'Ghana Health Service',
      industry: 'Healthcare',
      contactPerson: {
        name: 'Dr. Ama Osei',
        position: 'Deputy Director',
        phone: '+233 26 987 6543',
        email: 'a.osei@ghs.gov.gh',
        whatsapp: false
      },
      billingInfo: {
        address: 'Ministry of Health, Accra',
        city: 'Accra',
        country: 'Ghana',
        taxId: 'GH-987654321-0001',
        vatNumber: 'GH987654321',
        paymentTerms: 'Net 45',
        creditLimit: 100000,
        preferredPaymentMethod: 'bank_transfer'
      },
      contractDetails: {
        startDate: '2024-02-01',
        endDate: '2024-12-31',
        status: 'active',
        specialTerms: 'Government rates apply',
        notes: 'Regular training and conference host'
      },
      rateAgreements: [],
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-02-01T00:00:00Z'
    };

    this.corporateClients.push(snvGhana, ghanaHealthService);

    // Demo rate agreements
    const snvAccommodationOnly: CorporateRateAgreement = {
      id: 'ra_snv_accommodation',
      clientId: 'corp_snv_ghana',
      name: 'SNV Ghana - Accommodation Only',
      description: 'Standard accommodation rates for SNV staff and consultants',
      isActive: true,
      priority: 1,
      rateStrategy: 'percentage',
      percentageRates: {
        standardRoom: 80, // 80% of standard rate
        deluxeRoom: 75,   // 75% of deluxe rate
        suiteRoom: 70,    // 70% of suite rate
        presidentialRoom: 65 // 65% of presidential rate
      },
      eventRates: {
        conference: {
          accommodationDiscount: 10, // Additional 10% off for conference attendees
          packagePricing: 'separate',
          packageDiscount: 15 // 15% off conference packages
        },
        training: {
          accommodationDiscount: 5,
          packagePricing: 'separate',
          packageDiscount: 10
        },
        workshop: {
          accommodationDiscount: 8,
          packagePricing: 'separate',
          packageDiscount: 12
        }
      },
      serviceRates: {
        dinner: 'discounted',
        dinnerDiscount: 20,
        shuttle: 'standard',
        equipment: 'standard'
      },
      restrictions: {
        minStay: 1,
        maxStay: 30,
        advanceBooking: 7,
        cancellationPolicy: '24 hours notice required',
        dayOfWeekRestrictions: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false
        }
      },
      seasonalAdjustments: [
        {
          id: 'sa_snv_peak',
          name: 'Peak Season',
          startDate: '2024-06-01',
          endDate: '2024-09-30',
          multiplier: 1.1, // 10% increase during peak season
          description: 'Peak tourism season adjustment'
        }
      ],
      volumeDiscounts: [
        {
          minNights: 7,
          discountPercentage: 5,
          description: 'Weekly stay discount'
        },
        {
          minNights: 30,
          discountPercentage: 15,
          description: 'Monthly stay discount'
        }
      ],
      groupDiscounts: [
        {
          minAttendees: 10,
          discountPercentage: 5,
          description: 'Group booking discount'
        },
        {
          minAttendees: 20,
          discountPercentage: 10,
          description: 'Large group discount'
        }
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const snvWorkshopRate: CorporateRateAgreement = {
      id: 'ra_snv_workshop',
      clientId: 'corp_snv_ghana',
      name: 'SNV Ghana - Workshop Rate',
      description: 'Special rates for workshop participants and facilitators',
      isActive: true,
      priority: 2, // Higher priority than accommodation only
      rateStrategy: 'hybrid',
      hybridRates: {
        standardRoom: { percentage: 70, flatAdjustment: -50 }, // 70% of standard + 50 GHS off
        deluxeRoom: { percentage: 65, flatAdjustment: -75 },
        suiteRoom: { percentage: 60, flatAdjustment: -100 },
        presidentialRoom: { percentage: 55, flatAdjustment: -150 }
      },
      eventRates: {
        workshop: {
          accommodationDiscount: 15,
          packagePricing: 'included',
          packageDiscount: 25
        },
        training: {
          accommodationDiscount: 12,
          packagePricing: 'discounted',
          packageDiscount: 20
        },
        conference: {
          accommodationDiscount: 8,
          packagePricing: 'separate',
          packageDiscount: 15
        }
      },
      serviceRates: {
        dinner: 'included',
        shuttle: 'included',
        equipment: 'included'
      },
      restrictions: {
        minStay: 2,
        maxStay: 14,
        advanceBooking: 14,
        cancellationPolicy: '7 days notice required for workshop rates',
        dayOfWeekRestrictions: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false
        }
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const ghsConferenceRate: CorporateRateAgreement = {
      id: 'ra_ghs_conference',
      clientId: 'corp_ghs',
      name: 'GHS - Conference Rate',
      description: 'Special rates for Ghana Health Service conferences and training',
      isActive: true,
      priority: 1,
      rateStrategy: 'flat_rate',
      flatRates: {
        standardRoom: 550,
        deluxeRoom: 750,
        suiteRoom: 1100,
        presidentialRoom: 2200
      },
      eventRates: {
        conference: {
          accommodationDiscount: 20,
          packagePricing: 'discounted',
          packageDiscount: 30
        },
        training: {
          accommodationDiscount: 15,
          packagePricing: 'discounted',
          packageDiscount: 25
        },
        workshop: {
          accommodationDiscount: 18,
          packagePricing: 'discounted',
          packageDiscount: 28
        }
      },
      serviceRates: {
        dinner: 'discounted',
        dinnerDiscount: 25,
        shuttle: 'discounted',
        shuttleDiscount: 30,
        equipment: 'included'
      },
      restrictions: {
        minStay: 1,
        maxStay: 21,
        advanceBooking: 21,
        cancellationPolicy: '14 days notice required',
        dayOfWeekRestrictions: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false
        }
      },
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-02-01T00:00:00Z'
    };

    this.rateAgreements.push(snvAccommodationOnly, snvWorkshopRate, ghsConferenceRate);

    // Link agreements to clients
    snvGhana.rateAgreements = [snvAccommodationOnly, snvWorkshopRate];
    ghanaHealthService.rateAgreements = [ghsConferenceRate];
  }

  subscribe(l: () => void) { 
    this.listeners.push(l); 
    return () => { this.listeners = this.listeners.filter(x => x !== l); }; 
  }
  
  private notify() { this.listeners.forEach(l => l()); }

  // Corporate Client Management
  createCorporateClient(client: Omit<CorporateClient, 'id' | 'createdAt' | 'updatedAt'>): CorporateClient {
    const newClient: CorporateClient = {
      ...client,
      id: `corp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.corporateClients.push(newClient);
    this.notify();
    
    trackEvent('CorporateRate.ClientCreated', {
      id: newClient.id,
      organization: newClient.organizationName,
      industry: newClient.industry
    });
    
    return newClient;
  }

  updateCorporateClient(clientId: string, updates: Partial<CorporateClient>): CorporateClient | null {
    const index = this.corporateClients.findIndex(c => c.id === clientId);
    if (index === -1) return null;

    this.corporateClients[index] = {
      ...this.corporateClients[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.notify();
    
    trackEvent('CorporateRate.ClientUpdated', { id: clientId });
    
    return this.corporateClients[index];
  }

  // Alias for backward compatibility
  addCorporateClient(client: CorporateClient): CorporateClient {
    this.corporateClients.push(client);
    this.notify();
    return client;
  }

  deleteCorporateClient(clientId: string): void {
    const index = this.corporateClients.findIndex(c => c.id === clientId);
    if (index !== -1) {
      const client = this.corporateClients[index];
      this.corporateClients.splice(index, 1);
      // Also remove associated rate agreements
      this.rateAgreements = this.rateAgreements.filter(a => a.clientId !== clientId);
      this.notify();
      trackEvent('CorporateRate.ClientDeleted', { clientId, organizationName: client.organizationName });
    }
  }

  // Rate Agreement Management
  createRateAgreement(agreement: Omit<CorporateRateAgreement, 'id' | 'createdAt' | 'updatedAt'>): CorporateRateAgreement {
    const newAgreement: CorporateRateAgreement = {
      ...agreement,
      id: `ra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.rateAgreements.push(newAgreement);
    this.notify();
    
    trackEvent('CorporateRate.AgreementCreated', {
      id: newAgreement.id,
      name: newAgreement.name,
      strategy: newAgreement.rateStrategy
    });
    
    return newAgreement;
  }

  updateRateAgreement(agreementId: string, updates: Partial<CorporateRateAgreement>): CorporateRateAgreement | null {
    const index = this.rateAgreements.findIndex(a => a.id === agreementId);
    if (index === -1) return null;

    this.rateAgreements[index] = {
      ...this.rateAgreements[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.notify();
    
    trackEvent('CorporateRate.AgreementUpdated', { id: agreementId });
    
    return this.rateAgreements[index];
  }

  // Alias for backward compatibility
  addRateAgreement(agreement: CorporateRateAgreement): CorporateRateAgreement {
    this.rateAgreements.push(agreement);
    this.notify();
    return agreement;
  }

  deleteRateAgreement(agreementId: string): void {
    const index = this.rateAgreements.findIndex(a => a.id === agreementId);
    if (index !== -1) {
      const agreement = this.rateAgreements[index];
      this.rateAgreements.splice(index, 1);
      this.notify();
      trackEvent('CorporateRate.AgreementDeleted', { agreementId, clientId: agreement.clientId });
    }
  }

  // Core Rate Calculation Engine
  calculateCorporateRate(
    clientId: string,
    roomTypes: RoomType[],
    eventType: 'conference' | 'training' | 'workshop' | 'accommodation_only',
    attendees: number,
    startDate: string,
    endDate: string,
    packageId?: string,
    eventPackage?: EventPackage
  ): RateCalculationResult {
    const client = this.corporateClients.find(c => c.id === clientId);
    if (!client) {
      throw new Error(`Corporate client ${clientId} not found`);
    }

    // Get applicable rate agreements for this client
    const applicableAgreements = this.getApplicableAgreements(client, eventType, startDate, endDate);
    if (applicableAgreements.length === 0) {
      throw new Error(`No applicable rate agreements found for ${client.organizationName}`);
    }

    // Sort by priority (highest first)
    applicableAgreements.sort((a, b) => b.priority - a.priority);
    const primaryAgreement = applicableAgreements[0];

    // Calculate accommodation costs
    const accommodationCosts = this.calculateAccommodationCosts(
      roomTypes,
      primaryAgreement,
      startDate,
      endDate,
      attendees
    );

    // Calculate package costs
    const packageCosts = this.calculatePackageCosts(
      eventPackage,
      primaryAgreement,
      eventType,
      attendees,
      startDate,
      endDate
    );

    // Calculate service costs
    const serviceCosts = this.calculateServiceCosts(primaryAgreement, attendees);

    // Calculate taxes
    const taxes = this.calculateTaxes(accommodationCosts.finalCost + packageCosts.finalCost + serviceCosts.total);

    const totalCost = accommodationCosts.finalCost + packageCosts.finalCost + serviceCosts.total + taxes;

    return {
      accommodation: accommodationCosts,
      package: packageCosts,
      services: serviceCosts,
      taxes,
      totalCost,
      breakdown: {
        roomRates: accommodationCosts.breakdown,
        packageDetails: packageCosts.breakdown,
        serviceDetails: serviceCosts.breakdown
      }
    };
  }

  private getApplicableAgreements(
    client: CorporateClient,
    eventType: string,
    startDate: string,
    endDate: string
  ): CorporateRateAgreement[] {
    console.log('getApplicableAgreements called with:', {
      clientId: client.id,
      clientName: client.organizationName,
      clientRateAgreements: client.rateAgreements,
      eventType,
      startDate,
      endDate,
      allRateAgreements: this.rateAgreements.map(ra => ({ id: ra.id, name: ra.name }))
    });
    
    return this.rateAgreements.filter(agreement => {
      // Check if agreement belongs to this client
      if (!client.rateAgreements.includes(agreement.id)) {
        console.log(`Agreement ${agreement.id} not found in client ${client.id} rate agreements:`, client.rateAgreements);
        return false;
      }
      
      // Check if agreement is active
      if (!agreement.isActive) {
        console.log(`Agreement ${agreement.id} is not active`);
        return false;
      }
      
      // Check if agreement covers this event type
      if (agreement.eventRates && !agreement.eventRates[eventType as keyof typeof agreement.eventRates]) {
        console.log(`Agreement ${agreement.id} does not cover event type ${eventType}`);
        return false;
      }
      
      // Check date restrictions
      const start = new Date(startDate);
      const end = new Date(endDate);
      const agreementStart = new Date(agreement.restrictions?.advanceBooking ? 
        new Date(Date.now() + agreement.restrictions.advanceBooking * 24 * 60 * 60 * 1000) : 
        new Date(0));
      const agreementEnd = new Date(agreement.contractDetails?.endDate || '2099-12-31');
      
      const dateCheck = start >= agreementStart && end <= agreementEnd;
      if (!dateCheck) {
        console.log(`Agreement ${agreement.id} date check failed:`, { start, end, agreementStart, agreementEnd });
      }
      
      return dateCheck;
    });
  }

  private calculateAccommodationCosts(
    roomTypes: RoomType[],
    agreement: CorporateRateAgreement,
    startDate: string,
    endDate: string,
    attendees: number
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    let baseCost = 0;
    let finalCost = 0;
    let corporateDiscount = 0;
    let seasonalAdjustment = 0;
    const breakdown: RateCalculationResult['breakdown']['roomRates'] = [];

    roomTypes.forEach(roomType => {
      const baseRate = roomType.baseRate;
      let appliedRate = baseRate;
      
      // Apply corporate rate strategy
      switch (agreement.rateStrategy) {
        case 'percentage':
          if (agreement.percentageRates) {
            const percentageKey = this.getRoomTypePercentageKey(roomType.name);
            if (percentageKey && agreement.percentageRates[percentageKey]) {
              appliedRate = baseRate * (agreement.percentageRates[percentageKey] / 100);
            }
          }
          break;
          
        case 'flat_rate':
          if (agreement.flatRates) {
            const flatKey = this.getRoomTypeFlatKey(roomType.name);
            if (flatKey && agreement.flatRates[flatKey]) {
              appliedRate = agreement.flatRates[flatKey];
            }
          }
          break;
          
        case 'hybrid':
          if (agreement.hybridRates) {
            const hybridKey = this.getRoomTypeHybridKey(roomType.name);
            if (hybridKey && agreement.hybridRates[hybridKey]) {
              const hybrid = agreement.hybridRates[hybridKey];
              appliedRate = (baseRate * (hybrid.percentage / 100)) + hybrid.flatAdjustment;
            }
          }
          break;
          
        case 'negotiated':
          if (agreement.negotiatedRates && agreement.negotiatedRates[roomType.id]) {
            appliedRate = agreement.negotiatedRates[roomType.id];
          }
          break;
      }
      
      // Apply seasonal adjustments
      let seasonalMultiplier = 1;
      if (agreement.seasonalAdjustments) {
        const seasonal = agreement.seasonalAdjustments.find(sa => {
          const saStart = new Date(sa.startDate);
          const saEnd = new Date(sa.endDate);
          return start >= saStart && start <= saEnd;
        });
        if (seasonal) {
          seasonalMultiplier = seasonal.multiplier;
        }
      }
      
      const seasonalAdjustedRate = appliedRate * seasonalMultiplier;
      const roomTotal = seasonalAdjustedRate * nights;
      
      baseCost += baseRate * nights;
      finalCost += roomTotal;
      seasonalAdjustment += (seasonalMultiplier - 1) * appliedRate * nights;
      
      breakdown.push({
        roomTypeId: roomType.id,
        roomTypeName: roomType.name,
        baseRate,
        appliedRate: seasonalAdjustedRate,
        discount: baseRate - seasonalAdjustedRate,
        nights,
        total: roomTotal
      });
    });
    
    // Apply volume discounts
    if (agreement.volumeDiscounts) {
      const volumeDiscount = agreement.volumeDiscounts.find(vd => nights >= vd.minNights);
      if (volumeDiscount) {
        const discountAmount = finalCost * (volumeDiscount.discountPercentage / 100);
        finalCost -= discountAmount;
        corporateDiscount += discountAmount;
      }
    }
    
    // Apply group discounts
    if (agreement.groupDiscounts) {
      const groupDiscount = agreement.groupDiscounts.find(gd => attendees >= gd.minAttendees);
      if (groupDiscount) {
        const discountAmount = finalCost * (groupDiscount.discountPercentage / 100);
        finalCost -= discountAmount;
        corporateDiscount += discountAmount;
      }
    }
    
    return {
      baseCost,
      corporateDiscount,
      seasonalAdjustment,
      finalCost,
      rateType: 'corporate' as const,
      appliedAgreement: agreement.id,
      breakdown
    };
  }

  private calculatePackageCosts(
    eventPackage: EventPackage | undefined,
    agreement: CorporateRateAgreement,
    eventType: string,
    attendees: number,
    startDate: string,
    endDate: string
  ) {
    if (!eventPackage) {
      return {
        baseCost: 0,
        corporateDiscount: 0,
        seasonalAdjustment: 0,
        finalCost: 0,
        rateType: 'standard' as const,
        breakdown: []
      };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    let baseCost = eventPackage.basePrice * attendees * days;
    let finalCost = baseCost;
    let corporateDiscount = 0;
    let seasonalAdjustment = 0;
    
    // Check if package is included in corporate rate
    const eventRates = agreement.eventRates?.[eventType as keyof typeof agreement.eventRates];
    if (eventRates) {
      switch (eventRates.packagePricing) {
        case 'included':
          finalCost = 0;
          corporateDiscount = baseCost;
          break;
          
        case 'discounted':
          if (eventRates.packageDiscount) {
            const discount = baseCost * (eventRates.packageDiscount / 100);
            finalCost -= discount;
            corporateDiscount = discount;
          }
          break;
          
        case 'separate':
          // No corporate discount on package
          break;
      }
    }
    
    // Apply seasonal pricing
    if (eventPackage.seasonalPricing) {
      const seasonal = eventPackage.seasonalPricing.find(sp => {
        const spStart = new Date(sp.startDate);
        const spEnd = new Date(sp.endDate);
        return start >= spStart && start <= spEnd;
      });
      if (seasonal) {
        const adjustment = baseCost * (seasonal.multiplier - 1);
        finalCost += adjustment;
        seasonalAdjustment = adjustment;
      }
    }
    
    const breakdown: RateCalculationResult['breakdown']['packageDetails'] = [{
      packageId: eventPackage.id,
      packageName: eventPackage.name,
      basePrice: eventPackage.basePrice,
      appliedPrice: finalCost / (attendees * days),
      attendees,
      days,
      total: finalCost
    }];
    
    return {
      baseCost,
      corporateDiscount,
      seasonalAdjustment,
      finalCost,
      rateType: 'corporate' as const,
      breakdown
    };
  }

  private calculateServiceCosts(agreement: CorporateRateAgreement, attendees: number) {
    const serviceRates = agreement.serviceRates;
    if (!serviceRates) {
      return {
        dinner: 0,
        shuttle: 0,
        equipment: 0,
        other: 0,
        total: 0,
        breakdown: []
      };
    }

    let dinner = 0;
    let shuttle = 0;
    let equipment = 0;
    let other = 0;
    
    // Calculate dinner costs
    if (serviceRates.dinner === 'included') {
      dinner = 0; // Included in rate
    } else if (serviceRates.dinner === 'discounted' && serviceRates.dinnerDiscount) {
      dinner = 50 * attendees * (1 - serviceRates.dinnerDiscount / 100); // Assume 50 GHS base dinner price
    } else {
      dinner = 50 * attendees; // Standard dinner price
    }
    
    // Calculate shuttle costs
    if (serviceRates.shuttle === 'included') {
      shuttle = 0; // Included in rate
    } else if (serviceRates.shuttle === 'discounted' && serviceRates.shuttleDiscount) {
      shuttle = 30 * attendees * (1 - serviceRates.shuttleDiscount / 100); // Assume 30 GHS base shuttle price
    } else {
      shuttle = 30 * attendees; // Standard shuttle price
    }
    
    // Calculate equipment costs
    if (serviceRates.equipment === 'included') {
      equipment = 0; // Included in rate
    } else if (serviceRates.equipment === 'discounted' && serviceRates.equipmentDiscount) {
      equipment = 25 * attendees * (1 - serviceRates.equipmentDiscount / 100); // Assume 25 GHS base equipment price
    } else {
      equipment = 25 * attendees; // Standard equipment price
    }
    
    const total = dinner + shuttle + equipment + other;
    
    const breakdown: RateCalculationResult['breakdown']['serviceDetails'] = [
      { service: 'Dinner', basePrice: 50, appliedPrice: dinner / attendees, quantity: attendees, total: dinner },
      { service: 'Shuttle', basePrice: 30, appliedPrice: shuttle / attendees, quantity: attendees, total: shuttle },
      { service: 'Equipment', basePrice: 25, appliedPrice: equipment / attendees, quantity: attendees, total: equipment }
    ];
    
    return {
      dinner,
      shuttle,
      equipment,
      other,
      total,
      breakdown
    };
  }

  private calculateTaxes(subtotal: number): number {
    // Ghana tax rates: VAT 12.5%, NHIL 2.5%, GETFund 2.5%
    const vat = subtotal * 0.125;
    const nhil = subtotal * 0.025;
    const getfund = subtotal * 0.025;
    return vat + nhil + getfund;
  }

  private getRoomTypePercentageKey(roomTypeName: string): keyof CorporateRateAgreement['percentageRates'] | null {
    const name = roomTypeName.toLowerCase();
    if (name.includes('standard')) return 'standardRoom';
    if (name.includes('deluxe')) return 'deluxeRoom';
    if (name.includes('suite')) return 'suiteRoom';
    if (name.includes('presidential')) return 'presidentialRoom';
    return null;
  }

  private getRoomTypeFlatKey(roomTypeName: string): keyof CorporateRateAgreement['flatRates'] | null {
    return this.getRoomTypePercentageKey(roomTypeName);
  }

  private getRoomTypeHybridKey(roomTypeName: string): keyof CorporateRateAgreement['hybridRates'] | null {
    return this.getRoomTypePercentageKey(roomTypeName);
  }

  // Utility methods
  getCorporateClient(clientId: string): CorporateClient | undefined {
    return this.corporateClients.find(c => c.id === clientId);
  }

  getRateAgreement(agreementId: string): CorporateRateAgreement | undefined {
    return this.rateAgreements.find(a => a.id === agreementId);
  }

  getClientRateAgreements(clientId: string): CorporateRateAgreement[] {
    const client = this.corporateClients.find(c => c.id === clientId);
    if (!client) return [];
    
    return this.rateAgreements.filter(a => client.rateAgreements.includes(a.id));
  }

  // Search and filtering
  searchCorporateClients(query: string): CorporateClient[] {
    const searchTerm = query.toLowerCase();
    return this.corporateClients.filter(client =>
      client.organizationName.toLowerCase().includes(searchTerm) ||
      client.contactPerson.name.toLowerCase().includes(searchTerm) ||
      client.industry.toLowerCase().includes(searchTerm)
    );
  }

  getActiveRateAgreements(): CorporateRateAgreement[] {
    return this.rateAgreements.filter(a => a.isActive);
  }
}

// Export singleton instance
export const corporateRateStore = new CorporateRateStore();
