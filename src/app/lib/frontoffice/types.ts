export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'checked-in' | 'checked-out' | 'no-show';

export type StayReason = 'personal' | 'business' | 'corporate' | 'conference' | 'training' | 'medical' | 'tourism' | 'leisure' | 'other';

export type BillingRelationship = 'self' | 'company' | 'third_party' | 'travel_agent' | 'corporate_account';

export type Nationality = 
  | 'ghanaian' | 'nigerian' | 'kenyan' | 'south_african' | 'egyptian' | 'moroccan' | 'ethiopian' | 'ugandan'
  | 'tanzanian' | 'rwandan' | 'ivorian' | 'senegalese' | 'cameroonian' | 'ghanaian' | 'ghanaian' | 'ghanaian'
  | 'american' | 'british' | 'canadian' | 'australian' | 'german' | 'french' | 'italian' | 'spanish'
  | 'dutch' | 'swiss' | 'swedish' | 'norwegian' | 'danish' | 'finnish' | 'russian' | 'chinese'
  | 'japanese' | 'indian' | 'pakistani' | 'bangladeshi' | 'thai' | 'vietnamese' | 'filipino' | 'indonesian'
  | 'malaysian' | 'singaporean' | 'korean' | 'brazilian' | 'argentine' | 'mexican' | 'chilean' | 'colombian'
  | 'peruvian' | 'venezuelan' | 'ecuadorian' | 'bolivian' | 'paraguayan' | 'uruguayan' | 'other';

export type IdType = 'ghana_card' | 'passport' | 'drivers_license' | 'national_id' | 'voters_id' | 'nhis_card' | 'other';

export interface EmergencyContact {
  name: string;
  relationship: 'spouse' | 'parent' | 'child' | 'sibling' | 'friend' | 'colleague' | 'other';
  phone: string;
  email?: string;
  address?: string;
}

export interface BillingPerson {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  billingRelationship: BillingRelationship;
  isCorporateAccount: boolean;
  corporateAccountNumber?: string;
  paymentMethod?: 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'corporate_billing';
  creditLimit?: number;
  paymentTerms?: string; // e.g., "Net 30", "Immediate"
  notes?: string; // Additional notes and instructions
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomType {
  id: string;
  name: string; // Standard, Deluxe, Suite
  baseRate: number; // nightly
}

export interface RoomEntity {
  id: string; // room number
  roomTypeId: string;
  floor?: string;
  accessible?: boolean;
  nearElevator?: boolean;
}

export interface RatePlan {
  id: string;
  name: string; // BAR, Corporate, Event Conference
  roomTypeId: string;
  basePrice: number; // nightly override (changed from price to match settings store)
  price?: number; // backward compatibility alias for basePrice
  isActive: boolean;
  marketSegment: string;
  
  // NEW: Event & Conference Rate Management
  rateType?: 'standard' | 'corporate' | 'event_conference' | 'package' | 'fixed_price';
  eventSpecific?: {
    isEventRate: boolean;
    eventTypes: string[]; // ['conference', 'training', 'wedding', 'corporate_meeting']
    packagePrice?: number; // Per person per day for conference facilities
    includesVenue: boolean;
    includesCatering: boolean;
    includesEquipment: boolean;
    minAttendees: number;
    maxAttendees: number;
    advanceBookingDays: number;
    cancellationPolicy: string;
    depositPercentage: number;
  };
  
  restrictions?: {
    minStay: number;
    maxStay: number;
    advanceBooking: number;
    cancellationPolicy: string;
  };
  seasonalRates?: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    multiplier: number;
    description: string;
  }>;
  dayOfWeekRates?: {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
  };
}

// Add missing interfaces
export interface Charge {
  id: string;
  description: string;
  amount: number;
  category: string;
  taxable: boolean;
  timestamp: string;
  date: string; // Add date field to match FolioCharge
}

export interface Payment {
  id: string;
  method: string;
  amount: number;
  timestamp: string;
}

// NEW: Event Resources Management
export interface EventResource {
  id: string;
  name: string;
  type: 'venue' | 'equipment' | 'service' | 'package';
  category: string;
  description: string;
  capacity?: number;
  basePrice: number;
  isActive: boolean;
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
    startTime: string;
    endTime: string;
  };
  seasonalPricing: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    multiplier: number;
    description: string;
  }>;
  includedInPackages: string[]; // Package IDs that include this resource
  setupTime: number; // Minutes required for setup
  cleanupTime: number; // Minutes required for cleanup
  notes: string;
}

// NEW: Event Packages Management
export interface EventPackage {
  id: string;
  name: string;
  description: string;
  category: 'conference' | 'training' | 'wedding' | 'corporate' | 'social';
  isActive: boolean;
  basePrice: number; // Per person per day
  minAttendees: number;
  maxAttendees: number;
  duration: number; // Days
  
  // NEW: Corporate rate integration
  corporateRateTiers?: Array<{
    clientId: string;
    organizationName: string;
    rateType: 'percentage' | 'flat_rate' | 'hybrid';
    percentageDiscount?: number; // e.g., 15% off for corporate clients
    flatRate?: number; // Fixed rate for this client
    hybridRate?: {
      percentage: number;
      flatAdjustment: number;
    };
    minAttendees?: number; // Minimum attendees for this rate
    maxAttendees?: number; // Maximum attendees for this rate
    validFrom: string;
    validTo: string;
  }>;
  
  resources: Array<{
    resourceId: string;
    quantity: number;
    priceOverride?: number; // Override base price if different
  }>;
  inclusions: string[]; // What's included in the package
  exclusions: string[]; // What's NOT included
  terms: string;
  cancellationPolicy: string;
  depositPercentage: number;
  seasonalPricing: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    multiplier: number;
    description: string;
  }>;
}

// NEW: Event Booking Interface
export interface EventBooking {
  id: string;
  eventName: string;
  eventType: 'conference' | 'training' | 'wedding' | 'corporate' | 'social';
  startDate: string;
  endDate: string;
  attendees: number;
  packageId?: string;
  ratePlanId?: string;
  
  // NEW: Corporate client integration
  corporateClientId?: string;
  corporateClientName?: string;
  rateAgreementId?: string;
  appliedRateType?: 'corporate' | 'standard' | 'negotiated';
  
  resources: Array<{
    resourceId: string;
    quantity: number;
    startTime: string;
    endTime: string;
  }>;
  rooms: Array<{
    roomId: string;
    guestId: string;
    checkIn: string;
    checkOut: string;
    roomTypeId: string;
    appliedRate: number;
    rateType: 'corporate' | 'standard' | 'negotiated';
  }>;
  
  // Enhanced cost breakdown
  costBreakdown: {
    accommodation: {
      baseCost: number;
      corporateDiscount: number;
      seasonalAdjustment: number;
      finalCost: number;
    };
    package: {
      baseCost: number;
      corporateDiscount: number;
      seasonalAdjustment: number;
      finalCost: number;
    };
    services: {
      dinner: number;
      shuttle: number;
      equipment: number;
      other: number;
    };
    taxes: number;
    totalCost: number;
  };
  
  totalCost: number;
  depositPaid: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  clientId: string;
  clientName: string;
  contactPhone: string;
  contactEmail: string;
  specialRequirements: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuestPreferences {
  preferredRoomType?: 'standard' | 'deluxe' | 'suite';
  preferredFloor?: 'low' | 'middle' | 'high';
  allergies?: string[];
  dietaryRestrictions?: string[];
  roomService?: boolean;
  housekeepingFrequency?: 'daily' | 'every_other_day' | 'weekly';
  checkInTime?: 'early' | 'standard' | 'late';
  checkOutTime?: 'early' | 'standard' | 'late';
  specialRequests?: string[];
  newsletter?: boolean;
  marketingEmails?: boolean;
  disability?: string; // Accessibility needs or disability description
}

export interface GuestProfile {
  id: string;
  serialNumber: string; // Sequential client number (e.g., C001, C002)
  firstName: string;
  lastName: string;
  middleName?: string;
  name?: string; // Computed name for convenience
  phone?: string;
  secondaryPhone?: string;
  email?: string;
  nationality: Nationality;
  idType: IdType;
  idNumber: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  employerCompany?: string;
  companyPhone?: string;
  jobTitle?: string;
  // Corporate billing contact (compat for existing data usage in UI)
  billingContactName?: string;
  billingContactEmail?: string;
  billingContactPhone?: string;
  createdAt?: string;
  updatedAt?: string;
  preferences?: GuestPreferences;
  
  // Additional properties for client management
  address?: string;
  city?: string;
  country?: string;
  notes?: string;
  
  // Emergency contact
  emergencyContact: EmergencyContact;
  
  // Marketing source (optional)
  source?: 'walkin'|'friend'|'referral'|'online'|'booking'|'social'|'corporate'|'other';
  referralGuestId?: string;
  referralName?: string;
  socialPlatform?: 'facebook'|'instagram'|'tiktok'|'twitter'|'youtube'|'linkedin'|'whatsapp';
  socialHandle?: string;
  campaignCode?: string;
  
  // Self-reservation link
  selfReservationToken?: string;
  selfReservationExpiry?: string;
}

export interface Reservation {
  id: string;
  resId?: string; // Human-friendly ResID
  guestId: string;
  guestName: string;
  roomTypeId: string;
  ratePlanId?: string;
  arrival: string; // ISO date
  departure: string; // ISO date
  status: ReservationStatus;
  source?: string; // Direct/OTA/Corporate
  roomId?: string; // assigned on check-in
  adults?: number;
  children?: number;
  isGuaranteed?: boolean;
  remarksToGuest?: string;
  marketCodes?: string[];
  internalNotes?: string;
  
  // New fields for billing and stay purpose
  stayReason: StayReason;
  stayReasonDetails?: string; // Additional details about the purpose
  billingPersonId?: string; // Reference to billing person if different from guest
  billingPersonName?: string; // Billing person's name for quick reference
  companyName?: string; // Company name if business/corporate stay
  projectCode?: string; // Project code for corporate bookings
  costCenter?: string; // Cost center for accounting purposes
  // Group booking
  groupId?: string;
  groupSize?: number;
  isGroupLeader?: boolean;
  linkedReservationId?: string;
  
  // Self-reservation tracking
  isSelfReservation?: boolean;
  selfReservationToken?: string;
  
  // Billing and payment properties
  billingPerson?: string;
  guestPhone?: string;
  guestEmail?: string;
  paymentMethod?: string;
  paymentDate?: string;
  billingNotes?: string;
  paymentStatus?: 'pending' | 'partial' | 'paid' | 'fully_paid';
  amountPaid?: number;
  
  // Invoice properties
  invoiceGenerated?: boolean;
  invoiceGeneratedDate?: string;
  invoiceStatus?: 'draft' | 'sent' | 'paid' | 'overdue';
  invoiceSentDate?: string;
  checkoutStatus?: 'pending' | 'checked-in' | 'completed';
  
  rateBreakdown?: { date: string; base: number; extraAdult?: number; extraChild?: number; total: number }[];
  deposit?: { amount: number; method: 'Cash'|'Card'|'Mobile Money'; date: string };
  createdAt: string;
  updatedAt: string;
}

export interface FolioCharge {
  id: string;
  date: string;
  description: string;
  amount: number; // positive
  tax?: number; // tax component
}

export interface FolioPayment {
  id: string;
  date: string;
  method: 'Cash' | 'Card' | 'Mobile Money';
  amount: number;
  ref?: string;
}

export interface Folio {
  id: string;
  reservationId: string;
  charges: FolioCharge[];
  payments: FolioPayment[];
  currency: string;
  status?: 'active' | 'closed' | 'void';
  type?: 'main' | 'split';
  description?: string;
  responsibleParty?: string;
}

// Utility functions for GuestProfile
export const getFullName = (guest: GuestProfile): string => {
  return [guest.firstName, guest.middleName, guest.lastName].filter(Boolean).join(' ');
};

export const getDisplayName = (guest: GuestProfile): string => {
  if (guest.middleName) {
    return `${guest.firstName} ${guest.middleName} ${guest.lastName}`;
  }
  return `${guest.firstName} ${guest.lastName}`;
};

// NEW: Corporate Rate Management System
export interface CorporateClient {
  id: string;
  organizationName: string;
  industry: string;
  contactPerson: {
    name: string;
    position: string;
    phone: string;
    email: string;
    whatsapp?: boolean;
  };
  billingInfo: {
    address: string;
    city: string;
    country: string;
    taxId?: string;
    vatNumber?: string;
    paymentTerms: string; // "Net 30", "Immediate", etc.
    creditLimit?: number;
    preferredPaymentMethod: 'corporate_billing' | 'bank_transfer' | 'mobile_money' | 'credit_card';
  };
  contractDetails: {
    startDate: string;
    endDate: string;
    status: 'active' | 'pending' | 'expired' | 'suspended';
    specialTerms?: string;
    notes?: string;
  };
  rateAgreements: CorporateRateAgreement[];
  createdAt: string;
  updatedAt: string;
}

export interface CorporateRateAgreement {
  id: string;
  clientId: string; // Link to CorporateClient
  name: string; // e.g., "SNV Ghana - Accommodation Only", "SNV Ghana - Workshop Rate"
  description: string;
  isActive: boolean;
  priority: number; // Higher priority agreements override lower ones
  
  // Rate Strategy
  rateStrategy: 'percentage' | 'flat_rate' | 'hybrid' | 'negotiated';
  
  // Percentage-based rates (e.g., 80% of standard rate)
  percentageRates?: {
    standardRoom: number; // 80 = 80% of standard rate
    deluxeRoom: number;   // 75 = 75% of deluxe rate
    suiteRoom: number;    // 70 = 70% of suite rate
    presidentialRoom: number; // 65 = 65% of presidential rate
  };
  
  // Flat rates (e.g., fixed 500 GHS for all room types)
  flatRates?: {
    standardRoom: number;
    deluxeRoom: number;
    suiteRoom: number;
    presidentialRoom: number;
  };
  
  // Hybrid rates (combination of percentage and flat)
  hybridRates?: {
    standardRoom: { percentage: number; flatAdjustment: number };
    deluxeRoom: { percentage: number; flatAdjustment: number };
    suiteRoom: { percentage: number; flatAdjustment: number };
    presidentialRoom: { percentage: number; flatAdjustment: number };
  };
  
  // Negotiated rates (special case-by-case pricing)
  negotiatedRates?: {
    [roomTypeId: string]: number;
  };
  
  // Event-specific pricing
  eventRates?: {
    conference: {
      accommodationDiscount: number; // Additional discount for conference attendees
      packagePricing: 'included' | 'discounted' | 'separate';
      packageDiscount?: number; // Percentage discount on conference packages
    };
    training: {
      accommodationDiscount: number;
      packagePricing: 'included' | 'discounted' | 'separate';
      packageDiscount?: number;
    };
    workshop: {
      accommodationDiscount: number;
      packagePricing: 'included' | 'discounted' | 'separate';
      packageDiscount?: number;
    };
  };
  
  // Service add-ons
  serviceRates?: {
    dinner: 'included' | 'discounted' | 'standard';
    dinnerDiscount?: number; // Percentage discount if discounted
    shuttle: 'included' | 'discounted' | 'standard';
    shuttleDiscount?: number;
    equipment: 'included' | 'discounted' | 'standard';
    equipmentDiscount?: number;
  };
  
  // Restrictions and conditions
  restrictions: {
    minStay: number;
    maxStay: number;
    advanceBooking: number;
    cancellationPolicy: string;
    blackoutDates?: string[]; // Dates when rates don't apply
    dayOfWeekRestrictions?: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
    };
  };
  
  // Seasonal adjustments
  seasonalAdjustments?: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    multiplier: number; // 1.2 = 20% increase, 0.8 = 20% decrease
    description: string;
  }>;
  
  // Volume discounts
  volumeDiscounts?: Array<{
    minNights: number;
    discountPercentage: number;
    description: string;
  }>;
  
  // Group size discounts
  groupDiscounts?: Array<{
    minAttendees: number;
    discountPercentage: number;
    description: string;
  }>;
  
  createdAt: string;
  updatedAt: string;
}


