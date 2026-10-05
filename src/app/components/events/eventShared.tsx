'use client';

import { Autocomplete, AutocompleteItem, Tooltip } from '@heroui/react';
import type { PrintType } from '../../lib/print/templates';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import { useEffect, useRef, useState } from 'react';

export type ManagementMainTabKey =
  | 'events'
  | 'active'
  | 'completed'
  | 'invoices'
  | 'receipts'
  | 'quotes'
  | 'folios';

export const UNASSIGNED_STAFF = 'Unassigned';

export const BEO_LAYOUTS = [
  'Theatre Style',
  'Banquet Style',
  'Classroom Style',
  'U-Shape',
  'Boardroom',
  'Hollow Square',
  'Cocktail',
  'Cabaret',
  'Reception',
];
export const BEO_ACCESS = [
  'Main entrance',
  'Side entrance',
  'Service entrance',
  'Elevator',
  'Ground floor only',
  'Restricted access',
  'Loading bay',
  'Guest drop-off',
];
export const BEO_PARKING = ['Available for guests', 'Reserved parking', 'Valet', 'Street parking', 'None'];
export const BEO_LIGHTING = ['Standard', 'Dimmed', 'Stage', 'Natural', 'Spotlight'];
export const BEO_INTERNET = ['High-speed WiFi', 'Shared WiFi', 'Dedicated line', 'Wired', 'None'];
export const BEO_SERVICE_STYLES = ['Buffet', 'Plated Service', 'Family style', 'Stations', 'Cocktail'];
export const BEO_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Full day', 'Tea only'];
export const BEO_DEPT_FALLBACK = [
  'Events & Conferences',
  'Operations',
  'Catering',
  'Housekeeping',
  'Security',
  'Front Office',
  'Kitchen',
  'Technical',
  'Finance',
];

export function withCurrentOption(options: string[], current?: string) {
  const value = String(current || '').trim();
  if (!value) return options;
  if (options.some((option) => option.toLowerCase() === value.toLowerCase())) return options;
  return [value, ...options];
}

export function BeoPick({
  label,
  value,
  options,
  onChange,
  className,
  placeholder,
}: {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const items = withCurrentOption(options, value).map((item) => ({ key: item, label: item }));
  const selected = items.some((item) => item.key === value) ? value : null;
  return (
    <Autocomplete
      className={className}
      size="sm"
      label={label}
      placeholder={placeholder}
      selectedKey={selected}
      inputValue={value || ''}
      allowsCustomValue
      items={items}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key));
      }}
      onInputChange={onChange}
    >
      {(item) => (
        <AutocompleteItem key={item.key} textValue={item.label}>
          {item.label}
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}

export const RECEIPT_METHOD_OPTIONS = ['Bank Transfer', 'Cash', 'Card', 'Mobile Money', 'Cheque'] as const;

export function resolveFromOptions(value: string | undefined, options: string[], fallback: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed === UNASSIGNED_STAFF) return fallback;
  const exact = options.find((option) => option.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  const prefixes = options.filter((option) => option.toLowerCase().startsWith(trimmed.toLowerCase()));
  if (prefixes.length === 1) return prefixes[0];
  if (trimmed.length <= 2) {
    if (fallback && fallback !== UNASSIGNED_STAFF && fallback.toLowerCase().startsWith(trimmed.toLowerCase())) {
      return fallback;
    }
    return fallback;
  }
  return trimmed;
}

export function resolveReceiptMethod(value?: string): (typeof RECEIPT_METHOD_OPTIONS)[number] {
  const resolved = resolveFromOptions(value, [...RECEIPT_METHOD_OPTIONS], 'Cash');
  return (RECEIPT_METHOD_OPTIONS as readonly string[]).includes(resolved)
    ? (resolved as (typeof RECEIPT_METHOD_OPTIONS)[number])
    : 'Cash';
}

export function getEventCoordinator(event: any, staffNames: string[] = [], preferred = ''): string {
  const value = (event?.eventCoordinator || '').trim();
  if (!staffNames.length) {
    return value && value !== UNASSIGNED_STAFF ? value : UNASSIGNED_STAFF;
  }
  return resolveFromOptions(value, staffNames, preferred || UNASSIGNED_STAFF);
}

export function pickStoredEventCoordinator(
  employees: { firstName?: string; lastName?: string; status?: string; departmentId?: string }[],
  departments: { id?: string; name?: string }[],
) {
  const active = employees.filter((employee) => employee.status === 'active');
  if (!active.length) return '';
  const hinted = /event|conference|banquet/i;
  const hintedDeptIds = new Set(
    departments.filter((dept) => hinted.test(String(dept.name || ''))).map((dept) => String(dept.id || ''))
  );
  const preferred = active.find((employee) => hintedDeptIds.has(String(employee.departmentId || '')));
  const pick = preferred || active[0];
  return `${pick.firstName || ''} ${pick.lastName || ''}`.trim();
}

export function getEventClientContactName(event: any): string {
  const person = (event?.contactPerson || '').trim();
  const org = (event?.organization || '').trim();
  if (person && person !== org) return person;
  return person || '—';
}

export function formatEventTableDate(value?: string) {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatEventTableRange(start?: string, end?: string) {
  const from = formatEventTableDate(start);
  const to = formatEventTableDate(end);
  if (!from && !to) return '—';
  if (!to || from === to) return from || to;
  return `${from} – ${to}`;
}

export function eventStayType(event: any): 'Residential' | 'Non-residential' {
  if (event?.residential === true || event?.isResidential === true) return 'Residential';
  if (event?.residential === false || event?.isResidential === false) return 'Non-residential';
  const type = String(event?.eventType || event?.type || '').toLowerCase();
  if (type.includes('non-residential') || type.includes('non_residential') || type.includes('nonresidential')) {
    return 'Non-residential';
  }
  if (type.includes('residential')) return 'Residential';
  return 'Non-residential';
}

export function parseEventDate(value?: string): Date | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function eventStartValue(event: any): string {
  return event?.arrivalDate || event?.startDate || '';
}

export function eventEndValue(event: any): string {
  return event?.departureDate || event?.endDate || eventStartValue(event);
}

/** A confirmed booking whose last day has passed, and nobody checked the group in or ended the event. */
export function isEventNoShow(event: any, today = new Date()): boolean {
  if (!event) return false;
  const business = String(event.status || '').toLowerCase();
  if (business === 'quote' || business === 'cancelled' || business === 'canceled' || business === 'invoiced') return false;
  if (event.completionStatus === 'completed' || event.completionStatus === 'billed') return false;
  if (event.checkedIn) return false;
  const end = parseEventDate(eventEndValue(event));
  if (!end) return false;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return end < todayStart;
}

export function isUnassignedVenueLabel(value?: string) {
  return !value || /^unassigned(\s+venue)?$/i.test(String(value).trim());
}

export function findVenueInCatalog(
  venues: Array<{ id: string; name: string }>,
  key?: string,
  name?: string
) {
  const id = String(key || '').trim();
  if (id && !isUnassignedVenueLabel(id)) {
    const byId = venues.find((venue) => venue.id === id);
    if (byId) return byId;
  }
  const label = String(name || '').trim();
  if (label && !isUnassignedVenueLabel(label)) {
    const byName = venues.find((venue) => venue.name.toLowerCase() === label.toLowerCase());
    if (byName) return byName;
  }
  return null;
}

export function eventVenueKey(event: any): string {
  const key = event?.venueKey || event?.venue || event?.hallId || '';
  if (key && !isUnassignedVenueLabel(key)) return key;
  const name = event?.venueName || event?.hallName || '';
  if (name && !isUnassignedVenueLabel(name)) return name;
  return 'unassigned';
}

export function eventVenueLabel(event: any, venues: Array<{ id: string; name: string }> = []): string {
  const found = findVenueInCatalog(venues, eventVenueKey(event), event?.venueName || event?.hallName);
  if (found) return found.name;
  const stored = String(event?.venueName || event?.hallName || '').trim();
  return stored && !isUnassignedVenueLabel(stored) ? stored : '—';
}

export function eventUsesVenue(event: any, venue: { id: string; name: string }) {
  const key = eventVenueKey(event);
  if (key && key === venue.id) return true;
  const stored = String(event?.venueName || event?.hallName || '').trim().toLowerCase();
  return Boolean(stored && stored === venue.name.toLowerCase());
}

export function eventHasBeo(event: any): boolean {
  return Boolean(
    event?.lastBeoUpdatedAt ||
    event?.customCatering ||
    event?.customRoomSetup ||
    event?.customRoomDetails ||
    (Array.isArray(event?.customServiceSchedule) && event.customServiceSchedule.length) ||
    event?.linkedBEO
  );
}

export function eventRoomCount(event: any): number | null {
  const explicit = Number(event?.rooms ?? event?.numberOfRooms ?? event?.roomCount);
  if (!Number.isNaN(explicit) && explicit > 0) return explicit;
  const schedule = Array.isArray(event?.dailySchedule) ? event.dailySchedule : [];
  const fromSchedule = schedule.reduce((max: number, day: any) => Math.max(max, Number(day?.rooms || 0)), 0);
  if (fromSchedule > 0) return fromSchedule;
  if (eventStayType(event) === 'Residential') {
    const pax = Number(event?.pax || event?.expectedPax || 0);
    return pax > 0 ? pax : null;
  }
  return null;
}

export function departmentScheduleLines(event: any, match: RegExp): string[] {
  const schedule = Array.isArray(event?.customServiceSchedule) ? event.customServiceSchedule : [];
  return schedule
    .filter((item: any) => match.test(String(item.department || item.responsible || '')))
    .map((item: any) => [item.time, item.activity || item.notes].filter(Boolean).join(' ').trim())
    .filter(Boolean);
}

export function functionFbDuties(event: any): string {
  const parts: string[] = [];
  const catering = event?.customCatering;
  if (catering) {
    if (catering.mealType) parts.push(String(catering.mealType));
    if (catering.lunch) parts.push('Lunch');
    if (catering.dinner) parts.push('Dinner');
    const tea = Number(catering.teaBreaks || 0);
    if (tea > 0) parts.push(`${tea} tea break${tea === 1 ? '' : 's'}`);
    const snacks = Array.isArray(catering.snacks) ? catering.snacks.filter(Boolean) : [];
    if (snacks.length) parts.push(snacks.join(', '));
    const drinks = Array.isArray(catering.beverages) ? catering.beverages.filter(Boolean) : [];
    if (drinks.length) parts.push(drinks.join(', '));
  }
  const schedule = Array.isArray(event?.dailySchedule) ? event.dailySchedule : [];
  if (!parts.length && schedule.length) {
    if (schedule.some((day: any) => Number(day?.lunchPax || 0) > 0)) parts.push('Lunch');
    if (schedule.some((day: any) => Number(day?.dinnerPax || 0) > 0)) parts.push('Dinner');
  }
  parts.push(...departmentScheduleLines(event, /cater|f&b|food|beverage|restaurant|kitchen/i));
  if (parts.length) return Array.from(new Set(parts)).join(', ');
  return eventHasBeo(event) ? 'See BEO' : 'Complete BEO';
}

export function functionHkDuties(event: any): string {
  const parts: string[] = [];
  const rooms = eventRoomCount(event);
  if (eventStayType(event) === 'Residential') {
    parts.push(rooms ? `Prepare ${rooms} rooms` : 'Prepare rooms — see BEO');
  }
  const setup = event?.customRoomSetup;
  if (setup?.layout) parts.push(setup.layout);
  if (setup?.tables) parts.push(`${setup.tables} tables`);
  const notes = event?.customRoomDetails?.setupNotes;
  if (notes) parts.push(String(notes));
  parts.push(...departmentScheduleLines(event, /housekeep|room|front desk|frontdesk|reception/i));
  if (parts.length) return Array.from(new Set(parts)).join(', ');
  return eventHasBeo(event) ? 'See BEO' : 'Complete BEO';
}


export function formatScheduleStatus(status?: string): string {
  switch (status) {
    case 'quote':
      return 'Quote';
    case 'confirmed':
      return 'Confirmed';
    case 'in-progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'invoiced':
      return 'Invoiced';
    case 'billed':
      return 'Billed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status || '—';
  }
}

export type VenueStatus = 'available' | 'booked' | 'setup' | 'maintenance' | 'inactive';

export interface VenueDetails {
  id: string;
  name: string;
  capacity: number;
  type: string;
  location: string;
  features: string[];
  basePrice: number;
  currency: string;
  status: VenueStatus;
}

export interface VenueFormState {
  name: string;
  type: string;
  capacity: string;
  basePrice: string;
  location: string;
  status: VenueStatus;
  featuresInput: string;
  currency: string;
}

export const supplementalVenueSeeds: VenueDetails[] = [
  {
    id: 'venue-001',
    name: 'Accra Conference Hall',
    type: 'conference',
    capacity: 200,
    basePrice: 6000,
    currency: 'GH₵',
    status: 'available',
    features: ['Projector', 'Sound System', 'WiFi', 'Catering Kitchen'],
    location: 'Main Building, 1st Floor'
  },
  {
    id: 'venue-002',
    name: 'Kumasi Meeting Room',
    type: 'meeting',
    capacity: 50,
    basePrice: 2000,
    currency: 'GH₵',
    status: 'booked',
    features: ['Projector', 'Whiteboard', 'Coffee Service'],
    location: 'East Wing, Ground Floor'
  },
  {
    id: 'venue-003',
    name: 'Ghana Banquet Hall',
    type: 'banquet',
    capacity: 300,
    basePrice: 8000,
    currency: 'GH₵',
    status: 'setup',
    features: ['Dance Floor', 'Bar', 'Kitchen', 'Parking'],
    location: 'Garden Area, Separate Building'
  },
  {
    id: 'venue-004',
    name: 'Accra Auditorium',
    type: 'auditorium',
    capacity: 500,
    basePrice: 12000,
    currency: 'GH₵',
    status: 'maintenance',
    features: ['Stage', 'Lighting', 'Sound System', 'VIP Seating'],
    location: 'Main Building, 2nd Floor'
  }
];

export const baseVenueSeeds: VenueDetails[] = [
  {
    id: 'oforwaa-hall',
    name: 'Oforwaa Hall',
    capacity: 200,
    type: 'conference',
    location: 'Main Building, Ground Floor',
    features: ['Projector', 'Sound System', 'WiFi', 'Air Conditioning', 'Flexible Layout'],
    basePrice: 800,
    currency: 'GH₵',
    status: 'available'
  },
  {
    id: 'dankwah-hall',
    name: 'Dankwah Hall',
    capacity: 150,
    type: 'conference',
    location: 'Main Building, First Floor',
    features: ['Projector', 'Sound System', 'WiFi', 'Air Conditioning', 'Fixed Theater Layout'],
    basePrice: 600,
    currency: 'GH₵',
    status: 'available'
  },
  {
    id: 'aqua-blue-room',
    name: 'Aqua Blue Room',
    capacity: 80,
    type: 'meeting',
    location: 'East Wing, Second Floor',
    features: ['Projector', 'WiFi', 'Air Conditioning', 'U-Shape Layout'],
    basePrice: 400,
    currency: 'GH₵',
    status: 'available'
  },
  {
    id: 'gold-coast-hall',
    name: 'Gold Coast Hall',
    capacity: 300,
    type: 'banquet',
    location: 'West Wing, Ground Floor',
    features: ['Stage', 'Sound System', 'WiFi', 'Air Conditioning', 'Banquet Layout'],
    basePrice: 1200,
    currency: 'GH₵',
    status: 'available'
  }
];

export const initialVenueCatalog: VenueDetails[] = [...baseVenueSeeds, ...supplementalVenueSeeds];

export const createEmptyVenueForm = (): VenueFormState => ({
  name: '',
  type: 'conference',
  capacity: '',
  basePrice: '',
  location: '',
  status: 'available',
  featuresInput: '',
  currency: 'GH₵'
});

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'venue';

// Info Icon Component with Tooltip
export const InfoIcon = ({ description }: { description: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 2000); // 2 second delay
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Tooltip
      content={description}
      isOpen={showTooltip}
      onOpenChange={setShowTooltip}
      placement="top"
      showArrow
      color="primary"
      delay={0}
    >
      <div
        className="inline-flex items-center justify-center w-4 h-4 mr-2 text-xs text-blue-500 bg-blue-100 rounded-full cursor-help hover:bg-blue-200 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={description}
      >
        ℹ
      </div>
    </Tooltip>
  );
};

export type ReportFilterConfig = {
  dateRange?: boolean;
  venue?: boolean;
};

export interface ReportDefinition {
  key: string;
  label: string;
  description: string;
  metrics: string[];
  filters: ReportFilterConfig;
}

export interface ReportCategory {
  key: string;
  label: string;
  icon: string;
  description: string;
  reports: ReportDefinition[];
}

export interface ReportInsight {
  label: string;
  value: string;
  helper?: string;
}

export interface ReportQuickLink {
  label: string;
  icon: string;
  action: () => void;
}

export interface ReportTableColumn {
  key: string;
  label: string;
}

export interface ReportTableData {
  columns: ReportTableColumn[];
  rows: Record<string, string>[];
  emptyMessage?: string;
}

export interface ReportFiltersState {
  fromDate: string;
  toDate: string;
  venue: string;
}

export const getDefaultReportRange = () => {
  const today = new Date();
  const to = today.toISOString().split('T')[0];
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().split('T')[0], to };
};

export const buildInitialReportFilters = (): ReportFiltersState => {
  const range = getDefaultReportRange();
  return {
    fromDate: range.from,
    toDate: range.to,
    venue: '',
  };
};

export const filterEventsForReport = (events: any[], filters: ReportFiltersState) => {
  const venueTerm = filters.venue.trim().toLowerCase();
  return events.filter((event) => {
    const date = event.arrivalDate || event.startDate || '';
    if (filters.fromDate && date && date < filters.fromDate) return false;
    if (filters.toDate && date && date > filters.toDate) return false;
    if (venueTerm) {
      const venue = (event.venueName || event.venue || '').toLowerCase();
      if (!venue.includes(venueTerm)) return false;
    }
    return true;
  });
};

export const matchesReportDate = (dateValue: string | undefined | null, filters: ReportFiltersState) => {
  if (!dateValue) return true;
  if (filters.fromDate && dateValue < filters.fromDate) return false;
  if (filters.toDate && dateValue > filters.toDate) return false;
  return true;
};

export interface RateApplicableDates {
  startDate: string;
  endDate: string;
  isAllYear: boolean;
}

export type RateEffectiveStatus = 'all-year' | 'effective' | 'upcoming' | 'expired' | 'incomplete';

export const getRateEffectiveStatus = (
  dates: RateApplicableDates,
  referenceDate = new Date().toISOString().slice(0, 10)
): RateEffectiveStatus => {
  if (dates.isAllYear) return 'all-year';
  if (!dates.startDate || !dates.endDate) return 'incomplete';
  if (referenceDate < dates.startDate) return 'upcoming';
  if (referenceDate > dates.endDate) return 'expired';
  return 'effective';
};

export const rateOverlapsDateRange = (
  dates: RateApplicableDates,
  rangeFrom: string,
  rangeTo: string
) => {
  if (dates.isAllYear) return true;
  if (!dates.startDate || !dates.endDate) return false;
  const from = rangeFrom || rangeTo;
  const to = rangeTo || rangeFrom;
  if (!from && !to) return true;
  return dates.startDate <= to && dates.endDate >= from;
};

export const rateEffectiveForEventDates = (
  dates: RateApplicableDates,
  eventStart: string,
  eventEnd: string
) => {
  const from = eventStart || eventEnd;
  const to = eventEnd || eventStart;
  if (!from && !to) {
    // Before event dates are set, only timeless / all-year rates should auto-apply
    return dates.isAllYear;
  }
  return rateOverlapsDateRange(dates, from, to);
};

export const formatRateTableDate = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const getRateEffectivePeriodLabel = (dates: RateApplicableDates) => {
  if (dates.isAllYear) return 'All year';
  if (dates.startDate && dates.endDate) {
    const from = formatRateTableDate(dates.startDate);
    const to = formatRateTableDate(dates.endDate);
    if (from && to) return `${from} – ${to}`;
  }
  if (dates.startDate) return `From ${formatRateTableDate(dates.startDate)}`;
  if (dates.endDate) return `Until ${formatRateTableDate(dates.endDate)}`;
  return 'Dates not set';
};

export const pickBestRateForType = (rates: any[]) => {
  if (!rates.length) return null;
  return [...rates].sort((a, b) => {
    if (a.clientSpecific && !b.clientSpecific) return -1;
    if (!a.clientSpecific && b.clientSpecific) return 1;
    const aAllYear = a.applicableDates?.isAllYear;
    const bAllYear = b.applicableDates?.isAllYear;
    if (aAllYear && !bAllYear) return 1;
    if (!aAllYear && bAllYear) return -1;
    if (!aAllYear && !bAllYear) {
      const spanA =
        new Date(a.applicableDates.endDate).getTime() - new Date(a.applicableDates.startDate).getTime();
      const spanB =
        new Date(b.applicableDates.endDate).getTime() - new Date(b.applicableDates.startDate).getTime();
      return spanA - spanB;
    }
    return 0;
  })[0];
};

export const resolveGuestRatesForEvent = (
  conferenceRates: any[],
  orgName: string,
  eventStart: string,
  eventEnd: string
) => {
  const orgNameLower = orgName.toLowerCase().trim();
  if (!orgNameLower) {
    return { bestRatesByType: {} as Record<string, any>, applicableCount: 0 };
  }

  const clientSpecificRates = conferenceRates.filter((rate) => {
    if (!rate.isActive || !rate.clientSpecific) return false;
    const rateClientNameLower = (rate.clientName || '').toLowerCase().trim();
    return (
      rateClientNameLower &&
      (rateClientNameLower.includes(orgNameLower) || orgNameLower.includes(rateClientNameLower))
    );
  });

  const generalRates = conferenceRates.filter((rate) => rate.isActive && !rate.clientSpecific);
  const ratesToUse = clientSpecificRates.length > 0 ? clientSpecificRates : generalRates;
  const applicableRates = ratesToUse.filter((rate) =>
    rateEffectiveForEventDates(rate.applicableDates, eventStart, eventEnd || eventStart)
  );

  const bestRatesByType = ['accommodation', 'conference', 'lunch', 'dinner'].reduce<Record<string, any>>(
    (acc, type) => {
      const best = pickBestRateForType(applicableRates.filter((rate) => rate.type === type));
      if (best) acc[type] = best;
      return acc;
    },
    {}
  );

  return { bestRatesByType, applicableCount: applicableRates.length };
};

export type PrintScheduleRates = {
  residential?: boolean;
  roomRate?: number;
  conferenceRate?: number;
  lunchRate?: number;
  dinnerRate?: number;
};

export const buildPrintLineItemsFromSchedule = (
  schedule: any[],
  rates: PrintScheduleRates,
  eventDates?: { arrivalDate?: string; startDate?: string; departureDate?: string; endDate?: string }
) => {
  const items: Array<{ description: string; qty?: number; unit?: string; unitPrice?: number; amount: number; date?: string }> = [];

  if (!schedule.length) return items;

  schedule.forEach((day: any, idx: number) => {
    const dayLabel = `Day ${idx + 1}`;
    const date =
      day.date ||
      eventDates?.arrivalDate ||
      eventDates?.startDate ||
      eventDates?.departureDate ||
      eventDates?.endDate ||
      '';

    if (rates.residential && day.rooms && day.rooms > 0) {
      const roomRate = rates.roomRate || 0;
      items.push({
        description: `${dayLabel} • Accommodation`,
        qty: day.rooms,
        unit: 'rooms',
        unitPrice: roomRate,
        amount: day.rooms * roomRate,
        date,
      });
    }

    if (day.conferencePax && day.conferencePax > 0) {
      const confRate = rates.conferenceRate || 0;
      items.push({
        description: `${dayLabel} • Conference`,
        qty: day.conferencePax,
        unit: 'pax',
        unitPrice: confRate,
        amount: day.conferencePax * confRate,
        date,
      });
    }

    if (day.lunchPax && day.lunchPax > 0) {
      const lunchRate = rates.lunchRate || 0;
      items.push({
        description: `${dayLabel} • Lunch`,
        qty: day.lunchPax,
        unit: 'pax',
        unitPrice: lunchRate,
        amount: day.lunchPax * lunchRate,
        date,
      });
    }

    if (day.dinnerPax && day.dinnerPax > 0) {
      const dinnerRate = rates.dinnerRate || 0;
      items.push({
        description: `${dayLabel} • Dinner`,
        qty: day.dinnerPax,
        unit: 'pax',
        unitPrice: dinnerRate,
        amount: day.dinnerPax * dinnerRate,
        date,
      });
    }

    if (day.extraLines && Array.isArray(day.extraLines)) {
      day.extraLines.forEach((extra: any) => {
        if (extra.qty && extra.unitPrice) {
          items.push({
            description: `${dayLabel} • ${extra.name || 'Extra Service'}`,
            qty: extra.qty,
            unit: 'pcs',
            unitPrice: extra.unitPrice,
            amount: extra.qty * extra.unitPrice,
            date,
          });
        }
      });
    }
  });

  return items;
};

/**
 * Maps the live daily-schedule state (Phase 3: Daily Schedule & Headcounts,
 * "Rate by package" off / Particulars mode) into the generic day-by-day matrix
 * PrintData contract — dates as columns, particulars (incl. custom rows) as rows.
 * Real hotels format quotes/proformas exactly this way (dates across the top,
 * categories down the side) — flattening into a per-day item list loses that shape.
 */
export const buildMatrixTableFromSchedule = (
  schedule: Array<{ date: string; rooms: number; dinnerPax: number; lunchPax: number; conferencePax: number; extras?: Record<string, number> }>,
  particularLabels: { rooms: string; dinnerPax: string; lunchPax: string; conferencePax: string },
  rates: { roomRate: number; dinnerRate: number; lunchRate: number; conferenceRate: number },
  hiddenParticulars: Record<string, boolean>,
  customParticulars: Array<{ id: string; label: string; rate: number }>
): { columns: Array<{ key: string; label: string; sublabel?: string }>; rows: Array<{ label: string; rate?: number; cells: Record<string, number>; totalCount: number; subtotal: number }> } | undefined => {
  if (!schedule.length) return undefined;

  const columns = schedule.map((day, idx) => ({
    key: day.date || `day-${idx}`,
    label: day.date ? new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' }) : `Day ${idx + 1}`,
    sublabel: day.date ? new Date(day.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : undefined,
  }));

  const rateOf: Record<string, number> = { rooms: rates.roomRate, dinnerPax: rates.dinnerRate, lunchPax: rates.lunchRate, conferencePax: rates.conferenceRate };
  const standardKeys = (['rooms', 'dinnerPax', 'lunchPax', 'conferencePax'] as const).filter(k => !hiddenParticulars[k]);

  const rows = standardKeys.map((key) => {
    const cells: Record<string, number> = {};
    let totalCount = 0;
    schedule.forEach((day, idx) => {
      const v = (day as any)[key] || 0;
      if (v > 0) cells[columns[idx].key] = v;
      totalCount += v;
    });
    const rate = rateOf[key] || 0;
    return { label: particularLabels[key], rate, cells, totalCount, subtotal: totalCount * rate };
  }).filter(r => r.totalCount > 0);

  customParticulars.forEach((p) => {
    const cells: Record<string, number> = {};
    let totalCount = 0;
    schedule.forEach((day, idx) => {
      const v = day.extras?.[p.id] || 0;
      if (v > 0) cells[columns[idx].key] = v;
      totalCount += v;
    });
    if (totalCount > 0) rows.push({ label: p.label, rate: p.rate, cells, totalCount, subtotal: totalCount * (p.rate || 0) });
  });

  if (!rows.length) return undefined;
  return { columns, rows };
};

/**
 * The mirror image of buildMatrixTableFromSchedule — same particulars (rows)
 * and rates, but as dates-as-ROWS entries grouped under each particular
 * instead of a dates-as-columns pivot. Feeds the "Daily Schedule (dates as
 * rows)" built-in template (schedule-table block) the same way the matrix
 * builder feeds "Daily Schedule (dates as columns)".
 */
export const buildScheduleTableFromSchedule = (
  schedule: Array<{ date: string; rooms: number; dinnerPax: number; lunchPax: number; conferencePax: number; extras?: Record<string, number> }>,
  particularLabels: { rooms: string; dinnerPax: string; lunchPax: string; conferencePax: string },
  rates: { roomRate: number; dinnerRate: number; lunchRate: number; conferenceRate: number },
  hiddenParticulars: Record<string, boolean>,
  customParticulars: Array<{ id: string; label: string; rate: number }>
): { groups: Array<{ description: string; entries: Array<{ day: string; date?: string; qty?: number; unitPrice?: number; total: number }> }> } | undefined => {
  if (!schedule.length) return undefined;

  const dayLabel = (day: { date: string }, idx: number) =>
    day.date ? new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short' }) : `Day ${idx + 1}`;

  const rateOf: Record<string, number> = { rooms: rates.roomRate, dinnerPax: rates.dinnerRate, lunchPax: rates.lunchRate, conferencePax: rates.conferenceRate };
  const standardKeys = (['rooms', 'dinnerPax', 'lunchPax', 'conferencePax'] as const).filter(k => !hiddenParticulars[k]);

  const groups = standardKeys.map((key) => {
    const rate = rateOf[key] || 0;
    const entries = schedule
      .map((day, idx) => ({ day, idx, v: (day as any)[key] || 0 }))
      .filter(({ v }) => v > 0)
      .map(({ day, idx, v }) => ({ day: dayLabel(day, idx), date: day.date, qty: v, unitPrice: rate, total: v * rate }));
    return { description: particularLabels[key], entries };
  }).filter(g => g.entries.length > 0);

  customParticulars.forEach((p) => {
    const entries = schedule
      .map((day, idx) => ({ day, idx, v: day.extras?.[p.id] || 0 }))
      .filter(({ v }) => v > 0)
      .map(({ day, idx, v }) => ({ day: dayLabel(day, idx), date: day.date, qty: v, unitPrice: p.rate || 0, total: v * (p.rate || 0) }));
    if (entries.length) groups.push({ description: p.label, entries });
  });

  if (!groups.length) return undefined;
  return { groups };
};

/**
 * Accommodation and Conference & Events each get their own document types
 * (see print/templates.ts) rather than sharing 'invoice'/'proforma'/'receipt'
 * with a data filter — so editing one in Settings → Document Templates never
 * changes the other.
 */
export const EVENT_DOC_TYPE: Record<'accommodation' | 'events', Record<'proforma' | 'invoice' | 'receipt', PrintType>> = {
  accommodation: { proforma: 'accommodation-proforma', invoice: 'accommodation-invoice', receipt: 'accommodation-receipt' },
  events: { proforma: 'event-proforma', invoice: 'event-invoice', receipt: 'event-receipt' },
};

/**
 * A booking is a bulk "Accommodation" document only when it has zero
 * conference/catering component — the moment any conference hall or catering
 * usage is present, the whole booking (accommodation included) is one "Event"
 * document. Accommodation alone never makes this true.
 */
export const scheduleHasEventComponent = (
  schedule: Array<{ conferencePax?: number; lunchPax?: number; dinnerPax?: number; extras?: Record<string, number> }>,
  customParticulars: Array<{ id: string }> = []
): boolean =>
  schedule.some((d) => (d.conferencePax || 0) > 0 || (d.lunchPax || 0) > 0 || (d.dinnerPax || 0) > 0) ||
  customParticulars.some((p) => schedule.some((d) => (d.extras?.[p.id] || 0) > 0));

/** Same predicate for the QuoteBudgetSnapshot shape (already-saved events without a live daily schedule). */
export const budgetHasEventComponent = (budget: { conference?: number; lunch?: number; dinner?: number; extras?: number }): boolean =>
  (budget.conference || 0) + (budget.lunch || 0) + (budget.dinner || 0) + (budget.extras || 0) > 0;

export const RATE_EFFECTIVE_STATUS_META: Record<
  RateEffectiveStatus,
  { label: string; color: 'success' | 'warning' | 'danger' | 'default' | 'primary' }
> = {
  'all-year': { label: 'Always effective', color: 'primary' },
  effective: { label: 'Effective now', color: 'success' },
  upcoming: { label: 'Upcoming', color: 'warning' },
  expired: { label: 'Expired', color: 'danger' },
  incomplete: { label: 'Needs dates', color: 'danger' },
};

export const GUEST_RATES_STORAGE_KEY_PREFIX = 'events.conferenceRates';
export const EVENTS_DOCS_STORAGE_KEY_PREFIX = 'events.billingDocs';
// Tenant is resolved client-side on a shared origin, so negotiated rates must be
// namespaced per tenant — a flat key would leak one tenant's rates into another's view.
export const guestRatesStorageKey = () => `${GUEST_RATES_STORAGE_KEY_PREFIX}.${getClientTenantSubdomain()}`;
export const eventsDocsStorageKey = () => `${EVENTS_DOCS_STORAGE_KEY_PREFIX}.${getClientTenantSubdomain()}`;

export const HARDCODED_EVENT_IDS = new Set([
  'evt-001',
  'evt-002',
  'evt-003',
  'evt-004',
  'evt-005',
  'evt-006',
  'evt-007',
  'evt-008',
  'evt-009',
  'evt-010',
  'evt-011',
  'evt-active-001',
  'evt-active-002',
  'evt-active-003',
  'evt-completed-001',
  'evt-completed-002',
  'evt-completed-003',
]);

export const HARDCODED_BILLING_IDS = new Set([
  'INV-EC-2025-001',
  'INV-EC-2025-002',
  'RCPT-2025-030',
  'RCPT-2025-044',
  'FOL-EC-001',
  'FOL-EC-002',
]);

export function isHardcodedDemoEventId(id?: string) {
  return Boolean(id && HARDCODED_EVENT_IDS.has(id));
}

export function isHardcodedBillingDoc(doc?: { id?: string; eventId?: string }) {
  if (!doc) return false;
  return HARDCODED_BILLING_IDS.has(String(doc.id || '')) || isHardcodedDemoEventId(doc.eventId);
}

export function dayKeyFromValue(value: any): string {
  if (!value) return '';
  const raw = typeof value === 'string' ? value : (value instanceof Date ? value.toISOString() : String(value));
  return raw.slice(0, 10);
}

export function mapApiBookingToEvent(row: any) {
  const details = row?.details && typeof row.details === 'object' ? row.details : {};
  const start = dayKeyFromValue(row?.startDate);
  const end = dayKeyFromValue(row?.endDate) || start;
  const startMs = start ? new Date(`${start}T00:00:00`).getTime() : NaN;
  const endMs = end ? new Date(`${end}T00:00:00`).getTime() : NaN;
  const duration = (!Number.isNaN(startMs) && !Number.isNaN(endMs))
    ? Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1)
    : 1;
  const residential = Boolean(details.residential);
  const quoteBudgetSnapshot = details.quoteBudgetSnapshot;
  return {
    id: row.id,
    organization: row.organizer || details.organization || '',
    eventName: row.title || row.eventName || 'Unnamed Event',
    eventType: residential ? 'residential-conference' : (row.type || 'conference'),
    venue: row.hallId || details.venueKey || details.venue || '',
    venueName: row.hallName || details.venueName || '',
    venueKey: row.hallId || details.venueKey || details.venue || '',
    arrivalDate: start,
    departureDate: end,
    startDate: start,
    endDate: end,
    duration,
    pax: Number(row.attendees || 0),
    expectedPax: Number(row.attendees || 0),
    residential,
    revenue: Number(row.totalCost || quoteBudgetSnapshot?.total || 0),
    contactPerson: row.contactPerson || '',
    contactPhone: row.contactPhone || '',
    contactEmail: row.contactEmail || '',
    linkedBooking: row.id,
    linkedBEO: details.linkedBEO || null,
    quoteBudgetSnapshot,
    budgetTotal: Number(quoteBudgetSnapshot?.total || row.totalCost || 0),
    dailySchedule: Array.isArray(details.dailySchedule) ? details.dailySchedule : [],
    particularLabels: details.particularLabels,
    ratesByParticulars: details.ratesByParticulars,
    combinedPackage: details.combinedPackage,
    conferenceRate: details.conferenceRate,
    lunchRate: details.lunchRate,
    dinnerRate: details.dinnerRate,
    roomRate: details.roomRate,
    defaultDayRate: details.defaultDayRate,
    completionStatus: details.completionStatus,
    scheduledDepartureDate: details.scheduledDepartureDate || '',
    scheduledEndDate: details.scheduledEndDate || '',
    checkedIn: Boolean(details.checkedIn),
    eventCoordinator: details.eventCoordinator || row.eventCoordinator || '',
    nextAction: details.nextAction || '',
    followUpDate: details.followUpDate || '',
    quoteNumber: details.quoteNumber || row.quoteNumber || '',
    status: details.completionStatus === 'completed'
      ? 'completed'
      : (row.status || 'quote'),
    details,
  };
}

export const DEFAULT_CONFERENCE_RATES = [
  {
    id: 'rate-001',
    name: 'Standard Accommodation Rate',
    type: 'accommodation',
    baseRate: 200,
    unit: 'per_room',
    customLabel: 'Accommodation',
    applicableDates: { startDate: '2026-01-01', endDate: '2026-12-31', isAllYear: false },
    clientSpecific: false,
    clientId: '',
    clientName: '',
    isActive: true,
    notes: 'Standard room rate for all guests',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'rate-002',
    name: 'Conference Hall Rate',
    type: 'conference',
    baseRate: 300,
    unit: 'per_person',
    customLabel: 'Conference',
    applicableDates: { startDate: '2026-01-01', endDate: '2026-12-31', isAllYear: false },
    clientSpecific: false,
    clientId: '',
    clientName: '',
    isActive: true,
    notes: 'Standard conference rate per person per day',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'rate-003',
    name: 'Lunch Rate',
    type: 'lunch',
    baseRate: 50,
    unit: 'per_person',
    customLabel: 'Lunch',
    applicableDates: { startDate: '2026-01-01', endDate: '2026-12-31', isAllYear: false },
    clientSpecific: false,
    clientId: '',
    clientName: '',
    isActive: true,
    notes: 'Standard lunch rate per person',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'rate-004',
    name: 'Dinner Rate',
    type: 'dinner',
    baseRate: 80,
    unit: 'per_person',
    customLabel: 'Dinner',
    applicableDates: { startDate: '2026-01-01', endDate: '2026-12-31', isAllYear: false },
    clientSpecific: false,
    clientId: '',
    clientName: '',
    isActive: true,
    notes: 'Standard dinner rate per person',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'rate-005',
    name: 'T-TEL Accommodation & Breakfast Rate',
    type: 'accommodation',
    baseRate: 180,
    unit: 'per_room',
    customLabel: 'Accommodation & Breakfast',
    applicableDates: { startDate: '2026-01-01', endDate: '2026-09-30', isAllYear: false },
    clientSpecific: true,
    clientId: '',
    clientName: 'T-TEL',
    isActive: true,
    notes: 'Corporate rate for T-TEL through Q3 2026',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'rate-006',
    name: 'Agrivest Co Conference with 2 Snacks Rate',
    type: 'conference',
    baseRate: 250,
    unit: 'per_person',
    customLabel: 'Conference with 2 Snacks',
    applicableDates: { startDate: '2026-03-01', endDate: '2026-12-31', isAllYear: false },
    clientSpecific: true,
    clientId: '',
    clientName: 'Agrivest Co',
    isActive: true,
    notes: 'Negotiated rate for Agrivest Co conferences',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

export const loadStoredConferenceRates = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(guestRatesStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const EVENTS_REPORT_CATALOG: ReportCategory[] = [];
