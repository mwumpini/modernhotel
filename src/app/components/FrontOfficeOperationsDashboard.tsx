'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, Textarea,
  Tabs, Tab, Divider, Accordion, AccordionItem, Checkbox
} from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { housekeepingStore } from '../lib/housekeeping/store';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import type { Reservation } from '../lib/frontoffice/types';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  action: () => void;
  requiresModule?: string;
}

type ReportFilterConfig = {
  voucherType?: boolean;
  user?: boolean;
  room?: boolean;
  dateRange?: boolean;
  service?: boolean;
  costCenters?: boolean;
  notes?: boolean;
};

interface ReportDefinition {
  key: string;
  label: string;
  description: string;
  metrics: string[];
  filters: ReportFilterConfig;
}

interface ReportCategory {
  key: string;
  label: string;
  icon: string;
  description: string;
  reports: ReportDefinition[];
}

type ReportLogLevel = 'info' | 'success' | 'warning';

interface ReportLogEntry {
  id: string;
  timestamp: string;
  level: ReportLogLevel;
  action: string;
  context?: string;
}

interface ReportFiltersState {
  voucherType: string;
  user: string;
  room: string;
  fromDate: string;
  toDate: string;
  service: string;
  notes: string;
}

const REPORT_LOG_COLOR: Record<ReportLogLevel, 'primary' | 'success' | 'warning'> = {
  info: 'primary',
  success: 'success',
  warning: 'warning'
};

const REPORT_VOUCHER_TYPES = [
  { label: 'All Vouchers', value: 'all' },
  { label: 'Service Receipt', value: 'service-receipt' },
  { label: 'Pro-Forma / Invoice', value: 'invoice' },
  { label: 'Credit Note', value: 'credit-note' },
  { label: 'Adjustment Voucher', value: 'adjustment' }
];

const FALLBACK_COST_CENTERS = [
  { label: 'Conference', value: 'CONFERENCE' },
  { label: 'Front Desk', value: 'FRONT_DESK' },
  { label: 'Gift Shop', value: 'GIFT_SHOP' },
  { label: 'Housekeeping', value: 'HOUSEKEEPING' },
  { label: 'Kitchen', value: 'KITCHEN' },
  { label: 'Restaurant', value: 'RESTAURANT' },
  { label: 'Stores', value: 'STORES' },
  { label: 'Swimming Pool', value: 'SWIMMING_POOL' }
];

const SERVICE_REPORT_OPTIONS = [
  { label: 'Airport Shuttle', value: 'airport-shuttle' },
  { label: 'Conference Equipment Rental', value: 'conference-equipment' },
  { label: 'Banquet Service', value: 'banquet-service' },
  { label: 'Spa & Wellness', value: 'spa-wellness' },
  { label: 'Laundry & Valet', value: 'laundry' },
  { label: 'Restaurant À La Carte', value: 'restaurant-a-la-carte' }
];

const getDefaultReportRange = () => {
  const today = new Date();
  const to = today.toISOString().split('T')[0];
  const from = new Date(today);
  from.setDate(from.getDate() - 7);
  return { from: from.toISOString().split('T')[0], to };
};

const buildInitialReportFilters = (): ReportFiltersState => {
  const range = getDefaultReportRange();
  return {
    voucherType: REPORT_VOUCHER_TYPES[0]?.value || 'all',
    user: '',
    room: '',
    fromDate: range.from,
    toDate: range.to,
    service: SERVICE_REPORT_OPTIONS[0]?.value || '',
    notes: ''
  };
};

const FRONT_OFFICE_REPORT_CATALOG: ReportCategory[] = [
  {
    key: 'front-office',
    label: 'Front Office Reports',
    icon: '🛎️',
    description: 'Room operations, arrivals, departures, and cashier analytics.',
    reports: [
      {
        key: 'checkin-daybook',
        label: 'Checkin DayBook',
        description: 'Chronological log of all arrivals with booking status and remarks.',
        metrics: ['Arrivals vs expected', 'Early / late check-ins', 'Pending registrations'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'cancelled-checkin',
        label: 'Cancelled Checkin',
        description: 'Audit trail of cancelled arrivals with user, reason, and revenue impact.',
        metrics: ['Cancelled bookings', 'Loss value', 'Responsible agent'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'daily-statement',
        label: 'Daily Statement',
        description: 'End-of-day cashier statement consolidating all transactions.',
        metrics: ['Cash vs non-cash mix', 'Variance alerts', 'Pending approvals'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'daily-statement-columnar',
        label: 'Daily Statement Columnar',
        description: 'Columnar version of the daily statement for finance validation.',
        metrics: ['Payment mode split', 'Tax collected', 'Night audit status'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'tariff-summary',
        label: 'Tariff Summary',
        description: 'Snapshot of rack, BAR, and negotiated rates by room class.',
        metrics: ['Rate variance', 'Dynamic pricing overrides', 'Promo utilisation'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'daily-room-occupancy-chart',
        label: 'Daily Room Occupancy Chart',
        description: 'Graphical occupancy trend by block, segment, and status.',
        metrics: ['Occupancy %', 'Sold vs available rooms', 'Market mix'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'daily-room-status',
        label: 'Daily Room Status',
        description: 'Live status board for each room including HK and maintenance flags.',
        metrics: ['Ready vs dirty rooms', 'OOS rooms', 'Turnaround time'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'daily-room-status-category',
        label: 'Daily Room Status Category',
        description: 'Status distribution aggregated by room category.',
        metrics: ['Category occupancy', 'VIP readiness', 'Upgrade potential'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'daily-fo-report',
        label: 'Daily FO Report',
        description: 'Executive summary of Front Office KPIs for leadership.',
        metrics: ['ADR', 'RevPAR', 'Guest movements'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'room-rent-category',
        label: 'Room Rent Category Wise',
        description: 'Room revenue contribution per category and contract type.',
        metrics: ['Category revenue', 'Average stay length', 'Upsell performance'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'agent-checkin-daybook',
        label: 'Agent Wise Checkin DayBook',
        description: 'Arrivals handled per travel agent or OTA partner.',
        metrics: ['Arrivals per agent', 'Conversion rate', 'Commission value'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'agent-checkin-detail',
        label: 'Agent Wise Checkin Detail',
        description: 'Granular view of each guest tied to an agency contract.',
        metrics: ['Rate codes', 'Package inclusions', 'No-show risk'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'guest-profile',
        label: 'Guest Profile',
        description: '360° profile of in-house and repeat guests with preferences.',
        metrics: ['Loyalty tier', 'Total spend', 'Stay frequency'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'guest-checkin-daybook',
        label: 'Guest Wise Checkin DayBook',
        description: 'Individual guest check-in ledger with documents and remarks.',
        metrics: ['Check-in method', 'Deposit status', 'Document validity'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'guest-checkin-detail',
        label: 'Guest Wise Checkin Detail',
        description: 'Detailed passport, visa, and contact information per guest.',
        metrics: ['Nationality mix', 'Visa expiry alerts', 'Escort requirements'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'passport-detail',
        label: 'Passport Detail',
        description: 'Passport registry for compliance and immigration reporting.',
        metrics: ['Expiring passports', 'Country distribution', 'Missing scans'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'visa-detail',
        label: 'Visa Detail',
        description: 'Visa types, validity, and sponsor information for guests.',
        metrics: ['Visa types', 'Overstay risk', 'Pending renewals'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'extra-bed',
        label: 'Extra Bed Report',
        description: 'Tracking of extra bed requests, availability, and billing.',
        metrics: ['Beds deployed', 'Revenue from extras', 'Pending pickups'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'checkout-daybook',
        label: 'CheckOut DayBook',
        description: 'Chronological ledger of departures with settlement status.',
        metrics: ['Departures vs expected', 'Late check-outs', 'Balance pending'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'cancelled-checkout',
        label: 'Cancelled CheckOut',
        description: 'Record of reversed departures and reinstated folios.',
        metrics: ['Reopened folios', 'Reason codes', 'User accountability'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'checkout-detail',
        label: 'CheckOut Detail',
        description: 'Guest-level departure details including folio balances.',
        metrics: ['Payments captured', 'Incidental charges', 'Feedback status'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'salesman-checkout',
        label: 'SalesMan CheckOut Detail',
        description: 'Performance of sales associates handling departures.',
        metrics: ['Collections per associate', 'Upsell success', 'Waiver count'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'consolidated-checkout',
        label: 'Consolidated CheckOut Report',
        description: 'Aggregated departure metrics for finance reconciliation.',
        metrics: ['Totals by payment type', 'Group departures', 'Outstanding folios'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'daily-tabular-ledger',
        label: 'DailyTabularLedger',
        description: 'Ledger-style snapshot of room revenue, taxes, and adjustments.',
        metrics: ['Room revenue', 'Tax buckets', 'Adjustments'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'daily-tabular-ledger-summary',
        label: 'DailyTabularLedger Summary',
        description: 'Summarised ledger for quick finance approvals.',
        metrics: ['Net vs gross', 'Ledger balance', 'Exceptions flagged'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'guest-room-history-summary',
        label: 'Guest Room History Summary',
        description: 'Historical stay summary by guest with spend and preferences.',
        metrics: ['Lifetime nights', 'Average rate', 'Preferred room type'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'room-history',
        label: 'Room History',
        description: 'Maintenance and occupancy history for each room.',
        metrics: ['Downtime days', 'Incidents logged', 'Refurbishment notes'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'daily-checkout-accounts',
        label: 'Daily CheckOut Accounts Report',
        description: 'Finance view of balances cleared on the day of departure.',
        metrics: ['Settled folios', 'AR transfers', 'Write-offs'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'daily-checkout-accounts-gst',
        label: 'Daily CheckOut Accounts Report GST',
        description: 'GST-ready export of checkout settlements with tax codes.',
        metrics: ['GST collected', 'Tax variance', 'Submission status'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'budget-analysis',
        label: 'BudgetAnalysis',
        description: 'Budget vs actual tracking for room revenue and expenses.',
        metrics: ['Budget adherence', 'Forecast variance', 'Cost per room'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      },
      {
        key: 'front-office-tax',
        label: 'Front Office Tax Reports',
        description: 'Tax liability statements for regulatory filing.',
        metrics: ['Tourism levy', 'VAT breakdown', 'Withholding summaries'],
        filters: { voucherType: true, user: true, room: true, dateRange: true, notes: true }
      }
    ]
  },
  {
    key: 'service-reports',
    label: 'Service Reports',
    icon: '🧾',
    description: 'Ancillary services, vouchers, and cost centre performance.',
    reports: [
      {
        key: 'service-wise',
        label: 'Service Wise',
        description: 'Service revenue and utilisation by department or package.',
        metrics: ['Service revenue', 'Utilisation vs capacity', 'Average ticket value'],
        filters: { voucherType: true, dateRange: true, service: true, costCenters: true, notes: true }
      },
      {
        key: 'cancelled-service',
        label: 'Cancelled Service',
        description: 'Cancelled ancillary services with refund or reschedule notes.',
        metrics: ['Cancellation count', 'Refund value', 'Reason analysis'],
        filters: { voucherType: true, dateRange: true, service: true, costCenters: true, notes: true }
      },
      {
        key: 'party-wise',
        label: 'Party Wise',
        description: 'Service consumption grouped by event or guest party.',
        metrics: ['Spend per party', 'Cost centre splits', 'Complimentary usage'],
        filters: { voucherType: true, dateRange: true, service: true, costCenters: true, notes: true }
      },
      {
        key: 'service-consolidated',
        label: 'Service Consolidated',
        description: 'Consolidated ancillary service revenue for finance.',
        metrics: ['Net service revenue', 'Department contribution', 'Pending postings'],
        filters: { voucherType: true, dateRange: true, service: true, costCenters: true, notes: true }
      },
      {
        key: 'feedback-report',
        label: 'Feedback Report',
        description: 'Structured service feedback, sentiment, and follow-up tasks.',
        metrics: ['Satisfaction score', 'Themes detected', 'Response SLA'],
        filters: { voucherType: true, dateRange: true, service: true, costCenters: true, notes: true }
      }
    ]
  }
];

export default function FrontOfficeOperationsDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [reportSearch, setReportSearch] = useState('');
  const [selectedReportKey, setSelectedReportKey] = useState(FRONT_OFFICE_REPORT_CATALOG[0]?.reports[0]?.key || '');
  const [reportFilters, setReportFilters] = useState<ReportFiltersState>(() => buildInitialReportFilters());
  const [selectedCostCenters, setSelectedCostCenters] = useState<Set<string>>(
    () => new Set(FALLBACK_COST_CENTERS.map(option => option.value))
  );
  const [reportLogEntries, setReportLogEntries] = useState<ReportLogEntry[]>(() => [
    {
      id: `fo-log-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      level: 'info',
      action: 'Reports console initialised',
      context: 'Front Office filters loaded'
    }
  ]);
  const costCenterOptions = FALLBACK_COST_CENTERS;
  const filteredReportCatalog = useMemo(() => {
    const term = reportSearch.trim().toLowerCase();
    if (!term) return FRONT_OFFICE_REPORT_CATALOG;
    return FRONT_OFFICE_REPORT_CATALOG
      .map(category => {
        const reports = category.reports.filter(report => {
          const haystack = `${report.label} ${report.description} ${report.metrics.join(' ')}`.toLowerCase();
          return haystack.includes(term);
        });
        return { ...category, reports };
      })
      .filter(category => category.reports.length > 0);
  }, [reportSearch]);
  const selectedReportContext = useMemo(() => {
    for (const category of FRONT_OFFICE_REPORT_CATALOG) {
      const report = category.reports.find(item => item.key === selectedReportKey);
      if (report) {
        return { category, report };
      }
    }
    const fallbackCategory = FRONT_OFFICE_REPORT_CATALOG[0];
    return fallbackCategory
      ? { category: fallbackCategory, report: fallbackCategory.reports[0] }
      : { category: null, report: undefined };
  }, [selectedReportKey]);
  const selectedReport = selectedReportContext?.report;
  const selectedReportCategory = selectedReportContext?.category;
  const selectedCostCenterList = useMemo(() => Array.from(selectedCostCenters), [selectedCostCenters]);
  const selectedCostCenterLabels = useMemo(() => {
    const labelMap = new Map(costCenterOptions.map(option => [option.value, option.label]));
    return selectedCostCenterList.map(value => labelMap.get(value) || value);
  }, [costCenterOptions, selectedCostCenterList]);
  const selectedVoucherType = useMemo(
    () => REPORT_VOUCHER_TYPES.find(option => option.value === reportFilters.voucherType) || REPORT_VOUCHER_TYPES[0],
    [reportFilters.voucherType]
  );
  const selectedServiceOption = useMemo(
    () => SERVICE_REPORT_OPTIONS.find(option => option.value === reportFilters.service),
    [reportFilters.service]
  );
  const logReportAction = useCallback(
    (action: string, level: ReportLogLevel = 'info', context?: string) => {
      setReportLogEntries(prev => {
        const entry: ReportLogEntry = {
          id: `fo-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toLocaleString(),
          level,
          action,
          context
        };
        const next = [entry, ...prev];
        return next.slice(0, 10);
      });
    },
    []
  );
  const updateReportFilter = useCallback((key: keyof ReportFiltersState, value: string) => {
    setReportFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  const handleReportSelection = useCallback(
    (reportKey: string, label: string) => {
      setSelectedReportKey(reportKey);
      logReportAction(`Switched to ${label}`, 'info', 'Report focus updated');
      trackEvent('Analytics.FiltersUpdated', { scope: 'front-office', reportKey });
    },
    [logReportAction]
  );
  const handleCostCenterToggle = useCallback(
    (value: string, label: string) => {
      setSelectedCostCenters(prev => {
        const next = new Set(prev);
        if (next.has(value)) {
          next.delete(value);
          logReportAction(`Removed ${label}`, 'warning', 'Cost centre filter updated');
        } else {
          next.add(value);
          logReportAction(`Added ${label}`, 'info', 'Cost centre filter updated');
        }
        return next;
      });
    },
    [logReportAction]
  );
  const handleReportAction = useCallback(
    (mode: 'preview' | 'export' | 'schedule') => {
      if (!selectedReport) return;
      const context = `${reportFilters.fromDate} → ${reportFilters.toDate}`;
      const analyticsEventType =
        mode === 'preview' ? 'Report.Opened' : mode === 'export' ? 'Analytics.Exported' : 'Report.Scheduled';
      trackEvent(analyticsEventType, {
        scope: 'front-office',
        mode,
        reportKey: selectedReport.key,
        filters: reportFilters,
        costCenters: selectedCostCenterList
      });
      const actionLabel =
        mode === 'preview' ? 'Preview generated' : mode === 'export' ? 'Export prepared' : 'Schedule configured';
      logReportAction(`${actionLabel} for ${selectedReport.label}`, 'success', context);
    },
    [selectedReport, reportFilters, selectedCostCenterList, logReportAction]
  );

  const settings = useSettingsStore();

  useEffect(() => {
    const unsubscribe = frontOfficeStore.subscribe(() => setTick(t => t + 1));
    return unsubscribe;
  }, []);

  // Initial sync from API
  useEffect(() => {
    const sub = (settings as any)?.tenant?.subdomain || 'demo';
    frontOfficeStore.syncReservationsFromApi(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get data
  const reservations = frontOfficeStore.reservations;
  const rooms = frontOfficeStore.rooms;
  const roomTypes = settings.roomManagement.roomTypes || [];

  // Housekeeping-driven room status overview
  const hkAllRooms = housekeepingStore.getAllRooms();
  const settingsRoomsCount = settings.roomManagement.rooms?.length || 0;
  const totalRooms = settingsRoomsCount || rooms.length || hkAllRooms.length;
  const availableRooms = hkAllRooms.filter(r => ['vacant', 'clean', 'inspected'].includes(r.status as any)).length;
  const occupiedRooms = hkAllRooms.filter(r => r.status === 'occupied').length;
  const dirtyRooms = hkAllRooms.filter(r => r.status === 'dirty').length;
  const maintenanceOpen = housekeepingStore.getMaintenanceRequests().filter(m => m.status !== 'completed').length;
  const readySoon = hkAllRooms.filter(r => r.status === 'inspected').length;

  // Breakdowns
  const todayIso = new Date().toISOString().slice(0,10);
  const checkingOutToday = reservations.filter(r => r.status === 'checked-in' && r.departure.slice(0,10) === todayIso).length;
  const extendedStays = reservations.filter(r => r.status === 'checked-in' && r.departure < new Date().toISOString()).length;
  const vipGuests = 0;

  // Metrics
  const totalReservations = reservations.length;
  const checkedInReservations = reservations.filter(r => r.status === 'checked-in').length;
  const pendingCheckIns = reservations.filter(r => r.status === 'confirmed').length;
  const pendingCheckOuts = reservations.filter(r => r.status === 'checked-in').length;
  const totalRevenue = 0;

  const quickActions: QuickAction[] = [
    {
      id: 'new-reservation',
      title: 'New Reservation',
      description: 'Create a new guest reservation',
      icon: '📅',
      color: 'ghana-green',
      action: () => setIsReservationModalOpen(true)
    },
    {
      id: 'room-assignment',
      title: 'Room Assignment',
      description: 'Assign rooms to guests',
      icon: '🏠',
      color: 'purple-500',
      action: () => setSelectedTab('room-assignment'),
      requiresModule: 'frontOffice'
    }
  ];

  // Get room counts by type from settings
  const getRoomCountByType = (typeId: string) => {
    const count = settings.roomManagement.rooms?.filter(room => room.typeId === typeId).length || 0;
    console.log(`Room count for type ${typeId}:`, count);
    return count;
  };

  const getAvailableRoomCountByType = (typeId: string) => {
    const count = hkAllRooms.filter(room => 
      room.roomTypeId === typeId && ['vacant', 'clean', 'inspected'].includes(room.status as any)
    ).length;
    console.log(`Available room count for type ${typeId}:`, count);
    return count;
  };

  // Debug logging
  console.log('Settings rooms:', settings.roomManagement.rooms);
  console.log('Housekeeping rooms:', hkAllRooms);
  console.log('Total rooms count:', totalRooms);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Room Status Overview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🏨 Room Status Overview ({totalRooms} Rooms)</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Available */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-0"><span className="font-semibold">Available Rooms</span></CardHeader>
            <CardBody className="pt-3">
                              <div className="text-4xl font-bold text-ghana-green mb-3">{availableRooms}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Standard Rooms</span><span>{getAvailableRoomCountByType('standard')}</span></div>
                  <div className="flex justify-between"><span>Deluxe Rooms</span><span>{getAvailableRoomCountByType('deluxe')}</span></div>
                  <div className="flex justify-between"><span>Suite Rooms</span><span>{getAvailableRoomCountByType('suite')}</span></div>
                </div>
            </CardBody>
          </Card>

          {/* Occupied */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-0"><span className="font-semibold">Occupied Rooms</span></CardHeader>
            <CardBody className="pt-3">
              <div className="text-4xl font-bold text-ghana-red mb-3">{occupiedRooms}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between"><span>Checking Out Today</span><span>{checkingOutToday}</span></div>
                <div className="flex justify-between"><span>Extended Stays</span><span>{extendedStays}</span></div>
                <div className="flex justify-between"><span>VIP Guests</span><span>{vipGuests}</span></div>
              </div>
            </CardBody>
          </Card>

          {/* Maintenance & Cleaning */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-0"><span className="font-semibold">Maintenance & Cleaning</span></CardHeader>
            <CardBody className="pt-3">
              <div className="text-4xl font-bold text-ghana-black mb-3">{maintenanceOpen + dirtyRooms}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between"><span>Under Maintenance</span><span>{maintenanceOpen}</span></div>
                <div className="flex justify-between"><span>Deep Cleaning</span><span>{dirtyRooms}</span></div>
                <div className="flex justify-between"><span>Ready Soon</span><span>{readySoon}</span></div>
              </div>
              <div className="mt-4 flex justify-end">
                <a href="/room-status" className="inline-flex items-center px-4 py-2 rounded-md bg-ghana-green text-white text-sm">🏨 View Full Status</a>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg"><CardBody className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total Reservations</p><p className="text-2xl font-bold text-ghana-black">{totalReservations}</p></div><div className="text-3xl">📅</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Checked In</p><p className="text-2xl font-bold text-ghana-black">{checkedInReservations}</p></div><div className="text-3xl">🔑</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Pending Check-ins</p><p className="text-2xl font-bold text-ghana-black">{pendingCheckIns}</p></div><div className="text-3xl">⏳</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total Revenue</p><p className="text-2xl font-bold text-ghana-black">₵{totalRevenue.toLocaleString()}</p></div><div className="text-3xl">💰</div></div></CardBody></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3"><h3 className="text-xl font-semibold text-ghana-black">🚀 Quick Actions</h3></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map(action => (
              <Button key={action.id} variant="flat" className={`h-24 flex flex-col items-center justify-center space-y-2 bg-${action.color} text-white`} size="lg" onClick={action.action}>
                <span className="text-2xl">{action.icon}</span>
                <span className="text-xs font-medium text-center">{action.title}</span>
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderReservations = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📅 Reservations</h3>
            <Button color="primary" className="bg-ghana-green text-white" variant="flat" onClick={() => setIsReservationModalOpen(true)}>
              ➕ New Reservation
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Reservations table">
            <TableHeader>
              <TableColumn>Guest</TableColumn>
              <TableColumn>Dates</TableColumn>
              <TableColumn>Room</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Source</TableColumn>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{reservation.guestName}</div>
                      <div className="text-sm text-gray-500">
                        {reservation.adults} adult{(reservation.adults || 1) > 1 ? 's' : ''}
                        {(reservation.children || 0) > 0 && `, ${reservation.children} child${(reservation.children || 0) > 1 ? 'ren' : ''}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Check-in: {new Date(reservation.arrival).toLocaleDateString()}</div>
                      <div>Check-out: {new Date(reservation.departure).toLocaleDateString()}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {reservation.roomId ? (
                      <Badge color="success" size="sm">Room {reservation.roomId}</Badge>
                    ) : (
                      <Badge color="warning" size="sm">Unassigned</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge color={
                      reservation.status === 'checked-in' ? 'success' :
                      reservation.status === 'confirmed' ? 'primary' :
                      reservation.status === 'checked-out' ? 'default' :
                      'warning'
                    } size="sm">
                      {reservation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Chip color="primary" size="sm" variant="flat">{reservation.source || 'Direct'}</Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderRoomAssignment = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xl font-semibold text-ghana-black">🏠 Room Assignment</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Available Rooms</h4>
              <div className="space-y-2">
                {rooms.map(room => (
                  <div key={room.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div>
                      <span className="font-semibold">Room {room.id}</span>
                      <span className="text-sm text-gray-600 ml-2">Floor {room.floor || '-'}</span>
                    </div>
                    <Badge color="success" size="sm">Available</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Add New Room</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Room Number" placeholder="e.g., 305" id="fo-room-num" />
                <Select label="Room Type" placeholder="Select type" id="fo-room-type">
                  {roomTypes.map(rt => (
                    <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                  ))}
                </Select>
                <Input label="Floor" placeholder="e.g., 3" id="fo-room-floor" />
                <div className="flex items-end">
                  <Button color="primary" onClick={() => {
                    const id = (document.getElementById('fo-room-num') as HTMLInputElement)?.value?.trim();
                    const typeId = (document.getElementById('fo-room-type') as HTMLSelectElement)?.value || (document.getElementById('fo-room-type') as any)?.dataset?.value;
                    const floor = (document.getElementById('fo-room-floor') as HTMLInputElement)?.value?.trim();
                    if (!id || !typeId) {
                      alert('Room number and type are required');
                      return;
                    }
                    frontOfficeStore.addRoom({ id, roomTypeId: typeId, floor });
                    trackEvent('FO.Room.Created.UI', { id, roomTypeId: typeId });
                    (document.getElementById('fo-room-num') as HTMLInputElement).value = '';
                    (document.getElementById('fo-room-floor') as HTMLInputElement).value = '';
                  }}>Add Room</Button>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border border-gray-200 h-full">
          <CardHeader className="flex flex-col gap-1">
            <h4 className="font-semibold text-ghana-black flex items-center gap-2">
              <span>{selectedReportCategory?.icon || '📁'}</span>
              Report Explorer
            </h4>
            <p className="text-xs text-gray-500">
              Mirrors the legacy Front Office console with all room & service reports.
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Search reports"
              placeholder="Tariff, DayBook, Service..."
              value={reportSearch}
              onValueChange={setReportSearch}
            />
            <Divider />
            {filteredReportCatalog.length > 0 ? (
              <Accordion
                selectionMode="multiple"
                defaultExpandedKeys={filteredReportCatalog.map(category => category.key)}
                className="w-full"
              >
                {filteredReportCatalog.map(category => (
                  <AccordionItem
                    key={category.key}
                    aria-label={category.label}
                    title={
                      <span className="flex items-center gap-2 text-ghana-black font-semibold">
                        <span>{category.icon}</span>
                        {category.label}
                      </span>
                    }
                    subtitle={category.description}
                  >
                    <div className="space-y-2">
                      {category.reports.map(report => (
                        <button
                          key={report.key}
                          onClick={() => handleReportSelection(report.key, report.label)}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                            selectedReport?.key === report.key
                              ? 'border-ghana-gold bg-ghana-gold/5 text-ghana-black shadow-sm'
                              : 'border-gray-200 hover:border-ghana-gold/60'
                          }`}
                        >
                          <p className="text-sm font-semibold">{report.label}</p>
                          <p className="text-xs text-gray-500">{report.description}</p>
                        </button>
                      ))}
                    </div>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-sm text-gray-500">
                No reports match this keyword — try another search.
              </div>
            )}
          </CardBody>
        </Card>
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-gray-200">
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-400 tracking-wide">
                    {selectedReportCategory?.label || 'Select a report'}
                  </p>
                  <h4 className="text-lg font-semibold text-ghana-black">
                    {selectedReport?.label || 'Choose a report to configure'}
                  </h4>
                  <p className="text-sm text-gray-500">{selectedReport?.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="flat" color="primary">
                    Voucher: {selectedVoucherType?.label}
                  </Chip>
                  <Chip size="sm" variant="flat" color="success">
                    Date: {reportFilters.fromDate} → {reportFilters.toDate}
                  </Chip>
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedReport?.filters?.voucherType && (
                  <Select
                    label="Voucher Type"
                    selectedKeys={[reportFilters.voucherType] as any}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0]?.toString() || 'all';
                      updateReportFilter('voucherType', value);
                    }}
                  >
                    {REPORT_VOUCHER_TYPES.map(option => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </Select>
                )}
                {selectedReport?.filters?.user && (
                  <Input
                    label="User / Agent"
                    placeholder="Front office staff"
                    value={reportFilters.user}
                    onValueChange={value => updateReportFilter('user', value)}
                  />
                )}
                {selectedReport?.filters?.room && (
                  <Input
                    label="Room / Hall"
                    placeholder="e.g. 305 or Oforwaa Hall"
                    value={reportFilters.room}
                    onValueChange={value => updateReportFilter('room', value)}
                  />
                )}
                {selectedReport?.filters?.service && (
                  <Select
                    label="Service / Package"
                    selectedKeys={reportFilters.service ? [reportFilters.service] as any : []}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0]?.toString() || '';
                      updateReportFilter('service', value);
                    }}
                  >
                    {SERVICE_REPORT_OPTIONS.map(option => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </Select>
                )}
                {selectedReport?.filters?.dateRange && (
                  <>
                    <Input
                      type="date"
                      label="From"
                      value={reportFilters.fromDate}
                      onValueChange={value => updateReportFilter('fromDate', value)}
                    />
                    <Input
                      type="date"
                      label="To"
                      value={reportFilters.toDate}
                      onValueChange={value => updateReportFilter('toDate', value)}
                    />
                  </>
                )}
              </div>
              {selectedReport?.filters?.costCenters && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-600">Cost Centres</p>
                    <Chip size="sm" variant="flat" color="secondary">
                      {selectedCostCenterList.length} selected
                    </Chip>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {costCenterOptions.map(option => (
                      <Checkbox
                        key={option.value}
                        isSelected={selectedCostCenters.has(option.value)}
                        onValueChange={() => handleCostCenterToggle(option.value, option.label)}
                      >
                        {option.label}
                      </Checkbox>
                    ))}
                  </div>
                </div>
              )}
              {selectedReport?.filters?.notes && (
                <Textarea
                  label="Narrative / Instructions"
                  placeholder="Add notes that should appear on the rendered report"
                  value={reportFilters.notes}
                  minRows={2}
                  onValueChange={value => updateReportFilter('notes', value)}
                />
              )}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <Button
                  color="primary"
                  variant="solid"
                  startContent="👁️"
                  onPress={() => handleReportAction('preview')}
                >
                  Show Report
                </Button>
                <Button
                  color="secondary"
                  variant="flat"
                  startContent="💾"
                  onPress={() => handleReportAction('export')}
                >
                  Export PDF
                </Button>
                <Button
                  color="success"
                  variant="flat"
                  startContent="📧"
                  onPress={() => handleReportAction('schedule')}
                >
                  Schedule Email
                </Button>
              </div>
            </CardBody>
          </Card>
          <Card className="border border-gray-200">
            <CardHeader>
              <div>
                <h4 className="font-semibold text-ghana-black">Report Snapshot</h4>
                <p className="text-sm text-gray-500">Quick view of metric focus, filters, and distribution.</p>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs uppercase text-gray-500">Voucher</p>
                  <p className="text-sm font-semibold text-ghana-black">{selectedVoucherType?.label}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs uppercase text-gray-500">Date Window</p>
                  <p className="text-sm font-semibold text-ghana-black">
                    {reportFilters.fromDate} → {reportFilters.toDate}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs uppercase text-gray-500">Service Focus</p>
                  <p className="text-sm font-semibold text-ghana-black">
                    {selectedServiceOption?.label || 'Not applicable'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Focus Metrics</p>
                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                  {selectedReport?.metrics?.map(metric => (
                    <li key={metric}>{metric}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ghana-black">User / Room Filters</span>
                  <Chip size="sm" variant="flat" color="primary">
                    {reportFilters.user || 'Any'} · {reportFilters.room || 'All rooms'}
                  </Chip>
                </div>
                {selectedReport?.filters?.costCenters && (
                  <p>Cost Centres: {selectedCostCenterLabels.length > 0 ? selectedCostCenterLabels.join(', ') : 'None'}</p>
                )}
                {selectedReport?.filters?.notes && reportFilters.notes && (
                  <p className="italic text-gray-500">Note: {reportFilters.notes}</p>
                )}
              </div>
            </CardBody>
          </Card>
          <Card className="border border-gray-200">
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <h4 className="font-semibold text-ghana-black">Report Activity Log</h4>
                  <p className="text-sm text-gray-500">Every action is traced for accountability.</p>
                </div>
                <Chip size="sm" variant="flat" color="secondary">
                  {reportLogEntries.length} entries
                </Chip>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {reportLogEntries.map(entry => (
                <div key={entry.id} className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Chip size="sm" variant="flat" color={REPORT_LOG_COLOR[entry.level]}>
                      {entry.level.toUpperCase()}
                    </Chip>
                    <span className="text-xs text-gray-400">{entry.timestamp}</span>
                  </div>
                  <p className="text-sm font-semibold text-ghana-black mt-1">{entry.action}</p>
                  {entry.context && <p className="text-xs text-gray-500 mt-0.5">{entry.context}</p>}
                </div>
              ))}
              {reportLogEntries.length === 0 && (
                <p className="text-sm text-gray-500">No activity recorded yet.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🏨 Front Office Operations</h1>
          <p className="text-gray-600">Complete guest lifecycle management from reservation to check-out</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">SaaS Ready</Badge>
        </div>
      </div>

      <Tabs selectedKey={selectedTab} onSelectionChange={(key) => setSelectedTab(key as string)} className="w-full">
        <Tab key="overview" title="Overview" />
        <Tab key="reservations" title="Reservations" />
        <Tab key="room-assignment" title="Room Assignment" />
        <Tab key="reports" title="Reports & Analytics" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'reservations' && renderReservations()}
        {selectedTab === 'room-assignment' && renderRoomAssignment()}
        {selectedTab === 'reports' && renderReports()}
      </div>

      {/* Reservation Modal */}
      <Modal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} size="4xl">
        <ModalContent>
          <ModalHeader>
            {selectedReservation ? 'Edit Reservation' : 'New Reservation'}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Guest Name" placeholder="e.g., Ama Kofi" id="fo-guest-name" />
              <Input label="Phone" placeholder="e.g., +233..." id="fo-guest-phone" />
              <Input type="date" label="Arrival" id="fo-arrival" />
              <Input type="date" label="Departure" id="fo-departure" />
              <Input type="number" label="Adults" defaultValue={'1'} id="fo-adults" />
              <Input type="number" label="Children" defaultValue={'0'} id="fo-children" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsReservationModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={async () => {
              const sub = (settings as any)?.tenant?.subdomain || 'demo';
              const g = (document.getElementById('fo-guest-name') as HTMLInputElement)?.value;
              const p = (document.getElementById('fo-guest-phone') as HTMLInputElement)?.value;
              const a = (document.getElementById('fo-arrival') as HTMLInputElement)?.value;
              const d = (document.getElementById('fo-departure') as HTMLInputElement)?.value;
              const ad = Number((document.getElementById('fo-adults') as HTMLInputElement)?.value || '1');
              const ch = Number((document.getElementById('fo-children') as HTMLInputElement)?.value || '0');
              if (!g || !a || !d) {
                alert('Guest name, arrival and departure are required');
                return;
              }
              await frontOfficeStore.createGuestAndReservationViaApi(sub, {
                guestName: g,
                guestPhone: p,
                arrival: a,
                departure: d,
                adults: ad,
                children: ch,
                source: 'Direct'
              });
              setIsReservationModalOpen(false);
            }}>
              {selectedReservation ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Check-in Modal placeholder */}
      <Modal isOpen={isCheckInModalOpen} onClose={() => setIsCheckInModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Check In Guest</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Room</label>
                <Select placeholder="Choose available room">
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>Room {room.id}</SelectItem>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea placeholder="Any special requests or notes..." />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsCheckInModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={() => setIsCheckInModalOpen(false)}>Check In</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Check-out Modal placeholder */}
      <Modal isOpen={isCheckOutModalOpen} onClose={() => setIsCheckOutModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Check Out Guest</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Final Amount</label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <Select placeholder="Select payment method">
                  <SelectItem key="cash" value="cash">Cash</SelectItem>
                  <SelectItem key="card" value="card">Card</SelectItem>
                  <SelectItem key="mobile-money" value="mobile-money">Mobile Money</SelectItem>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea placeholder="Any feedback or notes..." />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsCheckOutModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={() => setIsCheckOutModalOpen(false)}>Check Out</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Payment Modal placeholder */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Process Payment</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <Select placeholder="Select payment method">
                  <SelectItem key="cash" value="cash">Cash</SelectItem>
                  <SelectItem key="card" value="card">Card</SelectItem>
                  <SelectItem key="mobile-money" value="mobile-money">Mobile Money</SelectItem>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Reference</label>
                <Input placeholder="Transaction reference or notes..." />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsPaymentModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={() => setIsPaymentModalOpen(false)}>Process Payment</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}


