'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Select, SelectItem, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Textarea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip
} from '@heroui/react';
import {
  ArrowDownToLine, BarChart3, CalendarDays, FileSpreadsheet, FileText,
  Filter, Printer, RefreshCw, RotateCcw, Search, SlidersHorizontal, StickyNote, TrendingUp, X
} from 'lucide-react';
import { useReportingStore } from '../lib/frontoffice/reportingStore';
import { useSettingsStore } from '../lib/settings/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useNightAuditLog } from '../lib/frontoffice/useNightAuditLog';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import DailyTransactionReportView, { type TransactionRow } from './DailyTransactionReportView';
import DailyFlashReportView, { type DailyFlashReport } from './DailyFlashReportView';

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function formatReportValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

/** Renders an array of row objects as a small table — reused for nested
 * report arrays like discount requests or complimentary rooms. */
function ReportMiniTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">None</p>;
  const columns = Object.keys(rows[0]);
  return (
    <Table removeWrapper isCompact aria-label="Report detail">
      <TableHeader>
        {columns.map((c) => <TableColumn key={c}>{labelize(c)}</TableColumn>) as any}
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {columns.map((c) => <TableCell key={c}>{formatReportValue(row[c])}</TableCell>) as any}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Renders a report's summary object recursively: primitive fields as stat
 * tiles, nested objects as labeled sub-sections, arrays of objects as mini
 * tables. Used for reports that return one object rather than a row array
 * (daily flash, occupancy, discount requests, complimentary rooms, pricing
 * analytics, ...) — previously these silently dropped every non-primitive
 * field, so most of what the report actually computed never reached the screen. */
function ReportSummarySection({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  const primitives = entries.filter(([, v]) => v === null || typeof v !== 'object');
  const objects = entries.filter(([, v]) => v !== null && typeof v === 'object' && !Array.isArray(v));
  const arrays = entries.filter(([, v]) => Array.isArray(v));

  return (
    <div className="space-y-6">
      {primitives.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {primitives.map(([key, value]) => (
            <div key={key} className="p-3 bg-gray-50 rounded-lg border">
              <div className="text-xs text-gray-500">{labelize(key)}</div>
              <div className="text-lg font-semibold text-ghana-black">{formatReportValue(value)}</div>
            </div>
          ))}
        </div>
      )}
      {objects.map(([key, value]) => (
        <div key={key}>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{labelize(key)}</h4>
          <ReportSummarySection data={value as Record<string, unknown>} />
        </div>
      ))}
      {arrays.map(([key, value]) => {
        const arr = value as unknown[];
        const isObjectArray = arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null;
        return (
          <div key={key}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{labelize(key)}</h4>
            {isObjectArray
              ? <ReportMiniTable rows={arr as Record<string, unknown>[]} />
              : <p className="text-sm text-gray-600">{arr.length > 0 ? arr.join(', ') : 'None'}</p>}
          </div>
        );
      })}
    </div>
  );
}

// Reports whose generator accepts an optional endDate to cover a period
// instead of one day — see getCurrentReportData()'s switch below, which is
// the source of truth. Room Status and Daily Flash stay single-date only:
// Room Status has no historical per-day log to sum across a range, and
// Daily Flash is a point-in-time operational snapshot, not an event list.
const RANGE_REPORT_KEYS = new Set([
  'arrivals', 'departures', 'check-ins', 'high-balance', 'wake-up-calls',
  'daily-transactions', 'cashier-report', 'credit-card-reconciliation', 'guest-ledger',
  'occupancy', 'pace', 'no-shows', 'night-audit-history',
  'source-business', 'market-segmentation', 'discount-request', 'complimentary-room', 'pricing-analytics',
]);
// Reports that don't take a date at all (guest-history reads guestId instead).
const NO_DATE_REPORT_KEYS = new Set(['guest-history']);

const REPORT_GROUPS = {
  'front-desk': {
    title: 'Front Desk',
    description: 'Shift lists used to receive, house and release guests.',
    reports: [
      ['arrivals', 'Arrivals'],
      ['departures', 'Departures'],
      ['check-ins', 'In-House'],
      ['room-status', 'Room Status'],
      ['wake-up-calls', 'Wake-up Calls'],
      ['vip', 'VIP'],
      ['guest-count-meal-plan', 'Meal Plan'],
    ],
  },
  cashiering: {
    title: 'Cashiering',
    description: 'Folios, collections and guest account exposure.',
    reports: [
      ['daily-transactions', 'Transactions'],
      ['cashier-report', 'Cashier'],
      ['credit-card-reconciliation', 'Card Settlement'],
      ['guest-ledger', 'Guest Ledger'],
      ['high-balance', 'High Balance'],
    ],
  },
  'night-audit': {
    title: 'Night Audit',
    description: 'Close-of-day control and the manager flash.',
    reports: [
      ['night-audit-history', 'Audit Log'],
      ['daily-flash', 'Daily Flash'],
    ],
  },
  revenue: {
    title: 'Revenue',
    description: 'Occupancy, booking mix and commercial leakage.',
    reports: [
      ['occupancy', 'Occupancy'],
      ['pace', 'Pace'],
      ['no-shows', 'No-Shows'],
      ['source-business', 'Source of Business'],
      ['market-segmentation', 'Market Segment'],
      ['discount-request', 'Discounts'],
      ['complimentary-room', 'Complimentary'],
      ['pricing-analytics', 'Pricing'],
      ['guest-history', 'Guest History'],
    ],
  },
} as const;

type ReportGroupKey = keyof typeof REPORT_GROUPS;
type ReportFilters = {
  query: string;
  roomType: string;
  status: string;
  source: string;
  paymentMethod: string;
  vipStatus: string;
  staff: string;
  transactionType: string;
  category: string;
};

const EMPTY_REPORT_FILTERS: ReportFilters = {
  query: '',
  roomType: 'all',
  status: 'all',
  source: 'all',
  paymentMethod: 'all',
  vipStatus: 'all',
  staff: 'all',
  transactionType: 'all',
  category: 'all',
};

const REPORT_DESCRIPTIONS: Record<string, string> = {
  arrivals: 'Who is due in, assigned room, party size, rate and payment status.',
  departures: 'Who is due out, folio balance and whether the account is settled.',
  'room-status': 'Occupancy and current housekeeping condition by room.',
  'check-ins': 'Guests in-house during the selected period.',
  'high-balance': 'In-house folios above the guest credit limit.',
  'wake-up-calls': 'Requested wake-up calls and completion status.',
  'daily-transactions': 'Posted folio charges and payments.',
  'cashier-report': 'Collections attributed to a selected cashier.',
  'credit-card-reconciliation': 'Card payments waiting for settlement.',
  'guest-ledger': 'Open guest folios: charges, payments and outstanding.',
  'night-audit-history': 'Night-audit runs by business date.',
  'daily-flash': 'Close-of-day occupancy, revenue and movement snapshot.',
  occupancy: 'Rooms sold, rooms available and guest headcount by day.',
  pace: 'Bookings currently on the books by arrival date and segment.',
  'no-shows': 'Reservations formally marked no-show.',
  'source-business': 'Bookings and revenue by reservation source.',
  'market-segmentation': 'Bookings, revenue and stay length by market segment.',
  'discount-request': 'Applied discounts and revenue impact.',
  'complimentary-room': 'Complimentary stays and associated revenue loss.',
  'pricing-analytics': 'Discount and complimentary impact on room pricing.',
  'guest-count-meal-plan': 'In-house guest counts by meal plan, for kitchen briefing.',
  vip: 'In-house VIP guests and recorded requests.',
  'guest-history': 'Stay and spending history for a selected guest.',
};

type ReportColumnDefinition = { key: string; label: string; defaultVisible?: boolean };

const REPORT_COLUMNS: Record<string, ReportColumnDefinition[]> = {
  arrivals: [
    { key: 'reservationNumber', label: 'Reservation' },
    { key: 'guestName', label: 'Guest' },
    { key: 'status', label: 'Status' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'roomType', label: 'Room Type' },
    { key: 'departureDate', label: 'Departure' },
    { key: 'nights', label: 'Nights', defaultVisible: false },
    { key: 'partySize', label: 'Guests' },
    { key: 'ratePlan', label: 'Rate Plan', defaultVisible: false },
    { key: 'rate', label: 'Rate' },
    { key: 'deposit', label: 'Deposit', defaultVisible: false },
    { key: 'paymentStatus', label: 'Payment Status' },
    { key: 'guaranteed', label: 'Guaranteed', defaultVisible: false },
    { key: 'source', label: 'Source', defaultVisible: false },
    { key: 'vipStatus', label: 'VIP', defaultVisible: false },
    { key: 'specialRequests', label: 'Special Requests', defaultVisible: false },
  ],
  departures: [
    { key: 'reservationNumber', label: 'Reservation' },
    { key: 'guestName', label: 'Guest' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'roomType', label: 'Room Type' },
    { key: 'departureDate', label: 'Departure' },
    { key: 'actualCheckout', label: 'Actual Checkout' },
    { key: 'totalCharges', label: 'Charges' },
    { key: 'totalPayments', label: 'Payments' },
    { key: 'balance', label: 'Balance' },
    { key: 'folioStatus', label: 'Folio Status' },
    { key: 'paymentStatus', label: 'Payment Status', defaultVisible: false },
  ],
  'room-status': [
    { key: 'roomNumber', label: 'Room' },
    { key: 'roomType', label: 'Room Type' },
    { key: 'floor', label: 'Floor' },
    { key: 'status', label: 'Occupancy' },
    { key: 'housekeepingStatus', label: 'Housekeeping' },
    { key: 'guestName', label: 'Guest' },
    { key: 'checkInDate', label: 'Arrival', defaultVisible: false },
    { key: 'checkOutDate', label: 'Departure', defaultVisible: false },
    { key: 'lastCleaned', label: 'Last Updated', defaultVisible: false },
  ],
  'check-ins': [
    { key: 'reservationNumber', label: 'Reservation' },
    { key: 'guestName', label: 'Guest' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'folioNumber', label: 'Folio' },
    { key: 'checkInDate', label: 'Arrival' },
    { key: 'checkOutDate', label: 'Departure' },
    { key: 'partySize', label: 'Guests' },
    { key: 'ratePlan', label: 'Rate Plan' },
    { key: 'currentBalance', label: 'Balance' },
    { key: 'vipStatus', label: 'VIP', defaultVisible: false },
    { key: 'specialRequests', label: 'Special Requests', defaultVisible: false },
  ],
  'high-balance': [
    { key: 'reservationNumber', label: 'Reservation' },
    { key: 'folioNumber', label: 'Folio' },
    { key: 'guestName', label: 'Guest' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'currentBalance', label: 'Balance' },
    { key: 'creditLimit', label: 'Credit Limit' },
    { key: 'amountOverLimit', label: 'Over Limit' },
    { key: 'riskLevel', label: 'Risk' },
    { key: 'lastPayment', label: 'Last Payment', defaultVisible: false },
  ],
  'wake-up-calls': [
    { key: 'callId', label: 'Call ID' },
    { key: 'time', label: 'Wake-up Time' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'guestName', label: 'Guest' },
    { key: 'status', label: 'Status' },
    { key: 'completedBy', label: 'Completed By' },
    { key: 'notes', label: 'Notes', defaultVisible: false },
  ],
  'daily-transactions': [
    { key: 'timestamp', label: 'Date / Time' },
    { key: 'folioNumber', label: 'Folio' },
    { key: 'guestName', label: 'Guest' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'transactionType', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount' },
    { key: 'paymentMethod', label: 'Method' },
    { key: 'status', label: 'Status' },
    { key: 'cashier', label: 'Staff' },
    { key: 'transactionId', label: 'Reference', defaultVisible: false },
    { key: 'category', label: 'Category', defaultVisible: false },
  ],
  'credit-card-reconciliation': [
    { key: 'cardType', label: 'Payment Type' },
    { key: 'transactionCount', label: 'Transactions' },
    { key: 'totalAmount', label: 'Amount' },
    { key: 'batchNumber', label: 'Batch' },
    { key: 'settlementDate', label: 'Settlement Date' },
    { key: 'status', label: 'Status' },
  ],
  'guest-ledger': [
    { key: 'reservationNumber', label: 'Reservation' },
    { key: 'folioNumber', label: 'Folio' },
    { key: 'guestName', label: 'Guest' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'totalCharges', label: 'Charges' },
    { key: 'totalPayments', label: 'Payments' },
    { key: 'outstandingBalance', label: 'Outstanding' },
    { key: 'currency', label: 'Currency', defaultVisible: false },
    { key: 'agingDays', label: 'Age (Days)' },
    { key: 'checkOutDate', label: 'Departure', defaultVisible: false },
  ],
  'night-audit-history': [
    { key: 'businessDate', label: 'Business Date' },
    { key: 'status', label: 'Status' },
    { key: 'runAt', label: 'Completed At' },
    { key: 'runBy', label: 'Run By' },
    { key: 'source', label: 'Source' },
    { key: 'roomCharges', label: 'Room Charges' },
    { key: 'noShows', label: 'No-Shows' },
  ],
  pace: [
    { key: 'date', label: 'Arrival Date' },
    { key: 'marketSegment', label: 'Market Segment' },
    { key: 'currentBookings', label: 'Bookings on Books' },
    { key: 'projectedOccupancy', label: 'Projected Occupancy' },
    { key: 'revenuePace', label: 'Booked Revenue' },
  ],
  'source-business': [
    { key: 'source', label: 'Booking Source' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'averageRate', label: 'Revenue / Booking' },
    { key: 'percentageOfTotal', label: 'Share of Bookings' },
  ],
  'market-segmentation': [
    { key: 'segment', label: 'Market Segment' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'averageRate', label: 'Revenue / Booking' },
    { key: 'averageLengthOfStay', label: 'Average Stay' },
    { key: 'percentageOfTotal', label: 'Share of Bookings' },
  ],
  'no-shows': [
    { key: 'reservationNumber', label: 'Reservation' },
    { key: 'guestName', label: 'Guest' },
    { key: 'roomType', label: 'Room Type' },
    { key: 'arrivalDate', label: 'Arrival' },
    { key: 'reservationSource', label: 'Source' },
    { key: 'guaranteed', label: 'Guaranteed' },
    { key: 'depositAmount', label: 'Deposit' },
    { key: 'guestPhone', label: 'Phone', defaultVisible: false },
  ],
  occupancy: [
    { key: 'date', label: 'Date' },
    { key: 'occupiedRooms', label: 'Occupied' },
    { key: 'availableRooms', label: 'Available' },
    { key: 'occupancyRate', label: 'Occupancy' },
    { key: 'adultsInHouse', label: 'Adults' },
    { key: 'childrenInHouse', label: 'Children' },
    { key: 'totalGuestsInHouse', label: 'Guests' },
    { key: 'totalRooms', label: 'Total Rooms', defaultVisible: false },
  ],
  'guest-count-meal-plan': [
    { key: 'mealPlan', label: 'Meal Plan' },
    { key: 'adults', label: 'Adults' },
    { key: 'children', label: 'Children' },
    { key: 'guestCount', label: 'Guests' },
  ],
  vip: [
    { key: 'guestName', label: 'Guest' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'vipLevel', label: 'VIP Level' },
    { key: 'arrivalDate', label: 'Arrival' },
    { key: 'departureDate', label: 'Departure' },
    { key: 'specialRequests', label: 'Special Requests' },
    { key: 'preferences', label: 'Preferences', defaultVisible: false },
  ],
};

export default function FrontOfficeReportsAnalysis() {
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('front-desk');
  const [selectedReport, setSelectedReport] = useState('arrivals');
  const [cashierId, setCashierId] = useState('');
  const [guestId, setGuestId] = useState('');
  // startDate doubles as "the date" for Today/Specific Date mode (where it's
  // always equal to endDate) and as the period start for Range mode — kept
  // as one value instead of a separate date state, which used to go stale
  // the moment Range mode was selected (Range only ever updated
  // startDate/endDate, never that other field).
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  // One consistent 3-way control — Today / Specific Date / Range — always
  // rendered the same way regardless of report type, instead of the date
  // section restructuring itself per report (which read as broken/flaky).
  // "Today" and "Specific Date" are just a range collapsed to a single day
  // (start === end); "Range" is disabled, not hidden, for reports whose
  // generator only accepts one date — see RANGE_REPORT_KEYS.
  const [reportDateMode, setReportDateMode] = useState<'today' | 'specific' | 'range'>('today');
  const [isGenerating, setIsGenerating] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [reportNotes, setReportNotes] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [hiddenKpisByReport, setHiddenKpisByReport] = useState<Record<string, string[]>>({});
  const [hiddenColumnsByReport, setHiddenColumnsByReport] = useState<Record<string, string[]>>({});

  // Report data reads frontOfficeStore.rooms/reservations/roomTypes directly,
  // which start empty on the server (and on the client's first paint) and
  // only get populated once syncRoomsFromSettings() runs in an effect
  // elsewhere in the app. Rendering the report table before that finishes
  // would show placeholders like a room's "TBD" during SSR and the real
  // value once hydrated — a hydration mismatch. Defer the table itself
  // (not the surrounding page chrome) until after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('frontoffice.report-summary-preferences');
      if (saved) setHiddenKpisByReport(JSON.parse(saved));
      const savedColumns = localStorage.getItem('frontoffice.report-column-preferences');
      if (savedColumns) setHiddenColumnsByReport(JSON.parse(savedColumns));
    } catch {
      // A blocked or malformed local preference should never prevent reporting.
    }
  }, []);

  const settings = useSettingsStore();
  const reportingStore = useReportingStore();
  const { logs: nightAuditLogs } = useNightAuditLog({ startDate, endDate });
  const orgProfile = buildOrgProfile(settings);

  // currentUser.id is a raw database cuid, not something meant for display —
  // show the person's actual name (or email as a fallback) instead.
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  // Starts null (matching SSR, which has no "now" to render) and is only set
  // from an effect — reading new Date() directly in the render body ran on
  // both the server and the client's first paint, and those two clock reads
  // can land in different seconds, failing hydration (the classic Date.now()
  // case React's own hydration-mismatch docs call out).
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, selectedTab, startDate, endDate]);

  // Switching to a report whose generator doesn't accept a range shouldn't
  // leave the control stuck showing a disabled "Range" pill with nothing to
  // fill in — fall back to Today, the same single-day value Range collapses
  // to anyway.
  useEffect(() => {
    if (reportDateMode === 'range' && !RANGE_REPORT_KEYS.has(selectedReport)) {
      const today = new Date().toISOString().split('T')[0];
      setReportDateMode('today');
      setStartDate(today);
      setEndDate(today);
    }
  }, [selectedReport, reportDateMode]);

  useEffect(() => {
    setFilters(EMPTY_REPORT_FILTERS);
    setFiltersExpanded(false);
  }, [selectedReport]);

  // Generate reports with detailed logging using the reporting store
  const generateArrivalsReport = useMemo(() => {
    return reportingStore.generateArrivalsReport(startDate, endDate);
  }, [startDate, endDate, reportingStore, refreshVersion]);

  const generateDeparturesReport = useMemo(() => {
    return reportingStore.generateDeparturesReport(startDate, endDate);
  }, [startDate, endDate, reportingStore, refreshVersion]);

  const generateRoomStatusReport = useMemo(() => {
    return reportingStore.generateRoomStatusReport(startDate);
  }, [startDate, reportingStore, refreshVersion]);

  const generateCheckInGuestReport = useMemo(() => {
    return reportingStore.generateCheckInGuestReport(startDate, endDate);
  }, [startDate, endDate, reportingStore, refreshVersion]);

  const generateDailyFlashReport = useMemo(() => {
    return reportingStore.generateDailyFlashReport(startDate);
  }, [startDate, reportingStore, refreshVersion]);

  const handleTabChange = (key: React.Key) => {
    const groupKey = key as ReportGroupKey;
    const firstReport = REPORT_GROUPS[groupKey].reports[0][0];
    setSelectedTab(groupKey);
    setSelectedReport(firstReport);
    setCashierId('');
    setGuestId('');
  };

  const handleRefresh = () => {
    setRefreshVersion((version) => version + 1);
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  };

  const handleExportReport = async (reportData: any, format: 'pdf' | 'excel' | 'csv') => {
    setIsGenerating(true);

    try {
      const extension = format === 'excel' ? 'xls' : format;
      const filename = `${selectedReport}_report_${startDate}.${extension}`;
      const generatedLabel = generatedAt ? `Generated on ${generatedAt} by ${currentUserLabel}` : undefined;
      const fileUrl = await reportingStore.exportReport(reportData, format, filename, generatedLabel);

      // Download the file
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(fileUrl);

      console.log(`[REPORTS] Successfully exported ${selectedReport} report`);
    } catch (error) {
      console.error(`[REPORTS] Error exporting report:`, error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getCurrentReportData = () => {
    switch (selectedReport) {
      case 'arrivals':
        return generateArrivalsReport;
      case 'departures':
        return generateDeparturesReport;
      case 'room-status':
        return generateRoomStatusReport;
      case 'check-ins':
        return generateCheckInGuestReport;
      case 'high-balance':
        return reportingStore.generateHighBalanceReport(startDate, endDate);
      case 'wake-up-calls':
        return reportingStore.generateWakeUpCallReport(startDate, endDate);
      case 'daily-transactions':
        return reportingStore.generateDailyTransactionReport(startDate, endDate);
      case 'cashier-report':
        return reportingStore.generateCashierReport(startDate, cashierId, endDate);
      case 'credit-card-reconciliation':
        return reportingStore.generateCreditCardReconciliationReport(startDate, endDate);
      case 'guest-ledger':
        return reportingStore.generateGuestLedgerReport(startDate, endDate);
      case 'night-audit-history':
        // useNightAuditLog({ startDate, endDate }) already fetches only the
        // matching businessDate range from the server.
        return nightAuditLogs.map((l) => ({
          businessDate: l.businessDate,
          runAt: new Date(l.runAt).toLocaleString(),
          source: l.source,
          roomCharges: l.roomChargesPosted,
          noShows: l.noShowsMarked,
          status: l.status,
          runBy: l.runBy || '—',
        }));
      case 'daily-flash':
        return generateDailyFlashReport;
      case 'occupancy':
        return reportingStore.generateOccupancyReport(startDate, endDate);
      case 'pace':
        return reportingStore.generatePaceReport(startDate, endDate);
      case 'no-shows':
        return reportingStore.generateNoShowReport(startDate, endDate);
      case 'source-business':
        return reportingStore.generateSourceOfBusinessReport(startDate, endDate);
      case 'market-segmentation':
        return reportingStore.generateMarketSegmentationReport(startDate, endDate);
      case 'discount-request':
        return reportingStore.generateDiscountRequestReport(startDate, endDate);
      case 'complimentary-room':
        return reportingStore.generateComplimentaryRoomReport(startDate, endDate);
      case 'pricing-analytics':
        return reportingStore.generatePricingAnalyticsReport(startDate, endDate);
      case 'guest-count-meal-plan':
        return reportingStore.generateGuestCountMealPlanReport(startDate);
      case 'vip':
        return reportingStore.generateVIPReport(startDate);
      case 'guest-history':
        return reportingStore.generateGuestHistoryReport(guestId);
      default:
        return generateArrivalsReport;
    }
  };

  const money = (value: number) =>
    `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const reportData = mounted ? getCurrentReportData() : null;
  const rawRows = (Array.isArray(reportData) ? reportData : []) as Record<string, any>[];
  const fieldValue = (row: Record<string, any>, keys: string[]) => {
    const value = keys.map((key) => row[key]).find((candidate) => candidate !== undefined && candidate !== null && candidate !== '');
    return value === undefined ? '' : String(value);
  };
  const uniqueValues = (keys: string[]) =>
    Array.from(new Set(rawRows.map((row) => fieldValue(row, keys)).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const filterOptions = {
    roomType: uniqueValues(['roomType']),
    status: uniqueValues(['status', 'folioStatus', 'riskLevel', 'housekeepingStatus']),
    source: uniqueValues(['source', 'reservationSource']),
    paymentMethod: uniqueValues(['paymentMethod', 'method']),
    vipStatus: uniqueValues(['vipStatus', 'vipLevel']),
    staff: uniqueValues(['cashier', 'completedBy', 'runBy', 'approvedBy']),
    transactionType: uniqueValues(['transactionType']),
    category: uniqueValues(['category']),
  };
  const rows = rawRows.filter((row) => {
    const query = filters.query.trim().toLocaleLowerCase();
    const matchesQuery = !query || Object.values(row).some((value) => {
      const searchable = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      return searchable.toLocaleLowerCase().includes(query);
    });
    return matchesQuery
      && (filters.roomType === 'all' || fieldValue(row, ['roomType']) === filters.roomType)
      && (filters.status === 'all' || fieldValue(row, ['status', 'folioStatus', 'riskLevel', 'housekeepingStatus']) === filters.status)
      && (filters.source === 'all' || fieldValue(row, ['source', 'reservationSource']) === filters.source)
      && (filters.paymentMethod === 'all' || fieldValue(row, ['paymentMethod', 'method']) === filters.paymentMethod)
      && (filters.vipStatus === 'all' || fieldValue(row, ['vipStatus', 'vipLevel']) === filters.vipStatus)
      && (filters.staff === 'all' || fieldValue(row, ['cashier', 'completedBy', 'runBy', 'approvedBy']) === filters.staff)
      && (filters.transactionType === 'all' || fieldValue(row, ['transactionType']) === filters.transactionType)
      && (filters.category === 'all' || fieldValue(row, ['category']) === filters.category);
  });
  const filteredReportData = Array.isArray(reportData) ? rows : reportData;
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === 'query' ? Boolean(value.trim()) : value !== 'all').length;
  const facetDefinitions = ([
    { key: 'roomType', label: 'Room type', options: filterOptions.roomType },
    { key: 'status', label: 'Status', options: filterOptions.status },
    { key: 'source', label: 'Booking source', options: filterOptions.source },
    { key: 'paymentMethod', label: 'Payment method', options: filterOptions.paymentMethod },
    { key: 'vipStatus', label: 'VIP status', options: filterOptions.vipStatus },
    { key: 'staff', label: 'Staff', options: filterOptions.staff },
    { key: 'transactionType', label: 'Transaction type', options: filterOptions.transactionType },
    { key: 'category', label: 'Category', options: filterOptions.category },
  ] satisfies { key: Exclude<keyof ReportFilters, 'query'>; label: string; options: string[] }[])
    .filter((definition) => definition.options.length > 0);
  const availableColumns = REPORT_COLUMNS[selectedReport]
    || Object.keys(rawRows[0] || {}).map((key) => ({ key, label: labelize(key) }));
  const hasSavedColumnPreference = Object.prototype.hasOwnProperty.call(hiddenColumnsByReport, selectedReport);
  const hiddenColumnKeys = hasSavedColumnPreference
    ? hiddenColumnsByReport[selectedReport]
    : availableColumns.filter((column) => column.defaultVisible === false).map((column) => column.key);
  const visibleColumns = availableColumns.filter((column) => !hiddenColumnKeys.includes(column.key));
  const saveColumnPreferences = (hiddenKeys: string[]) => {
    const next = { ...hiddenColumnsByReport, [selectedReport]: hiddenKeys };
    setHiddenColumnsByReport(next);
    try {
      localStorage.setItem('frontoffice.report-column-preferences', JSON.stringify(next));
    } catch {
      // Column choices remain active for this session if storage is blocked.
    }
  };
  const exportableReportData = Array.isArray(filteredReportData)
    ? rows.map((row) => Object.fromEntries(visibleColumns.map((column) => [column.label, row[column.key]])))
    : filteredReportData;
  const reportLabel = REPORT_GROUPS[selectedTab].reports.find(([key]) => key === selectedReport)?.[1]
    || selectedReport.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const reportKpis = useMemo(() => {
    const count = rows.length;
    if (selectedReport === 'arrivals') {
      return [
        { label: 'Expected arrivals', value: count.toLocaleString(), hint: 'Reservations due in' },
        { label: 'Guests arriving', value: rows.reduce((sum, row) => sum + Number(row.adults || 0) + Number(row.children || 0), 0).toLocaleString(), hint: 'Adults and children' },
        { label: 'VIP arrivals', value: rows.filter((row) => row.vipStatus && row.vipStatus !== 'regular').length.toLocaleString(), hint: 'Special attention' },
        { label: 'Deposits received', value: money(rows.reduce((sum, row) => sum + Number(row.deposit || 0), 0)), hint: 'For selected period' },
      ];
    }
    if (selectedReport === 'departures') {
      return [
        { label: 'Departures', value: count.toLocaleString(), hint: 'Scheduled check-outs' },
        { label: 'Outstanding balance', value: money(rows.reduce((sum, row) => sum + Number(row.balance || 0), 0)), hint: 'Before checkout' },
        { label: 'Open folios', value: rows.filter((row) => row.folioStatus === 'open').length.toLocaleString(), hint: 'Require review' },
        { label: 'Ready to settle', value: rows.filter((row) => Number(row.balance || 0) <= 0).length.toLocaleString(), hint: 'No outstanding balance' },
      ];
    }
    if (selectedReport === 'room-status') {
      const occupied = rows.filter((row) => row.status === 'occupied').length;
      return [
        { label: 'Total rooms', value: count.toLocaleString(), hint: 'Configured inventory' },
        { label: 'Occupied', value: occupied.toLocaleString(), hint: 'For selected date' },
        { label: 'Vacant', value: rows.filter((row) => row.status === 'vacant').length.toLocaleString(), hint: 'Available by occupancy' },
        { label: 'Occupancy', value: count ? `${((occupied / count) * 100).toFixed(1)}%` : '0.0%', hint: 'Rooms occupied' },
      ];
    }
    if (selectedReport === 'daily-transactions') {
      const charges = rows.filter((row) => row.transactionType === 'charge').reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const payments = rows.filter((row) => row.transactionType === 'payment').reduce((sum, row) => sum + Number(row.amount || 0), 0);
      return [
        { label: 'Transactions', value: count.toLocaleString(), hint: 'Posted activity' },
        { label: 'Charges', value: money(charges), hint: 'Gross folio charges' },
        { label: 'Payments', value: money(payments), hint: 'Collections received' },
        { label: 'Net movement', value: money(charges - payments), hint: 'Charges less payments' },
      ];
    }
    if (selectedReport === 'daily-flash' && reportData && !Array.isArray(reportData)) {
      const flash = reportData as DailyFlashReport;
      return [
        { label: 'Occupancy', value: `${Number(flash.occupancy?.occupancyRate || 0).toFixed(1)}%`, hint: 'Rooms sold' },
        { label: 'ADR', value: money(Number(flash.revenue?.averageDailyRate || 0)), hint: 'Room revenue / occupied' },
        { label: 'Room revenue', value: money(Number(flash.revenue?.roomRevenue || 0)), hint: 'Posted today' },
        { label: 'Arrivals', value: Number(flash.movement?.arrivals ?? flash.arrivals?.total ?? 0).toLocaleString(), hint: 'Due in' },
      ];
    }
    if (selectedReport === 'occupancy' && rows[0]) {
      const snapshot = rows[0] as Record<string, number>;
      return [
        { label: 'Total rooms', value: Number(snapshot.totalRooms || 0).toLocaleString(), hint: 'Configured inventory' },
        { label: 'Occupied rooms', value: Number(snapshot.occupiedRooms || 0).toLocaleString(), hint: 'First day in range' },
        { label: 'Available rooms', value: Number(snapshot.availableRooms || 0).toLocaleString(), hint: 'Before housekeeping limits' },
        { label: 'Occupancy', value: `${Number(snapshot.occupancyRate || 0).toFixed(1)}%`, hint: 'Rooms occupied' },
      ];
    }
    return [
      { label: Array.isArray(reportData) ? 'Records' : 'Report sections', value: Array.isArray(reportData) ? count.toLocaleString() : reportData ? Object.keys(reportData).length.toLocaleString() : '0', hint: 'Matching the filters' },
      { label: 'Period start', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? 'Guest history' : startDate, hint: 'Business date' },
      { label: 'Period end', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : endDate, hint: reportDateMode === 'range' ? 'Inclusive' : 'Single day' },
      { label: 'Status', value: 'Current', hint: generatedAt ? `Refreshed ${generatedAt}` : 'Preparing report' },
    ];
  // reportData is intentionally represented by the stable report inputs below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshVersion, mounted, filters]);

  const hiddenKpiLabels = hiddenKpisByReport[selectedReport] || [];
  const visibleReportKpis = reportKpis.filter((kpi) => !hiddenKpiLabels.includes(kpi.label));
  const saveKpiPreferences = (hiddenLabels: string[]) => {
    const next = { ...hiddenKpisByReport, [selectedReport]: hiddenLabels };
    setHiddenKpisByReport(next);
    try {
      localStorage.setItem('frontoffice.report-summary-preferences', JSON.stringify(next));
    } catch {
      // Keep the in-session preference even when storage is unavailable.
    }
  };
  const summaryCustomizationControls = (
    <>
      {hiddenKpiLabels.length > 0 && (
        <Button
          size="sm"
          variant="light"
          startContent={<RotateCcw size={14} />}
          onPress={() => saveKpiPreferences([])}
        >
          Restore metrics
        </Button>
      )}
      <Dropdown closeOnSelect={false}>
        <DropdownTrigger>
          <Button size="sm" variant="bordered" startContent={<SlidersHorizontal size={14} />}>
            Customize summary
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Choose summary metrics"
          selectionMode="multiple"
          selectedKeys={new Set(visibleReportKpis.map((kpi) => kpi.label))}
          onSelectionChange={(keys) => {
            const visibleLabels = keys === 'all'
              ? reportKpis.map((kpi) => kpi.label)
              : Array.from(keys).map(String);
            saveKpiPreferences(reportKpis.filter((kpi) => !visibleLabels.includes(kpi.label)).map((kpi) => kpi.label));
          }}
        >
          {reportKpis.map((kpi) => <DropdownItem key={kpi.label}>{kpi.label}</DropdownItem>) as any}
        </DropdownMenu>
      </Dropdown>
    </>
  );

  const renderReportTable = () => {
    if (!mounted) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading…</p>
        </div>
      );
    }

    const data = filteredReportData;

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">
            {activeFilterCount > 0
              ? 'No records match the active filters. Clear or adjust the filters to continue.'
              : 'No data available for the selected report and date.'}
          </p>
        </div>
      );
    }

    // Daily Transaction Report gets its own view — guest/staff/method/status/
    // category summaries plus a groupable detail table — instead of the plain
    // auto-columned table every other report uses.
    if (selectedReport === 'daily-transactions' && Array.isArray(data)) {
      return (
        <DailyTransactionReportView
          transactions={data as TransactionRow[]}
          showFilters={false}
          visibleColumns={visibleColumns.map((column) => column.key)}
        />
      );
    }

    if (selectedReport === 'daily-flash' && data && !Array.isArray(data)) {
      return <DailyFlashReportView flash={data as DailyFlashReport} />;
    }

    // Some reports (occupancy, cashier's report, guest history,
    // discount requests, complimentary rooms, pricing analytics) return a
    // single summary object rather than a row-per-record array — render
    // those recursively instead of feeding a non-array into the table below.
    if (!Array.isArray(data)) {
      return <ReportSummarySection data={data as Record<string, unknown>} />;
    }

    return (
      <Table
        aria-label={`${selectedReport} report table`}
        classNames={{ base: 'overflow-x-auto', table: 'min-w-max' }}
      >
        <TableHeader>
          {visibleColumns.map((column) => (
            <TableColumn key={column.key}>
              {column.label}
            </TableColumn>
          ))}
        </TableHeader>
        <TableBody>
          {data.map((row: any, index: number) => (
            <TableRow key={index}>
              {visibleColumns.map((column) => (
                <TableCell key={column.key}>
                  {typeof row[column.key] === 'number' && /(amount|balance|rate|revenue|charges|payments|deposit|price|loss|impact|spent|limit)/i.test(column.key)
                    ? money(row[column.key])
                    : typeof row[column.key] === 'number' && /(percentage|occupancy|revpar|adr)/i.test(column.key)
                    ? `${row[column.key].toLocaleString('en-GH', { maximumFractionDigits: 1 })}%`
                    : typeof row[column.key] === 'boolean'
                    ? (row[column.key] ? 'Yes' : 'No')
                    : Array.isArray(row[column.key])
                    ? row[column.key].join(', ')
                    // A plain object isn't a valid React child and crashes the render —
                    // fall back to a readable "key: value" summary instead.
                    : row[column.key] !== null && typeof row[column.key] === 'object'
                    ? Object.entries(row[column.key]).map(([k, v]) => `${k}: ${v}`).join(', ')
                    : formatReportValue(row[column.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <BarChart3 size={18} />
              FRONT OFFICE INTELLIGENCE
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Reports & Analysis</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Operational control, financial reconciliation and management insight from one workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="flat" startContent={<RefreshCw size={16} />} onPress={handleRefresh}>
              Refresh
            </Button>
            <Button variant="bordered" startContent={<StickyNote size={16} />} onPress={onOpen}>
              Notes
            </Button>
            <Button variant="bordered" startContent={<Printer size={16} />} onPress={() => window.print()}>
              Print
            </Button>
            <Dropdown>
              <DropdownTrigger>
                <Button color="primary" startContent={<ArrowDownToLine size={16} />} isLoading={isGenerating}>
                  Export
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Export report">
                <DropdownItem key="pdf" startContent={<FileText size={16} />} onPress={() => handleExportReport(exportableReportData, 'pdf')}>
                  Download PDF
                </DropdownItem>
                <DropdownItem key="excel" startContent={<FileSpreadsheet size={16} />} onPress={() => handleExportReport(exportableReportData, 'excel')}>
                  Download Excel
                </DropdownItem>
                <DropdownItem key="csv" startContent={<ArrowDownToLine size={16} />} onPress={() => handleExportReport(exportableReportData, 'csv')}>
                  Download CSV
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        <Card className="border border-slate-200 shadow-sm">
          <CardBody className="gap-4 p-4">
            <Tabs
              selectedKey={selectedTab}
              onSelectionChange={handleTabChange}
              aria-label="Report categories"
              color="primary"
              variant="underlined"
              classNames={{ tabList: 'gap-5', cursor: 'w-full', tab: 'px-0 h-10' }}
            >
              {Object.entries(REPORT_GROUPS).map(([key, group]) => (
                <Tab key={key} title={group.title} />
              ))}
            </Tabs>

            <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
              <Select
                label="Report"
                selectedKeys={[selectedReport]}
                onSelectionChange={(keys) => {
                  const next = Array.from(keys)[0] as string;
                  if (next) setSelectedReport(next);
                }}
                startContent={<TrendingUp size={16} className="text-slate-400" />}
              >
                {REPORT_GROUPS[selectedTab].reports.map(([key, label]) => (
                  <SelectItem key={key}>{label}</SelectItem>
                ))}
              </Select>

              {!NO_DATE_REPORT_KEYS.has(selectedReport) && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <CalendarDays size={14} /> Reporting period
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(['today', 'specific', 'range'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          if (mode === 'today') {
                            const today = new Date().toISOString().split('T')[0];
                            setStartDate(today);
                            setEndDate(today);
                          }
                          setReportDateMode(mode);
                        }}
                        disabled={mode === 'range' && !RANGE_REPORT_KEYS.has(selectedReport)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          reportDateMode === mode
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : mode === 'range' && !RANGE_REPORT_KEYS.has(selectedReport)
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400'
                        }`}
                      >
                        {mode === 'today' ? 'Today' : mode === 'specific' ? 'Specific date' : 'Date range'}
                      </button>
                    ))}
                    {reportDateMode === 'specific' && (
                      <Input
                        aria-label="Report date"
                        type="date"
                        value={startDate}
                        onChange={(event) => {
                          setStartDate(event.target.value);
                          setEndDate(event.target.value);
                        }}
                        className="w-44"
                        size="sm"
                      />
                    )}
                    {reportDateMode === 'range' && RANGE_REPORT_KEYS.has(selectedReport) && (
                      <>
                        <Input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-44" size="sm" />
                        <span className="text-sm text-slate-400">to</span>
                        <Input aria-label="End date" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="w-44" size="sm" />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(selectedReport === 'cashier-report' || selectedReport === 'guest-history') && (
              <div className="max-w-sm">
                {selectedReport === 'cashier-report' ? (
                  <Select
                    label="Cashier"
                    selectedKeys={cashierId ? [cashierId] : []}
                    onSelectionChange={(keys) => setCashierId((Array.from(keys)[0] as string) || '')}
                    placeholder="Select a cashier"
                  >
                    {settings.users.map((user) => {
                      const name = `${user.firstName} ${user.lastName}`.trim();
                      return <SelectItem key={name}>{name}</SelectItem>;
                    })}
                  </Select>
                ) : (
                  <Select
                    label="Guest"
                    selectedKeys={guestId ? [guestId] : []}
                    onSelectionChange={(keys) => setGuestId((Array.from(keys)[0] as string) || '')}
                    placeholder="Select a guest"
                  >
                    {frontOfficeStore.guests.slice(0, 200).map((guest) => <SelectItem key={guest.id}>{guest.name}</SelectItem>)}
                  </Select>
                )}
              </div>
            )}

            {rawRows.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Search report results"
                    placeholder="Guest, room, folio..."
                    value={filters.query}
                    onValueChange={(query) => setFilters((current) => ({ ...current, query }))}
                    startContent={<Search size={16} className="text-slate-400" />}
                    size="sm"
                    className="w-full sm:w-64 lg:w-72"
                  />
                  {facetDefinitions.length > 0 && (
                    <Button
                      size="sm"
                      variant={filtersExpanded ? 'solid' : 'bordered'}
                      color={filtersExpanded ? 'primary' : 'default'}
                      startContent={<Filter size={14} />}
                      onPress={() => setFiltersExpanded((expanded) => !expanded)}
                    >
                      Filters{activeFilterCount > (filters.query ? 1 : 0) ? ` (${activeFilterCount - (filters.query ? 1 : 0)})` : ''}
                    </Button>
                  )}
                  {facetDefinitions
                    .filter((definition) => filters[definition.key] !== 'all')
                    .map((definition) => (
                      <Chip
                        key={definition.key}
                        size="sm"
                        variant="flat"
                        color="primary"
                        onClose={() => setFilters((current) => ({ ...current, [definition.key]: 'all' }))}
                      >
                        {definition.label}: {filters[definition.key]}
                      </Chip>
                    ))}
                  <span className="ml-auto text-xs text-slate-500">
                    Showing {rows.length} of {rawRows.length}
                  </span>
                  {activeFilterCount > 0 && (
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      startContent={<X size={14} />}
                      onPress={() => {
                        setFilters(EMPTY_REPORT_FILTERS);
                        setFiltersExpanded(false);
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {filtersExpanded && facetDefinitions.length > 0 && (
                  <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                    {facetDefinitions.map((definition) => (
                      <Select
                        key={definition.key}
                        aria-label={definition.label}
                        label={definition.label}
                        size="sm"
                        selectedKeys={[filters[definition.key]]}
                        onSelectionChange={(keys) => {
                          const value = (Array.from(keys)[0] as string) || 'all';
                          setFilters((current) => ({ ...current, [definition.key]: value }));
                          setFiltersExpanded(false);
                        }}
                      >
                        <SelectItem key="all">All {definition.label.toLocaleLowerCase()}s</SelectItem>
                        {definition.options.map((option) => <SelectItem key={option}>{option}</SelectItem>) as any}
                      </Select>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardBody className="overflow-x-auto px-4 py-3">
            <div className="flex min-w-max items-center gap-4">
              <div className="flex flex-1 items-center divide-x divide-slate-200">
                {visibleReportKpis.length > 0 ? visibleReportKpis.map((kpi) => (
                    <div key={kpi.label} className="flex items-baseline gap-2 px-4 first:pl-0 last:pr-0">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</span>
                      <span className="text-base font-bold text-slate-950">{kpi.value}</span>
                    </div>
                  )) : (
                    <p className="pr-4 text-sm text-slate-500">All summary metrics are hidden.</p>
                  )}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-slate-200 pl-4">
                {summaryCustomizationControls}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card id="report-print-area" className="border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col items-start gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="hidden print:block">
                <h2 className="text-xl font-bold">{orgProfile.name}</h2>
                {(orgProfile.address || orgProfile.phone || orgProfile.email) && (
                  <p className="text-xs text-slate-500">
                    {[orgProfile.address, orgProfile.phone, orgProfile.email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-950">{reportLabel}</h2>
                <Chip size="sm" color="primary" variant="flat">{REPORT_GROUPS[selectedTab].title}</Chip>
              </div>
              <p className="mt-1 text-sm text-slate-500">{REPORT_DESCRIPTIONS[selectedReport]}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-left text-xs text-slate-500 sm:text-right">
                <div>{NO_DATE_REPORT_KEYS.has(selectedReport) ? 'Guest-specific report' : startDate === endDate ? startDate : `${startDate} – ${endDate}`}</div>
                <div>Generated {generatedAt ?? '…'} by {currentUserLabel}</div>
              </div>
              {Array.isArray(reportData) && availableColumns.length > 0 && (
                <Dropdown closeOnSelect={false}>
                  <DropdownTrigger>
                    <Button size="sm" variant="bordered" startContent={<SlidersHorizontal size={14} />}>
                      Columns
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Choose table columns"
                    selectionMode="multiple"
                    disallowEmptySelection
                    selectedKeys={new Set(visibleColumns.map((column) => column.key))}
                    onSelectionChange={(keys) => {
                      const selected = keys === 'all'
                        ? availableColumns.map((column) => column.key)
                        : Array.from(keys).map(String);
                      saveColumnPreferences(availableColumns.filter((column) => !selected.includes(column.key)).map((column) => column.key));
                    }}
                  >
                    {availableColumns.map((column) => <DropdownItem key={column.key}>{column.label}</DropdownItem>) as any}
                  </DropdownMenu>
                </Dropdown>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-5">
            {renderReportTable()}
            {reportNotes && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Report notes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{reportNotes}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Report Notes Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>Add Report Notes</ModalHeader>
          <ModalBody>
            <Textarea
              label="Report Notes"
              placeholder="Add any additional notes or observations about this report..."
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              minRows={4}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => {
              console.log(`[REPORTS] Added notes to ${selectedReport} report:`, reportNotes);
              onClose();
            }}>
              Save Notes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
