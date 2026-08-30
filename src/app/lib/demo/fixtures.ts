/**
 * Demo / test fixtures for Ghana Hotel Management.
 *
 * DELETE THIS FILE (and the whole `src/app/lib/demo` folder) when going live.
 * Import from `@/app/lib/demo` — never copy these values into components.
 */

import type { BillingPerson, Reservation } from '../frontoffice/types';
import type { RoomManagementSettings } from '../settings/store';

// ─── IDs (stable references across seeds) ───────────────────────────────────

export const DEMO_ROOM_TYPE_IDS = {
  standard: 'rt-standard',
  deluxe: 'rt-deluxe',
  suite: 'rt-suite',
  family: 'rt-family',
} as const;

export const DEMO_RATE_PLAN_IDS = {
  barStandard: 'rp-bar-standard',
  barDeluxe: 'rp-bar-deluxe',
  barSuite: 'rp-bar-suite',
  barFamily: 'rp-bar-family',
  corporate: 'rp-corporate',
} as const;

// ─── Property ───────────────────────────────────────────────────────────────

export const DEMO_HOTEL = {
  name: 'Demo Hotel Accra',
  address: '123 Independence Avenue, Ridge',
  city: 'Accra',
  region: 'Greater Accra',
  country: 'Ghana',
  postalCode: '00233',
  phone: '+233 30 123 4567',
  email: 'info@demohotel.com',
  website: 'https://demohotel.com',
  currency: 'GHS',
  timezone: 'Africa/Accra',
} as const;

// ─── Room types ─────────────────────────────────────────────────────────────

export const DEMO_ROOM_TYPES: RoomManagementSettings['roomTypes'] = [
  {
    id: DEMO_ROOM_TYPE_IDS.standard,
    name: 'Standard Room',
    baseRate: 350,
    capacity: 2,
    category: 'standard',
    description: 'Comfortable room with queen bed, AC, and en-suite bathroom.',
    amenities: ['Wi-Fi', 'Air Conditioning', 'TV', 'Mini Fridge', 'En-suite Bathroom'],
    isActive: true,
    images: [],
    policies: { cancellation: '24h free cancellation', deposit: false, smoking: false, pets: false },
  },
  {
    id: DEMO_ROOM_TYPE_IDS.deluxe,
    name: 'Deluxe Room',
    baseRate: 550,
    capacity: 2,
    category: 'deluxe',
    description: 'Spacious room with king bed and city view.',
    amenities: ['Wi-Fi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'City View', 'Work Desk'],
    isActive: true,
    images: [],
    policies: { cancellation: '48h free cancellation', deposit: true, smoking: false, pets: false },
  },
  {
    id: DEMO_ROOM_TYPE_IDS.suite,
    name: 'Executive Suite',
    baseRate: 850,
    capacity: 3,
    category: 'suite',
    description: 'Luxury suite with separate living area and balcony.',
    amenities: ['Wi-Fi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Balcony', 'Living Area', 'Jacuzzi'],
    isActive: true,
    images: [],
    policies: { cancellation: '72h free cancellation', deposit: true, smoking: false, pets: false },
  },
  {
    id: DEMO_ROOM_TYPE_IDS.family,
    name: 'Family Room',
    baseRate: 650,
    capacity: 4,
    category: 'family',
    description: 'Two-bedroom layout ideal for families.',
    amenities: ['Wi-Fi', 'Air Conditioning', 'TV', 'Mini Fridge', 'Extra Beds', 'Connecting Door'],
    isActive: true,
    images: [],
    policies: { cancellation: '48h free cancellation', deposit: false, smoking: false, pets: false },
  },
];

// ─── Individual rooms ─────────────────────────────────────────────────────────

const roomFeatures = (type: keyof typeof DEMO_ROOM_TYPE_IDS): string[] => {
  const map: Record<string, string[]> = {
    standard: ['Queen Bed', 'Ground Floor Access'],
    deluxe: ['King Bed', 'City View'],
    suite: ['King Bed', 'Balcony', 'Living Room'],
    family: ['Twin Beds', 'Sofa Bed'],
  };
  return map[type] ?? [];
};

const emptyMaintenance = () => ({
  lastInspection: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  nextInspection: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  issues: [] as string[],
});

function buildDemoRoom(
  number: string,
  typeKey: keyof typeof DEMO_ROOM_TYPE_IDS,
  floor: string,
  status = 'vacant',
): RoomManagementSettings['rooms'][0] {
  return {
    id: `room-${number}`,
    number,
    typeId: DEMO_ROOM_TYPE_IDS[typeKey],
    floor,
    status,
    isActive: true,
    notes: '',
    features: roomFeatures(typeKey),
    maintenance: emptyMaintenance(),
  };
}

export const DEMO_ROOMS: RoomManagementSettings['rooms'] = [
  buildDemoRoom('101', 'standard', '1', 'occupied'),
  buildDemoRoom('102', 'standard', '1', 'dirty'),
  buildDemoRoom('103', 'standard', '1', 'clean'),
  buildDemoRoom('201', 'deluxe', '2', 'occupied'),
  buildDemoRoom('202', 'deluxe', '2', 'vacant'),
  buildDemoRoom('203', 'deluxe', '2', 'inspected'),
  buildDemoRoom('301', 'suite', '3', 'vacant'),
  buildDemoRoom('302', 'suite', '3', 'occupied'),
  buildDemoRoom('303', 'family', '3', 'vacant'),
];

// ─── Room statuses ────────────────────────────────────────────────────────────

export const DEMO_ROOM_STATUSES: RoomManagementSettings['roomStatuses'] = [
  { id: 'vacant', name: 'Vacant', color: '#22c55e', description: 'Ready to sell', isActive: true, canBook: true, requiresAction: false },
  { id: 'occupied', name: 'Occupied', color: '#3b82f6', description: 'Guest in room', isActive: true, canBook: false, requiresAction: false },
  { id: 'dirty', name: 'Dirty', color: '#f59e0b', description: 'Needs cleaning', isActive: true, canBook: false, requiresAction: true },
  { id: 'clean', name: 'Clean', color: '#10b981', description: 'Cleaned, pending inspection', isActive: true, canBook: false, requiresAction: true },
  { id: 'inspected', name: 'Inspected', color: '#06b6d4', description: 'Inspected and ready', isActive: true, canBook: true, requiresAction: false },
  { id: 'ooo', name: 'Out of Order', color: '#ef4444', description: 'Maintenance required', isActive: true, canBook: false, requiresAction: true },
];

// ─── Rate plans ───────────────────────────────────────────────────────────────

const defaultRestrictions = {
  minStay: 1,
  maxStay: 30,
  advanceBooking: 365,
  cancellationPolicy: '24 hours before arrival',
};

const defaultDayRates = (base: number) => ({
  monday: base,
  tuesday: base,
  wednesday: base,
  thursday: base,
  friday: base + 50,
  saturday: base + 80,
  sunday: base + 50,
});

export const DEMO_RATE_PLANS: RoomManagementSettings['ratePlans'] = [
  {
    id: DEMO_RATE_PLAN_IDS.barStandard,
    name: 'BAR — Standard',
    roomTypeId: DEMO_ROOM_TYPE_IDS.standard,
    basePrice: 350,
    isActive: true,
    marketSegment: 'DIRECTINN',
    rateType: 'standard',
    restrictions: defaultRestrictions,
    seasonalRates: [],
    dayOfWeekRates: defaultDayRates(350),
  },
  {
    id: DEMO_RATE_PLAN_IDS.barDeluxe,
    name: 'BAR — Deluxe',
    roomTypeId: DEMO_ROOM_TYPE_IDS.deluxe,
    basePrice: 550,
    isActive: true,
    marketSegment: 'DIRECTINN',
    rateType: 'standard',
    restrictions: defaultRestrictions,
    seasonalRates: [],
    dayOfWeekRates: defaultDayRates(550),
  },
  {
    id: DEMO_RATE_PLAN_IDS.barSuite,
    name: 'BAR — Suite',
    roomTypeId: DEMO_ROOM_TYPE_IDS.suite,
    basePrice: 850,
    isActive: true,
    marketSegment: 'DIRECTINN',
    rateType: 'standard',
    restrictions: defaultRestrictions,
    seasonalRates: [],
    dayOfWeekRates: defaultDayRates(850),
  },
  {
    id: DEMO_RATE_PLAN_IDS.barFamily,
    name: 'BAR — Family',
    roomTypeId: DEMO_ROOM_TYPE_IDS.family,
    basePrice: 650,
    isActive: true,
    marketSegment: 'DIRECTINN',
    rateType: 'standard',
    restrictions: defaultRestrictions,
    seasonalRates: [],
    dayOfWeekRates: defaultDayRates(650),
  },
  {
    id: DEMO_RATE_PLAN_IDS.corporate,
    name: 'Corporate Rate',
    roomTypeId: DEMO_ROOM_TYPE_IDS.deluxe,
    basePrice: 480,
    isActive: true,
    marketSegment: 'CORPORATE',
    rateType: 'corporate',
    restrictions: { ...defaultRestrictions, minStay: 2 },
    seasonalRates: [],
    dayOfWeekRates: defaultDayRates(480),
  },
];

// ─── Guest personas (for reservations, check-in forms, client search) ─────────

export type DemoGuestPersona = {
  id: string;
  guestName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  nationality: string;
  source: string;
};

export const DEMO_GUEST_PERSONAS: DemoGuestPersona[] = [
  { id: 'guest-001', guestName: 'John Mensah', firstName: 'John', lastName: 'Mensah', phone: '+233 24 123 4567', email: 'john.mensah@email.com', nationality: 'ghanaian', source: 'DIRECTINN' },
  { id: 'guest-002', guestName: 'Ama Osei', firstName: 'Ama', lastName: 'Osei', phone: '+233 26 987 6543', email: 'ama.osei@email.com', nationality: 'ghanaian', source: 'BOOKING.COM' },
  { id: 'guest-003', guestName: 'Kwame Asante', firstName: 'Kwame', lastName: 'Asante', phone: '+233 20 555 1234', email: 'kwame.asante@email.com', nationality: 'ghanaian', source: 'WALK IN' },
  { id: 'guest-004', guestName: 'Kofi Boateng', firstName: 'Kofi', lastName: 'Boateng', phone: '+233 20 111 2222', email: 'kofi.boateng@example.com', nationality: 'ghanaian', source: 'DIRECTINN' },
  { id: 'guest-005', guestName: 'Abena Serwaa', firstName: 'Abena', lastName: 'Serwaa', phone: '+233 24 333 4444', email: 'abena.serwaa@example.com', nationality: 'ghanaian', source: 'BOOKING.COM' },
  { id: 'guest-006', guestName: 'Yaw Owusu', firstName: 'Yaw', lastName: 'Owusu', phone: '+233 27 555 6666', email: 'yaw.owusu@example.com', nationality: 'ghanaian', source: 'WALK IN' },
  { id: 'guest-007', guestName: 'Efua Adjei', firstName: 'Efua', lastName: 'Adjei', phone: '+233 55 777 8888', email: 'efua.adjei@example.com', nationality: 'ghanaian', source: 'EXPEDIA' },
  { id: 'guest-008', guestName: 'Michael Thompson', firstName: 'Michael', lastName: 'Thompson', phone: '+1 202 555 0199', email: 'm.thompson@email.com', nationality: 'american', source: 'INTERNET' },
];

// ─── Billing / corporate accounts ─────────────────────────────────────────────

export const DEMO_BILLING_PERSONS: BillingPerson[] = [
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
    notes: 'Major corporate client. Contact John Mensah for urgent matters.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    notes: 'Send invoices to accounts@accratravel.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    notes: 'Regular client for employee training programs.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ─── Housekeeping staff ───────────────────────────────────────────────────────

export const DEMO_HOUSEKEEPING_STAFF = [
  { id: 'HK001', name: 'Akua Mensah', role: 'housekeeper' as const },
  { id: 'HK002', name: 'Kojo Appiah', role: 'housekeeper' as const },
  { id: 'SUP001', name: 'Grace Ofori', role: 'supervisor' as const },
  { id: 'INS001', name: 'Samuel Darko', role: 'inspector' as const },
  { id: 'MT001', name: 'Ibrahim Yakubu', role: 'maintenance' as const },
];

// ─── Reference lists (dropdowns, filters) ─────────────────────────────────────

export const DEMO_MARKET_CODES = ['INTERNET', 'BOOKING.COM', 'EXPEDIA', 'DIRECTINN', 'WALK IN', 'CORPORATE'] as const;

export const DEMO_PAYMENT_METHODS = ['Cash', 'Credit Card', 'Mobile Money', 'Bank Transfer', 'Corporate Account'] as const;

export const DEMO_STAY_REASONS = ['leisure', 'business', 'corporate', 'conference', 'training'] as const;

// ─── Reservations (dates computed at runtime) ─────────────────────────────────

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

type ReservationSeed = {
  id: string;
  resId: string;
  guestIndex: number;
  roomTypeKey: keyof typeof DEMO_ROOM_TYPE_IDS;
  roomId: string;
  arrivalOffset: number;
  departureOffset: number;
  status: Reservation['status'];
  adults: number;
  children: number;
  paymentMethod: string;
  remarksToGuest: string;
  stayReason: Reservation['stayReason'];
  billingPersonName?: string;
  createdDaysAgo: number;
};

const RESERVATION_SEEDS: ReservationSeed[] = [
  { id: 'R-001', resId: 'RES-001', guestIndex: 0, roomTypeKey: 'standard', roomId: '101', arrivalOffset: 0, departureOffset: 1, status: 'confirmed', adults: 2, children: 0, paymentMethod: 'Cash', remarksToGuest: 'High floor preferred', stayReason: 'leisure', createdDaysAgo: 2 },
  { id: 'R-002', resId: 'RES-002', guestIndex: 1, roomTypeKey: 'deluxe', roomId: '201', arrivalOffset: 0, departureOffset: 2, status: 'checked-in', adults: 1, children: 1, paymentMethod: 'Credit Card', remarksToGuest: 'Extra bed needed', stayReason: 'business', createdDaysAgo: 3 },
  { id: 'R-003', resId: 'RES-003', guestIndex: 2, roomTypeKey: 'suite', roomId: '301', arrivalOffset: 1, departureOffset: 3, status: 'confirmed', adults: 2, children: 2, paymentMethod: 'Bank Transfer', remarksToGuest: 'Anniversary celebration', stayReason: 'leisure', createdDaysAgo: 1 },
  { id: 'R-004', resId: 'RES-004', guestIndex: 3, roomTypeKey: 'standard', roomId: '102', arrivalOffset: -2, departureOffset: 0, status: 'checked-in', adults: 1, children: 0, paymentMethod: 'Card', remarksToGuest: 'Near elevator', stayReason: 'leisure', createdDaysAgo: 2 },
  { id: 'R-005', resId: 'RES-005', guestIndex: 4, roomTypeKey: 'deluxe', roomId: '202', arrivalOffset: -1, departureOffset: 0, status: 'checked-in', adults: 1, children: 0, paymentMethod: 'Corporate Account', remarksToGuest: 'Corporate stay', stayReason: 'business', billingPersonName: 'Ghana Telecom Ltd', createdDaysAgo: 1 },
  { id: 'R-006', resId: 'RES-006', guestIndex: 5, roomTypeKey: 'standard', roomId: '103', arrivalOffset: -2, departureOffset: 0, status: 'checked-in', adults: 2, children: 0, paymentMethod: 'Cash', remarksToGuest: 'Late checkout if possible', stayReason: 'leisure', createdDaysAgo: 2 },
];

/** Build sample reservations with dates relative to today. */
export function buildDemoReservations(): Reservation[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return RESERVATION_SEEDS.map((seed) => {
    const guest = DEMO_GUEST_PERSONAS[seed.guestIndex];
    const arrival = new Date(today);
    arrival.setDate(arrival.getDate() + seed.arrivalOffset);
    const departure = new Date(today);
    departure.setDate(departure.getDate() + seed.departureOffset);
    const createdAt = new Date(Date.now() - seed.createdDaysAgo * 24 * 60 * 60 * 1000);

    return {
      id: seed.id,
      resId: seed.resId,
      guestId: guest.id,
      guestName: guest.guestName,
      guestPhone: guest.phone,
      guestEmail: guest.email,
      roomTypeId: DEMO_ROOM_TYPE_IDS[seed.roomTypeKey],
      roomId: seed.roomId,
      arrival: isoDate(arrival),
      departure: isoDate(departure),
      status: seed.status,
      source: guest.source,
      adults: seed.adults,
      children: seed.children,
      paymentMethod: seed.paymentMethod,
      remarksToGuest: seed.remarksToGuest,
      stayReason: seed.stayReason,
      billingPersonName: seed.billingPersonName ?? guest.guestName,
      createdAt: createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
    } as Reservation;
  });
}
