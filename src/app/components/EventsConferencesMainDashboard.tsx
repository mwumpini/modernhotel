'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Tabs, 
  Tab, 
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Switch,
  Divider,
  Accordion,
  AccordionItem,
  Checkbox,
  RadioGroup,
  Radio,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Autocomplete,
  AutocompleteItem,
  Pagination
} from "@heroui/react";
import { trackEvent } from '../lib/analytics/trackEvent';
import { useRouter } from 'next/navigation';
import { useFrontOfficeSelector } from '../lib/frontoffice/useFoStore';
import { useComplianceStore } from '../lib/compliance/store';
import { useCalculateTax } from '../hooks/useCalculateTax';
import { enhancedFrontOfficeStore } from '../lib/frontoffice/enhancedStore';
import type { EventBooking, GuestProfile } from '../lib/frontoffice/types';
import { openPrintPreview } from '../lib/print/engine';
import { listTemplates } from '../lib/print/templates';
import { useSettingsStore } from '../lib/settings/store';
import { useAccountingStore } from '../lib/accounting/store';

type VenueStatus = 'available' | 'booked' | 'setup' | 'maintenance';

interface VenueDetails {
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

interface VenueFormState {
  name: string;
  type: string;
  capacity: string;
  basePrice: string;
  location: string;
  status: VenueStatus;
  featuresInput: string;
  currency: string;
}

const supplementalVenueSeeds: VenueDetails[] = [
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

const baseVenueSeeds: VenueDetails[] = [
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

const initialVenueCatalog: VenueDetails[] = [...baseVenueSeeds, ...supplementalVenueSeeds];

const createEmptyVenueForm = (): VenueFormState => ({
  name: '',
  type: 'conference',
  capacity: '',
  basePrice: '',
  location: '',
  status: 'available',
  featuresInput: '',
  currency: 'GH₵'
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'venue';

// Info Icon Component with Tooltip
const InfoIcon = ({ description }: { description: string }) => {
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

interface ReportInsight {
  label: string;
  value: string;
  helper?: string;
}

interface ReportQuickLink {
  label: string;
  icon: string;
  action: () => void;
}

const REPORT_LOG_COLOR: Record<ReportLogLevel, 'primary' | 'success' | 'warning'> = {
  info: 'primary',
  success: 'success',
  warning: 'warning'
};

interface ReportFiltersState {
  voucherType: string;
  user: string;
  room: string;
  fromDate: string;
  toDate: string;
  service: string;
  notes: string;
}

const REPORT_VOUCHER_TYPES = [
  { label: 'All Documents', value: 'all' },
  { label: 'Event Invoice', value: 'invoice' },
  { label: 'Service Order', value: 'service-order' },
  { label: 'Credit Memo', value: 'credit-note' },
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
  { label: 'Full-Service Catering', value: 'catering' },
  { label: 'Audio / Visual', value: 'av-production' },
  { label: 'Décor & Staging', value: 'decor-staging' },
  { label: 'Airport & Local Shuttle', value: 'transport' },
  { label: 'Security & Protocol', value: 'security' },
  { label: 'Guest Concierge', value: 'concierge' }
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

const EVENTS_REPORT_CATALOG: ReportCategory[] = [
  {
    key: 'sales-pipeline',
    label: 'Sales & Pipeline',
    icon: '📋',
    description: 'Demand generation, inquiry handling, and conversion performance for events.',
    reports: [
      {
        key: 'pipeline-conversion',
        label: 'Pipeline Conversion',
        description: 'See how inquiries progress through proposal, contract, and execution.',
        metrics: ['Inquiry volume', 'Conversion %', 'Stage fallout'],
        filters: { dateRange: true, user: true, notes: true }
      },
      {
        key: 'channel-performance',
        label: 'Channel Performance',
        description: 'Compare corporate, OTA, referral, and walk-in bookings.',
        metrics: ['Revenue by channel', 'Win rate', 'Average deal size'],
        filters: { dateRange: true, user: true, notes: true }
      },
      {
        key: 'quote-aging',
        label: 'Quote Aging',
        description: 'Monitor quotes approaching SLA thresholds and aging buckets.',
        metrics: ['Avg quote age', 'Quotes expiring soon', 'Follow-up cadence'],
        filters: { dateRange: true, user: true, notes: true }
      },
      {
        key: 'response-time',
        label: 'Lead Response Time',
        description: 'Measure planner response speed across sales reps.',
        metrics: ['Median minutes to first reply', 'Outliers', 'Owner leaderboard'],
        filters: { dateRange: true, user: true, notes: true }
      },
      {
        key: 'contract-cycle',
        label: 'Contract Cycle',
        description: 'Track contract drafts, approvals, and signature timelines.',
        metrics: ['Cycle duration', 'Legal backlog', 'Pending approvals'],
        filters: { dateRange: true, user: true, notes: true }
      },
      {
        key: 'discount-impact',
        label: 'Discount Impact',
        description: 'Analyse the lift vs. margin cost for discounts and concessions.',
        metrics: ['Discounted revenue', 'Margin delta', 'Approver list'],
        filters: { dateRange: true, user: true, notes: true }
      }
    ]
  },
  {
    key: 'operations-venues',
    label: 'Venues & Operations',
    icon: '🎛️',
    description: 'Utilisation, setup readiness, and production execution across venues.',
    reports: [
      {
        key: 'venue-utilization',
        label: 'Venue Utilization',
        description: 'Occupancy of each hall/space by daypart and event type.',
        metrics: ['Utilisation %', 'Idle capacity', 'Overbooking alerts'],
        filters: { dateRange: true, room: true, costCenters: true, notes: true }
      },
      {
        key: 'setup-readiness',
        label: 'Setup Readiness',
        description: 'BEO milestones, vendor call times, and setup blockers.',
        metrics: ['Milestones met', 'Late setups', 'Tasks outstanding'],
        filters: { dateRange: true, room: true, service: true, notes: true }
      },
      {
        key: 'service-order-board',
        label: 'Service Order Board',
        description: 'Track catering, AV, décor, and logistics orders per event.',
        metrics: ['Orders fulfilled', 'Variance vs. plan', 'Escalations'],
        filters: { dateRange: true, service: true, costCenters: true, notes: true }
      },
      {
        key: 'resource-conflicts',
        label: 'Resource Conflicts',
        description: 'Identify overlapping space, staff, or equipment allocations.',
        metrics: ['Conflicts prevented', 'Manual overrides', 'High-risk slots'],
        filters: { dateRange: true, room: true, notes: true }
      },
      {
        key: 'run-sheet-compliance',
        label: 'Run Sheet Compliance',
        description: 'Compare planned timelines vs. actual execution.',
        metrics: ['Start delay', 'Program deviations', 'Owner notes'],
        filters: { dateRange: true, room: true, notes: true }
      },
      {
        key: 'incident-log',
        label: 'Incident & Issue Log',
        description: 'Safety, maintenance, and guest-related incidents during events.',
        metrics: ['Incidents per 100 guests', 'Resolution SLA', 'Root causes'],
        filters: { dateRange: true, room: true, notes: true }
      }
    ]
  },
  {
    key: 'guest-experience',
    label: 'Attendee & Experience',
    icon: '🧑‍🤝‍🧑',
    description: 'Attendee manifests, VIP oversight, satisfaction, and cancellations.',
    reports: [
      {
        key: 'attendee-manifest',
        label: 'Attendee Manifest',
        description: 'Full attendee lists, ticket classes, and access levels.',
        metrics: ['Registrations vs. goal', 'Walk-ins', 'Special needs'],
        filters: { dateRange: true, room: true, notes: true }
      },
      {
        key: 'guest-checkin',
        label: 'Guest Check-in Experience',
        description: 'Monitor arrival throughput and dwell time per entry point.',
        metrics: ['Check-in time', 'Badge reprints', 'Queue alerts'],
        filters: { dateRange: true, room: true, notes: true }
      },
      {
        key: 'vip-tracker',
        label: 'VIP & Speaker Tracker',
        description: 'Status of VIP itineraries, escorts, and hospitality deliverables.',
        metrics: ['VIP arrivals', 'Hospitality tasks', 'Unresolved requests'],
        filters: { dateRange: true, room: true, notes: true }
      },
      {
        key: 'onsite-spend',
        label: 'On-Site Spend',
        description: 'Ancillary revenue per attendee (F&B, spa, merch).',
        metrics: ['Spend per attendee', 'Top categories', 'Upsell take rate'],
        filters: { dateRange: true, service: true, notes: true }
      },
      {
        key: 'feedback-sentiment',
        label: 'Feedback & Sentiment',
        description: 'Survey scores, NPS, and open feedback themes.',
        metrics: ['NPS', 'CSAT', 'Top positive/negative themes'],
        filters: { dateRange: true, notes: true }
      },
      {
        key: 'cancellations-refunds',
        label: 'Cancellations & Refunds',
        description: 'Event or attendee cancellations with refund outcomes.',
        metrics: ['Cancelled pax', 'Refund value', 'Reason codes'],
        filters: { dateRange: true, notes: true }
      }
    ]
  },
  {
    key: 'finance-billing',
    label: 'Financial & Billing',
    icon: '💰',
    description: 'Cash flow, receivables, folios, and ancillary profitability.',
    reports: [
      {
        key: 'invoice-aging',
        label: 'Invoice Aging',
        description: 'Outstanding invoices by bracket, client, and sales owner.',
        metrics: ['Total outstanding', 'Past due %', 'Top overdue clients'],
        filters: { voucherType: true, dateRange: true, user: true, notes: true }
      },
      {
        key: 'deposit-tracking',
        label: 'Deposit Tracking',
        description: 'Deposits collected, pending, forfeited, or transferred.',
        metrics: ['Deposits due', 'Partial payments', 'At risk of lapse'],
        filters: { voucherType: true, dateRange: true, user: true, notes: true }
      },
      {
        key: 'folio-balance',
        label: 'Folio Balance Summary',
        description: 'Charges, payments, and balances across active event folios.',
        metrics: ['Debits vs credits', 'Open folios', 'Escalations'],
        filters: { voucherType: true, dateRange: true, costCenters: true, notes: true }
      },
      {
        key: 'ancillary-revenue',
        label: 'Ancillary Revenue Mix',
        description: 'Non-room/event revenue split by service center.',
        metrics: ['Service revenue', 'Margin by center', 'Upsell rate'],
        filters: { dateRange: true, service: true, costCenters: true, notes: true }
      },
      {
        key: 'budget-vs-actual',
        label: 'Budget vs Actual',
        description: 'Budget variance per event, segment, or package.',
        metrics: ['Variance %', 'Shared cost recovery', 'Forecast update'],
        filters: { dateRange: true, user: true, notes: true }
      }
    ]
  },
  {
    key: 'compliance-vendors',
    label: 'Compliance & Vendors',
    icon: '🛡️',
    description: 'Vendor SLAs, permits, sustainability, and risk governance.',
    reports: [
      {
        key: 'vendor-sla',
        label: 'Vendor SLA Dashboard',
        description: 'SLA adherence for catering, décor, AV, and logistics partners.',
        metrics: ['On-time %', 'Issue count', 'Penalty exposure'],
        filters: { dateRange: true, service: true, notes: true }
      },
      {
        key: 'compliance-checklist',
        label: 'Compliance Checklist',
        description: 'Permits, fire & safety inspections, and local authority filings.',
        metrics: ['Checklist completion', 'Expired items', 'Jurisdiction summary'],
        filters: { dateRange: true, room: true, notes: true }
      },
      {
        key: 'insurance-coverage',
        label: 'Insurance & Liability',
        description: 'Certificates of insurance, coverage limits, and expiries.',
        metrics: ['Policies expiring', 'Coverage gaps', 'Vendors missing COI'],
        filters: { dateRange: true, service: true, notes: true }
      },
      {
        key: 'sustainability',
        label: 'Sustainability Metrics',
        description: 'Energy usage, waste diversion, and carbon indicators per event.',
        metrics: ['kWh per attendee', 'Waste diverted %', 'Carbon estimate'],
        filters: { dateRange: true, notes: true }
      },
      {
        key: 'risk-register',
        label: 'Risk Register',
        description: 'Consolidated operational and contractual risks with owners.',
        metrics: ['Open risks', 'Severity mix', 'Mitigation progress'],
        filters: { dateRange: true, user: true, notes: true }
      }
    ]
  }
];

export default function EventsConferencesMainDashboard() {
  const router = useRouter();
  const { costCenters, revenueCenters } = useAccountingStore();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [modernVenues, setModernVenues] = useState<VenueDetails[]>(initialVenueCatalog);
  const [managementMainTab, setManagementMainTab] = useState<'events' | 'active' | 'completed' | 'invoices' | 'receipts' | 'quotes' | 'folios'>('events');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isBEOModalOpen, setIsBEOModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState<boolean>(false);
  const [isViewMode, setIsViewMode] = useState<boolean>(false);
  const [isAdjustMode, setIsAdjustMode] = useState<boolean>(false);
  const [isCreatingInvoiceFromFolio, setIsCreatingInvoiceFromFolio] = useState<boolean>(false);
  const [lastCreatedInvoiceId, setLastCreatedInvoiceId] = useState<string | null>(null);
  const [editingVenue, setEditingVenue] = useState<VenueDetails | null>(null);
  const [venueForm, setVenueForm] = useState<VenueFormState>(() => createEmptyVenueForm());
  const [editingService, setEditingService] = useState<any>(null);
  const [editingQuote, setEditingQuote] = useState<any>(null);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [editingTax, setEditingTax] = useState<any>(null);
  const [selectedEventForBEO, setSelectedEventForBEO] = useState<any>(null);
  const [beoForm, setBeoForm] = useState<any>(null);
  const [selectedContractEventInfo, setSelectedContractEventInfo] = useState<any>(null);
  const [customEvents, setCustomEvents] = useState<any[]>([]);
  const [eventSubmitting, setEventSubmitting] = useState<boolean>(false);
  const [reportSearch, setReportSearch] = useState('');
  const [selectedReportKey, setSelectedReportKey] = useState(
    EVENTS_REPORT_CATALOG[0]?.reports[0]?.key || ''
  );
  const [reportFilters, setReportFilters] = useState<ReportFiltersState>(() => buildInitialReportFilters());
  const [selectedCostCenters, setSelectedCostCenters] = useState<Set<string>>(
    () => new Set(FALLBACK_COST_CENTERS.map(option => option.value))
  );
  const [reportLogEntries, setReportLogEntries] = useState<ReportLogEntry[]>(() => [
    {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      level: 'info',
      action: 'Reports console initialised',
      context: 'Default filters loaded'
    }
  ]);
  const costCenterOptions = useMemo(
    () =>
      Array.isArray(costCenters) && costCenters.length > 0
        ? costCenters
            .filter((cc: any) => cc.isActive !== false)
            .map((cc: any) => ({
              label: `${cc.code} - ${cc.name}`,
              value: cc.code
            }))
        : FALLBACK_COST_CENTERS,
    [costCenters]
  );
  useEffect(() => {
    setSelectedCostCenters(prev => {
      const available = new Set(costCenterOptions.map(option => option.value));
      if (available.size === 0) {
        return prev;
      }
      const next = new Set<string>();
      prev.forEach(value => {
        if (available.has(value)) {
          next.add(value);
        }
      });
      if (next.size === 0) {
        available.forEach(value => next.add(value));
      }
      if (next.size === prev.size && Array.from(next).every(value => prev.has(value))) {
        return prev;
      }
      return next;
    });
  }, [costCenterOptions]);
  const logReportAction = useCallback(
    (action: string, level: ReportLogLevel = 'info', context?: string) => {
      setReportLogEntries(prev => {
        const entry: ReportLogEntry = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
  const filteredReportCatalog = useMemo(() => {
    const term = reportSearch.trim().toLowerCase();
    if (!term) return EVENTS_REPORT_CATALOG;
    return EVENTS_REPORT_CATALOG
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
    for (const category of EVENTS_REPORT_CATALOG) {
      const report = category.reports.find(item => item.key === selectedReportKey);
      if (report) {
        return { category, report };
      }
    }
    const fallbackCategory = EVENTS_REPORT_CATALOG[0];
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
  }, [selectedCostCenterList, costCenterOptions]);
  const selectedVoucherType = useMemo(
    () => REPORT_VOUCHER_TYPES.find(option => option.value === reportFilters.voucherType) || REPORT_VOUCHER_TYPES[0],
    [reportFilters.voucherType]
  );
  const selectedServiceOption = useMemo(
    () => SERVICE_REPORT_OPTIONS.find(option => option.value === reportFilters.service),
    [reportFilters.service]
  );
  const handleReportSelection = useCallback(
    (reportKey: string, label: string) => {
      setSelectedReportKey(reportKey);
      logReportAction(`Switched to ${label}`, 'info', 'Report focus updated');
      trackEvent('Analytics.FiltersUpdated', {
        scope: 'events',
        reportKey
      });
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
        scope: 'events',
        mode,
        reportKey: selectedReport.key,
        costCenters: selectedCostCenterList,
        filters: reportFilters
      });
      const actionLabel =
        mode === 'preview' ? 'Preview generated' : mode === 'export' ? 'Export prepared' : 'Schedule configured';
      logReportAction(`${actionLabel} for ${selectedReport.label}`, 'success', context);
    },
    [selectedReport, reportFilters, selectedCostCenterList, logReportAction]
  );
  type SimpleEventStatus = 'quote' | 'confirmed' | 'invoiced' | 'cancelled';
  const [eventStatus, setEventStatus] = useState<SimpleEventStatus>('quote');
  const eventStatusColorMap: Record<SimpleEventStatus, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
    quote: 'warning',
    confirmed: 'success',
    invoiced: 'primary',
    cancelled: 'danger'
  };
  const eventStatusLabelMap: Record<SimpleEventStatus, string> = {
    quote: 'Quote',
    confirmed: 'Confirmed',
    invoiced: 'Invoiced',
    cancelled: 'Cancelled'
  };

  const PRE_EVENT_STATUS_OPTIONS: Array<{ key: SimpleEventStatus; label: string; icon?: string }> = [
    { key: 'quote', label: 'Quote', icon: '📄' },
    { key: 'confirmed', label: 'Confirmed', icon: '✅' },
    { key: 'cancelled', label: 'Cancelled', icon: '❌' }
  ];
  const bookingStatusMap: Record<SimpleEventStatus, EventBooking['status']> = {
    quote: 'pending',
    confirmed: 'confirmed',
    invoiced: 'confirmed',
    cancelled: 'cancelled'
  };

  const frontOfficeGuests = useFrontOfficeSelector(store => store.guests || []) as GuestProfile[];
  const normalizeStatus = (status?: string): SimpleEventStatus => {
    const normalized = (status || '').toLowerCase();
    // Map old statuses to new simplified ones
    if (normalized === 'inquiry' || normalized === 'quote-sent' || normalized === 'quoted' || 
        normalized === 'awaiting-confirmation' || normalized === 'on-hold') {
      return 'quote';
    }
    if (normalized === 'confirmed' || normalized === 'deposit-paid' || normalized === 'in-progress') {
      return 'confirmed';
    }
    if (normalized === 'invoiced' || normalized === 'billed' || normalized === 'completed' || normalized === 'paid') {
      return 'invoiced';
    }
    if (normalized === 'cancelled' || normalized === 'canceled') {
      return 'cancelled';
    }
    // Default to quote for new events
    return 'quote';
  };

  const selectedStatusMeta = useMemo(
    () => PRE_EVENT_STATUS_OPTIONS.find(option => option.key === eventStatus) || null,
    [eventStatus]
  );

  const renderStatusLabel = (
    title: string,
    meta: { label: string; icon?: string; key?: SimpleEventStatus } | null = selectedStatusMeta
  ) => (
    <div className="flex items-center justify-between gap-2 w-full">
      <span>{title}</span>
      {meta && (
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="hidden sm:inline">Selected:</span>
          <Chip
            size="sm"
            variant="flat"
            color={meta.key ? eventStatusColorMap[meta.key] : eventStatusColorMap[eventStatus]}
          >
            {meta.icon ? `${meta.icon} ` : ''}
            {meta.label}
          </Chip>
        </span>
      )}
    </div>
  );

  type EventInvoiceStatus = 'Draft' | 'Issued' | 'Partial' | 'Paid' | 'Overdue';
  type ReceiptMethod = 'Cash' | 'Card' | 'Bank Transfer' | 'Mobile Money';

  interface EventInvoice {
    id: string;
    eventId: string;
    eventName: string;
    clientName: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    tax: number;
    total: number;
    balance: number;
    status: EventInvoiceStatus;
    reference?: string;
    notes?: string;
  }

  interface EventReceipt {
    id: string;
    eventId: string;
    eventName: string;
    invoiceId?: string;
    clientName: string;
    date: string;
    amount: number;
    method: ReceiptMethod;
    reference?: string;
    recordedBy: string;
    notes?: string;
  }
  interface EventFolioEntry {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    reference?: string;
    costCenter?: string; // Cost center code for charges (debits)
    revenueCenter?: string; // Revenue center code for payments (credits)
  }

  interface EventFolio {
    id: string;
    eventId: string;
    eventName: string;
    clientName: string;
    status: 'Open' | 'Closed';
    openingBalance: number;
    entries: EventFolioEntry[];
    createdAt: string;
    updatedAt: string;
  }

  interface QuoteListItem {
    id: string;
    eventId?: string;
    quoteNumber: string;
    clientName: string;
    eventName: string;
    checkIn: string;
    checkOut: string;
    pax: number;
    issuedOn: string;
    total: number;
    status: string;
    statusLabel: string;
    reference: string;
    venueName: string;
    rawEvent: any;
  }



  type SortDirection = 'asc' | 'desc';

  interface TableSortState {
    column: string;
    direction: SortDirection;
  }

  const getNextSortState = (prev: TableSortState, column: string): TableSortState => {
    if (!prev || prev.column !== column) {
      return { column, direction: 'asc' };
    }
    return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
  };

  const normalizeSortableValue = (value: any) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) {
      const time = value.getTime();
      return Number.isNaN(time) ? null : time;
    }
    if (typeof value === 'string') return value.toLowerCase();
    return value;
  };

  const compareSortableValues = (a: any, b: any): number => {
    if (a === b) return 0;
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;
    if (typeof a === 'number' && typeof b === 'number') {
      if (a === b) return 0;
      return a < b ? -1 : 1;
    }
    return String(a).localeCompare(String(b));
  };

  const sortRows = <T,>(
    rows: T[],
    sortState: TableSortState | null,
    accessors: Record<string, (row: T) => any>
  ) => {
    if (!sortState) return rows;
    const accessor = accessors[sortState.column];
    if (!accessor) return rows;
    const sorted = [...rows].sort((a, b) => {
      const aValue = normalizeSortableValue(accessor(a));
      const bValue = normalizeSortableValue(accessor(b));
      const comparison = compareSortableValues(aValue, bValue);
      return sortState.direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  };

  const parseDateValue = (value?: string) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const computeEventDurationDays = (event: any) => {
    if (!event) return 1;
    const explicit = Number(event.duration);
    if (!Number.isNaN(explicit) && explicit > 0) return explicit;
    const startStr = event.arrivalDate || event.startDate;
    const endStr = event.departureDate || event.endDate;
    if (startStr && endStr) {
      const start = toStartOfDay(new Date(startStr));
      const end = toStartOfDay(new Date(endStr));
      const diff = Math.round((end.getTime() - start.getTime()) / DAY_IN_MS) + 1;
      if (diff > 0) return diff;
    }
    return 1;
  };

  interface QuoteBudgetSnapshot {
    accommodation: number;
    conference: number;
    dinner: number;
    lunch: number;
    extras: number;
    total: number;
  }

  const [eventInvoices, setEventInvoices] = useState<EventInvoice[]>([
    {
      id: 'INV-EC-2025-001',
      eventId: 'evt-001',
      eventName: 'T-TEL Extended Conference',
      clientName: 'T-TEL',
      issueDate: '2025-07-15',
      dueDate: '2025-07-30',
      subtotal: 45000,
      tax: 6750,
      total: 51750,
      balance: 17250,
      status: 'Partial',
      reference: 'PO-4455',
      notes: 'Initial 50% deposit received. Awaiting balance.'
    },
    {
      id: 'INV-EC-2025-002',
      eventId: 'evt-004',
      eventName: 'Garden City University Workshop',
      clientName: 'Garden City University',
      issueDate: '2025-07-10',
      dueDate: '2025-07-25',
      subtotal: 18000,
      tax: 2700,
      total: 20700,
      balance: 0,
      status: 'Paid',
      reference: 'GC-WS-2025',
      notes: 'Invoice settled in full.'
    }
  ]);

  const [eventReceipts, setEventReceipts] = useState<EventReceipt[]>([
    {
      id: 'RCPT-2025-030',
      eventId: 'evt-001',
      eventName: 'T-TEL Extended Conference',
      invoiceId: 'INV-EC-2025-001',
      clientName: 'T-TEL',
      date: '2025-07-20',
      amount: 34500,
      method: 'Bank Transfer',
      reference: 'TT-DEP-34500',
      recordedBy: 'Akosua Mensah',
      notes: 'Payment advice received via email.'
    },
    {
      id: 'RCPT-2025-044',
      eventId: 'evt-004',
      eventName: 'Garden City University Workshop',
      invoiceId: 'INV-EC-2025-002',
      clientName: 'Garden City University',
      date: '2025-07-18',
      amount: 20700,
      method: 'Mobile Money',
      reference: 'MTN-2025-741',
      recordedBy: 'Yaw Sarfo'
    }
  ]);

  const [eventFolios, setEventFolios] = useState<EventFolio[]>([
    {
      id: 'FOL-EC-001',
      eventId: 'evt-001',
      eventName: 'T-TEL Extended Conference',
      clientName: 'T-TEL',
      status: 'Open',
      openingBalance: 0,
      createdAt: '2025-07-12',
      updatedAt: '2025-08-02',
      entries: [
        { id: 'FLE-001', date: '2025-07-12', description: 'Deposit Received', debit: 0, credit: 30000, balance: -30000 },
        { id: 'FLE-002', date: '2025-07-20', description: 'Conference Package - Week 1', debit: 28000, credit: 0, balance: -2000 },
        { id: 'FLE-003', date: '2025-07-28', description: 'Accommodation Block - 45 rooms', debit: 36000, credit: 0, balance: 34000 }
      ]
    },
    {
      id: 'FOL-EC-002',
      eventId: 'evt-004',
      eventName: 'Garden City University Workshop',
      clientName: 'Garden City University',
      status: 'Closed',
      openingBalance: 0,
      createdAt: '2025-07-05',
      updatedAt: '2025-07-26',
      entries: [
        { id: 'FLE-100', date: '2025-07-05', description: 'Deposit Received', debit: 0, credit: 10000, balance: -10000 },
        { id: 'FLE-101', date: '2025-07-08', description: 'Workshop Package - 3 Days', debit: 18000, credit: 0, balance: 8000 },
        { id: 'FLE-102', date: '2025-07-18', description: 'Balance Payment', debit: 0, credit: 8000, balance: 0 }
      ]
    }
  ]);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceModalMode, setInvoiceModalMode] = useState<'create' | 'edit'>('create');
  const [invoiceForm, setInvoiceForm] = useState<Partial<EventInvoice>>({});
  const [invoiceErrors, setInvoiceErrors] = useState<Record<string, string>>({});

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptModalMode, setReceiptModalMode] = useState<'create' | 'edit'>('create');
  const [receiptForm, setReceiptForm] = useState<Partial<EventReceipt>>({});
  const [receiptErrors, setReceiptErrors] = useState<Record<string, string>>({});

  const [isFolioModalOpen, setIsFolioModalOpen] = useState(false);
  const [activeFolio, setActiveFolio] = useState<any>(null);
const [folioEntryForm, setFolioEntryForm] = useState<{
  type: 'charge' | 'payment';
  amount: number;
  description: string;
  reference?: string;
  costCenter?: string;
  revenueCenter?: string;
  method?: ReceiptMethod;
  recordedBy?: string;
}>({
    type: 'charge',
    amount: 0,
    description: '',
    reference: '',
    costCenter: '',
  revenueCenter: '',
  method: 'Cash',
  recordedBy: 'Events Team'
  });
  const [isFolioCreateModalOpen, setIsFolioCreateModalOpen] = useState(false);
  const [folioCreateForm, setFolioCreateForm] = useState<{ eventId: string; openingBalance: number; note?: string }>({
    eventId: '',
    openingBalance: 0,
    note: ''
  });
  const [folioCreateError, setFolioCreateError] = useState<string>('');
  const [folioEntrySearch, setFolioEntrySearch] = useState('');
  const invoiceStatusMeta: Record<EventInvoiceStatus, { color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'; label: string }> = {
    Draft: { color: 'default', label: 'Draft' },
    Issued: { color: 'primary', label: 'Issued' },
    Partial: { color: 'warning', label: 'Partially Paid' },
    Paid: { color: 'success', label: 'Paid' },
    Overdue: { color: 'danger', label: 'Overdue' }
  };
  const receiptMethods: ReceiptMethod[] = ['Cash', 'Card', 'Bank Transfer', 'Mobile Money'];
  const receiptMethodColors: Record<ReceiptMethod, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
    Cash: 'secondary',
    Card: 'primary',
    'Bank Transfer': 'success',
    'Mobile Money': 'warning'
  };

  const [eventViewMode, setEventViewMode] = useState('table');
  const [eventCalendarView, setEventCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [eventCalendarDate, setEventCalendarDate] = useState<Date>(() => new Date());
  const [selectedGanttVenue, setSelectedGanttVenue] = useState<string>('all');
  const [ganttReferenceDate, setGanttReferenceDate] = useState<Date>(() => new Date());
  const [hoveredGanttEventId, setHoveredGanttEventId] = useState<string | null>(null);

  useEffect(() => {
    setHoveredGanttEventId(null);
  }, [selectedGanttVenue, eventViewMode, ganttReferenceDate]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [programmeTypeFilter, setProgrammeTypeFilter] = useState('all');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isClientViewModalOpen, setIsClientViewModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isClientEditModalOpen, setIsClientEditModalOpen] = useState(false);
  const DeptNotices = require('./DeptNotices').default;
  const DeptMessenger = require('./DeptMessenger').default;
  const RecentActivities = require('./RecentActivities').default;
  const complianceCountry = useComplianceStore(state => state.country);
  const complianceTaxRules = useComplianceStore(state => state.taxRules);
  const complianceCalculateTax = useCalculateTax();
  const printingDefaults = useSettingsStore(state => state.printing);
  const updatePrintingTemplates = useSettingsStore(state => state.updatePrintingTemplates);
  
  // Quote builder state
  const [quoteTaxExempt, setQuoteTaxExempt] = useState<boolean>(false);
  type QuoteServiceLine = { id: string; name: string; category: string; qty: number; unitPrice: number; taxGroup: string };
  type QuoteDay = { id: string; label: string; date: string; services: QuoteServiceLine[] };
  const [quoteDays, setQuoteDays] = useState<QuoteDay[]>([]);
  const quoteTemplateOptions = useMemo(() => listTemplates('proforma'), []);
  const invoiceTemplateOptions = useMemo(() => listTemplates('invoice'), []);
  const [selectedQuoteTemplate, setSelectedQuoteTemplate] = useState<string>(() => printingDefaults?.proforma || quoteTemplateOptions[0]?.key || 'conference-proforma-grid');
  const [selectedInvoiceTemplate, setSelectedInvoiceTemplate] = useState<string>(() => printingDefaults?.invoice || invoiceTemplateOptions[0]?.key || 'corporate-invoice');
  const [activePrintTab, setActivePrintTab] = useState<'quote' | 'xls'>('quote');
  const showQuotePrintTab = useMemo(() => {
    if (!editingEvent) return false;
    const normalizedStatus = normalizeStatus(editingEvent.status);
    const computedStatus = (editingEvent as any).eventStatus;
    const normalizedComputedStatus = computedStatus ? normalizeStatus(computedStatus) : null;
    const isConfirmedOrHigher =
      normalizedStatus === 'confirmed' ||
      normalizedStatus === 'invoiced' ||
      normalizedComputedStatus === 'confirmed' ||
      normalizedComputedStatus === 'invoiced';
    return !isConfirmedOrHigher;
  }, [editingEvent]);

  useEffect(() => {
    if (!showQuotePrintTab && activePrintTab === 'quote') {
      setActivePrintTab('xls');
    }
  }, [showQuotePrintTab, activePrintTab]);

  useEffect(() => {
    if (printingDefaults?.proforma && printingDefaults.proforma !== selectedQuoteTemplate) {
      setSelectedQuoteTemplate(printingDefaults.proforma);
    }
  }, [printingDefaults?.proforma]);

  useEffect(() => {
    if (printingDefaults?.invoice && printingDefaults.invoice !== selectedInvoiceTemplate) {
      setSelectedInvoiceTemplate(printingDefaults.invoice);
    }
  }, [printingDefaults?.invoice]);

  const addQuoteDay = () => {
    const nextIndex = quoteDays.length + 1;
    setQuoteDays(prev => [...prev, { id: `day-${Date.now()}`, label: `Day ${nextIndex}`, date: '', services: [] }]);
  };

  const addPackageToDay = (dayIdx: number) => {
    setQuoteDays(prev => prev.map((d, i) => i === dayIdx ? {
      ...d,
      services: [...d.services, { id: `svc-${Date.now()}`, name: 'Conference Package', category: 'package', qty: 1, unitPrice: 250, taxGroup: 'ghana-standard' }]
    } : d));
  };

  const addCustomServiceToDay = (dayIdx: number) => {
    setQuoteDays(prev => prev.map((d, i) => i === dayIdx ? {
      ...d,
      services: [...d.services, { id: `svc-${Date.now()}`, name: 'Tea/Coffee Break', category: 'catering', qty: 10, unitPrice: 20, taxGroup: 'ghana-standard' }]
    } : d));
  };

  const updateServiceLine = (dayIdx: number, lineIdx: number, patch: Partial<QuoteServiceLine>) => {
    setQuoteDays(prev => prev.map((d, i) => i === dayIdx ? {
      ...d,
      services: d.services.map((s, j) => j === lineIdx ? { ...s, ...patch } : s)
    } : d));
  };

  const removeServiceLine = (dayIdx: number, lineIdx: number) => {
    setQuoteDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, services: d.services.filter((_, j) => j !== lineIdx) } : d));
  };

  const removeQuoteDay = (dayIdx: number) => {
    setQuoteDays(prev => prev.filter((_, i) => i !== dayIdx));
  };

  const DAY_IN_MS = 1000 * 60 * 60 * 24;
  const padNumber = (value: number) => value.toString().padStart(2, '0');
  const toStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const formatDateKey = (date: Date) => `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
  const addDays = (date: Date, days: number) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  };
  const addMonths = (date: Date, months: number) => {
    const copy = new Date(date);
    copy.setMonth(copy.getMonth() + months);
    return copy;
  };
  const getStartOfWeek = (date: Date) => {
    const start = toStartOfDay(date);
    start.setDate(start.getDate() - start.getDay());
    return start;
  };
  const getEndOfWeek = (date: Date) => {
    const start = getStartOfWeek(date);
    return addDays(start, 6);
  };
  const getStartOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
  const getEndOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const clampDateToRange = (date: Date, rangeStart: Date, rangeEnd: Date) => {
    if (date < rangeStart) return new Date(rangeStart);
    if (date > rangeEnd) return new Date(rangeEnd);
    return new Date(date);
  };
  const formatCurrency = (value: number) =>
    `₵${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  // Optimized folio calculations with memoization
  const getFolioCurrentBalance = (folio: EventFolio) => {
    if (!folio || !folio.entries || folio.entries.length === 0) {
      return folio?.openingBalance || 0;
    }
    return folio.entries[folio.entries.length - 1].balance;
  };
  
  // Helper: refresh the active folio from the latest eventFolios state
  const refreshActiveFolioByEvent = (eventId: string) => {
    if (!isFolioModalOpen) return;
    const updatedFolio = eventFolios.find(f => f.eventId === eventId);
    if (updatedFolio) {
      setActiveFolio(updatedFolio);
    }
  };

  const calculateFolioTotals = (folio: EventFolio) => {
    if (!folio || !folio.entries || folio.entries.length === 0) {
      return { debits: 0, credits: 0 };
    }
    return folio.entries.reduce(
      (acc, entry) => {
        acc.debits += entry.debit || 0;
        acc.credits += entry.credit || 0;
        return acc;
      },
      { debits: 0, credits: 0 }
    );
  };
  const deriveInvoiceStatus = (current: EventInvoiceStatus | undefined, balance: number, total: number): EventInvoiceStatus => {
    if (balance <= 0) return 'Paid';
    if (balance < total) return 'Partial';
    if (current && current !== 'Paid') return current;
    return 'Issued';
  };
  const getEventDisplayName = (event: any) => event?.eventName || event?.name || event?.title || 'Unnamed Event';
  const getEventClientName = (event: any) => event?.organization || event?.clientName || event?.contactPerson || '';
  const formatDateDisplay = (value?: string) =>
    value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const formatEventId = (id?: string) => {
    if (!id) return '—';
    // If it's already formatted nicely (e.g., "evt-001"), return as is
    if (id.startsWith('evt-') || id.match(/^[A-Z]{3}-\d+/)) return id;
    // If it's from store format (e.g., "event_1234567890"), format it nicely
    if (id.startsWith('event_')) {
      const timestamp = id.replace('event_', '');
      const date = new Date(parseInt(timestamp));
      const year = date.getFullYear();
      const shortId = timestamp.slice(-4); // Last 4 digits
      return `EVT-${year}-${shortId}`;
    }
    // Otherwise return as is
    return id;
  };

  const computeLine = (line: QuoteServiceLine) => {
    const subtotal = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
    const taxInfo = calculateTaxes({ totalPrice: subtotal, taxGroup: line.taxGroup } as any, quoteTaxExempt);
    const taxAmount = taxInfo.totalTax || 0;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const computeQuoteTotals = () => {
    let subtotal = 0; let tax = 0; let total = 0;
    quoteDays.forEach(d => d.services.forEach(s => { const c = computeLine(s); subtotal += c.subtotal; tax += c.taxAmount; total += c.total; }));
    return { subtotal, tax, total };
  };

  const convertQuoteDaysToTimeline = (days: QuoteDay[], fallbackStart: string) => {
    const baseDate = fallbackStart ? new Date(fallbackStart) : new Date();
    return days.map((day, idx) => {
      let date = day.date;
      if (!date) {
        const next = new Date(baseDate);
        next.setDate(next.getDate() + idx);
        date = next.toISOString().split('T')[0];
      }
      const services = (day.services || []).map((service) => {
        const quantity = Number(service.qty || 0);
        const unitPrice = Number(service.unitPrice || 0);
        return {
          serviceId: service.id,
          serviceName: service.name,
          category: service.category,
          quantity,
          unitPrice,
          totalPrice: quantity * unitPrice,
          taxGroup: service.taxGroup,
          notes: ''
        };
      });
      return {
        date,
        dayNumber: idx + 1,
        dayType: idx === 0 ? 'arrival' : 'program',
        services
      };
    });
  };

  const renderQuoteHtml = (quote: any, totals: { subtotal: number; tax: number; total: number }) => {
    const taxLabel = quote.taxExempt ? '<span style="color:#047857;font-weight:bold;">Tax Exempt</span>' : `Tax: ₵${totals.tax.toFixed(2)}`;
    const timelineHtml = (quote.eventTimeline || []).map((day: any) => {
      const servicesHtml = (day.services || []).map((service: any) => `
        <tr>
          <td>${service.serviceName || service.name}</td>
          <td style="text-align:center;">${Number(service.quantity ?? service.qty ?? 0)}</td>
          <td style="text-align:right;">₵${Number(service.unitPrice ?? 0).toFixed(2)}</td>
          <td style="text-align:right;">₵${Number(service.totalPrice ?? (Number(service.quantity ?? 0) * Number(service.unitPrice ?? 0))).toFixed(2)}</td>
        </tr>
      `).join('');
      return `
        <section style="margin-bottom:24px;">
          <h3 style="font-size:16px;margin-bottom:8px;">Day ${day.dayNumber || ''} • ${day.date || ''} <span style="font-size:12px;color:#666;">${day.dayType || ''}</span></h3>
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="text-align:left;padding:8px;border:1px solid #e5e7eb;">Service</th>
                <th style="text-align:center;padding:8px;border:1px solid #e5e7eb;">Qty</th>
                <th style="text-align:right;padding:8px;border:1px solid #e5e7eb;">Unit Price</th>
                <th style="text-align:right;padding:8px;border:1px solid #e5e7eb;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${servicesHtml || '<tr><td colspan="4" style="text-align:center;padding:12px;border:1px solid #e5e7eb;">No services listed.</td></tr>'}
            </tbody>
          </table>
        </section>
      `;
    }).join('');
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Quote ${quote.quoteNumber || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
            h1 { font-size: 28px; margin-bottom: 4px; }
            h2 { font-size: 20px; margin-top: 32px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; }
            .summary { display: flex; flex-direction: column; gap: 4px; margin-top: 16px; }
            .summary span { font-size: 16px; }
            .badge { display: inline-block; padding: 4px 8px; background: #e0f2fe; color: #0c4a6e; border-radius: 999px; font-size: 12px; margin-left: 8px; }
          </style>
        </head>
        <body>
          <h1>Quote ${quote.quoteNumber || ''}</h1>
          <p style="color:#6b7280;">Created on ${new Date().toLocaleDateString()}</p>

          <section>
            <h2>Client</h2>
            <p><strong>${quote.clientName || 'Client'}</strong></p>
            <p>${quote.clientEmail || ''}</p>
            <p>${quote.clientPhone || ''}</p>
          </section>

          <section>
            <h2>Event</h2>
            <p><strong>${quote.eventName || ''}</strong> ${quote.taxExempt ? '<span class="badge">Tax Exempt</span>' : ''}</p>
            <p>${quote.startDate || ''} to ${quote.endDate || ''} (${quote.totalDays || (quote.eventTimeline?.length || 1)} days)</p>
            ${quote.venueName ? `<p>Venue: ${quote.venueName}</p>` : ''}
          </section>

          <section>
            <h2>Event Timeline</h2>
            ${timelineHtml || '<p>No services recorded.</p>'}
          </section>

          <section class="summary">
            <h2>Financial Summary</h2>
            <span>Subtotal: ₵${totals.subtotal.toFixed(2)}</span>
            <span>${taxLabel}</span>
            <span><strong>Grand Total: ₵${totals.total.toFixed(2)}</strong></span>
            <span>Deposit Required: ${quote.depositRequired || 0}%</span>
            <span>Payment Terms: ${quote.paymentTerms || '50% deposit to confirm booking'}</span>
          </section>

          <section style="margin-top:32px;">
            <h2>Notes</h2>
            <p>${quote.specialRequirements || 'Thank you for choosing Ghana Hotel & Conference Center.'}</p>
          </section>
        </body>
      </html>
    `;
  };

  const getCurrentEventSnapshot = () => {
    const venue = modernVenues.find(v => v.id === venueKey);
    return {
      eventName,
      organization: orgName,
      contactPhone: orgContactPhone,
      contactEmail: orgClientEmail,
      startDate: startDate || '',
      endDate: endDate || '',
      expectedPax,
      venueName: venue?.name || '',
      venueCapacity: venue?.capacity || 0,
      isResidential
    };
  };
  const getContractHtml = (client: any, eventInfo?: any) => {
    if (!client) return '';
    const eventSection = eventInfo ? `
      <div class="section">
        <h2>Event Overview</h2>
        <p><strong>Event Name:</strong> ${eventInfo.eventName || 'TBD'}</p>
        <p><strong>Organization:</strong> ${eventInfo.organization || client.organization}</p>
        <p><strong>Dates:</strong> ${eventInfo.startDate || 'TBD'} to ${eventInfo.endDate || 'TBD'}</p>
        <p><strong>Expected Pax:</strong> ${eventInfo.expectedPax || 'TBD'}</p>
        ${eventInfo.venueName ? `<p><strong>Venue:</strong> ${eventInfo.venueName} (${eventInfo.venueCapacity || 'N/A'} capacity)</p>` : ''}
        <p><strong>Residential:</strong> ${eventInfo.isResidential ? 'Yes' : 'No'}</p>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Event Services Contract - ${client.organization}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; color: #1f2937; }
            .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 24px; }
            .rates-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
            .rate-card { border: 1px solid #d1d5db; padding: 15px; text-align: center; background: #f9fafb; border-radius: 8px; }
            .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; }
            .signature-box { border-top: 2px solid #111827; padding-top: 15px; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="font-size: 28px; margin-bottom: 10px;">EVENT SERVICES CONTRACT</h1>
            <p style="font-size: 18px;">Between Ghana Hotel & Conference Center and ${client.organization}</p>
            <p style="font-size: 14px; color: #6b7280;">Contract Period: ${client.contractStart} to ${client.contractEnd}</p>
          </div>

          <div class="section">
            <h2>Client Details</h2>
            <p><strong>Name:</strong> ${client.name}</p>
            <p><strong>Position:</strong> ${client.position}</p>
            <p><strong>Organization:</strong> ${client.organization}</p>
            <p><strong>Contact:</strong> ${client.contact}</p>
            <p><strong>Email:</strong> ${client.email}</p>
            <p><strong>WhatsApp:</strong> ${client.whatsapp ? 'Available' : 'Not Available'}</p>
          </div>

          ${eventSection}

          <div class="section">
            <h2>Negotiated Rates & Services</h2>
            <div class="rates-grid">
              <div class="rate-card">
                <h3>Accommodation</h3>
                <p style="font-size: 24px; font-weight: bold; color: #4f46e5;">₵${client.rates.accommodation}</p>
                <p style="font-size: 12px; color:#6b7280;">per night</p>
              </div>
              <div class="rate-card">
                <h3>Conference Services</h3>
                <p style="font-size: 24px; font-weight: bold; color: #4f46e5;">₵${client.rates.conference}</p>
                <p style="font-size: 12px; color:#6b7280;">per person</p>
              </div>
              <div class="rate-card">
                <h3>Catering</h3>
                <p style="font-size: 24px; font-weight: bold; color: #4f46e5;">₵${client.rates.catering}</p>
                <p style="font-size: 12px; color:#6b7280;">per person</p>
              </div>
            </div>
          </div>

          ${client.specialTerms ? `
            <div class="section" style="background:#fef3c7; padding:16px; border-radius:8px;">
              <h2>Special Terms & Conditions</h2>
              <p>${client.specialTerms}</p>
            </div>
          ` : ''}

          <div class="section">
            <h2>Standard Contract Terms</h2>
            <ul>
              <li><strong>Payment Terms:</strong> 50% deposit required upon booking, balance due 7 days before event</li>
              <li><strong>Cancellation Policy:</strong> 30 days notice required for full refund, 14 days for 50% refund</li>
              <li><strong>Force Majeure:</strong> Events beyond our control may result in rescheduling or refund</li>
              <li><strong>Liability:</strong> Ghana Hotel & Conference Center liability limited to contract value</li>
              <li><strong>Governing Law:</strong> This contract is governed by the laws of Ghana</li>
            </ul>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <h3>Client Signature</h3>
              <p>Name: ____________________________</p>
              <p>Date: ____________________________</p>
              <p>Signature: _______________________</p>
            </div>
            <div class="signature-box">
              <h3>Hotel Representative</h3>
              <p>Name: ____________________________</p>
              <p>Date: ____________________________</p>
              <p>Signature: _______________________</p>
            </div>
          </div>

          <p style="margin-top:40px; font-size:12px; color:#9ca3af;">Generated on ${new Date().toLocaleDateString()}</p>
        </body>
      </html>
    `;
  };
  const openContractPrintableWindow = (client: any, eventInfo: any, action: 'download' | 'print') => {
    if (!client) return;
    if (typeof window === 'undefined') return;
    const html = getContractHtml(client, eventInfo);
    const win = window.open('', '_blank');
    if (!win) {
      alert(`Please allow pop-ups to ${action === 'download' ? 'download' : 'print'} the contract.`);
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch (err) {
        console.error('Contract print failed', err);
      }
      if (action === 'download') {
        try {
          win.close();
        } catch (err) {
          console.error('Unable to close contract window', err);
        }
      }
    }, 300);
  };

  // Organization autocomplete state for Event Modal (Phase 1)
  const [orgSearch, setOrgSearch] = useState('');
  const [orgClientId, setOrgClientId] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [orgContactPhone, setOrgContactPhone] = useState<string>('');
  const [orgClientEmail, setOrgClientEmail] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');
  const [isResidential, setIsResidential] = useState<boolean>(false);
  const [phase1Error, setPhase1Error] = useState<string>('');
  // Phase 2 & 3 state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [venueKey, setVenueKey] = useState<string>('');
  const [expectedPax, setExpectedPax] = useState<number>(0);
  const [availabilityNote, setAvailabilityNote] = useState<string>('');
  const [dailySchedule, setDailySchedule] = useState<Array<{ date: string; conferencePax: number; lunchPax: number; dinnerPax: number; rooms: number; rate: number; extras: Record<string, number>; extraLines: Array<{ id: string; name: string; qty: number; unitPrice: number; taxGroup: string }> }>>([]);
  const [eventTaxExempt, setEventTaxExempt] = useState<boolean>(false);
  const [defaultDayRate, setDefaultDayRate] = useState<number>(250);
  const [ratesByParticulars, setRatesByParticulars] = useState<boolean>(true);
const [particularLabels, setParticularLabels] = useState<{ conferencePax: string; lunchPax: string; dinnerPax: string; rooms: string }>({
    conferencePax: 'Conference',
    lunchPax: 'Lunch',
    dinnerPax: 'Dinner',
    rooms: 'Accommodation & Breakfast'
  });
  const [hiddenParticulars, setHiddenParticulars] = useState<Record<string, boolean>>({});
  // Phase 4 controls
  const [prepaymentEnabled, setPrepaymentEnabled] = useState<boolean>(false);
  const [prepaymentType, setPrepaymentType] = useState<'percent'|'amount'>('percent');
  const [prepaymentValue, setPrepaymentValue] = useState<number>(0);
  const [showPrepaymentModal, setShowPrepaymentModal] = useState(false);
  const [discountEnabled, setDiscountEnabled] = useState<boolean>(false);
  const [discountType, setDiscountType] = useState<'percent'|'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [conferenceRate, setConferenceRate] = useState<number>(250);
  const [lunchRate, setLunchRate] = useState<number>(0);
  const [dinnerRate, setDinnerRate] = useState<number>(0);
  const [roomRate, setRoomRate] = useState<number>(0);
  const [customParticulars, setCustomParticulars] = useState<Array<{ id: string; label: string; rate: number }>>([]);
  
  useEffect(() => {
    if (venueKey && !modernVenues.some(venue => venue.id === venueKey)) {
      setVenueKey('');
    }
  }, [modernVenues, venueKey]);

  useEffect(() => {
    if (
      selectedGanttVenue !== 'all' &&
      selectedGanttVenue !== 'unassigned' &&
      !modernVenues.some(venue => venue.id === selectedGanttVenue)
    ) {
      setSelectedGanttVenue('all');
    }
  }, [modernVenues, selectedGanttVenue]);
  
  // Conference Rates Management - shared state
  const [conferenceRates, setConferenceRates] = useState<any[]>([
    {
      id: 'rate-001',
      name: 'Standard Accommodation Rate',
      type: 'accommodation',
      baseRate: 200,
      unit: 'per_room',
      customLabel: 'Accommodation',
      applicableDates: { startDate: '2025-01-01', endDate: '2025-12-31', isAllYear: true },
      clientSpecific: false,
      clientId: '',
      clientName: '',
      isActive: true,
      notes: 'Standard room rate for all guests',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01'
    },
    {
      id: 'rate-002',
      name: 'Conference Hall Rate',
      type: 'conference',
      baseRate: 300,
      unit: 'per_person',
      customLabel: 'Conference',
      applicableDates: { startDate: '2025-01-01', endDate: '2025-12-31', isAllYear: true },
      clientSpecific: false,
      clientId: '',
      clientName: '',
      isActive: true,
      notes: 'Standard conference rate per person per day',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01'
    },
    {
      id: 'rate-003',
      name: 'Lunch Rate',
      type: 'lunch',
      baseRate: 50,
      unit: 'per_person',
      customLabel: 'Lunch',
      applicableDates: { startDate: '2025-01-01', endDate: '2025-12-31', isAllYear: true },
      clientSpecific: false,
      clientId: '',
      clientName: '',
      isActive: true,
      notes: 'Standard lunch rate per person',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01'
    },
    {
      id: 'rate-004',
      name: 'Dinner Rate',
      type: 'dinner',
      baseRate: 80,
      unit: 'per_person',
      customLabel: 'Dinner',
      applicableDates: { startDate: '2025-01-01', endDate: '2025-12-31', isAllYear: true },
      clientSpecific: false,
      clientId: '',
      clientName: '',
      isActive: true,
      notes: 'Standard dinner rate per person',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01'
    },
    {
      id: 'rate-005',
      name: 'T-Tel Accommodation & Breakfast Rate',
      type: 'accommodation',
      baseRate: 180,
      unit: 'per_room',
      customLabel: 'Accommodation & Breakfast',
      applicableDates: { startDate: '2025-01-01', endDate: '2025-12-31', isAllYear: true },
      clientSpecific: true,
      clientId: '',
      clientName: 'T-Tel',
      isActive: true,
      notes: 'Special corporate rate for T-Tel',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01'
    },
    {
      id: 'rate-006',
      name: 'Agrivest Co Conference with 2 Snacks Rate',
      type: 'conference',
      baseRate: 250,
      unit: 'per_person',
      customLabel: 'Conference with 2 Snacks',
      applicableDates: { startDate: '2025-01-01', endDate: '2025-12-31', isAllYear: true },
      clientSpecific: true,
      clientId: '',
      clientName: 'Agrivest Co',
      isActive: true,
      notes: 'Negotiated rate for Agrivest Co conferences',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01'
    }
  ]);

  // Auto-populate rates when organization is selected
  useEffect(() => {
    if (!orgName || isViewMode) return;

    const orgNameLower = orgName.toLowerCase().trim();
    if (!orgNameLower) return;

    // Find rates for this organization (client-specific first, then general)
    // Match if organization name contains rate client name OR rate client name contains organization name
    const clientSpecificRates = conferenceRates.filter(rate => {
      if (!rate.isActive || !rate.clientSpecific) return false;
      const rateClientNameLower = (rate.clientName || '').toLowerCase().trim();
      return rateClientNameLower && (
        rateClientNameLower.includes(orgNameLower) || 
        orgNameLower.includes(rateClientNameLower)
      );
    });

    const generalRates = conferenceRates.filter(rate => 
      rate.isActive && 
      !rate.clientSpecific
    );

    // Use client-specific rates if available, otherwise use general rates
    const ratesToUse = clientSpecificRates.length > 0 ? clientSpecificRates : generalRates;

    // Check if dates are applicable (if not all year)
    const applicableRates = ratesToUse.filter(rate => {
      if (rate.applicableDates.isAllYear) return true;
      if (!startDate) return true; // If no start date set yet, include all
      const rateStart = new Date(rate.applicableDates.startDate);
      const rateEnd = new Date(rate.applicableDates.endDate);
      const eventStart = new Date(startDate);
      return eventStart >= rateStart && eventStart <= rateEnd;
    });

    // Auto-populate rates based on type (only if not already set or if client-specific)
    // For client-specific rates, always update. For general rates, only if not already set.
    const shouldUpdate = (type: string) => {
      if (clientSpecificRates.length > 0) return true; // Always update for client-specific
      // For general rates, only update if current value is 0 or default
      if (type === 'accommodation') return roomRate === 0;
      if (type === 'conference') return conferenceRate === 250; // Default is 250
      if (type === 'lunch') return lunchRate === 0;
      if (type === 'dinner') return dinnerRate === 0;
      return false;
    };

    // Map to store custom labels from rates
    const labelUpdates: Partial<{ conferencePax: string; lunchPax: string; dinnerPax: string; rooms: string }> = {};

    applicableRates.forEach(rate => {
      const customLabel = rate.customLabel || '';
      // Always update labels from rates if they have custom labels, even if rate value isn't changing
      // This ensures custom names from rate management reflect in Phase 3
      if (rate.type === 'accommodation' && rate.unit === 'per_room') {
        if (shouldUpdate('accommodation')) {
        setRoomRate(rate.baseRate);
        }
        if (customLabel) labelUpdates.rooms = customLabel;
      } else if (rate.type === 'conference' && rate.unit === 'per_person') {
        if (shouldUpdate('conference')) {
        setConferenceRate(rate.baseRate);
        }
        if (customLabel) labelUpdates.conferencePax = customLabel;
      } else if (rate.type === 'lunch' && rate.unit === 'per_person') {
        if (shouldUpdate('lunch')) {
        setLunchRate(rate.baseRate);
        }
        if (customLabel) labelUpdates.lunchPax = customLabel;
      } else if (rate.type === 'dinner' && rate.unit === 'per_person') {
        if (shouldUpdate('dinner')) {
        setDinnerRate(rate.baseRate);
        }
        if (customLabel) labelUpdates.dinnerPax = customLabel;
      }
    });

    // Update particularLabels with custom labels from rates
    if (Object.keys(labelUpdates).length > 0) {
      setParticularLabels(prev => ({ ...prev, ...labelUpdates }));
    }
  }, [orgName, conferenceRates, startDate, isViewMode, roomRate, conferenceRate, lunchRate, dinnerRate]);
  // Phase 4 - Packages & Add-Ons
  type Package = { id: string; name: string; description: string; rateType: 'per_person_per_day'|'flat_per_day'|'flat_total'; price: number };
  type AddOn = { id: string; name: string; price: number; billing: 'per_day'|'flat_total'|'per_person_per_day' };
  const packages: Package[] = [
    { id: 'pkg-gold', name: 'Gold Conference Package', description: 'Full conference with premium services', rateType: 'per_person_per_day', price: 250 },
    { id: 'pkg-silver', name: 'Silver Conference Package', description: 'Standard conference package', rateType: 'per_person_per_day', price: 180 },
    { id: 'pkg-bronze', name: 'Bronze Conference Package', description: 'Basic conference essentials', rateType: 'per_person_per_day', price: 120 }
  ];
  const addOns: AddOn[] = [
    { id: 'ao-mics', name: 'Extra Microphones', price: 200, billing: 'per_day' },
    { id: 'ao-charts', name: 'Flip Charts', price: 150, billing: 'per_day' },
    { id: 'ao-cookies', name: 'Branded Cookies', price: 100, billing: 'per_day' },
    { id: 'ao-lunch', name: 'Special Lunch Menu', price: 300, billing: 'per_person_per_day' }
  ];
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<Record<string, boolean>>({});
  const [capacityOk, setCapacityOk] = useState<boolean>(false);
  const [clashCount, setClashCount] = useState<number>(0);
  const [hasWarnings, setHasWarnings] = useState<boolean>(false);
  const [conflictingEvents, setConflictingEvents] = useState<any[]>([]);

  // capacity lookup will be done lazily in effects to avoid TDZ with modernVenues

  const regenerateSchedule = (s: string, e: string, pax: number, residential: boolean) => {
    if (!s || !e) { setDailySchedule([]); return; }
    const start = new Date(s);
    const end = new Date(e);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) { setDailySchedule([]); return; }
    const days: Array<{ date: string; conferencePax: number; lunchPax: number; dinnerPax: number; rooms: number; rate: number; extras: Record<string, number>; extraLines: { id: string; name: string; qty: number; unitPrice: number; taxGroup: string }[] }>=[];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = new Date(d).toISOString().slice(0,10);
      const rooms = residential ? (pax || 0) : 0;
      days.push({ date: iso, conferencePax: pax || 0, lunchPax: pax || 0, dinnerPax: pax || 0, rooms, rate: defaultDayRate || 0, extras: {}, extraLines: [] });
    }
    setDailySchedule(days);
  };

  useEffect(() => {
    // Availability and clash checks
    if (!venueKey || !startDate || !endDate || !expectedPax) {
      setAvailabilityNote('Select dates, venue and expected pax to check availability...');
      regenerateSchedule(startDate, endDate, expectedPax, isResidential);
      return;
    }

    const cap = ((Array.isArray(modernVenues) ? modernVenues : []).find(v => v.id === venueKey)?.capacity) || 0;
    const baseMsg = expectedPax <= cap
      ? `Venue OK: capacity ${cap} ≥ expected ${expectedPax}.`
      : `Capacity exceeded: expected ${expectedPax} > capacity ${cap}.`;

    const newEventDraft: any = {
      id: 'draft',
      venue: venueKey,
      arrivalDate: startDate,
      departureDate: endDate,
      pax: expectedPax,
      residential: isResidential
    };

    const clashes = checkForClashes(newEventDraft);
    const warnings = checkResourceOverload(newEventDraft);

    const clashText = clashes.length
      ? ` Clash: ${clashes.length} existing programme${clashes.length>1?'s':''} at this venue within the dates.`
      : '';
    const warningText = warnings.length
      ? ` Warnings: ${warnings.map(w=>w.type).join(', ')}.`
      : '';

    setAvailabilityNote(`${baseMsg}${clashText}${warningText}`.trim());
    setCapacityOk(expectedPax <= cap);
    setClashCount(clashes.length);
    setHasWarnings(warnings.length > 0);
    setConflictingEvents(clashes);
    regenerateSchedule(startDate, endDate, expectedPax, isResidential);
  }, [startDate, endDate, venueKey, expectedPax, isResidential]);

  // Ensure Phase 3 defaults mirror Expected Pax on change
  useEffect(() => {
    if (dailySchedule.length > 0) {
      setDailySchedule(prev => prev.map(row => ({
        ...row,
        conferencePax: expectedPax || 0,
        lunchPax: expectedPax || 0,
        dinnerPax: expectedPax || 0,
        rooms: isResidential ? (expectedPax || 0) : row.rooms
      })));
    }
  }, [expectedPax]);

  const computeDayAmounts = (row: { conferencePax: number; rate: number; extraLines?: Array<{ qty: number; unitPrice: number; taxGroup: string }> }) => {
    let subtotal = (Number(row.conferencePax) || 0) * (Number(row.rate) || 0);
    if (row.extraLines && row.extraLines.length) {
      row.extraLines.forEach((ln) => { subtotal += (Number(ln.qty) || 0) * (Number(ln.unitPrice) || 0); });
    }
    return { subtotal };
  };

  const activeComplianceRules = React.useMemo(() => {
    return (complianceTaxRules || []).filter(rule => rule.countryCode === complianceCountry);
  }, [complianceTaxRules, complianceCountry]);

  const complianceRuleMap = React.useMemo(() => {
    const map = new Map<string, any>();
    activeComplianceRules.forEach(rule => {
      map.set(rule.name, rule);
    });
    return map;
  }, [activeComplianceRules]);

  const computeEventTotals = () => {
    const numDays = dailySchedule.length;
    const totalPax = dailySchedule.reduce((s, r) => s + (r.conferencePax || 0), 0);

    let subtotal = 0;

    if (ratesByParticulars) {
      const sum = dailySchedule.reduce((acc, r) => {
        acc.conf += r.conferencePax;
        acc.lunch += r.lunchPax;
        acc.dinner += r.dinnerPax;
        acc.rooms += r.rooms;
        return acc;
      }, { conf: 0, lunch: 0, dinner: 0, rooms: 0 });

      const extrasSubtotal = customParticulars.reduce((s, p) => {
        const qty = dailySchedule.reduce((qq, r) => qq + (r.extras?.[p.id] || 0), 0);
        return s + qty * (p.rate || 0);
      }, 0);

      subtotal =
        (sum.conf * (conferenceRate || 0)) +
        (sum.lunch * (lunchRate || 0)) +
        (sum.dinner * (dinnerRate || 0)) +
        (sum.rooms * (roomRate || 0)) +
        extrasSubtotal;
    } else {
      subtotal = dailySchedule.reduce((acc, row) => {
        const c = computeDayAmounts(row);
        return acc + c.subtotal;
      }, 0);
    }

    const discountAmount = discountEnabled
      ? (discountType === 'percent'
        ? ((subtotal * (discountValue || 0)) / 100)
        : (discountValue || 0))
      : 0;
    subtotal = Math.max(0, subtotal - discountAmount);

    if (selectedPackageId) {
      const pkg = packages.find(p => p.id === selectedPackageId);
      if (pkg) {
        if (pkg.rateType === 'per_person_per_day') subtotal += (pkg.price || 0) * totalPax;
        if (pkg.rateType === 'flat_per_day') subtotal += (pkg.price || 0) * numDays;
        if (pkg.rateType === 'flat_total') subtotal += (pkg.price || 0);
      }
    }

    const addOnSubtotal = Object.entries(selectedAddOnIds).reduce((s, [id, on]) => {
      if (!on) return s;
      const ao = addOns.find(a => a.id === id);
      if (!ao) return s;
      if (ao.billing === 'per_day') return s + (ao.price || 0) * numDays;
      if (ao.billing === 'per_person_per_day') return s + (ao.price || 0) * totalPax;
      return s + (ao.price || 0);
    }, 0);
    subtotal += addOnSubtotal;
    let taxImpact = 0;
    const taxBreakdown: Array<{ name: string; rate: number | null; method?: string; fixedAmount?: number | null; amount: number; effect?: string }> = [];

    if (subtotal > 0 && typeof complianceCalculateTax === 'function') {
      const taxResult = complianceCalculateTax(subtotal, 'EVENT', {
        domain: 'sales',
        operation: 'external',
        numPersons: totalPax || expectedPax || 0,
        numNights: numDays || 0,
        isResidential
      });

      (taxResult?.taxes || []).forEach((tax: any) => {
        const rule = complianceRuleMap.get(tax.name);
        const method = rule?.method || 'rate';
        const effect = rule?.effect || 'add';
        const rateValue = method === 'rate' ? (rule?.rate ?? null) : null;
        const fixedAmount = method === 'fixed' ? (rule?.fixedAmount ?? null) : null;
        const baseAmount = Number(tax?.amount || 0);
        const appliedAmount = eventTaxExempt
          ? 0
          : effect === 'subtract'
            ? -Math.abs(baseAmount)
            : baseAmount;
        if (!eventTaxExempt && effect !== 'exclude_total' && effect !== 'informational') {
          taxImpact += appliedAmount;
        }
        taxBreakdown.push({
          name: tax.name,
          rate: rateValue,
          method,
          fixedAmount,
          amount: appliedAmount,
          effect
        });
      });
    }

    const total = subtotal + taxImpact;

    return { subtotal, tax: taxImpact, total, taxBreakdown, discountAmount };
  };

  // Per-day extras helpers
  const addExtraLineToDay = (dayIdx: number) => {
    setDailySchedule(prev => prev.map((d, i) => i === dayIdx ? {
      ...d,
      extraLines: [...(d.extraLines||[]), { id: `ex-${Date.now()}`, name: 'Extra Service', qty: 1, unitPrice: 0, taxGroup: 'ghana-standard' }]
    } : d));
  };

  const updateExtraLineOnDay = (dayIdx: number, lineIdx: number, patch: Partial<{ name: string; qty: number; unitPrice: number; taxGroup: string }>) => {
    setDailySchedule(prev => prev.map((d, i) => i === dayIdx ? {
      ...d,
      extraLines: (d.extraLines||[]).map((ln, j) => j === lineIdx ? { ...ln, ...patch } : ln)
    } : d));
  };

  const removeExtraLineFromDay = (dayIdx: number, lineIdx: number) => {
    setDailySchedule(prev => prev.map((d, i) => i === dayIdx ? { ...d, extraLines: (d.extraLines||[]).filter((_, j) => j !== lineIdx) } : d));
  };

  const eventTotals = computeEventTotals();
  const prepaymentDisplay = prepaymentEnabled ? (prepaymentType === 'percent' ? `${prepaymentValue}%` : `₵${prepaymentValue}`) : '—';
  const prepaymentAmount = prepaymentEnabled
    ? Math.max(0, prepaymentType === 'percent'
      ? (eventTotals.total * (prepaymentValue || 0) / 100)
      : (prepaymentValue || 0))
    : 0;
  const cappedPrepaymentAmount = Math.min(prepaymentAmount, eventTotals.total);
  const balanceDue = Math.max(0, eventTotals.total - cappedPrepaymentAmount);
  const detailedTaxRows = React.useMemo(() => {
    if (eventTotals.taxBreakdown.length) {
      return eventTotals.taxBreakdown.map((tax) => ({
        name: tax.name,
        method: tax.method || 'rate',
        rate: tax.method === 'fixed' ? null : (tax.rate ?? null),
        fixedAmount: tax.method === 'fixed' ? (tax.fixedAmount ?? null) : null,
        effect: tax.effect || 'add',
        amount: eventTaxExempt ? 0 : tax.amount
      }));
    }
    return activeComplianceRules.map(rule => ({
      name: rule.name,
      method: rule.method || 'rate',
      rate: (rule.method || 'rate') === 'fixed' ? null : (rule.rate ?? null),
      fixedAmount: (rule.method || 'rate') === 'fixed' ? (rule.fixedAmount ?? null) : null,
      effect: rule.effect || 'add',
      amount: 0
    }));
  }, [eventTotals.taxBreakdown, activeComplianceRules, eventTaxExempt]);

  const mapTaxBreakdownToPrint = (breakdown: Array<{ name?: string; amount?: number }>) => {
    const taxes: Partial<Record<'vat' | 'nhil' | 'levy' | 'covid' | 'gefl' | 'gtal', number>> = {};
    breakdown.forEach((entry) => {
      if (!entry) return;
      const name = (entry.name || '').toLowerCase();
      const amount = Number(entry.amount || 0);
      if (!name) return;
      if (name.includes('vat')) {
        taxes.vat = amount;
      } else if (name.includes('nhil')) {
        taxes.nhil = amount;
      } else if (name.includes('getfund') || name.includes('gef')) {
        taxes.gefl = amount;
      } else if (name.includes('covid')) {
        taxes.covid = amount;
      } else if (name.includes('gta')) {
        taxes.gtal = amount;
      } else if (name.includes('levy')) {
        taxes.levy = amount;
      }
    });
    return taxes;
  };
  const buildEventPrintData = (docType: 'proforma' | 'invoice') => {
    const settingsState = useSettingsStore.getState() as any;
    const baseQuote = buildQuoteForExport();
    const items: Array<{ description: string; qty?: number; unit?: string; unitPrice?: number; amount: number; date?: string }> = [];

    if (baseQuote?.eventTimeline?.length) {
      baseQuote.eventTimeline.forEach((day: any) => {
        const dayLabel = day?.label || (day?.dayNumber ? `Day ${day.dayNumber}` : '');
        (day?.services || []).forEach((service: any) => {
          const qty = Number(service?.quantity ?? service?.qty ?? 0) || 0;
          const unitPrice = Number(service?.unitPrice ?? 0) || 0;
          const amount = Number(service?.totalPrice ?? (qty * unitPrice)) || 0;
          items.push({
            description: `${dayLabel ? `${dayLabel} • ` : ''}${service?.serviceName || service?.name || 'Service'}`,
            qty: qty || undefined,
            unit: qty ? 'pax' : undefined,
            unitPrice,
            amount,
            date: day?.date
          });
        });
      });
    }

    if (!items.length) {
      const fallbackAmount = Number(eventTotals.subtotal || 0);
      items.push({
        description: eventName || 'Event Services',
        qty: dailySchedule.length || undefined,
        unit: dailySchedule.length > 1 ? 'days' : undefined,
        unitPrice: fallbackAmount,
        amount: fallbackAmount,
        date: startDate || new Date().toISOString().split('T')[0]
      });
    }

    const orgProfile = {
      name: settingsState?.organization?.name || settingsState?.companySettings?.tradingName || 'Hotel',
      address: settingsState?.organization?.address || settingsState?.companySettings?.address?.line1 || '',
      phone: settingsState?.organization?.phone || settingsState?.companySettings?.contact?.phone || '',
      email: settingsState?.organization?.email || settingsState?.companySettings?.contact?.email || '',
      taxId: settingsState?.organization?.taxId || settingsState?.companySettings?.taxId || '',
      logoUrl: settingsState?.branding?.logoUrl || settingsState?.companySettings?.logoUrl || ''
    };

    const totalDays = dailySchedule.length || baseQuote?.totalDays || 1;
    const documentNumber = docType === 'invoice'
      ? (editingEvent?.invoiceNumber || (editingEvent?.id ? `INV-${editingEvent.id}` : `INV-${Date.now()}`))
      : (baseQuote?.quoteNumber || editingEvent?.quoteNumber || `Q-${Date.now()}`);
    const title = docType === 'invoice' ? 'Invoice' : 'Quotation';
    const taxSpread = mapTaxBreakdownToPrint(eventTotals.taxBreakdown);
    const printTotals: any = {
      subTotal: Number(eventTotals.subtotal || 0),
      taxes: taxSpread,
      grandTotal: Number(eventTotals.total || 0),
      payments: prepaymentEnabled ? cappedPrepaymentAmount : 0,
      balance: balanceDue
    };
    if (eventTotals.discountAmount) {
      printTotals.discount = Number(eventTotals.discountAmount || 0);
    }
    if (prepaymentEnabled && cappedPrepaymentAmount > 0) {
      printTotals.advance = cappedPrepaymentAmount;
    }
    return {
      org: orgProfile,
      guest: {
        name: orgName || baseQuote?.clientName || 'Client',
        company: orgName || baseQuote?.clientName || '',
        roomNumber: undefined,
        roomType: undefined,
        arrivalDate: startDate || baseQuote?.startDate || '',
        departureDate: endDate || baseQuote?.endDate || '',
        nights: totalDays
      },
      docNumber: documentNumber,
      docDate: new Date().toISOString(),
      title,
      items,
      totals: printTotals,
      footerNotes: [
        'Generated via Events & Conferences workflow.',
        docType === 'invoice'
          ? 'Invoice layout provided by Settings • Template Builder.'
          : 'Quotation layout provided by Settings • Template Builder.'
      ],
      currency: '₵'
    };
  };

  useEffect(() => {
    if (isEventModalOpen) {
      const eventToLoad = customEvents.find(ev => ev.id === editingEvent?.id) || editingEvent || null;
      const resolvedStart = eventToLoad?.arrivalDate || eventToLoad?.startDate || '';
      const resolvedEnd = eventToLoad?.departureDate || eventToLoad?.endDate || '';

      setEventName(eventToLoad?.eventName || eventToLoad?.name || '');
      setOrgName(eventToLoad?.organization || '');
      setOrgContactPhone(eventToLoad?.contactPhone || eventToLoad?.contact || '');
      setOrgClientEmail(eventToLoad?.contactEmail || eventToLoad?.clientEmail || '');
      setIsResidential(Boolean(eventToLoad?.residential ?? eventToLoad?.isResidential));
      setOrgClientId(eventToLoad?.clientId || '');
      setOrgSearch(eventToLoad?.organization || '');
      setEventStatus(normalizeStatus(eventToLoad?.status));
      setStartDate(resolvedStart);
      setEndDate(resolvedEnd);
      setVenueKey(eventToLoad?.venue || eventToLoad?.venueKey || '');
      setExpectedPax(
        typeof eventToLoad?.expectedPax === 'number'
          ? eventToLoad.expectedPax
          : (eventToLoad?.pax || 0)
      );
      setEventTaxExempt(Boolean(eventToLoad?.taxExempt ?? eventToLoad?.isTaxExempt));
      setQuoteTaxExempt(Boolean(eventToLoad?.taxExempt));

      let loadedSchedule = false;
      if (Array.isArray(eventToLoad?.dailySchedule) && eventToLoad.dailySchedule.length) {
        setDailySchedule(eventToLoad.dailySchedule);
        loadedSchedule = true;
      }

      if (eventToLoad?.customParticulars) {
        setCustomParticulars(eventToLoad.customParticulars);
      } else {
        setCustomParticulars([]);
      }

      if (typeof eventToLoad?.ratesByParticulars === 'boolean') {
        setRatesByParticulars(eventToLoad.ratesByParticulars);
      }

      if (typeof eventToLoad?.conferenceRate === 'number') setConferenceRate(eventToLoad.conferenceRate);
      if (typeof eventToLoad?.lunchRate === 'number') setLunchRate(eventToLoad.lunchRate);
      if (typeof eventToLoad?.dinnerRate === 'number') setDinnerRate(eventToLoad.dinnerRate);
      if (typeof eventToLoad?.roomRate === 'number') setRoomRate(eventToLoad.roomRate);
      if (typeof eventToLoad?.defaultDayRate === 'number') setDefaultDayRate(eventToLoad.defaultDayRate);

      if (!loadedSchedule) {
        const scheduleInfo = convertTimelineToDailySchedule(
          eventToLoad?.eventTimeline || [],
          resolvedStart || startDate || new Date().toISOString().split('T')[0]
        );
        if (scheduleInfo.schedule.length > 0) {
          setDailySchedule(scheduleInfo.schedule);
          setRatesByParticulars(scheduleInfo.useParticulars);
          setConferenceRate(scheduleInfo.rates.conferenceRate);
          setLunchRate(scheduleInfo.rates.lunchRate);
          setDinnerRate(scheduleInfo.rates.dinnerRate);
          setRoomRate(scheduleInfo.rates.roomRate);
          setDefaultDayRate(scheduleInfo.rates.packageRate);
          if (!eventToLoad?.expectedPax) setExpectedPax(scheduleInfo.expectedPax);
        }
      }
      setEventSubmitting(false);
    } else {
      setEventStatus('quote');
      setEventSubmitting(false);
      setEventName('');
      setOrgName('');
      setOrgContactPhone('');
      setOrgClientEmail('');
      setIsResidential(false);
      setOrgClientId('');
      setOrgSearch('');
      setStartDate('');
      setEndDate('');
      setVenueKey('');
      setExpectedPax(0);
      setDailySchedule([]);
      setCustomParticulars([]);
      setRatesByParticulars(true);
      setConferenceRate(250);
      setLunchRate(0);
      setDinnerRate(0);
      setRoomRate(0);
      setDefaultDayRate(250);
      setEventTaxExempt(false);
      setQuoteTaxExempt(false);
    }
  }, [isEventModalOpen, editingEvent]);

  // Sample events data - in real app, this would come from stores
  const totalEvents = 24;
  const activeEvents = 8;
  const completedEvents = 12;
  const cancelledEvents = 4;
  
  // Venue metrics
  const totalVenues = modernVenues.length;
  const availableVenues = modernVenues.filter(venue => venue.status === 'available').length;
  const bookedVenues = modernVenues.filter(venue => venue.status === 'booked').length;
  const maintenanceVenues = modernVenues.filter(venue => venue.status === 'maintenance').length;
  
  // Revenue metrics
  
  // Today's operations
  const eventsToday = 3;
  const newBookings = 2;
  const eventsCompleted = 1;
  const setupInProgress = modernVenues.filter(venue => venue.status === 'setup').length;

  // Sample data for tables
  const events = [
    {
      id: 'evt-001',
      name: 'Ghana Tech Conference 2024',
      venue: 'Accra Conference Hall',
      date: '2024-03-15',
      time: '09:00 AM',
      attendees: 200,
      status: 'confirmed',
      type: 'conference',
      revenue: 15000,
      organizer: 'Tech Ghana Ltd'
    },
    {
      id: 'evt-002',
      name: 'Wedding Reception - Sarah & John',
      venue: 'Ghana Banquet Hall',
      date: '2024-03-20',
      time: '06:00 PM',
      attendees: 150,
      status: 'confirmed',
      type: 'wedding',
      revenue: 8000,
      organizer: 'Sarah Johnson'
    },
    {
      id: 'evt-003',
      name: 'Corporate Training Session',
      venue: 'Kumasi Meeting Room',
      date: '2024-03-18',
      time: '10:00 AM',
      attendees: 25,
      status: 'confirmed',
      type: 'training',
      revenue: 3000,
      organizer: 'Corporate Solutions Inc'
    },
    {
      id: 'evt-004',
      name: 'Product Launch Event',
      venue: 'Accra Auditorium',
      date: '2024-03-25',
      time: '07:00 PM',
      attendees: 300,
      status: 'pending',
      type: 'launch',
      revenue: 20000,
      organizer: 'Innovation Corp'
    }
  ];
  // Sample client data for contract management
  const sampleClients = [
    {
      id: 'client-001',
      name: 'Kwame Asante',
      position: 'Events Manager',
      organization: 'Ghana Tech Solutions',
      industry: 'Technology',
      contact: '+233 24 123 4567',
      email: 'kwame.asante@ghanatech.com',
      whatsapp: true,
      contractStatus: 'active',
      rates: {
        accommodation: 450,
        conference: 250,
        catering: 180
      },
      contractStart: '2024-01-01',
      contractEnd: '2024-12-31',
      specialTerms: 'Corporate discount applied, 15% off accommodation for groups of 20+'
    },
    {
      id: 'client-002',
      name: 'Ama Osei',
      position: 'Marketing Director',
      organization: 'Accra Business Network',
      industry: 'Business Services',
      contact: '+233 26 987 6543',
      email: 'ama.osei@accrabusiness.com',
      whatsapp: true,
      contractStatus: 'active',
      rates: {
        accommodation: 380,
        conference: 200,
        catering: 150
      },
      contractStart: '2024-02-01',
      contractEnd: '2024-12-31',
      specialTerms: 'Monthly retainer for regular events, priority booking'
    },
    {
      id: 'client-003',
      name: 'Kofi Mensah',
      position: 'CEO',
      organization: 'Kumasi Ventures',
      industry: 'Manufacturing',
      contact: '+233 20 555 1234',
      email: 'kofi.mensah@kumasiventures.com',
      whatsapp: false,
      contractStatus: 'pending',
      rates: {
        accommodation: 500,
        conference: 300,
        catering: 220
      },
      contractStart: '2024-03-01',
      contractEnd: '2024-12-31',
      specialTerms: 'Premium package, dedicated event coordinator'
    },
    {
      id: 'client-004',
      name: 'Efua Addo',
      position: 'HR Manager',
      organization: 'Ghana Education Trust',
      industry: 'Education',
      contact: '+233 27 777 8888',
      email: 'efua.addo@ghanatrust.edu.gh',
      whatsapp: true,
      contractStatus: 'expired',
      rates: {
        accommodation: 320,
        conference: 180,
        catering: 120
      },
      contractStart: '2023-01-01',
      contractEnd: '2023-12-31',
      specialTerms: 'Educational institution discount, flexible payment terms'
    }
  ];

  // Comprehensive Quoting System Data Structures
  
  // Tax Structure for Ghana
  const ghanaTaxes = [
    { id: 'nhil', name: 'NHIL', rate: 2.5, authority: 'National Health Insurance', appliesTo: ['all'] },
    { id: 'getfund', name: 'GETFund Levy', rate: 2.5, authority: 'Ghana Education Trust Fund', appliesTo: ['all'] },
    { id: 'covid', name: 'COVID-19 Levy', rate: 1.0, authority: 'Government of Ghana', appliesTo: ['all'] },
    { id: 'vat', name: 'VAT', rate: 15.0, authority: 'Ghana Revenue Authority', appliesTo: ['all'] },
    { id: 'gta', name: 'GTA Levy', rate: 1.0, authority: 'Ghana Tourism Authority', appliesTo: ['accommodation', 'venue', 'tourism'] }
  ];
  // Tax Groups for easy application
  const taxGroups = [
    {
      id: 'ghana-standard',
      name: 'Ghana Standard',
      description: 'Full Ghana tax suite: NHIL + GETFund + COVID + VAT + GTA',
      taxes: ['nhil', 'getfund', 'covid', 'vat', 'gta'],
      totalRate: 22.0
    },
    {
      id: 'ghana-basic',
      name: 'Ghana Basic',
      description: 'Basic taxes: NHIL + GETFund + COVID + VAT',
      taxes: ['nhil', 'getfund', 'covid', 'vat'],
      totalRate: 21.0
    },
    {
      id: 'vat-only',
      name: 'VAT Only',
      description: 'VAT only (15%)',
      taxes: ['vat'],
      totalRate: 15.0
    }
  ];
  // Service Packages
  const servicePackages = [
    {
      id: 'gold-conference',
      name: 'Gold Conference Package',
      description: 'Complete conference package with all amenities',
      basePrice: 350,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      includes: [
        'Conference venue rental',
        '2 Tea breaks (coffee, tea, pastries)',
        'Buffet lunch',
        'Basic stationery (notepad, pen)',
        'Projector & screen',
        'Sound system',
        'WiFi access'
      ],
      taxGroup: 'ghana-standard',
      minNotice: '48 hours',
      maxCapacity: 200
    },
    {
      id: 'silver-conference',
      name: 'Silver Conference Package',
      description: 'Standard conference package',
      basePrice: 250,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      includes: [
        'Conference venue rental',
        '1 Tea break (coffee, tea)',
        'Basic stationery (notepad, pen)',
        'Projector & screen',
        'WiFi access'
      ],
      taxGroup: 'ghana-standard',
      minNotice: '24 hours',
      maxCapacity: 100
    },
    {
      id: 'wedding-package',
      name: 'Wedding Package',
      description: 'Complete wedding reception package',
      basePrice: 500,
      currency: 'GH₵',
      perPerson: true,
      perDay: false,
      includes: [
        'Banquet hall rental',
        'Full catering service',
        'Table decorations',
        'Basic sound system',
        'Parking for guests',
        'Setup and cleanup'
      ],
      taxGroup: 'ghana-standard',
      minNotice: '72 hours',
      maxCapacity: 300
    }
  ];
  // Individual Services (à la carte)
  const individualServices = [
    {
      id: 'accommodation-standard',
      name: 'Standard Room',
      category: 'accommodation',
      basePrice: 450,
      currency: 'GH₵',
      perPerson: false,
      perDay: true,
      taxGroup: 'ghana-standard',
      description: 'Standard hotel room with breakfast'
    },
    {
      id: 'accommodation-deluxe',
      name: 'Deluxe Room',
      category: 'accommodation',
      basePrice: 650,
      currency: 'GH₵',
      perPerson: false,
      perDay: true,
      taxGroup: 'ghana-standard',
      description: 'Deluxe hotel room with breakfast'
    },
    {
      id: 'breakfast',
      name: 'Breakfast',
      category: 'food',
      basePrice: 60,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      taxGroup: 'ghana-basic',
      description: 'Continental breakfast buffet'
    },
    {
      id: 'lunch',
      name: 'Lunch',
      category: 'food',
      basePrice: 80,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      taxGroup: 'ghana-basic',
      description: 'Buffet lunch with soft drinks'
    },
    {
      id: 'dinner',
      name: 'Dinner',
      category: 'food',
      basePrice: 100,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      taxGroup: 'ghana-basic',
      description: 'Three-course dinner with soft drinks'
    },
    {
      id: 'tea-break',
      name: 'Tea Break',
      category: 'refreshments',
      basePrice: 25,
      currency: 'GH₵',
      perPerson: true,
      perDay: true,
      taxGroup: 'ghana-basic',
      description: 'Coffee, tea, and light refreshments'
    },
    {
      id: 'extra-projector',
      name: 'Extra Projector',
      category: 'equipment',
      basePrice: 200,
      currency: 'GH₵',
      perPerson: false,
      perDay: true,
      taxGroup: 'ghana-standard',
      description: 'Additional projector for large events'
    },
    {
      id: 'branded-stationery',
      name: 'Branded Stationery',
      category: 'supplies',
      basePrice: 15,
      currency: 'GH₵',
      perPerson: true,
      perDay: false,
      taxGroup: 'ghana-basic',
      description: 'Custom branded notepads and pens'
    }
  ];
  // Sample Quote Structure
  const sampleQuote = {
    id: 'quote-001',
    eventId: 'evt-quote-001',
    quoteNumber: 'Q-2024-001',
    clientName: 'Tech Ghana Ltd',
    clientEmail: 'events@techghana.com',
    clientPhone: '+233 20 123 4567',
    eventName: 'Ghana Tech Conference 2024',
    eventType: 'conference',
    startDate: '2024-03-15',
    endDate: '2024-03-17',
    totalDays: 3,
    validity: '30 days',
    status: 'pending',
    createdAt: '2024-02-15',
    createdBy: 'Sales Manager',
    
    // Tax Exemption Information
    taxExempt: false,
    taxExemptionType: null, // 'government', 'ngo', 'diplomatic', 'other'
    taxExemptionNumber: null,
    taxExemptionAuthority: null,
    taxExemptionExpiry: null,
    taxExemptionDocuments: [], // Array of uploaded document references
    taxExemptionNotes: null,
    
    // Event Timeline with Daily Services
    expectedPax: 120,
    eventTimeline: [
      {
        date: '2024-03-15',
        dayNumber: 1,
        dayType: 'arrival',
        services: [
          {
            serviceId: 'accommodation-standard',
            serviceName: 'Standard Room',
            category: 'accommodation',
            quantity: 15,
            unitPrice: 450,
            totalPrice: 6750,
            taxGroup: 'ghana-standard',
            notes: 'Arrival day - early check-in available'
          },
          {
            serviceId: 'dinner',
            serviceName: 'Dinner',
            category: 'food',
            quantity: 15,
            unitPrice: 100,
            totalPrice: 1500,
            taxGroup: 'ghana-basic',
            notes: 'Welcome dinner for residential guests'
          }
        ]
      },
      {
        date: '2024-03-16',
        dayNumber: 2,
        dayType: 'conference',
        services: [
          {
            serviceId: 'accommodation-standard',
            serviceName: 'Standard Room',
            category: 'accommodation',
            quantity: 15,
            unitPrice: 450,
            totalPrice: 6750,
            taxGroup: 'ghana-standard',
            notes: 'Full day accommodation'
          },
          {
            serviceId: 'breakfast',
            serviceName: 'Breakfast',
            category: 'food',
            quantity: 15,
            unitPrice: 60,
            totalPrice: 900,
            taxGroup: 'ghana-basic',
            notes: 'Breakfast for residential guests'
          },
          {
            serviceId: 'gold-conference',
            serviceName: 'Gold Conference Package',
            category: 'package',
            quantity: 30,
            unitPrice: 350,
            totalPrice: 10500,
            taxGroup: 'ghana-standard',
            notes: 'Full conference package for all attendees'
          },
          {
            serviceId: 'dinner',
            serviceName: 'Dinner',
            category: 'food',
            quantity: 15,
            unitPrice: 100,
            totalPrice: 1500,
            taxGroup: 'ghana-basic',
            notes: 'Dinner for residential guests'
          }
        ]
      },
      {
        date: '2024-03-17',
        dayNumber: 3,
        dayType: 'departure',
        services: [
          {
            serviceId: 'accommodation-standard',
            serviceName: 'Standard Room',
            category: 'accommodation',
            quantity: 15,
            unitPrice: 450,
            totalPrice: 6750,
            taxGroup: 'ghana-standard',
            notes: 'Checkout by 12:00 PM'
          },
          {
            serviceId: 'breakfast',
            serviceName: 'Breakfast',
            category: 'food',
            quantity: 15,
            unitPrice: 60,
            totalPrice: 900,
            taxGroup: 'ghana-basic',
            notes: 'Breakfast before departure'
          },
          {
            serviceId: 'gold-conference',
            serviceName: 'Gold Conference Package',
            category: 'package',
            quantity: 30,
            unitPrice: 350,
            totalPrice: 10500,
            taxGroup: 'ghana-standard',
            notes: 'Half-day conference (morning only)'
          }
        ]
      }
    ],

    // Financial Summary
    subtotal: 0, // Will be calculated
    taxBreakdown: [], // Will be calculated
    totalTax: 0, // Will be calculated
    grandTotal: 0, // Will be calculated
    
    // Terms & Conditions
    depositRequired: 50,
    depositAmount: 0, // Will be calculated
    balanceAmount: 0, // Will be calculated
    paymentTerms: '50% deposit to confirm, balance 7 days before event',
    cancellationPolicy: 'Deposit non-refundable if cancelled within 14 days of event',
    guaranteePolicy: 'Final numbers guaranteed 48 hours before event',
    
    // Additional Notes
    specialRequirements: 'Vegetarian options required for 5 attendees, wheelchair accessible venue needed',
    setupTime: 'Setup begins 2 hours before event start time',
    contactPerson: 'John Doe - Event Coordinator (Phone: +233 20 123 4567)'
  };
  // Sample Tax-Exempt Quote
  const sampleTaxExemptQuote = {
    id: 'quote-002',
    eventId: 'evt-quote-002',
    quoteNumber: 'Q-2024-002',
    clientName: 'Ministry of Education Ghana',
    clientEmail: 'events@moe.gov.gh',
    clientPhone: '+233 30 123 4567',
    eventName: 'National Education Summit 2024',
    eventType: 'conference',
    startDate: '2024-04-10',
    endDate: '2024-04-12',
    totalDays: 3,
    validity: '30 days',
    status: 'pending',
    createdAt: '2024-02-20',
    createdBy: 'Sales Manager',
    
    // Tax Exemption Information
    taxExempt: true,
    taxExemptionType: 'government',
    taxExemptionNumber: 'GRA/EXEMPT/2024/001',
    taxExemptionAuthority: 'Ghana Revenue Authority',
    taxExemptionExpiry: '2024-12-31',
    taxExemptionDocuments: [
      'GRA_Tax_Exemption_Certificate_2024.pdf',
      'Ministry_Registration_Document.pdf'
    ],
    taxExemptionNotes: 'Government ministry - fully tax exempt under Section 15 of GRA Act',
    
    // Event Timeline with Daily Services (same structure but no taxes)
    expectedPax: 200,
    eventTimeline: [
      {
        date: '2024-04-10',
        dayNumber: 1,
        dayType: 'conference',
        services: [
          {
            serviceId: 'gold-conference',
            serviceName: 'Gold Conference Package',
            category: 'package',
            quantity: 50,
            unitPrice: 350,
            totalPrice: 17500,
            taxGroup: 'none', // No taxes for exempt clients
            notes: 'Full conference package for government officials'
          }
        ]
      }
    ],
    
    // Financial Summary (no taxes)
    subtotal: 17500,
    taxBreakdown: [],
    totalTax: 0,
    grandTotal: 17500,
    
    // Terms & Conditions
    depositRequired: 0, // Government clients often don't pay deposits
    depositAmount: 0,
    balanceAmount: 17500,
    paymentTerms: 'Payment within 30 days after event completion',
    cancellationPolicy: 'No cancellation fees for government events',
    guaranteePolicy: 'Final numbers guaranteed 72 hours before event',
    
    // Additional Notes
    specialRequirements: 'Government protocol requirements, security clearance needed',
    setupTime: 'Setup begins 4 hours before event start time',
    contactPerson: 'Dr. Kwame Mensah - Director of Events (Phone: +233 30 123 4567)'
  };

  const services = [
    {
      id: 'service-001',
      name: 'Projector Setup',
      type: 'equipment',
      price: 500,
      status: 'available',
      description: 'High-quality projector with screen'
    },
    {
      id: 'service-002',
      name: 'Catering Service',
      type: 'food',
      price: 1500,
      status: 'available',
      description: 'Full catering service for events'
    },
    {
      id: 'service-003',
      name: 'Sound System',
      type: 'equipment',
      price: 800,
      status: 'available',
      description: 'Professional sound system setup'
    },
    {
      id: 'service-004',
      name: 'Decoration Service',
      type: 'decoration',
      price: 1200,
      status: 'available',
      description: 'Event decoration and setup'
    }
  ];

  const conferenceVenueCount = modernVenues.filter(venue => venue.type === 'conference').length;
  const meetingVenueCount = modernVenues.filter(venue => venue.type === 'meeting').length;
  const banquetVenueCount = modernVenues.filter(venue => venue.type === 'banquet').length;
  const auditoriumVenueCount = modernVenues.filter(venue => venue.type === 'auditorium').length;

  // Operational items following the superior Front Office pattern
  const operationalItems = [
    {
      category: 'Event Management',
      items: [
        { title: 'Event Calendar', icon: '📅', description: 'Complete event scheduling and timeline', status: 'active', count: totalEvents },
        { title: 'Active Events', icon: '🎯', description: 'Ongoing and upcoming events', status: 'active', count: activeEvents },
        { title: 'Completed Events', icon: '✅', description: 'Successfully concluded events', status: 'active', count: completedEvents },
        { title: 'Cancelled Events', icon: '❌', description: 'Cancelled or postponed events', status: 'warning', count: cancelledEvents },
      ]
    },
    {
      category: 'Venue Management',
      items: [
        { title: 'Conference Halls', icon: '🏢', description: 'Large conference and meeting spaces', status: 'active', count: conferenceVenueCount },
        { title: 'Meeting Rooms', icon: '🪑', description: 'Small to medium meeting spaces', status: 'active', count: meetingVenueCount },
        { title: 'Banquet Halls', icon: '🍽️', description: 'Wedding and celebration venues', status: 'active', count: banquetVenueCount },
        { title: 'Auditoriums', icon: '🎭', description: 'Large presentation and performance spaces', status: 'active', count: auditoriumVenueCount },
      ]
    },
    {
      category: 'Services & Amenities',
      items: [
        { title: 'Catering Services', icon: '🍽️', description: 'Food and beverage options', status: 'active', count: 8 },
        { title: 'Audio Visual', icon: '🎵', description: 'Sound, lighting, and projection', status: 'active', count: 6 },
        { title: 'Decoration', icon: '🎨', description: 'Event styling and theming', status: 'active', count: 4 },
        { title: 'Transportation', icon: '🚗', description: 'Guest and equipment transport', status: 'active', count: 2 },
      ]
    },
    {
      category: 'Operations & Setup',
      items: [
        { title: 'Setup in Progress', icon: '🔧', description: 'Venues being prepared', status: 'active', count: setupInProgress },
        { title: 'Event Reports', icon: '📊', description: 'Performance and analytics', status: 'active', count: 0 },
        { title: 'Revenue Tracking', icon: '💰', description: 'Financial performance metrics', status: 'active', count: 125000 },
        { title: 'Attendee Management', icon: '👥', description: 'Guest registration and tracking', status: 'active', count: 1240 },
      ]
    }
  ];
  const handleQuickAction = (action: string) => {
    trackEvent('Events.QuickAction', { action });
    switch (action) {
      case 'book_venue':
        setSelectedTab('venues');
        break;
      case 'catering':
        setSelectedTab('services');
        break;
      case 'event_reports':
        setSelectedTab('reports');
        break;
      case 'setup_management':
        setSelectedTab('operations');
        break;
      default:
        break;
    }
  };

  const validateEventForm = () => {
    const emailOk = !orgClientEmail || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(orgClientEmail);
    if (!eventName.trim()) { setPhase1Error('Event Name is required'); return false; }
    if (!orgName.trim()) { setPhase1Error('Organization is required'); return false; }
    if (!emailOk) { setPhase1Error('Please enter a valid client email'); return false; }
    setPhase1Error('');
    return true;
  };
  const handleEventSubmit = () => {
    if (eventSubmitting) return;
    if (!validateEventForm()) return;
    setEventSubmitting(true);

    try {
      const totals = computeEventTotals();
      const fallbackStart = startDate || new Date().toISOString().split('T')[0];
      const fallbackEnd = endDate || fallbackStart;
      const schedule = dailySchedule.length
        ? dailySchedule
        : [{
            date: fallbackStart,
            conferencePax: expectedPax || 0,
            lunchPax: expectedPax || 0,
            dinnerPax: expectedPax || 0,
            rooms: isResidential ? (expectedPax || 0) : 0,
            rate: ratesByParticulars ? 0 : (defaultDayRate || 0),
            extras: {},
            extraLines: []
          }];

      const startDateObj = new Date(fallbackStart);
      const endDateObj = new Date(fallbackEnd);
      const durationDays = (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime()))
        ? Math.max(1, Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1)
        : Math.max(1, schedule.length);
      const venueInfo = modernVenues.find(v => v.id === venueKey);

      let conferenceCost = 0;
      let lunchCost = 0;
      let dinnerCost = 0;
      let roomCost = 0;
      let extrasCost = 0;
      let packageCost = 0;

      schedule.forEach((day) => {
        const conferencePaxValue = Number(day.conferencePax || 0);
        const lunchPaxValue = Number(day.lunchPax || 0);
        const dinnerPaxValue = Number(day.dinnerPax || 0);
        const roomsValue = Number(day.rooms || 0);
        const dayRate = Number(day.rate || 0);

        if (ratesByParticulars) {
          conferenceCost += conferencePaxValue * (conferenceRate || 0);
          lunchCost += lunchPaxValue * (lunchRate || 0);
          dinnerCost += dinnerPaxValue * (dinnerRate || 0);
        } else {
          packageCost += conferencePaxValue * dayRate;
          lunchCost += lunchPaxValue * (lunchRate || 0);
          dinnerCost += dinnerPaxValue * (dinnerRate || 0);
        }

        if (isResidential) {
          roomCost += roomsValue * (roomRate || 0);
        }

        (day.extraLines || []).forEach((extra) => {
          const qty = Number(extra.qty || 0);
          const price = Number(extra.unitPrice || 0);
          extrasCost += qty * price;
        });
      });

      const attendees = expectedPax || schedule[0]?.conferencePax || 0;
      const depositAmount = prepaymentEnabled
        ? Math.min(
            totals.total,
            prepaymentType === 'percent'
              ? (totals.total * (prepaymentValue || 0)) / 100
              : (prepaymentValue || 0)
          )
        : 0;

      const costBreakdown = {
        accommodation: {
          baseCost: roomCost,
          corporateDiscount: 0,
          seasonalAdjustment: 0,
          finalCost: roomCost
        },
        package: {
          baseCost: packageCost,
          corporateDiscount: 0,
          seasonalAdjustment: 0,
          finalCost: packageCost
        },
        services: {
          dinner: dinnerCost,
          shuttle: 0,
          equipment: extrasCost,
          other: ratesByParticulars ? (conferenceCost + lunchCost) : lunchCost
        },
        taxes: totals.tax,
        totalCost: totals.total
      };
      const bookingStatus = bookingStatusMap[eventStatus];
      // Check if we're editing an existing event (not a stub created during new event flow)
      const isEditing = editingEvent?.id && !isCreatingEvent && editingEvent?.linkedBooking;
      const existingBookingId = editingEvent?.linkedBooking;
      
      let booking;
      if (isEditing && existingBookingId) {
        // Update existing booking
        enhancedFrontOfficeStore.updateEventBooking(existingBookingId, {
          eventName,
          eventType: isResidential ? 'conference' : 'conference',
          startDate: fallbackStart,
          endDate: fallbackEnd,
          attendees: attendees || 0,
          packageId: selectedPackageId || undefined,
          ratePlanId: undefined,
          corporateClientId: orgClientId || undefined,
          corporateClientName: orgName || undefined,
          appliedRateType: selectedPackageId ? 'negotiated' : 'standard',
          resources: venueKey ? [{
            resourceId: venueKey,
            quantity: 1,
            startTime: '08:00',
            endTime: '18:00'
          }] : [],
          rooms: [],
          costBreakdown,
          totalCost: totals.total,
          depositPaid: depositAmount,
          status: bookingStatus,
          clientId: orgClientId || editingEvent?.clientId || `client_${Date.now()}`,
          clientName: orgName,
          contactPhone: orgContactPhone,
          contactEmail: orgClientEmail,
          specialRequirements: ''
        });
        booking = { id: existingBookingId };
      } else {
        // Create new booking
        booking = enhancedFrontOfficeStore.createEventBooking({
          eventName,
          eventType: isResidential ? 'conference' : 'conference',
          startDate: fallbackStart,
          endDate: fallbackEnd,
          attendees: attendees || 0,
          packageId: selectedPackageId || undefined,
          ratePlanId: undefined,
          corporateClientId: orgClientId || undefined,
          corporateClientName: orgName || undefined,
          appliedRateType: selectedPackageId ? 'negotiated' : 'standard',
          resources: venueKey ? [{
            resourceId: venueKey,
            quantity: 1,
            startTime: '08:00',
            endTime: '18:00'
          }] : [],
          rooms: [],
          costBreakdown,
          totalCost: totals.total,
          depositPaid: depositAmount,
          status: bookingStatus,
          clientId: orgClientId || `client_${Date.now()}`,
          clientName: orgName,
          contactPhone: orgContactPhone,
          contactEmail: orgClientEmail,
          specialRequirements: ''
        });
      }

      const baseEvent = {
        id: isEditing ? editingEvent.id : booking.id,
        organization: orgName,
        eventName,
        eventType: isResidential ? 'residential-conference' : 'non-residential',
        venue: venueKey || '',
        venueName: venueInfo?.name || 'Unassigned Venue',
        arrivalDate: fallbackStart,
        departureDate: fallbackEnd,
        duration: durationDays,
        pax: attendees || 0,
        residential: isResidential,
        status: eventStatus,
        statusColor: eventStatusColorMap[eventStatus],
        revenue: totals.total,
        deposit: depositAmount,
        balance: Math.max(0, totals.total - depositAmount),
        salesManager: editingEvent?.salesManager || 'Unassigned',
        notes: '',
        specialRequirements: '',
        setupTime: '',
        contactPerson: orgName,
        contactPhone: orgContactPhone,
        contactEmail: orgClientEmail,
        linkedQuote: editingQuote?.quoteNumber || null,
        linkedBooking: booking.id,
        linkedBEO: null,
        linkedFolio: null,
        venueKey,
        startDate: fallbackStart,
        endDate: fallbackEnd,
        expectedPax: attendees || 0,
        isTaxExempt: eventTaxExempt,
        taxExempt: eventTaxExempt,
        dailySchedule: schedule,
        customParticulars,
        ratesByParticulars,
        conferenceRate,
        lunchRate,
        dinnerRate,
        roomRate,
        defaultDayRate,
        particularLabels
      };
      const budgetInput = {
        ...baseEvent,
        dailySchedule: schedule,
        ratesByParticulars,
        conferenceRate,
        lunchRate,
        dinnerRate,
        roomRate,
        defaultDayRate
      };
      const derivedBudgetSnapshot = normalizeBudgetSnapshot(calculateEventBudget(budgetInput));
      const existingSnapshot = editingEvent?.quoteBudgetSnapshot
        ? normalizeBudgetSnapshot(editingEvent.quoteBudgetSnapshot)
        : null;
      const normalizedTargetStatus = normalizeStatus(eventStatus);
      const shouldRefreshSnapshot =
        !existingSnapshot ||
        !editingEvent ||
        normalizedTargetStatus === 'quote';
      const quoteBudgetSnapshot = shouldRefreshSnapshot ? derivedBudgetSnapshot : existingSnapshot!;
      const uiEvent = {
        ...baseEvent,
        quoteBudgetSnapshot,
        budgetTotal: quoteBudgetSnapshot.total
      };
      setCustomEvents(prev => {
        const existingIndex = prev.findIndex(ev => ev.id === uiEvent.id);
        if (existingIndex >= 0) {
          // Replace existing event
          const updated = [...prev];
          updated[existingIndex] = uiEvent;
          return updated;
        }
        // Add new event
        return [uiEvent, ...prev];
      });
      trackEvent('Events.EventCreated', {
        action: isEditing ? 'updated' : 'created',
        eventId: uiEvent.id,
        attendees,
        venueId: venueKey,
        status: eventStatus
      });
      setIsEventModalOpen(false);
      setEditingEvent(null);
      setIsCreatingEvent(false);
      setIsAdjustMode(false);
    } catch (error) {
      console.error('Failed to create event booking', error);
    } finally {
      setEventSubmitting(false);
    }
  };

  const convertCustomEventToFormState = (event: any) => {
    setEventName(event?.eventName || event?.name || '');
    setOrgName(event?.organization || '');
    setOrgContactPhone(event?.contactPhone || event?.contact || '');
    setOrgClientEmail(event?.contactEmail || event?.clientEmail || '');
    setIsResidential(Boolean(event?.residential ?? event?.isResidential));
    setOrgClientId(event?.clientId || '');
    setOrgSearch(event?.organization || '');
    setEventStatus(normalizeStatus(event?.status));
    setStartDate(event?.arrivalDate || event?.startDate || '');
    setEndDate(event?.departureDate || event?.endDate || '');
    setVenueKey(event?.venue || event?.venueKey || '');
    setExpectedPax(
      typeof event?.expectedPax === 'number'
        ? event.expectedPax
        : (event?.pax || 0)
    );
    setEventTaxExempt(Boolean(event?.isTaxExempt ?? event?.taxExempt));

    if (Array.isArray(event?.dailySchedule) && event.dailySchedule.length) {
      setDailySchedule(event.dailySchedule);
    } else if (Array.isArray(event?.eventTimeline) && event.eventTimeline.length) {
      const scheduleInfo = convertTimelineToDailySchedule(event.eventTimeline, event?.arrivalDate || event?.startDate || startDate || new Date().toISOString().split('T')[0]);
      if (scheduleInfo.schedule.length > 0) {
        setDailySchedule(scheduleInfo.schedule);
        setRatesByParticulars(scheduleInfo.useParticulars);
        setConferenceRate(scheduleInfo.rates.conferenceRate);
        setLunchRate(scheduleInfo.rates.lunchRate);
        setDinnerRate(scheduleInfo.rates.dinnerRate);
        setRoomRate(scheduleInfo.rates.roomRate);
        setDefaultDayRate(scheduleInfo.rates.packageRate);
      }
    } else {
      setDailySchedule([]);
    }

    setCustomParticulars(event?.customParticulars || []);
    if (typeof event?.ratesByParticulars === 'boolean') {
      setRatesByParticulars(event.ratesByParticulars);
    }

    if (typeof event?.conferenceRate === 'number') setConferenceRate(event.conferenceRate);
    if (typeof event?.lunchRate === 'number') setLunchRate(event.lunchRate);
    if (typeof event?.dinnerRate === 'number') setDinnerRate(event.dinnerRate);
    if (typeof event?.roomRate === 'number') setRoomRate(event.roomRate);
    if (typeof event?.defaultDayRate === 'number') setDefaultDayRate(event.defaultDayRate);
    
    // Load particularLabels from event if available
    if (event?.particularLabels && typeof event.particularLabels === 'object') {
      setParticularLabels(prev => ({ ...prev, ...event.particularLabels }));
    }
  };

  const resetEventFormState = (seed: Partial<any> = {}) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const arrival = seed.arrivalDate || todayStr;
    const departure = seed.departureDate || arrival;
    const venue = seed.venue || '';
    const pax = typeof seed.pax === 'number' ? seed.pax : 0;

    setEventName(seed.eventName || '');
    setOrgName(seed.organization || '');
    setOrgContactPhone(seed.contactPhone || '');
    setOrgClientEmail(seed.contactEmail || '');
    setOrgClientId(seed.clientId || '');
    setOrgSearch(seed.organization || '');
    setIsResidential(Boolean(seed.residential));
    setEventStatus('quote');
    setStartDate(arrival);
    setEndDate(departure);
    setVenueKey(venue);
    setExpectedPax(pax);
    setEventTaxExempt(false);
    setPhase1Error('');

    setDailySchedule([]);
    setAvailabilityNote('Select dates, venue and expected pax to check availability...');
    setCapacityOk(false);
    setClashCount(0);
    setHasWarnings(false);
    setConflictingEvents([]);

    setRatesByParticulars(true);
    setConferenceRate(250);
    setLunchRate(0);
    setDinnerRate(0);
    setRoomRate(0);
    setDefaultDayRate(250);
    setCustomParticulars([]);
    setHiddenParticulars({});
    setParticularLabels({
      conferencePax: 'Conference',
      lunchPax: 'Lunch',
      dinnerPax: 'Dinner',
      rooms: 'Accommodation & Breakfast'
    });

    setPrepaymentEnabled(false);
    setPrepaymentType('percent');
    setPrepaymentValue(0);
    setDiscountEnabled(false);
    setDiscountType('percent');
    setDiscountValue(0);
    setSelectedPackageId('');
    setSelectedAddOnIds({});
  };

  const openNewEventModal = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const arrival = startDate || todayStr;
    const departure = endDate || startDate || todayStr;
    const seedVenue = venueKey || '';
    const seedPax = expectedPax || 0;

    const blankEvent = {
      id: `evt-${Date.now()}`,
      arrivalDate: arrival,
      departureDate: departure,
      venue: seedVenue,
      venueName: seedVenue ? (modernVenues.find(v => v.id === seedVenue)?.name || '') : '',
      duration: 1,
      pax: seedPax,
      status: eventStatus,
      statusColor: eventStatusColorMap[eventStatus],
      residential: false
    };

    setIsCreatingEvent(true);
    resetEventFormState({
      arrivalDate: arrival,
      departureDate: departure,
      venue: seedVenue,
      pax: seedPax,
      residential: false
    });
    setEditingEvent(blankEvent);
    setIsEventModalOpen(true);
  };

  const openEventForEdit = (event: any, adjustMode: boolean = false, createInvoice: boolean = false) => {
    setIsCreatingEvent(false);
    setIsViewMode(false);
    setIsAdjustMode(adjustMode);
    setIsCreatingInvoiceFromFolio(createInvoice);
    setEditingEvent(event);
    convertCustomEventToFormState(event);
    if (createInvoice) {
      setEventStatus('invoiced');
    }
    setIsEventModalOpen(true);
  };

  const openEventForView = (event: any) => {
    setIsCreatingEvent(false);
    setIsViewMode(true);
    setIsCreatingInvoiceFromFolio(false); // Reset flag when viewing
    setEditingEvent(event);
    convertCustomEventToFormState(event);
    setIsEventModalOpen(true);
  };

  // Auto-create invoice when event modal closes after saving from folio
  const prevIsEventModalOpen = useRef(isEventModalOpen);
  const eventIdForInvoiceCreation = useRef<string | null>(null);
  
  // Store event ID when flag is set, before modal closes
  useEffect(() => {
    if (isCreatingInvoiceFromFolio && editingEvent?.id) {
      eventIdForInvoiceCreation.current = editingEvent.id;
      console.log('[Folio] Stored event ID for invoice creation:', editingEvent.id);
    }
  }, [isCreatingInvoiceFromFolio, editingEvent?.id]);
  
  useEffect(() => {
    // Only trigger when modal closes (goes from open to closed)
    const modalJustClosed = prevIsEventModalOpen.current && !isEventModalOpen;
    prevIsEventModalOpen.current = isEventModalOpen;
    
    if (!modalJustClosed || !isCreatingInvoiceFromFolio || !eventIdForInvoiceCreation.current) return;
    
    const eventId = eventIdForInvoiceCreation.current;
    console.log('[Folio] Modal closed, checking for event:', eventId);
    
    // Small delay to ensure event was saved to customEvents
    const timeoutId = setTimeout(() => {
      // Check if event was saved (exists in customEvents)
      const savedEvent = customEvents.find(ev => ev.id === eventId);
      if (!savedEvent) {
        console.log('[Folio] Event not found in customEvents, invoice creation cancelled. Event ID:', eventId);
        console.log('[Folio] Available events:', customEvents.map(e => e.id));
        setIsCreatingInvoiceFromFolio(false);
        eventIdForInvoiceCreation.current = null;
        return;
      }
      
      console.log('[Folio] Found saved event:', savedEvent.id, savedEvent.eventName);
      
      // Check if invoice already exists
      const existingInvoice = eventInvoices.find((inv: any) => inv.eventId === eventId);
      if (existingInvoice) {
        console.log('[Folio] Invoice already exists for event:', eventId);
        setIsCreatingInvoiceFromFolio(false);
        eventIdForInvoiceCreation.current = null;
        return;
      }
      
      // Use the stored quote snapshot for the budget
      const budget = getQuoteBudgetSnapshot(savedEvent);
      const budgetTotal = budget.total;
      
      console.log('[Folio] Calculated budget total:', budgetTotal, budget);
      
      if (budgetTotal > 0) {
        const today = new Date().toISOString().split('T')[0];
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const newInvoice: EventInvoice = {
          id: `INV-${Date.now().toString().slice(-6)}`,
          eventId: savedEvent.id,
          eventName: savedEvent.eventName || 'Unnamed Event',
          clientName: savedEvent.organization || 'Unknown Client',
          issueDate: today,
          dueDate: dueDate,
          subtotal: budgetTotal,
          tax: 0,
          total: budgetTotal,
          balance: budgetTotal,
          status: 'Draft',
          reference: '',
          notes: `Invoice created from event quote. Event: ${savedEvent.eventName}`
        };
        
        setEventInvoices(prev => [newInvoice, ...prev]);
        
        // If creating invoice, automatically update status to 'invoiced' if currently 'confirmed' or 'quote'
        const currentStatus = normalizeStatus(savedEvent.status);
        const shouldUpdateToInvoiced = currentStatus === 'confirmed' || currentStatus === 'quote';
        
        if (shouldUpdateToInvoiced) {
          // Update in customEvents
          setCustomEvents(prev => prev.map(ev => 
            ev.id === savedEvent.id 
              ? { ...ev, status: 'invoiced' as const } 
              : ev
          ));
          
          trackEvent('Events.EventStatusUpdated', { 
            eventId: savedEvent.id, 
            newStatus: 'invoiced',
            reason: 'invoice_created_from_folio'
          });
          
          console.log('[Folio] Event status updated to "invoiced":', savedEvent.id);
        }
        
        // Sync invoice to folio (this will automatically refresh activeFolio if folio modal is open)
        syncInvoiceToFolio(newInvoice);
        
        // Refresh activeFolio after state updates so totals are current
        setTimeout(() => refreshActiveFolioByEvent(savedEvent.id), 50);
        
        console.log('[Folio] ✅ Auto-created invoice from event quote:', newInvoice.id, formatCurrency(budgetTotal));
        trackEvent('Events.EventCreated', { action: 'invoice_created_from_folio', eventId: savedEvent.id, invoiceId: newInvoice.id });
        
        // Show success message
        alert(`Invoice created successfully!\n\nInvoice ID: ${newInvoice.id}\nAmount: ${formatCurrency(budgetTotal)}\n\nThe invoice has been added to the event folio.`);
      } else {
        console.warn('[Folio] Budget total is 0, cannot create invoice');
        alert('Cannot create invoice: Event budget is zero. Please ensure the event has services and rates configured.');
      }
      
      // Reset flag and stored event ID
      setIsCreatingInvoiceFromFolio(false);
      eventIdForInvoiceCreation.current = null;
    }, 800); // Increased delay to ensure state updates have propagated
    
    return () => clearTimeout(timeoutId);
  }, [isEventModalOpen, isCreatingInvoiceFromFolio, customEvents, eventInvoices]);


  const calculateEventBudget = (event: any) => {
    const schedule = event.dailySchedule || [];
    let accommodation = 0;
    let conference = 0;
    let dinner = 0;
    let lunch = 0;
    let extras = 0;

    schedule.forEach((day: any) => {
      if (event.residential && day.rooms) {
        accommodation += (day.rooms || 0) * (event.roomRate || 0);
      }
      if (event.ratesByParticulars) {
        conference += (day.conferencePax || 0) * (event.conferenceRate || 0);
        lunch += (day.lunchPax || 0) * (event.lunchRate || 0);
        dinner += (day.dinnerPax || 0) * (event.dinnerRate || 0);
      } else {
        conference += (day.conferencePax || 0) * (day.rate || 0);
        lunch += (day.lunchPax || 0) * (event.lunchRate || 0);
        dinner += (day.dinnerPax || 0) * (event.dinnerRate || 0);
      }
      (day.extraLines || []).forEach((extra: any) => {
        extras += (extra.qty || 0) * (extra.unitPrice || 0);
      });
    });

    const total = accommodation + conference + dinner + lunch + extras;
    return { accommodation, conference, dinner, lunch, extras, total };
  };

  const normalizeBudgetSnapshot = (snapshot?: Partial<QuoteBudgetSnapshot>): QuoteBudgetSnapshot => {
    const accommodation = Number(snapshot?.accommodation || 0);
    const conference = Number(snapshot?.conference || 0);
    const dinner = Number(snapshot?.dinner || 0);
    const lunch = Number(snapshot?.lunch || 0);
    const extras = Number(snapshot?.extras || 0);
    const totalFromSnapshot = Number(snapshot?.total);
    const total = Number.isFinite(totalFromSnapshot)
      ? totalFromSnapshot
      : accommodation + conference + dinner + lunch + extras;
    return { accommodation, conference, dinner, lunch, extras, total };
  };

  const getQuoteBudgetSnapshot = (event: any): QuoteBudgetSnapshot => {
    if (!event) return normalizeBudgetSnapshot();

    if (event.quoteBudgetSnapshot) {
      return normalizeBudgetSnapshot(event.quoteBudgetSnapshot);
    }

    if (event.budgetBreakdownSnapshot) {
      return normalizeBudgetSnapshot(event.budgetBreakdownSnapshot);
    }

    if (event.budgetBreakdown) {
      return normalizeBudgetSnapshot(event.budgetBreakdown);
    }

    if (typeof event.budgetTotal === 'number') {
      return normalizeBudgetSnapshot({ total: event.budgetTotal });
    }

    const derived = calculateEventBudget(event);
    return normalizeBudgetSnapshot(derived);
  };

  const generateVenueId = (name: string) => {
    const baseSlug = slugify(name) || 'venue';
    let candidate = baseSlug;
    let counter = 1;
    while (modernVenues.some(venue => venue.id === candidate)) {
      candidate = `${baseSlug}-${counter++}`;
    }
    return candidate;
  };

  const openVenueModal = (venue?: VenueDetails | null) => {
    if (venue) {
      setEditingVenue(venue);
      setVenueForm({
        name: venue.name,
        type: venue.type,
        capacity: venue.capacity ? String(venue.capacity) : '',
        basePrice: venue.basePrice ? String(venue.basePrice) : '',
        location: venue.location,
        status: venue.status,
        featuresInput: (venue.features || []).join('\n'),
        currency: venue.currency || 'GH₵'
      });
    } else {
      setEditingVenue(null);
      setVenueForm(createEmptyVenueForm());
    }
    setIsVenueModalOpen(true);
  };

  const closeVenueModal = () => {
    setIsVenueModalOpen(false);
    setEditingVenue(null);
    setVenueForm(createEmptyVenueForm());
  };

  const handleVenueFieldChange = (field: keyof VenueFormState, value: string) => {
    setVenueForm(prev => ({ ...prev, [field]: value }));
  };

  const handleVenueSubmit = () => {
    const trimmedName = venueForm.name.trim();
    if (!trimmedName) {
      alert('Venue name is required.');
      return;
    }

    const capacityValue = Number(venueForm.capacity);
    if (!Number.isFinite(capacityValue) || capacityValue <= 0) {
      alert('Please enter a valid capacity.');
      return;
    }

    const basePriceValue = Number(venueForm.basePrice || 0);
    if (!Number.isFinite(basePriceValue) || basePriceValue < 0) {
      alert('Please enter a valid price per day.');
      return;
    }

    const features = venueForm.featuresInput
      .split('\n')
      .map(feature => feature.trim())
      .filter(Boolean);

    const venueId = editingVenue?.id || generateVenueId(trimmedName);
    const updatedVenue: VenueDetails = {
      id: venueId,
      name: trimmedName,
      type: venueForm.type,
      capacity: capacityValue,
      location: venueForm.location.trim(),
      features,
      basePrice: basePriceValue,
      currency: venueForm.currency || 'GH₵',
      status: venueForm.status
    };

    if (editingVenue) {
      setModernVenues(prev => prev.map(venue => venue.id === venueId ? updatedVenue : venue));
      trackEvent('Events.VenueBooked', { action: 'updated', venueId });
    } else {
      setModernVenues(prev => [...prev, updatedVenue]);
      setVenueKey(venueId);
      trackEvent('Events.VenueBooked', { action: 'created', venueId });
    }

    closeVenueModal();
  };

  const handleDeleteVenue = (venue: VenueDetails) => {
    if (!confirm(`Delete ${venue.name}? This action cannot be undone.`)) {
      return;
    }

    setModernVenues(prev => prev.filter(item => item.id !== venue.id));
    setCustomEvents(prev =>
      prev.map(event =>
        event.venue === venue.id
          ? { ...event, venue: '', venueName: 'Unassigned Venue' }
          : event
      )
    );

    if (venueKey === venue.id) {
      setVenueKey('');
    }
    if (selectedGanttVenue === venue.id) {
      setSelectedGanttVenue('all');
    }

    trackEvent('Events.VenueBooked', { action: 'deleted', venueId: venue.id });
  };

  const handleServiceSubmit = () => {
    // Handle service creation/update
    setIsServiceModalOpen(false);
    setEditingService(null);
    trackEvent('Events.SetupStarted', { action: editingService?.id ? 'updated' : 'created' });
  };
  const buildQuoteFromCurrentEvent = () => {
    const schedule = (dailySchedule && dailySchedule.length > 0) ? dailySchedule : [];
    const fallbackStart = startDate || new Date().toISOString().split('T')[0];
    const fallbackEnd = endDate || fallbackStart;
    const getDateForIndex = (idx: number, rowDate?: string) => {
      if (rowDate) return rowDate;
      if (!startDate) return fallbackStart;
      const base = new Date(startDate);
      base.setDate(base.getDate() + idx);
      return base.toISOString().split('T')[0];
    };

    const visibleSchedule = schedule.length ? schedule : [{
      date: fallbackStart,
      conferencePax: expectedPax || 0,
      lunchPax: expectedPax || 0,
      dinnerPax: expectedPax || 0,
      rooms: isResidential ? (expectedPax || 0) : 0,
      rate: ratesByParticulars ? 0 : (defaultDayRate || 0),
      extras: {},
      extraLines: []
    }];

    const quoteDayDrafts: QuoteDay[] = visibleSchedule.map((row: any, idx: number) => {
      const dayLabel = row.label || row.date || `Day ${idx + 1}`;
      const dayDate = getDateForIndex(idx, row.date);
      const services: QuoteServiceLine[] = [];
      const addService = (
        idSuffix: string,
        name: string,
        qty: number,
        unitPrice: number | null | undefined,
        category: string,
        taxGroup: string = 'ghana-standard'
      ) => {
        const safeQty = Number(qty || 0);
        const safePrice = Number(unitPrice || 0);
        if (safeQty <= 0 || safePrice < 0) return;
        services.push({
          id: `${idSuffix}-${idx}`,
          name,
          category,
          qty: safeQty,
          unitPrice: safePrice,
          taxGroup
        });
      };

      if (ratesByParticulars) {
        if (!hiddenParticulars.rooms && (isResidential || (row.rooms || 0) > 0)) {
          addService('rooms', particularLabels.rooms, row.rooms, roomRate, 'accommodation');
        }
        if (!hiddenParticulars.dinnerPax) {
          addService('dinner', particularLabels.dinnerPax, row.dinnerPax, dinnerRate, 'catering', 'ghana-basic');
        }
        if (!hiddenParticulars.lunchPax) {
          addService('lunch', particularLabels.lunchPax, row.lunchPax, lunchRate, 'catering', 'ghana-basic');
        }
        if (!hiddenParticulars.conferencePax) {
          addService('conference', particularLabels.conferencePax, row.conferencePax, conferenceRate, 'conference');
        }
        customParticulars.forEach((p) => {
          const qty = row.extras?.[p.id] || 0;
          addService(`custom-${p.id}`, p.label, qty, p.rate, 'custom');
        });
      } else {
        if ((row.rooms || 0) > 0 && (roomRate || 0) > 0) {
          addService('rooms', particularLabels.rooms, row.rooms, roomRate, 'accommodation');
        }
        if ((row.dinnerPax || 0) > 0 && (dinnerRate || 0) > 0) {
          addService('dinner', particularLabels.dinnerPax, row.dinnerPax, dinnerRate, 'catering', 'ghana-basic');
        }
        if ((row.lunchPax || 0) > 0 && (lunchRate || 0) > 0) {
          addService('lunch', particularLabels.lunchPax, row.lunchPax, lunchRate, 'catering', 'ghana-basic');
        }
        if ((row.conferencePax || 0) > 0 && (row.rate || 0) > 0) {
          addService('package', 'Conference Package', row.conferencePax, row.rate, 'package');
        }
        (row.extraLines || []).forEach((extra: any, extraIdx: number) => {
          addService(
            `extra-${extraIdx}`,
            extra.name || `Extra ${extraIdx + 1}`,
            extra.qty || 0,
            extra.unitPrice,
            'custom',
            extra.taxGroup || 'ghana-standard'
          );
        });
      }

      return {
        id: `quote-day-${idx}`,
        label: dayLabel,
        date: dayDate,
        services
      };
    });

    const timelineFromDays = convertQuoteDaysToTimeline(quoteDayDrafts, fallbackStart);

    const computedPrepaymentPercent = (() => {
      if (!prepaymentEnabled) return 50;
      if (prepaymentType === 'percent') return Math.max(0, Math.min(100, prepaymentValue || 0));
      if (eventTotals.total > 0) {
        return Math.max(0, Math.min(100, (prepaymentValue / eventTotals.total) * 100));
      }
      return 0;
    })();
    const venue = modernVenues.find(v => v.id === venueKey);
    const quoteId = editingQuote?.id || `quote-${Date.now()}`;

    const quoteDraft = {
      id: quoteId,
      quoteNumber: editingQuote?.quoteNumber || `Q-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      clientName: orgName,
      clientEmail: orgClientEmail,
      clientPhone: orgContactPhone,
      eventName,
      eventType: isResidential ? 'residential-conference' : 'non-residential',
      startDate: fallbackStart,
      endDate: fallbackEnd,
      totalDays: quoteDayDrafts.length,
      validity: '14 days',
      status: 'draft',
      createdAt: new Date().toISOString(),
      createdBy: 'Front Office',
      venueName: venue?.name || '',
      taxExempt: eventTaxExempt,
      taxExemptionType: eventTaxExempt ? 'custom' : null,
      taxExemptionNumber: null,
      taxExemptionAuthority: null,
      taxExemptionExpiry: null,
      taxExemptionDocuments: [],
      taxExemptionNotes: null,
      eventTimeline: timelineFromDays,
      depositRequired: Number(computedPrepaymentPercent.toFixed(2)),
      paymentTerms: prepaymentEnabled
        ? (prepaymentType === 'percent'
            ? `${prepaymentValue || 0}% deposit required to confirm booking`
            : `₵${(prepaymentValue || 0).toFixed(2)} deposit required to confirm booking`)
        : '50% deposit required to confirm booking',
      cancellationPolicy: 'Deposit non-refundable within 14 days of event',
      guaranteePolicy: 'Final numbers guaranteed 48 hours before event',
      specialRequirements: '',
      setupTime: '',
      contactPerson: orgName
    };

    return { quoteDraft, quoteDayDrafts };
  };

  const handleGenerateQuoteFromEvent = () => {
    if (!validateEventForm()) return;
    const { quoteDraft, quoteDayDrafts } = buildQuoteFromCurrentEvent();
    setEditingQuote(quoteDraft);
    setQuoteDays(quoteDayDrafts);
    setQuoteTaxExempt(eventTaxExempt);
    trackEvent('Events.EventCreated', { action: 'quote_modal_opened', quoteId: quoteDraft.id, eventName });
    setIsQuoteModalOpen(true);
    setIsEventModalOpen(false);
    setIsAdjustMode(false);
  };

  const handleOpenContractFromEvent = () => {
    if (!validateEventForm()) return;
    const today = new Date().toISOString().split('T')[0];
    const contractClient = {
      id: editingEvent?.id ? `event-client-${editingEvent.id}` : `event-client-${Date.now()}`,
      name: orgName,
      position: 'Event Contact',
      organization: orgName,
      contact: orgContactPhone,
      email: orgClientEmail,
      whatsapp: false,
      contractStatus: 'draft',
      contractStart: startDate || today,
      contractEnd: endDate || startDate || today,
      rates: {
        accommodation: roomRate || 0,
        conference: ratesByParticulars ? (conferenceRate || 0) : (defaultDayRate || conferenceRate || 0),
        catering: ratesByParticulars ? (lunchRate || dinnerRate || 0) : (lunchRate || dinnerRate || 0)
      },
      specialTerms: `Contract generated from event "${eventName || 'New Event'}".`
    };
    setSelectedClient(contractClient);
    setSelectedContractEventInfo(getCurrentEventSnapshot());
    trackEvent('Events.EventCreated', { action: 'contract_modal_opened', organization: orgName });
    setIsContractModalOpen(true);
    setIsEventModalOpen(false);
    setIsAdjustMode(false);
  };
  const handleExportEventXls = () => {
    const baseQuote = buildQuoteForExport();
    if (!baseQuote) {
      console.warn('Unable to generate XLS export for current event.');
      return;
    }

    const rows: string[] = [];
    rows.push('<tr><th>Day</th><th>Date</th><th>Service</th><th>Category</th><th>Qty</th><th>Rate (₵)</th><th>Subtotal (₵)</th></tr>');

    (baseQuote.eventTimeline || []).forEach((day: any, idx: number) => {
      const dayLabel = day?.label || `Day ${idx + 1}`;
      const services = Array.isArray(day?.services) ? day.services : [];
      if (!services.length) {
        rows.push(`<tr>
          <td>${dayLabel}</td>
          <td>${day?.date || ''}</td>
          <td colspan="5">No services recorded</td>
        </tr>`);
      } else {
        services.forEach((service: any) => {
          const qty = Number(service?.quantity ?? service?.qty ?? 0) || 0;
          const unitPrice = Number(service?.unitPrice ?? 0) || 0;
          const subtotal = Number(service?.totalPrice ?? (qty * unitPrice)) || 0;
          rows.push(`<tr>
            <td>${dayLabel}</td>
            <td>${day?.date || ''}</td>
            <td>${service?.serviceName || service?.name || 'Service'}</td>
            <td>${service?.category || ''}</td>
            <td>${qty || ''}</td>
            <td>${unitPrice.toFixed(2)}</td>
            <td>${subtotal.toFixed(2)}</td>
          </tr>`);
        });
      }
    });

    const settingsState = useSettingsStore.getState() as any;
    const orgProfile = {
      name: settingsState?.organization?.name || settingsState?.companySettings?.tradingName || 'Demo Hotel',
      address: [
        settingsState?.organization?.address,
        settingsState?.companySettings?.address?.line1,
        settingsState?.companySettings?.address?.city,
        settingsState?.companySettings?.address?.country
      ].filter(Boolean).join(', '),
      phone: settingsState?.organization?.phone || settingsState?.companySettings?.contact?.phone || '',
      email: settingsState?.organization?.email || settingsState?.companySettings?.contact?.email || '',
      taxId: settingsState?.organization?.taxId || settingsState?.companySettings?.taxId || ''
    };

    const taxSpread = mapTaxBreakdownToPrint(eventTotals.taxBreakdown || []);
    const taxLabelMap: Record<string, string> = {
      vat: 'VAT',
      nhil: 'NHIL',
      levy: 'Tourism Levy',
      covid: 'COVID Levy',
      gefl: 'GETFund Levy',
      gtal: 'GTA Levy'
    };
    const taxRows = Object.entries(taxSpread || {})
      .filter(([, value]) => typeof value === 'number')
      .map(([name, value]) => {
        const label = taxLabelMap[name as keyof typeof taxLabelMap] || name.toUpperCase();
        return `<tr><td colspan="6" style="font-weight:bold;text-align:right;">${label}</td><td>${Number(value || 0).toFixed(2)}</td></tr>`;
      });

    const summaryRows = [
      `<tr><td colspan="6" style="font-weight:bold;text-align:right;">Subtotal</td><td>${Number(eventTotals.subtotal || 0).toFixed(2)}</td></tr>`,
      ...(eventTotals.discountAmount
        ? [
            `<tr><td colspan="6" style="font-weight:bold;text-align:right;">Discount</td><td>-${Number(eventTotals.discountAmount || 0).toFixed(2)}</td></tr>`
          ]
        : []),
      ...taxRows,
      `<tr><td colspan="6" style="font-weight:bold;text-align:right;">Grand Total</td><td>${Number(eventTotals.total || 0).toFixed(2)}</td></tr>`,
      `<tr><td colspan="6" style="font-weight:bold;text-align:right;">Prepayment${prepaymentEnabled ? ` (${prepaymentDisplay})` : ''}</td><td>${(prepaymentEnabled ? cappedPrepaymentAmount : 0).toFixed(2)}</td></tr>`,
      `<tr><td colspan="6" style="font-weight:bold;text-align:right;">Balance Due</td><td>${balanceDue.toFixed(2)}</td></tr>`
    ];

    const headingRows = [
      `<tr><th colspan="7" style="font-size:16px;text-align:left;">${orgProfile.name}</th></tr>`,
      orgProfile.address ? `<tr><td colspan="7" style="font-size:12px;color:#555;">${orgProfile.address}</td></tr>` : '',
      (orgProfile.phone || orgProfile.email)
        ? `<tr><td colspan="7" style="font-size:12px;color:#555;">${[orgProfile.phone, orgProfile.email].filter(Boolean).join(' • ')}</td></tr>`
        : '',
      orgProfile.taxId ? `<tr><td colspan="7" style="font-size:12px;color:#555;">Tax ID: ${orgProfile.taxId}</td></tr>` : '',
      '<tr><td colspan="7" style="height:20px;"></td></tr>',
      `<tr><th colspan="7" style="font-size:14px;text-align:left;">${eventName || 'Event Summary'}</th></tr>`,
      `<tr><td colspan="7" style="font-size:12px;color:#555;">${orgName || 'Client'}${startDate || endDate ? ` • ${startDate || ''}${endDate ? ` → ${endDate}` : ''}` : ''}${expectedPax ? ` • Guests: ${expectedPax}` : ''}</td></tr>`,
      '<tr><td colspan="7" style="height:12px;"></td></tr>'
    ].filter(Boolean);

    const worksheet = `
      <table border="1" cellspacing="0" cellpadding="4">
        ${headingRows.join('')}
        <thead>
          ${rows.slice(0, 1).join('')}
        </thead>
        <tbody>
          ${rows.slice(1).join('')}
        </tbody>
        <tfoot>
          ${summaryRows.join('')}
        </tfoot>
      </table>
    `;

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          ${worksheet}
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const safeName = (eventName || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    anchor.download = `${safeName || 'event'}-summary.xls`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 100);

    trackEvent('Events.EventCreated', { action: 'event_xls_exported', eventName, orgName });
  };

  const handlePrintQuotePdf = () => {
    const templateKey = selectedQuoteTemplate || printingDefaults?.proforma || quoteTemplateOptions[0]?.key || 'conference-proforma-grid';
    const data = buildEventPrintData('proforma');
    if (!data) {
      console.warn('Unable to generate quote print data for current event.');
      return;
    }
    openPrintPreview('proforma', templateKey, data as any);
    trackEvent('Events.EventCreated', { action: 'quote_pdf_generated', templateKey, eventName });
  };

  // Download invoice PDF for a specific invoice
  const handleDownloadInvoicePdf = (invoice: EventInvoice) => {
    const event = allEvents.find(ev => ev.id === invoice.eventId);
    if (!event) {
      alert('Event not found for this invoice.');
      return;
    }

    const settingsState = useSettingsStore.getState() as any;
    const templateKey = selectedInvoiceTemplate || printingDefaults?.invoice || invoiceTemplateOptions[0]?.key || 'corporate-invoice';
    
    // Build invoice print data from invoice and event
    const orgProfile = {
      name: settingsState?.organization?.name || settingsState?.companySettings?.tradingName || 'Hotel',
      address: settingsState?.organization?.address || settingsState?.companySettings?.address?.line1 || '',
      phone: settingsState?.organization?.phone || settingsState?.companySettings?.contact?.phone || '',
      email: settingsState?.organization?.email || settingsState?.companySettings?.contact?.email || '',
      taxId: settingsState?.organization?.taxId || settingsState?.companySettings?.taxId || '',
      logoUrl: settingsState?.branding?.logoUrl || settingsState?.companySettings?.logoUrl || ''
    };

    // Build items from event's daily schedule if available
    const items: Array<{ description: string; qty?: number; unit?: string; unitPrice?: number; amount: number; date?: string }> = [];
    const schedule = (event as any).dailySchedule || [];
    
    if (schedule.length > 0) {
      schedule.forEach((day: any, idx: number) => {
        const dayLabel = `Day ${idx + 1}`;
        const date = day.date || event.arrivalDate || event.startDate || '';
        
        // Add accommodation if residential
        if (event.residential && day.rooms && day.rooms > 0) {
          const roomRate = (event as any).roomRate || 0;
          items.push({
            description: `${dayLabel} • Accommodation`,
            qty: day.rooms,
            unit: 'rooms',
            unitPrice: roomRate,
            amount: day.rooms * roomRate,
            date
          });
        }
        
        // Add conference
        if (day.conferencePax && day.conferencePax > 0) {
          const confRate = (event as any).conferenceRate || 0;
          items.push({
            description: `${dayLabel} • Conference`,
            qty: day.conferencePax,
            unit: 'pax',
            unitPrice: confRate,
            amount: day.conferencePax * confRate,
            date
          });
        }
        
        // Add lunch
        if (day.lunchPax && day.lunchPax > 0) {
          const lunchRate = (event as any).lunchRate || 0;
          items.push({
            description: `${dayLabel} • Lunch`,
            qty: day.lunchPax,
            unit: 'pax',
            unitPrice: lunchRate,
            amount: day.lunchPax * lunchRate,
            date
          });
        }
        
        // Add dinner
        if (day.dinnerPax && day.dinnerPax > 0) {
          const dinnerRate = (event as any).dinnerRate || 0;
          items.push({
            description: `${dayLabel} • Dinner`,
            qty: day.dinnerPax,
            unit: 'pax',
            unitPrice: dinnerRate,
            amount: day.dinnerPax * dinnerRate,
            date
          });
        }
        
        // Add extra lines
        if (day.extraLines && Array.isArray(day.extraLines)) {
          day.extraLines.forEach((extra: any) => {
            if (extra.qty && extra.unitPrice) {
              items.push({
                description: `${dayLabel} • ${extra.name || 'Extra Service'}`,
                qty: extra.qty,
                unit: 'pcs',
                unitPrice: extra.unitPrice,
                amount: extra.qty * extra.unitPrice,
                date
              });
            }
          });
        }
      });
    }
    
    // Fallback if no items
    if (items.length === 0) {
      items.push({
        description: invoice.eventName || 'Event Services',
        amount: invoice.subtotal || invoice.total || 0
      });
    }

    const printTotals: any = {
      subTotal: invoice.subtotal || 0,
      taxes: invoice.tax > 0 ? [{ name: 'Tax', amount: invoice.tax }] : [],
      grandTotal: invoice.total || 0,
      balance: invoice.balance || invoice.total || 0
    };

    const data = {
      org: orgProfile,
      guest: {
        name: invoice.clientName || event.organization || 'Client',
        company: invoice.clientName || event.organization || '',
        roomNumber: undefined,
        roomType: undefined,
        arrivalDate: event.arrivalDate || event.startDate || '',
        departureDate: event.departureDate || event.endDate || '',
        nights: event.duration || 1
      },
      docNumber: invoice.id,
      docDate: invoice.issueDate || new Date().toISOString(),
      title: 'Invoice',
      items,
      totals: printTotals,
      footerNotes: [
        'Generated via Events & Conferences workflow.',
        'Invoice layout provided by Settings • Template Builder.'
      ],
      currency: '₵'
    };

    openPrintPreview('invoice', templateKey, data as any);
    trackEvent('Events.EventCreated', { action: 'invoice_pdf_downloaded', templateKey, invoiceId: invoice.id, eventId: invoice.eventId });
  };

  const handleDownloadQuotePdf = (eventData: any) => {
    if (!eventData) {
      alert('Quote data not available for this event.');
      return;
    }

    const settingsState = useSettingsStore.getState() as any;
    const orgProfile = {
      name: settingsState?.organization?.name || settingsState?.companySettings?.tradingName || 'Hotel',
      address: settingsState?.organization?.address || settingsState?.companySettings?.address?.line1 || '',
      phone: settingsState?.organization?.phone || settingsState?.companySettings?.contact?.phone || '',
      email: settingsState?.organization?.email || settingsState?.companySettings?.contact?.email || '',
      logoUrl: settingsState?.branding?.logoUrl || settingsState?.companySettings?.logoUrl || ''
    };

    const budget = getQuoteBudgetSnapshot(eventData);
    const budgetRows = [
      { label: 'Accommodation', amount: budget.accommodation },
      { label: 'Conference', amount: budget.conference },
      { label: 'Lunch', amount: budget.lunch },
      { label: 'Dinner', amount: budget.dinner },
      { label: 'Extras', amount: budget.extras }
    ].filter(row => row.amount > 0);

    const checkIn = eventData.arrivalDate || eventData.startDate || '';
    const checkOut = eventData.departureDate || eventData.endDate || '';
    const pax = Number(eventData.expectedPax || eventData.pax || eventData.attendees || 0);
    const totalAmount = budget.accommodation + budget.conference + budget.lunch + budget.dinner + budget.extras;

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Quote ${eventData.quoteNumber || formatEventId(eventData.id)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #111; }
            .header { display: flex; justify-content: space-between; align-items: center; }
            .org-info h1 { margin: 0; font-size: 24px; }
            .section { margin-top: 24px; }
            .section h2 { font-size: 16px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            .totals { font-size: 18px; font-weight: bold; margin-top: 16px; }
            .footer { margin-top: 40px; font-size: 12px; color: #666; }
            .logo { max-height: 60px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="org-info">
              <h1>${orgProfile.name}</h1>
              <div>${orgProfile.address || ''}</div>
              <div>${orgProfile.phone || ''}</div>
              <div>${orgProfile.email || ''}</div>
            </div>
            ${orgProfile.logoUrl ? `<img src="${orgProfile.logoUrl}" alt="Logo" class="logo" />` : ''}
          </div>
          <div class="section">
            <h2>Quote Details</h2>
            <table>
              <tr><th>Quote ID</th><td>${eventData.quoteNumber || formatEventId(eventData.id)}</td></tr>
              <tr><th>Client Name</th><td>${eventData.organization || eventData.clientName || 'Unknown Client'}</td></tr>
              <tr><th>Event Name</th><td>${eventData.eventName || 'Unnamed Event'}</td></tr>
              <tr><th>Check-In</th><td>${checkIn ? formatDateDisplay(checkIn) : '—'}</td></tr>
              <tr><th>Check-Out</th><td>${checkOut ? formatDateDisplay(checkOut) : '—'}</td></tr>
              <tr><th>PAX</th><td>${pax || '—'}</td></tr>
            </table>
          </div>
          <div class="section">
            <h2>Estimated Charges</h2>
            <table>
              <tr><th>Description</th><th>Amount (₵)</th></tr>
              ${budgetRows.map(row => `<tr><td>${row.label}</td><td>${formatCurrency(row.amount)}</td></tr>`).join('')}
              ${budgetRows.length === 0 ? '<tr><td colspan="2">No budget items recorded.</td></tr>' : ''}
            </table>
            <div class="totals">Total Estimate: ${formatCurrency(totalAmount)}</div>
          </div>
          <div class="footer">
            Generated on ${new Date().toLocaleString()} • Events & Conferences Proforma
          </div>
        </body>
      </html>
    `;

    const quoteWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!quoteWindow) {
      alert('Unable to open quote PDF. Please allow pop-ups and try again.');
      return;
    }

    quoteWindow.document.write(html);
    quoteWindow.document.close();
    quoteWindow.focus();
    quoteWindow.print();

    trackEvent('Events.EventCreated', {
      action: 'quote_pdf_downloaded',
      eventId: eventData.id,
      quoteNumber: eventData.quoteNumber || formatEventId(eventData.id)
    });
  };

  const handleDownloadReceiptPdf = (receipt: EventReceipt) => {
    const event = allEvents.find(ev => ev.id === receipt.eventId);
    const settingsState = useSettingsStore.getState() as any;

    const orgProfile = {
      name: settingsState?.organization?.name || settingsState?.companySettings?.tradingName || 'Hotel',
      address: settingsState?.organization?.address || settingsState?.companySettings?.address?.line1 || '',
      phone: settingsState?.organization?.phone || settingsState?.companySettings?.contact?.phone || '',
      email: settingsState?.organization?.email || settingsState?.companySettings?.contact?.email || '',
      taxId: settingsState?.organization?.taxId || settingsState?.companySettings?.taxId || '',
      logoUrl: settingsState?.branding?.logoUrl || settingsState?.companySettings?.logoUrl || ''
    };

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Receipt ${receipt.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #111; }
            .header { display: flex; justify-content: space-between; align-items: center; }
            .org-info h1 { margin: 0; font-size: 24px; }
            .section { margin-top: 24px; }
            .section h2 { font-size: 16px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            td { padding: 6px 4px; vertical-align: top; }
            .totals { font-size: 18px; font-weight: bold; margin-top: 16px; }
            .footer { margin-top: 40px; font-size: 12px; color: #666; }
            .logo { max-height: 60px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="org-info">
              <h1>${orgProfile.name}</h1>
              <div>${orgProfile.address || ''}</div>
              <div>${orgProfile.phone || ''}</div>
              <div>${orgProfile.email || ''}</div>
            </div>
            ${orgProfile.logoUrl ? `<img src="${orgProfile.logoUrl}" alt="Logo" class="logo" />` : ''}
          </div>
          <div class="section">
            <h2>Receipt Details</h2>
            <table>
              <tr><td><strong>Receipt #</strong></td><td>${receipt.id}</td></tr>
              <tr><td><strong>Date</strong></td><td>${formatDateDisplay(receipt.date)}</td></tr>
              <tr><td><strong>Event</strong></td><td>${receipt.eventName}</td></tr>
              <tr><td><strong>Client</strong></td><td>${receipt.clientName}</td></tr>
              <tr><td><strong>Recorded By</strong></td><td>${receipt.recordedBy || 'Events Team'}</td></tr>
              <tr><td><strong>Payment Method</strong></td><td>${receipt.method}</td></tr>
              <tr><td><strong>Reference</strong></td><td>${receipt.reference || '—'}</td></tr>
              <tr><td><strong>Invoice</strong></td><td>${receipt.invoiceId || '—'}</td></tr>
            </table>
            <div class="totals">Amount Received: ${formatCurrency(receipt.amount)}</div>
          </div>
          <div class="section">
            <h2>Notes</h2>
            <div>${receipt.notes || 'Payment received via folio.'}</div>
          </div>
          <div class="footer">
            Generated via Events & Conferences • ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    const receiptWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!receiptWindow) {
      alert('Unable to open receipt PDF. Please allow pop-ups and try again.');
      return;
    }
    receiptWindow.document.write(html);
    receiptWindow.document.close();
    receiptWindow.focus();

    receiptWindow.print();
    trackEvent('Events.EventCreated', { action: 'receipt_pdf_downloaded', receiptId: receipt.id, eventId: receipt.eventId, method: receipt.method });
  };

  // Comprehensive Quoting System Functions
  
  // Calculate taxes for a service line
  const calculateTaxes = (serviceLine: any, isTaxExempt: boolean = false) => {
    // If client is tax exempt, return no taxes
    if (isTaxExempt) {
      return { taxes: [], totalTax: 0, exemptionApplied: true };
    }
    
    const taxGroup = taxGroups.find(tg => tg.id === serviceLine.taxGroup);
    if (!taxGroup) return { taxes: [], totalTax: 0, exemptionApplied: false };
    
    const taxes = taxGroup.taxes.map(taxId => {
      const tax = ghanaTaxes.find(t => t.id === taxId);
      if (!tax) return null;
      
      const taxAmount = (serviceLine.totalPrice * tax.rate) / 100;
      return {
        id: tax.id,
        name: tax.name,
        rate: tax.rate,
        amount: taxAmount,
        authority: tax.authority
      };
    }).filter((tax): tax is NonNullable<typeof tax> => tax !== null);
    
    const totalTax = taxes.reduce((sum: number, tax: any) => sum + tax.amount, 0);
    return { taxes, totalTax, exemptionApplied: false };
  };
  // Calculate quote totals
  const calculateQuoteTotals = (quote: any) => {
    let subtotal = 0;
    const allTaxes: any[] = [];
    let hasTaxExemption = false;
    
    // Calculate subtotal and collect all taxes
    quote.eventTimeline.forEach((day: any) => {
      day.services.forEach((service: any) => {
        subtotal += service.totalPrice;
        const { taxes, exemptionApplied } = calculateTaxes(service, quote.taxExempt);
        if (exemptionApplied) hasTaxExemption = true;
        allTaxes.push(...taxes);
      });
    });
    
    // Group taxes by type and sum amounts
    const taxBreakdown = allTaxes.reduce((acc: any[], tax: any) => {
      const existing = acc.find((t: any) => t.id === tax.id);
      if (existing) {
        existing.amount += tax.amount;
      } else {
        acc.push({ ...tax });
      }
      return acc;
    }, []);
    
    const totalTax = taxBreakdown.reduce((sum: number, tax: any) => sum + tax.amount, 0);
    const grandTotal = subtotal + totalTax;
    const depositAmount = (grandTotal * quote.depositRequired) / 100;
    const balanceAmount = grandTotal - depositAmount;
    
    return {
      subtotal,
      taxBreakdown,
      totalTax,
      grandTotal,
      depositAmount,
      balanceAmount,
      hasTaxExemption
    };
  };

  const buildQuoteForExport = (quote?: any) => {
    let baseQuote = quote ? { ...quote } : null;
    if (!baseQuote) {
      const { quoteDraft } = buildQuoteFromCurrentEvent();
      baseQuote = quoteDraft;
    }
    if (!baseQuote) return null;
    const fallbackStart = baseQuote.startDate || startDate || new Date().toISOString().split('T')[0];
    const shouldUseQuoteDays = quoteDays.length > 0 && (!quote || (editingQuote && baseQuote.id === editingQuote.id));
    if (shouldUseQuoteDays || !baseQuote.eventTimeline || !Array.isArray(baseQuote.eventTimeline) || baseQuote.eventTimeline.length === 0) {
      const days = quoteDays.length ? quoteDays : buildQuoteFromCurrentEvent().quoteDayDrafts;
      baseQuote.eventTimeline = convertQuoteDaysToTimeline(days, fallbackStart);
    }
    baseQuote.startDate = baseQuote.startDate || fallbackStart;
    baseQuote.endDate = baseQuote.endDate || baseQuote.startDate;
    baseQuote.totalDays = baseQuote.eventTimeline.length;
    baseQuote.clientName = baseQuote.clientName || orgName;
    baseQuote.clientEmail = baseQuote.clientEmail || orgClientEmail;
    baseQuote.clientPhone = baseQuote.clientPhone || orgContactPhone;
    baseQuote.depositRequired = typeof baseQuote.depositRequired === 'number' ? baseQuote.depositRequired : (prepaymentEnabled ? prepaymentValue : 50);
    return baseQuote;
  };

  const convertTimelineToDailySchedule = (timeline: any[] = [], fallbackStartDate: string) => {
    const schedule: Array<{ date: string; conferencePax: number; lunchPax: number; dinnerPax: number; rooms: number; rate: number; extras: Record<string, number>; extraLines: Array<{ id: string; name: string; qty: number; unitPrice: number; taxGroup: string }> }> = [];
    let conferenceRateValue: number | null = null;
    let lunchRateValue: number | null = null;
    let dinnerRateValue: number | null = null;
    let roomRateValue: number | null = null;
    let packageRateValue: number | null = null;
    let maxPax = 0;
    const baseDate = fallbackStartDate ? new Date(fallbackStartDate) : new Date();

    timeline.forEach((day: any, idx: number) => {
      let conferencePax = 0;
      let lunchPax = 0;
      let dinnerPax = 0;
      let rooms = 0;
      let packageRate = 0;
      const extraLines: Array<{ id: string; name: string; qty: number; unitPrice: number; taxGroup: string }> = [];
      const services = Array.isArray(day?.services) ? day.services : [];

      services.forEach((service: any, serviceIdx: number) => {
        const qty = Number(service?.quantity ?? service?.qty ?? 0);
        const unitPrice = Number(service?.unitPrice ?? 0);
        const category = String(service?.category || '').toLowerCase();
        const nameLower = String(service?.serviceName || service?.name || '').toLowerCase();

        if (category === 'conference') {
          conferencePax = qty;
          if (conferenceRateValue === null && unitPrice > 0) conferenceRateValue = unitPrice;
        } else if (category === 'package') {
          conferencePax = qty;
          packageRate = unitPrice;
          if (packageRateValue === null && unitPrice > 0) packageRateValue = unitPrice;
        } else if (category === 'accommodation') {
          rooms = qty;
          if (roomRateValue === null && unitPrice > 0) roomRateValue = unitPrice;
        } else if (category === 'catering' || category === 'food') {
          if (nameLower.includes('dinner')) {
            dinnerPax = qty;
            if (dinnerRateValue === null && unitPrice > 0) dinnerRateValue = unitPrice;
          } else {
            lunchPax = qty;
            if (lunchRateValue === null && unitPrice > 0) lunchRateValue = unitPrice;
          }
          if (qty > 0 || unitPrice > 0) {
            extraLines.push({
              id: `${service?.serviceId || service?.id || 'extra'}-${serviceIdx}`,
              name: service?.serviceName || service?.name || 'Catering Service',
              qty,
              unitPrice,
              taxGroup: service?.taxGroup || 'ghana-standard'
            });
          }
        } else {
          if (qty > 0 || unitPrice > 0) {
            extraLines.push({
              id: `${service?.serviceId || service?.id || 'extra'}-${serviceIdx}`,
              name: service?.serviceName || service?.name || 'Additional Service',
              qty,
              unitPrice,
              taxGroup: service?.taxGroup || 'ghana-standard'
            });
          }
        }
        maxPax = Math.max(maxPax, conferencePax, lunchPax, dinnerPax);
      });
      let date = day?.date;
      if (!date) {
        const next = new Date(baseDate);
        next.setDate(next.getDate() + idx);
        date = next.toISOString().split('T')[0];
      }

      schedule.push({
        date,
        conferencePax,
        lunchPax,
        dinnerPax,
        rooms,
        rate: packageRate,
        extras: {},
        extraLines
      });
    });

    return {
      schedule,
      expectedPax: maxPax,
      rates: {
        conferenceRate: conferenceRateValue ?? conferenceRate,
        lunchRate: lunchRateValue ?? lunchRate,
        dinnerRate: dinnerRateValue ?? dinnerRate,
        roomRate: roomRateValue ?? roomRate,
        packageRate: packageRateValue ?? defaultDayRate
      },
      useParticulars: packageRateValue === null
    };
  };

  const loadQuoteIntoEventForm = (quote: any) => {
    if (!quote) return;
    const fallbackStart = quote.startDate || startDate || new Date().toISOString().split('T')[0];
    const scheduleInfo = convertTimelineToDailySchedule(quote.eventTimeline || [], fallbackStart);

    setEventName(quote.eventName || '');
    setOrgName(quote.clientName || '');
    setOrgContactPhone(quote.clientPhone || '');
    setOrgClientEmail(quote.clientEmail || '');
    setStartDate(quote.startDate || fallbackStart);
    setEndDate(quote.endDate || quote.startDate || fallbackStart);
    setExpectedPax(scheduleInfo.expectedPax || expectedPax);
    setDailySchedule(scheduleInfo.schedule);
    setRatesByParticulars(scheduleInfo.useParticulars);
    setConferenceRate(scheduleInfo.rates.conferenceRate);
    setLunchRate(scheduleInfo.rates.lunchRate);
    setDinnerRate(scheduleInfo.rates.dinnerRate);
    setRoomRate(scheduleInfo.rates.roomRate);
    setDefaultDayRate(scheduleInfo.rates.packageRate);
    setCustomParticulars([]);
    const hasAccommodation = (quote.eventTimeline || []).some((day: any) =>
      (day?.services || []).some((service: any) => String(service?.category || '').toLowerCase() === 'accommodation')
    );
    setIsResidential(hasAccommodation);
    setEventTaxExempt(Boolean(quote.taxExempt));
    const deposit = typeof quote.depositRequired === 'number' ? quote.depositRequired : (prepaymentEnabled ? prepaymentValue : 50);
    setPrepaymentEnabled(deposit > 0);
    setPrepaymentType('percent');
    setPrepaymentValue(deposit);
  };
  // Add service to a specific day
  const addServiceToDay = (quote: any, dayIndex: number, service: any, quantity: number, notes: string = '') => {
    const newService = {
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      quantity: quantity,
      unitPrice: service.basePrice,
      totalPrice: service.basePrice * quantity,
      taxGroup: service.taxGroup,
      notes: notes
    };
    
    quote.eventTimeline[dayIndex].services.push(newService);
    return quote;
  };

  // Remove service from a specific day
  const removeServiceFromDay = (quote: any, dayIndex: number, serviceIndex: number) => {
    quote.eventTimeline[dayIndex].services.splice(serviceIndex, 1);
    return quote;
  };

  // Add new day to timeline
  const addDayToTimeline = (quote: any, date: string, dayType: string) => {
    const newDay = {
      date: date,
      dayNumber: quote.eventTimeline.length + 1,
      dayType: dayType,
      services: []
    };
    quote.eventTimeline.push(newDay);
    return quote;
  };

  // Generate PDF Quote
  const generatePDFQuote = (quote?: any) => {
    const exportQuote = buildQuoteForExport(quote);
    if (!exportQuote) {
      alert('No quote data available. Please build the quote first.');
      return;
    }
    const totals = calculateQuoteTotals(exportQuote);
    const html = renderQuoteHtml(exportQuote, { subtotal: totals.subtotal, tax: totals.totalTax, total: totals.grandTotal });
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow pop-ups to generate the quote PDF.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch (err) {
        console.error('Quote print failed', err);
      }
    }, 300);
    trackEvent('Events.QuoteGenerated', { quoteId: exportQuote.id });
  };

  const sendQuoteToClient = (quote?: any) => {
    const exportQuote = buildQuoteForExport(quote);
    if (!exportQuote) {
      alert('No quote data available. Please build the quote first.');
      return;
    }
    const email = exportQuote.clientEmail || '';
    if (!email) {
      alert('Client email is missing. Please add an email address before sending.');
      return;
    }
    const totals = calculateQuoteTotals(exportQuote);
    const subject = encodeURIComponent(`Quote ${exportQuote.quoteNumber || ''} - ${exportQuote.eventName || 'Event'}`);
    const body = encodeURIComponent(
      `Hello ${exportQuote.clientName || ''},\n\n`
      + `Please find the quote summary for ${exportQuote.eventName || 'your event'}.\n\n`
      + `Event Dates: ${exportQuote.startDate} to ${exportQuote.endDate}\n`
      + `Grand Total: ₵${totals.grandTotal.toFixed(2)}\n`
      + `Deposit Required: ${exportQuote.depositRequired || 50}% (₵${totals.depositAmount.toFixed(2)})\n`
      + `Balance: ₵${totals.balanceAmount.toFixed(2)}\n\n`
      + `We are available to clarify any details.\n\n`
      + `Best regards,\nGhana Hotel & Conference Center`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    trackEvent('Events.QuoteSent', { quoteId: exportQuote.id });
  };

  const convertQuoteToBooking = (quote: any) => {
    const exportQuote = buildQuoteForExport(quote);
    if (!exportQuote) {
      alert('No quote data available to convert.');
      return;
    }
    setIsCreatingEvent(true);
    loadQuoteIntoEventForm(exportQuote);
    const eventDraft = {
      id: exportQuote.id || `evt-from-quote-${Date.now()}`,
      eventName: exportQuote.eventName,
      organization: exportQuote.clientName,
      contactPerson: exportQuote.clientName,
      contactPhone: exportQuote.clientPhone,
      contactEmail: exportQuote.clientEmail,
      arrivalDate: exportQuote.startDate,
      departureDate: exportQuote.endDate || exportQuote.startDate,
      venueName: exportQuote.venueName || '',
      venue: exportQuote.venueKey || '',
      pax: exportQuote.expectedPax || exportQuote.totalAttendees || 0,
      residential: Boolean(exportQuote.isResidential),
      status: 'pending'
    };
    setEditingEvent(eventDraft);
    setIsQuoteModalOpen(false);
    setIsEventModalOpen(true);
    trackEvent('Events.QuoteConverted', { quoteId: exportQuote.id });
  };
  // BEO (Banquet Event Order) Generation Functions
  const generateBEO = (event: any) => {
    const beoData = {
      eventId: event.id,
      eventName: event.eventName,
      organization: event.organization,
      venue: event.venueName,
      date: event.arrivalDate,
      duration: event.duration,
      pax: event.pax,
      residential: event.residential,
      revenue: event.revenue,
      deposit: event.deposit,
      balance: event.balance,
      salesManager: event.salesManager,
      contactPerson: event.contactPerson,
      contactPhone: event.contactPhone,
      contactEmail: event.contactEmail,
      specialRequirements: event.specialRequirements,
      setupTime: event.setupTime,
      status: event.status,
      linkedQuote: event.linkedQuote,
      linkedBooking: event.linkedBooking,
      linkedFolio: event.linkedFolio,
      
      // BEO Specific Fields
      roomSetup: getRoomSetupForEvent(event),
      cateringDetails: getCateringDetailsForEvent(event),
      audioVisual: getAudioVisualForEvent(event),
      staffing: getStaffingForEvent(event),
      timeline: getEventTimeline(event),
      notes: event.notes || ''
    };
    
    console.log('Generating BEO:', beoData);
    trackEvent('Events.EventCreated', { action: 'beo_generated', eventId: event.id });
    return beoData;
  };

  const getRoomSetupForEvent = (event: any) => {
    if (event?.customRoomSetup) {
      return {
        layout: event.customRoomSetup.layout || 'Theatre Style',
        tables: Number(event.customRoomSetup.tables ?? Math.ceil((event.pax || 0) / 8)),
        chairs: Number(event.customRoomSetup.chairs ?? event.pax ?? 0),
        headTable: event.customRoomSetup.headTable ? 1 : 0,
        registrationTable: Number(event.customRoomSetup.registrationTable ?? 1),
        displayTable: Number(event.customRoomSetup.displayTable ?? 1)
      };
    }

    const baseSetup = {
      layout: 'Theatre Style',
      tables: Math.ceil((event.pax || 0) / 8),
      chairs: event.pax || 0,
      headTable: (event.pax || 0) > 50 ? 1 : 0,
      registrationTable: 1,
      displayTable: 1
    };
    
    if (event.eventType === 'wedding') {
      baseSetup.layout = 'Banquet Style';
      baseSetup.headTable = 1;
      baseSetup.displayTable = 2;
    } else if (event.eventType === 'training') {
      baseSetup.layout = 'Classroom Style';
      baseSetup.tables = Math.ceil(event.pax / 6);
    }
    
    return baseSetup;
  };
  const getCateringDetailsForEvent = (event: any) => {
    if (event?.customCatering) {
      return {
        mealType: event.customCatering.mealType || 'Buffet',
        teaBreaks: Number(event.customCatering.teaBreaks ?? 1),
        lunch: event.customCatering.lunch ? 1 : 0,
        dinner: event.customCatering.dinner ? 1 : 0,
        specialDietary: Number(event.customCatering.specialDietary ?? 0),
        beverages: event.customCatering.beverages || ['Coffee', 'Tea', 'Water', 'Soft Drinks'],
        snacks: event.customCatering.snacks || ['Biscuits', 'Pastries', 'Fruits']
      };
    }

    const catering = {
      mealType: 'Buffet',
      teaBreaks: event.duration > 1 ? 2 : 1,
      lunch: event.duration > 1 ? 1 : 0,
      dinner: event.duration > 1 ? 1 : 0,
      specialDietary: event.specialRequirements?.includes('vegetarian') ? 5 : 0,
      beverages: ['Coffee', 'Tea', 'Water', 'Soft Drinks'],
      snacks: ['Biscuits', 'Pastries', 'Fruits']
    };
    
    if (event.eventType === 'wedding') {
      catering.mealType = 'Plated Service';
      catering.dinner = 1;
      catering.beverages.push('Champagne');
    }
    
    return catering;
  };
  const getAudioVisualForEvent = (event: any) => {
    if (event?.customTechnical) {
      return {
        projector: Number(event.customTechnical.projector ?? 1),
        screen: Number(event.customTechnical.screen ?? 1),
        soundSystem: Number(event.customTechnical.soundSystem ?? 1),
        microphones: Number(event.customTechnical.microphones ?? 1),
        laptop: Number(event.customTechnical.laptop ?? 1),
        internet: event.customTechnical.internet || 'High-speed WiFi',
        lighting: event.customTechnical.lighting || 'Standard',
        recording: Boolean(event.customTechnical.recording)
      };
    }

    return {
      projector: 1,
      screen: 1,
      soundSystem: 1,
      microphones: event.pax > 50 ? 2 : 1,
      laptop: 1,
      internet: 'High-speed WiFi',
      lighting: 'Standard',
      recording: event.eventType === 'conference' ? true : false
    };
  };
  const getStaffingForEvent = (event: any) => {
    return {
      eventManager: 1,
      waitStaff: Math.ceil(event.pax / 25),
      kitchenStaff: Math.ceil(event.pax / 50),
      security: event.pax > 100 ? 1 : 0,
      technicalSupport: 1,
      cleaningStaff: 2
    };
  };

  const getEventTimeline = (event: any) => {
    if (event?.customTimeline?.length) {
      return event.customTimeline.map((item: any) => ({
        time: item.time || '',
        activity: item.activity || '',
        responsible: item.responsible || '',
        duration: item.duration || ''
      }));
    }

    const timeline = [];
    const startHour = 9; // Default start time
    
    timeline.push({
      time: `${startHour - 2}:00`,
      activity: 'Setup begins',
      responsible: 'Operations Team',
      duration: '2 hours'
    });
    
    timeline.push({
      time: `${startHour - 1}:00`,
      activity: 'Final setup and testing',
      responsible: 'Technical Team',
      duration: '1 hour'
    });
    
    timeline.push({
      time: `${startHour}:00`,
      activity: 'Event starts',
      responsible: 'Event Manager',
      duration: 'Event duration'
    });
    
    if (event.duration > 1) {
      timeline.push({
        time: `${startHour + 4}:00`,
        activity: 'Tea break',
        responsible: 'Catering Team',
        duration: '30 minutes'
      });
      
      if (event.duration > 2) {
        timeline.push({
          time: `${startHour + 6}:00`,
          activity: 'Lunch break',
          responsible: 'Catering Team',
          duration: '1 hour'
        });
      }
    }
    
    timeline.push({
      time: `${startHour + event.duration * 4}:00`,
      activity: 'Event ends',
      responsible: 'Event Manager',
      duration: 'Cleanup begins'
    });
    
    return timeline;
  };
  // Function Sheet Generation Functions
  const generateFunctionSheet = (event: any) => {
    const functionSheetData = {
      eventId: event.id,
      eventName: event.eventName,
      organization: event.organization,
      venue: event.venueName,
      date: event.arrivalDate,
      duration: event.duration,
      pax: event.pax,
      residential: event.residential,
      revenue: event.revenue,
      salesManager: event.salesManager,
      contactPerson: event.contactPerson,
      contactPhone: event.contactPhone,
      contactEmail: event.contactEmail,
      specialRequirements: event.specialRequirements,
      setupTime: event.setupTime,
      
      // Function Sheet Specific Fields
      roomSpecifications: getRoomSpecifications(event),
      cateringSpecifications: getCateringSpecifications(event),
      technicalSpecifications: getTechnicalSpecifications(event),
      serviceSchedule: getServiceSchedule(event),
      specialInstructions: getSpecialInstructions(event),
      contactList: getContactList(event)
    };
    
    console.log('Generating Function Sheet:', functionSheetData);
    trackEvent('Events.EventCreated', { action: 'function_sheet_generated', eventId: event.id });
    return functionSheetData;
  };

  const getRoomSpecifications = (event: any) => {
    const base = {
      roomName: event.venueName,
      capacity: event.pax,
      layout: getRoomSetupForEvent(event).layout,
      temperature: '22-24°C',
      lighting: 'Adjustable',
      access: 'Main entrance, elevator available',
      parking: 'Available for guests',
      setupNotes: event.specialRequirements || 'Standard setup'
    };

    if (event?.customRoomDetails) {
      return {
        roomName: event.customRoomDetails.roomName || base.roomName,
        capacity: Number(event.customRoomDetails.capacity ?? base.capacity),
        layout: base.layout,
        temperature: event.customRoomDetails.temperature || base.temperature,
        lighting: event.customRoomDetails.lighting || base.lighting,
        access: event.customRoomDetails.access || base.access,
        parking: event.customRoomDetails.parking || base.parking,
        setupNotes: event.customRoomDetails.setupNotes || base.setupNotes
      };
    }

    return base;
  };
  const getCateringSpecifications = (event: any) => {
    const catering = getCateringDetailsForEvent(event);
    const base = {
      ...catering,
      serviceStyle: catering.mealType === 'Plated Service' ? 'Formal' : 'Casual',
      dietaryAccommodations: catering.specialDietary > 0 ? 'Vegetarian options available' : 'Standard menu',
      allergies: 'Please inform in advance',
      presentation: 'Professional buffet setup with garnishes'
    };

    if (event?.customCatering) {
      return {
        ...base,
        serviceStyle: event.customCatering.serviceStyle || base.serviceStyle,
        dietaryAccommodations: event.customCatering.dietaryAccommodations || base.dietaryAccommodations,
        allergies: event.customCatering.allergies || base.allergies,
        presentation: event.customCatering.presentation || base.presentation,
        beverages: event.customCatering.beverages || base.beverages,
        snacks: event.customCatering.snacks || base.snacks
      };
    }

    return base;
  };

  const getTechnicalSpecifications = (event: any) => {
    const av = getAudioVisualForEvent(event);
    const base = {
      ...av,
      backupEquipment: 'Spare projector and microphone available',
      internetSpeed: '100 Mbps dedicated line',
      powerRequirements: 'Multiple power outlets available',
      technicalSupport: 'Available throughout event',
      notes: event.specialRequirements || 'Standard AV coverage'
    };

    if (event?.customTechnical) {
      return {
        ...base,
        backupEquipment: event.customTechnical.backupEquipment || base.backupEquipment,
        internetSpeed: event.customTechnical.internetSpeed || base.internetSpeed,
        powerRequirements: event.customTechnical.powerRequirements || base.powerRequirements,
        technicalSupport: event.customTechnical.technicalSupport || base.technicalSupport,
        notes: event.customTechnical.notes || base.notes
      };
    }

    return base;
  };

  const getServiceSchedule = (event: any) => {
    if (event?.customServiceSchedule?.length) {
      return event.customServiceSchedule.map((item: any) => ({
        time: item.time || '',
        activity: item.activity || '',
        department: item.department || '',
        status: item.status || 'Pending',
        duration: item.duration || '',
        notes: item.notes || ''
      }));
    }

    const timeline = getEventTimeline(event);
    return timeline.map((item: any) => ({
      ...item,
      department: item.responsible,
      status: 'Pending',
      notes: ''
    }));
  };
  const getSpecialInstructions = (event: any) => {
    if (event?.customInstructions?.length) {
      return event.customInstructions;
    }

    const instructions = [];
    
    if (event.specialRequirements?.includes('wheelchair')) {
      instructions.push('Wheelchair accessible venue required');
    }
    
    if (event.specialRequirements?.includes('vegetarian')) {
      instructions.push('Vegetarian meal options for 5 attendees');
    }
    
    if (event.pax > 100) {
      instructions.push('High-capacity event - additional staff required');
    }
    
    if (event.residential) {
      instructions.push('Accommodation arrangements confirmed');
    }
    
    return instructions.length > 0 ? instructions : ['Standard service protocols apply'];
  };

  const getContactList = (event: any) => {
    if (event?.customContacts?.length) {
      return event.customContacts.map((contact: any) => ({
        name: contact.name || '',
        role: contact.role || '',
        phone: contact.phone || '',
        email: contact.email || ''
      }));
    }

    return [
      {
        name: event.contactPerson,
        role: 'Event Coordinator',
        phone: event.contactPhone,
        email: event.contactEmail
      },
      {
        name: event.salesManager,
        role: 'Sales Manager',
        phone: '+233 20 123 4567',
        email: 'sales@ghana-hotel.com'
      },
      {
        name: 'Operations Manager',
        role: 'Venue Operations',
        phone: '+233 20 123 4568',
        email: 'operations@ghana-hotel.com'
      },
      {
        name: 'Catering Manager',
        role: 'Food & Beverage',
        phone: '+233 20 123 4569',
        email: 'catering@ghana-hotel.com'
      }
    ];
  };
  useEffect(() => {
    if (isBEOModalOpen && selectedEventForBEO) {
      const roomSetup = getRoomSetupForEvent(selectedEventForBEO);
      const roomSpecs = getRoomSpecifications(selectedEventForBEO);
      const cateringDetails = getCateringDetailsForEvent(selectedEventForBEO);
      const cateringSpecs = getCateringSpecifications(selectedEventForBEO);
      const technicalDetails = getAudioVisualForEvent(selectedEventForBEO);
      const technicalSpecs = getTechnicalSpecifications(selectedEventForBEO);
      const timeline = getEventTimeline(selectedEventForBEO);
      const schedule = getServiceSchedule(selectedEventForBEO);
      const instructions = getSpecialInstructions(selectedEventForBEO);
      const contacts = getContactList(selectedEventForBEO);

      setBeoForm({
        eventInfo: {
          eventName: selectedEventForBEO.eventName || '',
          organization: selectedEventForBEO.organization || '',
          contactPerson: selectedEventForBEO.contactPerson || '',
          contactPhone: selectedEventForBEO.contactPhone || '',
          contactEmail: selectedEventForBEO.contactEmail || '',
          arrivalDate: selectedEventForBEO.arrivalDate || '',
          departureDate: selectedEventForBEO.departureDate || '',
          duration: String(selectedEventForBEO.duration ?? ''),
          venueName: selectedEventForBEO.venueName || '',
          pax: String(selectedEventForBEO.pax ?? ''),
          notes: selectedEventForBEO.notes || ''
        },
        room: {
          layout: roomSetup.layout || '',
          tables: String(roomSetup.tables ?? ''),
          chairs: String(roomSetup.chairs ?? ''),
          headTable: Boolean(roomSetup.headTable),
          registrationTable: String(roomSetup.registrationTable ?? ''),
          displayTable: String(roomSetup.displayTable ?? ''),
          capacity: String(roomSpecs.capacity ?? selectedEventForBEO.pax ?? ''),
          temperature: roomSpecs.temperature || '',
          lighting: roomSpecs.lighting || '',
          access: roomSpecs.access || '',
          parking: roomSpecs.parking || '',
          setupNotes: roomSpecs.setupNotes || ''
        },
        catering: {
          serviceStyle: cateringSpecs.serviceStyle || '',
          mealType: cateringSpecs.mealType || '',
          teaBreaks: String(cateringSpecs.teaBreaks ?? ''),
          lunch: Boolean(cateringDetails.lunch),
          dinner: Boolean(cateringDetails.dinner),
          dietaryAccommodations: cateringSpecs.dietaryAccommodations || '',
          allergies: cateringSpecs.allergies || '',
          presentation: cateringSpecs.presentation || '',
          beverages: (cateringSpecs.beverages || []).join(', '),
          snacks: (cateringSpecs.snacks || []).join(', '),
          specialDietary: String(cateringDetails.specialDietary ?? 0)
        },
        technical: {
          projector: String(technicalDetails.projector ?? ''),
          screen: String(technicalDetails.screen ?? ''),
          soundSystem: String(technicalDetails.soundSystem ?? ''),
          microphones: String(technicalDetails.microphones ?? ''),
          laptop: String(technicalDetails.laptop ?? ''),
          internet: technicalDetails.internet || '',
          lighting: technicalDetails.lighting || '',
          recording: Boolean(technicalDetails.recording),
          backupEquipment: technicalSpecs.backupEquipment || '',
          technicalSupport: technicalSpecs.technicalSupport || '',
          internetSpeed: technicalSpecs.internetSpeed || '',
          powerRequirements: technicalSpecs.powerRequirements || '',
          notes: technicalSpecs.notes || selectedEventForBEO.specialRequirements || ''
        },
        timeline: timeline.map((item: any) => ({ ...item })),
        departmentChecklist: schedule.map((item: any) => ({ ...item })),
        instructions: instructions.length ? [...instructions] : [''],
        contacts: contacts.map((contact: any) => ({ ...contact }))
      });
    } else if (!isBEOModalOpen) {
      setBeoForm(null);
    }
  }, [isBEOModalOpen, selectedEventForBEO]);

  const updateBeoFormSection = (section: 'eventInfo' | 'room' | 'catering' | 'technical', field: string, value: any) => {
    setBeoForm((prev: any) => (prev ? { ...prev, [section]: { ...prev[section], [field]: value } } : prev));
  };

  const updateBeoTimelineItem = (index: number, field: string, value: any) => {
    setBeoForm((prev: any) => {
      if (!prev) return prev;
      const timeline = prev.timeline.map((item: any, idx: number) => (idx === index ? { ...item, [field]: value } : item));
      return { ...prev, timeline };
    });
  };

  const handleAddBeoTimeline = () => {
    setBeoForm((prev: any) => (prev ? { ...prev, timeline: [...prev.timeline, { time: '', activity: '', responsible: '', duration: '' }] } : prev));
  };

  const handleRemoveBeoTimeline = (index: number) => {
    setBeoForm((prev: any) => {
      if (!prev) return prev;
      const next = prev.timeline.filter((_: any, idx: number) => idx !== index);
      return { ...prev, timeline: next.length ? next : [{ time: '', activity: '', responsible: '', duration: '' }] };
    });
  };

  const updateBeoChecklistItem = (index: number, field: string, value: any) => {
    setBeoForm((prev: any) => {
      if (!prev) return prev;
      const departmentChecklist = prev.departmentChecklist.map((item: any, idx: number) =>
        idx === index ? { ...item, [field]: value } : item
      );
      return { ...prev, departmentChecklist };
    });
  };

  const handleAddBeoChecklist = () => {
    setBeoForm((prev: any) => (
      prev ? { ...prev, departmentChecklist: [...prev.departmentChecklist, { time: '', activity: '', department: '', status: 'Pending', duration: '', notes: '' }] } : prev
    ));
  };

  const handleRemoveBeoChecklist = (index: number) => {
    setBeoForm((prev: any) => {
      if (!prev) return prev;
      const next = prev.departmentChecklist.filter((_: any, idx: number) => idx !== index);
      return { ...prev, departmentChecklist: next.length ? next : [{ time: '', activity: '', department: '', status: 'Pending', duration: '', notes: '' }] };
    });
  };

  const updateBeoInstruction = (index: number, value: string) => {
    setBeoForm((prev: any) => {
      if (!prev) return prev;
      const instructions = prev.instructions.map((item: string, idx: number) => (idx === index ? value : item));
      return { ...prev, instructions };
    });
  };

  const handleAddBeoInstruction = () => {
    setBeoForm((prev: any) => (prev ? { ...prev, instructions: [...prev.instructions, ''] } : prev));
  };

  const handleRemoveBeoInstruction = (index: number) => {
    setBeoForm((prev: any) => {
      if (!prev) return prev;
      const next = prev.instructions.filter((_item: string, idx: number) => idx !== index);
      return { ...prev, instructions: next.length ? next : [''] };
    });
  };

  const updateBeoContact = (index: number, field: string, value: any) => {
    setBeoForm((prev: any) => {
      if (!prev) return prev;
      const contacts = prev.contacts.map((contact: any, idx: number) => (idx === index ? { ...contact, [field]: value } : contact));
      return { ...prev, contacts };
    });
  };

  const handleAddBeoContact = () => {
    setBeoForm((prev: any) => (
      prev ? { ...prev, contacts: [...prev.contacts, { name: '', role: '', phone: '', email: '' }] } : prev
    ));
  };

  const handleRemoveBeoContact = (index: number) => {
    setBeoForm((prev: any) => {
      if (!prev) return prev;
      const next = prev.contacts.filter((_item: any, idx: number) => idx !== index);
      return { ...prev, contacts: next.length ? next : [{ name: '', role: '', phone: '', email: '' }] };
    });
  };
  const buildEventFromBeoForm = () => {
    if (!selectedEventForBEO || !beoForm) return selectedEventForBEO;

    const parseList = (value: string) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    const customRoomSetup = {
      layout: beoForm.room.layout || 'Theatre Style',
      tables: Number(beoForm.room.tables || 0),
      chairs: Number(beoForm.room.chairs || 0),
      headTable: beoForm.room.headTable ? 1 : 0,
      registrationTable: Number(beoForm.room.registrationTable || 0),
      displayTable: Number(beoForm.room.displayTable || 0)
    };

    const customRoomDetails = {
      roomName: beoForm.eventInfo.venueName,
      capacity: Number(beoForm.room.capacity || 0),
      temperature: beoForm.room.temperature,
      lighting: beoForm.room.lighting,
      access: beoForm.room.access,
      parking: beoForm.room.parking,
      setupNotes: beoForm.room.setupNotes
    };

    const customCatering = {
      mealType: beoForm.catering.mealType,
      teaBreaks: Number(beoForm.catering.teaBreaks || 0),
      lunch: beoForm.catering.lunch ? 1 : 0,
      dinner: beoForm.catering.dinner ? 1 : 0,
      specialDietary: Number(beoForm.catering.specialDietary || 0),
      beverages: parseList(beoForm.catering.beverages || ''),
      snacks: parseList(beoForm.catering.snacks || ''),
      serviceStyle: beoForm.catering.serviceStyle,
      dietaryAccommodations: beoForm.catering.dietaryAccommodations,
      allergies: beoForm.catering.allergies,
      presentation: beoForm.catering.presentation
    };

    const customTechnical = {
      projector: Number(beoForm.technical.projector || 0),
      screen: Number(beoForm.technical.screen || 0),
      soundSystem: Number(beoForm.technical.soundSystem || 0),
      microphones: Number(beoForm.technical.microphones || 0),
      laptop: Number(beoForm.technical.laptop || 0),
      internet: beoForm.technical.internet,
      lighting: beoForm.technical.lighting,
      recording: Boolean(beoForm.technical.recording),
      backupEquipment: beoForm.technical.backupEquipment,
      technicalSupport: beoForm.technical.technicalSupport,
      internetSpeed: beoForm.technical.internetSpeed,
      powerRequirements: beoForm.technical.powerRequirements,
      notes: beoForm.technical.notes
    };

    const customTimeline = (beoForm.timeline || []).map((item: any) => ({
      time: item.time || '',
      activity: item.activity || '',
      responsible: item.responsible || '',
      duration: item.duration || ''
    }));

    const customServiceSchedule = (beoForm.departmentChecklist || []).map((item: any) => ({
      time: item.time || '',
      activity: item.activity || '',
      department: item.department || '',
      status: item.status || 'Pending',
      duration: item.duration || '',
      notes: item.notes || ''
    }));

    const customContacts = (beoForm.contacts || []).map((contact: any) => ({
      name: contact.name || '',
      role: contact.role || '',
      phone: contact.phone || '',
      email: contact.email || ''
    }));
    const customInstructions = (beoForm.instructions || []).filter((instruction: string) => instruction.trim().length > 0);
    const instructionSummary = customInstructions.join('\n');
    const combinedSpecialRequirements = [
      beoForm.room.setupNotes,
      instructionSummary
    ].filter(Boolean).join('\n').trim();

    return {
      ...selectedEventForBEO,
      eventName: beoForm.eventInfo.eventName,
      organization: beoForm.eventInfo.organization,
      contactPerson: beoForm.eventInfo.contactPerson,
      contactPhone: beoForm.eventInfo.contactPhone,
      contactEmail: beoForm.eventInfo.contactEmail,
      arrivalDate: beoForm.eventInfo.arrivalDate,
      departureDate: beoForm.eventInfo.departureDate,
      duration: Number(beoForm.eventInfo.duration || selectedEventForBEO.duration || 0),
      venueName: beoForm.eventInfo.venueName,
      venue: selectedEventForBEO.venue || selectedEventForBEO.venueKey || '',
      venueKey: selectedEventForBEO.venueKey || selectedEventForBEO.venue || '',
      pax: Number(beoForm.eventInfo.pax || selectedEventForBEO.pax || 0),
      specialRequirements: combinedSpecialRequirements || selectedEventForBEO.specialRequirements || '',
      notes: beoForm.eventInfo.notes || beoForm.technical.notes || selectedEventForBEO.notes,
      customRoomSetup,
      customRoomDetails,
      customCatering,
      customTechnical,
      customTimeline,
      customServiceSchedule,
      customInstructions,
      customContacts,
      lastBeoUpdatedAt: new Date().toISOString()
    };
  };

  const handleSaveBeoForm = () => {
    if (!selectedEventForBEO || !beoForm) return;
    const updatedEvent = buildEventFromBeoForm();
    if (!updatedEvent) return;
    setSelectedEventForBEO(updatedEvent);
    setCustomEvents((prev) => prev.map((ev) => (ev.id === updatedEvent.id ? { ...ev, ...updatedEvent } : ev)));

    if (updatedEvent.linkedBooking) {
      const instructionsSummary = (updatedEvent.customInstructions && updatedEvent.customInstructions.length)
        ? updatedEvent.customInstructions.join('\n')
        : updatedEvent.specialRequirements || '';

      enhancedFrontOfficeStore.updateEventBooking(updatedEvent.linkedBooking, {
        eventName: updatedEvent.eventName,
        startDate: updatedEvent.arrivalDate,
        endDate: updatedEvent.departureDate,
        attendees: updatedEvent.pax,
        corporateClientName: updatedEvent.organization,
        contactPhone: updatedEvent.contactPhone,
        contactEmail: updatedEvent.contactEmail,
        specialRequirements: instructionsSummary
      });
    }

    generateBEO(updatedEvent);
    generateFunctionSheet(updatedEvent);
    trackEvent('Events.EventCreated', { action: 'beo_saved', eventId: updatedEvent.id });
  };

  // Helper functions for export operations
  const getFoodBeverageServices = (event: any) => {
    const services = [];
    if (event.duration > 0) services.push('ARRIVAL DINNER');
    if (event.duration > 1) {
      services.push('MORNING SNACK', 'LUNCH');
      if (event.duration > 2) services.push('AFTERNOON SNACK', 'DINNER');
    }
    return services.join(', ');
  };

  const getHousekeepingNotes = (event: any) => {
    if (event.residential) {
      return `PREPARE ${event.pax} ROOMS`;
    }
    return 'N/A';
  };

  const getProgrammeType = (event: any) => {
    switch (event.eventType) {
      case 'residential-conference':
        return 'RESIDENTIAL CONFERENCE';
      case 'non-residential':
        return 'NON-RESIDENTIAL CONFERENCE';
      case 'conference':
        return 'CONFERENCE';
      case 'workshop':
        return 'WORKSHOP';
      case 'training':
        return 'TRAINING';
      case 'wedding':
        return 'WEDDING';
      case 'banquet':
        return 'BANQUET';
      case 'meeting':
        return 'MEETING';
      case 'launch':
        return 'PRODUCT LAUNCH';
      case 'auditorium':
        return 'AUDITORIUM EVENT';
      default:
        return 'EVENT';
    }
  };
  // Function Schedule Export Functions
  const exportFunctionSchedulePDF = () => {
    try {
      // Track the export action
      trackEvent('Events.EventCreated', { action: 'function_schedule_pdf_exported', eventCount: allEvents.length });
      
      // Create PDF content
      const pdfContent = `
        Provisional Function Schedule - August 2025
        Generated on: ${new Date().toLocaleDateString()}
        
        Total Functions: ${allEvents.length}
        Confirmed: ${allEvents.filter(e => normalizeStatus(e.status) === 'confirmed').length}
        Quote: ${allEvents.filter(e => normalizeStatus(e.status) === 'quote').length}
        Total Attendees: ${allEvents.reduce((sum, e) => sum + e.pax, 0)}
        
        ${allEvents.map((event, index) => `
          ${index + 1}. ${event.eventName}
          Organization: ${event.organization}
          Event Type: ${event.eventType}
          Programme Type: ${getProgrammeType(event)}
          Venue: ${event.venueName}
          Dates: ${event.arrivalDate} - ${event.departureDate}
          Duration: ${event.duration} days
          Attendees: ${event.pax}
          Status: ${event.status}
          Food & Beverage: ${getFoodBeverageServices(event)}
          Housekeeping/Front Desk: ${getHousekeepingNotes(event)}
        `).join('\n\n')}
      `;
      
      // Create blob and download
      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `function-schedule-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('Function Schedule PDF exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };
  const exportFunctionSheetPDF = () => {
    if (!selectedEventForBEO || !beoForm) {
      alert('Select an event and complete the BEO form to export the function sheet.');
      return;
    }
    const sheetSource = buildEventFromBeoForm();
    const sheet = generateFunctionSheet(sheetSource);
    const room = getRoomSpecifications(sheetSource);
    const catering = getCateringSpecifications(sheetSource);
    const tech = getTechnicalSpecifications(sheetSource);
    const schedule = getServiceSchedule(sheetSource);
    const instructions = getSpecialInstructions(sheetSource);
    const contacts = getContactList(sheetSource);
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Function Sheet - ${sheet.eventName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
            h1 { font-size: 26px; margin-bottom: 4px; }
            h2 { font-size: 20px; margin-top: 24px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 14px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
            .section { margin-bottom: 24px; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #e0f2fe; color: #0c4a6e; font-size: 12px; }
            ul { margin: 8px 0; padding-left: 20px; }
          </style>
        </head>
        <body>
          <h1>Function Sheet</h1>
          <p style="color:#6b7280;">Generated on ${new Date().toLocaleDateString()}</p>

          <div class="section">
            <h2>Event Information</h2>
            <div class="grid">
              <div>
                <p><strong>Event:</strong> ${sheet.eventName}</p>
                <p><strong>Organization:</strong> ${sheet.organization}</p>
                <p><strong>Venue:</strong> ${sheet.venue}</p>
              </div>
              <div>
                <p><strong>Date:</strong> ${sheet.date}</p>
                <p><strong>Duration:</strong> ${sheet.duration} days</p>
                <p><strong>Attendees:</strong> ${sheet.pax}</p>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Room Specifications</h2>
            <table>
              <tbody>
                <tr><th>Room</th><td>${room.roomName}</td></tr>
                <tr><th>Capacity</th><td>${room.capacity}</td></tr>
                <tr><th>Layout</th><td>${room.layout}</td></tr>
                <tr><th>Temperature</th><td>${room.temperature}</td></tr>
                <tr><th>Lighting</th><td>${room.lighting}</td></tr>
                <tr><th>Access</th><td>${room.access}</td></tr>
                <tr><th>Parking</th><td>${room.parking}</td></tr>
                <tr><th>Setup Notes</th><td>${room.setupNotes}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Catering Specifications</h2>
            <table>
              <tbody>
                <tr><th>Service Style</th><td>${catering.serviceStyle}</td></tr>
                <tr><th>Meal Type</th><td>${catering.mealType}</td></tr>
                <tr><th>Beverages</th><td>${(catering.beverages || []).join(', ')}</td></tr>
                <tr><th>Snacks</th><td>${(catering.snacks || []).join(', ')}</td></tr>
                <tr><th>Dietary Accommodations</th><td>${catering.dietaryAccommodations}</td></tr>
                <tr><th>Allergies</th><td>${catering.allergies}</td></tr>
                <tr><th>Presentation</th><td>${catering.presentation}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Technical Specifications</h2>
            <table>
              <tbody>
                <tr><th>Projector</th><td>${tech.projector}</td></tr>
                <tr><th>Screen</th><td>${tech.screen}</td></tr>
                <tr><th>Sound System</th><td>${tech.soundSystem}</td></tr>
                <tr><th>Microphones</th><td>${tech.microphones}</td></tr>
                <tr><th>Internet Speed</th><td>${tech.internetSpeed}</td></tr>
                <tr><th>Power Requirements</th><td>${tech.powerRequirements}</td></tr>
                <tr><th>Backup Equipment</th><td>${tech.backupEquipment}</td></tr>
                <tr><th>Technical Support</th><td>${tech.technicalSupport}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Service Schedule</h2>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Activity</th>
                  <th>Department</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                ${schedule.map((item: any) => `
                  <tr>
                    <td>${item.time}</td>
                    <td>${item.activity}</td>
                    <td>${item.department}</td>
                    <td>${item.duration}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Special Instructions</h2>
            <ul>
              ${instructions.map((instruction: string) => `<li>${instruction}</li>`).join('')}
            </ul>
          </div>

          <div class="section">
            <h2>Contact List</h2>
            <table>
              <thead>
                <tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th></tr>
              </thead>
              <tbody>
                ${contacts.map((contact: any) => `
                  <tr>
                    <td>${contact.name}</td>
                    <td>${contact.role}</td>
                    <td>${contact.phone}</td>
                    <td>${contact.email}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow pop-ups to export the Function Sheet.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch (err) {
        console.error('Function sheet print failed', err);
      }
    }, 300);
    trackEvent('Events.EventCreated', { action: 'function_sheet_pdf_exported', eventId: sheet.eventId });
  };
  const downloadFunctionScheduleCSV = () => {
    try {
      // Track the export action
      trackEvent('Events.EventCreated', { action: 'function_schedule_csv_downloaded', eventCount: allEvents.length });
      
      // Create CSV content
      const headers = [
        'Item',
        'Organization',
        'Event Name',
        'Venue',
        'Arrival Date',
        'Departure Date',
        'Duration (Days)',
        'Attendees',
        'Status',
        'Revenue (GH₵)',
        'Sales Manager',
        'Contact Person',
        'Contact Phone',
        'Contact Email'
      ];
      
      const csvContent = [
        headers.join(','),
        ...allEvents.map((event, index) => [
          index + 1,
          `"${event.organization}"`,
          `"${event.eventName}"`,
          `"${event.venueName}"`,
          event.arrivalDate,
          event.departureDate,
          event.duration,
          event.pax,
          event.status,
          event.revenue,
          `"${event.salesManager}"`,
          `"${event.contactPerson}"`,
          `"${event.contactPhone}"`,
          `"${event.contactEmail}"`
        ].join(','))
      ].join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `function-schedule-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('Function Schedule CSV downloaded successfully');
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };
  const shareToDepartments = () => {
    try {
      // Track the share action
      trackEvent('Events.EventCreated', { action: 'function_schedule_shared_to_departments', eventCount: allEvents.length });
      
      // Create summary for departments
      const summary = {
        totalFunctions: allEvents.length,
        confirmedEvents: allEvents.filter(e => normalizeStatus(e.status) === 'confirmed').length,
        quoteEvents: allEvents.filter(e => normalizeStatus(e.status) === 'quote').length,
        totalAttendees: allEvents.reduce((sum, e) => sum + e.pax, 0),
        totalRevenue: allEvents.reduce((sum, e) => sum + e.revenue, 0),
        eventsByVenue: allEvents.reduce((acc, event) => {
          acc[event.venueName] = (acc[event.venueName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        eventsByStatus: allEvents.reduce((acc, event) => {
          const normalized = normalizeStatus(event.status);
          acc[normalized] = (acc[normalized] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
      
      // Simulate sending to departments
      const departments = ['Operations', 'Catering', 'Housekeeping', 'Security', 'Finance'];
      const message = `Function Schedule Summary sent to ${departments.join(', ')} departments:
      
Total Functions: ${summary.totalFunctions}
Confirmed Events: ${summary.confirmedEvents}
Quote Events: ${summary.quoteEvents}
Total Attendees: ${summary.totalAttendees}
Total Revenue: ₵${summary.totalRevenue.toLocaleString()}

Venue Distribution:
${Object.entries(summary.eventsByVenue).map(([venue, count]) => `- ${venue}: ${count} events`).join('\n')}

Status Distribution:
${Object.entries(summary.eventsByStatus).map(([status, count]) => `- ${status}: ${count} events`).join('\n')}
`;
      
      // Show success message (in a real app, this would send emails/notifications)
      alert(`✅ Function Schedule shared successfully to all departments!\n\n${message}`);
      
      console.log('Function Schedule shared to departments:', summary);
    } catch (error) {
      console.error('Error sharing to departments:', error);
    }
  };

  const openInvoiceModal = (mode: 'create' | 'edit', invoice?: EventInvoice, eventOverride?: any) => {
    const today = new Date();
    
    // If invoice is provided, use it directly
    if (invoice) {
      setInvoiceForm({ ...invoice });
      setInvoiceModalMode(mode);
      setInvoiceErrors({});
      setIsInvoiceModalOpen(true);
      return;
    }

    // If eventOverride is provided with invoice form fields, use them directly
    if (eventOverride && (eventOverride.eventId || eventOverride.eventName)) {
      setInvoiceForm({
        id: `INV-${Date.now().toString().slice(-6)}`,
        eventId: eventOverride.eventId || '',
        eventName: eventOverride.eventName || '',
        clientName: eventOverride.clientName || '',
        issueDate: eventOverride.issueDate || today.toISOString().split('T')[0],
        dueDate: eventOverride.dueDate || new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: Number(eventOverride.subtotal || 0),
        tax: Number(eventOverride.tax || 0),
        total: Number(eventOverride.total || eventOverride.subtotal || 0),
        balance: Number(eventOverride.balance || eventOverride.total || eventOverride.subtotal || 0),
        status: 'Draft',
        reference: eventOverride.reference || '',
        notes: eventOverride.notes || ''
      });
      setInvoiceModalMode(mode);
      setInvoiceErrors({});
      setIsInvoiceModalOpen(true);
      return;
    }

    // Otherwise, find event and use defaults
    let defaultEvent: any = null;
    if (eventOverride && typeof eventOverride === 'object' && 'id' in eventOverride) {
      defaultEvent = eventOverride;
    } else {
      // invoice is undefined here since we already handled it above
      defaultEvent = allEvents[0];
    }
    const defaultIssue = today.toISOString().split('T')[0];
    const defaultDue = new Date(today.getTime() + 7 * DAY_IN_MS).toISOString().split('T')[0];

    setInvoiceForm({
      id: `INV-${Date.now().toString().slice(-6)}`,
      eventId: defaultEvent?.id || '',
      eventName: getEventDisplayName(defaultEvent),
      clientName: getEventClientName(defaultEvent),
      issueDate: defaultIssue,
      dueDate: defaultDue,
      subtotal: Number(defaultEvent?.revenue || defaultEvent?.totalCost || 0),
      tax: 0,
      total: Number(defaultEvent?.revenue || defaultEvent?.totalCost || 0),
      balance: Number(defaultEvent?.revenue || defaultEvent?.totalCost || 0),
      status: 'Draft',
      reference: '',
      notes: ''
    });
    setInvoiceModalMode(mode);
    setInvoiceErrors({});
    setIsInvoiceModalOpen(true);
  };


  const validateInvoiceForm = () => {
    const errors: Record<string, string> = {};
    if (!invoiceForm.eventId) errors.eventId = 'Select an event';
    if (!invoiceForm.clientName || !invoiceForm.clientName.trim()) errors.clientName = 'Client name is required';
    if (!invoiceForm.issueDate) errors.issueDate = 'Issue date is required';
    if (!invoiceForm.dueDate) errors.dueDate = 'Due date is required';
    if (Number.isNaN(Number(invoiceForm.subtotal)) || Number(invoiceForm.subtotal ?? 0) < 0) errors.subtotal = 'Enter a valid subtotal';
    if (Number.isNaN(Number(invoiceForm.tax))) errors.tax = 'Enter a valid tax amount';
    if (Number.isNaN(Number(invoiceForm.total))) errors.total = 'Enter a valid total';
    if (Number.isNaN(Number(invoiceForm.balance))) errors.balance = 'Enter a valid balance';
    setInvoiceErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const handleInvoiceSave = () => {
    if (!validateInvoiceForm()) return;
    const event = allEvents.find(ev => ev.id === invoiceForm.eventId);
    const subtotal = Number(invoiceForm.subtotal ?? 0);
    const tax = Number(invoiceForm.tax ?? 0);
    const total = Number(invoiceForm.total ?? subtotal + tax);
    const balance = Number(invoiceForm.balance ?? total);

    const payload: EventInvoice = {
      id: invoiceForm.id || `INV-${Date.now().toString().slice(-6)}`,
      eventId: invoiceForm.eventId || '',
      eventName: invoiceForm.eventName || getEventDisplayName(event),
      clientName: invoiceForm.clientName || getEventClientName(event),
      issueDate: invoiceForm.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoiceForm.dueDate || invoiceForm.issueDate || new Date().toISOString().split('T')[0],
      subtotal,
      tax,
      total,
      balance,
      status: deriveInvoiceStatus(invoiceForm.status as EventInvoiceStatus | undefined, balance, total),
      reference: invoiceForm.reference || '',
      notes: invoiceForm.notes || ''
    };

    const isNewInvoice = invoiceModalMode === 'create';
    
    if (invoiceModalMode === 'edit') {
      setEventInvoices(prev => prev.map(inv => (inv.id === payload.id ? payload : inv)));
    } else {
      setEventInvoices(prev => [payload, ...prev]);
    }

    // Handle invoice-folio synchronization
    if (event && invoiceForm.eventId) {
      // If creating a new invoice, automatically update status to 'invoiced' if currently 'confirmed' or 'quote'
      if (isNewInvoice) {
        const currentStatus = normalizeStatus(event.status);
        const shouldUpdateToInvoiced = currentStatus === 'confirmed' || currentStatus === 'quote';
        
        if (shouldUpdateToInvoiced) {
          // Update in customEvents
          setCustomEvents(prev => prev.map(ev => 
            ev.id === invoiceForm.eventId 
              ? { ...ev, status: 'invoiced' as const } 
              : ev
          ));
          
          trackEvent('Events.EventStatusUpdated', { 
            eventId: invoiceForm.eventId, 
            newStatus: 'invoiced',
            reason: 'invoice_created'
          });
        }

        // Auto-sync new invoice to folio (creates folio if needed)
        syncInvoiceToFolio(payload);
      } else {
        // Update existing invoice - sync to folio with forceUpdate flag
        syncInvoiceToFolio(payload, true);
      }
      
      // Refresh activeFolio after state updates so totals are current
      setTimeout(() => refreshActiveFolioByEvent(payload.eventId), 50);
    }

    // Navigate to the Event Management → Invoices page so the user can see the new invoice
    if (isNewInvoice) {
      try {
        setSelectedTab('confirmed');
        setLastCreatedInvoiceId(payload.id);
      } catch (error) {
        console.error('Error navigating to invoice management after invoice creation:', error);
      }
    }

    setIsInvoiceModalOpen(false);
  };

  const markInvoiceAsPaid = (invoice: EventInvoice) => {
    setEventInvoices(prev =>
      prev.map(inv =>
        inv.id === invoice.id
          ? { ...inv, balance: 0, status: 'Paid', notes: inv.notes || 'Settled via manual adjustment.' }
          : inv
      )
    );
  };

  const openReceiptModal = (mode: 'create' | 'edit', receipt?: EventReceipt, eventOverride?: any) => {
    const defaultEvent =
      eventOverride ||
      (receipt?.eventId ? allEvents.find(ev => ev.id === receipt.eventId) : allEvents[0]);
    const today = new Date().toISOString().split('T')[0];

    setReceiptForm(
      receipt
        ? { ...receipt }
        : {
            id: `RCPT-${Date.now().toString().slice(-6)}`,
            eventId: defaultEvent?.id || '',
            eventName: getEventDisplayName(defaultEvent),
            invoiceId: '',
            clientName: getEventClientName(defaultEvent),
            date: today,
            amount: Number(defaultEvent?.deposit || defaultEvent?.balance || 0),
            method: 'Cash',
            reference: '',
            recordedBy: 'Events Team',
            notes: ''
          }
    );

    setReceiptModalMode(mode);
    setReceiptErrors({});
    setIsReceiptModalOpen(true);
  };

  const validateReceiptForm = () => {
    const errors: Record<string, string> = {};
    if (!receiptForm.eventId) errors.eventId = 'Select an event';
    if (!receiptForm.clientName || !receiptForm.clientName.trim()) errors.clientName = 'Client name is required';
    if (!receiptForm.date) errors.date = 'Receipt date is required';
    if (Number.isNaN(Number(receiptForm.amount)) || Number(receiptForm.amount ?? 0) <= 0) errors.amount = 'Enter a valid amount';
    setReceiptErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleReceiptSave = () => {
    if (!validateReceiptForm()) return;
    const event = allEvents.find(ev => ev.id === receiptForm.eventId);
    const amount = Number(receiptForm.amount ?? 0);

    const payload: EventReceipt = {
      id: receiptForm.id || `RCPT-${Date.now().toString().slice(-6)}`,
      eventId: receiptForm.eventId || '',
      eventName: receiptForm.eventName || getEventDisplayName(event),
      invoiceId: receiptForm.invoiceId || '',
      clientName: receiptForm.clientName || getEventClientName(event),
      date: receiptForm.date || new Date().toISOString().split('T')[0],
      amount,
      method: (receiptForm.method || 'Cash') as ReceiptMethod,
      reference: receiptForm.reference || '',
      recordedBy: receiptForm.recordedBy || 'Events Team',
      notes: receiptForm.notes || ''
    };

    const isNewReceipt = receiptModalMode === 'create';
    
    if (receiptModalMode === 'edit') {
      setEventReceipts(prev => prev.map(rcpt => (rcpt.id === payload.id ? payload : rcpt)));
    } else {
      setEventReceipts(prev => [payload, ...prev]);
    }

    // Track the action
    trackEvent('Events.EventCreated', { 
      action: 'receipt_created',
      receiptId: payload.id, 
      eventId: payload.eventId,
      amount: payload.amount,
      method: payload.method
    });

    if (payload.invoiceId) {
      setEventInvoices(prev =>
        prev.map(inv => {
          if (inv.id !== payload.invoiceId) return inv;
          const newBalance = Math.max(0, (inv.balance || inv.total || 0) - amount);
          const updatedInvoice = {
            ...inv,
            balance: newBalance,
            status: deriveInvoiceStatus(inv.status, newBalance, inv.total)
          };
          
          // Sync receipt payment to folio
          const folio = eventFolios.find(f => f.eventId === payload.eventId);
          if (folio) {
            const lastBalance = getFolioCurrentBalance(folio);
            const paymentEntry: EventFolioEntry = {
              id: `FLE-${Date.now().toString().slice(-6)}`,
              date: payload.date || new Date().toISOString().split('T')[0],
              description: `Payment - Receipt ${payload.id}${payload.invoiceId ? ` (Invoice ${payload.invoiceId})` : ''}`,
              debit: 0,
              credit: amount,
              balance: lastBalance - amount,
              reference: payload.id
            };
            
    setEventFolios((prev: EventFolio[]) =>
      prev.map((f: EventFolio) =>
                f.id === folio.id
                  ? { ...f, entries: [...f.entries, paymentEntry], updatedAt: new Date().toISOString() }
                  : f
              )
            );
            
            if (activeFolio && activeFolio.id === folio.id) {
              setActiveFolio((prev: any) =>
                prev && prev.id === folio.id
                  ? { ...prev, entries: [...prev.entries, paymentEntry], updatedAt: new Date().toISOString() }
                  : prev
              );
            }
            
            console.log('[Folio] Added receipt payment:', payload.id, formatCurrency(amount));
          } else {
            // Ensure folio exists and add payment
            const createdFolio = ensureFolioExists(payload.eventId);
            if (createdFolio) {
              const lastBalance = getFolioCurrentBalance(createdFolio);
              const paymentEntry: EventFolioEntry = {
                id: `FLE-${Date.now().toString().slice(-6)}`,
                date: payload.date || new Date().toISOString().split('T')[0],
                description: `Payment - Receipt ${payload.id}${payload.invoiceId ? ` (Invoice ${payload.invoiceId})` : ''}`,
                debit: 0,
                credit: amount,
                balance: lastBalance - amount,
                reference: payload.id
              };
              
    setEventFolios((prev: EventFolio[]) =>
      prev.map((f: EventFolio) =>
                  f.id === createdFolio.id
                    ? { ...f, entries: [...f.entries, paymentEntry], updatedAt: new Date().toISOString() }
                    : f
                )
              );
              
              console.log('[Folio] Auto-created folio and added receipt payment:', payload.id, formatCurrency(amount));
            }
          }
          
          return updatedInvoice;
        })
      );
    } else {
      // Receipt not linked to invoice - still add to folio if it exists
      const folio = eventFolios.find(f => f.eventId === payload.eventId);
      if (folio) {
        const lastBalance = getFolioCurrentBalance(folio);
        const paymentEntry: EventFolioEntry = {
          id: `FLE-${Date.now().toString().slice(-6)}`,
          date: payload.date || new Date().toISOString().split('T')[0],
          description: `Payment - Receipt ${payload.id} (${payload.method})`,
          debit: 0,
          credit: amount,
          balance: lastBalance - amount,
          reference: payload.id
        };
        
        setEventFolios(prev =>
          prev.map(f =>
            f.id === folio.id
              ? { ...f, entries: [...f.entries, paymentEntry], updatedAt: new Date().toISOString() }
              : f
          )
        );
        
        if (activeFolio && activeFolio.id === folio.id) {
          setActiveFolio((prev: any) =>
            prev && prev.id === folio.id
              ? { ...prev, entries: [...prev.entries, paymentEntry], updatedAt: new Date().toISOString() }
              : prev
          );
        }
        
        console.log('[Folio] Added unlinked receipt payment:', payload.id, formatCurrency(amount));
      }
    }

    // Navigate to the Receipts tab in Event Management if creating a new receipt
    if (isNewReceipt) {
      try {
        setSelectedTab('confirmed');
        setManagementMainTab('receipts');
      } catch (error) {
        console.error('Error navigating to receipts tab after receipt creation:', error);
      }
    }

    // Reset form and close modal
    setReceiptForm({
      id: '',
      eventId: '',
      eventName: '',
      invoiceId: '',
      clientName: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      method: 'Cash',
      reference: '',
      recordedBy: 'Events Team',
      notes: ''
    });
    setReceiptErrors({});
    setIsReceiptModalOpen(false);
  };

  const openFolioDetails = (folio: EventFolio) => {
    setActiveFolio(folio);
  setFolioEntryForm({ type: 'charge', amount: 0, description: '', reference: '', costCenter: '', revenueCenter: '', method: 'Cash', recordedBy: 'Events Team' });
    setFolioEntrySearch('');
    setIsFolioModalOpen(true);
  };

  // Sync activeFolio with eventFolios when folio modal is open to ensure updates are reflected
  useEffect(() => {
    if (isFolioModalOpen && activeFolio) {
      const updatedFolio = eventFolios.find(f => f.id === activeFolio.id);
      if (updatedFolio) {
        // Check if entries have changed by comparing entry count and total amounts
        const currentEntryCount = activeFolio.entries?.length || 0;
        const updatedEntryCount = updatedFolio.entries?.length || 0;
        const currentEntries: EventFolioEntry[] = Array.isArray(activeFolio.entries)
          ? (activeFolio.entries as EventFolioEntry[])
          : [];
        const updatedEntries: EventFolioEntry[] = Array.isArray(updatedFolio.entries)
          ? (updatedFolio.entries as EventFolioEntry[])
          : [];

        let currentTotal = 0;
        for (const entry of currentEntries) {
          currentTotal += (entry.debit || 0) - (entry.credit || 0);
        }

        let updatedTotal = 0;
        for (const entry of updatedEntries) {
          updatedTotal += (entry.debit || 0) - (entry.credit || 0);
        }
        
        // Update if entries changed or totals changed
        if (currentEntryCount !== updatedEntryCount || currentTotal !== updatedTotal || updatedFolio.updatedAt !== activeFolio.updatedAt) {
          setActiveFolio(updatedFolio);
        }
      }
    }
  }, [eventFolios, isFolioModalOpen, activeFolio]);

  // Memoized folio calculations for performance optimization
  const activeFolioBalance = useMemo(() => activeFolio ? getFolioCurrentBalance(activeFolio) : 0, [activeFolio]);
  const activeFolioTotals = useMemo(() => activeFolio ? calculateFolioTotals(activeFolio) : { debits: 0, credits: 0 }, [activeFolio]);
  const filteredFolioEntries = useMemo(() => {
    if (!activeFolio || !activeFolio.entries) return [];
    if (!folioEntrySearch.trim()) return activeFolio.entries;
    const searchLower = folioEntrySearch.toLowerCase();
    return activeFolio.entries.filter((entry: EventFolioEntry) =>
      entry.description.toLowerCase().includes(searchLower) ||
      entry.reference?.toLowerCase().includes(searchLower) ||
      entry.costCenter?.toLowerCase().includes(searchLower) ||
      entry.revenueCenter?.toLowerCase().includes(searchLower)
    );
  }, [activeFolio?.entries, folioEntrySearch]);

  const handleAddFolioEntry = () => {
    if (!activeFolio) {
      console.log('[Folio] Cannot add entry: No active folio');
      return;
    }
    if (!folioEntryForm.description || !folioEntryForm.description.trim()) {
      console.log('[Folio] Cannot add entry: Description is required');
      return;
    }
    const amount = Number(folioEntryForm.amount || 0);
    if (Number.isNaN(amount) || amount <= 0) {
      console.log('[Folio] Cannot add entry: Invalid amount', amount);
      return;
    }

    const lastBalance = getFolioCurrentBalance(activeFolio);
    const debit = folioEntryForm.type === 'charge' ? amount : 0;
    const credit = folioEntryForm.type === 'payment' ? amount : 0;
    const newBalance = lastBalance + debit - credit;

    const newEntry: EventFolioEntry = {
      id: `FLE-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      description: folioEntryForm.description.trim(),
      debit,
      credit,
      balance: newBalance,
      reference: folioEntryForm.reference || '',
      costCenter: folioEntryForm.type === 'charge' ? folioEntryForm.costCenter : undefined,
      revenueCenter: folioEntryForm.type === 'payment' ? folioEntryForm.revenueCenter : undefined
    };

    console.log('[Folio] Adding entry:', {
      folioId: activeFolio.id,
      entryType: folioEntryForm.type,
      amount: formatCurrency(amount),
      description: newEntry.description,
      previousBalance: formatCurrency(lastBalance),
      newBalance: formatCurrency(newBalance),
      reference: newEntry.reference || 'None'
    });

    setEventFolios((prev: any) =>
      prev.map((folio: any) =>
        folio.id === activeFolio.id
          ? { ...folio, entries: [...folio.entries, newEntry], updatedAt: new Date().toISOString() }
          : folio
      )
    );
    setActiveFolio((folio: any) =>
      folio ? { ...folio, entries: [...folio.entries, newEntry], updatedAt: new Date().toISOString() } : folio
    );
    setFolioEntryForm({ type: 'charge', amount: 0, description: '', reference: '', costCenter: '', revenueCenter: '', method: 'Cash', recordedBy: 'Events Team' });
    
    // Record to cost/revenue centers if specified
    if (folioEntryForm.type === 'charge' && folioEntryForm.costCenter) {
      try {
        const { recordExpense } = useAccountingStore.getState();
        recordExpense(folioEntryForm.costCenter, amount);
        console.log('[Folio] Recorded expense to cost center:', folioEntryForm.costCenter, formatCurrency(amount));
      } catch (error) {
        console.error('[Folio] Error recording expense to cost center:', error);
      }
    } else if (folioEntryForm.type === 'payment' && folioEntryForm.revenueCenter) {
      try {
        const { recordRevenue } = useAccountingStore.getState();
        recordRevenue(folioEntryForm.revenueCenter, amount);
        console.log('[Folio] Recorded revenue to revenue center:', folioEntryForm.revenueCenter, formatCurrency(amount));
      } catch (error) {
        console.error('[Folio] Error recording revenue to revenue center:', error);
      }
    }
    
    trackEvent('Events.EventCreated', { 
      action: 'folio_entry_added', 
      folioId: activeFolio.id,
      entryType: folioEntryForm.type,
      amount: amount,
      costCenter: folioEntryForm.costCenter || undefined,
      revenueCenter: folioEntryForm.revenueCenter || undefined
    });

    if (folioEntryForm.type === 'payment') {
      const linkedInvoice = folioEntryForm.reference
        ? eventInvoices.find(inv => inv.id === folioEntryForm.reference)
        : undefined;
      const receiptId = `RCPT-${Date.now().toString().slice(-6)}`;
      const receipt: EventReceipt = {
        id: receiptId,
        eventId: activeFolio.eventId,
        eventName: activeFolio.eventName || 'Event',
        invoiceId: linkedInvoice?.id || '',
        clientName: activeFolio.clientName || 'Client',
        date: newEntry.date,
        amount: credit,
        method: (folioEntryForm.method || 'Cash') as ReceiptMethod,
        reference: newEntry.reference || '',
        recordedBy: folioEntryForm.recordedBy || 'Events Team',
        notes: newEntry.description
      };

      setEventReceipts(prev => [receipt, ...prev]);

      if (linkedInvoice) {
        setEventInvoices(prev =>
          prev.map(inv => {
            if (inv.id !== linkedInvoice.id) return inv;
            const newBalance = Math.max(0, (inv.balance || inv.total || 0) - credit);
            return {
              ...inv,
              balance: newBalance,
              status: deriveInvoiceStatus(inv.status, newBalance, inv.total)
            };
          })
        );
      }

      trackEvent('Events.EventCreated', {
        action: 'receipt_created_from_folio_payment',
        folioId: activeFolio.id,
        receiptId,
        invoiceId: receipt.invoiceId || undefined,
        amount: credit
      });
    }
  };
  const handleCreateFolio = () => {
    if (!folioCreateForm.eventId) {
      setFolioCreateError('Select an event to generate the folio.');
      return;
    }
    const event = allEvents.find(ev => ev.id === folioCreateForm.eventId);
    if (!event) {
      setFolioCreateError('Selected event could not be found.');
      return;
    }
    const opening = Number(folioCreateForm.openingBalance || 0);
    const initialEntries: EventFolioEntry[] = opening
      ? [
          {
            id: `FLE-${Date.now().toString().slice(-6)}`,
            date: new Date().toISOString().split('T')[0],
            description: folioCreateForm.note?.trim() || 'Opening Balance',
            debit: opening > 0 ? opening : 0,
            credit: opening < 0 ? Math.abs(opening) : 0,
            balance: opening
          }
        ]
      : [];
    const newFolio: EventFolio = {
      id: `FOL-${Date.now().toString().slice(-6)}`,
      eventId: event.id,
      eventName: getEventDisplayName(event),
      clientName: getEventClientName(event),
      status: 'Open',
      openingBalance: opening,
      entries: initialEntries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEventFolios(prev => [newFolio, ...prev]);
    setIsFolioCreateModalOpen(false);
    setFolioCreateForm({ eventId: '', openingBalance: 0, note: '' });
    setFolioCreateError('');
  };

  const closeFolioModal = () => {
    setIsFolioModalOpen(false);
    setActiveFolio(null);
    setFolioEntryForm({ type: 'charge', amount: 0, description: '', reference: '', costCenter: '', revenueCenter: '', method: 'Cash', recordedBy: 'Events Team' });
    setFolioEntrySearch('');
  };

  const handleUpdateFolio = () => {
    if (!activeFolio) return;

    try {
      const updatedFolio = {
        ...activeFolio,
        updatedAt: new Date().toISOString()
      };

      setEventFolios(prev =>
        prev.map(f => (f.id === activeFolio.id ? updatedFolio : f))
      );
      setActiveFolio(updatedFolio);

      trackEvent('Events.EventCreated', {
        action: 'folio_updated',
        folioId: activeFolio.id,
        eventId: activeFolio.eventId
      });

      alert('Folio updated successfully.');
    } catch (error) {
      console.error('Failed to update folio:', error);
      alert('Failed to update folio. Please try again.');
    }
  };

  // Helper: Ensure folio exists for an event, create if it doesn't
  // Optionally skip adding invoice if it will be added separately
  const ensureFolioExists = (eventId: string, skipInvoiceEntry: boolean = false): EventFolio | null => {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) {
      console.warn('[Folio] Event not found:', eventId);
      return null;
    }

    let folio = eventFolios.find(f => f.eventId === eventId);
    
    if (!folio) {
      // Auto-create folio if it doesn't exist
      const entries: EventFolioEntry[] = [];
      
      // Only add existing invoices if not skipping (to avoid duplicates when syncing)
      if (!skipInvoiceEntry) {
        const invoice = eventInvoices.find((inv: any) => inv.eventId === eventId);
        if (invoice && invoice.total > 0) {
          entries.push({
            id: `FLE-${Date.now().toString().slice(-6)}`,
            date: invoice.issueDate || new Date().toISOString().split('T')[0],
            description: `Invoice ${invoice.id} - Event Charges`,
            debit: invoice.total,
            credit: 0,
            balance: invoice.total,
            reference: invoice.id
          });
        }
      }
      
      folio = {
        id: `FOL-${Date.now().toString().slice(-6)}`,
        eventId: event.id,
        eventName: event.eventName || 'Unnamed Event',
        clientName: event.organization || 'Unknown Client',
        status: 'Open',
        openingBalance: 0,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        entries: entries
      };
      
      setEventFolios(prev => [...prev, folio!]);
      console.log('[Folio] Auto-created folio for event:', eventId, folio.id);
      trackEvent('Events.EventCreated', { action: 'folio_auto_created', eventId: eventId, folioId: folio!.id });
    }
    
    return folio;
  };

  // Helper: Sync invoice to folio (create entry or update existing)
  const syncInvoiceToFolio = (invoice: EventInvoice, forceUpdate: boolean = false): boolean => {
    try {
      // Skip adding invoice in ensureFolioExists since we'll add it here
      const folio = ensureFolioExists(invoice.eventId, true);
      if (!folio) return false;

      // Find existing invoice entry in folio
      const existingEntryIndex = folio.entries.findIndex(
        e => e.reference === invoice.id || e.description.includes(`Invoice ${invoice.id}`)
      );

      if (existingEntryIndex >= 0) {
        // Update existing entry if invoice was edited
        if (forceUpdate) {
          const existingEntry = folio.entries[existingEntryIndex];
          const oldAmount = existingEntry.debit;
          const newAmount = invoice.total;
          const difference = newAmount - oldAmount;

          if (difference !== 0) {
            // Recalculate balance from this entry forward
            const previousBalance = existingEntryIndex > 0 
              ? folio.entries[existingEntryIndex - 1].balance 
              : folio.openingBalance;

            const updatedEntries = [...folio.entries];
            updatedEntries[existingEntryIndex] = {
              ...existingEntry,
              debit: newAmount,
              balance: previousBalance + newAmount,
              date: invoice.issueDate || existingEntry.date
            };

            // Recalculate subsequent balances
            let runningBalance = previousBalance + newAmount;
            for (let i = existingEntryIndex + 1; i < updatedEntries.length; i++) {
              runningBalance = runningBalance + updatedEntries[i].debit - updatedEntries[i].credit;
              updatedEntries[i] = { ...updatedEntries[i], balance: runningBalance };
            }

            setEventFolios(prev => {
              const updated = prev.map(f =>
                f.id === folio.id
                  ? { ...f, entries: updatedEntries, updatedAt: new Date().toISOString() }
                  : f
              );
              return updated;
            });
            
            // Update activeFolio after state has been updated
            setTimeout(() => {
              if (isFolioModalOpen && activeFolio && activeFolio.id === folio.id) {
                setEventFolios((currentFolios: EventFolio[]) => {
                  const updatedFolio = currentFolios.find(f => f.id === folio.id);
                  if (updatedFolio) {
                    setActiveFolio(updatedFolio);
                  }
                  return currentFolios;
                });
              }
            }, 0);

            console.log('[Folio] Updated invoice entry:', invoice.id, `Old: ${formatCurrency(oldAmount)}, New: ${formatCurrency(newAmount)}`);
            return true;
          }
        }
        // Entry exists and no update needed
        return false;
      } else {
        // Add new invoice entry
        const lastBalance = getFolioCurrentBalance(folio);
        const newEntry: EventFolioEntry = {
          id: `FLE-${Date.now().toString().slice(-6)}`,
          date: invoice.issueDate || new Date().toISOString().split('T')[0],
          description: `Invoice ${invoice.id} - Event Charges`,
          debit: invoice.total,
          credit: 0,
          balance: lastBalance + invoice.total,
          reference: invoice.id
        };

    setEventFolios((prev: EventFolio[]) => {
      const updated = prev.map((f: EventFolio) =>
        f.id === folio.id
          ? { ...f, entries: [...f.entries, newEntry], updatedAt: new Date().toISOString() }
          : f
      );
      return updated;
    });
    
    // Update activeFolio after state has been updated
    setTimeout(() => {
      if (isFolioModalOpen && activeFolio && activeFolio.id === folio.id) {
        setEventFolios((currentFolios: EventFolio[]) => {
          const updatedFolio = currentFolios.find(f => f.id === folio.id);
          if (updatedFolio) {
            setActiveFolio(updatedFolio);
          }
          return currentFolios;
        });
      }
    }, 0);

        console.log('[Folio] Synced invoice to folio:', invoice.id, formatCurrency(invoice.total));
        trackEvent('Events.EventCreated', { action: 'folio_invoice_synced', folioId: folio.id, invoiceId: invoice.id });
        return true;
      }
    } catch (error) {
      console.error('[Folio] Error syncing invoice to folio:', error);
      return false;
    }
  };

  // Import invoice to folio (manual import from UI)
  const importInvoiceToFolio = (folio: EventFolio) => {
    const event = allEvents.find(e => e.id === folio.eventId);
    if (!event) return;
    
    const invoice = eventInvoices.find((inv: any) => inv.eventId === folio.eventId);
    if (!invoice) {
      alert('No invoice found for this event.');
      return;
    }
    
    // Check if invoice already exists in folio entries
    const invoiceExists = folio.entries.some(e => e.reference === invoice.id || e.description.includes(`Invoice ${invoice.id}`));
    if (invoiceExists) {
      if (!confirm('Invoice already exists in folio. Update it with current values?')) return;
      // Update existing entry
      syncInvoiceToFolio(invoice, true);
      return;
    }
    
    // Import new invoice
    syncInvoiceToFolio(invoice);
  };


  // Handle overpayment - Process refund
  const processRefund = (folio: EventFolio) => {
    const overpaymentAmount = Math.abs(getFolioCurrentBalance(folio));
    if (overpaymentAmount <= 0) {
      alert('No overpayment to refund.');
      return;
    }
    
    const refundAmount = prompt(`Enter refund amount (Overpayment: ${formatCurrency(overpaymentAmount)}):`, String(overpaymentAmount));
    if (!refundAmount) return;
    
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > overpaymentAmount) {
      alert('Invalid refund amount.');
      return;
    }
    
    const refundMethod = prompt('Refund method (Cash/Bank Transfer/Credit Card/Other):', 'Bank Transfer');
    if (!refundMethod) return;
    
    const lastBalance = getFolioCurrentBalance(folio);
    const newEntry: EventFolioEntry = {
      id: `FLE-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      description: `Refund - ${refundMethod}`,
      debit: amount, // Refund increases what we owe (debit)
      credit: 0,
      balance: lastBalance + amount, // Moves balance toward zero
      reference: `REF-${Date.now().toString().slice(-6)}`
    };
    
    setEventFolios((prev: any) =>
      prev.map((f: any) =>
        f.id === folio.id
          ? { ...f, entries: [...f.entries, newEntry], updatedAt: new Date().toISOString() }
          : f
      )
    );
    setActiveFolio((prev: any) =>
      prev && prev.id === folio.id
        ? { ...prev, entries: [...prev.entries, newEntry], updatedAt: new Date().toISOString() }
        : prev
    );
    
    console.log('[Folio] Processed refund:', formatCurrency(amount), refundMethod);
    trackEvent('Events.EventCreated', { action: 'folio_refund_processed', folioId: folio.id, amount: amount, method: refundMethod });
    alert(`Refund of ${formatCurrency(amount)} processed successfully.`);
  };

  // Handle overpayment - Create credit note
  const createCreditNote = (folio: EventFolio) => {
    const overpaymentAmount = Math.abs(getFolioCurrentBalance(folio));
    if (overpaymentAmount <= 0) {
      alert('No overpayment to create credit note for.');
      return;
    }
    
    const creditNoteAmount = prompt(`Enter credit note amount (Overpayment: ${formatCurrency(overpaymentAmount)}):`, String(overpaymentAmount));
    if (!creditNoteAmount) return;
    
    const amount = parseFloat(creditNoteAmount);
    if (isNaN(amount) || amount <= 0 || amount > overpaymentAmount) {
      alert('Invalid credit note amount.');
      return;
    }
    
    const reason = prompt('Reason for credit note:', 'Overpayment - Credit to client account');
    if (!reason) return;
    
    const lastBalance = getFolioCurrentBalance(folio);
    const newEntry: EventFolioEntry = {
      id: `FLE-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      description: `Credit Note - ${reason}`,
      debit: amount, // Credit note reduces overpayment
      credit: 0,
      balance: lastBalance + amount, // Moves balance toward zero
      reference: `CN-${Date.now().toString().slice(-6)}`
    };
    
    setEventFolios((prev: any) =>
      prev.map((f: any) =>
        f.id === folio.id
          ? { ...f, entries: [...f.entries, newEntry], updatedAt: new Date().toISOString() }
          : f
      )
    );
    setActiveFolio((prev: any) =>
      prev && prev.id === folio.id
        ? { ...prev, entries: [...prev.entries, newEntry], updatedAt: new Date().toISOString() }
        : prev
    );
    
    console.log('[Folio] Created credit note:', formatCurrency(amount), reason);
    trackEvent('Events.EventCreated', { action: 'folio_credit_note_created', folioId: folio.id, amount: amount });
    alert(`Credit note of ${formatCurrency(amount)} created successfully.`);
  };

  // Delete folio entry
  const deleteFolioEntry = (folio: EventFolio, entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry? This action cannot be undone and will recalculate all subsequent balances.')) {
      return;
    }
    
    const entryIndex = folio.entries.findIndex(e => e.id === entryId);
    if (entryIndex === -1) return;
    
    const entry = folio.entries[entryIndex];
    const previousBalance = entryIndex > 0 
      ? folio.entries[entryIndex - 1].balance 
      : folio.openingBalance;
    
    // Remove the entry
    const updatedEntries = folio.entries.filter(e => e.id !== entryId);
    
    // Recalculate balances for all subsequent entries
    let runningBalance = previousBalance;
    const recalculatedEntries = updatedEntries.map((e, idx) => {
      if (idx >= entryIndex) {
        // Recalculate balance for this and all subsequent entries
        runningBalance = runningBalance + e.debit - e.credit;
        return { ...e, balance: runningBalance };
      }
      return e;
    });
    
    setEventFolios(prev =>
      prev.map(f =>
        f.id === folio.id
          ? { ...f, entries: recalculatedEntries, updatedAt: new Date().toISOString() }
          : f
      )
    );
    setActiveFolio((prev: any) =>
      prev && prev.id === folio.id
        ? { ...prev, entries: recalculatedEntries, updatedAt: new Date().toISOString() }
        : prev
    );
    
    console.log('[Folio] Deleted entry:', entryId, entry.description);
    trackEvent('Events.EventCreated', { action: 'folio_entry_deleted', folioId: folio.id, entryId: entryId });
  };

  // Reverse folio entry (create opposite entry)
  const reverseFolioEntry = (folio: EventFolio, entry: EventFolioEntry) => {
    if (!confirm(`Create a reversal entry for: ${entry.description}? This will create an opposite entry to cancel out this transaction.`)) {
      return;
    }
    
    const lastBalance = getFolioCurrentBalance(folio);
    const reversalAmount = entry.debit > 0 ? entry.debit : entry.credit;
    
    const newEntry: EventFolioEntry = {
      id: `FLE-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      description: `REVERSAL: ${entry.description}`,
      debit: entry.credit > 0 ? reversalAmount : 0, // Reverse: if original was credit, reversal is debit
      credit: entry.debit > 0 ? reversalAmount : 0, // Reverse: if original was debit, reversal is credit
      balance: entry.debit > 0 
        ? lastBalance - reversalAmount  // If original was charge, reversal reduces balance
        : lastBalance + reversalAmount, // If original was payment, reversal increases balance
      reference: entry.reference ? `REV-${entry.reference}` : `REV-${entry.id}`,
      costCenter: entry.revenueCenter ? undefined : entry.costCenter, // Keep cost center if reversing charge
      revenueCenter: entry.costCenter ? undefined : entry.revenueCenter // Keep revenue center if reversing payment
    };
    
    setEventFolios(prev =>
      prev.map(f =>
        f.id === folio.id
          ? { ...f, entries: [...f.entries, newEntry], updatedAt: new Date().toISOString() }
          : f
      )
    );
    setActiveFolio((prev: any) =>
      prev && prev.id === folio.id
        ? { ...prev, entries: [...prev.entries, newEntry], updatedAt: new Date().toISOString() }
        : prev
    );
    
    // Reverse accounting entries if centers were used
    if (entry.costCenter && entry.debit > 0) {
      try {
        const { recordExpense } = useAccountingStore.getState();
        recordExpense(entry.costCenter, -reversalAmount); // Negative to reverse
        console.log('[Folio] Reversed expense in cost center:', entry.costCenter, formatCurrency(-reversalAmount));
      } catch (error) {
        console.error('[Folio] Error reversing expense:', error);
      }
    } else if (entry.revenueCenter && entry.credit > 0) {
      try {
        const { recordRevenue } = useAccountingStore.getState();
        recordRevenue(entry.revenueCenter, -reversalAmount); // Negative to reverse
        console.log('[Folio] Reversed revenue in revenue center:', entry.revenueCenter, formatCurrency(-reversalAmount));
      } catch (error) {
        console.error('[Folio] Error reversing revenue:', error);
      }
    }
    
    console.log('[Folio] Created reversal entry:', entry.id, formatCurrency(reversalAmount));
    trackEvent('Events.EventCreated', { action: 'folio_entry_reversed', folioId: folio.id, entryId: entry.id });
  };

  // Import receipts to folio
  const importReceiptsToFolio = (folio: EventFolio) => {
    const event = allEvents.find(e => e.id === folio.eventId);
    if (!event) return;
    
    const receipts = eventReceipts.filter((rec: any) => rec.eventId === folio.eventId);
    if (receipts.length === 0) {
      alert('No receipts found for this event.');
      return;
    }
    
    // Filter out receipts that already exist in folio
    const existingReferences = folio.entries.map(e => e.reference).filter(Boolean);
    const newReceipts = receipts.filter((rec: any) => !existingReferences.includes(rec.id));
    
    if (newReceipts.length === 0) {
      alert('All receipts have already been imported to this folio.');
      return;
    }
    
    let currentBalance = getFolioCurrentBalance(folio);
    const newEntries: EventFolioEntry[] = newReceipts.map((receipt: any) => {
      currentBalance = currentBalance - receipt.amount; // Payments reduce balance
      return {
        id: `FLE-${Date.now().toString().slice(-6)}-${receipt.id.slice(-3)}`,
        date: receipt.date || new Date().toISOString().split('T')[0],
        description: `Receipt ${receipt.id} - ${receipt.method}`,
        debit: 0,
        credit: receipt.amount,
        balance: currentBalance,
        reference: receipt.id,
        revenueCenter: 'CF' // Conference/Event revenue center
      };
    });
    
    setEventFolios(prev =>
      prev.map(f =>
        f.id === folio.id
          ? { ...f, entries: [...f.entries, ...newEntries], updatedAt: new Date().toISOString() }
          : f
      )
    );
    setActiveFolio((prev: any) =>
      prev && prev.id === folio.id
        ? { ...prev, entries: [...prev.entries, ...newEntries], updatedAt: new Date().toISOString() }
        : prev
    );
    
    console.log('[Folio] Imported receipts:', newReceipts.length, formatCurrency(newReceipts.reduce((sum, r) => sum + r.amount, 0)));
    trackEvent('Events.EventCreated', { action: 'folio_receipts_imported', folioId: folio.id, receiptCount: newReceipts.length });
  };

  const handleEditInvoiceFromFolio = (invoice?: EventInvoice | null) => {
    if (!invoice) {
      alert('Invoice not found.');
      return;
    }
    if (!invoice.eventId) {
      alert('This invoice is not linked to an event.');
      return;
    }
    const event = allEvents.find(ev => ev.id === invoice.eventId);
    if (!event) {
      alert('Linked event not found. Please ensure the event exists.');
      return;
    }
    setSelectedTab('confirmed');
    setManagementMainTab('events');
    openEventForEdit(event);
  };

  const handleEditReceiptFromFolio = (receipt?: EventReceipt | null) => {
    if (!receipt) {
      alert('Receipt not found.');
      return;
    }
    openReceiptModal('edit', receipt);
  };
    
  const printFunctionSchedule = () => {
    try {
      // Track the print action
      trackEvent('Events.EventCreated', { action: 'function_schedule_printed', eventCount: allEvents.length });
      
      // Create print-friendly content
      const printContent = `
        <html>
          <head>
            <title>Function Schedule - August 2025</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .summary { margin-bottom: 30px; }
              .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
              .summary-item { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
              .summary-number { font-size: 24px; font-weight: bold; color: #2563eb; }
              .summary-label { font-size: 14px; color: #666; margin-top: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
              th { background-color: #f8f9fa; font-weight: bold; }
              .status-confirmed { color: #059669; }
              .status-pending { color: #d97706; }
              .status-on-hold { color: #6b7280; }
              @media print { body { margin: 0; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📋 Provisional Function Schedule</h1>
              <h2>August 2025</h2>
              <p>Generated on: ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="summary">
              <div class="summary-grid">
                <div class="summary-item">
                  <div class="summary-number">${allEvents.length}</div>
                  <div class="summary-label">Total Functions</div>
                </div>
                <div class="summary-item">
                  <div class="summary-number">${allEvents.filter(e => normalizeStatus(e.status) === 'confirmed').length}</div>
                  <div class="summary-label">Confirmed</div>
                </div>
                <div class="summary-item">
                  <div class="summary-number">${allEvents.filter(e => normalizeStatus(e.status) === 'quote').length}</div>
                  <div class="summary-label">Quote</div>
                </div>
                <div class="summary-item">
                  <div class="summary-number">${allEvents.reduce((sum, e) => sum + e.pax, 0)}</div>
                  <div class="summary-label">Total Attendees</div>
                </div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Organization</th>
                  <th>Event Name</th>
                  <th>Venue</th>
                  <th>Dates</th>
                  <th>Duration</th>
                  <th>Attendees</th>
                  <th>Status</th>
                  <th>Food & Beverage</th>
                  <th>Housekeeping/Front Desk</th>
                </tr>
              </thead>
              <tbody>
                ${allEvents.map((event, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${event.organization}</td>
                    <td>${event.eventName}</td>
                    <td>${event.venueName}</td>
                    <td>${event.arrivalDate} - ${event.departureDate}</td>
                    <td>${event.duration} days</td>
                    <td>${event.pax}</td>
                    <td class="status-${event.status}">${event.status}</td>
                    <td>${getFoodBeverageServices(event)}</td>
                    <td>${getHousekeepingNotes(event)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="no-print" style="margin-top: 30px; text-align: center;">
              <button onclick="window.print()">🖨️ Print Schedule</button>
            </div>
          </body>
        </html>
      `;
      
      // Open print window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        // Auto-print after content loads
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      
      console.log('Function Schedule print window opened successfully');
    } catch (error) {
      console.error('Error printing function schedule:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'danger';
      case 'completed': return 'primary';
      case 'available': return 'success';
      case 'booked': return 'warning';
      case 'setup': return 'secondary';
      case 'maintenance': return 'danger';
      case 'active': return 'success';
      default: return 'default';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'conference': return '🏢';
      case 'wedding': return '💒';
      case 'training': return '📚';
      case 'launch': return '🚀';
      case 'meeting': return '👥';
      case 'banquet': return '🍽️';
      case 'auditorium': return '🎭';
      default: return '📅';
    }
  };
  // Comprehensive Event Management Data Structures
  // Event Status Types with Color Coding
  const eventStatuses = {
    inquiry: {
      label: 'Inquiry',
      color: 'secondary',
      bgColor: 'bg-gradient-to-r from-sky-50 via-cyan-50 to-sky-100',
      borderColor: 'border-sky-200/70',
      textColor: 'text-sky-700',
      cardBg: 'bg-gradient-to-br from-sky-50 via-white to-cyan-50',
      cardBorder: 'border-sky-200/70',
      cardText: 'text-sky-800',
      ganttBg: 'bg-gradient-to-r from-sky-400/80 via-sky-300/80 to-cyan-300/70',
      ganttBorder: 'border-sky-500/60',
      ganttText: 'text-sky-900'
    },
    'quote-sent': {
      label: 'Quote Sent',
      color: 'warning',
      bgColor: 'bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-100',
      borderColor: 'border-amber-200/80',
      textColor: 'text-amber-700',
      cardBg: 'bg-gradient-to-br from-amber-50 via-white to-yellow-50',
      cardBorder: 'border-amber-200/70',
      cardText: 'text-amber-800',
      ganttBg: 'bg-gradient-to-r from-amber-400/80 via-orange-300/80 to-yellow-300/70',
      ganttBorder: 'border-amber-500/60',
      ganttText: 'text-amber-900'
    },
    confirmed: {
      label: 'Confirmed',
      color: 'success',
      bgColor: 'bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-100',
      borderColor: 'border-emerald-200/80',
      textColor: 'text-emerald-700',
      cardBg: 'bg-gradient-to-br from-emerald-50 via-white to-green-50',
      cardBorder: 'border-emerald-200/70',
      cardText: 'text-emerald-800',
      ganttBg: 'bg-gradient-to-r from-emerald-400/80 via-green-300/80 to-emerald-300/70',
      ganttBorder: 'border-emerald-500/60',
      ganttText: 'text-emerald-900'
    },
    'deposit-paid': {
      label: 'Deposit Paid',
      color: 'primary',
      bgColor: 'bg-gradient-to-r from-sky-50 via-blue-50 to-sky-100',
      borderColor: 'border-sky-200/80',
      textColor: 'text-sky-700',
      cardBg: 'bg-gradient-to-br from-blue-50 via-white to-sky-50',
      cardBorder: 'border-sky-200/70',
      cardText: 'text-sky-800',
      ganttBg: 'bg-gradient-to-r from-blue-400/80 via-sky-300/80 to-blue-300/70',
      ganttBorder: 'border-blue-500/60',
      ganttText: 'text-blue-900'
    },
    cancelled: {
      label: 'Cancelled',
      color: 'danger',
      bgColor: 'bg-gradient-to-r from-rose-50 via-red-50 to-rose-100',
      borderColor: 'border-rose-200/80',
      textColor: 'text-rose-700',
      cardBg: 'bg-gradient-to-br from-rose-50 via-white to-red-50',
      cardBorder: 'border-rose-200/70',
      cardText: 'text-rose-800',
      ganttBg: 'bg-gradient-to-r from-rose-400/80 via-red-300/80 to-rose-300/70',
      ganttBorder: 'border-rose-500/60',
      ganttText: 'text-rose-900'
    },
    tentative: {
      label: 'Inquiry',
      color: 'secondary',
      bgColor: 'bg-gradient-to-r from-slate-50 via-gray-50 to-slate-100',
      borderColor: 'border-slate-200/80',
      textColor: 'text-slate-700',
      cardBg: 'bg-gradient-to-br from-slate-50 via-white to-gray-50',
      cardBorder: 'border-slate-200/70',
      cardText: 'text-slate-800',
      ganttBg: 'bg-gradient-to-r from-slate-400/80 via-gray-300/80 to-slate-300/70',
      ganttBorder: 'border-slate-500/60',
      ganttText: 'text-slate-900'
    },
    'awaiting-confirmation': {
      label: 'Quote Sent',
      color: 'warning',
      bgColor: 'bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-100',
      borderColor: 'border-amber-200/80',
      textColor: 'text-amber-700',
      cardBg: 'bg-gradient-to-br from-amber-50 via-white to-yellow-50',
      cardBorder: 'border-amber-200/70',
      cardText: 'text-amber-800',
      ganttBg: 'bg-gradient-to-r from-amber-400/80 via-orange-300/80 to-yellow-300/70',
      ganttBorder: 'border-amber-500/60',
      ganttText: 'text-amber-900'
    },
    'on-hold': {
      label: 'On Hold',
      color: 'warning',
      bgColor: 'bg-gradient-to-r from-orange-50 via-amber-50 to-orange-100',
      borderColor: 'border-orange-200/80',
      textColor: 'text-orange-700',
      cardBg: 'bg-gradient-to-br from-orange-50 via-white to-amber-50',
      cardBorder: 'border-orange-200/70',
      cardText: 'text-orange-800',
      ganttBg: 'bg-gradient-to-r from-orange-400/80 via-amber-300/80 to-orange-200/70',
      ganttBorder: 'border-orange-500/60',
      ganttText: 'text-orange-900'
    },
    pending: {
      label: 'Inquiry',
      color: 'secondary',
      bgColor: 'bg-gradient-to-r from-slate-50 via-gray-50 to-slate-100',
      borderColor: 'border-slate-200/80',
      textColor: 'text-slate-700',
      cardBg: 'bg-gradient-to-br from-slate-50 via-white to-gray-50',
      cardBorder: 'border-slate-200/70',
      cardText: 'text-slate-800',
      ganttBg: 'bg-gradient-to-r from-slate-400/80 via-gray-300/80 to-slate-300/70',
      ganttBorder: 'border-slate-500/60',
      ganttText: 'text-slate-900'
    },
    completed: {
      label: 'Deposit Paid',
      color: 'primary',
      bgColor: 'bg-gradient-to-r from-indigo-50 via-sky-50 to-indigo-100',
      borderColor: 'border-indigo-200/80',
      textColor: 'text-indigo-700',
      cardBg: 'bg-gradient-to-br from-indigo-50 via-white to-sky-50',
      cardBorder: 'border-indigo-200/70',
      cardText: 'text-indigo-800',
      ganttBg: 'bg-gradient-to-r from-indigo-400/80 via-sky-300/80 to-indigo-300/70',
      ganttBorder: 'border-indigo-500/60',
      ganttText: 'text-indigo-900'
    }
  };

  const eventColorPalette = [
    {
      key: 'sunset',
      calendarBg: 'bg-gradient-to-br from-rose-100 via-orange-100 to-amber-100',
      calendarBorder: 'border-rose-200/80',
      calendarText: 'text-rose-900',
      weekCardBg: 'bg-gradient-to-br from-rose-50 via-white to-orange-50',
      weekCardBorder: 'border-rose-200/70',
      weekCardText: 'text-rose-800',
      ganttBg: 'bg-gradient-to-r from-rose-500/80 via-orange-400/80 to-amber-400/70',
      ganttBorder: 'border-rose-500/60',
      ganttText: 'text-white'
    },
    {
      key: 'lagoon',
      calendarBg: 'bg-gradient-to-br from-sky-100 via-cyan-100 to-emerald-100',
      calendarBorder: 'border-cyan-200/80',
      calendarText: 'text-cyan-900',
      weekCardBg: 'bg-gradient-to-br from-sky-50 via-white to-emerald-50',
      weekCardBorder: 'border-cyan-200/70',
      weekCardText: 'text-cyan-800',
      ganttBg: 'bg-gradient-to-r from-cyan-500/80 via-sky-400/80 to-emerald-400/70',
      ganttBorder: 'border-cyan-500/60',
      ganttText: 'text-white'
    },
    {
      key: 'orchid',
      calendarBg: 'bg-gradient-to-br from-fuchsia-100 via-purple-100 to-indigo-100',
      calendarBorder: 'border-fuchsia-200/80',
      calendarText: 'text-fuchsia-900',
      weekCardBg: 'bg-gradient-to-br from-fuchsia-50 via-white to-purple-50',
      weekCardBorder: 'border-fuchsia-200/70',
      weekCardText: 'text-fuchsia-800',
      ganttBg: 'bg-gradient-to-r from-fuchsia-500/80 via-purple-400/80 to-indigo-400/70',
      ganttBorder: 'border-fuchsia-500/60',
      ganttText: 'text-white'
    },
    {
      key: 'meadow',
      calendarBg: 'bg-gradient-to-br from-emerald-100 via-lime-100 to-green-100',
      calendarBorder: 'border-emerald-200/80',
      calendarText: 'text-emerald-900',
      weekCardBg: 'bg-gradient-to-br from-emerald-50 via-white to-lime-50',
      weekCardBorder: 'border-emerald-200/70',
      weekCardText: 'text-emerald-800',
      ganttBg: 'bg-gradient-to-r from-emerald-500/80 via-lime-400/80 to-green-400/70',
      ganttBorder: 'border-emerald-500/60',
      ganttText: 'text-white'
    },
    {
      key: 'twilight',
      calendarBg: 'bg-gradient-to-br from-blue-100 via-indigo-100 to-slate-100',
      calendarBorder: 'border-indigo-200/80',
      calendarText: 'text-indigo-900',
      weekCardBg: 'bg-gradient-to-br from-blue-50 via-white to-slate-50',
      weekCardBorder: 'border-indigo-200/70',
      weekCardText: 'text-indigo-800',
      ganttBg: 'bg-gradient-to-r from-indigo-500/80 via-blue-400/80 to-slate-400/70',
      ganttBorder: 'border-indigo-500/60',
      ganttText: 'text-white'
    },
    {
      key: 'citrus',
      calendarBg: 'bg-gradient-to-br from-yellow-100 via-amber-100 to-lime-100',
      calendarBorder: 'border-amber-200/80',
      calendarText: 'text-amber-900',
      weekCardBg: 'bg-gradient-to-br from-yellow-50 via-white to-amber-50',
      weekCardBorder: 'border-amber-200/70',
      weekCardText: 'text-amber-800',
      ganttBg: 'bg-gradient-to-r from-yellow-500/80 via-amber-400/80 to-lime-400/70',
      ganttBorder: 'border-amber-500/60',
      ganttText: 'text-amber-900'
    },
    {
      key: 'berry',
      calendarBg: 'bg-gradient-to-br from-pink-100 via-rose-100 to-red-100',
      calendarBorder: 'border-rose-200/80',
      calendarText: 'text-rose-900',
      weekCardBg: 'bg-gradient-to-br from-pink-50 via-white to-rose-50',
      weekCardBorder: 'border-rose-200/70',
      weekCardText: 'text-rose-800',
      ganttBg: 'bg-gradient-to-r from-rose-500/80 via-pink-400/80 to-red-400/70',
      ganttBorder: 'border-rose-500/60',
      ganttText: 'text-white'
    },
    {
      key: 'aurora',
      calendarBg: 'bg-gradient-to-br from-teal-100 via-cyan-100 to-indigo-100',
      calendarBorder: 'border-cyan-200/80',
      calendarText: 'text-cyan-900',
      weekCardBg: 'bg-gradient-to-br from-teal-50 via-white to-cyan-50',
      weekCardBorder: 'border-cyan-200/70',
      weekCardText: 'text-cyan-800',
      ganttBg: 'bg-gradient-to-r from-teal-500/80 via-cyan-400/80 to-indigo-400/70',
      ganttBorder: 'border-cyan-500/60',
      ganttText: 'text-white'
    }
  ];

  const hashString = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  };

  const getEventPalette = (event: any) => {
    const key = event?.id || `${event?.eventName || ''}-${event?.organization || ''}`;
    const index = Math.abs(hashString(key)) % eventColorPalette.length;
    return eventColorPalette[index] || eventColorPalette[0];
  };




  // Comprehensive Events Data (Replacing static PDF function sheet)
  const comprehensiveEvents = [
    {
      id: 'evt-001',
      organization: 'T-TEL',
      eventName: 'T-TEL Extended Conference',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-07-27',
      departureDate: '2025-08-08',
      duration: 13,
      pax: 45,
      residential: true,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 45000,
      deposit: 22500,
      balance: 22500,
      salesManager: 'Kwame Mensah',
      notes: 'Extended conference with full accommodation package. Special dietary requirements for 5 attendees.',
      specialRequirements: 'Vegetarian options, wheelchair access, extra projectors',
      setupTime: '2 hours before event',
      contactPerson: 'Dr. Sarah Addo',
      contactPhone: '+233 20 123 4567',
      contactEmail: 'sarah.addo@t-tel.com',
      linkedQuote: 'Q-2025-001',
      linkedBooking: 'BK-2025-001',
      linkedBEO: 'BEO-2025-001',
      linkedFolio: 'FOL-2025-001'
    },
    {
      id: 'evt-002',
      organization: 'T-TEL',
      eventName: 'T-TEL On Hold Event',
      eventType: 'non-residential',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-07-30',
      departureDate: '2025-08-02',
      duration: 3,
      pax: 30,
      residential: false,
      status: 'on-hold',
      statusColor: 'secondary',
      revenue: 9000,
      deposit: 0,
      balance: 9000,
      salesManager: 'Kwame Mensah',
      notes: 'On hold pending budget approval from headquarters.',
      specialRequirements: 'Standard setup, no special requirements',
      setupTime: '1 hour before event',
      contactPerson: 'Mr. John Doe',
      contactPhone: '+233 20 123 4568',
      contactEmail: 'john.doe@t-tel.com',
      linkedQuote: 'Q-2025-002',
      linkedBooking: null,
      linkedBEO: null,
      linkedFolio: null
    },
    {
      id: 'evt-003',
      organization: 'AAMUSTED',
      eventName: 'AAMUSTED Academic Conference',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-08-02',
      departureDate: '2025-08-05',
      duration: 4,
      pax: 60,
      residential: true,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 36000,
      deposit: 18000,
      balance: 18000,
      salesManager: 'Ama Osei',
      notes: 'Academic conference with international participants. High-speed internet required.',
      specialRequirements: 'High-speed WiFi, presentation equipment, recording facilities',
      setupTime: '3 hours before event',
      contactPerson: 'Prof. Kwesi Addo',
      contactPhone: '+233 20 123 4569',
      contactEmail: 'kwesi.addo@aamusted.edu.gh',
      linkedQuote: 'Q-2025-003',
      linkedBooking: 'BK-2025-002',
      linkedBEO: 'BEO-2025-002',
      linkedFolio: 'FOL-2025-002'
    },
    {
      id: 'evt-004',
      organization: 'Garden City University',
      eventName: 'Garden City University Workshop',
      eventType: 'non-residential',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-08-07',
      departureDate: '2025-08-09',
      duration: 3,
      pax: 40,
      residential: false,
      status: 'awaiting-confirmation',
      statusColor: 'warning',
      revenue: 12000,
      deposit: 0,
      balance: 12000,
      salesManager: 'Ama Osei',
      notes: 'Workshop for university staff. Awaiting final confirmation from university board.',
      specialRequirements: 'Workshop layout, flip charts, whiteboards',
      setupTime: '2 hours before event',
      contactPerson: 'Dr. Grace Mensah',
      contactPhone: '+233 20 123 4570',
      contactEmail: 'grace.mensah@gcuniversity.edu.gh',
      linkedQuote: 'Q-2025-004',
      linkedBooking: null,
      linkedBEO: null,
      linkedFolio: null
    },
    {
      id: 'evt-005',
      organization: 'I-Trade Consult',
      eventName: 'I-Trade Consult Training',
      eventType: 'non-residential',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-08-12',
      departureDate: '2025-08-14',
      duration: 3,
      pax: 25,
      residential: false,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 7500,
      deposit: 3750,
      balance: 3750,
      salesManager: 'Kwame Mensah',
      notes: 'Corporate training session. All materials provided by client.',
      specialRequirements: 'Training room layout, projector, whiteboard',
      setupTime: '1 hour before event',
      contactPerson: 'Mr. David Wilson',
      contactPhone: '+233 20 123 4571',
      contactEmail: 'david.wilson@itradeconsult.com',
      linkedQuote: 'Q-2025-005',
      linkedBooking: null,
      linkedBEO: 'BEO-2025-003',
      linkedFolio: 'FOL-2025-003'
    },
    {
      id: 'evt-006',
      organization: 'CHAI',
      eventName: 'CHAI Health Conference',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-08-18',
      departureDate: '2025-08-21',
      duration: 4,
      pax: 80,
      residential: true,
      status: 'awaiting-confirmation',
      statusColor: 'warning',
      revenue: 48000,
      deposit: 0,
      balance: 48000,
      salesManager: 'Ama Osei',
      notes: 'International health conference. Awaiting visa confirmations for international participants.',
      specialRequirements: 'International standards, health protocols, recording facilities',
      setupTime: '4 hours before event',
      contactPerson: 'Dr. Mary Johnson',
      contactPhone: '+233 20 123 4572',
      contactEmail: 'mary.johnson@chai.org',
      linkedQuote: 'Q-2025-006',
      linkedBooking: null,
      linkedBEO: null,
      linkedFolio: null
    },
    {
      id: 'evt-007',
      organization: 'GIZ-NEID',
      eventName: 'GIZ-NEID CLUSTER Conference',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2025-08-18',
      departureDate: '2025-08-23',
      duration: 6,
      pax: 120,
      residential: true,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 72000,
      deposit: 36000,
      balance: 36000,
      salesManager: 'Kwame Mensah',
      notes: 'Major international development conference. High-profile attendees including government officials.',
      specialRequirements: 'Security clearance, VIP protocols, international standards',
      setupTime: '6 hours before event',
      contactPerson: 'Ms. Anna Schmidt',
      contactPhone: '+233 20 123 4573',
      contactEmail: 'anna.schmidt@giz.de',
      linkedQuote: 'Q-2025-007',
      linkedBooking: 'BK-2025-003',
      linkedBEO: 'BEO-2025-004',
      linkedFolio: 'FOL-2025-004',
      startDate: '2025-08-18',
      endDate: '2025-08-23',
      expectedPax: 120,
      venueKey: 'oforwaa-hall',
      dailySchedule: [
        { date: '2025-08-18', conferencePax: 120, lunchPax: 100, dinnerPax: 120, rooms: 60, rate: 0, extras: {}, extraLines: [] },
        { date: '2025-08-19', conferencePax: 120, lunchPax: 100, dinnerPax: 120, rooms: 60, rate: 0, extras: {}, extraLines: [] },
        { date: '2025-08-20', conferencePax: 120, lunchPax: 100, dinnerPax: 120, rooms: 60, rate: 0, extras: {}, extraLines: [] },
        { date: '2025-08-21', conferencePax: 120, lunchPax: 100, dinnerPax: 120, rooms: 60, rate: 0, extras: {}, extraLines: [] },
        { date: '2025-08-22', conferencePax: 120, lunchPax: 100, dinnerPax: 120, rooms: 60, rate: 0, extras: {}, extraLines: [] },
        { date: '2025-08-23', conferencePax: 80, lunchPax: 80, dinnerPax: 0, rooms: 40, rate: 0, extras: {}, extraLines: [] }
      ],
      ratesByParticulars: true,
      conferenceRate: 300,
      lunchRate: 50,
      dinnerRate: 80,
      roomRate: 200,
      defaultDayRate: 0
    },
    {
      id: 'evt-active-001',
      organization: 'Ministry of Education',
      eventName: 'National Teachers Conference 2025',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: new Date().toISOString().split('T')[0],
      departureDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      duration: 4,
      pax: 150,
      expectedPax: 150,
      residential: true,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 90000,
      deposit: 45000,
      balance: 45000,
      salesManager: 'Ama Osei',
      notes: 'National conference for teachers across Ghana. Currently in progress.',
      specialRequirements: 'Large conference setup, accommodation for 150 participants, catering for all meals',
      setupTime: '4 hours before event',
      contactPerson: 'Dr. Comfort Asante',
      contactPhone: '+233 24 123 4567',
      contactEmail: 'comfort.asante@moe.gov.gh',
      linkedQuote: 'Q-2025-ACTIVE-001',
      linkedBooking: 'BK-2025-ACTIVE-001',
      linkedBEO: 'BEO-2025-ACTIVE-001',
      linkedFolio: 'FOL-2025-ACTIVE-001',
      venueKey: 'oforwaa-hall',
      dailySchedule: [
        { date: new Date().toISOString().split('T')[0], conferencePax: 150, lunchPax: 150, dinnerPax: 150, rooms: 75, rate: 0, extras: {}, extraLines: [] },
        { date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], conferencePax: 150, lunchPax: 150, dinnerPax: 150, rooms: 75, rate: 0, extras: {}, extraLines: [] },
        { date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], conferencePax: 150, lunchPax: 150, dinnerPax: 150, rooms: 75, rate: 0, extras: {}, extraLines: [] },
        { date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], conferencePax: 100, lunchPax: 100, dinnerPax: 0, rooms: 50, rate: 0, extras: {}, extraLines: [] }
      ],
      ratesByParticulars: true,
      conferenceRate: 350,
      lunchRate: 60,
      dinnerRate: 90,
      roomRate: 250,
      defaultDayRate: 0
    },
    {
      id: 'evt-active-002',
      organization: 'Ghana Chamber of Commerce',
      eventName: 'Business Excellence Awards Gala',
      eventType: 'non-residential',
      venue: 'dankwah-hall',
      venueName: 'Dankwah Hall',
      arrivalDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      departureDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      duration: 1,
      pax: 200,
      expectedPax: 200,
      residential: false,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 50000,
      deposit: 25000,
      balance: 25000,
      salesManager: 'Kwame Mensah',
      notes: 'Annual awards ceremony for outstanding businesses. High-profile event with media coverage.',
      specialRequirements: 'Gala setup, stage, sound system, lighting, VIP area, red carpet',
      setupTime: '6 hours before event',
      contactPerson: 'Mr. Samuel Ofori',
      contactPhone: '+233 24 123 4568',
      contactEmail: 'samuel.ofori@ghchamber.org',
      linkedQuote: 'Q-2025-ACTIVE-002',
      linkedBooking: 'BK-2025-ACTIVE-002',
      linkedBEO: 'BEO-2025-ACTIVE-002',
      linkedFolio: 'FOL-2025-ACTIVE-002',
      venueKey: 'dankwah-hall',
      dailySchedule: [
        { date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], conferencePax: 0, lunchPax: 0, dinnerPax: 200, rooms: 0, rate: 0, extras: {}, extraLines: [] }
      ],
      ratesByParticulars: true,
      conferenceRate: 0,
      lunchRate: 0,
      dinnerRate: 250,
      roomRate: 0,
      defaultDayRate: 0
    },
    {
      id: 'evt-active-003',
      organization: 'Tech Hub Ghana',
      eventName: 'Startup Accelerator Program',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      departureDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      duration: 4,
      pax: 80,
      expectedPax: 80,
      residential: true,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 64000,
      deposit: 32000,
      balance: 32000,
      salesManager: 'Ama Osei',
      notes: 'Intensive 4-day program for tech startups. Includes workshops, mentoring, and networking.',
      specialRequirements: 'Workshop setup, high-speed internet, breakout rooms, presentation equipment',
      setupTime: '3 hours before event',
      contactPerson: 'Ms. Akosua Mensah',
      contactPhone: '+233 24 123 4569',
      contactEmail: 'akosua.mensah@techhubgh.com',
      linkedQuote: 'Q-2025-ACTIVE-003',
      linkedBooking: 'BK-2025-ACTIVE-003',
      linkedBEO: 'BEO-2025-ACTIVE-003',
      linkedFolio: 'FOL-2025-ACTIVE-003',
      venueKey: 'oforwaa-hall',
      dailySchedule: [
        { date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], conferencePax: 80, lunchPax: 80, dinnerPax: 80, rooms: 40, rate: 0, extras: {}, extraLines: [] },
        { date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], conferencePax: 80, lunchPax: 80, dinnerPax: 80, rooms: 40, rate: 0, extras: {}, extraLines: [] },
        { date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], conferencePax: 80, lunchPax: 80, dinnerPax: 80, rooms: 40, rate: 0, extras: {}, extraLines: [] },
        { date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], conferencePax: 60, lunchPax: 60, dinnerPax: 0, rooms: 30, rate: 0, extras: {}, extraLines: [] }
      ],
      ratesByParticulars: true,
      conferenceRate: 400,
      lunchRate: 70,
      dinnerRate: 100,
      roomRate: 300,
      defaultDayRate: 0
    },
    {
      id: 'evt-completed-001',
      organization: 'Ghana Medical Association',
      eventName: 'Annual Medical Conference 2024',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2024-11-15',
      departureDate: '2024-11-18',
      startDate: '2024-11-15',
      endDate: '2024-11-18',
      duration: 4,
      pax: 120,
      expectedPax: 120,
      residential: true,
      status: 'confirmed',
      completionStatus: 'completed',
      statusColor: 'success',
      revenue: 72000,
      deposit: 36000,
      balance: 0,
      budgetTotal: 72000,
      actualTotal: 75000,
      variance: 3000,
      salesManager: 'Kwame Mensah',
      notes: 'Successfully completed annual medical conference. All participants satisfied with services.',
      specialRequirements: 'Medical equipment, recording facilities, high-speed internet',
      setupTime: '4 hours before event',
      contactPerson: 'Dr. Emmanuel Osei',
      contactPhone: '+233 24 123 4700',
      contactEmail: 'emmanuel.osei@gma.org.gh',
      linkedQuote: 'Q-2024-COMP-001',
      linkedBooking: 'BK-2024-COMP-001',
      linkedBEO: 'BEO-2024-COMP-001',
      linkedFolio: 'FOL-2024-COMP-001',
      venueKey: 'oforwaa-hall',
      dailySchedule: [
        { date: '2024-11-15', conferencePax: 120, lunchPax: 120, dinnerPax: 120, rooms: 60, rate: 0, extras: {}, extraLines: [] },
        { date: '2024-11-16', conferencePax: 120, lunchPax: 120, dinnerPax: 120, rooms: 60, rate: 0, extras: {}, extraLines: [] },
        { date: '2024-11-17', conferencePax: 120, lunchPax: 120, dinnerPax: 120, rooms: 60, rate: 0, extras: {}, extraLines: [] },
        { date: '2024-11-18', conferencePax: 80, lunchPax: 80, dinnerPax: 0, rooms: 40, rate: 0, extras: {}, extraLines: [] }
      ],
      ratesByParticulars: true,
      conferenceRate: 350,
      lunchRate: 60,
      dinnerRate: 90,
      roomRate: 250,
      defaultDayRate: 0
    },
    {
      id: 'evt-completed-002',
      organization: 'Ministry of Finance',
      eventName: 'Economic Policy Forum 2024',
      eventType: 'non-residential',
      venue: 'dankwah-hall',
      venueName: 'Dankwah Hall',
      arrivalDate: '2024-10-20',
      departureDate: '2024-10-22',
      startDate: '2024-10-20',
      endDate: '2024-10-22',
      duration: 3,
      pax: 150,
      expectedPax: 150,
      residential: false,
      status: 'confirmed',
      completionStatus: 'billed',
      statusColor: 'success',
      revenue: 45000,
      deposit: 22500,
      balance: 0,
      budgetTotal: 45000,
      actualTotal: 48000,
      variance: 3000,
      salesManager: 'Ama Osei',
      notes: 'High-profile economic forum with government officials and international delegates. Fully invoiced and paid.',
      specialRequirements: 'VIP setup, security, media coverage, recording',
      setupTime: '5 hours before event',
      contactPerson: 'Mr. Joseph Addo',
      contactPhone: '+233 24 123 4701',
      contactEmail: 'joseph.addo@mof.gov.gh',
      linkedQuote: 'Q-2024-COMP-002',
      linkedBooking: 'BK-2024-COMP-002',
      linkedBEO: 'BEO-2024-COMP-002',
      linkedFolio: 'FOL-2024-COMP-002',
      venueKey: 'dankwah-hall',
      dailySchedule: [
        { date: '2024-10-20', conferencePax: 150, lunchPax: 150, dinnerPax: 0, rooms: 0, rate: 0, extras: {}, extraLines: [] },
        { date: '2024-10-21', conferencePax: 150, lunchPax: 150, dinnerPax: 0, rooms: 0, rate: 0, extras: {}, extraLines: [] },
        { date: '2024-10-22', conferencePax: 100, lunchPax: 100, dinnerPax: 0, rooms: 0, rate: 0, extras: {}, extraLines: [] }
      ],
      ratesByParticulars: true,
      conferenceRate: 200,
      lunchRate: 50,
      dinnerRate: 0,
      roomRate: 0,
      defaultDayRate: 0
    },
    {
      id: 'evt-completed-003',
      organization: 'UNESCO Ghana',
      eventName: 'Education Innovation Summit',
      eventType: 'residential-conference',
      venue: 'oforwaa-hall',
      venueName: 'Oforwaa Hall',
      arrivalDate: '2024-09-10',
      departureDate: '2024-09-13',
      startDate: '2024-09-10',
      endDate: '2024-09-13',
      duration: 4,
      pax: 90,
      expectedPax: 90,
      residential: true,
      status: 'confirmed',
      completionStatus: 'completed',
      statusColor: 'success',
      revenue: 54000,
      deposit: 27000,
      balance: 0,
      budgetTotal: 54000,
      actualTotal: 52000,
      variance: -2000,
      salesManager: 'Kwame Mensah',
      notes: 'International education summit. Event completed successfully with positive feedback from participants.',
      specialRequirements: 'International standards, multilingual support, cultural sensitivity',
      setupTime: '3 hours before event',
      contactPerson: 'Ms. Fatima Mohammed',
      contactPhone: '+233 24 123 4702',
      contactEmail: 'fatima.mohammed@unesco.org',
      linkedQuote: 'Q-2024-COMP-003',
      linkedBooking: 'BK-2024-COMP-003',
      linkedBEO: 'BEO-2024-COMP-003',
      linkedFolio: 'FOL-2024-COMP-003',
      venueKey: 'oforwaa-hall',
      dailySchedule: [
        { date: '2024-09-10', conferencePax: 90, lunchPax: 90, dinnerPax: 90, rooms: 45, rate: 0, extras: {}, extraLines: [] },
        { date: '2024-09-11', conferencePax: 90, lunchPax: 90, dinnerPax: 90, rooms: 45, rate: 0, extras: {}, extraLines: [] },
        { date: '2024-09-12', conferencePax: 90, lunchPax: 90, dinnerPax: 90, rooms: 45, rate: 0, extras: {}, extraLines: [] },
        { date: '2024-09-13', conferencePax: 60, lunchPax: 60, dinnerPax: 0, rooms: 30, rate: 0, extras: {}, extraLines: [] }
      ],
      ratesByParticulars: true,
      conferenceRate: 400,
      lunchRate: 70,
      dinnerRate: 100,
      roomRate: 280,
      defaultDayRate: 0
    }
  ];
  // Additional events for other venues
  const additionalEvents = [
    {
      id: 'evt-008',
      organization: 'Integrated Health',
      eventName: 'Integrated Health Workshop',
      eventType: 'non-residential',
      venue: 'dankwah-hall',
      venueName: 'Dankwah Hall',
      arrivalDate: '2025-08-04',
      departureDate: '2025-08-07',
      duration: 4,
      pax: 100,
      residential: false,
      status: 'awaiting-confirmation',
      statusColor: 'warning',
      revenue: 24000,
      deposit: 0,
      balance: 24000,
      salesManager: 'Ama Osei',
      notes: 'Healthcare workshop for medical professionals.',
      specialRequirements: 'Medical equipment setup, health protocols',
      setupTime: '2 hours before event',
      contactPerson: 'Dr. Kofi Asante',
      contactPhone: '+233 20 123 4574',
      contactEmail: 'kofi.asante@integratedhealth.com',
      linkedQuote: 'Q-2025-008',
      linkedBooking: null,
      linkedBEO: null,
      linkedFolio: null
    },
    {
      id: 'evt-009',
      organization: 'GIZ-NEID',
      eventName: 'GIZ-NEID Side Event',
      eventType: 'non-residential',
      venue: 'dankwah-hall',
      venueName: 'Dankwah Hall',
      arrivalDate: '2025-08-13',
      departureDate: '2025-08-14',
      duration: 2,
      pax: 50,
      residential: false,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 12000,
      deposit: 6000,
      balance: 6000,
      salesManager: 'Kwame Mensah',
      notes: 'Side event to main conference in Oforwaa Hall.',
      specialRequirements: 'Linked to main conference setup',
      setupTime: '1 hour before event',
      contactPerson: 'Ms. Anna Schmidt',
      contactPhone: '+233 20 123 4573',
      contactEmail: 'anna.schmidt@giz.de',
      linkedQuote: 'Q-2025-009',
      linkedBooking: null,
      linkedBEO: 'BEO-2025-005',
      linkedFolio: 'FOL-2025-005'
    },
    {
      id: 'evt-010',
      organization: 'International Justice Mission',
      eventName: 'IJM Legal Workshop',
      eventType: 'non-residential',
      venue: 'dankwah-hall',
      venueName: 'Dankwah Hall',
      arrivalDate: '2025-08-18',
      departureDate: '2025-08-21',
      duration: 4,
      pax: 75,
      residential: false,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 18000,
      deposit: 9000,
      balance: 9000,
      salesManager: 'Ama Osei',
      notes: 'Legal workshop for justice professionals.',
      specialRequirements: 'Legal documentation setup, recording facilities',
      setupTime: '2 hours before event',
      contactPerson: 'Mr. James Brown',
      contactPhone: '+233 20 123 4575',
      contactEmail: 'james.brown@ijm.org',
      linkedQuote: 'Q-2025-010',
      linkedBooking: null,
      linkedBEO: 'BEO-2025-006',
      linkedFolio: 'FOL-2025-006'
    },
    {
      id: 'evt-011',
      organization: 'Rural Bank Association',
      eventName: 'Rural Bank AGM',
      eventType: 'non-residential',
      venue: 'dankwah-hall',
      venueName: 'Dankwah Hall',
      arrivalDate: '2025-08-28',
      departureDate: '2025-08-30',
      duration: 3,
      pax: 120,
      residential: false,
      status: 'confirmed',
      statusColor: 'success',
      revenue: 18000,
      deposit: 9000,
      balance: 9000,
      salesManager: 'Kwame Mensah',
      notes: 'Annual general meeting for rural bank members.',
      specialRequirements: 'AGM setup, voting facilities, presentation equipment',
      setupTime: '3 hours before event',
      contactPerson: 'Mr. Kwame Owusu',
      contactPhone: '+233 20 123 4576',
      contactEmail: 'kwame.owusu@ruralbank.org',
      linkedQuote: 'Q-2025-011',
      linkedBooking: null,
      linkedBEO: 'BEO-2025-007',
      linkedFolio: 'FOL-2025-007'
    }
  ];
  // Combine all events for modern management system
  const allEvents = useMemo(() => {
    const map = new Map<string, any>();

    [...comprehensiveEvents, ...additionalEvents].forEach(event => {
      if (!event?.id) return;
      map.set(event.id, event);
    });

    customEvents.forEach(event => {
      if (!event?.id) return;
      const existing = map.get(event.id);
      map.set(event.id, existing ? { ...existing, ...event } : event);
    });

    return Array.from(map.values());
  }, [customEvents, comprehensiveEvents, additionalEvents]);

  const eventOptions = useMemo(
    () =>
      allEvents.map(event => ({
        id: event.id,
        label: getEventDisplayName(event),
        client: getEventClientName(event)
      })),
    [allEvents]
  );
  const invoiceSummary = useMemo(
    () =>
      eventInvoices.reduce(
        (acc, invoice) => {
          acc.total += invoice.total || 0;
          acc.balance += invoice.balance || 0;
          acc.paid += (invoice.total || 0) - (invoice.balance || 0);
          if (invoice.status === 'Overdue') {
            acc.overdue += invoice.balance || 0;
          }
          return acc;
        },
        { total: 0, balance: 0, paid: 0, overdue: 0 }
      ),
    [eventInvoices]
  );
  const outstandingInvoiceCount = useMemo(
    () => eventInvoices.filter(inv => inv.balance > 0).length,
    [eventInvoices]
  );
  const receiptsTotal = useMemo(
    () => eventReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0),
    [eventReceipts]
  );
  const openFolioCount = useMemo(
    () => eventFolios.filter(folio => folio.status === 'Open').length,
    [eventFolios]
  );
  const folioTotals = useMemo(
    () =>
      eventFolios.reduce(
        (acc, folio) => {
          const totals = calculateFolioTotals(folio);
          acc.debits += totals.debits;
          acc.credits += totals.credits;
          return acc;
        },
        { debits: 0, credits: 0 }
      ),
    [eventFolios]
  );
  const folioBalanceTotal = useMemo(
    () => eventFolios.reduce((sum, folio) => sum + getFolioCurrentBalance(folio), 0),
    [eventFolios]
  );

  // Report and Analytics Data
  const monthlyRevenue = allEvents.reduce((sum, event) => sum + event.revenue, 0);
  const averageEventValue = allEvents.length > 0 ? monthlyRevenue / allEvents.length : 0;
  const totalAttendees = allEvents.reduce((sum, event) => sum + event.pax, 0);
  const occupancyRate = Math.round((allEvents.length / 30) * 100); // Simple calculation for demo

  const enhanceEventForManagement = useCallback(
    (event: any) => {
      const quoteBudget = getQuoteBudgetSnapshot(event);
      const quoteTotal = quoteBudget.total;
      // Sum all invoices for this event (not just the first one)
      const eventInvoicesList = eventInvoices.filter((inv: any) => inv.eventId === event.id);
      const invoiceTotal = eventInvoicesList.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
      const oldActuals = event.actualCosts || {};
      const oldActualTotal =
        (oldActuals.accommodation || 0) +
        (oldActuals.conference || 0) +
        (oldActuals.dinner || 0) +
        (oldActuals.lunch || 0) +
        (oldActuals.extras || 0);
      // Use invoice total if available, otherwise fall back to old actuals
      const invoiceTotalFinal = invoiceTotal > 0 ? invoiceTotal : oldActualTotal;
      const normalizedStatus = normalizeStatus(event.status);
      let eventStatus: 'confirmed' | 'in-progress' | 'completed' | 'billed' = 'confirmed';
      const completionStatus = (event as any).completionStatus;
      if (completionStatus === 'completed') {
        eventStatus = 'completed';
      } else if (completionStatus === 'billed' || normalizedStatus === 'invoiced') {
        eventStatus = 'billed';
      } else {
        const arrivalDateStr = event.arrivalDate || event.startDate;
        const departureDateStr = event.departureDate || event.endDate;
        if (arrivalDateStr && departureDateStr) {
          const today = toStartOfDay(new Date());
          const start = toStartOfDay(new Date(arrivalDateStr));
          const end = toStartOfDay(new Date(departureDateStr));
          if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && today >= start && today <= end) {
            eventStatus = 'in-progress';
          }
        }
      }
      return {
        ...event,
        quoteBudgetSnapshot: quoteBudget,
        budgetTotal: quoteTotal, // Keep for backward compatibility
        quoteTotal, // New field name
        actualTotal: invoiceTotalFinal > 0 ? invoiceTotalFinal : undefined, // Keep for backward compatibility
        invoiceTotal: invoiceTotalFinal > 0 ? invoiceTotalFinal : undefined, // New field name
        variance: invoiceTotalFinal > 0 ? invoiceTotalFinal - quoteTotal : undefined,
        eventStatus,
        status: normalizedStatus,
        invoiceId: eventInvoicesList.length > 0 ? eventInvoicesList[0]?.id || null : null,
        invoiceCount: eventInvoicesList.length
      };
    },
    [eventInvoices]
  );

  const reportingEvents = useMemo(
    () => allEvents.map(event => enhanceEventForManagement(event)),
    [allEvents, enhanceEventForManagement]
  );

  const reportingStatusBuckets = useMemo(
    () =>
      reportingEvents.reduce(
        (acc: Record<SimpleEventStatus | 'total', number>, event: any) => {
          const normalized = normalizeStatus(event.status || event.eventStatus);
          acc.total += 1;
          acc[normalized] = (acc[normalized] || 0) + 1;
          return acc;
        },
        { total: 0, quote: 0, confirmed: 0, invoiced: 0, cancelled: 0 }
      ),
    [reportingEvents]
  );

  const reportingPipelineAmounts = useMemo(
    () =>
      reportingEvents.reduce(
        (acc, event: any) => {
          const normalized = normalizeStatus(event.status || event.eventStatus);
          const value = Number(event.revenue || event.budgetTotal || 0) || 0;
          acc.total += value;
          if (normalized === 'quote') acc.quote += value;
          if (normalized === 'confirmed') acc.confirmed += value;
          if (normalized === 'invoiced') acc.invoiced += value;
          return acc;
        },
        { total: 0, quote: 0, confirmed: 0, invoiced: 0 }
      ),
    [reportingEvents]
  );

  const reportingTotalPax = useMemo(
    () => reportingEvents.reduce((sum: number, event: any) => sum + (Number(event.pax) || 0), 0),
    [reportingEvents]
  );

  const reportingAveragePax = useMemo(
    () => (reportingEvents.length > 0 ? Math.round(reportingTotalPax / reportingEvents.length) : 0),
    [reportingEvents.length, reportingTotalPax]
  );

  const reportingUpcoming30 = useMemo(() => {
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    return reportingEvents.filter((event: any) => {
      const startStr = event.arrivalDate || event.startDate;
      if (!startStr) return false;
      const start = new Date(startStr);
      return !Number.isNaN(start.getTime()) && start >= now && start <= horizon;
    });
  }, [reportingEvents]);

  const reportingVipCount = useMemo(
    () =>
      reportingEvents.filter(
        (event: any) => (event.specialRequirements || event.notes || '').toLowerCase().includes('vip')
      ).length,
    [reportingEvents]
  );

  const reportingEventsWithBEO = useMemo(
    () => reportingEvents.filter((event: any) => !!event.linkedBEO).length,
    [reportingEvents]
  );
  const reportingEventsWithFolio = useMemo(
    () => reportingEvents.filter((event: any) => !!event.linkedFolio).length,
    [reportingEvents]
  );
  const reportingEventsNeedingBEO = useMemo(
    () => Math.max(0, reportingEvents.length - reportingEventsWithBEO),
    [reportingEvents.length, reportingEventsWithBEO]
  );
  const reportingEventsNeedingFolio = useMemo(
    () => Math.max(0, reportingEvents.length - reportingEventsWithFolio),
    [reportingEvents.length, reportingEventsWithFolio]
  );

  const onsiteSpendPerAttendee = useMemo(
    () => (totalAttendees > 0 ? receiptsTotal / totalAttendees : 0),
    [receiptsTotal, totalAttendees]
  );

  const venueUtilizationRate = useMemo(
    () => (totalVenues > 0 ? Math.round((bookedVenues / totalVenues) * 100) : 0),
    [bookedVenues, totalVenues]
  );

  const reportingAverageDuration = useMemo(() => {
    if (!reportingEvents.length) return 0;
    const totalDuration = reportingEvents.reduce((sum: number, event: any) => {
      const explicit = Number(event.duration);
      if (!Number.isNaN(explicit) && explicit > 0) return sum + explicit;
      return sum + computeEventDurationDays(event);
    }, 0);
    return Math.max(1, Math.round(totalDuration / reportingEvents.length));
  }, [reportingEvents]);

  const unbilledEventsCount = useMemo(
    () =>
      reportingEvents.filter((event: any) => normalizeStatus(event.status || event.eventStatus) !== 'invoiced')
        .length,
    [reportingEvents]
  );

  const goToEventManagement = useCallback(
    (tab: typeof managementMainTab) => {
      setSelectedTab('confirmed');
      setManagementMainTab(tab);
    },
    [setSelectedTab, setManagementMainTab]
  );

  const goToVenueManagement = useCallback(() => setSelectedTab('venues'), [setSelectedTab]);

  const selectedCategoryInsights = useMemo<ReportInsight[]>(() => {
    if (!selectedReportCategory) return [];
    const activeOpportunities = reportingStatusBuckets.quote + reportingStatusBuckets.confirmed + reportingStatusBuckets.invoiced;
    const conversionRate =
      reportingStatusBuckets.total > 0
        ? Math.round(((reportingStatusBuckets.confirmed + reportingStatusBuckets.invoiced) / reportingStatusBuckets.total) * 100)
        : 0;
    switch (selectedReportCategory.key) {
      case 'sales-pipeline':
        return [
          {
            label: 'Active Opportunities',
            value: activeOpportunities.toLocaleString(),
            helper: `${reportingStatusBuckets.quote.toLocaleString()} quotes • ${reportingStatusBuckets.confirmed.toLocaleString()} confirmed`
          },
          {
            label: 'Conversion Rate',
            value: `${conversionRate}%`,
            helper: `${(reportingStatusBuckets.confirmed + reportingStatusBuckets.invoiced).toLocaleString()} wins`
          },
          {
            label: 'Pipeline Value',
            value: formatCurrency(reportingPipelineAmounts.total),
            helper: `${formatCurrency(reportingPipelineAmounts.confirmed)} confirmed`
          }
        ];
      case 'operations-venues':
        return [
          {
            label: 'Spaces Online',
            value: totalVenues.toLocaleString(),
            helper: `${availableVenues} available / ${bookedVenues} booked`
          },
          {
            label: 'Utilisation Today',
            value: `${venueUtilizationRate}%`,
            helper: `${setupInProgress} setups underway`
          },
          {
            label: 'Avg Event Duration',
            value: `${reportingAverageDuration} days`,
            helper: `${reportingUpcoming30.length} events in 30 days`
          }
        ];
      case 'guest-experience':
        return [
          {
            label: 'Attendees In System',
            value: reportingTotalPax.toLocaleString(),
            helper: `Avg ${reportingAveragePax} pax / event`
          },
          {
            label: 'VIP / High Touch',
            value: reportingVipCount.toLocaleString(),
            helper: `${reportingUpcoming30.length} upcoming`
          },
          {
            label: 'Spend per Attendee',
            value: formatCurrency(Math.round(onsiteSpendPerAttendee) || 0),
            helper: `${eventReceipts.length} receipts logged`
          }
        ];
      case 'finance-billing':
        return [
          {
            label: 'Invoice Backlog',
            value: formatCurrency(invoiceSummary.balance),
            helper: `${outstandingInvoiceCount} open`
          },
          {
            label: 'Cash Collected',
            value: formatCurrency(receiptsTotal),
            helper: `${eventReceipts.length} receipts`
          },
          {
            label: 'Open Folios',
            value: openFolioCount.toLocaleString(),
            helper: `Net ${formatCurrency(folioBalanceTotal)} • ${unbilledEventsCount.toLocaleString()} unbilled`
          }
        ];
      case 'compliance-vendors':
        return [
          {
            label: 'Events w/ BEO',
            value: reportingEvents.length > 0 ? `${reportingEventsWithBEO}/${reportingEvents.length}` : '0',
            helper: `${reportingEventsNeedingBEO} pending`
          },
          {
            label: 'Events w/ Folio',
            value: reportingEvents.length > 0 ? `${reportingEventsWithFolio}/${reportingEvents.length}` : '0',
            helper: `${reportingEventsNeedingFolio} pending`
          },
          {
            label: 'Tracked Cost Centres',
            value: selectedCostCenterList.length.toLocaleString(),
            helper: 'Linked vendor/service spend'
          }
        ];
      default:
        return [];
    }
  }, [
    selectedReportCategory,
    reportingStatusBuckets,
    reportingPipelineAmounts,
    totalVenues,
    availableVenues,
    bookedVenues,
    venueUtilizationRate,
    setupInProgress,
    reportingAverageDuration,
    reportingUpcoming30.length,
    reportingTotalPax,
    reportingAveragePax,
    reportingVipCount,
    onsiteSpendPerAttendee,
    eventReceipts.length,
    invoiceSummary.balance,
    outstandingInvoiceCount,
    receiptsTotal,
    openFolioCount,
    folioBalanceTotal,
    reportingEvents.length,
    reportingEventsWithBEO,
    reportingEventsWithFolio,
    reportingEventsNeedingBEO,
    reportingEventsNeedingFolio,
    selectedCostCenterList.length,
    unbilledEventsCount
  ]);

  const selectedCategoryLinks = useMemo<ReportQuickLink[]>(() => {
    if (!selectedReportCategory) return [];
    switch (selectedReportCategory.key) {
      case 'sales-pipeline':
        return [
          { label: 'Event Master', icon: '📋', action: () => goToEventManagement('events') },
          { label: 'Quotes Workspace', icon: '📑', action: () => goToEventManagement('quotes') }
        ];
      case 'operations-venues':
        return [
          { label: 'Venue Management', icon: '🏢', action: goToVenueManagement },
          { label: 'Active Ops Board', icon: '🛠️', action: () => goToEventManagement('active') }
        ];
      case 'guest-experience':
        return [
          { label: 'Event Master', icon: '🎟️', action: () => goToEventManagement('events') },
          { label: 'Folios & Guests', icon: '📂', action: () => goToEventManagement('folios') }
        ];
      case 'finance-billing':
        return [
          { label: 'Invoices Workspace', icon: '🧾', action: () => goToEventManagement('invoices') }
        ];
      case 'compliance-vendors':
        return [
          { label: 'Active Events Board', icon: '🛡️', action: () => goToEventManagement('active') },
          { label: 'Venue Management', icon: '🏢', action: goToVenueManagement }
        ];
      default:
        return [];
    }
  }, [selectedReportCategory, goToEventManagement, goToVenueManagement]);


  const eventsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    allEvents.forEach(event => {
      if (!event?.arrivalDate || !event?.departureDate) return;
      const start = toStartOfDay(new Date(event.arrivalDate));
      const end = toStartOfDay(new Date(event.departureDate));
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

      const cursor = new Date(start);
      while (cursor <= end) {
        const key = formatDateKey(cursor);
        const existing = map.get(key);
        if (existing) {
          existing.push(event);
        } else {
          map.set(key, [event]);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [allEvents]);

  const calendarGridDays = useMemo(() => {
    const reference = eventCalendarDate;
    const firstOfMonth = getStartOfMonth(reference);
    const startDayIndex = firstOfMonth.getDay();
    const daysInMonth = getEndOfMonth(reference).getDate();
    const totalCells = Math.ceil((startDayIndex + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const cellDate = addDays(firstOfMonth, index - startDayIndex);
      return {
        date: cellDate,
        key: formatDateKey(cellDate),
        isCurrentMonth: cellDate.getMonth() === reference.getMonth()
      };
    });
  }, [eventCalendarDate]);

  const calendarWeekDays = useMemo(() => {
    const start = getStartOfWeek(eventCalendarDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [eventCalendarDate]);

  const calendarWeekRange = useMemo(() => {
    const start = getStartOfWeek(eventCalendarDate);
    const end = getEndOfWeek(eventCalendarDate);
    return { start, end };
  }, [eventCalendarDate]);

  const calendarTitle = useMemo(() => {
    return eventCalendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [eventCalendarDate]);

  const weekRangeTitle = useMemo(() => {
    const start = calendarWeekRange.start;
    const end = calendarWeekRange.end;
    const startLabel = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    const endLabel = `${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return `${startLabel} - ${endLabel}`;
  }, [calendarWeekRange]);

  const calendarHeaderTitle = useMemo(() => {
    if (eventCalendarView === 'week') {
      return weekRangeTitle;
    }
    if (eventCalendarView === 'day') {
      return eventCalendarDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    return calendarTitle;
  }, [calendarTitle, eventCalendarDate, eventCalendarView, weekRangeTitle]);

  const dayKey = formatDateKey(eventCalendarDate);
  const dayEvents = useMemo(() => eventsByDay.get(dayKey) || [], [eventsByDay, dayKey]);

  const ganttVenues = useMemo(() => {
    const venues = modernVenues.map(venue => ({ id: venue.id, name: venue.name }));
    const hasUnassigned = allEvents.some(event => !event.venue);
    if (hasUnassigned) {
      venues.push({ id: 'unassigned', name: 'Unassigned Venues' });
    }
    return venues;
  }, [allEvents]);

  const ganttTimelineStart = useMemo(() => getStartOfMonth(ganttReferenceDate), [ganttReferenceDate]);
  const ganttTimelineEnd = useMemo(() => getEndOfMonth(ganttReferenceDate), [ganttReferenceDate]);
  const ganttTimelineTitle = useMemo(() => {
    return ganttReferenceDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [ganttReferenceDate]);
  const timelineDayCount = Math.max(1, Math.round((toStartOfDay(ganttTimelineEnd).getTime() - toStartOfDay(ganttTimelineStart).getTime()) / DAY_IN_MS) + 1);
  const ganttTimelineRangeLabel = `${formatDateKey(ganttTimelineStart)} → ${formatDateKey(ganttTimelineEnd)}`;

  const calendarMonthInputValue = `${eventCalendarDate.getFullYear()}-${padNumber(eventCalendarDate.getMonth() + 1)}`;
  const calendarDateInputValue = formatDateKey(eventCalendarDate);
  const ganttMonthInputValue = `${ganttReferenceDate.getFullYear()}-${padNumber(ganttReferenceDate.getMonth() + 1)}`;
  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const calendarDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timelineDays = useMemo(() => Array.from({ length: timelineDayCount }, (_, index) => addDays(ganttTimelineStart, index)), [ganttTimelineStart, timelineDayCount]);
  const ganttVenuesToRender = useMemo(() => {
    if (selectedGanttVenue === 'all') {
      return ganttVenues;
    }
    return ganttVenues.filter(venue => venue.id === selectedGanttVenue);
  }, [ganttVenues, selectedGanttVenue]);

  // Comprehensive Event Management Functions
  
  // Check for venue double-booking conflicts
  const checkForClashes = (newEvent: any, existingEvents: any[] = allEvents) => {
    const conflictingEvents = existingEvents.filter(event => {
      // Skip the event itself if updating
      if (event.id === newEvent.id) return false;
      
      // Check if same venue
      if (event.venue !== newEvent.venue) return false;
      
      // Check for date overlap
      const newStart = new Date(newEvent.arrivalDate);
      const newEnd = new Date(newEvent.departureDate);
      const existingStart = new Date(event.arrivalDate);
      const existingEnd = new Date(event.departureDate);
      
      // Check if dates overlap
      return (newStart <= existingEnd && newEnd >= existingStart);
    });
    
    return conflictingEvents;
  };

  // Check for resource overload (rooms, kitchen capacity, etc.)
  const checkResourceOverload = (newEvent: any, existingEvents: any[] = allEvents) => {
    const eventDate = new Date(newEvent.arrivalDate);
    const sameDateEvents = existingEvents.filter(event => {
      if (event.id === newEvent.id) return false;
      
      const eventStart = new Date(event.arrivalDate);
      const eventEnd = new Date(event.departureDate);
      
      return (eventStart <= eventDate && eventEnd >= eventDate);
    });
    
    // Calculate total pax for the same date
    const totalPax = sameDateEvents.reduce((sum, event) => sum + event.pax, 0) + newEvent.pax;
    
    // Check against venue capacity
    const venue = modernVenues.find(v => v.id === newEvent.venue);
    const venueCapacity = venue ? venue.capacity : 0;
    
    // Check against room inventory (assuming 150 rooms available)
    const totalResidentialPax = sameDateEvents
      .filter(event => event.residential)
      .reduce((sum, event) => sum + event.pax, 0) + (newEvent.residential ? newEvent.pax : 0);
    
    const warnings = [];
    
    if (totalPax > venueCapacity) {
      warnings.push({
        type: 'venue-overload',
        message: `High Venue Load Warning! Total attendees (${totalPax}) exceeds venue capacity (${venueCapacity}) on ${newEvent.arrivalDate}.`
      });
    }
    
    if (totalResidentialPax > 150) {
      warnings.push({
        type: 'room-overload',
        message: `Insufficient Room Inventory! These bookings would require ${totalResidentialPax} rooms on ${newEvent.arrivalDate}, but only 150 are available.`
      });
    }
    
    if (totalPax > 200) {
      warnings.push({
        type: 'kitchen-overload',
        message: `High Kitchen Load Warning on ${newEvent.arrivalDate}! Total attendees (${totalPax}) may overwhelm kitchen capacity.`
      });
    }
    
    return warnings;
  };

  // Get events for a specific date range
  const getEventsForDateRange = (startDate: string, endDate: string, venue?: string) => {
    const filteredEvents = allEvents.filter(event => {
      const eventStart = new Date(event.arrivalDate);
      const eventEnd = new Date(event.departureDate);
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      
      // Check if event overlaps with date range
      const dateOverlap = (eventStart <= rangeEnd && eventEnd >= rangeStart);
      
      // If venue specified, also check venue
      if (venue) {
        return dateOverlap && event.venue === venue;
      }
      
      return dateOverlap;
    });
    
    return filteredEvents.sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());
  };

  // Get events for a specific venue
  const getEventsForVenue = (venueId: string, rangeStart?: Date, rangeEnd?: Date) => {
    const filtered = allEvents.filter(event => {
      const matchesVenue = venueId === 'unassigned' ? !event.venue : event.venue === venueId;
      if (!matchesVenue) return false;

      if (rangeStart && rangeEnd) {
        const eventStart = toStartOfDay(new Date(event.arrivalDate));
        const eventEnd = toStartOfDay(new Date(event.departureDate));
        return eventEnd >= rangeStart && eventStart <= rangeEnd;
      }

      return true;
    });

    return filtered.sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());
  };

  const handleCalendarNavigate = (direction: number) => {
    if (eventCalendarView === 'day') {
      setEventCalendarDate(prev => addDays(prev, direction));
    } else if (eventCalendarView === 'week') {
      setEventCalendarDate(prev => getStartOfWeek(addDays(prev, direction * 7)));
    } else {
      setEventCalendarDate(prev => {
        const next = getStartOfMonth(addMonths(prev, direction));
        setGanttReferenceDate(next);
        return next;
      });
    }
  };

  const handleCalendarToday = () => {
    const today = new Date();
    if (eventCalendarView === 'week') {
      setEventCalendarDate(getStartOfWeek(today));
    } else if (eventCalendarView === 'month') {
      setEventCalendarDate(getStartOfMonth(today));
    } else {
      setEventCalendarDate(today);
    }
    setGanttReferenceDate(getStartOfMonth(today));
  };
  const handleCalendarDateInput = (value: string) => {
    if (!value) return;

    if (eventCalendarView === 'month') {
      const [yearStr, monthStr] = value.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (!Number.isNaN(year) && !Number.isNaN(month)) {
        const next = new Date(year, month - 1, 1);
        setEventCalendarDate(getStartOfMonth(next));
        setGanttReferenceDate(getStartOfMonth(next));
      }
    } else {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        const normalized = eventCalendarView === 'week' ? getStartOfWeek(parsed) : parsed;
        setEventCalendarDate(normalized);
      }
    }
  };

  const handleCalendarViewChange = (view: 'month' | 'week' | 'day') => {
    setEventCalendarView(view);
    if (view === 'week') {
      setEventCalendarDate(prev => getStartOfWeek(prev));
    }
    if (view === 'month') {
      setEventCalendarDate(prev => getStartOfMonth(prev));
      setGanttReferenceDate(prev => getStartOfMonth(prev));
    }
  };

  const handleGanttNavigate = (direction: number) => {
    setGanttReferenceDate(prev => addMonths(prev, direction));
  };

  const handleGanttMonthInput = (value: string) => {
    if (!value) return;
    const [yearStr, monthStr] = value.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isNaN(year) && !Number.isNaN(month)) {
      setGanttReferenceDate(new Date(year, month - 1, 1));
    }
  };

  // Get events by status
  const getEventsByStatus = (status: string) => {
    return allEvents.filter(event => event.status === status);
  };

  // Get events by organization
  const getEventsByOrganization = (organization: string) => {
    return allEvents.filter(event => event.organization === organization);
  };

  // Update event status
  const updateEventStatus = (eventId: string, newStatus: string) => {
    const event = allEvents.find(e => e.id === eventId);
    if (event) {
      event.status = newStatus;
      event.statusColor = eventStatuses[newStatus as keyof typeof eventStatuses]?.color || 'default';
      trackEvent('Events.EventStatusUpdated', { eventId, newStatus });
    }
    
    // Also update in customEvents
    setCustomEvents(prev => prev.map(ev => 
      ev.id === eventId ? { ...ev, status: newStatus, statusColor: eventStatuses[newStatus as keyof typeof eventStatuses]?.color || 'default' } : ev
    ));
  };

  // Mark event as completed
  const markEventAsCompleted = (event: any): boolean => {
    const today = new Date().toISOString().split('T')[0];
    const eventEndDate = event.departureDate || event.endDate || today;
    const isEndingEarly = eventEndDate > today;
    
    const confirmMessage = isEndingEarly 
      ? `End this event/conference now? The event was scheduled to end on ${new Date(eventEndDate).toLocaleDateString()}, but you're ending it early on ${new Date(today).toLocaleDateString()}. This will finalize the event and move it to Completed Events.`
      : `End this event/conference? This will finalize the event, mark it as completed, and move it to the Completed Events tab for financial tracking.`;
    
    if (confirm(confirmMessage)) {
      // Update the event with completion status and set end date to today if ending early
      const updatedEvent = {
        ...event,
        // Keep business status as-is; use completionStatus + managedEvents to derive lifecycle status
        completionStatus: 'completed' as const,
        // If ending early, update the departure/end date to today
        ...(isEndingEarly ? {
          departureDate: today,
          endDate: today,
          // Recalculate duration based on actual dates
          duration: Math.max(1, Math.ceil((new Date(today).getTime() - new Date(event.arrivalDate || event.startDate || today).getTime()) / (1000 * 60 * 60 * 24)) + 1)
        } : {})
      };
      
      // This will trigger allEvents to recompute, which will then trigger managedEvents to recompute
      setCustomEvents(prev => prev.map(ev => 
        ev.id === event.id ? updatedEvent : ev
      ));
      
      // Auto-create folio if it doesn't exist
      const existingFolio = eventFolios.find(f => f.eventId === event.id);
      if (!existingFolio) {
        const budget = getQuoteBudgetSnapshot(updatedEvent);
        const budgetTotal = budget.total;
        
        // Check if invoice exists to add as initial entry
        const invoice = eventInvoices.find((inv: any) => inv.eventId === event.id);
        const entries: any[] = [];
        
        // If invoice exists, add it as an initial charge entry
        if (invoice && invoice.total > 0) {
          entries.push({
            id: `FLE-${Date.now().toString().slice(-6)}`,
            date: invoice.issueDate || new Date().toISOString().split('T')[0],
            description: `Invoice ${invoice.id} - Event Charges`,
            debit: invoice.total,
            credit: 0,
            balance: invoice.total
          });
        }
        
        const newFolio: EventFolio = {
          id: `FOL-${Date.now().toString().slice(-6)}`,
          eventId: updatedEvent.id,
          eventName: updatedEvent.eventName || 'Unnamed Event',
          clientName: updatedEvent.organization || 'Unknown Client',
          status: 'Open',
          openingBalance: 0,
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          entries: entries
        };
        
        setEventFolios(prev => [...prev, newFolio]);
        trackEvent('Events.EventCreated', { action: 'folio_auto_created', eventId: updatedEvent.id, folioId: newFolio.id });
      }
      
      trackEvent('Events.EventStatusUpdated', { 
        eventId: updatedEvent.id, 
        newStatus: 'completed',
        action: 'event_ended',
        endedEarly: isEndingEarly,
        originalEndDate: eventEndDate,
        actualEndDate: today
      });
      
      console.log(`[Events] Event ${updatedEvent.id} ended/completed on ${today}${isEndingEarly ? ` (originally scheduled for ${eventEndDate})` : ''}`);
      return true;
    }
    return false;
  };

  // Generate Gantt chart data for a specific venue
  const generateGanttData = (venueId: string, rangeStart?: Date, rangeEnd?: Date) => {
    const venueEvents = getEventsForVenue(venueId, rangeStart, rangeEnd);
    
    return venueEvents.map(event => ({
      id: event.id,
      text: `${event.organization} - ${event.eventName}`,
      start: event.arrivalDate,
      end: event.departureDate,
      duration: event.duration,
      status: event.status,
      statusColor: event.statusColor,
      pax: event.pax,
      residential: event.residential,
      revenue: event.revenue,
      salesManager: event.salesManager
    }));
  };

  const sanitizeFilename = (value: string) =>
    (value || 'events').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'events';

  const buildEventExportRows = (eventsToExport: any[]) => eventsToExport.map(event => ({
    eventName: event.eventName,
    organization: event.organization,
    venue: event.venueName || event.venue || 'Unassigned',
    startDate: event.arrivalDate,
    endDate: event.departureDate,
    duration: event.duration,
    pax: event.pax,
    status: eventStatuses[event.status as keyof typeof eventStatuses]?.label || event.status || ''
  }));

  const buildDailyBreakdownRows = (
    eventsToExport: any[],
    includeAccommodation = false,
    rangeStart?: Date,
    rangeEnd?: Date
  ) => {
    const rows: Array<{
      date: string;
      venue: string;
      eventName: string;
      organization: string;
      conferencePax: number;
      accommodationPax?: number;
      status: string;
    }> = [];

    const boundaryStart = rangeStart ? toStartOfDay(rangeStart) : undefined;
    const boundaryEnd = rangeEnd ? toStartOfDay(rangeEnd) : undefined;

    eventsToExport.forEach(event => {
      if (!event?.arrivalDate || !event?.departureDate) return;
      const start = toStartOfDay(new Date(event.arrivalDate));
      const end = toStartOfDay(new Date(event.departureDate));
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

      const dailySchedule = Array.isArray(event.dailySchedule) ? event.dailySchedule : [];
      const scheduleMap = new Map<string, any>();
      dailySchedule.forEach((day: any) => {
        if (day?.date) {
          scheduleMap.set(day.date, day);
        }
      });

      const cursor = new Date(start);
      while (cursor <= end) {
        const currentDate = toStartOfDay(cursor);
        if (boundaryStart && currentDate < boundaryStart) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }
        if (boundaryEnd && currentDate > boundaryEnd) {
          break;
        }

        const key = formatDateKey(currentDate);
        const schedule = scheduleMap.get(key) || {};
        const conferencePax = Number(schedule.conferencePax ?? event.pax ?? 0);
        const accommodationPax = event.residential
          ? Number(schedule.rooms ?? event.pax ?? 0)
          : Number(schedule.rooms ?? 0);

        rows.push({
          date: key,
          venue: event.venueName || event.venue || 'Unassigned',
          eventName: event.eventName,
          organization: event.organization,
          conferencePax,
          accommodationPax: includeAccommodation ? accommodationPax : undefined,
          status: eventStatuses[event.status as keyof typeof eventStatuses]?.label || event.status || ''
        });

        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return rows;
  };

  const aggregateBreakdownByDate = (rows: ReturnType<typeof buildDailyBreakdownRows>) => {
    const map = new Map<string, { conference: number; accommodation: number }>();
    rows.forEach(row => {
      const entry = map.get(row.date) || { conference: 0, accommodation: 0 };
      entry.conference += Number(row.conferencePax || 0);
      entry.accommodation += Number(row.accommodationPax || 0);
      map.set(row.date, entry);
    });
    return map;
  };

  const summarizeBreakdown = (rows: ReturnType<typeof buildDailyBreakdownRows>) => rows.reduce(
    (acc, row) => {
      acc.conference += Number(row.conferencePax || 0);
      acc.accommodation += Number(row.accommodationPax || 0);
      return acc;
    },
    { conference: 0, accommodation: 0 }
  );

  const formatCount = (value: number) => value.toLocaleString();
  const exportEventRowsToCsv = (
    title: string,
    rows: ReturnType<typeof buildEventExportRows>,
    breakdown?: ReturnType<typeof buildDailyBreakdownRows>,
    matrix?: { headers: string[]; averages: Array<{ label: string; values: number[] }>; totals: number[] }
  ) => {
    if (typeof window === 'undefined') return;
    if (!rows.length && !(breakdown?.length) && !matrix) {
      alert('No events available to export.');
      return;
    }

    const sections: string[] = [];

    if (rows.length) {
      const headers = ['Event', 'Organization', 'Venue', 'Start Date', 'End Date', 'Duration (days)', 'Guests', 'Status'];
      const escapeCell = (cell: any) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
      const mainContent = [
        headers.join(','),
        ...rows.map(row => [
          escapeCell(row.eventName),
          escapeCell(row.organization),
          escapeCell(row.venue),
          escapeCell(row.startDate),
          escapeCell(row.endDate),
          escapeCell(row.duration),
          escapeCell(row.pax),
          escapeCell(row.status)
        ].join(','))
      ].join('\n');
      sections.push(mainContent);
    }

    if (breakdown?.length) {
      const includeAccommodation = breakdown.some(row => typeof row.accommodationPax === 'number');
      const headers = [
        'Date',
        'Venue',
        'Event',
        'Organization',
        'Conference Pax',
        ...(includeAccommodation ? ['Accommodation Pax'] : []),
        'Status'
      ];
      const escapeCell = (cell: any) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
      const breakdownContent = [
        '',
        'Daily Conference & Accommodation Breakdown',
        headers.join(','),
        ...breakdown.map(row => {
          const cells = [
            escapeCell(row.date),
            escapeCell(row.venue),
            escapeCell(row.eventName),
            escapeCell(row.organization),
            escapeCell(row.conferencePax)
          ];
          if (includeAccommodation) {
            cells.push(escapeCell(row.accommodationPax ?? 0));
          }
          cells.push(escapeCell(row.status));
          return cells.join(',');
        })
      ].join('\n');
      sections.push(breakdownContent);
    }

    if (matrix) {
      const { headers, averages, totals } = matrix;
      const headerLine = ['', ...headers].join(',');
      const matrixLines = averages.map(row => [
        row.label,
        ...row.values.map(value => value.toString())
      ].join(','));
      const totalLine = ['Total', ...totals.map(value => value.toString())].join(',');
      sections.push('', 'Summary Matrix', headerLine, ...matrixLines, totalLine);
    }

    const csvContent = sections.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `${sanitizeFilename(title)}.csv`;
    const link = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportEventRowsToPdf = (
    title: string,
    subtitle: string,
    rows: ReturnType<typeof buildEventExportRows>,
    breakdown?: ReturnType<typeof buildDailyBreakdownRows>,
    matrix?: { headers: string[]; averages: Array<{ label: string; values: number[] }>; totals: number[] }
  ) => {
    if (typeof window === 'undefined') return;
    if (!rows.length && !(breakdown?.length) && !matrix) {
      alert('No events available to export.');
      return;
    }

    const tableRows = rows.map(row => `
      <tr>
        <td>${row.eventName}</td>
        <td>${row.organization}</td>
        <td>${row.venue}</td>
        <td>${row.startDate}</td>
        <td>${row.endDate}</td>
        <td style="text-align:right;">${row.duration}</td>
        <td style="text-align:right;">${row.pax}</td>
        <td>${row.status}</td>
      </tr>
    `).join('');

    const includeAccommodation = breakdown?.some(row => typeof row.accommodationPax === 'number');
    const breakdownRows = (breakdown || []).map(row => `
      <tr>
        <td>${row.date}</td>
        <td>${row.venue}</td>
        <td>${row.eventName}</td>
        <td>${row.organization}</td>
        <td style="text-align:right;">${row.conferencePax}</td>
        ${includeAccommodation ? `<td style="text-align:right;">${row.accommodationPax ?? 0}</td>` : ''}
        <td>${row.status}</td>
      </tr>
    `).join('');

    const breakdownTable = breakdownRows
      ? `
        <h3>Daily Conference & Accommodation Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Venue</th>
              <th>Event</th>
              <th>Organization</th>
              <th style="text-align:right;">Conference Pax</th>
              ${includeAccommodation ? '<th style="text-align:right;">Accommodation Pax</th>' : ''}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${breakdownRows}
          </tbody>
        </table>
      `
      : '';

    const matrixTable = matrix
      ? `
        <h3>Summary Matrix</h3>
        <table>
          <thead>
            <tr>
              <th></th>
              ${matrix.headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${matrix.averages.map(row => `
              <tr>
                <td>${row.label}</td>
                ${row.values.map(value => `<td>${value}</td>`).join('')}
              </tr>
            `).join('')}
            <tr>
              <td>Total</td>
              ${matrix.totals.map(value => `<td>${value}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      `
      : '';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
            h1 { font-size: 28px; margin-bottom: 4px; }
            h2 { font-size: 16px; color: #6b7280; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
            tfoot td { font-weight: bold; }
            h3 { margin-top: 24px; margin-bottom: 12px; font-size: 16px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <h2>${subtitle}</h2>
          ${rows.length ? `
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Organization</th>
                  <th>Venue</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th style="text-align:right;">Duration</th>
                  <th style="text-align:right;">Guests</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6">Total Events</td>
                  <td colspan="2">${rows.length}</td>
                </tr>
              </tfoot>
            </table>
          ` : '<p>No events available.</p>'}
          ${breakdownTable}
          ${matrixTable}
        </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow pop-ups to export the file.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch (error) {
        console.error('Export print failed', error);
      }
    }, 300);
  };

  const gatherEventsForExport = (scope: 'table' | 'calendar' | 'gantt') => {
    if (scope === 'table') {
      const events = getFilteredAndSortedEvents();
      return {
        title: 'Event Table View',
        subtitle: `${events.length} events (current filters)`,
        events,
        breakdown: undefined,
        matrix: undefined
      };
    }

    if (scope === 'calendar') {
      if (eventCalendarView === 'day') {
        const targetDate = toStartOfDay(eventCalendarDate);
        const events = dayEvents;
        const breakdown = buildDailyBreakdownRows(events, true, targetDate, targetDate);
        return {
          title: `Calendar View – ${eventCalendarDate.toLocaleDateString()}`,
          subtitle: 'Daily schedule',
          events,
          breakdown,
          matrix: undefined
        };
      }

      if (eventCalendarView === 'week') {
        const start = toStartOfDay(calendarWeekRange.start);
        const end = toStartOfDay(calendarWeekRange.end);
        const events = getEventsForDateRange(formatDateKey(start), formatDateKey(end));
        const breakdown = buildDailyBreakdownRows(events, true, start, end);
        return {
          title: `Calendar View – ${weekRangeTitle}`,
          subtitle: `Week of ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
          events,
          breakdown,
          matrix: undefined
        };
      }

      const monthStart = getStartOfMonth(eventCalendarDate);
      const monthEnd = getEndOfMonth(eventCalendarDate);
      const events = getEventsForDateRange(formatDateKey(monthStart), formatDateKey(monthEnd));
      const breakdown = buildDailyBreakdownRows(events, true, monthStart, monthEnd);
      return {
        title: `Calendar View – ${calendarHeaderTitle}`,
        subtitle: `Month of ${calendarHeaderTitle}`,
        events,
        breakdown,
        matrix: undefined
      };
    }

    const startStr = formatDateKey(ganttTimelineStart);
    const endStr = formatDateKey(ganttTimelineEnd);

    if (selectedGanttVenue === 'all') {
      const events = getEventsForDateRange(startStr, endStr);
      const matrixHeaders = Array.from({ length: timelineDayCount }, (_, index) => {
        const date = addDays(ganttTimelineStart, index);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      });
      const conferenceRow = matrixHeaders.map((_, index) => {
        const date = addDays(ganttTimelineStart, index);
        const key = formatDateKey(date);
        const dayEvents = eventsByDay.get(key) || [];
        const totals = summarizeBreakdown(buildDailyBreakdownRows(dayEvents, true, date, date));
        return totals.conference;
      });
      const accommodationRow = matrixHeaders.map((_, index) => {
        const date = addDays(ganttTimelineStart, index);
        const key = formatDateKey(date);
        const dayEvents = eventsByDay.get(key) || [];
        const totals = summarizeBreakdown(buildDailyBreakdownRows(dayEvents, true, date, date));
        return totals.accommodation;
      });
      const totals = matrixHeaders.map((_, index) => conferenceRow[index] + accommodationRow[index]);
      const matrix = {
        headers: matrixHeaders,
        averages: [
          { label: 'Venue Totals', values: totals },
          { label: 'Conference Pax', values: conferenceRow },
          { label: 'Accommodation Pax', values: accommodationRow }
        ],
        totals
      };
      return {
        title: `Gantt View – ${ganttTimelineTitle}`,
        subtitle: `All venues (${ganttTimelineRangeLabel})`,
        events,
        breakdown: buildDailyBreakdownRows(events, true, ganttTimelineStart, ganttTimelineEnd),
        matrix
      };
    }

    const events = getEventsForVenue(selectedGanttVenue, ganttTimelineStart, ganttTimelineEnd);
    const venueName = ganttVenues.find(venue => venue.id === selectedGanttVenue)?.name || 'Selected Venue';
    const matrixHeaders = Array.from({ length: timelineDayCount }, (_, index) => {
      const date = addDays(ganttTimelineStart, index);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    const conferenceRow = matrixHeaders.map((_, index) => {
      const date = addDays(ganttTimelineStart, index);
      const totals = summarizeBreakdown(buildDailyBreakdownRows(events, true, date, date));
      return totals.conference;
    });
    const accommodationRow = matrixHeaders.map((_, index) => {
      const date = addDays(ganttTimelineStart, index);
      const totals = summarizeBreakdown(buildDailyBreakdownRows(events, true, date, date));
      return totals.accommodation;
    });
    const totals = matrixHeaders.map((_, index) => conferenceRow[index] + accommodationRow[index]);
    const matrix = {
      headers: matrixHeaders,
      averages: [
        { label: 'Venue Totals', values: totals },
        { label: 'Conference Pax', values: conferenceRow },
        { label: 'Accommodation Pax', values: accommodationRow }
      ],
      totals
    };
    return {
      title: `Gantt View – ${venueName}`,
      subtitle: `${ganttTimelineRangeLabel}`,
      events,
      breakdown: buildDailyBreakdownRows(events, true, ganttTimelineStart, ganttTimelineEnd),
      matrix
    };
  };
  const exportEventsForView = (scope: 'table' | 'calendar' | 'gantt', format: 'pdf' | 'csv') => {
    const { title, subtitle, events, breakdown, matrix } = gatherEventsForExport(scope);
    const rows = buildEventExportRows(events);
    if (format === 'pdf') {
      exportEventRowsToPdf(title, subtitle, rows, breakdown, matrix);
    } else {
      exportEventRowsToCsv(title, rows, breakdown, matrix);
    }
  };

  // Get calendar view data (monthly/weekly)
  const getCalendarViewData = (year: number, month: number) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    return allEvents.filter(event => {
      const eventStart = new Date(event.arrivalDate);
      const eventEnd = new Date(event.departureDate);
      
      return (eventStart <= endDate && eventEnd >= startDate);
    });
  };
  // Calculate venue utilization for a date range
  const calculateVenueUtilization = (startDate: string, endDate: string) => {
    const events = getEventsForDateRange(startDate, endDate);
    const venueStats: { [key: string]: { totalDays: number, totalRevenue: number, eventCount: number } } = {};
    
    events.forEach(event => {
      if (!venueStats[event.venue]) {
        venueStats[event.venue] = { totalDays: 0, totalRevenue: 0, eventCount: 0 };
      }
      
      venueStats[event.venue].totalDays += event.duration;
      venueStats[event.venue].totalRevenue += event.revenue;
      venueStats[event.venue].eventCount += 1;
    });
    
    return venueStats;
  };

  // Get upcoming events that need attention
  const getUpcomingEventsNeedingAttention = () => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.arrivalDate);
      const isUpcoming = eventDate >= today && eventDate <= thirtyDaysFromNow;
      const needsAttention = event.status === 'awaiting-confirmation' || event.status === 'on-hold';
      
      return isUpcoming && needsAttention;
    });
  };

  // Get events requiring follow-up
  const getEventsRequiringFollowUp = () => {
    const today = new Date();
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.arrivalDate);
      const daysUntilEvent = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Events in next 7 days that are not confirmed
      return daysUntilEvent <= 7 && event.status !== 'confirmed' && event.status !== 'completed';
    });
  };

  // Conference Rate Management Component
  const ConferenceRateManagement = () => {
    const [rateSearchTerm, setRateSearchTerm] = useState('');
    const [rateTypeFilter, setRateTypeFilter] = useState<string>('all');
    const [rateGuestFilter, setRateGuestFilter] = useState<string>('all');
    const [rateGuestSearch, setRateGuestSearch] = useState('');
    const [ratePage, setRatePage] = useState(1);
    const [isRateModalOpen, setIsRateModalOpen] = useState(false);
    const [editingRate, setEditingRate] = useState<any>(null);
    const [rateForm, setRateForm] = useState<any>({
      name: '',
      selectedTypes: [] as string[], // Multiple types can be selected
      rates: {
        accommodation: { rate: 0, unit: 'per_room', label: 'Accommodation' },
        conference: { rate: 0, unit: 'per_person', label: 'Conference' },
        lunch: { rate: 0, unit: 'per_person', label: 'Lunch' },
        dinner: { rate: 0, unit: 'per_person', label: 'Dinner' },
        other: { rate: 0, unit: 'per_person', label: 'Other' }
      },
      applicableDates: {
        startDate: '',
        endDate: '',
        isAllYear: true
      },
      clientSpecific: false,
      clientId: '',
      clientName: '',
      isActive: true,
      notes: ''
    });
    const [rateErrors, setRateErrors] = useState<Record<string, string>>({});
    const rowsPerPage = 10;

    // Use shared conferenceRates state from parent component
    // conferenceRates and setConferenceRates are now in parent scope

    const filteredRates = useMemo(() => {
      let filtered = conferenceRates;

      if (rateSearchTerm) {
        const term = rateSearchTerm.toLowerCase();
        filtered = filtered.filter(rate =>
          rate.name.toLowerCase().includes(term) ||
          rate.type.toLowerCase().includes(term) ||
          (rate.clientName && rate.clientName.toLowerCase().includes(term)) ||
          rate.notes.toLowerCase().includes(term)
        );
      }

      if (rateTypeFilter !== 'all') {
        filtered = filtered.filter(rate => rate.type === rateTypeFilter);
      }

      if (rateGuestFilter !== 'all') {
        if (rateGuestFilter === 'general') {
          // Show only general rates (not client-specific)
          filtered = filtered.filter(rate => !rate.clientSpecific);
        } else {
          // Show only rates for the selected guest/company
          filtered = filtered.filter(rate => rate.clientId === rateGuestFilter);
        }
      }

      return filtered;
    }, [conferenceRates, rateSearchTerm, rateTypeFilter, rateGuestFilter]);

    const paginatedRates = useMemo(() => {
      const start = (ratePage - 1) * rowsPerPage;
      return filteredRates.slice(start, start + rowsPerPage);
    }, [filteredRates, ratePage, rowsPerPage]);

    const ratePages = useMemo(() => {
      return Math.ceil(filteredRates.length / rowsPerPage);
    }, [filteredRates, rowsPerPage]);

    useEffect(() => {
      setRatePage(1);
    }, [rateSearchTerm, rateTypeFilter, rateGuestFilter]);

    const openRateModal = (mode: 'create' | 'edit', rate?: any) => {
      if (mode === 'edit' && rate) {
        setEditingRate(rate);
        // For editing, show single rate (backward compatible)
        const selectedTypes = [rate.type];
        const rates = {
          accommodation: { rate: 0, unit: 'per_room', label: 'Accommodation' },
          conference: { rate: 0, unit: 'per_person', label: 'Conference' },
          lunch: { rate: 0, unit: 'per_person', label: 'Lunch' },
          dinner: { rate: 0, unit: 'per_person', label: 'Dinner' },
          other: { rate: 0, unit: 'per_person', label: 'Other' }
        };
        // Extract label from rate - use customLabel if available, otherwise extract from name
        const defaultLabels: Record<string, string> = {
          accommodation: 'Accommodation',
          conference: 'Conference',
          lunch: 'Lunch',
          dinner: 'Dinner',
          other: 'Other'
        };
        let rateLabel = defaultLabels[rate.type];
        if (rate.customLabel) {
          rateLabel = rate.customLabel;
        } else if (rate.name) {
          // Try to extract label from name (remove client name prefix and "Rate" suffix)
          const nameWithoutRate = rate.name.replace(/Rate$/i, '').trim();
          const clientPrefix = rate.clientName ? `${rate.clientName} - ` : '';
          if (nameWithoutRate.startsWith(clientPrefix)) {
            rateLabel = nameWithoutRate.substring(clientPrefix.length).trim();
          } else {
            rateLabel = nameWithoutRate;
          }
          // If extracted label is just the default, keep default
          if (rateLabel === defaultLabels[rate.type] || rateLabel === rate.type) {
            rateLabel = defaultLabels[rate.type];
          }
        }
        rates[rate.type as keyof typeof rates] = { 
          rate: rate.baseRate, 
          unit: rate.unit, 
          label: rateLabel 
        };
        
        setRateForm({
          name: rate.name,
          selectedTypes,
          rates,
          applicableDates: rate.applicableDates,
          clientSpecific: rate.clientSpecific,
          clientId: rate.clientId || '',
          clientName: rate.clientName || '',
          isActive: rate.isActive,
          notes: rate.notes || ''
        });
      } else {
        setEditingRate(null);
        setRateForm({
          name: '',
          selectedTypes: [],
          rates: {
            accommodation: { rate: 0, unit: 'per_room', label: 'Accommodation' },
            conference: { rate: 0, unit: 'per_person', label: 'Conference' },
            lunch: { rate: 0, unit: 'per_person', label: 'Lunch' },
            dinner: { rate: 0, unit: 'per_person', label: 'Dinner' },
            other: { rate: 0, unit: 'per_person', label: 'Other' }
          },
          applicableDates: {
            startDate: '',
            endDate: '',
            isAllYear: true
          },
          clientSpecific: false,
          clientId: '',
          clientName: '',
          isActive: true,
          notes: ''
        });
      }
      setRateErrors({});
      setIsRateModalOpen(true);
    };

    const validateRateForm = () => {
      const errors: Record<string, string> = {};
      if (rateForm.selectedTypes.length === 0) {
        errors.selectedTypes = 'Please select at least one rate type';
      }
      if (rateForm.clientSpecific && !rateForm.clientName && !rateForm.clientId) {
        errors.clientId = 'Guest/Company must be selected or entered for client-specific rates';
      }
      if (!rateForm.applicableDates.isAllYear) {
        if (!rateForm.applicableDates.startDate) errors.startDate = 'Start date is required';
        if (!rateForm.applicableDates.endDate) errors.endDate = 'End date is required';
        if (rateForm.applicableDates.startDate && rateForm.applicableDates.endDate && 
            new Date(rateForm.applicableDates.startDate) > new Date(rateForm.applicableDates.endDate)) {
          errors.endDate = 'End date must be after start date';
        }
      }
      // Validate that each selected type has a rate > 0
      rateForm.selectedTypes.forEach((type: string) => {
        const rateValue = rateForm.rates[type as keyof typeof rateForm.rates]?.rate || 0;
        if (!rateValue || rateValue <= 0) {
          errors[`rate_${type}`] = `${type.charAt(0).toUpperCase() + type.slice(1)} rate must be greater than 0`;
        }
      });
      setRateErrors(errors);
      return Object.keys(errors).length === 0;
    };

    const handleSaveRate = () => {
      if (!validateRateForm()) return;

      // If client-specific, ensure clientName is set
      const finalClientName = rateForm.clientSpecific 
        ? (rateForm.clientName || (rateForm.clientId ? availableClients.find(c => c.id === rateForm.clientId)?.name : ''))
        : '';

      const baseTimestamp = editingRate ? editingRate.id : Date.now();

      if (editingRate) {
        // Editing mode: update single rate
        const firstType = rateForm.selectedTypes[0];
        const firstTypeRate = rateForm.rates[firstType as keyof typeof rateForm.rates];
        const customLabel = firstTypeRate?.label || firstType;
        const rateData = {
          id: editingRate.id,
          name: rateForm.name.trim() || `${finalClientName ? `${finalClientName} - ` : ''}${customLabel} Rate`,
          type: firstType,
          baseRate: parseFloat(firstTypeRate?.rate || 0),
          unit: firstTypeRate?.unit || 'per_person',
          customLabel: customLabel, // Store custom label
          applicableDates: rateForm.applicableDates,
          clientSpecific: rateForm.clientSpecific,
          clientId: rateForm.clientId || '',
          clientName: finalClientName,
          isActive: rateForm.isActive,
          notes: rateForm.notes.trim(),
          createdAt: editingRate.createdAt,
          updatedAt: new Date().toISOString().split('T')[0]
        };
        setConferenceRates(prev => prev.map(r => r.id === editingRate.id ? rateData : r));
        trackEvent('Analytics.ActionClicked', { action: 'ConferenceRateUpdated', rateId: rateData.id });
      } else {
        // Create mode: create multiple rates if multiple types selected
        const typeLabels: Record<string, string> = {
          accommodation: 'Accommodation',
          conference: 'Conference',
          lunch: 'Lunch',
          dinner: 'Dinner',
          other: 'Other'
        };
        const newRates = rateForm.selectedTypes.map((type: string, index: number) => {
          const typeRate = rateForm.rates[type as keyof typeof rateForm.rates];
          const customLabel = typeRate?.label || typeLabels[type];
          return {
            id: `rate-${baseTimestamp}-${index}`,
            name: rateForm.name.trim() || `${finalClientName ? `${finalClientName} - ` : ''}${customLabel} Rate`,
            type: type,
            baseRate: parseFloat(typeRate?.rate || 0),
            unit: typeRate?.unit || (type === 'accommodation' ? 'per_room' : 'per_person'),
            customLabel: customLabel, // Store custom label
            applicableDates: rateForm.applicableDates,
            clientSpecific: rateForm.clientSpecific,
            clientId: rateForm.clientId || '',
            clientName: finalClientName,
            isActive: rateForm.isActive,
            notes: rateForm.notes.trim(),
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0]
          };
        });
        setConferenceRates(prev => [...newRates, ...prev]);
        newRates.forEach((rate: any) => {
          trackEvent('Analytics.ActionClicked', { action: 'ConferenceRateCreated', rateId: rate.id });
        });
      }

      setIsRateModalOpen(false);
      setEditingRate(null);
    };

    const handleDeleteRate = (rateId: string) => {
      if (confirm('Are you sure you want to delete this rate?')) {
        setConferenceRates(prev => prev.filter(r => r.id !== rateId));
        trackEvent('Analytics.ActionClicked', { action: 'ConferenceRateDeleted', rateId });
      }
    };

    const getRateTypeLabel = (rate: any) => {
      // If rate is a string (backward compatibility), treat it as type
      if (typeof rate === 'string') {
        const labels: Record<string, string> = {
          accommodation: '🏨 Accommodation',
          conference: '📅 Conference',
          lunch: '🍽️ Lunch',
          dinner: '🍴 Dinner',
          other: '📋 Other'
        };
        return labels[rate] || rate;
      }
      
      // Use customLabel if available, otherwise use default label
      if (rate.customLabel && rate.customLabel !== rate.type) {
        const icons: Record<string, string> = {
          accommodation: '🏨',
          conference: '📅',
          lunch: '🍽️',
          dinner: '🍴',
          other: '📋'
        };
        return `${icons[rate.type] || ''} ${rate.customLabel}`;
      }
      
      const labels: Record<string, string> = {
        accommodation: '🏨 Accommodation',
        conference: '📅 Conference',
        lunch: '🍽️ Lunch',
        dinner: '🍴 Dinner',
        other: '📋 Other'
      };
      return labels[rate.type] || rate.type;
    };

    const getUnitLabel = (unit: string) => {
      const labels: Record<string, string> = {
        per_person: 'Per Person',
        per_room: 'Per Room',
        per_event: 'Per Event',
        per_day: 'Per Day'
      };
      return labels[unit] || unit;
    };

    // Get available clients for client-specific rates (same logic as events form)
    const availableClients = useMemo(() => {
      const guests = frontOfficeGuests || [];
      const clientMap = new Map();
      
      guests.forEach((g: any) => {
        const org = g.employerCompany || (g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim());
        if (org && !clientMap.has(org)) {
          clientMap.set(org, {
            id: g.id,
            name: org,
            guest: g
          });
        }
      });
      
      return Array.from(clientMap.values());
    }, [frontOfficeGuests]);

    // Get unique guest/company list for filter dropdown
    const availableGuestsForFilter = useMemo(() => {
      const guests = frontOfficeGuests || [];
      const guestMap = new Map();
      
      // Add "General Rates" option
      guestMap.set('general', { id: 'general', name: 'General Rates (All Clients)' });
      
      guests.forEach((g: any) => {
        const org = g.employerCompany || (g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim());
        if (org && !guestMap.has(org)) {
          guestMap.set(org, {
            id: g.id,
            name: org
          });
        }
      });
      
      return Array.from(guestMap.values());
    }, [frontOfficeGuests]);

    return (
      <div className="space-y-6 mt-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-ghana-black">Conference Rate Management</h3>
            <p className="text-sm text-gray-600 mt-1">Manage rates for accommodation, conference, meals, and other services</p>
          </div>
          <Button
            color="primary"
            onPress={() => openRateModal('create')}
          >
            ➕ New Rate
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardBody className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="Search rates by name, type, or client..."
                value={rateSearchTerm}
                onChange={(e) => setRateSearchTerm(e.target.value)}
                className="flex-1"
                startContent={<span className="text-gray-400">🔍</span>}
              />
              <Select
                placeholder="Filter by type"
                selectedKeys={rateTypeFilter !== 'all' ? [rateTypeFilter] : []}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  setRateTypeFilter(value || 'all');
                }}
                className="w-full sm:w-48"
              >
                <SelectItem key="all">All Types</SelectItem>
                <SelectItem key="accommodation">🏨 Accommodation</SelectItem>
                <SelectItem key="conference">📅 Conference</SelectItem>
                <SelectItem key="lunch">🍽️ Lunch</SelectItem>
                <SelectItem key="dinner">🍴 Dinner</SelectItem>
                <SelectItem key="other">📋 Other</SelectItem>
              </Select>
              <Autocomplete
                label="Filter by Guest/Company"
                placeholder="Type at least 2 characters to search..."
                selectedKey={rateGuestFilter !== 'all' ? rateGuestFilter : null}
                onSelectionChange={(key) => {
                  setRateGuestFilter(key as string || 'all');
                }}
                inputValue={rateGuestSearch}
                onInputChange={(value) => {
                  setRateGuestSearch(value);
                  if (!value) {
                    setRateGuestFilter('all');
                  }
                }}
                className="flex-1"
                allowsCustomValue
              >
                {(() => {
                  const q = (rateGuestSearch || '').trim();
                  const guests = frontOfficeGuests || [];
                  const results = q.length >= 2
                    ? guests.filter((g: any) => {
                        const org = (g.employerCompany || '').toLowerCase();
                        const name = (g.name || `${g.firstName || ''} ${g.lastName || ''}`).toLowerCase();
                        const phone = (g.companyPhone || g.phone || '').toLowerCase();
                        return org.includes(q.toLowerCase()) || name.includes(q.toLowerCase()) || phone.includes(q.toLowerCase());
                      }).slice(0, 20)
                    : [];
                  
                  const filterOptions = [];
                  
                  // Add "All Rates" option
                  if (q.length < 2) {
                    filterOptions.push(
                      <AutocompleteItem key="all" textValue="All Rates">
                        <div className="flex items-center gap-2">
                          <span>📋</span>
                          <span>All Rates</span>
                        </div>
                      </AutocompleteItem>
                    );
                  }
                  
                  // Add "General Rates" option
                  if (q.length < 2 || 'general'.includes(q.toLowerCase()) || 'all clients'.includes(q.toLowerCase())) {
                    filterOptions.push(
                      <AutocompleteItem key="general" textValue="General Rates">
                        <div className="flex items-center gap-2">
                          <span>🌐</span>
                          <span>General Rates (All Clients)</span>
                        </div>
                      </AutocompleteItem>
                    );
                  }
                  
                  // Add custom option if typing
                  if (q.length >= 2) {
                    filterOptions.push(
                      <AutocompleteItem key={`custom:${q}`} textValue={q}>
                        <div className="flex justify-between items-center w-full">
                          <span className="font-medium">Use "{q}"</span>
                          <span className="text-xs text-gray-500">Click to confirm</span>
                        </div>
                      </AutocompleteItem>
                    );
                  }
                  
                  // Add matching guests/companies
                  if (q.length >= 2) {
                    results.forEach((g: any) => {
                      const org = g.employerCompany || (g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim());
                      const person = g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim();
                      filterOptions.push(
                        <AutocompleteItem key={g.id} textValue={`${org} ${person}`}>
                          <div className="flex flex-col">
                            <span className="font-medium">{org}</span>
                            <span className="text-xs text-gray-600">{person} • {(g.companyPhone || g.phone || '')}</span>
                          </div>
                        </AutocompleteItem>
                      );
                    });
                  }
                  
                  return filterOptions.length > 0 ? filterOptions : null;
                })()}
              </Autocomplete>
              {rateGuestFilter !== 'all' && (
                <Button
                  size="lg"
                  variant="flat"
                  color="default"
                  onPress={() => {
                    setRateGuestFilter('all');
                    setRateGuestSearch('');
                  }}
                  className="self-end"
                >
                  Clear Filter
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Rates Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-lg font-semibold">Rate List</h3>
              <Badge content={filteredRates.length} color="primary" variant="flat">
                <span className="text-sm text-gray-600">Total Rates</span>
              </Badge>
            </div>
          </CardHeader>
          <CardBody>
            <Table aria-label="Conference rates table">
              <TableHeader>
                <TableColumn>RATE NAME</TableColumn>
                <TableColumn>TYPE</TableColumn>
                <TableColumn>RATE</TableColumn>
                <TableColumn>UNIT</TableColumn>
                <TableColumn>APPLICABLE DATES</TableColumn>
                <TableColumn>CLIENT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {paginatedRates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      <div>
                        <span className="text-4xl">💰</span>
                        <p className="mt-2">No rates found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRates.map((rate: any) => (
                    <TableRow key={rate.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rate.name}</p>
                          {rate.notes && (
                            <p className="text-xs text-gray-500 mt-1">{rate.notes}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color="secondary" variant="flat">{getRateTypeLabel(rate)}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(rate.baseRate)}</TableCell>
                      <TableCell className="text-sm text-gray-600">{getUnitLabel(rate.unit)}</TableCell>
                      <TableCell>
                        {rate.applicableDates.isAllYear ? (
                          <span className="text-sm">All Year</span>
                        ) : (
                          <div className="text-sm">
                            <p>{new Date(rate.applicableDates.startDate).toLocaleDateString()}</p>
                            <p className="text-gray-500">to {new Date(rate.applicableDates.endDate).toLocaleDateString()}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {rate.clientSpecific ? (
                          <Badge color="primary" variant="flat" size="sm">{rate.clientName || 'N/A'}</Badge>
                        ) : (
                          <span className="text-sm text-gray-400">All Clients</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip color={rate.isActive ? 'success' : 'default'} size="sm" variant="flat">
                          {rate.isActive ? 'Active' : 'Inactive'}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onPress={() => openRateModal('edit', rate)}
                          >
                            ✏️ Edit
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            onPress={() => handleDeleteRate(rate.id)}
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {ratePages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination
                  total={ratePages}
                  page={ratePage}
                  onChange={setRatePage}
                  color="primary"
                  showControls
                />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Rate Modal */}
        <Modal
          isOpen={isRateModalOpen}
          onClose={() => {
            setIsRateModalOpen(false);
            setEditingRate(null);
            setRateErrors({});
          }}
          size="2xl"
          scrollBehavior="inside"
        >
          <ModalContent>
            <ModalHeader>
              <h3 className="text-lg font-semibold">
                {editingRate ? 'Edit Rate' : 'Create New Rate'}
              </h3>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                {/* Rate Name (Optional - will auto-generate if not provided) */}
                <Input
                  label="Rate Name (Optional)"
                  placeholder="e.g., Agrivest Co Rates (leave blank to auto-generate)"
                  value={rateForm.name}
                  onValueChange={(value) => setRateForm({ ...rateForm, name: value })}
                  description="If left blank, names will be auto-generated based on client and rate type"
                />

                {/* Rate Types - Multiple Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Rate Types *</label>
                  <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg">
                    {[
                      { key: 'accommodation', label: '🏨 Accommodation', defaultUnit: 'per_room' },
                      { key: 'conference', label: '📅 Conference', defaultUnit: 'per_person' },
                      { key: 'lunch', label: '🍽️ Lunch', defaultUnit: 'per_person' },
                      { key: 'dinner', label: '🍴 Dinner', defaultUnit: 'per_person' },
                      { key: 'other', label: '📋 Other', defaultUnit: 'per_person' }
                    ].map((type) => (
                      <div key={type.key} className="space-y-2">
                        <Switch
                          isSelected={rateForm.selectedTypes.includes(type.key)}
                          onValueChange={(checked) => {
                            const newTypes = checked
                              ? [...rateForm.selectedTypes, type.key]
                              : rateForm.selectedTypes.filter((t: string) => t !== type.key);
                            setRateForm({ ...rateForm, selectedTypes: newTypes });
                          }}
                        >
                          <span className="text-sm">{type.label}</span>
                        </Switch>
                        {rateForm.selectedTypes.includes(type.key) && (
                          <div className="ml-6 space-y-2">
                            <Input
                              size="sm"
                              label="Custom Label *"
                              placeholder={(() => {
                                const placeholders: Record<string, string> = {
                                  accommodation: 'e.g., Accommodation & Breakfast, Standard Accommodation, Deluxe Room',
                                  conference: 'e.g., Conference with 1 Snack, Conference with 2 Snacks, Full Conference Package',
                                  lunch: 'e.g., Lunch, Buffet Lunch, Set Lunch Menu',
                                  dinner: 'e.g., Dinner, Buffet Dinner, Set Dinner Menu',
                                  other: 'e.g., Tea Break, Coffee Break, Snacks'
                                };
                                return placeholders[type.key] || `e.g., ${type.label.replace(/^[^\s]+\s/, '')}`;
                              })()}
                              value={rateForm.rates[type.key as keyof typeof rateForm.rates]?.label || ''}
                              onValueChange={(value) => {
                                const defaultLabels: Record<string, string> = {
                                  accommodation: 'Accommodation',
                                  conference: 'Conference',
                                  lunch: 'Lunch',
                                  dinner: 'Dinner',
                                  other: 'Other'
                                };
                                setRateForm({
                                  ...rateForm,
                                  rates: {
                                    ...rateForm.rates,
                                    [type.key]: {
                                      ...rateForm.rates[type.key as keyof typeof rateForm.rates],
                                      label: value.trim() || defaultLabels[type.key] || type.label.replace(/^[^\s]+\s/, '')
                                    }
                                  }
                                });
                              }}
                              description="Customize how this rate will be labeled. Leave blank to use default label."
                            />
                            <Input
                              size="sm"
                              type="number"
                              label="Rate (₵)"
                              placeholder="0.00"
                              value={rateForm.rates[type.key as keyof typeof rateForm.rates]?.rate?.toString() || '0'}
                              onValueChange={(value) => {
                                setRateForm({
                                  ...rateForm,
                                  rates: {
                                    ...rateForm.rates,
                                    [type.key]: {
                                      ...rateForm.rates[type.key as keyof typeof rateForm.rates],
                                      rate: parseFloat(value) || 0
                                    }
                                  }
                                });
                              }}
                              isInvalid={!!rateErrors[`rate_${type.key}`]}
                              errorMessage={rateErrors[`rate_${type.key}`]}
                              startContent={<span className="text-xs text-gray-400">₵</span>}
                            />
                            <Select
                              size="sm"
                              label="Unit"
                              selectedKeys={[rateForm.rates[type.key as keyof typeof rateForm.rates]?.unit || type.defaultUnit]}
                              onSelectionChange={(keys) => {
                                const unit = Array.from(keys)[0] as string;
                                setRateForm({
                                  ...rateForm,
                                  rates: {
                                    ...rateForm.rates,
                                    [type.key]: {
                                      ...rateForm.rates[type.key as keyof typeof rateForm.rates],
                                      unit: unit
                                    }
                                  }
                                });
                              }}
                            >
                              <SelectItem key="per_person">Per Person</SelectItem>
                              <SelectItem key="per_room">Per Room</SelectItem>
                              <SelectItem key="per_event">Per Event</SelectItem>
                              <SelectItem key="per_day">Per Day</SelectItem>
                            </Select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {rateErrors.selectedTypes && (
                    <p className="text-sm text-danger">{rateErrors.selectedTypes}</p>
                  )}
                </div>

                {/* Applicable Dates */}
                <div className="space-y-2">
                  <Switch
                    isSelected={rateForm.applicableDates.isAllYear}
                    onValueChange={(checked) => {
                      setRateForm({
                        ...rateForm,
                        applicableDates: {
                          ...rateForm.applicableDates,
                          isAllYear: checked,
                          startDate: checked ? '' : rateForm.applicableDates.startDate,
                          endDate: checked ? '' : rateForm.applicableDates.endDate
                        }
                      });
                    }}
                  >
                    <span className="font-medium">Apply to All Year</span>
                  </Switch>
                  {!rateForm.applicableDates.isAllYear && (
                    <div className="grid grid-cols-2 gap-4 ml-6">
                      <Input
                        label="Start Date"
                        type="date"
                        value={rateForm.applicableDates.startDate}
                        onValueChange={(value) => {
                          setRateForm({
                            ...rateForm,
                            applicableDates: { ...rateForm.applicableDates, startDate: value }
                          });
                        }}
                        isInvalid={!!rateErrors.startDate}
                        errorMessage={rateErrors.startDate}
                      />
                      <Input
                        label="End Date"
                        type="date"
                        value={rateForm.applicableDates.endDate}
                        onValueChange={(value) => {
                          setRateForm({
                            ...rateForm,
                            applicableDates: { ...rateForm.applicableDates, endDate: value }
                          });
                        }}
                        isInvalid={!!rateErrors.endDate}
                        errorMessage={rateErrors.endDate}
                      />
                    </div>
                  )}
                </div>

                {/* Client-Specific Rate */}
                <div className="space-y-2">
                  <Switch
                    isSelected={rateForm.clientSpecific}
                    onValueChange={(checked) => {
                      setRateForm({
                        ...rateForm,
                        clientSpecific: checked,
                        clientId: checked ? rateForm.clientId : '',
                        clientName: checked ? rateForm.clientName : ''
                      });
                    }}
                  >
                    <span className="font-medium">Client-Specific Rate</span>
                  </Switch>
                  {rateForm.clientSpecific && (
                    <Autocomplete
                      label="Select Guest/Company"
                      placeholder="Type at least 2 characters to search..."
                      selectedKey={rateForm.clientId || null}
                      onSelectionChange={(key) => {
                        if (key && typeof key === 'string') {
                          if (key.startsWith('custom:')) {
                            const customName = key.replace('custom:', '');
                            setRateForm({
                              ...rateForm,
                              clientId: '',
                              clientName: customName
                            });
                          } else {
                            const g = frontOfficeGuests.find((c: any) => c.id === key);
                            if (g) {
                              const org = g.employerCompany || (g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim());
                              setRateForm({
                                ...rateForm,
                                clientId: g.id,
                                clientName: org
                              });
                            }
                          }
                        }
                      }}
                      inputValue={rateForm.clientName}
                      onInputChange={(value) => {
                        setRateForm({ ...rateForm, clientName: value, clientId: '' });
                      }}
                      isInvalid={!!rateErrors.clientId}
                      errorMessage={rateErrors.clientId}
                      className="ml-6"
                      allowsCustomValue
                    >
                      {(() => {
                        const q = (rateForm.clientName || '').trim();
                        const guests = frontOfficeGuests || [];
                        const results = q.length >= 2
                          ? guests.filter((g: any) => {
                              const org = (g.employerCompany || '').toLowerCase();
                              const name = (g.name || `${g.firstName || ''} ${g.lastName || ''}`).toLowerCase();
                              const phone = (g.companyPhone || g.phone || '').toLowerCase();
                              return org.includes(q.toLowerCase()) || name.includes(q.toLowerCase()) || phone.includes(q.toLowerCase());
                            }).slice(0, 20)
                          : [];
                        return q.length >= 2 ? (
                          <>
                            <AutocompleteItem key={`custom:${q}`} textValue={q}>
                              <div className="flex justify-between items-center w-full">
                                <span className="font-medium">Use "{q}"</span>
                                <span className="text-xs text-gray-500">Click to confirm</span>
                              </div>
                            </AutocompleteItem>
                            {results.map((g: any) => {
                              const org = g.employerCompany || (g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim());
                              const person = g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim();
                              return (
                                <AutocompleteItem key={g.id} textValue={`${org} ${person}`}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{org}</span>
                                    <span className="text-xs text-gray-600">{person} • {(g.companyPhone || g.phone || '')}</span>
                                  </div>
                                </AutocompleteItem>
                              );
                            })}
                          </>
                        ) : null;
                      })()}
                    </Autocomplete>
                  )}
                </div>

                {/* Active Status */}
                <Switch
                  isSelected={rateForm.isActive}
                  onValueChange={(checked) => setRateForm({ ...rateForm, isActive: checked })}
                >
                  <span className="font-medium">Active</span>
                </Switch>

                {/* Notes */}
                <Textarea
                  label="Notes"
                  placeholder="Additional notes about this rate..."
                  value={rateForm.notes}
                  onValueChange={(value) => setRateForm({ ...rateForm, notes: value })}
                  minRows={3}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                onPress={() => {
                  setIsRateModalOpen(false);
                  setEditingRate(null);
                  setRateErrors({});
                }}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSaveRate}
              >
                {editingRate 
                  ? 'Update Rate' 
                  : rateForm.selectedTypes.length > 1 
                    ? `Create ${rateForm.selectedTypes.length} Rates` 
                    : 'Create Rate'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    );
  };

  // Event Management Component
  const EventManagementTab = () => {
    const [managementSearchTerm, setManagementSearchTerm] = useState('');
    const [managementStatusFilter, setManagementStatusFilter] = useState<string>('all');
    const [managementViewMode, setManagementViewMode] = useState<'table' | 'calendar' | 'gantt' | 'function'>('table');
    const [managementInvoiceSearch, setManagementInvoiceSearch] = useState('');
    const [managementReceiptSearch, setManagementReceiptSearch] = useState('');
    const [managementQuoteSearch, setManagementQuoteSearch] = useState('');
    const [managementFolioSearch, setManagementFolioSearch] = useState('');
    const [eventMasterSort, setEventMasterSort] = useState<TableSortState>({ column: 'eventName', direction: 'asc' });
    const [activeEventsSort, setActiveEventsSort] = useState<TableSortState>({ column: 'eventName', direction: 'asc' });
    const [completedEventsSort, setCompletedEventsSort] = useState<TableSortState>({ column: 'eventName', direction: 'asc' });
    const [invoiceSort, setInvoiceSort] = useState<TableSortState>({ column: 'issueDate', direction: 'desc' });
    const [receiptSort, setReceiptSort] = useState<TableSortState>({ column: 'date', direction: 'desc' });
    const [quoteSort, setQuoteSort] = useState<TableSortState>({ column: 'issuedOn', direction: 'desc' });
    const [folioSort, setFolioSort] = useState<TableSortState>({ column: 'updatedAt', direction: 'desc' });
    const renderSortableHeader = (
      label: string,
      columnKey: string,
      sortState: TableSortState,
      onSort: (column: string) => void
    ) => (
      <button
        type="button"
        className="group flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 focus:outline-none"
        onClick={() => onSort(columnKey)}
      >
        <span>{label}</span>
        <span className="text-[10px] text-gray-400 transition-colors group-hover:text-gray-600">
          {sortState.column === columnKey ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    );
    const handleEventMasterSort = (column: string) => {
      setEventMasterSort(prev => getNextSortState(prev, column));
    };
    const handleActiveEventsSort = (column: string) => {
      setActiveEventsSort(prev => getNextSortState(prev, column));
    };
    const handleCompletedEventsSort = (column: string) => {
      setCompletedEventsSort(prev => getNextSortState(prev, column));
    };
    const handleInvoiceSort = (column: string) => {
      setInvoiceSort(prev => getNextSortState(prev, column));
    };
    const handleReceiptSort = (column: string) => {
      setReceiptSort(prev => getNextSortState(prev, column));
    };
    const handleQuoteSort = (column: string) => {
      setQuoteSort(prev => getNextSortState(prev, column));
    };
    const handleFolioSort = (column: string) => {
      setFolioSort(prev => getNextSortState(prev, column));
    };
    
    // Pagination state
    const [activeEventsPage, setActiveEventsPage] = useState(1);
    const [completedEventsPage, setCompletedEventsPage] = useState(1);
    const [invoicesPage, setInvoicesPage] = useState(1);
    const [receiptsPage, setReceiptsPage] = useState(1);
    const [quotesPage, setQuotesPage] = useState(1);
    const [foliosPage, setFoliosPage] = useState(1);
    const rowsPerPage = 10;

    // Gantt chart state
    const [managementGanttReferenceDate, setManagementGanttReferenceDate] = useState<Date>(() => new Date());
    const [managementSelectedGanttVenue, setManagementSelectedGanttVenue] = useState<string>('all');
    const [hoveredGanttEventId, setHoveredGanttEventId] = useState<string | null>(null);

    const managedEvents = reportingEvents;

    useEffect(() => {
      if (
        managementSelectedGanttVenue !== 'all' &&
        managementSelectedGanttVenue !== 'unassigned' &&
        !modernVenues.some(venue => venue.id === managementSelectedGanttVenue)
      ) {
        setManagementSelectedGanttVenue('all');
      }
    }, [managementSelectedGanttVenue, modernVenues]);

    const filteredManagedEvents = useMemo(() => {
      let filtered = managedEvents;

      if (managementMainTab === 'active') {
        // Active events: confirmed or in-progress
        filtered = filtered.filter((e: any) => e.eventStatus === 'confirmed' || e.eventStatus === 'in-progress');
      } else if (managementMainTab === 'completed') {
        // Completed events: completed or billed
        filtered = filtered.filter((e: any) => e.eventStatus === 'completed' || e.eventStatus === 'billed');
      }

      if (managementSearchTerm) {
        const term = managementSearchTerm.toLowerCase();
        filtered = filtered.filter((e: any) => 
          (e.eventName || '').toLowerCase().includes(term) ||
          (e.organization || '').toLowerCase().includes(term) ||
          (e.venueName || '').toLowerCase().includes(term)
        );
      }

      if (managementStatusFilter !== 'all') {
        filtered = filtered.filter((e: any) => e.eventStatus === managementStatusFilter);
      }

      return filtered;
    }, [managedEvents, managementSearchTerm, managementStatusFilter, managementMainTab]);

    const eventStatusBuckets = useMemo(
      () =>
        managedEvents.reduce(
          (acc: Record<SimpleEventStatus | 'total', number>, event: any) => {
            const normalized = normalizeStatus(event.status || event.eventStatus);
            acc.total += 1;
            acc[normalized] = (acc[normalized] || 0) + 1;
            return acc;
          },
          { total: 0, quote: 0, confirmed: 0, invoiced: 0, cancelled: 0 }
        ),
      [managedEvents]
    );

    const pipelineAmounts = useMemo(
      () =>
        managedEvents.reduce(
          (acc, event: any) => {
            const normalized = normalizeStatus(event.status || event.eventStatus);
            const value = Number(event.revenue || event.budgetTotal || 0) || 0;
            acc.total += value;
            if (normalized === 'quote') acc.quote += value;
            if (normalized === 'confirmed') acc.confirmed += value;
            if (normalized === 'invoiced') acc.invoiced += value;
            return acc;
          },
          { total: 0, quote: 0, confirmed: 0, invoiced: 0 }
        ),
      [managedEvents]
    );


    // When a new invoice is created, jump to the Invoices tab in Event Management
    useEffect(() => {
      if (!lastCreatedInvoiceId) return;

      try {
        // Switch the inner management tabs to Invoices
        setManagementMainTab('invoices');
        setManagementInvoiceSearch('');
        setInvoicesPage(1);
      } catch (error) {
        console.error('Error switching to Invoices tab after invoice creation:', error);
      } finally {
        // Clear the hint so this only runs once per invoice creation
        setLastCreatedInvoiceId(null);
      }
    }, [lastCreatedInvoiceId]);

    // Gantt chart computed values (after managedEvents is defined)
    const managementGanttTimelineStart = useMemo(() => getStartOfMonth(managementGanttReferenceDate), [managementGanttReferenceDate]);
    const managementGanttTimelineEnd = useMemo(() => getEndOfMonth(managementGanttReferenceDate), [managementGanttReferenceDate]);
    const managementGanttTimelineTitle = useMemo(() => {
      return managementGanttReferenceDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }, [managementGanttReferenceDate]);
    const managementGanttTimelineRangeLabel = `${formatDateKey(managementGanttTimelineStart)} → ${formatDateKey(managementGanttTimelineEnd)}`;
    const managementTimelineDayCount = Math.max(1, Math.round((toStartOfDay(managementGanttTimelineEnd).getTime() - toStartOfDay(managementGanttTimelineStart).getTime()) / DAY_IN_MS) + 1);
    const managementTimelineDays = useMemo(() => Array.from({ length: managementTimelineDayCount }, (_, index) => addDays(managementGanttTimelineStart, index)), [managementGanttTimelineStart, managementTimelineDayCount]);
    const managementGanttMonthInputValue = `${managementGanttReferenceDate.getFullYear()}-${padNumber(managementGanttReferenceDate.getMonth() + 1)}`;

    // Get venues from managed events
    const managementGanttVenues = useMemo(() => {
      const venueSet = new Set<string>();
      managedEvents.forEach((event: any) => {
        const venueId = event.venue || 'unassigned';
        venueSet.add(venueId);
      });
      return Array.from(venueSet).map(venueId => ({
        id: venueId,
        name: venueId === 'unassigned' ? 'Unassigned' : (modernVenues.find(v => v.id === venueId)?.name || venueId)
      }));
    }, [managedEvents]);

    const managementGanttVenuesToRender = useMemo(() => {
      if (managementSelectedGanttVenue === 'all') {
        return managementGanttVenues;
      }
      return managementGanttVenues.filter(venue => venue.id === managementSelectedGanttVenue);
    }, [managementGanttVenues, managementSelectedGanttVenue]);

    // Get events for a specific venue (using managedEvents)
    const getManagedEventsForVenue = (venueId: string, rangeStart?: Date, rangeEnd?: Date) => {
      const filtered = managedEvents.filter((event: any) => {
        const matchesVenue = venueId === 'all' ? true : (venueId === 'unassigned' ? !event.venue : event.venue === venueId);
        if (!matchesVenue) return false;

        if (rangeStart && rangeEnd) {
          const eventStart = toStartOfDay(new Date(event.arrivalDate || event.startDate));
          const eventEnd = toStartOfDay(new Date(event.departureDate || event.endDate));
          return eventEnd >= rangeStart && eventStart <= rangeEnd;
        }

        return true;
      });

      return filtered.sort((a: any, b: any) => new Date(a.arrivalDate || a.startDate).getTime() - new Date(b.arrivalDate || b.startDate).getTime());
    };

    // Gantt navigation handlers
    const handleManagementGanttNavigate = (direction: number) => {
      const newDate = addMonths(managementGanttReferenceDate, direction);
      setManagementGanttReferenceDate(getStartOfMonth(newDate));
    };

    const handleManagementGanttMonthInput = (value: string) => {
      if (!value) return;
      const [year, month] = value.split('-').map(Number);
      if (!Number.isNaN(year) && !Number.isNaN(month)) {
        const newDate = new Date(year, month - 1, 1);
        setManagementGanttReferenceDate(newDate);
      }
    };

    const getConfirmedStatusColor = (status: string) => {
      // Support both lifecycle statuses and simplified business statuses
      switch (status) {
        case 'quote':
          return 'warning';
        case 'confirmed':
          return 'success';
        case 'in-progress':
          return 'warning';
        case 'completed':
          return 'success';
        case 'invoiced':
        case 'billed':
          return 'primary';
        case 'cancelled':
          return 'danger';
        default:
          return 'default';
      }
    };

    const getConfirmedStatusLabel = (status: string) => {
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
          return status;
      }
    };

    // Determine event status context for financial documents
    const getEventStatusContext = () => {
      // Active tab focuses on in-progress pipeline.
      if (managementMainTab === 'active') return 'active';
      
      // Completed, Invoices, Receipts and Folios all work over the "completed/billed" lifecycle.
      if (
        managementMainTab === 'completed' ||
        managementMainTab === 'invoices' ||
        managementMainTab === 'receipts' ||
        managementMainTab === 'folios'
      ) {
        return 'completed';
      }
      
      // Default to active context for Event Master or any fallback.
      return 'active';
    };

    // Filter event IDs based on current context
    const getFilteredEventIds = useMemo(() => {
      const statusContext = getEventStatusContext();
      let eventsToUse = managedEvents;
      
      if (statusContext === 'active') {
        eventsToUse = managedEvents.filter((e: any) => e.eventStatus === 'confirmed' || e.eventStatus === 'in-progress');
      } else if (statusContext === 'completed') {
        eventsToUse = managedEvents.filter((e: any) => e.eventStatus === 'completed' || e.eventStatus === 'billed');
      }
      
      return eventsToUse.map((e: any) => e.id);
    }, [managedEvents, managementMainTab]);

    const managementFilteredInvoices = useMemo(() => {
      let filtered = eventInvoices.filter(inv => getFilteredEventIds.includes(inv.eventId));
      const q = managementInvoiceSearch.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter(inv =>
          [inv.id, inv.eventName, inv.clientName, inv.status, inv.reference]
            .filter(Boolean)
            .some(field => String(field).toLowerCase().includes(q))
        );
      }
      return filtered;
    }, [eventInvoices, getFilteredEventIds, managementInvoiceSearch]);

    const managementFilteredReceipts = useMemo(() => {
      let filtered = eventReceipts.filter(rcpt => getFilteredEventIds.includes(rcpt.eventId));
      const q = managementReceiptSearch.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter(rcpt =>
          [rcpt.id, rcpt.eventName, rcpt.clientName, rcpt.method, rcpt.reference]
            .filter(Boolean)
            .some(field => String(field).toLowerCase().includes(q))
        );
      }
      return filtered;
    }, [eventReceipts, getFilteredEventIds, managementReceiptSearch]);
    const managementFilteredQuotes = useMemo<QuoteListItem[]>(() => {
      const quotes: QuoteListItem[] = managedEvents.map((event: any) => {
        const checkIn = event.arrivalDate || event.startDate || event.createdAt || '';
        const checkOut = event.departureDate || event.endDate || checkIn;
        const pax = Number(event.expectedPax || event.pax || event.attendees || 0);
        const issuedOn = event.createdAt || event.updatedAt || checkIn;
        const status = event.status || 'quote';

        return {
          id: event.id,
          eventId: event.id,
          quoteNumber: event.quoteNumber || formatEventId(event.id),
          clientName: event.organization || event.clientName || 'Unknown Client',
          eventName: event.eventName || 'Unnamed Event',
          checkIn,
          checkOut,
          pax,
          issuedOn,
          total: event.budgetTotal || 0,
          status,
          statusLabel: getConfirmedStatusLabel(status),
          reference: event.quoteReference || event.reference || '',
          venueName: event.venueName || event.venue || 'Unassigned',
          rawEvent: event
        };
      });

      const term = managementQuoteSearch.trim().toLowerCase();
      if (!term) return quotes;
      return quotes.filter(q =>
        q.quoteNumber.toLowerCase().includes(term) ||
        q.eventName.toLowerCase().includes(term) ||
        q.clientName.toLowerCase().includes(term)
      );
    }, [managedEvents, managementQuoteSearch]);

    const managementFilteredFolios = useMemo(() => {
      let filtered = eventFolios.filter(folio => getFilteredEventIds.includes(folio.eventId));
      const q = managementFolioSearch.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter(folio =>
          [folio.id, folio.eventName, folio.clientName, folio.status]
            .filter(Boolean)
            .some(field => String(field).toLowerCase().includes(q))
        );
      }
      return filtered;
    }, [eventFolios, getFilteredEventIds, managementFolioSearch]);

    const eventMasterSortAccessors = useMemo(() => ({
      eventId: (row: any) => row.id || '',
      eventName: (row: any) => row.eventName || '',
      venueName: (row: any) => row.venueName || '',
      startDate: (row: any) => parseDateValue(row.arrivalDate || row.startDate),
      duration: (row: any) => computeEventDurationDays(row),
      pax: (row: any) => Number(row.pax || row.expectedPax || 0),
      status: (row: any) => row.eventStatus || row.status || '',
      revenue: (row: any) => Number(row.revenue || row.budgetTotal || 0)
    }), []);

    const activeEventsSortAccessors = useMemo(() => ({
      eventName: (row: any) => row.eventName || '',
      organization: (row: any) => row.organization || '',
      dates: (row: any) => parseDateValue(row.arrivalDate || row.startDate),
      venueName: (row: any) => row.venueName || '',
      duration: (row: any) => computeEventDurationDays(row),
      pax: (row: any) => Number(row.pax || row.expectedPax || 0),
      budget: (row: any) => Number(row.budgetTotal || 0),
      status: (row: any) => row.eventStatus || row.status || ''
    }), []);

    const completedEventsSortAccessors = useMemo(() => ({
      eventName: (row: any) => row.eventName || '',
      organization: (row: any) => row.organization || '',
      dates: (row: any) => parseDateValue(row.arrivalDate || row.startDate),
      venueName: (row: any) => row.venueName || '',
      duration: (row: any) => computeEventDurationDays(row),
      pax: (row: any) => Number(row.pax || row.expectedPax || 0),
      budget: (row: any) => Number(row.budgetTotal || row.quoteTotal || 0),
      actual: (row: any) => (row.invoiceTotal !== undefined ? Number(row.invoiceTotal) : (row.actualTotal !== undefined ? Number(row.actualTotal) : null)),
      variance: (row: any) => (row.variance !== undefined ? Number(row.variance) : null),
      status: (row: any) => row.eventStatus || row.status || ''
    }), []);

    const invoiceSortAccessors = useMemo(() => ({
      invoiceId: (row: EventInvoice) => row.id,
      eventName: (row: EventInvoice) => row.eventName || '',
      issueDate: (row: EventInvoice) => parseDateValue(row.issueDate),
      dueDate: (row: EventInvoice) => parseDateValue(row.dueDate),
      total: (row: EventInvoice) => Number(row.total || 0),
      balance: (row: EventInvoice) => Number(row.balance || 0),
      status: (row: EventInvoice) => row.status || ''
    }), []);

    const receiptSortAccessors = useMemo(() => ({
      receiptId: (row: EventReceipt) => row.id,
      eventName: (row: EventReceipt) => row.eventName || '',
      date: (row: EventReceipt) => parseDateValue(row.date),
      amount: (row: EventReceipt) => Number(row.amount || 0),
      method: (row: EventReceipt) => row.method || '',
      reference: (row: EventReceipt) => row.reference || '',
      invoiceId: (row: EventReceipt) => row.invoiceId || ''
    }), []);

    const quoteSortAccessors = useMemo(() => ({
      quoteNumber: (row: QuoteListItem) => row.quoteNumber || '',
      clientName: (row: QuoteListItem) => row.clientName || '',
      eventName: (row: QuoteListItem) => row.eventName || '',
      venueName: (row: QuoteListItem) => row.venueName || '',
      checkIn: (row: QuoteListItem) => parseDateValue(row.checkIn),
      checkOut: (row: QuoteListItem) => parseDateValue(row.checkOut),
      pax: (row: QuoteListItem) => Number(row.pax || 0),
      issuedOn: (row: QuoteListItem) => parseDateValue(row.issuedOn),
      amount: (row: QuoteListItem) => Number(row.total || 0)
    }), []);

    const folioSortAccessors = useMemo(() => ({
      folioId: (row: EventFolio) => row.id,
      eventName: (row: EventFolio) => row.eventName || '',
      clientName: (row: EventFolio) => row.clientName || '',
      status: (row: EventFolio) => row.status || '',
      charges: (row: EventFolio) => {
        return row.entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
      },
      payments: (row: EventFolio) => {
        return row.entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
      },
      balance: (row: EventFolio) => {
        const charges = row.entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
        const payments = row.entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
        return charges - payments;
      },
      updatedAt: (row: EventFolio) => parseDateValue(row.updatedAt)
    }), []);

    const eventMasterTableRows = useMemo(() => {
      return sortRows(filteredManagedEvents, eventMasterSort, eventMasterSortAccessors);
    }, [filteredManagedEvents, eventMasterSort, eventMasterSortAccessors]);

    const activeEventsList = useMemo(() => {
      return filteredManagedEvents.filter((e: any) => e.eventStatus === 'confirmed' || e.eventStatus === 'in-progress');
    }, [filteredManagedEvents]);

    const sortedActiveEvents = useMemo(() => {
      return sortRows(activeEventsList, activeEventsSort, activeEventsSortAccessors);
    }, [activeEventsList, activeEventsSort, activeEventsSortAccessors]);

    const paginatedActiveEvents = useMemo(() => {
      const start = (activeEventsPage - 1) * rowsPerPage;
      return sortedActiveEvents.slice(start, start + rowsPerPage);
    }, [sortedActiveEvents, activeEventsPage, rowsPerPage]);

    const activeEventsPages = useMemo(() => {
      return Math.ceil(activeEventsList.length / rowsPerPage);
    }, [activeEventsList, rowsPerPage]);

    const completedEventsList = useMemo(() => {
      return filteredManagedEvents.filter((e: any) => e.eventStatus === 'completed' || e.eventStatus === 'billed');
    }, [filteredManagedEvents]);

    const sortedCompletedEvents = useMemo(() => {
      return sortRows(completedEventsList, completedEventsSort, completedEventsSortAccessors);
    }, [completedEventsList, completedEventsSort, completedEventsSortAccessors]);

    const paginatedCompletedEvents = useMemo(() => {
      const start = (completedEventsPage - 1) * rowsPerPage;
      return sortedCompletedEvents.slice(start, start + rowsPerPage);
    }, [sortedCompletedEvents, completedEventsPage, rowsPerPage]);

    const completedEventsPages = useMemo(() => {
      return Math.ceil(completedEventsList.length / rowsPerPage);
    }, [completedEventsList, rowsPerPage]);

    const sortedInvoices = useMemo(() => {
      return sortRows(managementFilteredInvoices, invoiceSort, invoiceSortAccessors);
    }, [managementFilteredInvoices, invoiceSort, invoiceSortAccessors]);

    // Paginated data for Invoices
    const paginatedInvoices = useMemo(() => {
      const start = (invoicesPage - 1) * rowsPerPage;
      return sortedInvoices.slice(start, start + rowsPerPage);
    }, [sortedInvoices, invoicesPage, rowsPerPage]);

    const invoicesPages = useMemo(() => {
      return Math.ceil(managementFilteredInvoices.length / rowsPerPage);
    }, [managementFilteredInvoices, rowsPerPage]);

    const sortedReceipts = useMemo(() => {
      return sortRows(managementFilteredReceipts, receiptSort, receiptSortAccessors);
    }, [managementFilteredReceipts, receiptSort, receiptSortAccessors]);

    // Paginated data for Receipts
    const paginatedReceipts = useMemo(() => {
      const start = (receiptsPage - 1) * rowsPerPage;
      return sortedReceipts.slice(start, start + rowsPerPage);
    }, [sortedReceipts, receiptsPage, rowsPerPage]);

    const receiptsPages = useMemo(() => {
      return Math.ceil(managementFilteredReceipts.length / rowsPerPage);
    }, [managementFilteredReceipts, rowsPerPage]);

    const sortedQuotes = useMemo(() => {
      return sortRows(managementFilteredQuotes, quoteSort, quoteSortAccessors);
    }, [managementFilteredQuotes, quoteSort, quoteSortAccessors]);

    const paginatedQuotes = useMemo(() => {
      const start = (quotesPage - 1) * rowsPerPage;
      return sortedQuotes.slice(start, start + rowsPerPage);
    }, [sortedQuotes, quotesPage, rowsPerPage]);

    const quotesPages = useMemo(() => {
      return Math.ceil(managementFilteredQuotes.length / rowsPerPage);
    }, [managementFilteredQuotes, rowsPerPage]);

    const sortedFolios = useMemo(() => {
      return sortRows(managementFilteredFolios, folioSort, folioSortAccessors);
    }, [managementFilteredFolios, folioSort, folioSortAccessors]);

    // Paginated data for Folios
    const paginatedFolios = useMemo(() => {
      const start = (foliosPage - 1) * rowsPerPage;
      return sortedFolios.slice(start, start + rowsPerPage);
    }, [sortedFolios, foliosPage, rowsPerPage]);

    const foliosPages = useMemo(() => {
      return Math.ceil(managementFilteredFolios.length / rowsPerPage);
    }, [managementFilteredFolios, rowsPerPage]);

    // Reset page when filters change
    useEffect(() => {
      setActiveEventsPage(1);
      setCompletedEventsPage(1);
    }, [managementSearchTerm, managementStatusFilter]);

    useEffect(() => {
      setInvoicesPage(1);
    }, [managementInvoiceSearch, managementMainTab]);

    useEffect(() => {
      setReceiptsPage(1);
    }, [managementReceiptSearch, managementMainTab]);

    useEffect(() => {
      setQuotesPage(1);
    }, [managementQuoteSearch, managementMainTab]);

    useEffect(() => {
      setFoliosPage(1);
    }, [managementFolioSearch, managementMainTab]);

    // Wrapper function to mark event as completed and switch to Completed Events tab
    const handleMarkEventAsCompleted = (event: any) => {
      const wasCompleted = markEventAsCompleted(event);
      console.log('[Events] handleMarkEventAsCompleted called', {
        eventId: event?.id,
        wasCompleted,
        currentTab: managementMainTab,
      });
      // Always direct user to Completed Events tab after clicking Complete
        setTimeout(() => {
          setManagementMainTab('completed');
        setCompletedEventsPage(1);
        }, 100);
    };

    // Function to open or create folio for an event
    const handleOpenEventFolio = (event: any) => {
      try {
        // Ensure we stay on the completed tab
        if (managementMainTab !== 'completed') {
          setManagementMainTab('completed');
        }
        
        // Prevent any default behavior
        if (!event || !event.id) {
          console.error('Invalid event provided to handleOpenEventFolio');
          return;
        }
        
        // Check if folio already exists for this event
        const existingFolio = eventFolios.find(f => f.eventId === event.id);
        
        if (existingFolio) {
          // Open existing folio
          openFolioDetails(existingFolio);
        } else {
          // Create new folio and open it
          // Check if invoice exists to add as initial entry
          const invoice = eventInvoices?.find((inv: any) => inv.eventId === event.id);
          const entries: any[] = [];
          
          // If invoice exists, add it as an initial charge entry
          if (invoice && invoice.total > 0) {
            entries.push({
              id: `FLE-${Date.now().toString().slice(-6)}`,
              date: invoice.issueDate || new Date().toISOString().split('T')[0],
              description: `Invoice ${invoice.id} - Event Charges`,
              debit: invoice.total,
              credit: 0,
              balance: invoice.total
            });
          }
          
          const newFolio: EventFolio = {
            id: `FOL-${Date.now().toString().slice(-6)}`,
            eventId: event.id,
            eventName: event.eventName || 'Unnamed Event',
            clientName: event.organization || 'Unknown Client',
            status: 'Open',
            openingBalance: 0,
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0],
            entries: entries
          };
          
          // Add the new folio to the list
          setEventFolios(prev => [...prev, newFolio]);
          
          // Open the newly created folio
          openFolioDetails(newFolio);
          
          trackEvent('Events.EventCreated', { action: 'folio_created', eventId: event.id, folioId: newFolio.id });
        }
      } catch (error) {
        console.error('Error opening/creating folio:', error);
        alert('Failed to open folio. Please try again.');
        // Ensure we stay on completed tab even if there's an error
        setManagementMainTab('completed');
      }
    };

    // Open invoice edit from the invoices table using the event edit form (folio workflow)
    const openInvoiceFromTable = (invoice: EventInvoice) => {
      const relatedEvent =
        managedEvents.find((e: any) => e.id === invoice.eventId) ||
        allEvents.find((e: any) => e.id === invoice.eventId);
      if (!relatedEvent) {
        alert('Could not find the related event for this invoice. It may have been removed.');
        return;
      }
      // Open the event edit form with invoice creation/edit flag so user edits within the event modal
      openEventForEdit(relatedEvent, false, true);
    };

    // Wrapper functions for function view exports using filteredManagedEvents
    const exportManagementFunctionSchedulePDF = () => {
      try {
        trackEvent('Events.EventCreated', { action: 'function_schedule_pdf_exported', eventCount: filteredManagedEvents.length });
        
        const pdfContent = `
          Provisional Function Schedule - ${managementGanttTimelineTitle}
          Generated on: ${new Date().toLocaleDateString()}
          
          Total Functions: ${filteredManagedEvents.length}
          Confirmed: ${filteredManagedEvents.filter((e: any) => e.eventStatus === 'confirmed' || e.eventStatus === 'in-progress').length}
          Total Attendees: ${filteredManagedEvents.reduce((sum: number, e: any) => sum + (e.pax || 0), 0)}
          
          ${filteredManagedEvents.map((event: any, index: number) => `
            ${index + 1}. ${event.eventName}
            Organization: ${event.organization}
            Event Type: ${event.eventType || 'Conference'}
            Venue: ${event.venueName || event.venue || 'Unassigned'}
            Dates: ${event.arrivalDate || event.startDate} - ${event.departureDate || event.endDate}
            Duration: ${event.duration || 0} days
            Attendees: ${event.pax || 0}
            Status: ${getConfirmedStatusLabel(event.eventStatus || event.status)}
          `).join('\n\n')}
        `;
        
        const blob = new Blob([pdfContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `function-schedule-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error exporting function schedule PDF:', error);
        alert('Failed to export function schedule. Please try again.');
      }
    };

    const downloadManagementFunctionScheduleCSV = () => {
      try {
        trackEvent('Events.EventCreated', { action: 'function_schedule_csv_downloaded', eventCount: filteredManagedEvents.length });
        
        const headers = ['Item', 'Arrival Date', 'Departure Date', 'Organization', 'Event Name', 'Programme Type', 'No. of Pax', 'No. of Rooms', 'Room Nights', 'Conference Days', 'Event Venue', 'Status'];
        const rows = filteredManagedEvents.map((event: any, index: number) => [
          index + 1,
          event.arrivalDate || event.startDate || '',
          event.departureDate || event.endDate || '',
          event.organization || '',
          event.eventName || '',
          event.eventType || 'Conference',
          event.pax || 0,
          event.residential ? (event.pax || 0) : 0,
          event.duration || 0,
          event.duration || 0,
          event.venueName || event.venue || 'Unassigned',
          getConfirmedStatusLabel(event.eventStatus || event.status)
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `function-schedule-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading function schedule CSV:', error);
        alert('Failed to download function schedule. Please try again.');
      }
    };

    return (
      <div className="space-y-6 mt-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-2 border-blue-200">
            <CardBody className="p-4">
              <p className="text-sm text-gray-600 mb-1">Confirmed</p>
              <p className="text-2xl font-bold text-blue-700">
                {managedEvents.filter((e: any) => {
                  const normalized = normalizeStatus(e.eventStatus || e.status);
                  return normalized === 'confirmed';
                }).length}
              </p>
            </CardBody>
          </Card>
          <Card className="border-2 border-green-200">
            <CardBody className="p-4">
              <p className="text-sm text-gray-600 mb-1">Invoiced</p>
              <p className="text-2xl font-bold text-green-700">
                {managedEvents.filter((e: any) => {
                  const normalized = normalizeStatus(e.eventStatus || e.status);
                  return normalized === 'invoiced';
                }).length}
              </p>
            </CardBody>
          </Card>
          <Card className="border-2 border-yellow-200">
            <CardBody className="p-4">
              <p className="text-sm text-gray-600 mb-1">Quote</p>
              <p className="text-2xl font-bold text-yellow-700">
                {managedEvents.filter((e: any) => {
                  const normalized = normalizeStatus(e.eventStatus || e.status);
                  return normalized === 'quote';
                }).length}
              </p>
            </CardBody>
          </Card>
          <Card className="border-2 border-purple-200">
            <CardBody className="p-4">
              <p className="text-sm text-gray-600 mb-1">Total Budget</p>
              <p className="text-2xl font-bold text-purple-700">
                {formatCurrency(managedEvents.reduce((sum: number, e: any) => sum + e.budgetTotal, 0))}
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardBody className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="Search by event name, organization, or venue..."
                value={managementSearchTerm}
                onChange={(e) => setManagementSearchTerm(e.target.value)}
                className="flex-1"
                startContent={<span className="text-gray-400">🔍</span>}
              />
                  <Select
                placeholder="Filter by status"
                selectedKeys={managementStatusFilter !== 'all' ? [managementStatusFilter] : []}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  setManagementStatusFilter(value || 'all');
                }}
                className="w-full sm:w-48"
              >
                <SelectItem key="all">All Statuses</SelectItem>
                <SelectItem key="confirmed">Confirmed</SelectItem>
                <SelectItem key="in-progress">In Progress</SelectItem>
                <SelectItem key="completed">Completed</SelectItem>
                <SelectItem key="billed">Billed</SelectItem>
              </Select>
            </div>
          </CardBody>
        </Card>

        {/* Main Tabs */}
        <Tabs
          selectedKey={managementMainTab}
          onSelectionChange={(key) => {
            const newTab = key as 'events' | 'active' | 'completed' | 'invoices' | 'receipts' | 'quotes' | 'folios';
            setManagementMainTab(newTab);
          }}
        >
          <Tab key="events" title="📊 Event Master">
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-lg font-semibold">Event Master</h3>
                  <div className="flex items-center gap-2">
                    <Badge content={managedEvents.length} color="primary">
                      <span className="text-sm text-gray-600">Total Confirmed Events</span>
                    </Badge>
                    <Button 
                      color="success" 
                      variant="solid"
                      size="sm"
                      onClick={openNewEventModal}
                    >
                      ➕ New Event
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      size="sm"
                      placeholder="Search events..."
                      value={managementSearchTerm}
                      onValueChange={setManagementSearchTerm}
                      startContent={<span className="text-gray-400">🔍</span>}
                      className="max-w-xs"
                    />
                    <Select
                      size="sm"
                      selectedKeys={[managementStatusFilter]}
                      onSelectionChange={(keys) => setManagementStatusFilter(Array.from(keys)[0] as string)}
                      className="w-40"
                      variant="flat"
                    >
                      <SelectItem key="all">All Statuses</SelectItem>
                      <SelectItem key="confirmed">Confirmed</SelectItem>
                      <SelectItem key="in-progress">In Progress</SelectItem>
                      <SelectItem key="completed">Completed</SelectItem>
                      <SelectItem key="billed">Billed</SelectItem>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select 
                      size="sm"
                      label="View Mode" 
                      selectedKeys={[managementViewMode]}
                      onSelectionChange={(keys) => setManagementViewMode(Array.from(keys)[0] as 'table' | 'calendar' | 'gantt' | 'function')}
                      className="w-48"
                      variant="flat"
                    >
                      <SelectItem key="table">📋 Table View</SelectItem>
                      <SelectItem key="calendar">📅 Calendar View</SelectItem>
                      <SelectItem key="gantt">📊 Gantt Chart</SelectItem>
                      <SelectItem key="function">📋 Function View</SelectItem>
                    </Select>
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      onPress={() => {
                        if (managementViewMode === 'function') {
                          exportManagementFunctionSchedulePDF();
                        } else {
                          exportEventsForView(managementViewMode as 'table' | 'calendar' | 'gantt', 'pdf');
                        }
                      }}
                    >
                      📄 Export PDF
                    </Button>
                    <Button
                      size="sm"
                      color="secondary"
                      variant="flat"
                      onPress={() => {
                        if (managementViewMode === 'function') {
                          downloadManagementFunctionScheduleCSV();
                        } else {
                          exportEventsForView(managementViewMode as 'table' | 'calendar' | 'gantt', 'csv');
                        }
                      }}
                    >
                      📊 Export XLS
                    </Button>
                  </div>
                </div>
                {managementViewMode === 'table' && (
                <Table aria-label="Events management table">
                  <TableHeader>
                    <TableColumn key="eventId">
                      {renderSortableHeader('Event ID', 'eventId', eventMasterSort, handleEventMasterSort)}
                    </TableColumn>
                    <TableColumn key="eventName">
                      {renderSortableHeader('Event', 'eventName', eventMasterSort, handleEventMasterSort)}
                    </TableColumn>
                    <TableColumn key="venueName">
                      {renderSortableHeader('Venue', 'venueName', eventMasterSort, handleEventMasterSort)}
                    </TableColumn>
                    <TableColumn key="startDate">
                      {renderSortableHeader('Dates', 'startDate', eventMasterSort, handleEventMasterSort)}
                    </TableColumn>
                    <TableColumn key="duration">
                      {renderSortableHeader('Days', 'duration', eventMasterSort, handleEventMasterSort)}
                    </TableColumn>
                    <TableColumn key="pax">
                      {renderSortableHeader('Attendees', 'pax', eventMasterSort, handleEventMasterSort)}
                    </TableColumn>
                    <TableColumn key="status">
                      {renderSortableHeader('Status', 'status', eventMasterSort, handleEventMasterSort)}
                    </TableColumn>
                    <TableColumn key="revenue">
                      {renderSortableHeader('Revenue', 'revenue', eventMasterSort, handleEventMasterSort)}
                    </TableColumn>
                    <TableColumn key="actions">Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {eventMasterTableRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                          <div>
                            <span className="text-4xl">📋</span>
                            <p className="mt-2">No events found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      eventMasterTableRows
                        .filter((event: any) => {
                          if (!event || !event.id) {
                            console.warn('[Event Master] Skipping event with missing id:', event);
                            return false;
                          }
                          return true;
                        })
                        .map((event: any) => {
                          const durationDays = computeEventDurationDays(event);
                          return (
                        <TableRow key={event.id}>
                          <TableCell className="font-semibold">{formatEventId(event.id)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getEventTypeIcon(event.eventType || 'conference')}</span>
                              <div>
                                <p className="font-medium">{event.eventName || 'Unnamed Event'}</p>
                                <p className="text-sm text-gray-600">{event.organization || 'N/A'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge color="primary" variant="flat">{event.venueName || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{event.arrivalDate || event.startDate || 'N/A'}</p>
                                  <p className="text-sm text-gray-600">to {event.departureDate || event.endDate || 'N/A'}</p>
                            </div>
                          </TableCell>
                              <TableCell>
                                <Chip size="sm" variant="flat" color="warning">
                                  {durationDays} day{durationDays === 1 ? '' : 's'}
                                </Chip>
                              </TableCell>
                          <TableCell>
                            <Chip size="sm" variant="flat" color="primary">
                              {event.pax || event.expectedPax || 0}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <Badge color={getConfirmedStatusColor(event.eventStatus || event.status || 'confirmed') as any} variant="flat">
                              {getConfirmedStatusLabel(event.eventStatus || event.status || 'confirmed')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <span className="font-medium">₵{(event.revenue || event.budgetTotal || 0).toLocaleString()}</span>
                              <div className="text-xs text-gray-600">
                                {event.status === 'confirmed' ? 'Deposit: ₵' + (event.deposit || 0).toLocaleString() : 'Quote'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                color="default" 
                                variant="flat"
                                onClick={() => openEventForView(event)}
                              >
                                View
                              </Button>
                              <Button 
                                size="sm" 
                                color="secondary" 
                                variant="flat"
                                onClick={() => {
                                  setSelectedEventForBEO(event);
                                  generateBEO(event);
                                  generateFunctionSheet(event);
                                  setIsBEOModalOpen(true);
                                }}
                              >
                                📊 BEO & Sheet
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>
                )}
                {managementViewMode === 'calendar' && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h5 className="text-lg font-semibold">📅 {calendarHeaderTitle}</h5>
                        {eventCalendarView === 'week' && (
                          <p className="text-sm text-gray-500">{weekRangeTitle}</p>
                        )}
                        {eventCalendarView === 'day' && (
                          <p className="text-sm text-gray-500">Events for {calendarDateInputValue}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="light" onClick={() => handleCalendarNavigate(-1)}>◀</Button>
                        <Button size="sm" variant="light" onClick={handleCalendarToday}>Today</Button>
                        <Button size="sm" variant="light" onClick={() => handleCalendarNavigate(1)}>▶</Button>
                        <Input
                          size="sm"
                          type={eventCalendarView === 'month' ? 'month' : 'date'}
                          label={eventCalendarView === 'month' ? 'Month' : 'Date'}
                          value={eventCalendarView === 'month' ? calendarMonthInputValue : calendarDateInputValue}
                          onChange={(e) => handleCalendarDateInput(e.target.value)}
                          className="w-[160px]"
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            color="primary"
                            variant={eventCalendarView === 'month' ? 'solid' : 'light'}
                            onClick={() => handleCalendarViewChange('month')}
                          >
                            📅 Month
                          </Button>
                          <Button
                            size="sm"
                            color="primary"
                            variant={eventCalendarView === 'week' ? 'solid' : 'light'}
                            onClick={() => handleCalendarViewChange('week')}
                          >
                            📆 Week
                          </Button>
                          <Button
                            size="sm"
                            color="primary"
                            variant={eventCalendarView === 'day' ? 'solid' : 'light'}
                            onClick={() => handleCalendarViewChange('day')}
                          >
                            📍 Day
                          </Button>
                        </div>
                      </div>
                    </div>
                    {eventCalendarView === 'month' && (
                      <div className="grid grid-cols-7 gap-2">
                        {calendarDayNames.map(day => (
                          <div key={`header-${day}`} className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {day}
                          </div>
                        ))}
                        {calendarGridDays.map(dayInfo => {
                          const allDayEvents = eventsByDay.get(dayInfo.key) || [];
                          const cellEvents = allDayEvents.filter((e: any) => {
                            const status = normalizeStatus(e.status);
                            return status === 'confirmed';
                          });
                          const isToday = dayInfo.key === todayKey;
                          const hasEvents = cellEvents.length > 0;
                          const dayBreakdownRows = hasEvents
                            ? buildDailyBreakdownRows(cellEvents, true, dayInfo.date, dayInfo.date)
                            : [] as ReturnType<typeof buildDailyBreakdownRows>;
                          const dayTotals = summarizeBreakdown(dayBreakdownRows);

                          const currentMonthClasses = hasEvents
                            ? 'bg-gradient-to-br from-white via-emerald-50/70 to-sky-50/80 border-transparent shadow-[0_12px_28px_rgba(15,23,42,0.08)]'
                            : 'bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-200 shadow-[0_6px_14px_rgba(15,23,42,0.05)]';

                          const cellClass = dayInfo.isCurrentMonth
                            ? currentMonthClasses
                            : 'bg-slate-50 border-slate-100 text-slate-400 shadow-none';

                          return (
                            <div
                              key={dayInfo.key}
                              className={`group relative min-h-[120px] rounded-xl border p-3 transition-all duration-200 ease-out ${cellClass} ${
                                isToday
                                  ? 'ring-2 ring-primary-400 shadow-[0_14px_30px_rgba(37,99,235,0.2)]'
                                  : 'hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-sm font-semibold ${isToday ? 'text-primary-600' : 'text-slate-700'}`}>
                                  {dayInfo.date.getDate()}
                                </span>
                                {isToday && (
                                  <Chip size="sm" color="primary" variant="solid" className="shadow-sm">
                                    Today
                                  </Chip>
                                )}
                              </div>
                              {hasEvents && (
                                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                                  <span className="font-medium text-emerald-700">Conf: {formatCount(dayTotals.conference)}</span>
                                  <span className="font-medium text-sky-700">Acc: {formatCount(dayTotals.accommodation)}</span>
                                </div>
                              )}
                              <div className="mt-3 space-y-1.5 overflow-hidden">
                                {cellEvents.slice(0, 3).map(event => {
                                  const statusMeta = eventStatuses[event.status as keyof typeof eventStatuses] || {};
                                  const palette = getEventPalette(event);
                                  const calendarBgClass = palette?.calendarBg || statusMeta.bgColor || 'bg-slate-100';
                                  const calendarBorderClass = palette?.calendarBorder || statusMeta.borderColor || 'border-slate-200';
                                  const calendarTextClass = palette?.calendarText || statusMeta.textColor || 'text-slate-700';
                                  return (
                                    <Tooltip
                                      key={event.id}
                                      content={
                                        <div className="max-w-xs space-y-1 rounded-lg bg-white/95 p-2 text-slate-700 shadow-lg backdrop-blur">
                                          <p className="text-sm font-semibold text-slate-900">{event.eventName}</p>
                                          <p className="text-xs text-slate-500">{event.organization}</p>
                                          <p className="text-xs text-slate-500">
                                            {event.arrivalDate} → {event.departureDate}
                                          </p>
                                          <p className="text-xs text-slate-500">Guests: {event.pax}</p>
                                        </div>
                                      }
                                    >
                                      <div
                                        className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${calendarBgClass} ${calendarBorderClass} ${calendarTextClass}`}
                                        onClick={() => openEventForView(event)}
                                      >
                                        <p className="truncate leading-tight">{event.organization}</p>
                                        <p className="truncate text-[11px] font-normal opacity-80">{event.eventName}</p>
                                      </div>
                                    </Tooltip>
                                  );
                                })}
                                {cellEvents.length > 3 && (
                                  <p className="text-[11px] font-medium text-slate-500">+{cellEvents.length - 3} more</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {eventCalendarView === 'week' && (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
                        {calendarWeekDays.map(day => {
                          const key = formatDateKey(day);
                          const allDayEvents = eventsByDay.get(key) || [];
                          const eventsForDay = allDayEvents.filter((e: any) => {
                            const status = normalizeStatus(e.status);
                            return status === 'confirmed';
                          });
                          const isToday = key === todayKey;
                          const dayBreakdownRows = eventsForDay.length
                            ? buildDailyBreakdownRows(eventsForDay, true, day, day)
                            : [] as ReturnType<typeof buildDailyBreakdownRows>;
                          const dayTotals = summarizeBreakdown(dayBreakdownRows);
                          return (
                            <div
                              key={key}
                              className={`rounded-xl border p-3 transition-all duration-200 ${
                                isToday
                                  ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-400 shadow-lg'
                                  : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <span className={`text-sm font-semibold ${isToday ? 'text-primary-700' : 'text-slate-700'}`}>
                                  {day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                                </span>
                                {isToday && <Chip size="sm" color="primary" variant="solid">Today</Chip>}
                              </div>
                              {eventsForDay.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1 text-[10px] text-slate-600">
                                  <span className="font-medium text-emerald-700">Conf: {formatCount(dayTotals.conference)}</span>
                                  <span className="font-medium text-sky-700">Acc: {formatCount(dayTotals.accommodation)}</span>
                                </div>
                              )}
                              <div className="space-y-1.5">
                                {eventsForDay.map(event => {
                                  const statusMeta = eventStatuses[event.status as keyof typeof eventStatuses] || {};
                                  const palette = getEventPalette(event);
                                  const calendarBgClass = palette?.calendarBg || statusMeta.bgColor || 'bg-slate-100';
                                  const calendarBorderClass = palette?.calendarBorder || statusMeta.borderColor || 'border-slate-200';
                                  const calendarTextClass = palette?.calendarText || statusMeta.textColor || 'text-slate-700';
                                  return (
                                    <Tooltip
                                      key={event.id}
                                      content={
                                        <div className="max-w-xs space-y-1 rounded-lg bg-white/95 p-2 text-slate-700 shadow-lg backdrop-blur">
                                          <p className="text-sm font-semibold text-slate-900">{event.eventName}</p>
                                          <p className="text-xs text-slate-500">{event.organization}</p>
                                          <p className="text-xs text-slate-500">
                                            {event.arrivalDate} → {event.departureDate}
                                          </p>
                                          <p className="text-xs text-slate-500">Guests: {event.pax}</p>
                                        </div>
                                      }
                                    >
                                      <div
                                        className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${calendarBgClass} ${calendarBorderClass} ${calendarTextClass}`}
                                        onClick={() => openEventForView(event)}
                                      >
                                        <p className="truncate leading-tight">{event.organization}</p>
                                        <p className="truncate text-[11px] font-normal opacity-80">{event.eventName}</p>
                                      </div>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {eventCalendarView === 'day' && (
                      <div className="space-y-3">
                        <div className="rounded-xl border bg-white p-4 shadow-sm">
                          <h4 className="mb-3 text-lg font-semibold">Events for {calendarDateInputValue}</h4>
                          {dayEvents.filter((e: any) => {
                            const status = normalizeStatus(e.status);
                            return status === 'confirmed';
                          }).length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No confirmed events for this day</p>
                          ) : (
                            <div className="space-y-2">
                              {dayEvents.filter((e: any) => {
                                const status = normalizeStatus(e.status);
                                return status === 'confirmed';
                              }).map(event => (
                                <div
                                  key={event.id}
                                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 cursor-pointer"
                                  onClick={() => openEventForView(event)}
                                >
                                  <div>
                                    <p className="font-medium">{event.eventName}</p>
                                    <p className="text-sm text-gray-600">{event.organization}</p>
                                  </div>
                                  <Badge color={event.statusColor as any} variant="flat">
                                    {eventStatuses[event.status as keyof typeof eventStatuses]?.label || event.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {managementViewMode === 'gantt' && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h5 className="text-lg font-semibold">📊 Venue Timeline — {managementGanttTimelineTitle}</h5>
                        <p className="text-sm text-gray-500">{managementGanttTimelineRangeLabel}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="light" onClick={() => handleManagementGanttNavigate(-1)}>◀</Button>
                        <Button
                          size="sm"
                          variant="light"
                          onClick={() => {
                            const today = new Date();
                            setManagementGanttReferenceDate(getStartOfMonth(today));
                          }}
                        >
                          Today
                        </Button>
                        <Button size="sm" variant="light" onClick={() => handleManagementGanttNavigate(1)}>▶</Button>
                        <Input
                          size="sm"
                          type="month"
                          label="Timeline"
                          value={managementGanttMonthInputValue}
                          onChange={(e) => handleManagementGanttMonthInput(e.target.value)}
                          className="w-[150px]"
                        />
                        <Select
                          size="sm"
                          label="Venue"
                          selectedKeys={[managementSelectedGanttVenue]}
                          onSelectionChange={(keys) => setManagementSelectedGanttVenue(Array.from(keys)[0] as string)}
                          className="w-48"
                          items={[{ id: 'all', name: 'All Venues' }, ...managementGanttVenues]}
                        >
                          {/* @ts-ignore - NextUI Select typing struggles with dynamic items */}
                          {(venue: { id: string; name: string }) => (
                            <SelectItem key={venue.id} textValue={venue.name}>
                              {venue.name}
                            </SelectItem>
                          )}
                        </Select>
                      </div>
                    </div>

                    {managementGanttVenuesToRender.length === 0 ? (
                      <Card className="border border-dashed border-gray-200">
                        <CardBody className="py-6 text-center text-sm text-gray-500">
                          No venues available for selection.
                        </CardBody>
                      </Card>
                    ) : (
                      managementGanttVenuesToRender.map(venue => {
                        const allVenueEvents = getManagedEventsForVenue(venue.id, managementGanttTimelineStart, managementGanttTimelineEnd);
                        const eventsForVenueTimeline = allVenueEvents.filter((e: any) => {
                          const status = normalizeStatus(e.status);
                          return status === 'confirmed';
                        });
                        const venueBreakdownRows = buildDailyBreakdownRows(eventsForVenueTimeline, true, managementGanttTimelineStart, managementGanttTimelineEnd);
                        const breakdownByDate = aggregateBreakdownByDate(venueBreakdownRows);
                        const breakdownItems = Array.from(breakdownByDate.entries())
                          .filter(([, totals]) => totals.conference > 0 || totals.accommodation > 0)
                          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

                        const positionedEvents: Array<{
                          event: any;
                          statusMeta: (typeof eventStatuses)[keyof typeof eventStatuses];
                          palette: (typeof eventColorPalette)[number];
                          leftPercent: number;
                          widthPercent: number;
                          overlapIndex: number;
                          topOffset: number;
                        }> = [];

                        const levelEndMap = new Map<number, Date>();

                        eventsForVenueTimeline.forEach(event => {
                          const statusMeta = eventStatuses[event.status as keyof typeof eventStatuses] || {};
                          const palette = getEventPalette(event);
                          const rawStart = toStartOfDay(new Date(event.arrivalDate || event.startDate));
                          const rawEnd = toStartOfDay(new Date(event.departureDate || event.endDate));
                          const clampedStart = clampDateToRange(rawStart, managementGanttTimelineStart, managementGanttTimelineEnd);
                          const clampedEnd = clampDateToRange(rawEnd, managementGanttTimelineStart, managementGanttTimelineEnd);
                          const offsetDays = Math.max(0, Math.round((clampedStart.getTime() - managementGanttTimelineStart.getTime()) / DAY_IN_MS));
                          const spanDays = Math.max(1, Math.round((clampedEnd.getTime() - clampedStart.getTime()) / DAY_IN_MS) + 1);
                          const leftPercent = (offsetDays / managementTimelineDayCount) * 100;
                          const widthPercent = Math.min(100, (spanDays / managementTimelineDayCount) * 100);

                          for (const [level, endDate] of Array.from(levelEndMap.entries())) {
                            if (endDate.getTime() < clampedStart.getTime()) {
                              levelEndMap.delete(level);
                            }
                          }

                          let overlapIndex = 0;
                          while (levelEndMap.has(overlapIndex)) {
                            overlapIndex += 1;
                          }
                          levelEndMap.set(overlapIndex, clampedEnd);

                          const topOffset = 8 + overlapIndex * 14;

                          positionedEvents.push({
                            event,
                            statusMeta,
                            palette,
                            leftPercent,
                            widthPercent,
                            overlapIndex,
                            topOffset
                          });
                        });

                        return (
                          <Card
                            key={venue.id}
                            className="border border-transparent bg-gradient-to-br from-white via-slate-50 to-sky-50 shadow-[0_16px_36px_rgba(15,23,42,0.12)]"
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-sm font-semibold text-slate-800">{venue.name}</h5>
                                <Chip size="sm" variant="flat" color="primary">
                                  {eventsForVenueTimeline.length} events
                                </Chip>
                              </div>
                            </CardHeader>
                            <CardBody className="space-y-4 pt-0">
                              {breakdownItems.length > 0 && (
                                <div className="overflow-x-auto text-[11px] text-slate-600">
                                  <div className="flex min-w-max gap-3">
                                    {breakdownItems.map(([dateKey, totals]) => {
                                      const [year, month, day] = dateKey.split('-').map(part => parseInt(part, 10));
                                      const displayDate = !Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)
                                        ? new Date(year, month - 1, day)
                                        : null;
                                      return (
                                        <div
                                          key={dateKey}
                                          className="rounded-lg border border-transparent bg-gradient-to-br from-emerald-100/70 via-emerald-50 to-white px-3 py-2 text-emerald-900 shadow-[0_12px_28px_rgba(16,185,129,0.18)]"
                                        >
                                          <div className="text-xs font-semibold uppercase tracking-wide">
                                            {displayDate ? displayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : dateKey}
                                          </div>
                                          <div className="text-[10px] opacity-80">Conf: {formatCount(totals.conference)}</div>
                                          <div className="text-[10px] opacity-80">Acc: {formatCount(totals.accommodation)}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <div className="relative h-32 overflow-hidden rounded-2xl border border-transparent bg-gradient-to-r from-slate-900/5 via-sky-200/20 to-slate-50 shadow-inner">
                                <div className="pointer-events-none absolute inset-0 z-0">
                                  {managementTimelineDays.map((day, index) => {
                                    const dayKey = formatDateKey(day);
                                    const leftPercent = (index / managementTimelineDayCount) * 100;
                                    const nextLeftPercent = ((index + 1) / managementTimelineDayCount) * 100;
                                    const widthPercent = Math.max(100 / managementTimelineDayCount, nextLeftPercent - leftPercent);
                                    return (
                                      <div
                                        key={`day-box-${venue.id}-${dayKey}`}
                                        className="absolute flex h-full flex-col justify-start rounded-xl border border-white/50 bg-white/30 px-1.5 py-1.5 text-[9px] text-slate-600 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                                        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                                      >
                                        <div className="flex items-center justify-between font-semibold uppercase tracking-wide text-slate-500">
                                          <span>{day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                          <span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {positionedEvents.length === 0 && (
                                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                                    No confirmed events scheduled in this range.
                                  </div>
                                )}
                                {positionedEvents.map(({ event, statusMeta, palette, leftPercent, widthPercent, overlapIndex, topOffset }) => {
                                  const ganttBgClass = palette?.ganttBg || statusMeta.ganttBg || statusMeta.bgColor || 'bg-blue-200';
                                  const ganttBorderClass = palette?.ganttBorder || statusMeta.ganttBorder || statusMeta.borderColor || 'border-blue-300';
                                  const ganttTextClass = palette?.ganttText || statusMeta.ganttText || statusMeta.textColor || 'text-white';
                                  const barBaseTop = topOffset + 18;
                                  const isHovered = hoveredGanttEventId === event.id;
                                  const computedTop = Math.max(34, isHovered ? barBaseTop + 6 : barBaseTop);
                                  const computedZIndex = isHovered ? 50 : 10 + overlapIndex;

                                  return (
                                    <Tooltip
                                      key={event.id}
                                      content={
                                        <div className="max-w-xs space-y-1 rounded-lg bg-white/95 p-2 text-slate-700 shadow-lg backdrop-blur">
                                          <p className="text-sm font-semibold text-slate-900">{event.eventName}</p>
                                          <p className="text-xs text-slate-500">{event.organization}</p>
                                          <p className="text-xs text-slate-500">
                                            {event.arrivalDate} → {event.departureDate}
                                          </p>
                                          <p className="text-xs text-slate-500">Guests: {event.pax}</p>
                                        </div>
                                      }
                                    >
                                      <div
                                        className={`absolute flex h-9 cursor-pointer items-center overflow-hidden rounded-xl border px-2.5 shadow-[0_16px_30px_rgba(15,23,42,0.26)] backdrop-blur-sm transition-all duration-200 ${
                                          ganttBgClass
                                        } ${ganttBorderClass} ${isHovered ? 'scale-[1.02] shadow-[0_24px_44px_rgba(15,23,42,0.32)]' : ''}`}
                                        style={{
                                          left: `${leftPercent}%`,
                                          width: `${widthPercent}%`,
                                          top: `${computedTop}px`,
                                          zIndex: computedZIndex
                                        }}
                                        onClick={() => openEventForView(event)}
                                        onMouseEnter={() => setHoveredGanttEventId(event.id)}
                                        onMouseLeave={() => setHoveredGanttEventId(null)}
                                      >
                                        <span className={`truncate text-xs font-semibold ${ganttTextClass}`}>
                                          {event.organization}
                                        </span>
                                      </div>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </CardBody>
                          </Card>
                        );
                      })
                    )}
                  </div>
                )}
                {managementViewMode === 'function' && (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                      <h5 className="font-semibold text-lg sm:text-xl">📋 Provisional Function Schedule</h5>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          color="primary" 
                          variant="flat"
                          className="flex-1 sm:flex-none min-w-[120px]"
                          onPress={() => exportManagementFunctionSchedulePDF()}
                        >
                          📄 Export PDF
                        </Button>
                        <Button 
                          size="sm" 
                          color="secondary" 
                          variant="flat"
                          className="flex-1 sm:flex-none min-w-[120px]"
                          onPress={() => downloadManagementFunctionScheduleCSV()}
                        >
                          📊 Download CSV
                        </Button>
                        <Button 
                          size="sm" 
                          color="success" 
                          variant="flat"
                          className="flex-1 sm:flex-none min-w-[120px]"
                          onPress={() => {
                            const csv = filteredManagedEvents.map((e: any, i: number) => 
                              `${i + 1},${e.organization},${e.eventName},${e.arrivalDate},${e.departureDate}`
                            ).join('\n');
                            navigator.clipboard.writeText(csv);
                            alert('Function schedule copied to clipboard!');
                          }}
                        >
                          📧 Send to Departments
                        </Button>
                        <Button 
                          size="sm" 
                          color="warning" 
                          variant="flat"
                          className="flex-1 sm:flex-none min-w-[120px]"
                          onPress={() => window.print()}
                        >
                          🖨️ Print Schedule
                        </Button>
                      </div>
                    </div>
                    
                    {/* Live Data Status */}
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600">📊</span>
                        <span className="text-sm text-blue-800">
                          <strong>Live Data:</strong> {filteredManagedEvents.length} confirmed events loaded • Last updated: {new Date().toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    {/* Function Schedule Table */}
                    <div className="overflow-x-auto">
                      <Table aria-label="Function schedule table" className="min-w-full">
                        <TableHeader>
                          <TableColumn>ITEM</TableColumn>
                          <TableColumn>ARRIVAL DATE</TableColumn>
                          <TableColumn>DEPARTURE DATE</TableColumn>
                          <TableColumn>ORGANIZATION</TableColumn>
                          <TableColumn>PROG TYPE</TableColumn>
                          <TableColumn>NO. OF PAX</TableColumn>
                          <TableColumn>NO. OF RMS</TableColumn>
                          <TableColumn>ROOM NIGHTS</TableColumn>
                          <TableColumn>CONFERENCE DAYS</TableColumn>
                          <TableColumn>EVENT VENUE</TableColumn>
                          <TableColumn>FOOD & BEVERAGE</TableColumn>
                          <TableColumn>HOUSEKEEPING/FRONT DESK</TableColumn>
                          <TableColumn>RESERVATION STATUS</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {filteredManagedEvents.length > 0 ? (
                            filteredManagedEvents.map((event, index) => {
                              const arrivalDate = new Date(event.arrivalDate);
                              const departureDate = new Date(event.departureDate);
                              const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                              const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                              
                              const formatDate = (date: Date) => {
                                const dayName = dayNames[date.getDay()];
                                const day = date.getDate();
                                const month = months[date.getMonth()];
                                const getDaySuffix = (day: number) => {
                                  if (day >= 11 && day <= 13) return 'TH';
                                  switch (day % 10) {
                                    case 1: return 'ST';
                                    case 2: return 'ND';
                                    case 3: return 'RD';
                                    default: return 'TH';
                                  }
                                };
                                return `${dayName} ${day}${getDaySuffix(day)} ${month}`;
                              };
                              
                              const getEventTypeLabel = (type: string) => {
                                switch (type) {
                                  case 'conference': return 'RESIDENTIAL CONFERENCE';
                                  case 'workshop': return 'RESIDENTIAL WORKSHOP';
                                  case 'training': return 'NON RESIDENTIAL CONFERENCE';
                                  case 'residential-conference': return 'RESIDENTIAL CONFERENCE';
                                  case 'non-residential': return 'NON RESIDENTIAL CONFERENCE';
                                  case 'residential-workshop': return 'RESIDENTIAL WORKSHOP';
                                  case 'residential': return 'RESIDENTIAL CONFERENCE';
                                  default: return 'CONFERENCE';
                                }
                              };
                              
                              const getFoodBeverageServices = (event: any) => {
                                const services = [];
                                if (event.duration > 0) services.push('ARRIVAL DINNER');
                                if (event.duration > 1) {
                                  services.push('MORNING SNACK', 'LUNCH');
                                  if (event.duration > 2) services.push('AFTERNOON SNACK', 'DINNER');
                                }
                                return services.join(', ');
                              };
                              
                              const getHousekeepingNotes = (event: any) => {
                                if (event.residential) {
                                  return `PREPARE ${event.pax} ROOMS`;
                                }
                                return 'N/A';
                              };
                              
                              const getStatusBadge = (status: string) => {
                                const normalized = normalizeStatus(status);
                                switch (normalized) {
                                  case 'quote':
                                    return <Badge color="warning" variant="flat">QUOTE</Badge>;
                                  case 'confirmed':
                                    return <Badge color="success" variant="flat">CONFIRMED</Badge>;
                                  case 'invoiced':
                                    return <Badge color="primary" variant="flat">INVOICED</Badge>;
                                  case 'cancelled':
                                    return <Badge color="danger" variant="flat">CANCELLED</Badge>;
                                  default:
                                    return <Badge color="default" variant="flat">{String(normalized || '').toUpperCase()}</Badge>;
                                }
                              };
                              
                              return (
                                <TableRow key={event.id} className="hover:bg-gray-50 cursor-pointer">
                                  <TableCell className="text-center font-medium">{index + 1}</TableCell>
                                  <TableCell className="text-center">
                                    <div className="font-medium">{formatDate(arrivalDate)}</div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="font-medium">{formatDate(departureDate)}</div>
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{event.organization}</p>
                                      <p className="text-xs text-gray-600">{event.eventName}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge color="primary" variant="flat" className="text-xs">
                                      {getEventTypeLabel(event.eventType)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center font-medium">{event.pax}</TableCell>
                                  <TableCell className="text-center">
                                    {event.residential ? event.pax : 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {event.residential ? event.duration * event.pax : 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-center font-medium">{event.duration}</TableCell>
                                  <TableCell>
                                    <Badge color="secondary" variant="flat">{event.venueName}</Badge>
                                  </TableCell>
                                  <TableCell className="max-w-xs">
                                    <div className="text-xs text-gray-700">
                                      {getFoodBeverageServices(event)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-xs">
                                    <div className="text-xs text-gray-700">
                                      {getHousekeepingNotes(event)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {getStatusBadge(event.status)}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={13} className="text-center py-8">
                                <div className="text-gray-500">
                                  <div className="text-2xl mb-2">📅</div>
                                  <p>No confirmed events found</p>
                                  <p className="text-sm">Events will appear here when added to the system</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </Tab>
          <Tab key="active" title="🟢 Active Events">
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-lg font-semibold">Active Events</h3>
                  <Badge content={filteredManagedEvents.filter((e: any) => e.eventStatus === 'confirmed' || e.eventStatus === 'in-progress').length} color="primary">
                    <span className="text-sm text-gray-600">Total Events</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardBody>
                <Table aria-label="Confirmed events table">
                  <TableHeader>
                    <TableColumn key="eventName">
                      {renderSortableHeader('EVENT', 'eventName', activeEventsSort, handleActiveEventsSort)}
                    </TableColumn>
                    <TableColumn key="organization">
                      {renderSortableHeader('ORGANIZATION', 'organization', activeEventsSort, handleActiveEventsSort)}
                    </TableColumn>
                    <TableColumn key="dates">
                      {renderSortableHeader('DATES', 'dates', activeEventsSort, handleActiveEventsSort)}
                    </TableColumn>
                    <TableColumn key="venueName">
                      {renderSortableHeader('VENUE', 'venueName', activeEventsSort, handleActiveEventsSort)}
                    </TableColumn>
                    <TableColumn key="duration">
                      {renderSortableHeader('DAYS', 'duration', activeEventsSort, handleActiveEventsSort)}
                    </TableColumn>
                    <TableColumn key="pax">
                      {renderSortableHeader('PAX', 'pax', activeEventsSort, handleActiveEventsSort)}
                    </TableColumn>
                    <TableColumn key="budget">
                      {renderSortableHeader('BUDGET', 'budget', activeEventsSort, handleActiveEventsSort)}
                    </TableColumn>
                    <TableColumn key="status">
                      {renderSortableHeader('STATUS', 'status', activeEventsSort, handleActiveEventsSort)}
                    </TableColumn>
                    <TableColumn key="actions">ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {paginatedActiveEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                          <div>
                            <span className="text-4xl">📅</span>
                            <p className="mt-2">No active confirmed events found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedActiveEvents
                        .filter((event: any) => {
                          if (!event || !event.id) {
                            console.warn('[Active Events] Skipping event with missing id:', event);
                            return false;
                          }
                          return true;
                        })
                        .map((event: any) => {
                          const durationDays = computeEventDurationDays(event);
                          return (
                        <TableRow key={event.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{event.eventName || 'Unnamed Event'}</p>
                              <p className="text-xs text-gray-500">ID: {formatEventId(event.id)}</p>
                            </div>
                          </TableCell>
                          <TableCell>{event.organization || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {(() => {
                                try {
                                  const arrival = event.arrivalDate || event.startDate;
                                  const departure = event.departureDate || event.endDate;
                                  return (
                                    <>
                                      <p>{arrival ? new Date(arrival).toLocaleDateString() : 'N/A'}</p>
                                      <p className="text-gray-500">to {departure ? new Date(departure).toLocaleDateString() : 'N/A'}</p>
                                    </>
                                  );
                                } catch (e) {
                                  return (
                                    <>
                                      <p>N/A</p>
                                      <p className="text-gray-500">to N/A</p>
                                    </>
                                  );
                                }
                              })()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge color="secondary" variant="flat">{event.venueName || 'N/A'}</Badge>
                          </TableCell>
                              <TableCell className="text-center">
                                <Chip size="sm" variant="flat" color="warning">
                                  {durationDays} day{durationDays === 1 ? '' : 's'}
                                </Chip>
                              </TableCell>
                          <TableCell className="text-center">{event.pax || event.expectedPax || 0}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(event.budgetTotal || 0)}</TableCell>
                          <TableCell>
                            <Chip color={getConfirmedStatusColor(event.eventStatus || event.status || 'confirmed') as any} size="sm" variant="flat">
                              {getConfirmedStatusLabel(event.eventStatus || event.status || 'confirmed')}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                onPress={() => openEventForEdit(event, true)}
                              >
                                View
                              </Button>
                              {event.eventStatus !== 'completed' && event.eventStatus !== 'billed' && (
                                <Button
                                  size="sm"
                                  color="default"
                                  variant="flat"
                                  onPress={() => handleMarkEventAsCompleted(event)}
                                >
                                  ✅ Complete
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>
                {activeEventsPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      total={activeEventsPages}
                      page={activeEventsPage}
                      onChange={setActiveEventsPage}
                      color="primary"
                      showControls
                    />
                  </div>
                )}
              </CardBody>
            </Card>
          </Tab>
          <Tab key="completed" title="✅ Completed Events">
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-lg font-semibold">Completed Events</h3>
                  <Badge content={filteredManagedEvents.filter((e: any) => e.eventStatus === 'completed' || e.eventStatus === 'billed').length} color="primary">
                    <span className="text-sm text-gray-600">Total Events</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardBody>
                <Table aria-label="Completed events table">
                  <TableHeader>
                    <TableColumn key="eventName">
                      {renderSortableHeader('EVENT', 'eventName', completedEventsSort, handleCompletedEventsSort)}
                    </TableColumn>
                    <TableColumn key="organization">
                      {renderSortableHeader('ORGANIZATION', 'organization', completedEventsSort, handleCompletedEventsSort)}
                    </TableColumn>
                    <TableColumn key="dates">
                      {renderSortableHeader('DATES', 'dates', completedEventsSort, handleCompletedEventsSort)}
                    </TableColumn>
                    <TableColumn key="venueName">
                      {renderSortableHeader('VENUE', 'venueName', completedEventsSort, handleCompletedEventsSort)}
                    </TableColumn>
                    <TableColumn key="duration">
                      {renderSortableHeader('DAYS', 'duration', completedEventsSort, handleCompletedEventsSort)}
                    </TableColumn>
                    <TableColumn key="pax">
                      {renderSortableHeader('PAX', 'pax', completedEventsSort, handleCompletedEventsSort)}
                    </TableColumn>
                    <TableColumn key="budget">
                      {renderSortableHeader('QUOTE (₵)', 'budget', completedEventsSort, handleCompletedEventsSort)}
                    </TableColumn>
                    <TableColumn key="actual">
                      {renderSortableHeader('INVOICE (₵)', 'actual', completedEventsSort, handleCompletedEventsSort)}
                    </TableColumn>
                    <TableColumn key="variance">
                      {renderSortableHeader('VARIANCE (₵)', 'variance', completedEventsSort, handleCompletedEventsSort)}
                    </TableColumn>
                    <TableColumn key="status">
                      {renderSortableHeader('STATUS', 'status', completedEventsSort, handleCompletedEventsSort)}
                    </TableColumn>
                    <TableColumn key="actions">ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {paginatedCompletedEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                          <div>
                            <span className="text-4xl">✅</span>
                            <p className="mt-2">No completed events found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedCompletedEvents.map((event: any) => {
                        const durationDays = computeEventDurationDays(event);
                        return (
                        <TableRow key={event.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{event.eventName}</p>
                              <p className="text-xs text-gray-500">ID: {formatEventId(event.id)}</p>
                            </div>
                          </TableCell>
                          <TableCell>{event.organization}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{new Date(event.arrivalDate || event.startDate).toLocaleDateString()}</p>
                              <p className="text-gray-500">to {new Date(event.departureDate || event.endDate).toLocaleDateString()}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge color="secondary" variant="flat">{event.venueName}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Chip size="sm" variant="flat" color="warning">
                              {durationDays} day{durationDays === 1 ? '' : 's'}
                            </Chip>
                          </TableCell>
                          <TableCell className="text-center">{event.pax || event.expectedPax || 0}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(event.budgetTotal || event.quoteTotal || 0)}</TableCell>
                          <TableCell>
                            {event.invoiceTotal || event.actualTotal ? (
                              <span className="font-semibold">
                                {formatCurrency(event.invoiceTotal || event.actualTotal || 0)}
                                {event.invoiceCount > 1 && (
                                  <span className="text-xs text-gray-500 ml-1">({event.invoiceCount} invoices)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">No invoice</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {event.variance !== undefined ? (
                              <span className={event.variance >= 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                                {event.variance >= 0 ? '+' : ''}{formatCurrency(event.variance)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip color={getConfirmedStatusColor(event.eventStatus) as any} size="sm" variant="flat">
                              {getConfirmedStatusLabel(event.eventStatus)}
                            </Chip>
                          </TableCell>
                          {/* Invoice column removed – use Invoices tab and Folio for invoice actions */}
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                color="secondary"
                                variant="flat"
                                onPress={() => handleOpenEventFolio(event)}
                              >
                                📂 Folio
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                      })
                    )}
                  </TableBody>
                </Table>
                {completedEventsPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      total={completedEventsPages}
                      page={completedEventsPage}
                      onChange={setCompletedEventsPage}
                      color="primary"
                      showControls
                    />
                  </div>
                )}
              </CardBody>
            </Card>
          </Tab>
          <Tab key="invoices" title="🧾 Invoices">
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Invoices</h3>
                    <Badge 
                      color={getEventStatusContext() === 'active' ? 'success' : 'default'} 
                      variant="flat"
                      size="sm"
                    >
                      {getEventStatusContext() === 'active' ? '🟢 Active Events' : '✅ Completed Events'}
                    </Badge>
                  </div>
                  <Badge content={managementFilteredInvoices.length} color="primary" variant="flat">
                    <span className="text-sm text-gray-600">Total</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Input
                      size="sm"
                      label="Search invoices"
                      placeholder="Invoice number, event or client"
                      value={managementInvoiceSearch}
                      onValueChange={setManagementInvoiceSearch}
                      className="w-full md:w-80"
                    />
                    {/* No standalone “New Invoice” here – creation lives in the folio workflow */}
                  </div>
                  <Table aria-label="Event invoices" className="text-sm">
                    <TableHeader>
                      <TableColumn key="invoiceId">
                        {renderSortableHeader('Invoice', 'invoiceId', invoiceSort, handleInvoiceSort)}
                      </TableColumn>
                      <TableColumn key="eventName">
                        {renderSortableHeader('Event & Client', 'eventName', invoiceSort, handleInvoiceSort)}
                      </TableColumn>
                      <TableColumn key="issueDate">
                        {renderSortableHeader('Issued', 'issueDate', invoiceSort, handleInvoiceSort)}
                      </TableColumn>
                      <TableColumn key="dueDate">
                        {renderSortableHeader('Due', 'dueDate', invoiceSort, handleInvoiceSort)}
                      </TableColumn>
                      <TableColumn key="total">
                        {renderSortableHeader('Total', 'total', invoiceSort, handleInvoiceSort)}
                      </TableColumn>
                      <TableColumn key="balance">
                        {renderSortableHeader('Outstanding', 'balance', invoiceSort, handleInvoiceSort)}
                      </TableColumn>
                      <TableColumn key="status">
                        {renderSortableHeader('Status', 'status', invoiceSort, handleInvoiceSort)}
                      </TableColumn>
                      <TableColumn key="actions">Actions</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No invoices recorded yet">
                      {paginatedInvoices.map(invoice => (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            <div className="font-semibold text-ghana-black">{invoice.id}</div>
                            <div className="text-xs text-gray-500">{invoice.reference || '—'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{invoice.eventName}</div>
                            <div className="text-xs text-gray-500">{invoice.clientName}</div>
                          </TableCell>
                          <TableCell>{formatDateDisplay(invoice.issueDate)}</TableCell>
                          <TableCell>{formatDateDisplay(invoice.dueDate)}</TableCell>
                          <TableCell>{formatCurrency(invoice.total)}</TableCell>
                          <TableCell>{formatCurrency(invoice.balance)}</TableCell>
                          <TableCell>
                            <Badge color={invoiceStatusMeta[invoice.status].color} variant="flat" size="sm">
                              {invoiceStatusMeta[invoice.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                onPress={() => {
                                  setSelectedTab('completed');
                                  openInvoiceFromTable(invoice);
                                }}
                              >
                                ✏️ Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="flat"
                                color="default"
                                onPress={() => {
                                  const relatedEvent = managedEvents.find((e: any) => e.id === invoice.eventId) || allEvents.find((e: any) => e.id === invoice.eventId);
                                  if (!relatedEvent) {
                                    alert('Could not find the related event for this invoice. It may have been removed.');
                                    return;
                                  }
                                  handleOpenEventFolio(relatedEvent);
                                }}
                              >
                                📂 Folio
                              </Button>
                              <Button
                                size="sm"
                                variant="flat"
                                color="secondary"
                                onPress={() => handleDownloadInvoicePdf(invoice)}
                              >
                                📄 PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {invoicesPages > 1 && (
                    <div className="flex justify-center mt-4">
                      <Pagination
                        total={invoicesPages}
                        page={invoicesPage}
                        onChange={setInvoicesPage}
                        color="primary"
                        showControls
                      />
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </Tab>
          <Tab key="receipts" title="💳 Receipts">
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Receipts</h3>
                    <Badge 
                      color={getEventStatusContext() === 'active' ? 'success' : 'default'} 
                      variant="flat"
                      size="sm"
                    >
                      {getEventStatusContext() === 'active' ? '🟢 Active Events' : '✅ Completed Events'}
                    </Badge>
                  </div>
                  <Badge content={managementFilteredReceipts.length} color="success" variant="flat">
                    <span className="text-sm text-gray-600">Total</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Input
                      size="sm"
                      label="Search receipts"
                      placeholder="Receipt number, event or reference"
                      value={managementReceiptSearch}
                      onValueChange={setManagementReceiptSearch}
                      className="w-full md:w-80"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        color="success"
                        variant="flat"
                        onPress={() => openReceiptModal('create')}
                      >
                        ➕ Record Receipt
                      </Button>
                    </div>
                  </div>
                  <Table aria-label="Confirmed event receipts" className="text-sm">
                    <TableHeader>
                      <TableColumn key="receiptId">
                        {renderSortableHeader('Receipt', 'receiptId', receiptSort, handleReceiptSort)}
                      </TableColumn>
                      <TableColumn key="eventName">
                        {renderSortableHeader('Event & Client', 'eventName', receiptSort, handleReceiptSort)}
                      </TableColumn>
                      <TableColumn key="date">
                        {renderSortableHeader('Date', 'date', receiptSort, handleReceiptSort)}
                      </TableColumn>
                      <TableColumn key="amount">
                        {renderSortableHeader('Amount', 'amount', receiptSort, handleReceiptSort)}
                      </TableColumn>
                      <TableColumn key="method">
                        {renderSortableHeader('Method', 'method', receiptSort, handleReceiptSort)}
                      </TableColumn>
                      <TableColumn key="reference">
                        {renderSortableHeader('Reference', 'reference', receiptSort, handleReceiptSort)}
                      </TableColumn>
                      <TableColumn key="invoiceId">
                        {renderSortableHeader('Invoice', 'invoiceId', receiptSort, handleReceiptSort)}
                      </TableColumn>
                      <TableColumn key="actions">Actions</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No receipts recorded yet">
                      {paginatedReceipts.map(receipt => (
                        <TableRow key={receipt.id}>
                          <TableCell>
                            <div className="font-semibold text-ghana-black">{receipt.id}</div>
                            <div className="text-xs text-gray-500">{receipt.recordedBy}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{receipt.eventName}</div>
                            <div className="text-xs text-gray-500">{receipt.clientName}</div>
                          </TableCell>
                          <TableCell>{formatDateDisplay(receipt.date)}</TableCell>
                          <TableCell>{formatCurrency(receipt.amount)}</TableCell>
                          <TableCell>
                            <Badge color={receiptMethodColors[receipt.method]} variant="flat" size="sm">
                              {receipt.method}
                            </Badge>
                          </TableCell>
                          <TableCell>{receipt.reference || '—'}</TableCell>
                          <TableCell>{receipt.invoiceId || '—'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                onPress={() => openReceiptModal('edit', receipt)}
                              >
                                ✏️ Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="flat"
                                color="secondary"
                                onPress={() => handleDownloadReceiptPdf(receipt)}
                              >
                                📄 PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {receiptsPages > 1 && (
                    <div className="flex justify-center mt-4">
                      <Pagination
                        total={receiptsPages}
                        page={receiptsPage}
                        onChange={setReceiptsPage}
                        color="success"
                        showControls
                      />
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </Tab>
          <Tab key="quotes" title="📑 Quotes / Proforma">
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Quotes & Proforma Invoices</h3>
                    <Badge 
                      color={getEventStatusContext() === 'active' ? 'success' : 'default'} 
                      variant="flat"
                      size="sm"
                    >
                      {getEventStatusContext() === 'active' ? '🟢 Active Events' : '✅ Completed Events'}
                    </Badge>
                  </div>
                  <Badge content={managementFilteredQuotes.length} color="warning" variant="flat">
                    <span className="text-sm text-gray-600">Total</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Input
                      size="sm"
                      label="Search quotes"
                      placeholder="Quote number, event or client"
                      value={managementQuoteSearch}
                      onValueChange={setManagementQuoteSearch}
                      className="w-full md:w-80"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        onPress={() => {
                          setEditingQuote(null);
                          setIsQuoteModalOpen(true);
                        }}
                      >
                        ➕ New Quote
                      </Button>
                    </div>
                  </div>
                  <Table aria-label="Event quotes and proformas" className="text-sm">
                    <TableHeader>
                      <TableColumn key="quoteNumber">
                        {renderSortableHeader('Quote ID', 'quoteNumber', quoteSort, handleQuoteSort)}
                      </TableColumn>
                      <TableColumn key="clientName">
                        {renderSortableHeader('Client Name', 'clientName', quoteSort, handleQuoteSort)}
                      </TableColumn>
                      <TableColumn key="eventName">
                        {renderSortableHeader('Event Name', 'eventName', quoteSort, handleQuoteSort)}
                      </TableColumn>
                      <TableColumn key="venueName">
                        {renderSortableHeader('Venue', 'venueName', quoteSort, handleQuoteSort)}
                      </TableColumn>
                      <TableColumn key="checkIn">
                        {renderSortableHeader('Check-In', 'checkIn', quoteSort, handleQuoteSort)}
                      </TableColumn>
                      <TableColumn key="checkOut">
                        {renderSortableHeader('Check-Out', 'checkOut', quoteSort, handleQuoteSort)}
                      </TableColumn>
                      <TableColumn key="pax">
                        {renderSortableHeader('PAX', 'pax', quoteSort, handleQuoteSort)}
                      </TableColumn>
                      <TableColumn key="issuedOn">
                        {renderSortableHeader('Issued', 'issuedOn', quoteSort, handleQuoteSort)}
                      </TableColumn>
                      <TableColumn key="amount">
                        {renderSortableHeader('Amount (₵)', 'amount', quoteSort, handleQuoteSort)}
                      </TableColumn>
                      <TableColumn key="actions">Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {paginatedQuotes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-gray-500 py-10">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-3xl">📑</span>
                              <p className="font-medium">No quotes found</p>
                              <p className="text-sm">Create a new quote to get started.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedQuotes.map((quote: QuoteListItem) => (
                          <TableRow key={quote.id}>
                            <TableCell>
                              <div className="font-semibold text-ghana-black">{quote.quoteNumber}</div>
                              <div className="text-xs text-gray-500">{quote.reference || '—'}</div>
                            </TableCell>
                            <TableCell>{quote.clientName}</TableCell>
                            <TableCell>{quote.eventName}</TableCell>
                            <TableCell>{quote.venueName || 'N/A'}</TableCell>
                            <TableCell>{quote.checkIn ? formatDateDisplay(quote.checkIn) : '—'}</TableCell>
                            <TableCell>{quote.checkOut ? formatDateDisplay(quote.checkOut) : '—'}</TableCell>
                            <TableCell>{quote.pax || 0}</TableCell>
                            <TableCell>{quote.issuedOn ? formatDateDisplay(quote.issuedOn) : '—'}</TableCell>
                            <TableCell>{formatCurrency(quote.total)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  onPress={() => openEventForEdit(quote.rawEvent, true)}
                                >
                                  ✏️ Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="secondary"
                                  onPress={() => handleDownloadQuotePdf(quote.rawEvent)}
                                >
                                  📄 PDF
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {quotesPages > 1 && (
                    <div className="flex justify-center mt-4">
                      <Pagination
                        total={quotesPages}
                        page={quotesPage}
                        onChange={setQuotesPage}
                        color="warning"
                        showControls
                      />
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </Tab>
          <Tab key="folios" title="📂 Folios">
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Folios</h3>
                    <Badge 
                      color={getEventStatusContext() === 'active' ? 'success' : 'default'} 
                      variant="flat"
                      size="sm"
                    >
                      {getEventStatusContext() === 'active' ? '🟢 Active Events' : '✅ Completed Events'}
                    </Badge>
                  </div>
                  <Badge content={managementFilteredFolios.length} color="secondary" variant="flat">
                    <span className="text-sm text-gray-600">Total</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Input
                      size="sm"
                      label="Search folios"
                      placeholder="Folio number, event or client"
                      value={managementFolioSearch}
                      onValueChange={setManagementFolioSearch}
                      className="w-full md:w-80"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        color="secondary"
                        variant="flat"
                        onPress={() => {
                          // Use only active events (confirmed/in-progress)
                          const activeEvents = managedEvents.filter((e: any) => e.eventStatus === 'confirmed' || e.eventStatus === 'in-progress');
                          const eventOptions = activeEvents.map((e: any) => ({ id: e.id, name: e.eventName }));
                          setFolioCreateForm({ eventId: eventOptions[0]?.id || '', openingBalance: 0, note: '' });
                          setFolioCreateError('');
                          setIsFolioCreateModalOpen(true);
                        }}
                      >
                        ➕ Generate Folio
                      </Button>
                    </div>
                  </div>
                  <Table aria-label="Confirmed event folios" className="text-sm">
                    <TableHeader>
                      <TableColumn key="folioId">
                        {renderSortableHeader('Folio', 'folioId', folioSort, handleFolioSort)}
                      </TableColumn>
                      <TableColumn key="eventName">
                        {renderSortableHeader('Event', 'eventName', folioSort, handleFolioSort)}
                      </TableColumn>
                      <TableColumn key="clientName">
                        {renderSortableHeader('Client', 'clientName', folioSort, handleFolioSort)}
                      </TableColumn>
                      <TableColumn key="status">
                        {renderSortableHeader('Status', 'status', folioSort, handleFolioSort)}
                      </TableColumn>
                      <TableColumn key="charges">
                        {renderSortableHeader('Charges', 'charges', folioSort, handleFolioSort)}
                      </TableColumn>
                      <TableColumn key="payments">
                        {renderSortableHeader('Payments', 'payments', folioSort, handleFolioSort)}
                      </TableColumn>
                      <TableColumn key="balance">
                        {renderSortableHeader('Balance', 'balance', folioSort, handleFolioSort)}
                      </TableColumn>
                      <TableColumn key="updatedAt">
                        {renderSortableHeader('Updated', 'updatedAt', folioSort, handleFolioSort)}
                      </TableColumn>
                      <TableColumn key="actions">Actions</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No folios yet">
                      {paginatedFolios.map(folio => {
                        const totals = calculateFolioTotals(folio);
                        const balance = getFolioCurrentBalance(folio);
                        const statusColor = folio.status === 'Open' ? 'warning' : 'success';
                        return (
                          <TableRow key={folio.id}>
                            <TableCell>
                              <div className="font-semibold text-ghana-black">{folio.id}</div>
                              <div className="text-xs text-gray-500">{formatDateDisplay(folio.createdAt)}</div>
                            </TableCell>
                            <TableCell>{folio.eventName}</TableCell>
                            <TableCell>{folio.clientName || '—'}</TableCell>
                            <TableCell>
                              <Badge color={statusColor} variant="flat" size="sm">
                                {folio.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(totals.debits)}</TableCell>
                            <TableCell>{formatCurrency(totals.credits)}</TableCell>
                            <TableCell>{formatCurrency(balance)}</TableCell>
                            <TableCell>{formatDateDisplay(folio.updatedAt)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  onPress={() => openFolioDetails(folio)}
                                >
                                  📄 View
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {foliosPages > 1 && (
                    <div className="flex justify-center mt-4">
                      <Pagination
                        total={foliosPages}
                        page={foliosPage}
                        onChange={setFoliosPage}
                        color="secondary"
                        showControls
                      />
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </Tab>
        </Tabs>
      </div>
    );
  };

  const getFilteredAndSortedEvents = () => {
    let filteredEvents = allEvents;

    if (searchTerm) {
      filteredEvents = filteredEvents.filter(event => 
        event.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.venueName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateRange.startDate && dateRange.endDate) {
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.arrivalDate) >= new Date(dateRange.startDate) &&
        new Date(event.departureDate) <= new Date(dateRange.endDate)
      );
    }

    if (programmeTypeFilter !== 'all') {
      filteredEvents = filteredEvents.filter(event => 
        event.eventType === programmeTypeFilter
      );
    }

    return filteredEvents.sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());
  };

  // Client Management Functions
  const handleClientAction = (action: string, client: any) => {
    trackEvent('Analytics.ActionClicked', { action: 'EventsClientAction', clientAction: action, clientId: client.id });
    setSelectedClient(client);
    
    switch (action) {
      case 'view':
        setIsClientViewModalOpen(true);
        break;
      case 'contract':
        setSelectedContractEventInfo(null);
        setIsContractModalOpen(true);
        break;
      case 'edit':
        setIsClientEditModalOpen(true);
        break;
      default:
        break;
    }
  };

  const generateClientContract = (client: any) => {
    // Generate contract with negotiated rates
    const contractData = {
      clientName: client.name,
      organization: client.organization,
      contractStart: client.contractStart,
      contractEnd: client.contractEnd,
      rates: client.rates,
      specialTerms: client.specialTerms,
      generatedDate: new Date().toISOString().split('T')[0]
    };
    
    console.log('Contract generated:', contractData);
    // Here you would typically open a contract modal or generate PDF
  };

  const handleContractDownload = () => {
    if (!selectedClient) return;
    openContractPrintableWindow(selectedClient, selectedContractEventInfo, 'download');
    trackEvent('Analytics.ActionClicked', { action: 'ContractDownloaded', clientId: selectedClient.id });
  };

  const handleContractPrint = () => {
    if (!selectedClient) return;
    openContractPrintableWindow(selectedClient, selectedContractEventInfo, 'print');
    trackEvent('Analytics.ActionClicked', { action: 'ContractPrinted', clientId: selectedClient.id });
  };

  // Removed local add-client modal; creation now redirects to canonical form

  const handleClientEdit = () => {
    // Handle client edit
    setIsClientEditModalOpen(false);
    trackEvent('Analytics.ActionClicked', { action: 'EventsClientEdited', clientId: selectedClient?.id });
    console.log('Client edited successfully');
  };
  return (
    <>
      <div className="p-6">
      {/* Removed top notices; bottom section contains notices & activities */}
      <DeptMessenger from="events" mode="drawer" />
      
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">🎉 Events & Conferences Management</h2>
        <div className="flex items-center gap-3">
          <Badge color="success" variant="flat">✔ Online</Badge>
          <Button 
            color="success" 
            variant="solid" 
            size="sm"
            onClick={openNewEventModal}
          >
            ➕ New Event
          </Button>
        </div>
      </div>
      {/* Venue Status Overview */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            🏢 Venue Status Overview ({totalVenues} Venues)
          </h3>
        </div>
        
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Available Venues */}
          <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Available Venues</h4>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-3">{availableVenues}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Conference Halls</span>
                  <span className="font-medium">2</span>
                </div>
                <div className="flex justify-between">
                  <span>Meeting Rooms</span>
                  <span className="font-medium">1</span>
                </div>
                <div className="flex justify-between">
                  <span>Auditoriums</span>
                  <span className="font-medium">0</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Booked Venues */}
          <Card className="border-0 shadow-lg border-l-4 border-l-red-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Booked Venues</h4>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-red-600 mb-3">{bookedVenues}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Today's Events</span>
                  <span className="font-medium">{eventsToday}</span>
                </div>
                <div className="flex justify-between">
                  <span>Setup in Progress</span>
                  <span className="font-medium">{setupInProgress}</span>
                </div>
                <div className="flex justify-between">
                  <span>VIP Events</span>
                  <span className="font-medium">1</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Financial Performance */}
          <Card className="border-0 shadow-lg border-l-4 border-l-purple-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Financial Performance</h4>
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-3">₵{monthlyRevenue.toLocaleString()}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Monthly Revenue</span>
                  <span className="font-medium">₵{monthlyRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Event Value</span>
                  <span className="font-medium">₵{averageEventValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Attendees</span>
                  <span className="font-medium">{totalAttendees}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Today's Event Operations */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h4 className="text-lg font-semibold text-ghana-black">Today's Event Operations</h4>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-medium">{eventsToday} Events</span>
                <span className="text-gray-500">Today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">{newBookings} New Bookings</span>
                <span className="text-gray-500">Received</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-medium">{setupInProgress} Setup</span>
                <span className="text-gray-500">In Progress</span>
              </div>
            </div>
          </div>
          <Button 
            color="success" 
            variant="solid"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setSelectedTab('venues')}
          >
            🏢 View Full Status
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-lg font-semibold text-ghana-black">Quick Actions</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            <Button
              color="warning"
              variant="flat"
              className="h-24 flex flex-col items-center justify-center gap-2 p-4"
              onClick={() => handleQuickAction('book_venue')}
            >
              <span className="text-2xl">🏢</span>
              <span className="font-medium">Book Venue</span>
              <span className="text-xs text-center opacity-80">Reserve venue space</span>
            </Button>
            <Button
              color="danger"
              variant="flat"
              className="h-24 flex flex-col items-center justify-center gap-2 p-4"
              onClick={() => handleQuickAction('catering')}
            >
              <span className="text-2xl">🍽️</span>
              <span className="font-medium">Catering</span>
              <span className="text-xs text-center opacity-80">Arrange food services</span>
            </Button>
            <Button
              color="primary"
              variant="flat"
              className="h-24 flex flex-col items-center justify-center gap-2 p-4"
              onClick={() => handleQuickAction('event_reports')}
            >
              <span className="text-2xl">📊</span>
              <span className="font-medium">Event Reports</span>
              <span className="text-xs text-center opacity-80">Generate event reports</span>
            </Button>
          </div>
        </CardBody>
      </Card>
      {/* Main Operations Interface */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Operations Overview</h3>
        </CardHeader>
        <CardBody>
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            aria-label="Events and conferences operations"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                {operationalItems.map((category, categoryIndex) => (
                  <Card key={categoryIndex} className="border border-gray-200 shadow-md">
                    <CardHeader className="pb-3">
                      <h4 className="text-lg font-semibold text-ghana-black">{category.category}</h4>
                    </CardHeader>
                    <CardBody className="pt-0">
                      <div className="space-y-3">
                        {category.items.map((item, itemIndex) => (
                          <div 
                            key={itemIndex}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-ghana-gold/10 cursor-pointer transition-colors"
                            onClick={() => {
                              // Handle navigation based on item type
                              if (item.title.includes('Event Calendar') || item.title.includes('Active Events')) {
                                setSelectedTab('events');
                              } else if (item.title.includes('Conference Halls') || item.title.includes('Meeting Rooms')) {
                                setSelectedTab('venues');
                              } else if (item.title.includes('Catering Services') || item.title.includes('Audio Visual')) {
                                setSelectedTab('services');
                              } else if (item.title.includes('Setup in Progress') || item.title.includes('Operations')) {
                                setSelectedTab('operations');
                              } else if (item.title.includes('Event Reports') || item.title.includes('Revenue Tracking')) {
                                setSelectedTab('reports');
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-xl">{item.icon}</span>
                              <div>
                                <div className="flex items-center">
                                  <InfoIcon description={item.description} />
                                  <p className="font-medium text-ghana-black">{item.title}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge 
                                color={item.status === 'active' ? 'success' : item.status === 'warning' ? 'warning' : 'default'}
                                variant="flat"
                              >
                                {item.status}
                              </Badge>
                              <Chip size="sm" variant="flat" color="primary">
                                {item.count}
                              </Chip>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </Tab>
            <Tab key="confirmed" title="📋 Event Management">
              <EventManagementTab />
            </Tab>
            <Tab key="venues" title="🏢 Venue Management">
              <div className="space-y-6 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-ghana-black">Venue Management</h3>
                  <Button 
                    color="success" 
                    variant="solid"
                    onClick={() => openVenueModal(null)}
                  >
                    ➕ New Venue
                  </Button>
                </div>

                {/* Venues Table */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">All Venues</h4>
                  </CardHeader>
                  <CardBody>
                    <Table aria-label="Venues table">
                      <TableHeader>
                        <TableColumn>Venue</TableColumn>
                        <TableColumn>Type</TableColumn>
                        <TableColumn>Capacity</TableColumn>
                        <TableColumn>Price/Day</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Features</TableColumn>
                        <TableColumn>Actions</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {modernVenues.map((venue) => (
                          <TableRow key={venue.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{venue.name}</p>
                                <p className="text-sm text-gray-600">{venue.location}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge color="primary" variant="flat">{venue.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Chip size="sm" variant="flat" color="primary">
                                {venue.capacity} people
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">₵{(venue.basePrice || 0).toLocaleString()}</span>
                            </TableCell>
                            <TableCell>
                              <Badge color={getStatusColor(venue.status) as any} variant="flat">
                                {venue.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {venue.features.slice(0, 2).map((feature, index) => (
                                  <Chip key={index} size="sm" variant="flat" color="secondary">
                                    {feature}
                                  </Chip>
                                ))}
                                {venue.features.length > 2 && (
                                  <Chip size="sm" variant="flat" color="default">
                                    +{venue.features.length - 2} more
                                  </Chip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  color="primary" 
                                  variant="flat"
                                  onClick={() => openVenueModal(venue)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  color="danger"
                                  variant="flat"
                                  onClick={() => handleDeleteVenue(venue)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardBody>
                </Card>
              </div>
            </Tab>
            <Tab key="quoting" title="💰 Guest Rates">
              <ConferenceRateManagement />
            </Tab>
            <Tab key="reports" title="📊 Reports & Analytics">
              <div className="space-y-6 mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-1 border border-gray-200 h-full">
                    <CardHeader className="flex flex-col gap-1">
                      <h4 className="font-semibold text-ghana-black flex items-center gap-2">
                        <span>{selectedReportCategory?.icon || '📁'}</span>
                        Report Explorer
                      </h4>
                      <p className="text-xs text-gray-500">
                        Full catalog of event sales, venue ops, guest, and finance analytics.
                      </p>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      <Input
                        label="Search reports"
                        placeholder="Pipeline, BEO, Folio..."
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
                              Document: {selectedVoucherType?.label}
                            </Chip>
                            <Chip size="sm" variant="flat" color="success">
                              Date: {reportFilters.fromDate} → {reportFilters.toDate}
                            </Chip>
                          </div>
                        </div>
                    </CardHeader>
                      <CardBody className="space-y-6">
                        {selectedCategoryLinks.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedCategoryLinks.map(link => (
                              <Button
                                key={link.label}
                                size="sm"
                                variant="flat"
                                color="secondary"
                                onPress={link.action}
                                startContent={link.icon}
                              >
                                {link.label}
                              </Button>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedReport?.filters.voucherType && (
                            <Select
                              label="Document Type"
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
                          {selectedReport?.filters.user && (
                            <Input
                              label="Event Owner / Planner"
                              placeholder="Sales owner, event lead"
                              value={reportFilters.user}
                              onValueChange={value => updateReportFilter('user', value)}
                            />
                          )}
                          {selectedReport?.filters.room && (
                            <Input
                              label="Venue / Space"
                              placeholder="e.g. Ghana Banquet Hall"
                              value={reportFilters.room}
                              onValueChange={value => updateReportFilter('room', value)}
                            />
                          )}
                          {selectedReport?.filters.service && (
                            <Select
                              label="Service Track / Package"
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
                          {selectedReport?.filters.dateRange && (
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
                        {selectedReport?.filters.costCenters && (
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
                        {selectedReport?.filters.notes && (
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
                          <p className="text-sm text-gray-500">
                            Quick view of metric focus, filters, and distribution.
                          </p>
                        </div>
                    </CardHeader>
                      <CardBody className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <p className="text-xs uppercase text-gray-500">Document Type</p>
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
                        {selectedCategoryInsights.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-2">Live KPIs</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {selectedCategoryInsights.map(insight => (
                                <div key={insight.label} className="rounded-lg border border-gray-200 p-3 bg-white">
                                  <p className="text-xs uppercase text-gray-500">{insight.label}</p>
                                  <p className="text-lg font-semibold text-ghana-black">{insight.value}</p>
                                  {insight.helper && (
                                    <p className="text-xs text-gray-500">{insight.helper}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
                            <span className="font-semibold text-ghana-black">Owner & Venue Filters</span>
                            <Chip size="sm" variant="flat" color="primary">
                              {reportFilters.user || 'Any owner'} · {reportFilters.room || 'All venues'}
                            </Chip>
                          </div>
                          {selectedReport?.filters.costCenters && (
                            <p>
                              Cost Centres: {selectedCostCenterLabels.length > 0 ? selectedCostCenterLabels.join(', ') : 'None'}
                            </p>
                          )}
                          {selectedReport?.filters.notes && reportFilters.notes && (
                            <p className="italic text-gray-500">Note: {reportFilters.notes}</p>
                          )}
                      </div>
                    </CardBody>
                  </Card>
                    <Card className="border border-gray-200">
                      <CardHeader>
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <h4 className="font-semibold text-ghana-black">Event Report Activity</h4>
                            <p className="text-sm text-gray-500">Preview, export, and schedule actions stay fully audited.</p>
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
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>

      <Modal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
          setIsCreatingEvent(false);
          setIsAdjustMode(false);
          setIsViewMode(false);
          setHoveredGanttEventId(null);
        }}
        size="5xl"
        scrollBehavior="inside"
      >
        <ModalContent className="mx-auto w-[65vw] max-w-[1200px] px-10 py-8">
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              <div>
                <h3 className="text-lg font-semibold">
                  {isCreatingEvent ? 'Create New Event' : isViewMode ? 'View Event' : 'Edit Event'}
                </h3>
                <p className="text-sm text-gray-600">Complete event booking following Ghanaian business process</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="px-[80] py-[42]">
            {/* Phase 1: Event Details & Client */}
            <div className="mb-8">
              <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                📋 Phase 1: Event Details & Client
              </h4>
              <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <Input
                  label="Event ID"
                  placeholder={isCreatingEvent ? "Auto-generated on save" : formatEventId(editingEvent?.id) || "—"}
                  value={formatEventId(editingEvent?.id) || (isCreatingEvent ? "" : "—")}
                  isReadOnly
                  className="font-semibold"
                  description={isCreatingEvent ? "Will be generated when you save" : "Event identifier"}
                />
                <Input
                  label="Event Name"
                  placeholder="e.g., Ghana Tech Conference 2024"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  isReadOnly={isViewMode}
                />
                <Autocomplete
                  label="Organization"
                  placeholder="Type at least 2 letters to search..."
                  selectedKey={orgClientId || undefined}
                  inputValue={orgName}
                  isReadOnly={isViewMode}
                  isDisabled={isViewMode}
                  onSelectionChange={(key) => {
                    const id = typeof key === 'string' ? key : (key as any) || '';
                    if (!id) {
                      setOrgClientId('');
                      setOrgName(orgSearch);
                      return;
                    }
                    if (id.startsWith('custom:')) {
                      const value = id.replace('custom:', '');
                      setOrgClientId('');
                      setOrgName(value);
                      setOrgSearch(value);
                      return;
                    }
                    const g = frontOfficeGuests.find(c => c.id === id);
                    if (g) {
                      const org = g.employerCompany || g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim();
                      setOrgClientId(g.id);
                      setOrgName(org);
                      setOrgSearch(org);
                      setOrgContactPhone(g.companyPhone || g.phone || '');
                      setOrgClientEmail(g.email || '');
                    }
                  }}
                  onInputChange={(value) => {
                    setOrgSearch(value);
                    setOrgName(value);
                    setOrgClientId('');
                  }}
                >
                  {(() => {
                    const q = (orgSearch || '').trim();
                    const guests = frontOfficeGuests || [];
                    const results = q.length >= 2
                      ? guests.filter(g => {
                          const org = (g.employerCompany || '').toLowerCase();
                          const name = (g.name || `${g.firstName || ''} ${g.lastName || ''}`).toLowerCase();
                          const phone = (g.companyPhone || g.phone || '').toLowerCase();
                          return org.includes(q.toLowerCase()) || name.includes(q.toLowerCase()) || phone.includes(q.toLowerCase());
                        }).slice(0, 20)
                      : [];
                    return q.length >= 2 ? (
                      <>
                        <AutocompleteItem key={`custom:${q}`} textValue={q}>
                          <div className="flex justify-between items-center w-full">
                            <span className="font-medium">Use "{q}"</span>
                            <span className="text-xs text-gray-500">Click to confirm</span>
                          </div>
                        </AutocompleteItem>
                        {results.map(g => {
                          const org = g.employerCompany || (g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim());
                          const person = g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim();
                          return (
                            <AutocompleteItem key={g.id} textValue={`${org} ${person}`}>
                              <div className="flex flex-col">
                                <span className="font-medium">{org}</span>
                                <span className="text-xs text-gray-600">{person} • {(g.companyPhone || g.phone || '')}</span>
                              </div>
                            </AutocompleteItem>
                          );
                        })}
                      </>
                    ) : null;
                  })()}
                </Autocomplete>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-end">
                <Input
                  label="Contact"
                  placeholder="Phone number"
                  value={orgContactPhone}
                  onChange={(e) => setOrgContactPhone(e.target.value)}
                  isReadOnly={isViewMode}
                />
                  <Input
                    label="Client Email"
                    placeholder="Email address"
                    value={orgClientEmail}
                    onChange={(e) => setOrgClientEmail(e.target.value)}
                    isReadOnly={isViewMode}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isResidential"
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      checked={isResidential}
                      onChange={(e) => setIsResidential(e.target.checked)}
                      disabled={isViewMode}
                    />
                    <label htmlFor="isResidential" className="text-sm text-blue-800 font-semibold">
                      🏨 Residential Events
                    </label>
                  </div>
                </div>
              </div>

              {phase1Error && (
                <div className="mt-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{phase1Error}</div>
              )}
            </div>

            <Divider className="my-8" />

            {/* Phase 2: Event Dates & Venue */}
            <div className="mb-8">
              <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                📅 Phase 2: Event Dates & Venue
              </h4>
              <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <Input
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  isReadOnly={isViewMode}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  isReadOnly={isViewMode}
                />
                <Select 
                  label="Venue Selection" 
                  placeholder="Select venue" 
                  selectedKeys={venueKey ? [venueKey] : []} 
                  onSelectionChange={(keys)=> setVenueKey(Array.from(keys)[0] as string)}
                  isDisabled={isViewMode}
                >
                  {(modernVenues || []).map(v => (
                    <SelectItem key={v.id}>{`${v.name} (${v.capacity} pax)`}</SelectItem>
                  ))}
                </Select>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                  <Input
                    label="Expected Pax"
                    type="number"
                    placeholder="Number of attendees"
                    value={expectedPax ? String(expectedPax) : ''}
                    onChange={(e)=> setExpectedPax(parseInt(e.target.value || '0', 10) || 0)}
                    className="flex-1"
                    isReadOnly={isViewMode}
                  />
                  {isCreatingInvoiceFromFolio ? (
                    <Select
                      label={renderStatusLabel('Event Status', { key: 'invoiced', label: 'Invoiced', icon: '🧾' })}
                      selectedKeys={new Set(['invoiced'])}
                      isDisabled
                      description="Status locked while finalizing invoice"
                    >
                      <SelectItem key="invoiced">🧾 Invoiced</SelectItem>
                    </Select>
                  ) : (
                    <Select
                      label={renderStatusLabel('Event Status')}
                      selectedKeys={eventStatus ? new Set([eventStatus]) : new Set()}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as SimpleEventStatus;
                        if (selected) setEventStatus(selected);
                      }}
                      isDisabled={isViewMode}
                      description="Current status of this event"
                    >
                      {PRE_EVENT_STATUS_OPTIONS.map(option => (
                        <SelectItem key={option.key}>
                          {option.icon ? `${option.icon} ` : ''}
                          {option.label}
                        </SelectItem>
                      ))}
                    </Select>
                  )}
                  {!isCreatingInvoiceFromFolio && eventStatus !== 'invoiced' && (
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-gray-600">Availability & Conflicts</span>
                      <Popover placement="bottom-start">
                        <PopoverTrigger>
                          <div
                            className={`px-3 py-2 rounded-md text-xs whitespace-nowrap border font-semibold ${
                              capacityOk && clashCount === 0
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                            } ${clashCount > 0 ? 'cursor-pointer' : ''}`}
                          >
                            {capacityOk && clashCount === 0
                              ? 'Availability: OK'
                              : `Check: ${capacityOk ? 'OK capacity' : 'Capacity exceeded'}${
                                  clashCount > 0 ? ` • ${clashCount} clash${clashCount > 1 ? 'es' : ''}` : ''
                                }${hasWarnings ? ' • warnings' : ''}`}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent>
                          <div className="p-3 text-sm min-w-[320px]">
                            {clashCount === 0 ? (
                              <div className="text-gray-700">No conflicting programmes in the selected range.</div>
                            ) : (
                              <div>
                                <div className="font-medium mb-2 text-gray-800">Conflicting programmes</div>
                                <ul className="space-y-2">
                                  {conflictingEvents.slice(0, 5).map((ev: any) => (
                                    <li key={ev.id} className="flex items-start gap-2">
                                      <span className="mt-1">📅</span>
                                      <div className="text-gray-700">
                                        <div className="font-medium">
                                          {ev.eventName} <span className="text-gray-500">• {ev.organization}</span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {ev.venueName} • {ev.arrivalDate} → {ev.departureDate} • {ev.pax} pax
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                                {conflictingEvents.length > 5 && (
                                  <div className="mt-2 text-xs text-gray-500">+ {conflictingEvents.length - 5} more…</div>
                                )}
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Divider className="my-8" />

            {/* Phase 3: Daily Schedule & Headcounts (NEW, MOST IMPORTANT PHASE) */}
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                📊 Phase 3: Daily Schedule & Headcounts
              </h4>
              {/* Rates controls */}
              <div className="mb-4 flex flex-wrap items-end gap-4">
                <div className="flex items-center gap-3">
                  <Switch size="sm" isSelected={!ratesByParticulars} onValueChange={(v)=> setRatesByParticulars(!v)} isDisabled={isViewMode} />
                  <span className="text-sm">Rate by package</span>
                </div>
                {!ratesByParticulars ? (
                  <>
                    <Input size="sm" type="number" label="Default Daily Rate (₵/person)" value={String(defaultDayRate)} onChange={(e)=> setDefaultDayRate(parseFloat(e.target.value || '0') || 0)} className="w-56" isReadOnly={isViewMode} />
                    {!isViewMode && <Button size="sm" variant="flat" onPress={()=> setDailySchedule(prev => prev.map(r => ({ ...r, rate: defaultDayRate || 0 })))}>Apply to All Days</Button>}
                  </>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <Input size="sm" type="number" label="Room Rate (₵)" value={String(roomRate)} onChange={(e)=> setRoomRate(parseFloat(e.target.value || '0') || 0)} className="w-40" isReadOnly={isViewMode} />
                    <Input size="sm" type="number" label="Dinner Rate (₵)" value={String(dinnerRate)} onChange={(e)=> setDinnerRate(parseFloat(e.target.value || '0') || 0)} className="w-40" isReadOnly={isViewMode} />
                    <Input size="sm" type="number" label="Lunch Rate (₵)" value={String(lunchRate)} onChange={(e)=> setLunchRate(parseFloat(e.target.value || '0') || 0)} className="w-40" isReadOnly={isViewMode} />
                    <Input size="sm" type="number" label="Conference Rate (₵)" value={String(conferenceRate)} onChange={(e)=> setConferenceRate(parseFloat(e.target.value || '0') || 0)} className="w-40" isReadOnly={isViewMode} />
                    {!isViewMode && <Button size="sm" color="primary" variant="flat" onPress={()=> setCustomParticulars(prev => [...prev, { id: `extra-${Date.now()}`, label: 'Extra Service', rate: 0 }])}>➕ Add Row</Button>}
                  </div>
                )}
              </div>
              
              {/* Daily Schedule Table */}
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9ca3af #f3f4f6' }}>
                {!ratesByParticulars ? (
                <Table aria-label="Daily schedule" className="min-w-full">
                  <TableHeader>
                    <TableColumn>Date</TableColumn>
                    <TableColumn>{particularLabels.rooms}</TableColumn>
                    <TableColumn>{particularLabels.dinnerPax}</TableColumn>
                    <TableColumn>{particularLabels.lunchPax}</TableColumn>
                    <TableColumn>{particularLabels.conferencePax}</TableColumn>
                    <TableColumn>Rate (₵)</TableColumn>
                    <TableColumn>Subtotal (₵)</TableColumn>
                    <TableColumn className="w-12 text-center">Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {dailySchedule.length === 0 ? (
                      <TableRow>
                        <TableCell className="text-center text-gray-500" colSpan={8}>
                          <div className="py-8">
                            <span className="text-4xl">📅</span>
                            <p className="mt-2">Please select Start and End dates to generate daily schedule</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      dailySchedule.map((row, idx) => {
                        const c = computeDayAmounts(row);
                        return (
                          <TableRow key={row.date}>
                            <TableCell>{row.date}</TableCell>
                            <TableCell>
                              <Input size="sm" type="number" value={String(row.rooms)} onChange={(e)=> {
                                const v = parseInt(e.target.value || '0', 10) || 0;
                                setDailySchedule(prev => prev.map((r,i)=> i===idx ? { ...r, rooms: v } : r));
                              }} isReadOnly={isViewMode} />
                            </TableCell>
                            <TableCell>
                              <Input size="sm" type="number" value={String(row.dinnerPax)} onChange={(e)=> {
                                const v = parseInt(e.target.value || '0', 10) || 0;
                                setDailySchedule(prev => prev.map((r,i)=> i===idx ? { ...r, dinnerPax: v } : r));
                              }} isReadOnly={isViewMode} />
                            </TableCell>
                            <TableCell>
                              <Input size="sm" type="number" value={String(row.lunchPax)} onChange={(e)=> {
                                const v = parseInt(e.target.value || '0', 10) || 0;
                                setDailySchedule(prev => prev.map((r,i)=> i===idx ? { ...r, lunchPax: v } : r));
                              }} isReadOnly={isViewMode} />
                            </TableCell>
                            <TableCell>
                              <Input size="sm" type="number" value={String(row.conferencePax)} onChange={(e)=> {
                                const v = parseInt(e.target.value || '0', 10) || 0;
                                setDailySchedule(prev => prev.map((r,i)=> i===idx ? { ...r, conferencePax: v } : r));
                              }} isReadOnly={isViewMode} />
                            </TableCell>
                            <TableCell>
                              <Input size="sm" type="number" value={String(row.rate)} onChange={(e)=> {
                                const v = parseFloat(e.target.value || '0') || 0;
                                setDailySchedule(prev => prev.map((r,i)=> i===idx ? { ...r, rate: v } : r));
                              }} className="w-28" isReadOnly={isViewMode} />
                            </TableCell>
                            <TableCell>₵{c.subtotal.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              {!isViewMode ? (
                                <div className="space-y-2">
                                  <Button size="sm" variant="flat" className="px-2" onPress={()=> addExtraLineToDay(idx)} aria-label="Add extra">＋</Button>
                                  {(row.extraLines||[]).map((ln, lineIdx) => (
                                    <div key={`${row.date}-ex-${ln.id}`} className="flex items-center gap-1">
                                      <Input size="sm" value={ln.name} onChange={(e)=> updateExtraLineOnDay(idx, lineIdx, { name: e.target.value })} className="w-24" />
                                      <Input size="sm" type="number" value={String(ln.qty)} onChange={(e)=> updateExtraLineOnDay(idx, lineIdx, { qty: parseInt(e.target.value || '0', 10) || 0 })} className="w-16" />
                                      <Input size="sm" type="number" value={String(ln.unitPrice)} onChange={(e)=> updateExtraLineOnDay(idx, lineIdx, { unitPrice: parseFloat(e.target.value || '0') || 0 })} className="w-20" />
                                      <span className="text-xs text-gray-500">₵{((Number(ln.qty)||0)*(Number(ln.unitPrice)||0)).toFixed(2)}</span>
                                      <Button size="sm" color="danger" variant="light" className="px-2" onPress={()=> removeExtraLineFromDay(idx, lineIdx)} aria-label="Remove">✖</Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {(row.extraLines||[]).map((ln, lineIdx) => (
                                    <div key={`${row.date}-ex-${ln.id}`} className="text-xs text-gray-600">
                                      {ln.name}: {ln.qty} × ₵{ln.unitPrice} = ₵{((Number(ln.qty)||0)*(Number(ln.unitPrice)||0)).toFixed(2)}
                                    </div>
                                  ))}
                                  {(!row.extraLines || row.extraLines.length === 0) && <span className="text-xs text-gray-400">—</span>}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                ) : (
                <Table aria-label="Daily schedule - rates by particulars" className="min-w-full">
                  <TableHeader>
                    <TableColumn>Particular</TableColumn>
                    <TableColumn>Rate (₵)</TableColumn>
                    {(() => {
                      const validSchedule = dailySchedule.filter(r => r && r.date);
                      if (validSchedule.length > 0) {
                        return (
                          <>
                            {validSchedule.map((r) => (
                              <TableColumn key={r.date}>
                                {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </TableColumn>
                            ))}
                          </>
                        );
                      }
                      return <TableColumn>Dates</TableColumn>;
                    })()}
                    <TableColumn>Subtotal (₵)</TableColumn>
                    <TableColumn className="w-12 text-center">Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const validSchedule = dailySchedule.filter(r => r && r.date);
                      const standardParticulars = (['rooms','dinnerPax','lunchPax','conferencePax'] as const)
                        .filter(k => !hiddenParticulars[k]);
                      const totalRows = standardParticulars.length + customParticulars.length;
                      const columnCount = 2 + (validSchedule.length > 0 ? validSchedule.length : 1) + 2; // Particular + Rate + Dates + Subtotal + Actions
                      
                      if (totalRows === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={columnCount} className="text-center text-gray-500 py-8">
                              <div>
                                <span className="text-4xl">📅</span>
                                <p className="mt-2">Please select Start and End dates to generate daily schedule</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }
                      
                      return (
                        <>
                          {standardParticulars.map((key) => {
                            const label = particularLabels[key];
                            const rate = key === 'conferencePax' ? conferenceRate : key === 'lunchPax' ? lunchRate : key === 'dinnerPax' ? dinnerRate : roomRate;
                            const setRate = key === 'conferencePax' ? setConferenceRate : key === 'lunchPax' ? setLunchRate : key === 'dinnerPax' ? setDinnerRate : setRoomRate;
                            const qtys = validSchedule.map(r => (r as any)[key] || 0);
                            const subtotal = qtys.reduce((s,q)=> s + q * (rate||0), 0);
                            return (
                              <TableRow key={key}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Input size="sm" value={label} onChange={(e)=> setParticularLabels(prev => ({ ...prev, [key]: e.target.value }))} className="w-40" isReadOnly={isViewMode} />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Input size="sm" type="number" value={String(rate)} onChange={(e)=> setRate(parseFloat(e.target.value || '0') || 0)} className="w-28" isReadOnly={isViewMode} />
                                </TableCell>
                                {validSchedule.length > 0 ? (
                                  <>
                                    {validSchedule.map((r, idx) => {
                                      const originalIdx = dailySchedule.findIndex(x => x.date === r.date);
                                      return (
                                        <TableCell key={`c-${key}-${r.date}-${idx}`}>
                                          <Input size="sm" type="number" value={String((r as any)[key] || 0)} onChange={(e)=> {
                                            const v = parseInt(e.target.value || '0', 10) || 0;
                                            if (originalIdx >= 0) {
                                              setDailySchedule(prev => prev.map((x,i)=> i===originalIdx ? { ...x, [key]: v } as any : x));
                                            }
                                          }} className="w-24 flex-shrink-0" isReadOnly={isViewMode} />
                                        </TableCell>
                                      );
                                    })}
                                  </>
                                ) : (
                                  <TableCell>
                                    <span className="text-sm text-gray-400">Select dates to generate schedule</span>
                                  </TableCell>
                                )}
                                <TableCell>₵{subtotal.toFixed(2)}</TableCell>
                                <TableCell className="text-center">
                                  {!isViewMode && <Button size="sm" color="danger" variant="light" className="px-2" onPress={()=> setHiddenParticulars(prev => ({ ...prev, [key]: true }))} aria-label="Remove">✖</Button>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </>
                      );
                    })()}
                    <>
                    {customParticulars.map((p) => {
                      const validSchedule = dailySchedule.filter(r => r && r.date);
                      const qtys = validSchedule.map(r => r.extras?.[p.id] || 0);
                      const subtotal = qtys.reduce((s,q)=> s + q * (p.rate||0), 0);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Input
                              size="sm"
                              value={p.label}
                              onChange={(e)=> setCustomParticulars(prev => prev.map(x => x.id===p.id ? { ...x, label: e.target.value } : x))}
                              isReadOnly={isViewMode}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              size="sm"
                              type="number"
                              value={String(p.rate)}
                              onChange={(e)=> setCustomParticulars(prev => prev.map(x => x.id===p.id ? { ...x, rate: parseFloat(e.target.value || '0') || 0 } : x))}
                              className="w-28"
                              isReadOnly={isViewMode}
                            />
                          </TableCell>
                          {validSchedule.length > 0 ? (
                            <>
                              {validSchedule.map((r, idx) => {
                                const originalIdx = dailySchedule.findIndex(x => x.date === r.date);
                                return (
                                  <TableCell key={`extra-${p.id}-${r.date}-${idx}`}>
                                    <Input
                                      size="sm"
                                      type="number"
                                      value={String(r.extras?.[p.id] || 0)}
                                      onChange={(e)=> {
                                        const v = parseInt(e.target.value || '0', 10) || 0;
                                        if (originalIdx >= 0) {
                                          setDailySchedule(prev => prev.map((x,i)=> i===originalIdx ? { ...x, extras: { ...(x.extras||{}), [p.id]: v } } : x));
                                        }
                                      }}
                                      className="w-24 flex-shrink-0"
                                      isReadOnly={isViewMode}
                                    />
                                  </TableCell>
                                );
                              })}
                            </>
                          ) : (
                            <TableCell>
                              <span className="text-sm text-gray-400">Select dates to generate schedule</span>
                            </TableCell>
                          )}
                          <TableCell>₵{subtotal.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            {!isViewMode && (
                              <Button
                                size="sm"
                                color="danger"
                                variant="light"
                                className="px-2"
                                onPress={()=> {
                                  setCustomParticulars(prev => prev.filter(x => x.id !== p.id));
                                  setDailySchedule(prev => prev.map(r => { const n = { ...(r.extras||{}) }; delete n[p.id]; return { ...r, extras: n }; }));
                                }}
                                aria-label="Remove"
                              >
                                ✖
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    </>
                  </TableBody>
                </Table>
                )}
              </div>
            {/* Phase 3 totals removed - moved subtotal to Phase 4 */}
            </div>

            <Divider />

            {/* Phase 4 removed per requirements */}

            <Divider className="my-8" />
            {/* Phase 4: Financial Summary (AUTO-CALCULATED) */}
            <div className="mb-8">
              <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                💰 Phase 4: Financial Summary (AUTO-CALCULATED)
              </h4>
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left controls: tax exempt only */}
                <div className="p-6 bg-white rounded-lg border w-full md:w-4/12 space-y-4">
                  <h5 className="font-medium text-ghana-black">Payment & Tax Controls</h5>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Prepayment Enabled</span>
                      <Switch size="sm" isSelected={prepaymentEnabled} onValueChange={setPrepaymentEnabled} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Tax Exempt</span>
                      <Switch size="sm" isSelected={eventTaxExempt} onValueChange={(val) => { setEventTaxExempt(val); setQuoteTaxExempt(val); }} />
                    </div>
                  </div>
                </div>
                {/* Right summary: aligns right on desktop */}
                <div className="p-6 bg-white rounded-lg border space-y-6 ml-auto w-full md:w-7/12">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-ghana-black">Subtotal:</span>
                  <span className="font-semibold">₵{eventTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-ghana-black">Discount:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700">
                      {discountEnabled ? (discountType === 'percent' ? `${discountValue}%` : `₵${discountValue}`) : '—'}
                    </span>
                    <Button size="sm" variant="flat" onPress={()=> setShowDiscountModal(true)}>Edit</Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {detailedTaxRows.length > 0 ? (
                    <>
                      <div className="grid grid-cols-4 gap-2 font-semibold text-xs uppercase text-gray-500">
                        <span>Tax</span>
                        <span className="text-right">Basis</span>
                        <span className="text-right">Effect</span>
                        <span className="text-right">Amount</span>
                      </div>
                      <div className="space-y-1">
                        {detailedTaxRows.map((tax, idx) => {
                          const basisLabel = tax.method === 'fixed'
                            ? (tax.fixedAmount != null ? `₵${Number(tax.fixedAmount).toFixed(2)}` : 'Fixed')
                            : (tax.rate != null ? `${tax.rate}%` : (tax.method === 'tiered' ? 'Tiered' : '—'));
                          const amountDisplay = `₵${Number(tax.amount || 0).toFixed(2)}`;
                          const effectLabel = tax.effect === 'subtract'
                            ? 'Subtract'
                            : tax.effect === 'exclude_total'
                              ? 'Exclude'
                              : tax.effect === 'informational'
                                ? 'Info'
                                : 'Add';
                          return (
                            <div
                              key={`${tax.name}-${idx}`}
                              className="grid grid-cols-4 gap-2 items-center text-xs md:text-sm"
                            >
                              <span className="font-medium text-ghana-black">{tax.name}</span>
                              <span className="text-right text-gray-600">{basisLabel}</span>
                              <span className="text-right text-gray-600">{effectLabel}</span>
                              <span className={`text-right font-medium ${tax.effect === 'subtract' ? 'text-red-600' : 'text-gray-800'}`}>
                                {amountDisplay}
                                {eventTaxExempt && <span className="ml-1 text-xs text-green-700">(exempt)</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">No tax rules configured for the currently selected compliance country.</div>
                  )}
                </div>
                <div className="border-t pt-4">
                  <h5 className="text-lg font-semibold text-ghana-black mb-3">Final Summary</h5>
                  <div className="space-y-3">
                    <div className="flex justify-between text-lg">
                      <span>Grand Total:</span>
                      <span className="font-bold text-green-600">₵{eventTotals.total.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Prepayment{prepaymentEnabled ? ` (${prepaymentDisplay})` : ''}:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-blue-600">₵{(prepaymentEnabled ? cappedPrepaymentAmount : 0).toFixed(2)}</span>
                        <Button size="sm" variant="flat" onPress={()=> setShowPrepaymentModal(true)}>Edit</Button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Balance Due:</span>
                      <span className="font-medium text-orange-600">₵{balanceDue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>

            <Divider className="my-8" />
            {/* Phase 6: Status & Communication */}
            {/* Prepayment & Discount Modals */}
            {showPrepaymentModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                  <h5 className="font-medium text-ghana-black mb-4">Set Prepayment</h5>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Enable Prepayment</span>
                      <Switch size="sm" isSelected={prepaymentEnabled} onValueChange={setPrepaymentEnabled} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select label="Type" selectedKeys={[prepaymentType]} onSelectionChange={(keys)=> setPrepaymentType(Array.from(keys)[0] as any)}>
                        <SelectItem key="percent">Percent</SelectItem>
                        <SelectItem key="amount">Amount</SelectItem>
                      </Select>
                      <Input type="number" label={prepaymentType === 'percent' ? 'Value (%)' : 'Value (₵)'} value={String(prepaymentValue)} onChange={(e)=> setPrepaymentValue(parseFloat(e.target.value || '0') || 0)} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="flat" onPress={()=> setShowPrepaymentModal(false)}>Cancel</Button>
                      <Button color="primary" onPress={()=> setShowPrepaymentModal(false)}>Save</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {showDiscountModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                  <h5 className="font-medium text-ghana-black mb-4">Set Discount</h5>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Enable Discount</span>
                      <Switch size="sm" isSelected={discountEnabled} onValueChange={setDiscountEnabled} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select label="Type" selectedKeys={[discountType]} onSelectionChange={(keys)=> setDiscountType(Array.from(keys)[0] as any)}>
                        <SelectItem key="percent">Percent</SelectItem>
                        <SelectItem key="amount">Amount</SelectItem>
                      </Select>
                      <Input type="number" label={discountType === 'percent' ? 'Value (%)' : 'Value (₵)'} value={String(discountValue)} onChange={(e)=> setDiscountValue(parseFloat(e.target.value || '0') || 0)} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="flat" onPress={()=> setShowDiscountModal(false)}>Cancel</Button>
                      <Button color="primary" onPress={()=> setShowDiscountModal(false)}>Save</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="mb-6">
              <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                📞 Phase 6: Status & Communication
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <Select
                  label={renderStatusLabel('Current Status', { key: 'invoiced', label: 'Invoiced', icon: '🧾' })}
                  size="sm"
                  selectedKeys={new Set(['invoiced'])}
                  isDisabled
                >
                  <SelectItem key="invoiced">🧾 Invoiced</SelectItem>
                </Select>
                <Input
                  size="sm"
                  label="Next Action Required"
                  placeholder="e.g., Send contract, Follow up on deposit"
                  defaultValue={editingEvent?.nextAction || ''}
                />
                <Input
                  size="sm"
                  label="Follow-up Date"
                  type="date"
                  defaultValue={editingEvent?.followUpDate || ''}
                />
                <Input
                  size="sm"
                  label="Sales Manager"
                  placeholder="Assigned sales manager"
                  defaultValue={editingEvent?.salesManager || ''}
                />
              </div>
              
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Textarea
                  minRows={5}
                  label="Special Requirements & Notes"
                  placeholder="Any special requirements, dietary restrictions, action items, or communication notes..."
                  defaultValue={editingEvent?.specialRequirements || editingEvent?.communicationNotes || ''}
                  className="w-full"
                />
                <Card className="border border-dashed border-gray-200 bg-white h-full">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <p className="text-sm font-semibold text-ghana-black">Print Quote & Invoice</p>
                  </CardHeader>
                  <CardBody className="pt-0 px-4 pb-4">
                    <Tabs
                      size="sm"
                      variant="underlined"
                      selectedKey={activePrintTab}
                      onSelectionChange={(key) => setActivePrintTab(key as 'quote' | 'xls')}
                    >
                      {showQuotePrintTab && editingEvent && (
                      <Tab key="quote" title="📄 Quote">
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-end sm:gap-3">
                            <Select
                              size="sm"
                              label="Quote Template"
                              className="flex-1"
                              selectedKeys={selectedQuoteTemplate ? [selectedQuoteTemplate] : []}
                              onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0] as string | undefined;
                                if (!value) return;
                                setSelectedQuoteTemplate(value);
                                updatePrintingTemplates?.({ proforma: value });
                              }}
                              placeholder={quoteTemplateOptions.length ? 'Choose template' : 'No templates available'}
                            >
                              {quoteTemplateOptions.map((tpl) => (
                                <SelectItem key={tpl.key}>{tpl.name}</SelectItem>
                              ))}
                            </Select>
                            <Button
                              size="sm"
                              color="primary"
                              className="mt-3 sm:mt-0 sm:w-auto w-full"
                              isDisabled={!quoteTemplateOptions.length}
                              onPress={handlePrintQuotePdf}
                            >
                              Generate Quote PDF
                            </Button>
                          </div>
                        </div>
                      </Tab>
                      )}
                      <Tab key="xls" title="📊 XLS">
                        <div className="space-y-3">
                          <p className="text-xs text-gray-600">
                            Export a spreadsheet summary of the event schedule, services, and financials.
                          </p>
                          <Button
                            size="sm"
                            color="secondary"
                            className="w-full"
                            onPress={handleExportEventXls}
                          >
                            Export Event XLS
                          </Button>
                        </div>
                      </Tab>
                    </Tabs>
                  </CardBody>
                </Card>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            {isViewMode ? (
              <>
                <Button
                  color="default"
                  variant="flat"
                  onPress={() => {
                    setIsEventModalOpen(false);
                    setEditingEvent(null);
                    setIsCreatingEvent(false);
                    setIsViewMode(false);
                    setIsAdjustMode(false);
                    setHoveredGanttEventId(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    setIsViewMode(false);
                  }}
                >
                  Edit Event
                </Button>
              </>
            ) : (
              <>
                <Button
                  color="danger"
                  variant="flat"
                  onPress={() => {
                    setIsEventModalOpen(false);
                    setEditingEvent(null);
                    setIsCreatingEvent(false);
                    setIsViewMode(false);
                    setIsAdjustMode(false);
                    setHoveredGanttEventId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isDisabled={eventSubmitting}
                  onPress={handleEventSubmit}
                >
                  {eventSubmitting
                    ? (isCreatingEvent ? 'Creating...' : isAdjustMode ? 'Adjusting...' : 'Updating...')
                    : (isCreatingEvent ? 'Create Event' : isAdjustMode ? 'Adjust' : 'Update Event')}
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>


      <Modal isOpen={isVenueModalOpen} onClose={closeVenueModal} size="2xl">
        <ModalContent>
          <ModalHeader>
            {editingVenue?.id ? 'Edit Venue' : 'Create New Venue'}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Venue Name"
                placeholder="Enter venue name"
                value={venueForm.name}
                onValueChange={(value) => handleVenueFieldChange('name', value)}
              />
              <Select
                label="Venue Type"
                placeholder="Select venue type"
                selectedKeys={[venueForm.type]}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string | undefined;
                  if (value) handleVenueFieldChange('type', value);
                }}
              >
                <SelectItem key="conference">Conference Hall</SelectItem>
                <SelectItem key="meeting">Meeting Room</SelectItem>
                <SelectItem key="banquet">Banquet Hall</SelectItem>
                <SelectItem key="auditorium">Auditorium</SelectItem>
              </Select>
              <Input
                label="Capacity"
                type="number"
                placeholder="Number of people"
                value={venueForm.capacity}
                onValueChange={(value) => handleVenueFieldChange('capacity', value)}
              />
              <Input
                label="Price per Day"
                type="number"
                placeholder="Daily rate"
                value={venueForm.basePrice}
                onValueChange={(value) => handleVenueFieldChange('basePrice', value)}
              />
              <Input
                label="Location"
                placeholder="Venue location"
                value={venueForm.location}
                onValueChange={(value) => handleVenueFieldChange('location', value)}
              />
              <Select
                label="Status"
                placeholder="Select status"
                selectedKeys={[venueForm.status]}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as VenueStatus | undefined;
                  if (value) handleVenueFieldChange('status', value);
                }}
              >
                <SelectItem key="available">Available</SelectItem>
                <SelectItem key="booked">Booked</SelectItem>
                <SelectItem key="setup">Setup</SelectItem>
                <SelectItem key="maintenance">Maintenance</SelectItem>
              </Select>
            </div>
            <Textarea
              label="Features"
              placeholder="Venue features (one per line)"
              className="mt-4"
              value={venueForm.featuresInput}
              onValueChange={(value) => handleVenueFieldChange('featuresInput', value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={closeVenueModal}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleVenueSubmit}>
              {editingVenue?.id ? 'Update Venue' : 'Create Venue'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        size="5xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <div>
                <h3 className="text-lg font-semibold">
                  {editingQuote?.id ? 'Update Quote' : 'Create New Quote'}
                </h3>
                <p className="text-sm text-gray-500">
                  Compile services, taxes, and terms for professional proposals
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">📎 Supporting Documents</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-white">
                  <div className="text-2xl mb-2">📎</div>
                  <p className="text-sm text-gray-600 mb-2">
                    Upload tax exemption certificates, registration documents, or authority letters
                  </p>
                  <Button color="primary" variant="flat" size="sm">
                    📁 Choose Files
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    PDF, JPG, PNG up to 10MB each
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-lg mb-3">📅 Event Timeline & Services</h4>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> The system automatically calculates totals and taxes based on the services added.{' '}
                    For tax-exempt clients, all taxes are automatically set to zero.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button color="primary" variant="flat" size="sm" onPress={addQuoteDay}>
                      ➕ Add Day to Timeline
                    </Button>
                    <Button
                      color="secondary"
                      variant="flat"
                      size="sm"
                      onPress={() => {
                        setQuoteDays([]);
                        trackEvent('Events.EventCreated', { action: 'quote_timeline_cleared', quoteId: editingQuote?.id });
                      }}
                    >
                      🧹 Clear Timeline
                    </Button>
                  </div>
                  {quoteDays.length === 0 ? (
                    <div className="mt-2 text-sm text-gray-500">
                      No days yet. Click &quot;Add Day to Timeline&quot; to begin.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {quoteDays.map((day, dayIdx) => (
                        <div key={day.id} className="border rounded-md bg-white shadow-sm">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-3 py-2 border-b bg-gray-50">
                            <div className="flex flex-wrap items-center gap-3">
                              <Input
                                size="sm"
                                label="Label"
                                value={day.label}
                                onChange={(e) =>
                                  setQuoteDays((prev) =>
                                    prev.map((d, i) =>
                                      i === dayIdx
                                        ? {
                                            ...d,
                                            label: e.target.value
                                          }
                                        : d
                                    )
                                  )
                                }
                                className="w-40"
                              />
                              <Input
                                size="sm"
                                type="date"
                                label="Date"
                                value={day.date}
                                onChange={(e) =>
                                  setQuoteDays((prev) =>
                                    prev.map((d, i) =>
                                      i === dayIdx
                                        ? {
                                            ...d,
                                            date: e.target.value
                                          }
                                        : d
                                    )
                                  )
                                }
                                className="w-48"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" color="secondary" variant="flat" onPress={() => addPackageToDay(dayIdx)}>
                                📦 Add Package
                              </Button>
                              <Button size="sm" color="success" variant="flat" onPress={() => addCustomServiceToDay(dayIdx)}>
                                🍽️ Add Service
                              </Button>
                              <Button size="sm" color="danger" variant="flat" onPress={() => removeQuoteDay(dayIdx)}>
                                🗑️ Remove Day
                              </Button>
                            </div>
                          </div>
                          <div className="p-3 overflow-x-auto">
                            <Table aria-label="Services for the day">
                              <TableHeader>
                                <TableColumn>Service</TableColumn>
                                <TableColumn>Qty</TableColumn>
                                <TableColumn>Unit Price</TableColumn>
                                <TableColumn>Subtotal</TableColumn>
                                <TableColumn>Tax</TableColumn>
                                <TableColumn>Total</TableColumn>
                                <TableColumn>Actions</TableColumn>
                              </TableHeader>
                              <TableBody>
                                {day.services.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={7} className="text-center text-gray-500">
                                      No services added.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  day.services.map((s, lineIdx) => {
                                    const c = computeLine(s);
                                    return (
                                      <TableRow key={s.id}>
                                        <TableCell>
                                          <Input
                                            size="sm"
                                            value={s.name}
                                            onChange={(e) =>
                                              updateServiceLine(dayIdx, lineIdx, { name: e.target.value })
                                            }
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            size="sm"
                                            type="number"
                                            value={String(s.qty)}
                                            onChange={(e) =>
                                              updateServiceLine(dayIdx, lineIdx, {
                                                qty: parseInt(e.target.value || '0', 10) || 0
                                              })
                                            }
                                            className="w-24"
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            size="sm"
                                            type="number"
                                            value={String(s.unitPrice)}
                                            onChange={(e) =>
                                              updateServiceLine(dayIdx, lineIdx, {
                                                unitPrice: parseFloat(e.target.value || '0') || 0
                                              })
                                            }
                                            className="w-28"
                                          />
                                        </TableCell>
                                        <TableCell>₵{c.subtotal.toFixed(2)}</TableCell>
                                        <TableCell>₵{c.taxAmount.toFixed(2)}</TableCell>
                                        <TableCell className="font-semibold">₵{c.total.toFixed(2)}</TableCell>
                                        <TableCell>
                                          <Button
                                            size="sm"
                                            color="danger"
                                            variant="light"
                                            onPress={() => removeServiceLine(dayIdx, lineIdx)}
                                          >
                                            Remove
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="p-3 border rounded bg-white">
                    {(() => {
                      const t = computeQuoteTotals();
                      return (
                        <div className="flex flex-wrap gap-6 text-sm">
                          <div>
                            Subtotal: <span className="font-semibold">₵{t.subtotal.toFixed(2)}</span>
                          </div>
                          <div>
                            Tax:{' '}
                            <span className="font-semibold">
                              ₵{t.tax.toFixed(2)}
                            </span>{' '}
                            {quoteTaxExempt ? <span className="text-green-700">(tax-exempt)</span> : null}
                          </div>
                          <div>
                            Total: <span className="font-bold text-ghana-black">₵{t.total.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-lg mb-3">📋 Terms &amp; Conditions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Deposit Required (%)"
                    type="number"
                    placeholder="50"
                    value={editingQuote?.depositRequired ?? ''}
                    onChange={(e) =>
                      setEditingQuote((prev: any) => ({
                        ...(prev || {}),
                        depositRequired: Number(e.target.value || 0)
                      }))
                    }
                  />
                  <Input
                    label="Payment Terms"
                    placeholder="e.g., 50% deposit to confirm, balance 7 days before event"
                    value={editingQuote?.paymentTerms ?? ''}
                    onChange={(e) =>
                      setEditingQuote((prev: any) => ({
                        ...(prev || {}),
                        paymentTerms: e.target.value
                      }))
                    }
                  />
                  <Input
                    label="Cancellation Policy"
                    placeholder="e.g., Deposit non-refundable if cancelled within 14 days"
                    value={editingQuote?.cancellationPolicy ?? ''}
                    onChange={(e) =>
                      setEditingQuote((prev: any) => ({
                        ...(prev || {}),
                        cancellationPolicy: e.target.value
                      }))
                    }
                  />
                  <Input
                    label="Guarantee Policy"
                    placeholder="e.g., Final numbers guaranteed 48 hours before event"
                    value={editingQuote?.guaranteePolicy ?? ''}
                    onChange={(e) =>
                      setEditingQuote((prev: any) => ({
                        ...(prev || {}),
                        guaranteePolicy: e.target.value
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-lg mb-3">📝 Additional Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Textarea
                    label="Special Requirements"
                    placeholder="Any special requirements, dietary restrictions, or additional notes..."
                    value={editingQuote?.specialRequirements ?? ''}
                    onChange={(e) =>
                      setEditingQuote((prev: any) => ({
                        ...(prev || {}),
                        specialRequirements: e.target.value
                      }))
                    }
                  />
                  <Textarea
                    label="Setup Requirements"
                    placeholder="Setup time, special arrangements, or technical requirements..."
                    value={editingQuote?.setupTime ?? ''}
                    onChange={(e) =>
                      setEditingQuote((prev: any) => ({
                        ...(prev || {}),
                        setupTime: e.target.value
                      }))
                    }
                  />
                </div>
                <div className="mt-4">
                  <Input
                    label="Contact Person on Event Day"
                    placeholder="Name and phone number of main contact person"
                    value={editingQuote?.contactPerson ?? ''}
                    onChange={(e) =>
                      setEditingQuote((prev: any) => ({
                        ...(prev || {}),
                        contactPerson: e.target.value
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex gap-2">
              <Button color="secondary" variant="flat" onPress={() => setIsQuoteModalOpen(false)}>
                Cancel
              </Button>
              <Button color="warning" variant="flat">
                💾 Save Draft
              </Button>
              <Button color="success" variant="flat" onPress={() => generatePDFQuote(editingQuote)}>
                📄 Generate PDF
              </Button>
              <Button color="primary" onPress={() => sendQuoteToClient(editingQuote)}>
                📧 Send to Client
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {/* Service Modal */}
      <Modal isOpen={isServiceModalOpen} onClose={() => setIsServiceModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {editingService?.id ? 'Edit Service' : 'Create New Service'}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Service Name"
                placeholder="Enter service name"
                defaultValue={editingService?.name || ''}
              />
              <Select label="Category" placeholder="Select category">
                <SelectItem key="catering">Catering</SelectItem>
                <SelectItem key="av">Audio Visual</SelectItem>
                <SelectItem key="decoration">Decoration</SelectItem>
                <SelectItem key="transport">Transportation</SelectItem>
              </Select>
              <Input
                label="Price"
                type="number"
                placeholder="Service price"
                defaultValue={editingService?.price || ''}
              />
              <Input
                label="Minimum Notice"
                placeholder="e.g., 24 hours"
                defaultValue={editingService?.minNotice || ''}
              />
              <Select label="Availability" placeholder="Select availability">
                <SelectItem key="daily">Daily</SelectItem>
                <SelectItem key="weekdays">Weekdays Only</SelectItem>
                <SelectItem key="weekends">Weekends Only</SelectItem>
                <SelectItem key="custom">Custom Schedule</SelectItem>
              </Select>
              <div className="flex items-center gap-2">
                <Switch defaultSelected={editingService?.status === 'active'} />
                <span>Active Service</span>
              </div>
            </div>
            <Textarea
              label="Description"
              placeholder="Service description"
              className="mt-4"
              defaultValue={editingService?.description || ''}
            />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={() => setIsServiceModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleServiceSubmit}>
              {editingService?.id ? 'Update Service' : 'Create Service'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        isOpen={isBEOModalOpen}
        onClose={() => setIsBEOModalOpen(false)}
        size="5xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <div>
                <h3 className="text-lg font-semibold">Banquet Event Order & Function Sheet</h3>
                <p className="text-sm text-gray-500">
                  Coordinate departments with a detailed operational playbook for this event
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            {beoForm ? (
              <form
                id="beoForm"
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveBeoForm();
                }}
              >
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Event Information</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Event Name"
                        value={beoForm.eventInfo.eventName}
                        onChange={(e) => updateBeoFormSection('eventInfo', 'eventName', e.target.value)}
                      />
                      <Input
                        label="Organization"
                        value={beoForm.eventInfo.organization}
                        onChange={(e) => updateBeoFormSection('eventInfo', 'organization', e.target.value)}
                      />
                      <Input
                        label="Contact Person"
                        value={beoForm.eventInfo.contactPerson}
                        onChange={(e) => updateBeoFormSection('eventInfo', 'contactPerson', e.target.value)}
                      />
                      <Input
                        label="Contact Phone"
                        value={beoForm.eventInfo.contactPhone}
                        onChange={(e) => updateBeoFormSection('eventInfo', 'contactPhone', e.target.value)}
                      />
                      <Input
                        label="Contact Email"
                        value={beoForm.eventInfo.contactEmail}
                        onChange={(e) => updateBeoFormSection('eventInfo', 'contactEmail', e.target.value)}
                      />
                      <Input
                        label="Venue"
                        value={beoForm.eventInfo.venueName}
                        onChange={(e) => updateBeoFormSection('eventInfo', 'venueName', e.target.value)}
                      />
                      <Input
                        label="Arrival Date"
                        type="date"
                        value={beoForm.eventInfo.arrivalDate}
                        onChange={(e) => updateBeoFormSection('eventInfo', 'arrivalDate', e.target.value)}
                      />
                      <Input
                        label="Departure Date"
                        type="date"
                        value={beoForm.eventInfo.departureDate}
                        onChange={(e) => updateBeoFormSection('eventInfo', 'departureDate', e.target.value)}
                      />
                      <Input
                        label="Duration (Days)"
                        value={beoForm.eventInfo.duration}
                        onChange={(e) => updateBeoFormSection('eventInfo', 'duration', e.target.value)}
                      />
                      <Input
                        label="Expected Pax"
                        value={beoForm.eventInfo.pax}
                        onChange={(e) => updateBeoFormSection('eventInfo', 'pax', e.target.value)}
                      />
                    </div>
                    <Textarea
                      className="mt-4"
                      label="Coordinator Notes"
                      minRows={3}
                      value={beoForm.eventInfo.notes}
                      onChange={(e) => updateBeoFormSection('eventInfo', 'notes', e.target.value)}
                    />
                  </CardBody>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">Room Setup & Venue Details</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          size="sm"
                          label="Layout"
                          value={beoForm.room.layout}
                          onChange={(e) => updateBeoFormSection('room', 'layout', e.target.value)}
                        />
                        <Input
                          size="sm"
                          label="Tables"
                          value={beoForm.room.tables}
                          onChange={(e) => updateBeoFormSection('room', 'tables', e.target.value)}
                        />
                        <Input
                          size="sm"
                          label="Chairs"
                          value={beoForm.room.chairs}
                          onChange={(e) => updateBeoFormSection('room', 'chairs', e.target.value)}
                        />
                        <Input
                          size="sm"
                          label="Capacity"
                          value={beoForm.room.capacity}
                          onChange={(e) => updateBeoFormSection('room', 'capacity', e.target.value)}
                        />
                        <Input
                          size="sm"
                          label="Registration Table"
                          value={beoForm.room.registrationTable}
                          onChange={(e) => updateBeoFormSection('room', 'registrationTable', e.target.value)}
                        />
                        <Input
                          size="sm"
                          label="Display Table"
                          value={beoForm.room.displayTable}
                          onChange={(e) => updateBeoFormSection('room', 'displayTable', e.target.value)}
                        />
                        <Input
                          size="sm"
                          label="Access"
                          value={beoForm.room.access}
                          onChange={(e) => updateBeoFormSection('room', 'access', e.target.value)}
                        />
                        <Input
                          size="sm"
                          label="Parking"
                          value={beoForm.room.parking}
                          onChange={(e) => updateBeoFormSection('room', 'parking', e.target.value)}
                        />
                      </div>
                      <Textarea
                        className="mt-3"
                        label="Setup Notes"
                        minRows={3}
                        value={beoForm.room.setupNotes}
                        onChange={(e) => updateBeoFormSection('room', 'setupNotes', e.target.value)}
                      />
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">Catering Specifications</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          size="sm"
                          label="Service Style"
                          value={beoForm.catering.serviceStyle}
                          onChange={(e) => updateBeoFormSection('catering', 'serviceStyle', e.target.value)}
                        />
                        <Input
                          size="sm"
                          label="Meal Type"
                          value={beoForm.catering.mealType}
                          onChange={(e) => updateBeoFormSection('catering', 'mealType', e.target.value)}
                        />
                        <Input
                          size="sm"
                          label="Tea Breaks"
                          value={beoForm.catering.teaBreaks}
                          onChange={(e) => updateBeoFormSection('catering', 'teaBreaks', e.target.value)}
                        />
                        <Input
                          size="sm"
                          label="Special Diet Count"
                          value={beoForm.catering.specialDietary}
                          onChange={(e) => updateBeoFormSection('catering', 'specialDietary', e.target.value)}
                        />
                        <Textarea
                          label="Dietary Accommodations"
                          minRows={2}
                          value={beoForm.catering.dietaryAccommodations}
                          onChange={(e) => updateBeoFormSection('catering', 'dietaryAccommodations', e.target.value)}
                        />
                        <Textarea
                          label="Allergies"
                          minRows={2}
                          value={beoForm.catering.allergies}
                          onChange={(e) => updateBeoFormSection('catering', 'allergies', e.target.value)}
                        />
                        <Textarea
                          label="Beverages"
                          minRows={2}
                          value={beoForm.catering.beverages}
                          onChange={(e) => updateBeoFormSection('catering', 'beverages', e.target.value)}
                        />
                        <Textarea
                          label="Snacks"
                          minRows={2}
                          value={beoForm.catering.snacks}
                          onChange={(e) => updateBeoFormSection('catering', 'snacks', e.target.value)}
                        />
                      </div>
                    </CardBody>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Technical & AV Requirements</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        size="sm"
                        label="Projector"
                        value={beoForm.technical.projector}
                        onChange={(e) => updateBeoFormSection('technical', 'projector', e.target.value)}
                      />
                      <Input
                        size="sm"
                        label="Screen"
                        value={beoForm.technical.screen}
                        onChange={(e) => updateBeoFormSection('technical', 'screen', e.target.value)}
                      />
                      <Input
                        size="sm"
                        label="Sound System"
                        value={beoForm.technical.soundSystem}
                        onChange={(e) => updateBeoFormSection('technical', 'soundSystem', e.target.value)}
                      />
                      <Input
                        size="sm"
                        label="Microphones"
                        value={beoForm.technical.microphones}
                        onChange={(e) => updateBeoFormSection('technical', 'microphones', e.target.value)}
                      />
                      <Input
                        size="sm"
                        label="Laptop"
                        value={beoForm.technical.laptop}
                        onChange={(e) => updateBeoFormSection('technical', 'laptop', e.target.value)}
                      />
                      <Input
                        size="sm"
                        label="Internet"
                        value={beoForm.technical.internet}
                        onChange={(e) => updateBeoFormSection('technical', 'internet', e.target.value)}
                      />
                      <Input
                        size="sm"
                        label="Lighting"
                        value={beoForm.technical.lighting}
                        onChange={(e) => updateBeoFormSection('technical', 'lighting', e.target.value)}
                      />
                      <Input
                        size="sm"
                        label="Internet Speed"
                        value={beoForm.technical.internetSpeed}
                        onChange={(e) => updateBeoFormSection('technical', 'internetSpeed', e.target.value)}
                      />
                      <Input
                        size="sm"
                        label="Power Requirements"
                        value={beoForm.technical.powerRequirements}
                        onChange={(e) => updateBeoFormSection('technical', 'powerRequirements', e.target.value)}
                      />
                    </div>
                    <Textarea
                      className="mt-3"
                      label="Technical Notes"
                      minRows={3}
                      value={beoForm.technical.notes}
                      onChange={(e) => updateBeoFormSection('technical', 'notes', e.target.value)}
                    />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <h4 className="font-semibold">Event Timeline</h4>
                      <Button size="sm" color="primary" variant="flat" onPress={handleAddBeoTimeline}>
                        ➕ Add Timeline Item
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-3">
                      {beoForm.timeline.map((item: any, idx: number) => (
                        <div key={`timeline-${idx}`} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-white">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <Input size="sm" label="Time" value={item.time} onChange={(e) => updateBeoTimelineItem(idx, 'time', e.target.value)} />
                            <Input size="sm" label="Activity" value={item.activity} onChange={(e) => updateBeoTimelineItem(idx, 'activity', e.target.value)} />
                            <Input size="sm" label="Responsible" value={item.responsible} onChange={(e) => updateBeoTimelineItem(idx, 'responsible', e.target.value)} />
                            <Input size="sm" label="Duration" value={item.duration} onChange={(e) => updateBeoTimelineItem(idx, 'duration', e.target.value)} />
                          </div>
                          <div className="flex justify-end">
                            <Button size="sm" color="danger" variant="light" onPress={() => handleRemoveBeoTimeline(idx)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <h4 className="font-semibold">Department Checklist</h4>
                      <Button size="sm" color="secondary" variant="flat" onPress={handleAddBeoChecklist}>
                        ➕ Add Department Task
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-3">
                      {beoForm.departmentChecklist.map((task: any, idx: number) => (
                        <div key={`dept-${idx}`} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-white">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <Input size="sm" label="Time" value={task.time} onChange={(e) => updateBeoChecklistItem(idx, 'time', e.target.value)} />
                            <Input size="sm" label="Activity" value={task.activity} onChange={(e) => updateBeoChecklistItem(idx, 'activity', e.target.value)} />
                            <Input size="sm" label="Department" value={task.department} onChange={(e) => updateBeoChecklistItem(idx, 'department', e.target.value)} />
                            <Select
                              size="sm"
                              label="Status"
                              selectedKeys={[task.status || 'Pending']}
                              onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0] as string;
                                updateBeoChecklistItem(idx, 'status', value);
                              }}
                            >
                              <SelectItem key="Pending">Pending</SelectItem>
                              <SelectItem key="In Progress">In Progress</SelectItem>
                              <SelectItem key="Completed">Completed</SelectItem>
                            </Select>
                            <Input size="sm" label="Duration" value={task.duration} onChange={(e) => updateBeoChecklistItem(idx, 'duration', e.target.value)} />
                          </div>
                          <Textarea
                            label="Notes"
                            minRows={2}
                            value={task.notes}
                            onChange={(e) => updateBeoChecklistItem(idx, 'notes', e.target.value)}
                          />
                          <div className="flex justify-end">
                            <Button size="sm" color="danger" variant="light" onPress={() => handleRemoveBeoChecklist(idx)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <h4 className="font-semibold">Special Instructions</h4>
                      <Button size="sm" color="warning" variant="flat" onPress={handleAddBeoInstruction}>
                        ➕ Add Instruction
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-3">
                      {beoForm.instructions.map((instruction: string, idx: number) => (
                        <div key={`instruction-${idx}`} className="flex items-start gap-3">
                          <Input
                            className="flex-1"
                            label={`Instruction ${idx + 1}`}
                            value={instruction}
                            onChange={(e) => updateBeoInstruction(idx, e.target.value)}
                          />
                          <Button size="sm" color="danger" variant="light" onPress={() => handleRemoveBeoInstruction(idx)}>
                            ✖
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <h4 className="font-semibold">Key Contacts</h4>
                      <Button size="sm" color="success" variant="flat" onPress={handleAddBeoContact}>
                        ➕ Add Contact
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-4">
                      {beoForm.contacts.map((contact: any, idx: number) => (
                        <div key={`contact-${idx}`} className="p-3 border border-gray-200 rounded-lg bg-white space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label="Name" value={contact.name} onChange={(e) => updateBeoContact(idx, 'name', e.target.value)} />
                            <Input label="Role" value={contact.role} onChange={(e) => updateBeoContact(idx, 'role', e.target.value)} />
                            <Input label="Phone" value={contact.phone} onChange={(e) => updateBeoContact(idx, 'phone', e.target.value)} />
                            <Input label="Email" value={contact.email} onChange={(e) => updateBeoContact(idx, 'email', e.target.value)} />
                          </div>
                          <div className="flex justify-end">
                            <Button size="sm" color="danger" variant="light" onPress={() => handleRemoveBeoContact(idx)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              </form>
            ) : (
              <div className="py-12 text-center text-gray-500">No event selected.</div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={() => setIsBEOModalOpen(false)}>
              Cancel
            </Button>
            <Button color="warning" variant="flat" type="submit" form="beoForm">
              💾 Save BEO
            </Button>
            <Button color="success" variant="flat" onPress={() => exportFunctionSchedulePDF()}>
              📄 Function Schedule PDF
            </Button>
            <Button color="primary" variant="flat" onPress={() => exportFunctionSheetPDF()}>
              📋 Function Sheet PDF
            </Button>
            <Button color="primary">
              📧 Send to Departments
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>


      {/* Events Add/Edit Client modal removed; use canonical client form via redirect */}
      {/* Client View Modal */}
      <Modal 
        isOpen={isClientViewModalOpen} 
        onClose={() => setIsClientViewModalOpen(false)} 
        size="2xl" 
        scrollBehavior="inside" 
        classNames={{
          base: "max-w-[70vw] max-h-[90vh]",
          body: "p-6"
        }}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">👁️</span>
              <div>
                <h3 className="text-lg font-semibold">
                  Client Details
                </h3>
                <p className="text-sm text-gray-600">Viewing client information and contract details</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedClient && (
              <>
                {/* Client Basic Information */}
                <div className="mb-8">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    👤 Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Client Name</p>
                      <p className="font-medium">{selectedClient.name}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Position/Title</p>
                      <p className="font-medium">{selectedClient.position}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Contact Number</p>
                      <p className="font-medium">{selectedClient.contact}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Email Address</p>
                      <p className="font-medium text-blue-600">{selectedClient.email}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">WhatsApp Available</p>
                      <p className="font-medium">{selectedClient.whatsapp ? '✅ Yes' : '❌ No'}</p>
                    </div>
                  </div>
                </div>

                {/* Company Information */}
                <div className="mb-8">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    🏢 Company & Organization
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">Company Name</p>
                      <p className="font-medium text-blue-800">{selectedClient.organization}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">Industry</p>
                      <p className="font-medium text-blue-800">{selectedClient.industry}</p>
                    </div>
                  </div>
                </div>

                {/* Contract & Rates */}
                <div className="mb-8">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    💼 Contract & Rates
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Contract Status</p>
                      <Badge 
                        color={selectedClient.contractStatus === 'active' ? 'success' : 
                               selectedClient.contractStatus === 'expired' ? 'warning' : 
                               selectedClient.contractStatus === 'pending' ? 'primary' : 'default'}
                        variant="flat"
                      >
                        {selectedClient.contractStatus}
                      </Badge>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Contract Period</p>
                      <p className="font-medium text-green-800">
                        {selectedClient.contractStart} to {selectedClient.contractEnd}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Accommodation Rate</p>
                      <p className="font-medium text-purple-800">₵{selectedClient.rates.accommodation}/night</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Conference Rate</p>
                      <p className="font-medium text-purple-800">₵{selectedClient.rates.conference}/head</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Catering Rate</p>
                      <p className="font-medium text-purple-800">₵{selectedClient.rates.catering}/head</p>
                    </div>
                  </div>
                </div>

                {/* Special Terms */}
                {selectedClient.specialTerms && (
                  <div className="mb-8">
                    <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      ⭐ Special Terms & Conditions
                    </h4>
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-yellow-800">{selectedClient.specialTerms}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" variant="flat" onPress={() => setIsClientViewModalOpen(false)}>
              Close
            </Button>
            <Button 
              color="success" 
              onPress={() => {
                setIsClientViewModalOpen(false);
                setIsContractModalOpen(true);
              }}
            >
              📄 Generate Contract
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Client Edit Modal */}
      <Modal 
        isOpen={isClientEditModalOpen} 
        onClose={() => setIsClientEditModalOpen(false)} 
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "max-w-[70vw] max-h-[90vh]",
          body: "p-6"
        }}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📄</span>
              <div>
                <h3 className="text-lg font-semibold">
                  Generate Contract
                </h3>
                <p className="text-sm text-gray-600">Professional contract with negotiated rates and terms</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedClient && (
              <div className="space-y-8">
                {/* Contract Header */}
                <div className="text-center border-b-2 border-gray-200 pb-6">
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">EVENT SERVICES CONTRACT</h1>
                  <p className="text-gray-600">Between Ghana Hotel & Conference Center and {selectedClient.organization}</p>
                  <p className="text-sm text-gray-500 mt-2">Contract Period: {selectedClient.contractStart} to {selectedClient.contractEnd}</p>
                </div>

                {/* Client Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-4">Client Details</h4>
                    <div className="space-y-2">
                      <p><strong>Name:</strong> {selectedClient.name}</p>
                      <p><strong>Position:</strong> {selectedClient.position}</p>
                      <p><strong>Organization:</strong> {selectedClient.organization}</p>
                      <p><strong>Contact:</strong> {selectedClient.contact}</p>
                      <p><strong>Email:</strong> {selectedClient.email}</p>
                      <p><strong>WhatsApp:</strong> {selectedClient.whatsapp ? 'Available' : 'Not Available'}</p>
                    </div>
                  </div>
                  <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-4">Contract Information</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span><strong>Status:</strong></span>
                        <Badge 
                          color={selectedClient.contractStatus === 'active' ? 'success' : 
                                 selectedClient.contractStatus === 'expired' ? 'warning' : 
                                 selectedClient.contractStatus === 'pending' ? 'primary' : 'default'}
                          variant="flat"
                        >
                          {selectedClient.contractStatus}
                        </Badge>
                      </div>
                      <div><strong>Start Date:</strong> {selectedClient.contractStart}</div>
                      <div><strong>End Date:</strong> {selectedClient.contractEnd}</div>
                      <div><strong>Generated:</strong> {new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>

                {/* Negotiated Rates */}
                <div className="p-6 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-purple-800 mb-4">Negotiated Rates & Services</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-white rounded-lg">
                      <h5 className="font-medium text-purple-700 mb-2">Accommodation</h5>
                      <p className="text-2xl font-bold text-purple-800">₵{selectedClient.rates.accommodation}</p>
                      <p className="text-sm text-gray-600">per night</p>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <h5 className="font-medium text-purple-700 mb-2">Conference Services</h5>
                      <p className="text-2xl font-bold text-purple-800">₵{selectedClient.rates.conference}</p>
                      <p className="text-sm text-gray-600">per person</p>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <h5 className="font-medium text-purple-700 mb-2">Catering</h5>
                      <p className="text-2xl font-bold text-purple-800">₵{selectedClient.rates.catering}</p>
                      <p className="text-sm text-gray-600">per person</p>
                    </div>
                  </div>
                </div>

                {/* Special Terms */}
                {selectedClient.specialTerms && (
                  <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="font-semibold text-yellow-800 mb-4">Special Terms & Conditions</h4>
                    <p className="text-yellow-800">{selectedClient.specialTerms}</p>
                  </div>
                )}

                {/* Contract Terms */}
                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-4">Standard Contract Terms</h4>
                  <div className="space-y-3 text-sm text-gray-700">
                    <p>• <strong>Payment Terms:</strong> 50% deposit required upon booking, balance due 7 days before event</p>
                    <p>• <strong>Cancellation Policy:</strong> 30 days notice required for full refund, 14 days for 50% refund</p>
                    <p>• <strong>Force Majeure:</strong> Events beyond our control may result in rescheduling or refund</p>
                    <p>• <strong>Liability:</strong> Ghana Hotel & Conference Center liability limited to contract value</p>
                    <p>• <strong>Governing Law:</strong> This contract is governed by the laws of Ghana</p>
                  </div>
                </div>

                {/* Signature Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-white rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-4">Client Signature</h4>
                    <div className="border-t-2 border-gray-300 pt-4">
                      <p className="text-sm text-gray-600 mb-2">Client Name: _________________</p>
                      <p className="text-sm text-gray-600 mb-2">Date: _________________</p>
                      <p className="text-sm text-gray-600">Signature: _________________</p>
                    </div>
                  </div>
                  <div className="p-6 bg-white rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-4">Hotel Representative</h4>
                    <div className="border-t-2 border-gray-300 pt-4">
                      <p className="text-sm text-gray-600 mb-2">Name: _________________</p>
                      <p className="text-sm text-gray-600 mb-2">Date: _________________</p>
                      <p className="text-sm text-gray-600">Signature: _________________</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={() => { setIsContractModalOpen(false); setSelectedContractEventInfo(null); }}>
              Cancel
            </Button>
            <Button color="success" onPress={() => handleContractDownload()}>
              📥 Download PDF
            </Button>
            <Button color="primary" onPress={() => handleContractPrint()}>
              🖨️ Print Contract
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Event Folio Modal */}
      <Modal
        isOpen={isFolioModalOpen}
        onClose={closeFolioModal}
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalContent className="w-[85vw] max-w-[1200px]">
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📂</span>
              <div>
                <h3 className="text-lg font-semibold">Event Folio</h3>
                {activeFolio && (
                  <p className="text-sm text-gray-600">
                    {activeFolio.eventName} • {activeFolio.clientName}
                  </p>
                )}
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="py-6">
            {activeFolio ? (
              <div className="space-y-6">
                {/* Folio Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border-2 border-blue-200 bg-blue-50">
                    <CardBody className="p-4">
                      <p className="text-sm text-gray-600 mb-1">Folio ID</p>
                      <p className="text-lg font-bold text-blue-700">{activeFolio.id}</p>
                    </CardBody>
                  </Card>
                  <Card className="border-2 border-green-200 bg-green-50">
                    <CardBody className="p-4">
                      <p className="text-sm text-gray-600 mb-1">Status</p>
                      <Badge color={activeFolio.status === 'Open' ? 'success' : 'default'} variant="flat" size="lg">
                        {activeFolio.status}
                      </Badge>
                    </CardBody>
                  </Card>
                  <Card className="border-2 border-purple-200 bg-purple-50">
                    <CardBody className="p-4">
                      <p className="text-sm text-gray-600 mb-1">Total Charges</p>
                      <p className="text-lg font-bold text-purple-700">
                        {formatCurrency(activeFolioTotals.debits)}
                      </p>
                    </CardBody>
                  </Card>
                  <Card className="border-2 border-orange-200 bg-orange-50">
                    <CardBody className="p-4">
                      <p className="text-sm text-gray-600 mb-1">Total Payments</p>
                      <p className="text-lg font-bold text-orange-700">
                        {formatCurrency(activeFolioTotals.credits)}
                      </p>
                    </CardBody>
                  </Card>
                </div>

                {/* Current Balance */}
                {activeFolio && (
                  <Card className={`border-2 ${activeFolioBalance >= 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                    <CardBody className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                          <p className={`text-3xl font-bold ${activeFolioBalance >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                            {formatCurrency(activeFolioBalance)}
                          </p>
                          {activeFolioBalance >= 0 && (
                            <p className="text-xs text-gray-500 mt-1">Amount owed by client</p>
                          )}
                          {activeFolioBalance < 0 && (
                            <p className="text-xs text-gray-500 mt-1">Credit balance (overpayment)</p>
                          )}
                        </div>
                        {activeFolio.openingBalance !== 0 && (
                          <div className="text-right">
                            <p className="text-sm text-gray-600 mb-1">Opening Balance</p>
                            <p className="text-lg font-semibold text-gray-700">
                              {formatCurrency(activeFolio.openingBalance)}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* Overpayment Actions */}
                {activeFolioBalance < 0 && (
                  <Card className="border-2 border-yellow-200 bg-yellow-50">
                    <CardHeader>
                      <h4 className="font-semibold text-yellow-800">⚠️ Overpayment Detected</h4>
                      <p className="text-sm text-yellow-700">
                        Client has overpaid by {formatCurrency(Math.abs(activeFolioBalance))}
                      </p>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <p className="text-sm text-yellow-800 font-medium">Choose an action:</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            color="warning"
                            variant="flat"
                            onPress={() => processRefund(activeFolio)}
                          >
                            💸 Process Refund
                          </Button>
                          <Button
                            size="sm"
                            color="secondary"
                            variant="flat"
                            onPress={() => createCreditNote(activeFolio)}
                          >
                            📝 Create Credit Note
                          </Button>
                          <Button
                            size="sm"
                            color="default"
                            variant="flat"
                            onPress={() => {
                              const note = prompt('Add note about this overpayment:', 'Overpayment - Credit balance to be applied to future events');
                              if (note) {
                              const lastBalance = activeFolioBalance;
                                const newEntry: EventFolioEntry = {
                                  id: `FLE-${Date.now().toString().slice(-6)}`,
                                  date: new Date().toISOString().split('T')[0],
                                  description: `Note: ${note}`,
                                  debit: 0,
                                  credit: 0,
                                  balance: lastBalance,
                                  reference: ''
                                };
                                setEventFolios((prev: any) =>
                                  prev.map((f: any) =>
                                    f.id === activeFolio.id
                                      ? { ...f, entries: [...f.entries, newEntry], updatedAt: new Date().toISOString() }
                                      : f
                                  )
                                );
                                setActiveFolio((prev: any) =>
                                  prev && prev.id === activeFolio.id
                                    ? { ...prev, entries: [...prev.entries, newEntry], updatedAt: new Date().toISOString() }
                                    : prev
                                );
                              }
                            }}
                          >
                            📌 Add Note
                          </Button>
                        </div>
                        <div className="mt-3 p-3 bg-white rounded-lg border border-yellow-200">
                          <p className="text-xs text-yellow-800">
                            <strong>Options:</strong><br/>
                            • <strong>Refund:</strong> Process a refund to the client<br/>
                            • <strong>Credit Note:</strong> Create a credit note for future use<br/>
                            • <strong>Add Note:</strong> Document the overpayment for reference
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* Quick Import & Create Section */}
                {(() => {
                  if (!activeFolio || !activeFolio.eventId) {
                    return null;
                  }
                  
                  const event = allEvents.find(e => e.id === activeFolio.eventId);
                  const invoice = eventInvoices.find((inv: EventInvoice) => inv.eventId === activeFolio.eventId);
                  const receipts = eventReceipts.filter((rec: EventReceipt) => rec.eventId === activeFolio.eventId);
                  const budget = event ? getQuoteBudgetSnapshot(event) : null;
                  const budgetTotal = budget ? budget.total : 0;
                  
                  const invoiceExists = activeFolio.entries.some((e: EventFolioEntry) => e.reference === invoice?.id || e.description.includes(`Invoice ${invoice?.id}`));
                  const budgetExists = activeFolio.entries.some((e: EventFolioEntry) => e.description.includes('Event Budget') || e.description.includes('Quote'));
                  const existingReceiptRefs = activeFolio.entries.map((e: EventFolioEntry) => e.reference).filter(Boolean);
                  const newReceipts = receipts.filter((rec: any) => !existingReceiptRefs.includes(rec.id));
                  
                  // Always show this section if there's an event (can create invoice or import items)
                  return event ? (
                    <Card className="border-2 border-blue-200 bg-blue-50">
                      <CardHeader>
                        <h4 className="font-semibold text-blue-800">📥 Quick Import & Create</h4>
                        <p className="text-sm text-blue-600">Create invoices or import charges and payments from related documents</p>
                      </CardHeader>
                      <CardBody>
                        <div className="flex flex-wrap gap-2">
                          {!invoice && (
                            <Button
                              size="sm"
                              color="primary"
                              variant="solid"
                              onPress={() => {
                                if (!activeFolio || !activeFolio.eventId) {
                                  console.error('[Folio] Cannot create invoice: activeFolio or eventId is null');
                                  alert('Folio or event not found. Please try again.');
                                  return;
                                }
                                
                                try {
                                  // Find the event from the folio
                                  const event = allEvents.find(e => e.id === activeFolio.eventId);
                                  if (!event) {
                                    alert('Event not found. Please ensure the event exists.');
                                    return;
                                  }
                                  
                                  console.log('[Folio] Opening event form to create invoice for event:', activeFolio.eventId);
                                  // Open the event form in edit mode with invoice creation flag - the quote will become the invoice
                                  openEventForEdit(event, false, true);
                                  console.log('[Folio] Event form opened successfully');
                                } catch (error) {
                                  console.error('[Folio] Error opening event form:', error);
                                  alert(`Failed to open event form: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                }
                              }}
                            >
                              ➕ Create Invoice
                            </Button>
                          )}
                          {invoice && (
                            <Button
                              size="sm"
                              color="primary"
                              variant="flat"
                              onPress={() => importInvoiceToFolio(activeFolio)}
                            >
                              📄 Import Invoice ({formatCurrency(invoice.total)})
                              {invoiceExists && <span className="ml-1 text-xs opacity-75">(exists)</span>}
                            </Button>
                          )}
                          {invoice && (
                            <Button
                              size="sm"
                              color="secondary"
                              variant="flat"
                              onPress={() => openInvoiceModal('edit', invoice)}
                            >
                              ✏️ Edit Invoice
                            </Button>
                          )}
                          <Button
                            size="sm"
                            color="success"
                            variant="solid"
                            onPress={() => {
                              // Record a new receipt for this event directly from the folio.
                              // Pass an override with the current folio balance so the amount defaults correctly.
                              const eventOverride = {
                                ...event,
                                balance: activeFolioBalance
                              };
                              openReceiptModal('create', undefined, eventOverride);
                            }}
                          >
                            ➕ Record Receipt
                          </Button>
                          {receipts.length > 0 && (
                            <Button
                              size="sm"
                              color="success"
                              variant="flat"
                              onPress={() => importReceiptsToFolio(activeFolio)}
                              isDisabled={newReceipts.length === 0}
                            >
                              💳 Import Receipts ({newReceipts.length} new, {formatCurrency(newReceipts.reduce((sum, r) => sum + r.amount, 0))})
                            </Button>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  ) : null;
                })()}

                {/* Add Entry Form */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Add Entry</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <RadioGroup
                        label="Entry Type"
                        orientation="horizontal"
                        value={folioEntryForm.type}
                        onValueChange={(value) => {
                          const newType = value as 'charge' | 'payment';
                          setFolioEntryForm(prev => ({ 
                            ...prev, 
                            type: newType,
                            // Clear opposite center when switching types
                            costCenter: newType === 'charge' ? prev.costCenter : '',
                          revenueCenter: newType === 'payment' ? prev.revenueCenter : '',
                          method: newType === 'payment' ? (prev.method || 'Cash') : prev.method,
                          recordedBy: newType === 'payment' ? (prev.recordedBy || 'Events Team') : prev.recordedBy
                          }));
                        }}
                      >
                        <Radio value="charge">💳 Charge</Radio>
                        <Radio value="payment">💰 Payment</Radio>
                      </RadioGroup>
                      <Input
                        label="Amount (₵)"
                        type="number"
                        placeholder="Enter amount"
                        value={folioEntryForm.amount > 0 ? String(folioEntryForm.amount) : ''}
                        onValueChange={(value) => setFolioEntryForm(prev => ({ ...prev, amount: parseFloat(value) || 0 }))}
                      />
                      <Input
                        label="Description"
                        placeholder="Enter description"
                        value={folioEntryForm.description}
                        onValueChange={(value) => setFolioEntryForm(prev => ({ ...prev, description: value }))}
                        className="md:col-span-2"
                      />
                      <Input
                        label="Reference (Optional)"
                        placeholder="Invoice ID, Receipt No., etc."
                        value={folioEntryForm.reference || ''}
                        onValueChange={(value) => setFolioEntryForm(prev => ({ ...prev, reference: value }))}
                        className="md:col-span-2"
                      />
                      {folioEntryForm.type === 'charge' && (
                        <Select
                          label="Cost Center (Optional)"
                          placeholder="Select cost center for tracking"
                          selectedKeys={folioEntryForm.costCenter ? [folioEntryForm.costCenter] as any : []}
                          onSelectionChange={(keys) => {
                            const selected = Array.from(keys)[0] as string;
                            setFolioEntryForm(prev => ({ ...prev, costCenter: selected || '' }));
                          }}
                          className="md:col-span-2"
                        >
                          {costCenters.filter(cc => cc.isActive).map((cc) => (
                            <SelectItem key={cc.code}>
                              {cc.code} - {cc.name}
                            </SelectItem>
                          ))}
                        </Select>
                      )}
                      {folioEntryForm.type === 'payment' && (
                        <Select
                          label="Revenue Center (Optional)"
                          placeholder="Select revenue center for tracking"
                          selectedKeys={folioEntryForm.revenueCenter ? [folioEntryForm.revenueCenter] as any : []}
                          onSelectionChange={(keys) => {
                            const selected = Array.from(keys)[0] as string;
                            setFolioEntryForm(prev => ({ ...prev, revenueCenter: selected || '' }));
                          }}
                          className="md:col-span-2"
                        >
                          {revenueCenters.filter(rc => rc.isActive).map((rc) => (
                            <SelectItem key={rc.code}>
                              {rc.code} - {rc.name}
                            </SelectItem>
                          ))}
                        </Select>
                      )}
                      {folioEntryForm.type === 'payment' && (
                        <>
                          <Select
                            label="Payment Method"
                            selectedKeys={folioEntryForm.method ? [folioEntryForm.method] as any : ['Cash']}
                            onSelectionChange={(keys) => {
                              const selected = Array.from(keys)[0] as ReceiptMethod;
                              setFolioEntryForm(prev => ({ ...prev, method: selected || 'Cash' }));
                            }}
                          >
                            {receiptMethods.map(method => (
                              <SelectItem key={method}>{method}</SelectItem>
                            ))}
                          </Select>
                          <Input
                            label="Received / Recorded By"
                            placeholder="Events Team"
                            value={folioEntryForm.recordedBy || ''}
                            onValueChange={(value) => setFolioEntryForm(prev => ({ ...prev, recordedBy: value }))}
                          />
                        </>
                      )}
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button
                        color="primary"
                        onPress={handleAddFolioEntry}
                        isDisabled={!folioEntryForm.description.trim() || folioEntryForm.amount <= 0}
                      >
                        ➕ Add Entry
                      </Button>
                    </div>
                  </CardBody>
                </Card>

                {/* Entries Table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <h4 className="font-semibold">Folio Entries</h4>
                      {activeFolio.entries.length > 5 && (
                        <Input
                          size="sm"
                          placeholder="Search entries..."
                          value={folioEntrySearch}
                          onValueChange={setFolioEntrySearch}
                          startContent={<span className="text-gray-400">🔍</span>}
                          className="max-w-xs"
                          variant="flat"
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardBody>
                    {activeFolio.entries.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <span className="text-4xl">📋</span>
                        <p className="mt-2">No entries yet. Add charges or payments above.</p>
                      </div>
                    ) : filteredFolioEntries.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <span className="text-4xl">🔍</span>
                        <p className="mt-2">No entries match your search.</p>
                        <Button
                          size="sm"
                          color="default"
                          variant="flat"
                          className="mt-2"
                          onPress={() => setFolioEntrySearch('')}
                        >
                          Clear Search
                        </Button>
                      </div>
                    ) : (
                      <Table aria-label="Folio entries">
                        <TableHeader>
                          <TableColumn>DATE</TableColumn>
                          <TableColumn>DESCRIPTION</TableColumn>
                          <TableColumn>REFERENCE</TableColumn>
                          <TableColumn>CENTER</TableColumn>
                          <TableColumn className="text-right">CHARGE</TableColumn>
                          <TableColumn className="text-right">PAYMENT</TableColumn>
                          <TableColumn className="text-right">BALANCE</TableColumn>
                          <TableColumn className="text-center">ACTIONS</TableColumn>
                        </TableHeader>
                        <TableBody>
                          <React.Fragment>
                            {activeFolio.openingBalance !== 0 && (
                              <TableRow>
                                <TableCell>
                                  {new Date(activeFolio.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="font-medium">Opening Balance</TableCell>
                                <TableCell>—</TableCell>
                                <TableCell>
                                  <span className="text-gray-400">—</span>
                                </TableCell>
                                <TableCell className="text-right">
                                  {activeFolio.openingBalance > 0 ? formatCurrency(activeFolio.openingBalance) : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {activeFolio.openingBalance < 0 ? formatCurrency(Math.abs(activeFolio.openingBalance)) : '—'}
                                </TableCell>
                                <TableCell className={`text-right font-semibold ${activeFolio.openingBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {formatCurrency(activeFolio.openingBalance)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="text-gray-400 text-xs">—</span>
                                </TableCell>
                              </TableRow>
                            )}
                            {filteredFolioEntries.map((entry: EventFolioEntry) => {
                              const costCenter = entry.costCenter ? costCenters.find(cc => cc.code === entry.costCenter) : null;
                              const revenueCenter = entry.revenueCenter ? revenueCenters.find(rc => rc.code === entry.revenueCenter) : null;
                              const center = costCenter || revenueCenter;
                              const linkedInvoice = entry.reference
                                ? eventInvoices.find(inv => inv.id === entry.reference)
                                : null;
                              const linkedReceipt = entry.reference
                                ? eventReceipts.find(rcpt => rcpt.id === entry.reference)
                                : null;
                              
                              return (
                                <TableRow key={entry.id}>
                                  <TableCell>
                                    {new Date(entry.date).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell>{entry.description}</TableCell>
                                  <TableCell>
                                    {entry.reference ? (
                                      <Badge color="secondary" variant="flat" size="sm">
                                        {entry.reference}
                                      </Badge>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {center ? (
                                      <Badge 
                                        color={costCenter ? 'warning' : 'success'} 
                                        variant="flat" 
                                        size="sm"
                                      >
                                        {center.code}
                                      </Badge>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {entry.debit > 0 ? (
                                      <span className="text-red-600 font-semibold">{formatCurrency(entry.debit)}</span>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {entry.credit > 0 ? (
                                      <span className="text-green-600 font-semibold">{formatCurrency(entry.credit)}</span>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className={`text-right font-semibold ${entry.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(entry.balance)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {linkedInvoice && (
                                        <Tooltip content={`Open event form for invoice ${linkedInvoice.id}`}>
                                          <Button
                                            size="sm"
                                            color="primary"
                                            variant="light"
                                            isIconOnly
                                            className="min-w-8 h-8"
                                            onPress={() => handleEditInvoiceFromFolio(linkedInvoice)}
                                          >
                                            🧾
                                          </Button>
                                        </Tooltip>
                                      )}
                                      {linkedReceipt && (
                                        <Tooltip content={`Edit receipt ${linkedReceipt.id}`}>
                                          <Button
                                            size="sm"
                                            color="success"
                                            variant="light"
                                            isIconOnly
                                            className="min-w-8 h-8"
                                            onPress={() => handleEditReceiptFromFolio(linkedReceipt)}
                                          >
                                            💳
                                          </Button>
                                        </Tooltip>
                                      )}
                                      <Tooltip content="Reverse Entry (Create opposite entry)">
                                        <Button
                                          size="sm"
                                          color="warning"
                                          variant="light"
                                          isIconOnly
                                          onPress={() => reverseFolioEntry(activeFolio, entry)}
                                          className="min-w-8 h-8"
                                        >
                                          ↻
                                        </Button>
                                      </Tooltip>
                                      <Tooltip content="Delete Entry">
                                        <Button
                                          size="sm"
                                          color="danger"
                                          variant="light"
                                          isIconOnly
                                          onPress={() => deleteFolioEntry(activeFolio, entry.id)}
                                          className="min-w-8 h-8"
                                        >
                                          ✖
                                        </Button>
                                      </Tooltip>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        </TableBody>
                      </Table>
                    )}
                  </CardBody>
                </Card>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <span className="text-4xl">📂</span>
                <p className="mt-2">No folio selected</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
                <Button
              color="primary"
              onPress={handleUpdateFolio}
              isDisabled={!activeFolio}
            >
              Update Folio
                </Button>
            <Button color="default" variant="flat" onPress={closeFolioModal}>
              Close
                </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Event Invoice Modal */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📄</span>
              <div>
                <h3 className="text-lg font-semibold">
                  {invoiceModalMode === 'edit' ? 'Edit Invoice' : 'Create Invoice'}
                </h3>
                <p className="text-sm text-gray-500">
                  {invoiceForm.eventName || 'Event Invoice'}
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="py-6">
            <div className="space-y-4">
              <Input
                label="Event"
                value={invoiceForm.eventName || ''}
                isReadOnly
                variant="flat"
              />
              <Input
                label="Client Name"
                value={invoiceForm.clientName || ''}
                onValueChange={(value) => setInvoiceForm(prev => ({ ...prev, clientName: value }))}
                isInvalid={!!invoiceErrors.clientName}
                errorMessage={invoiceErrors.clientName}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Issue Date"
                  type="date"
                  value={invoiceForm.issueDate || ''}
                  onValueChange={(value) => setInvoiceForm(prev => ({ ...prev, issueDate: value }))}
                  isInvalid={!!invoiceErrors.issueDate}
                  errorMessage={invoiceErrors.issueDate}
                />
                <Input
                  label="Due Date"
                  type="date"
                  value={invoiceForm.dueDate || ''}
                  onValueChange={(value) => setInvoiceForm(prev => ({ ...prev, dueDate: value }))}
                  isInvalid={!!invoiceErrors.dueDate}
                  errorMessage={invoiceErrors.dueDate}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Subtotal (₵)"
                  type="number"
                  value={invoiceForm.subtotal?.toString() || '0'}
                  onValueChange={(value) => {
                    const num = parseFloat(value) || 0;
                    const tax = invoiceForm.tax || 0;
                    const newTotal = num + tax;
                    setInvoiceForm(prev => ({
                      ...prev,
                      subtotal: num,
                      total: newTotal,
                      balance: newTotal
                    }));
                  }}
                  isInvalid={!!invoiceErrors.subtotal}
                  errorMessage={invoiceErrors.subtotal}
                />
                <Input
                  label="Tax (₵)"
                  type="number"
                  value={invoiceForm.tax?.toString() || '0'}
                  onValueChange={(value) => {
                    const num = parseFloat(value) || 0;
                    setInvoiceForm(prev => ({
                      ...prev,
                      tax: num,
                      total: (prev.subtotal || 0) + num,
                      balance: (prev.subtotal || 0) + num
                    }));
                  }}
                  isInvalid={!!invoiceErrors.tax}
                  errorMessage={invoiceErrors.tax}
                />
              </div>
              <Input
                label="Total (₵)"
                type="number"
                value={invoiceForm.total?.toString() || '0'}
                onValueChange={(value) => {
                  const num = parseFloat(value) || 0;
                  setInvoiceForm(prev => ({ ...prev, total: num, balance: num }));
                }}
                isInvalid={!!invoiceErrors.total}
                errorMessage={invoiceErrors.total}
              />
              <Input
                label="Balance (₵)"
                type="number"
                value={invoiceForm.balance?.toString() || '0'}
                onValueChange={(value) => setInvoiceForm(prev => ({ ...prev, balance: parseFloat(value) || 0 }))}
                isInvalid={!!invoiceErrors.balance}
                errorMessage={invoiceErrors.balance}
              />
              <Input
                label="Reference (Optional)"
                value={invoiceForm.reference || ''}
                onValueChange={(value) => setInvoiceForm(prev => ({ ...prev, reference: value }))}
                placeholder="Invoice reference number"
              />
              <Textarea
                label="Notes (Optional)"
                value={invoiceForm.notes || ''}
                onValueChange={(value) => setInvoiceForm(prev => ({ ...prev, notes: value }))}
                placeholder="Additional notes"
                minRows={3}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="default" variant="flat" onPress={() => setIsInvoiceModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleInvoiceSave}>
              {invoiceModalMode === 'edit' ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Event Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">💳</span>
              <div>
                <h3 className="text-lg font-semibold">
                  {receiptModalMode === 'edit' ? 'Edit Receipt' : 'Record Receipt'}
                </h3>
                <p className="text-sm text-gray-500">
                  {receiptForm.eventName || 'Event Receipt'}
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="py-6">
            <div className="space-y-4">
              <Select
                label="Select Event"
                placeholder="Choose an event"
                selectedKeys={receiptForm.eventId ? [receiptForm.eventId] : []}
                onSelectionChange={(keys) => {
                  const eventId = Array.from(keys)[0] as string;
                  if (eventId) {
                    const selectedEvent = allEvents.find(e => e.id === eventId);
                    if (selectedEvent) {
                      setReceiptForm(prev => ({
                        ...prev,
                        eventId: eventId,
                        eventName: getEventDisplayName(selectedEvent),
                        clientName: getEventClientName(selectedEvent)
                      }));
                    }
                  }
                }}
                isInvalid={!!receiptErrors.eventId}
                errorMessage={receiptErrors.eventId}
              >
                {eventOptions.map(option => (
                  <SelectItem key={option.id} textValue={option.label}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-gray-500">{option.client}</span>
                    </div>
                  </SelectItem>
                ))}
              </Select>
              <Input
                label="Event Name"
                value={receiptForm.eventName || ''}
                isReadOnly
                variant="flat"
                description="Auto-filled from selected event"
              />
              <Input
                label="Client Name"
                value={receiptForm.clientName || ''}
                onValueChange={(value) => setReceiptForm(prev => ({ ...prev, clientName: value }))}
                isInvalid={!!receiptErrors.clientName}
                errorMessage={receiptErrors.clientName}
                description="Can be edited if different from event client"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Receipt Date"
                  type="date"
                  value={receiptForm.date || ''}
                  onValueChange={(value) => setReceiptForm(prev => ({ ...prev, date: value }))}
                  isInvalid={!!receiptErrors.date}
                  errorMessage={receiptErrors.date}
                />
                <Input
                  label="Amount (₵)"
                  type="number"
                  value={receiptForm.amount?.toString() || '0'}
                  onValueChange={(value) => setReceiptForm(prev => ({ ...prev, amount: parseFloat(value) || 0 }))}
                  isInvalid={!!receiptErrors.amount}
                  errorMessage={receiptErrors.amount}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Payment Method"
                  selectedKeys={receiptForm.method ? [receiptForm.method] : []}
                  onSelectionChange={(keys) => {
                    const method = Array.from(keys)[0] as ReceiptMethod;
                    setReceiptForm(prev => ({ ...prev, method: method || 'Cash' }));
                  }}
                >
                  {receiptMethods.map(method => (
                    <SelectItem key={method}>{method}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="Reference"
                  value={receiptForm.reference || ''}
                  onValueChange={(value) => setReceiptForm(prev => ({ ...prev, reference: value }))}
                  placeholder="Transaction reference"
                />
              </div>
              <Select
                label="Link to Invoice (Optional)"
                placeholder="Select an invoice to link this receipt to"
                selectedKeys={receiptForm.invoiceId ? [receiptForm.invoiceId] : []}
                onSelectionChange={(keys) => {
                  const invoiceId = Array.from(keys)[0] as string;
                  if (invoiceId === 'none') {
                    setReceiptForm(prev => ({ ...prev, invoiceId: '' }));
                  } else {
                    setReceiptForm(prev => ({ ...prev, invoiceId: invoiceId || '' }));
                  }
                }}
                description="Link this receipt to an invoice to automatically update invoice balance"
              >
                <SelectItem key="none" textValue="None">
                  <span className="text-gray-500">No invoice link</span>
                </SelectItem>
                {(() => {
                  const items: React.ReactElement[] = [];
                  if (!receiptForm.eventId) {
                    items.push(
                      <SelectItem key="no-event" isDisabled>
                        Select an event first
                      </SelectItem>
                    );
                  } else {
                    const filteredInvoices = eventInvoices.filter(inv => inv.eventId === receiptForm.eventId);
                    if (filteredInvoices.length === 0) {
                      items.push(
                        <SelectItem key="no-invoices" isDisabled>
                          No invoices found for this event
                        </SelectItem>
                      );
                    } else {
                      items.push(...filteredInvoices.map(invoice => (
                        <SelectItem key={invoice.id} textValue={invoice.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{invoice.id}</span>
                            <span className="text-xs text-gray-500">
                              {formatCurrency(invoice.balance)} outstanding • {formatDateDisplay(invoice.dueDate)}
                            </span>
                          </div>
                        </SelectItem>
                      )));
                    }
                  }
                  return items as any;
                })() as any}
              </Select>
              <Input
                label="Recorded By"
                value={receiptForm.recordedBy || ''}
                onValueChange={(value) => setReceiptForm(prev => ({ ...prev, recordedBy: value }))}
                placeholder="Name of person recording receipt"
              />
              <Textarea
                label="Notes"
                value={receiptForm.notes || ''}
                onValueChange={(value) => setReceiptForm(prev => ({ ...prev, notes: value }))}
                placeholder="Additional notes or comments"
                minRows={3}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="default" variant="flat" onPress={() => setIsReceiptModalOpen(false)}>
              Cancel
            </Button>
            <Button color="success" onPress={handleReceiptSave}>
              {receiptModalMode === 'edit' ? 'Update Receipt' : 'Record Receipt'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}