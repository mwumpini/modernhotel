export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'checked-in' | 'checked-out' | 'no-show';

export type StayReason = 'personal' | 'business' | 'corporate' | 'conference' | 'training' | 'medical' | 'tourism' | 'other';

export type BillingRelationship = 'self' | 'company' | 'third_party' | 'travel_agent' | 'corporate_account';

export type Nationality = 
  | 'ghanaian' | 'nigerian' | 'kenyan' | 'south_african' | 'egyptian' | 'moroccan' | 'ethiopian' | 'ugandan'
  | 'tanzanian' | 'ghanaian' | 'ivorian' | 'senegalese' | 'cameroonian' | 'ghanaian' | 'ghanaian' | 'ghanaian'
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
}

export interface RatePlan {
  id: string;
  name: string; // BAR, Corporate
  roomTypeId: string;
  price: number; // nightly override
}

export interface GuestProfile {
  id: string;
  serialNumber: string; // Sequential client number (e.g., C001, C002)
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  email?: string;
  nationality: Nationality;
  idType: IdType;
  idNumber: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  
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


