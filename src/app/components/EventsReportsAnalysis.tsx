'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Tabs, Tab, Select, SelectItem, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Textarea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip
} from '@heroui/react';
import {
  ArrowDownToLine, BarChart3, CalendarDays, FileSpreadsheet, FileText,
  Filter, Printer, RefreshCw, RotateCcw, Search, SlidersHorizontal, StickyNote, TrendingUp, X
} from 'lucide-react';
import { fetchCateringItems, fetchConferenceHalls, fetchEventBookings } from '../lib/frontoffice/eventsApi';
import { useAccountingStore } from '../lib/accounting/store';
import { conferenceDocBelongsToLiveEvent, retireOrphanConferenceInvoices } from '../lib/accounting/integration';
import { useSettingsStore } from '../lib/settings/store';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import { reportDataToSections, sectionsToCSV, sectionsToExcelHtml, sectionsToPdfBlob } from '../lib/frontoffice/reportExportFormat';
import { buildIdSequence, sequenceLabel, sortIdsByDate } from '../lib/events/documentNumbers';
import { paymentMethodLabel } from '../lib/accounting/receiptPrint';

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function formatReportValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

function money(value: number) {
  return `₵${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dayOf(value?: Date | string | null) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = String(value);
  if (raw.length >= 10) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function inDateRange(day: string, startDate: string, endDate: string) {
  return Boolean(day) && day >= startDate && day <= endDate;
}

function overlapsPeriod(start: string, end: string, from: string, to: string) {
  const begins = start || end;
  const finishes = end || start;
  return Boolean(begins && finishes && begins <= to && finishes >= from);
}

function statusOf(value?: string) {
  return String(value || '').trim().toLowerCase();
}

function isPendingStatus(status: string) {
  return status === 'pending' || status === 'quote' || status === 'awaiting-confirmation' || status === 'awaiting_confirmation';
}

function isOnSiteStatus(status: string) {
  return status === 'confirmed' || status === 'in-progress' || status === 'in_progress';
}

function isCancelledStatus(status: string) {
  return status === 'cancelled' || status === 'canceled';
}

function isConferenceInvoice(invoice: { sourceModule?: string; eventId?: string; description?: string }) {
  const source = statusOf(invoice.sourceModule);
  if (source === 'conference' || source === 'events' || source === 'events-conferences') return true;
  if (invoice.eventId) return true;
  const description = String(invoice.description || '').toLowerCase();
  return description.includes('conference booking') || description.includes('conference invoice') || description.includes('event booking') || description.includes('conference proforma');
}

function isProformaDoc(invoice: { isProforma?: boolean; invoiceNumber?: string; status?: string }) {
  if (invoice.isProforma) return true;
  const number = String(invoice.invoiceNumber || '').toUpperCase().replace(/\s+/g, '');
  if (number.startsWith('PRO-') || number.startsWith('PRO_')) return true;
  return statusOf(invoice.status) === 'converted';
}

function isPostedSalesInvoice(invoice: { status?: string }) {
  const status = statusOf(invoice.status);
  return status === 'posted' || status === 'paid';
}

function invoiceEventKey(invoice: { id?: string; eventId?: string; reference?: string }) {
  const direct = String(invoice.eventId || invoice.reference || '').trim();
  if (direct) return direct;
  const id = String(invoice.id || '');
  if (id.startsWith('INV-CONFERENCE-PRO-')) return id.slice('INV-CONFERENCE-PRO-'.length);
  return '';
}

function numericOrZero(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function invoiceCustomerName(
  invoice: { customerName?: string; businessPartnerId?: string },
  partners: { id: string; name: string }[],
) {
  const stored = String(invoice.customerName || '').trim();
  if (stored) return stored;
  const partner = partners.find((row) => row.id === invoice.businessPartnerId);
  if (partner?.name) return partner.name;
  return '—';
}

function bookingQuoteBudget(row: any) {
  const details = row?.details && typeof row.details === 'object' ? row.details : {};
  const snap = details.quoteBudgetSnapshot || row.quoteBudgetSnapshot;
  if (snap && typeof snap === 'object') {
    return {
      accommodation: Number(snap.accommodation || 0),
      conference: Number(snap.conference || 0),
      dinner: Number(snap.dinner || 0),
      lunch: Number(snap.lunch || 0),
      extras: Number(snap.extras || 0),
      total: Number(snap.total || 0),
    };
  }
  const breakdown = details.costBreakdown;
  if (!breakdown || typeof breakdown !== 'object') return undefined;
  return {
    accommodation: Number(breakdown.accommodation?.finalCost || 0),
    conference: Number(breakdown.package?.finalCost || 0),
    dinner: Number(breakdown.services?.dinner || 0),
    lunch: Number(breakdown.services?.other || 0),
    extras: Number(breakdown.services?.equipment || 0),
    total: Number(breakdown.totalCost || 0),
  };
}

function invoiceDescription(
  invoice: {
    description?: string;
    eventName?: string;
    venue?: string;
    eventId?: string;
    reference?: string;
    items?: { description?: string }[];
    lines?: { description?: string }[];
  },
  bookings: { id: string; title: string; hallName: string }[],
) {
  const eventName = String(invoice.eventName || '').trim();
  const venue = String(invoice.venue || '').trim();
  if (eventName) return venue ? `${eventName} — ${venue}` : eventName;

  const keys = [invoice.eventId, invoice.reference].filter(Boolean).map(String);
  const booking = bookings.find((row) =>
    keys.some((key) => key === row.id || key === `EVT-${row.id}` || key.endsWith(row.id))
  );
  if (booking?.title && booking.title !== 'Unnamed') {
    return booking.hallName && booking.hallName !== '—'
      ? `${booking.title} — ${booking.hallName}`
      : booking.title;
  }

  let text = String(invoice.description || '').trim();
  text = text.replace(/^(conference booking|conference invoice|conference proforma|event booking)\s*:\s*/i, '');
  text = text.replace(/\s*\((?:INV|PRO)[-A-Z0-9]+\)\s*$/i, '');
  if (text) return text;

  const line = String(invoice.items?.[0]?.description || invoice.lines?.[0]?.description || '').trim();
  return line || '—';
}

const RANGE_REPORT_KEYS = new Set([
  'on-site', 'arriving', 'departing', 'pending', 'cancelled', 'particulars',
  'hall-diary', 'services', 'proformas', 'outstanding', 'invoices', 'receipts',
]);
const NO_DATE_REPORT_KEYS = new Set(['halls', 'catering']);

const REPORT_GROUPS = {
  events: {
    title: 'Events',
    description: 'Bookings that start, sit, or leave in the selected period.',
    reports: [
      ['on-site', 'On site'],
      ['arriving', 'Arriving'],
      ['departing', 'Departing'],
      ['pending', 'Pending'],
      ['cancelled', 'Cancelled'],
      ['particulars', 'Particulars'],
    ],
  },
  venues: {
    title: 'Venues',
    description: 'Halls used in the period, plus the hall and catering files.',
    reports: [
      ['hall-diary', 'Hall diary'],
      ['services', 'Requested services'],
      ['halls', 'Hall list'],
      ['catering', 'Catering menu'],
    ],
  },
  accounts: {
    title: 'Accounts',
    description: 'Conference proformas, posted invoices and receipts.',
    reports: [
      ['proformas', 'Proformas'],
      ['outstanding', 'Outstanding'],
      ['invoices', 'Invoices'],
      ['receipts', 'Receipts'],
    ],
  },
} as const;

type ReportGroupKey = keyof typeof REPORT_GROUPS;
type ReportFilters = {
  query: string;
  status: string;
  type: string;
  staff: string;
  category: string;
  method: string;
  particular: string;
};

const EMPTY_REPORT_FILTERS: ReportFilters = {
  query: '',
  status: 'all',
  type: 'all',
  staff: 'all',
  category: 'all',
  method: 'all',
  particular: 'all',
};

const REPORT_DESCRIPTIONS: Record<string, string> = {
  'on-site': 'Confirmed or in-progress bookings that overlap the selected period. Not a utilisation score.',
  arriving: 'Bookings whose start date falls in the period, excluding cancelled.',
  departing: 'Bookings whose end date falls in the period, excluding cancelled.',
  pending: 'Quoted or pending bookings that overlap the period.',
  cancelled: 'Cancelled bookings that overlap the period.',
  particulars: 'Only the particulars that were priced separately. A combined conference package stays one Package line — dinner or rooms are not guessed.',
  'hall-diary': 'Each hall with the stored bookings that overlap the period. Event count and value come from those rows.',
  services: 'On-site and arriving bookings and the catering / AV / decoration flags stored on each booking.',
  halls: 'Conference halls currently on file. Status is the stored hall status.',
  catering: 'Catering items currently on file. Price is the stored unit price.',
  proformas: 'Quotes and conference proformas for current bookings. They are not posted to the ledger until invoiced.',
  outstanding: 'Posted conference invoices still carrying a stored balance (total minus paid). Proformas are excluded.',
  invoices: 'Posted or paid conference sales invoices only. Proformas and drafts stay off this list.',
  receipts: 'Receipts posted against those conference invoices, or with source conference.',
};

type ReportColumnDefinition = { key: string; label: string; defaultVisible?: boolean };

const EVENT_COLUMNS: ReportColumnDefinition[] = [
  { key: 'title', label: 'Event' },
  { key: 'startDate', label: 'Start' },
  { key: 'endDate', label: 'End' },
  { key: 'startTime', label: 'From', defaultVisible: false },
  { key: 'endTime', label: 'To', defaultVisible: false },
  { key: 'organizer', label: 'Organizer' },
  { key: 'hallName', label: 'Hall' },
  { key: 'attendees', label: 'Pax' },
  { key: 'status', label: 'Status' },
  { key: 'type', label: 'Type' },
  { key: 'totalCost', label: 'Value' },
];

const INVOICE_COLUMNS: ReportColumnDefinition[] = [
  { key: 'invoiceNumber', label: 'Invoice' },
  { key: 'date', label: 'Date' },
    { key: 'customer', label: 'Customer name' },
  { key: 'description', label: 'Description' },
  { key: 'total', label: 'Total' },
  { key: 'paidAmount', label: 'Paid' },
  { key: 'balance', label: 'Balance' },
  { key: 'status', label: 'Status' },
];

const REPORT_COLUMNS: Record<string, ReportColumnDefinition[]> = {
  'on-site': EVENT_COLUMNS,
  arriving: EVENT_COLUMNS,
  departing: EVENT_COLUMNS,
  pending: EVENT_COLUMNS,
  cancelled: EVENT_COLUMNS,
  particulars: [
    { key: 'title', label: 'Event' },
    { key: 'organizer', label: 'Customer name' },
    { key: 'hallName', label: 'Hall' },
    { key: 'particular', label: 'Particular' },
    { key: 'amount', label: 'Amount' },
    { key: 'status', label: 'Status' },
  ],
  'hall-diary': [
    { key: 'name', label: 'Hall' },
    { key: 'type', label: 'Type' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'events', label: 'Events' },
    { key: 'attendees', label: 'Pax' },
    { key: 'totalCost', label: 'Value' },
    { key: 'status', label: 'Hall status' },
  ],
  services: [
    { key: 'title', label: 'Event' },
    { key: 'startDate', label: 'Start' },
    { key: 'hallName', label: 'Hall' },
    { key: 'attendees', label: 'Pax' },
    { key: 'catering', label: 'Catering' },
    { key: 'audioVisual', label: 'AV' },
    { key: 'decoration', label: 'Decoration' },
    { key: 'status', label: 'Status' },
  ],
  halls: [
    { key: 'name', label: 'Hall' },
    { key: 'type', label: 'Type' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'status', label: 'Status' },
    { key: 'price', label: 'Price / day' },
  ],
  catering: [
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price' },
    { key: 'minimumOrder', label: 'Min order', defaultVisible: false },
    { key: 'available', label: 'Available' },
  ],
  proformas: [
    { key: 'invoiceNumber', label: 'Proforma' },
    { key: 'date', label: 'Date' },
    { key: 'validUntil', label: 'Valid until' },
    { key: 'customer', label: 'Customer name' },
    { key: 'description', label: 'Description' },
    { key: 'total', label: 'Quoted' },
    { key: 'status', label: 'Status' },
  ],
  outstanding: INVOICE_COLUMNS,
  invoices: INVOICE_COLUMNS,
  receipts: [
    { key: 'paymentNumber', label: 'Receipt' },
    { key: 'date', label: 'Date' },
    { key: 'invoiceNumber', label: 'Invoice' },
    { key: 'amount', label: 'Amount' },
    { key: 'paymentMethod', label: 'Method' },
    { key: 'status', label: 'Status' },
    { key: 'reference', label: 'Reference', defaultVisible: false },
  ],
};

type EventBookingRow = {
  id: string;
  title: string;
  organizer: string;
  hallId: string;
  hallName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  attendees: number;
  status: string;
  type: string;
  catering: boolean;
  audioVisual: boolean;
  decoration: boolean;
  totalCost: number;
  quoteNumber?: string;
  quoteBudget?: { accommodation: number; conference: number; dinner: number; lunch: number; extras: number; total?: number };
  particularLabels?: { rooms?: string; dinnerPax?: string; lunchPax?: string; conferencePax?: string };
  combinedPackage?: boolean;
  residential?: boolean;
};

function bookingReportStatus(row: { status?: string; completionStatus?: string }) {
  const completion = statusOf(row.completionStatus);
  if (completion === 'completed') return 'completed';
  if (completion === 'billed') return 'invoiced';
  return statusOf(row.status) || '—';
}

function explodeParticulars(row: EventBookingRow) {
  const budget = row.quoteBudget;
  if (!budget) return [];
  const labels = row.particularLabels || {};
  const base = {
    title: row.title,
    organizer: row.organizer,
    hallName: row.hallName,
    startDate: row.startDate,
    status: row.status,
  };
  if (row.combinedPackage) {
    const packageAmount = Number(budget.conference || budget.total || row.totalCost || 0);
    const rows = packageAmount > 0
      ? [{ ...base, particular: labels.conferencePax || 'Package', amount: packageAmount }]
      : [];
    if (row.residential && Number(budget.accommodation || 0) > 0) {
      rows.push({ ...base, particular: labels.rooms || 'Accommodation', amount: Number(budget.accommodation) });
    }
    return rows;
  }
  const items: Array<{ key: keyof typeof budget; label: string }> = [
    { key: 'dinner', label: labels.dinnerPax || 'Dinner' },
    { key: 'accommodation', label: labels.rooms || 'Accommodation' },
    { key: 'conference', label: labels.conferencePax || 'Conference' },
    { key: 'lunch', label: labels.lunchPax || 'Lunch' },
    { key: 'extras', label: 'Extras' },
  ];
  return items
    .filter((item) => item.key !== 'total' && Number(budget[item.key] || 0) > 0)
    .map((item) => ({
      ...base,
      particular: item.label,
      amount: Number(budget[item.key] || 0),
    }));
}

export default function EventsReportsAnalysis() {
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('events');
  const [selectedReport, setSelectedReport] = useState('on-site');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportDateMode, setReportDateMode] = useState<'today' | 'specific' | 'range'>('today');
  const [isGenerating, setIsGenerating] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [reportNotes, setReportNotes] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [hiddenKpisByReport, setHiddenKpisByReport] = useState<Record<string, string[]>>({});
  const [hiddenColumnsByReport, setHiddenColumnsByReport] = useState<Record<string, string[]>>({});
  const [mounted, setMounted] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [bookings, setBookings] = useState<EventBookingRow[]>([]);
  const [halls, setHalls] = useState<any[]>([]);
  const [catering, setCatering] = useState<any[]>([]);

  const settings = useSettingsStore();
  const orgProfile = buildOrgProfile(settings);
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  const initializeAccounting = useAccountingStore((s) => s.initializeAccounting);
  const invoices = useAccountingStore((s) => s.invoices);
  const payments = useAccountingStore((s) => s.payments);
  const businessPartners = useAccountingStore((s) => s.businessPartners);

  const liveEventIds = useMemo(() => bookings.map((row) => row.id).filter(Boolean), [bookings]);

  const conferenceDocuments = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          invoice.type === 'Sales' &&
          invoice.status !== 'Void' &&
          isConferenceInvoice(invoice as any) &&
          conferenceDocBelongsToLiveEvent(invoice as any, liveEventIds)
      ),
    [invoices, liveEventIds]
  );
  const conferenceInvoices = useMemo(
    () => conferenceDocuments.filter((invoice) => !isProformaDoc(invoice as any) && isPostedSalesInvoice(invoice)),
    [conferenceDocuments]
  );
  const postedInvoiceEventIds = useMemo(() => {
    const ids = new Set<string>();
    for (const invoice of conferenceInvoices) {
      const eventId = invoiceEventKey(invoice as any);
      if (eventId) ids.add(eventId);
    }
    return ids;
  }, [conferenceInvoices]);
  const conferenceProformas = useMemo(
    () =>
      conferenceDocuments.filter((invoice) => {
        if (!isProformaDoc(invoice as any)) return false;
        if (statusOf(invoice.status) === 'converted') return false;
        if (postedInvoiceEventIds.size && conferenceDocBelongsToLiveEvent(invoice as any, postedInvoiceEventIds)) {
          return false;
        }
        return true;
      }),
    [conferenceDocuments, postedInvoiceEventIds]
  );
  const conferenceInvoiceIds = useMemo(() => new Set(conferenceInvoices.map((invoice) => invoice.id)), [conferenceInvoices]);
  const invoiceNumberSequence = useMemo(
    () =>
      buildIdSequence(
        sortIdsByDate(
          conferenceInvoices,
          (invoice) => String(invoice.id || ''),
          (invoice) => String(invoice.date || invoice.issueDate || '')
        )
      ),
    [conferenceInvoices]
  );
  const proformaNumberSequence = useMemo(
    () =>
      buildIdSequence(
        sortIdsByDate(
          conferenceProformas,
          (invoice) => String(invoice.id || ''),
          (invoice) => String(invoice.date || invoice.issueDate || '')
        )
      ),
    [conferenceProformas]
  );
  const reportBookings = bookings;
  const reportHalls = useMemo(() => {
    if (halls.length) return halls;
    const named = Array.from(new Set(reportBookings.map((row) => row.hallName).filter((name) => name && name !== '—')));
    return named.map((name) => ({ id: name, name, type: '—', capacity: 0, status: '—', price: 0 }));
  }, [halls, reportBookings]);
  const conferenceReceipts = useMemo(
    () =>
      payments.filter(
        (payment) =>
          payment.type === 'Receipt' &&
          payment.status !== 'Void' &&
          (conferenceInvoiceIds.has(payment.invoiceId || '') ||
            (statusOf(payment.sourceModule) === 'conference' &&
              conferenceDocBelongsToLiveEvent(payment as any, liveEventIds)))
      ),
    [payments, conferenceInvoiceIds, liveEventIds]
  );
  const receiptNumberSequence = useMemo(
    () =>
      buildIdSequence(
        sortIdsByDate(
          conferenceReceipts,
          (payment) => String(payment.id || ''),
          (payment) => String(payment.date || '')
        )
      ),
    [conferenceReceipts]
  );

  const hydrateEvents = async () => {
    await initializeAccounting().catch(() => {});
    const [bookingRows, hallRows, cateringRows] = await Promise.all([
      fetchEventBookings(),
      fetchConferenceHalls(),
      fetchCateringItems(),
    ]);
    setBookings(
      (bookingRows || []).map((row: any) => {
        const details = row?.details && typeof row.details === 'object' ? row.details : {};
        return {
          id: row.id,
          title: row.title || row.eventName || 'Unnamed',
          organizer: row.organizer || row.organization || '—',
          hallId: row.hallId || '',
          hallName: row.hallName || row.venueName || '—',
          startDate: dayOf(row.startDate || row.arrivalDate),
          endDate: dayOf(row.endDate || row.departureDate),
          startTime: row.startTime || '—',
          endTime: row.endTime || '—',
          attendees: Number(row.attendees || row.pax || 0),
          status: bookingReportStatus({ status: row.status, completionStatus: details.completionStatus }),
          type: row.type || row.eventType || '—',
          catering: Boolean(row.catering),
          audioVisual: Boolean(row.audioVisual),
          decoration: Boolean(row.decoration),
          totalCost: Number(row.totalCost || row.revenue || row.budgetTotal || 0),
          quoteNumber: details.quoteNumber || row.quoteNumber,
          quoteBudget: bookingQuoteBudget(row),
          particularLabels: details.particularLabels || row.particularLabels,
          combinedPackage: Boolean(details.combinedPackage ?? (details.ratesByParticulars === false)),
          residential: Boolean(details.residential),
        };
      })
    );
    setHalls(hallRows || []);
    setCatering(cateringRows || []);
    const liveIds = (bookingRows || []).map((row: any) => String(row.id || '')).filter(Boolean);
    if (liveIds.length) {
      await retireOrphanConferenceInvoices(liveIds).catch(() => {});
    }
  };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('events.report-summary-preferences');
      if (saved) setHiddenKpisByReport(JSON.parse(saved));
      const savedColumns = localStorage.getItem('events.report-column-preferences');
      if (savedColumns) setHiddenColumnsByReport(JSON.parse(savedColumns));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    hydrateEvents().catch(() => {});
    initializeAccounting().catch(() => {});
  }, [initializeAccounting]);
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, selectedTab, startDate, endDate, refreshVersion, bookings, halls, catering, invoices, payments]);
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

  const handleTabChange = (key: React.Key) => {
    const groupKey = key as ReportGroupKey;
    setSelectedTab(groupKey);
    setSelectedReport(REPORT_GROUPS[groupKey].reports[0][0]);
  };
  const handleRefresh = () => {
    Promise.all([hydrateEvents(), initializeAccounting()]).then(() => {
      setRefreshVersion((v) => v + 1);
      setGeneratedAt(new Date().toLocaleString('en-GH'));
    }).catch(() => setRefreshVersion((v) => v + 1));
  };

  const overlappingBookings = (statusCheck?: (status: string) => boolean) =>
    reportBookings
      .filter((row) => overlapsPeriod(row.startDate, row.endDate, startDate, endDate))
      .filter((row) => !statusCheck || statusCheck(statusOf(row.status)));

  const mapInvoice = (row: (typeof conferenceInvoices)[number]) => ({
    invoiceNumber: sequenceLabel('INV', row.id, invoiceNumberSequence),
    date: dayOf(row.date),
    customer: invoiceCustomerName(row as any, businessPartners),
    description: invoiceDescription(row as any, bookings),
    total: Number(row.total || 0),
    paidAmount: Number(row.paidAmount || 0),
    balance: Number(row.total || 0) - Number(row.paidAmount || 0),
    status: row.status,
  });

  const getCurrentReportData = () => {
    switch (selectedReport) {
      case 'on-site':
        return overlappingBookings((status) => isOnSiteStatus(status));
      case 'arriving':
        return reportBookings.filter((row) => inDateRange(row.startDate, startDate, endDate) && !isCancelledStatus(statusOf(row.status)));
      case 'departing':
        return reportBookings.filter((row) => inDateRange(row.endDate, startDate, endDate) && !isCancelledStatus(statusOf(row.status)));
      case 'pending':
        return overlappingBookings(isPendingStatus);
      case 'cancelled':
        return overlappingBookings(isCancelledStatus);
      case 'particulars':
        return overlappingBookings().flatMap(explodeParticulars);
      case 'hall-diary': {
        const live = overlappingBookings((status) => !isCancelledStatus(status));
        const listedHalls = reportHalls.length
          ? reportHalls
          : Array.from(new Set(live.map((row) => row.hallName).filter((name) => name && name !== '—'))).map((name) => ({
              id: name,
              name,
              type: '—',
              capacity: 0,
              status: '—',
              price: 0,
            }));
        return listedHalls.map((hall) => {
          const matches = live.filter((row) =>
            (hall.id && row.hallId && row.hallId === hall.id) || row.hallName === hall.name
          );
          return {
            name: hall.name,
            type: hall.type && hall.type !== '—' ? hall.type : '—',
            capacity: Number(hall.capacity || 0) || '—',
            events: matches.length,
            attendees: matches.reduce((sum, row) => sum + Number(row.attendees || 0), 0),
            totalCost: matches.reduce((sum, row) => sum + Number(row.totalCost || 0), 0),
            status: hall.status && hall.status !== '—' ? hall.status : '—',
          };
        });
      }
      case 'services':
        return overlappingBookings((status) => !isCancelledStatus(status));
      case 'halls':
        return reportHalls.map((row) => ({
          name: row.name,
          type: row.type && row.type !== '—' ? row.type : '—',
          capacity: Number(row.capacity || 0) || '—',
          status: row.status && row.status !== '—' ? row.status : '—',
          price: Number(row.price || 0) || '—',
        }));
      case 'catering':
        return catering.map((row) => ({
          name: row.name,
          category: row.category || '—',
          price: Number(row.price || 0),
          minimumOrder: row.minimumOrder ?? '—',
          available: row.available !== false,
        }));
      case 'proformas': {
        const posted = conferenceProformas
          .filter((row) => inDateRange(dayOf(row.date), startDate, endDate))
          .map((row) => ({
            invoiceNumber: sequenceLabel('Q', row.id, proformaNumberSequence),
            date: dayOf(row.date),
            validUntil: dayOf(row.dueDate) || '—',
            customer: invoiceCustomerName(row as any, businessPartners),
            description: invoiceDescription(row as any, bookings),
            total: Number(row.total || 0),
            status: row.status,
          }));
        if (posted.length) return posted;
        return reportBookings
          .filter((row) => inDateRange(row.startDate, startDate, endDate))
          .filter((row) => isPendingStatus(statusOf(row.status)))
          .map((row) => ({
            invoiceNumber: row.quoteNumber || row.id,
            date: row.startDate,
            validUntil: '—',
            customer: row.organizer,
            description: row.hallName && row.hallName !== '—' ? `${row.title} — ${row.hallName}` : row.title,
            total: Number(row.totalCost || 0),
            status: isPendingStatus(statusOf(row.status)) ? 'Quote' : 'Quoted',
          }));
      }
      case 'outstanding':
        return conferenceInvoices
          .filter((row) => inDateRange(dayOf(row.date), startDate, endDate))
          .map(mapInvoice)
          .filter((row) => row.balance > 0);
      case 'invoices':
        return conferenceInvoices
          .filter((row) => inDateRange(dayOf(row.date), startDate, endDate))
          .map(mapInvoice);
      case 'receipts':
        return conferenceReceipts
          .filter((row) => inDateRange(dayOf(row.date), startDate, endDate))
          .map((row) => ({
            paymentNumber: sequenceLabel('RCP', row.id, receiptNumberSequence),
            date: dayOf(row.date),
            invoiceNumber: sequenceLabel(
              'INV',
              conferenceInvoices.find((invoice) => invoice.id === row.invoiceId)?.id,
              invoiceNumberSequence
            ),
            amount: Number(row.amount || 0),
            paymentMethod: paymentMethodLabel(row.paymentMethod),
            status: row.status,
            reference: row.reference || '—',
          }));
      default:
        return [];
    }
  };

  const reportData = mounted ? getCurrentReportData() : null;
  const rawRows = (Array.isArray(reportData) ? reportData : []) as Record<string, any>[];
  const fieldValue = (row: Record<string, any>, keys: string[]) => {
    const value = keys.map((key) => row[key]).find((candidate) => candidate !== undefined && candidate !== null && candidate !== '');
    return value === undefined ? '' : String(value);
  };
  const uniqueValues = (keys: string[]) =>
    Array.from(new Set(rawRows.map((row) => fieldValue(row, keys)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const filterOptions = {
    status: uniqueValues(['status']),
    type: uniqueValues(['type']),
    staff: uniqueValues(['organizer', 'customer']),
    category: uniqueValues(['hallName', 'category']),
    method: uniqueValues(['paymentMethod']),
    particular: uniqueValues(['particular']),
  };
  const rows = rawRows.filter((row) => {
    const query = filters.query.trim().toLocaleLowerCase();
    const matchesQuery = !query || Object.values(row).some((value) => {
      const searchable = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      return searchable.toLocaleLowerCase().includes(query);
    });
    return matchesQuery
      && (filters.status === 'all' || fieldValue(row, ['status']) === filters.status)
      && (filters.type === 'all' || fieldValue(row, ['type']) === filters.type)
      && (filters.staff === 'all' || fieldValue(row, ['organizer', 'customer']) === filters.staff)
      && (filters.category === 'all' || fieldValue(row, ['hallName', 'category']) === filters.category)
      && (filters.method === 'all' || fieldValue(row, ['paymentMethod']) === filters.method)
      && (filters.particular === 'all' || fieldValue(row, ['particular']) === filters.particular);
  });
  const filteredReportData = Array.isArray(reportData) ? rows : reportData;
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === 'query' ? Boolean(value.trim()) : value !== 'all').length;
  const facetDefinitions = ([
    { key: 'status', label: 'Status', options: filterOptions.status },
    { key: 'type', label: 'Type', options: filterOptions.type },
    { key: 'staff', label: 'Organizer', options: filterOptions.staff },
    { key: 'category', label: 'Place', options: filterOptions.category },
    { key: 'method', label: 'Method', options: filterOptions.method },
    { key: 'particular', label: 'Particular', options: filterOptions.particular },
  ] satisfies { key: Exclude<keyof ReportFilters, 'query'>; label: string; options: string[] }[])
    .filter((definition) => definition.options.length > 0);

  const availableColumns = REPORT_COLUMNS[selectedReport] || Object.keys(rawRows[0] || {}).map((key) => ({ key, label: labelize(key) }));
  const hasSavedColumnPreference = Object.prototype.hasOwnProperty.call(hiddenColumnsByReport, selectedReport);
  const hiddenColumnKeys = hasSavedColumnPreference
    ? hiddenColumnsByReport[selectedReport]
    : availableColumns.filter((column) => column.defaultVisible === false).map((column) => column.key);
  const visibleColumns = availableColumns.filter((column) => !hiddenColumnKeys.includes(column.key));
  const saveColumnPreferences = (hiddenKeys: string[]) => {
    const next = { ...hiddenColumnsByReport, [selectedReport]: hiddenKeys };
    setHiddenColumnsByReport(next);
    try { localStorage.setItem('events.report-column-preferences', JSON.stringify(next)); } catch { /* ignore */ }
  };
  const exportableReportData = Array.isArray(filteredReportData)
    ? rows.map((row) => Object.fromEntries(visibleColumns.map((column) => [column.label, row[column.key]])))
    : filteredReportData;
  const reportLabel = REPORT_GROUPS[selectedTab].reports.find(([key]) => key === selectedReport)?.[1]
    || selectedReport.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const reportKpis = useMemo(() => {
    const count = rows.length;
    const storedValue = rows.reduce((sum, row) => sum + Number(row.totalCost || row.total || row.amount || row.price || 0), 0);
    const attendees = rows.reduce((sum, row) => sum + Number(row.attendees || 0), 0);
    if (selectedReport === 'hall-diary') {
      const busy = rows.filter((row) => Number(row.events || 0) > 0);
      return [
        { label: 'Halls', value: count.toLocaleString(), hint: 'On the diary' },
        { label: 'In use', value: busy.length.toLocaleString(), hint: 'At least one booking' },
        { label: 'Events', value: rows.reduce((sum, row) => sum + Number(row.events || 0), 0).toLocaleString(), hint: 'Stored bookings' },
        { label: 'Pax', value: rows.reduce((sum, row) => sum + Number(row.attendees || 0), 0).toLocaleString(), hint: 'Stored attendees' },
      ];
    }
    if (selectedReport === 'particulars') {
      const kinds = new Set(rows.map((row) => String(row.particular || '')).filter(Boolean));
      return [
        { label: 'Lines', value: count.toLocaleString(), hint: 'Stored particulars' },
        { label: 'Amount', value: money(storedValue), hint: 'Quoted split' },
        { label: 'Particulars', value: kinds.size.toLocaleString(), hint: 'Kinds in view' },
        { label: 'Period', value: startDate === endDate ? startDate : `${startDate} – ${endDate}`, hint: 'Selected' },
      ];
    }
    if (selectedReport === 'services') {
      return [
        { label: 'Events', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Catering', value: rows.filter((row) => row.catering).length.toLocaleString(), hint: 'Flag stored yes' },
        { label: 'AV', value: rows.filter((row) => row.audioVisual).length.toLocaleString(), hint: 'Flag stored yes' },
        { label: 'Decoration', value: rows.filter((row) => row.decoration).length.toLocaleString(), hint: 'Flag stored yes' },
      ];
    }
    if (selectedReport === 'halls') {
      return [
        { label: 'Halls', value: count.toLocaleString(), hint: 'On file' },
        { label: 'Available', value: rows.filter((row) => statusOf(row.status) === 'available').length.toLocaleString(), hint: 'Stored status' },
        { label: 'Booked', value: rows.filter((row) => statusOf(row.status) === 'booked').length.toLocaleString(), hint: 'Stored status' },
        { label: 'Capacity', value: rows.reduce((sum, row) => sum + numericOrZero(row.capacity), 0).toLocaleString(), hint: 'Listed seats' },
      ];
    }
    if (selectedReport === 'catering') {
      return [
        { label: 'Items', value: count.toLocaleString(), hint: 'On file' },
        { label: 'Available', value: rows.filter((row) => row.available !== false).length.toLocaleString(), hint: 'Listed available' },
        { label: 'Period', value: 'Current', hint: 'File, not dates' },
        { label: 'Status', value: 'Current', hint: generatedAt ? `Refreshed ${generatedAt}` : 'Preparing report' },
      ];
    }
    if (selectedReport === 'proformas') {
      const open = rows.filter((row) => statusOf(row.status) === 'draft' || statusOf(row.status) === 'posted');
      return [
        { label: 'Proformas', value: count.toLocaleString(), hint: 'Conference quotes' },
        { label: 'Quoted', value: money(storedValue), hint: 'Stored total' },
        { label: 'Open', value: open.length.toLocaleString(), hint: 'Not void' },
        { label: 'Period', value: startDate === endDate ? startDate : `${startDate} – ${endDate}`, hint: 'Selected' },
      ];
    }
    if (selectedReport === 'outstanding' || selectedReport === 'invoices') {
      const paid = rows.reduce((sum, row) => sum + Number(row.paidAmount || 0), 0);
      const balance = rows.reduce((sum, row) => sum + Number(row.balance || 0), 0);
      return [
        { label: 'Invoices', value: count.toLocaleString(), hint: 'Posted conference invoices' },
        { label: 'Total', value: money(storedValue), hint: 'Stored invoice total' },
        { label: 'Paid', value: money(paid), hint: 'Stored amount paid' },
        { label: 'Balance', value: money(balance), hint: 'Total minus paid' },
      ];
    }
    if (selectedReport === 'receipts') {
      return [
        { label: 'Receipts', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Collected', value: money(storedValue), hint: 'Stored amount' },
        { label: 'Posted', value: rows.filter((row) => statusOf(row.status) === 'posted').length.toLocaleString(), hint: 'Receipt status' },
        { label: 'Period', value: startDate === endDate ? startDate : `${startDate} – ${endDate}`, hint: 'Selected' },
      ];
    }
    return [
      { label: 'Events', value: count.toLocaleString(), hint: 'In period' },
      { label: 'Pax', value: attendees.toLocaleString(), hint: 'Stored attendees' },
      { label: 'Value', value: money(storedValue), hint: 'Stored total' },
      { label: 'Period', value: startDate === endDate ? startDate : `${startDate} – ${endDate}`, hint: 'Selected' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshVersion, mounted, filters, bookings, halls, catering, invoices, payments, conferenceProformas, conferenceInvoices, reportBookings, reportHalls]);

  const hiddenKpiLabels = hiddenKpisByReport[selectedReport] || [];
  const visibleReportKpis = reportKpis.filter((kpi) => !hiddenKpiLabels.includes(kpi.label));
  const saveKpiPreferences = (hiddenLabels: string[]) => {
    const next = { ...hiddenKpisByReport, [selectedReport]: hiddenLabels };
    setHiddenKpisByReport(next);
    try { localStorage.setItem('events.report-summary-preferences', JSON.stringify(next)); } catch { /* ignore */ }
  };
  const summaryCustomizationControls = (
    <>
      {hiddenKpiLabels.length > 0 && (
        <Button size="sm" variant="light" startContent={<RotateCcw size={14} />} onPress={() => saveKpiPreferences([])}>Restore metrics</Button>
      )}
      <Dropdown closeOnSelect={false}>
        <DropdownTrigger>
          <Button size="sm" variant="bordered" startContent={<SlidersHorizontal size={14} />}>Customize summary</Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Choose summary metrics" selectionMode="multiple" selectedKeys={new Set(visibleReportKpis.map((kpi) => kpi.label))} onSelectionChange={(keys) => {
          const visibleLabels = keys === 'all' ? reportKpis.map((kpi) => kpi.label) : Array.from(keys).map(String);
          saveKpiPreferences(reportKpis.filter((kpi) => !visibleLabels.includes(kpi.label)).map((kpi) => kpi.label));
        }}>
          {reportKpis.map((kpi) => <DropdownItem key={kpi.label}>{kpi.label}</DropdownItem>) as any}
        </DropdownMenu>
      </Dropdown>
    </>
  );

  const handleExportReport = async (data: unknown, format: 'pdf' | 'excel' | 'csv') => {
    setIsGenerating(true);
    try {
      const extension = format === 'excel' ? 'xls' : format;
      const filename = `${selectedReport}_report_${startDate}.${extension}`;
      const generatedLabel = generatedAt ? `Generated on ${generatedAt} by ${currentUserLabel}` : undefined;
      const sections = reportDataToSections(data);
      const blob = format === 'csv'
        ? new Blob([sectionsToCSV(sections, orgProfile, generatedLabel)], { type: 'text/csv' })
        : format === 'excel'
        ? new Blob([sectionsToExcelHtml(reportLabel, sections, orgProfile, generatedLabel)], { type: 'application/vnd.ms-excel' })
        : await sectionsToPdfBlob(reportLabel, sections, orgProfile, generatedLabel);
      const fileUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(fileUrl);
    } finally {
      setIsGenerating(false);
    }
  };

  const moneyColumn = /(cost|amount|total|price|balance|paid|value)/i;
  const renderReportTable = () => {
    if (!mounted || reportData === null) {
      return <div className="py-8 text-center"><p className="text-gray-500">Preparing report…</p></div>;
    }
    if (rows.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-gray-500">{activeFilterCount > 0 ? 'No records match the active filters. Clear or adjust the filters to continue.' : 'No data available for the selected report and date.'}</p>
        </div>
      );
    }
    return (
      <Table aria-label={`${selectedReport} report table`} classNames={{ base: 'overflow-x-auto', table: 'min-w-max' }}>
        <TableHeader>
          {visibleColumns.map((column) => <TableColumn key={column.key}>{column.label}</TableColumn>)}
        </TableHeader>
        <TableBody>
          {rows.map((row: any, index: number) => (
            <TableRow key={index}>
              {visibleColumns.map((column) => (
                <TableCell key={column.key}>
                  {typeof row[column.key] === 'number' && moneyColumn.test(column.key)
                    ? money(row[column.key])
                    : typeof row[column.key] === 'boolean'
                    ? (row[column.key] ? 'Yes' : 'No')
                    : formatReportValue(row[column.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const showDateControls = !NO_DATE_REPORT_KEYS.has(selectedReport);
  const rangeAllowed = RANGE_REPORT_KEYS.has(selectedReport);

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <BarChart3 size={18} />
              EVENTS INTELLIGENCE
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Reports & Analysis</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Arrivals, halls in use, and conference invoices on file. No occupancy or conversion score is invented here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="flat" startContent={<RefreshCw size={16} />} onPress={handleRefresh}>Refresh</Button>
            <Button variant="bordered" startContent={<StickyNote size={16} />} onPress={onOpen}>Notes</Button>
            <Button variant="bordered" startContent={<Printer size={16} />} onPress={() => window.print()}>Print</Button>
            <Dropdown>
              <DropdownTrigger>
                <Button color="primary" startContent={<ArrowDownToLine size={16} />} isLoading={isGenerating}>Export</Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Export report">
                <DropdownItem key="pdf" startContent={<FileText size={16} />} onPress={() => handleExportReport(exportableReportData, 'pdf')}>Download PDF</DropdownItem>
                <DropdownItem key="excel" startContent={<FileSpreadsheet size={16} />} onPress={() => handleExportReport(exportableReportData, 'excel')}>Download Excel</DropdownItem>
                <DropdownItem key="csv" startContent={<ArrowDownToLine size={16} />} onPress={() => handleExportReport(exportableReportData, 'csv')}>Download CSV</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        <Card className="border border-slate-200 shadow-sm">
          <CardBody className="gap-4 p-4">
            <Tabs selectedKey={selectedTab} onSelectionChange={handleTabChange} aria-label="Report categories" color="primary" variant="underlined" classNames={{ tabList: 'gap-5', cursor: 'w-full', tab: 'px-0 h-10' }}>
              {Object.entries(REPORT_GROUPS).map(([key, group]) => <Tab key={key} title={group.title} />)}
            </Tabs>
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
              <Select label="Report" selectedKeys={[selectedReport]} onSelectionChange={(keys) => {
                const next = Array.from(keys)[0] as string;
                const allowed = REPORT_GROUPS[selectedTab].reports.map(([key]) => key);
                if (next && allowed.includes(next)) setSelectedReport(next);
              }} startContent={<TrendingUp size={16} className="text-slate-400" />}>
                {REPORT_GROUPS[selectedTab].reports.map(([key, label]) => <SelectItem key={key} textValue={label}>{label}</SelectItem>)}
              </Select>
              {showDateControls && (
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
                        disabled={mode === 'range' && !rangeAllowed}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          reportDateMode === mode
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : mode === 'range' && !rangeAllowed
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400'
                        }`}
                      >
                        {mode === 'today' ? 'Today' : mode === 'specific' ? 'Specific date' : 'Date range'}
                      </button>
                    ))}
                    {reportDateMode === 'specific' && (
                      <Input aria-label="Report date" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setEndDate(event.target.value); }} className="w-44" size="sm" />
                    )}
                    {reportDateMode === 'range' && rangeAllowed && (
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
            {rawRows.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Search report results" placeholder="Event, organizer, hall, invoice..." value={filters.query} onValueChange={(query) => setFilters((current) => ({ ...current, query }))} startContent={<Search size={16} className="text-slate-400" />} size="sm" className="w-full sm:w-64 lg:w-72" />
                  {facetDefinitions.length > 0 && (
                    <Button size="sm" variant={filtersExpanded ? 'solid' : 'bordered'} color={filtersExpanded ? 'primary' : 'default'} startContent={<Filter size={14} />} onPress={() => setFiltersExpanded((expanded) => !expanded)}>
                      Filters{activeFilterCount > (filters.query ? 1 : 0) ? ` (${activeFilterCount - (filters.query ? 1 : 0)})` : ''}
                    </Button>
                  )}
                  {facetDefinitions.filter((definition) => filters[definition.key] !== 'all').map((definition) => (
                    <Chip key={definition.key} size="sm" variant="flat" color="primary" onClose={() => setFilters((current) => ({ ...current, [definition.key]: 'all' }))}>
                      {definition.label}: {filters[definition.key]}
                    </Chip>
                  ))}
                  <span className="ml-auto text-xs text-slate-500">Showing {rows.length} of {rawRows.length}</span>
                  {activeFilterCount > 0 && (
                    <Button size="sm" variant="light" color="danger" startContent={<X size={14} />} onPress={() => { setFilters(EMPTY_REPORT_FILTERS); setFiltersExpanded(false); }}>Clear</Button>
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
                )) : <p className="pr-4 text-sm text-slate-500">All summary metrics are hidden.</p>}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-slate-200 pl-4">{summaryCustomizationControls}</div>
            </div>
          </CardBody>
        </Card>

        <Card id="report-print-area" className="border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col items-start gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-950">{reportLabel}</h2>
                <Chip size="sm" color="primary" variant="flat">{REPORT_GROUPS[selectedTab].title}</Chip>
              </div>
              <p className="mt-1 text-sm text-slate-500">{REPORT_DESCRIPTIONS[selectedReport]}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-left text-xs text-slate-500 sm:text-right">
                <div>{NO_DATE_REPORT_KEYS.has(selectedReport) ? 'Current file' : startDate === endDate ? startDate : `${startDate} – ${endDate}`}</div>
                <div>Generated {generatedAt ?? '…'} by {currentUserLabel}</div>
              </div>
              {Array.isArray(reportData) && availableColumns.length > 0 && (
                <Dropdown closeOnSelect={false}>
                  <DropdownTrigger>
                    <Button size="sm" variant="bordered" startContent={<SlidersHorizontal size={14} />}>Columns</Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Choose table columns" selectionMode="multiple" disallowEmptySelection selectedKeys={new Set(visibleColumns.map((column) => column.key))} onSelectionChange={(keys) => {
                    const selected = keys === 'all' ? availableColumns.map((column) => column.key) : Array.from(keys).map(String);
                    saveColumnPreferences(availableColumns.filter((column) => !selected.includes(column.key)).map((column) => column.key));
                  }}>
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
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>Add Report Notes</ModalHeader>
          <ModalBody>
            <Textarea label="Report Notes" placeholder="Add any additional notes or observations about this report..." value={reportNotes} onChange={(event) => setReportNotes(event.target.value)} minRows={4} />
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>Cancel</Button>
            <Button color="primary" onPress={onClose}>Save Notes</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
