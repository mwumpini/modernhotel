'use client';
// Screens for this department live in ./events/. Open the file that matches the tab.
// EventManagementTab — event master, invoices, receipts, folios
// VenueManagementTab / VenueModal — venue list and the venue dialog
// GuestRatesPanel — guest rates
// EventEditorModal — the event form (dates, rooms, schedule, tax)
// EventFunctionSheetModal — service dialog and function sheet
// EventClientModals, EventFolioModal, EventInvoiceModal, EventReceiptModal — billing dialogs
import { EventsScreenProvider } from './events/eventsScreenContext';
import { EventManagementTab } from './events/EventManagementTab';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
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
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Autocomplete,
  AutocompleteItem,
  Pagination
} from "@heroui/react";
import { trackEvent } from '../lib/analytics/trackEvent';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import { useRouter } from 'next/navigation';
import { useFrontOfficeSelector } from '../lib/frontoffice/useFoStore';
import { worksheetTableClassNames } from './frontoffice/StayWorksheetTable';
import { deskResizableTableClassNames } from './frontoffice/columnResize';
import { FOLIO_PAGE_SIZE, compareFolioValues, folioAccountColumnList, renderFolioAccountColumn, useFolioAccountColumns, type FolioAccountCol } from './frontoffice/folioAccountColumns';
import { useComplianceStore } from '../lib/compliance/store';
import { useCalculateTax } from '../hooks/useCalculateTax';
import { enhancedFrontOfficeStore } from '../lib/frontoffice/enhancedStore';
import { fetchEventBookings, saveEventBooking } from '../lib/frontoffice/eventsApi';
import { frontOfficeStore } from '../lib/frontoffice/store';
import type { EventBooking, GuestProfile } from '../lib/frontoffice/types';
import { genId } from '../lib/frontoffice/helpers/ids';
import { openPrintPreview, openHtmlPrintWindow } from '../lib/print/engine';
import type { PrintType } from '../lib/print/templates';
import { paymentMethodLabel } from '../lib/accounting/receiptPrint';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import { buildContractModel, buildContractPrintData, contractTermsFromBlocks, downloadContractDocx } from '../lib/events/contractDocument';
import { getBuiltInTemplate, listBuiltInTemplates } from '../lib/print/blockDefaults';
import { useSettingsStore } from '../lib/settings/store';
import { useAccountingStore } from '../lib/accounting/store';
import { adjustConferenceChargeInAccounting, unvoidConferenceReceiptInAccounting, voidConferenceReceiptInAccounting } from '../lib/accounting/folioVoidSync';
import { captureRevenue, capturePayment, recognizeDeferredRevenue, reverseRecognizedRevenue, captureConferenceProforma, markConferenceProformaConverted, retireOrphanConferenceInvoices } from '../lib/accounting/integration';
import { announcementStore, DepartmentKey } from '../lib/analytics/announcementStore';
import { computeQuoteTax, exclusiveFromGross } from '../lib/tax/engine';
import EventsModuleFilters, {
  matchesEventsDateFilter,
  getEventsDateRangeBounds,
  eventPrimaryDate,
  type EventsDateFilterMode,
} from './EventsModuleFilters';
import { useEmployeeStore } from '../lib/hr/employeeStore';
import ModuleExpandButton from './ModuleExpandButton';

// The event list is the screen that opens. Venues, rates, reports, staff, and
// the dialogs stay out of that first load and come in when they are opened.
const VenueManagementTab = dynamic(() =>
  import('./events/VenueManagementTab').then((m) => ({ default: m.VenueManagementTab })),
);
const VenueModal = dynamic(() =>
  import('./events/VenueManagementTab').then((m) => ({ default: m.VenueModal })),
);
const GuestRatesPanel = dynamic(() =>
  import('./events/GuestRatesPanel').then((m) => ({ default: m.GuestRatesPanel })),
);
const EventsReportsAnalysis = dynamic(() => import('./EventsReportsAnalysis'));
const DepartmentStaffTab = dynamic(() => import('./hr/DepartmentStaffTab'));
const EventEditorModal = dynamic(() =>
  import('./events/EventEditorModal').then((m) => ({ default: m.EventEditorModal })),
);
const EventFunctionSheetModal = dynamic(() =>
  import('./events/EventFunctionSheetModal').then((m) => ({ default: m.EventFunctionSheetModal })),
);
const EventClientModals = dynamic(() =>
  import('./events/EventClientModals').then((m) => ({ default: m.EventClientModals })),
);
const EventFolioModal = dynamic(() =>
  import('./events/EventFolioModal').then((m) => ({ default: m.EventFolioModal })),
);
const EventFolioCreateModal = dynamic(() =>
  import('./events/EventFolioModal').then((m) => ({ default: m.EventFolioCreateModal })),
);
const EventInvoiceModal = dynamic(() =>
  import('./events/EventInvoiceModal').then((m) => ({ default: m.EventInvoiceModal })),
);
const EventProformaPickerModal = dynamic(() =>
  import('./events/EventInvoiceModal').then((m) => ({ default: m.EventProformaPickerModal })),
);
const EventReceiptModal = dynamic(() =>
  import('./events/EventReceiptModal').then((m) => ({ default: m.EventReceiptModal })),
);
const EventDocCautionModal = dynamic(() =>
  import('./events/EventReceiptModal').then((m) => ({ default: m.EventDocCautionModal })),
);
import { deskBookTabsClassNames } from './dashboard/deskTabsUi';
import { deskTableCardBodyClassName, deskTableCardClassName } from './dashboard/deskTableUi';
import {
  buildIdSequence,
  nextSequenceLabel,
  sequenceLabel,
  sortIdsByDate,
} from '../lib/events/documentNumbers';

import {
  ManagementMainTabKey,
  UNASSIGNED_STAFF,
  BEO_LAYOUTS,
  BEO_ACCESS,
  BEO_PARKING,
  BEO_LIGHTING,
  BEO_INTERNET,
  BEO_SERVICE_STYLES,
  BEO_MEAL_TYPES,
  BEO_DEPT_FALLBACK,
  withCurrentOption,
  BeoPick,
  RECEIPT_METHOD_OPTIONS,
  resolveFromOptions,
  resolveReceiptMethod,
  getEventCoordinator,
  pickStoredEventCoordinator,
  getEventClientContactName,
  formatEventTableDate,
  formatEventTableRange,
  eventStayType,
  parseEventDate,
  eventStartValue,
  eventEndValue,
  isUnassignedVenueLabel,
  findVenueInCatalog,
  eventVenueKey,
  eventVenueLabel,
  eventUsesVenue,
  eventHasBeo,
  eventRoomCount,
  departmentScheduleLines,
  functionFbDuties,
  functionHkDuties,
  formatScheduleStatus,
  VenueStatus,
  VenueDetails,
  VenueFormState,
  supplementalVenueSeeds,
  baseVenueSeeds,
  initialVenueCatalog,
  createEmptyVenueForm,
  slugify,
  InfoIcon,
  ReportFilterConfig,
  ReportDefinition,
  ReportCategory,
  ReportInsight,
  ReportQuickLink,
  ReportTableColumn,
  ReportTableData,
  ReportFiltersState,
  getDefaultReportRange,
  buildInitialReportFilters,
  filterEventsForReport,
  matchesReportDate,
  RateApplicableDates,
  RateEffectiveStatus,
  getRateEffectiveStatus,
  rateOverlapsDateRange,
  rateEffectiveForEventDates,
  formatRateTableDate,
  getRateEffectivePeriodLabel,
  pickBestRateForType,
  resolveGuestRatesForEvent,
  PrintScheduleRates,
  buildPrintLineItemsFromSchedule,
  buildMatrixTableFromSchedule,
  buildScheduleTableFromSchedule,
  EVENT_DOC_TYPE,
  scheduleHasEventComponent,
  budgetHasEventComponent,
  RATE_EFFECTIVE_STATUS_META,
  GUEST_RATES_STORAGE_KEY_PREFIX,
  EVENTS_DOCS_STORAGE_KEY_PREFIX,
  guestRatesStorageKey,
  eventsDocsStorageKey,
  HARDCODED_EVENT_IDS,
  HARDCODED_BILLING_IDS,
  isHardcodedDemoEventId,
  isHardcodedBillingDoc,
  dayKeyFromValue,
  mapApiBookingToEvent,
  DEFAULT_CONFERENCE_RATES,
  loadStoredConferenceRates,
  EVENTS_REPORT_CATALOG,
} from './events/eventShared';
import type {
  SimpleEventStatus,
  EventInvoiceStatus,
  ReceiptMethod,
  EventInvoice,
  InvoiceFormSnapshot,
  EventReceipt,
  EventFolioEntry,
  EventFolio,
  QuoteListItem,
  SortDirection,
  TableSortState,
  QuoteBudgetSnapshot,
  QuoteServiceLine,
  QuoteDay,
  Package,
  AddOn,
} from './events/eventTypes';

export default function EventsConferencesMainDashboard({
  fullPage = false,
  workspaceOnly = false,
  externalEditEventId = null,
  onWorkspaceClose,
}: {
  fullPage?: boolean;
  /** Render only the event edit modal (e.g. opened from Accounting over the AR screen). */
  workspaceOnly?: boolean;
  externalEditEventId?: string | null;
  onWorkspaceClose?: () => void;
} = {}) {
  const router = useRouter();
  const initializeAccounting = useAccountingStore((s) => s.initializeAccounting);
  const accountingInvoices = useAccountingStore((s) => s.invoices);
  const employees = useEmployeeStore((s) => s.employees);
  const hrDepartments = useEmployeeStore((s) => s.departments);
  const hydrateEmployees = useEmployeeStore((s) => s.hydrateFromApi);
  const eventStaffOptions = useMemo(
    () =>
      employees
        .filter((employee) => employee.status === 'active')
        .map((employee) => {
          const name = `${employee.firstName} ${employee.lastName}`.trim();
          return { key: name, label: name };
        })
        .filter((option) => option.key),
    [employees]
  );
  const beoCoordinatorOptions = useMemo(
    () => [{ key: UNASSIGNED_STAFF, label: UNASSIGNED_STAFF }, ...eventStaffOptions],
    [eventStaffOptions]
  );
  const staffCoordinatorNames = useMemo(
    () => eventStaffOptions.map((option) => option.key),
    [eventStaffOptions]
  );
  const preferredEventCoordinator = useMemo(
    () => pickStoredEventCoordinator(employees, hrDepartments),
    [employees, hrDepartments]
  );
  const resolveEventCoordinator = useCallback(
    (event: any) => getEventCoordinator(event, staffCoordinatorNames, preferredEventCoordinator),
    [staffCoordinatorNames, preferredEventCoordinator]
  );
  const resolveCoordinatorValue = useCallback(
    (value?: string) =>
      resolveFromOptions(value, staffCoordinatorNames, preferredEventCoordinator || UNASSIGNED_STAFF),
    [staffCoordinatorNames, preferredEventCoordinator]
  );
  const beoDepartmentOptions = useMemo(() => {
    const fromHr = hrDepartments
      .filter((dept) => dept.status !== 'inactive' && dept.isActive !== false)
      .map((dept) => String(dept.name || '').trim())
      .filter(Boolean);
    return fromHr.length ? Array.from(new Set(fromHr)) : BEO_DEPT_FALLBACK;
  }, [hrDepartments]);
  const beoResponsibleOptions = useMemo(
    () => Array.from(new Set([...beoDepartmentOptions, ...eventStaffOptions.map((option) => option.label)])),
    [beoDepartmentOptions, eventStaffOptions]
  );
  const [selectedTab, setSelectedTab] = useState('confirmed');
  const [venueSearchTerm, setVenueSearchTerm] = useState('');
  const [venueStatusFilter, setVenueStatusFilter] = useState('all');
  const [reportsDateFilterMode, setReportsDateFilterMode] = useState<EventsDateFilterMode>('thisMonth');
  const [reportsDateFilterSingle, setReportsDateFilterSingle] = useState('');
  const [reportsDateFilterFrom, setReportsDateFilterFrom] = useState('');
  const [reportsDateFilterTo, setReportsDateFilterTo] = useState('');
  const [modernVenues, setModernVenues] = useState<VenueDetails[]>(initialVenueCatalog);
  const [managementMainTab, setManagementMainTab] = useState<ManagementMainTabKey>('events');
  const [managementStatusFilter, setManagementStatusFilter] = useState('all');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isBEOModalOpen, setIsBEOModalOpen] = useState(false);
  useEffect(() => {
    if (!isEventModalOpen && !isBEOModalOpen) return;
    hydrateEmployees();
  }, [hydrateEmployees, isEventModalOpen, isBEOModalOpen]);
  const [beoWorkspaceTab, setBeoWorkspaceTab] = useState('overview');
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState<boolean>(false);
  const [isViewMode, setIsViewMode] = useState<boolean>(false);
  const [isAdjustMode, setIsAdjustMode] = useState<boolean>(false);
  const [isCreatingInvoiceFromFolio, setIsCreatingInvoiceFromFolio] = useState<boolean>(false);
  const [isEditingInvoiceDetails, setIsEditingInvoiceDetails] = useState<boolean>(false);
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
  const [eventsHydrated, setEventsHydrated] = useState(false);
  const [eventSubmitting, setEventSubmitting] = useState<boolean>(false);
  const [reportSearch, setReportSearch] = useState('');
  const [selectedReportKey, setSelectedReportKey] = useState(
    EVENTS_REPORT_CATALOG[0]?.reports[0]?.key || ''
  );
  const [reportFilters, setReportFilters] = useState<ReportFiltersState>(() => buildInitialReportFilters());
  useEffect(() => {
    const apply = () => {
      try {
        const tab = localStorage.getItem('events.tab');
        const mgmtTab = localStorage.getItem('events.managementTab');
        if (tab === 'reports') {
          setSelectedTab('reports');
          localStorage.removeItem('events.tab');
          return;
        }
        if (tab) {
          setSelectedTab(tab);
          localStorage.removeItem('events.tab');
        }
        if (mgmtTab) {
          const folded = mgmtTab === 'people' || mgmtTab === 'active' || mgmtTab === 'completed' || mgmtTab === 'quotes';
          setManagementMainTab(folded ? 'events' : (mgmtTab as ManagementMainTabKey));
          if (mgmtTab === 'quotes') setManagementStatusFilter('quote');
          else if (mgmtTab === 'active' || mgmtTab === 'completed') setManagementStatusFilter(mgmtTab);
          localStorage.removeItem('events.managementTab');
        }
      } catch {
        /* ignore */
      }
    };
    apply();
    window.addEventListener('events-navigate', apply);
    return () => window.removeEventListener('events-navigate', apply);
  }, []);

  const updateReportFilter = useCallback((key: keyof ReportFiltersState, value: string) => {
    setReportFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const bounds = getEventsDateRangeBounds(
      reportsDateFilterMode,
      reportsDateFilterSingle,
      reportsDateFilterFrom,
      reportsDateFilterTo
    );
    if (!bounds) {
      updateReportFilter('fromDate', '');
      updateReportFilter('toDate', '');
      return;
    }
    updateReportFilter('fromDate', bounds.from);
    updateReportFilter('toDate', bounds.to);
  }, [
    reportsDateFilterMode,
    reportsDateFilterSingle,
    reportsDateFilterFrom,
    reportsDateFilterTo,
    updateReportFilter,
  ]);

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
  const filteredReportsCount = useMemo(
    () => filteredReportCatalog.reduce((sum, category) => sum + category.reports.length, 0),
    [filteredReportCatalog]
  );
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
  const handleReportSelection = useCallback((reportKey: string) => {
    setSelectedReportKey(reportKey);
    trackEvent('Analytics.FiltersUpdated', {
      scope: 'events',
      reportKey,
    });
  }, []);
  
  const [eventStatus, setEventStatus] = useState<SimpleEventStatus>('quote');
  const [eventCoordinator, setEventCoordinator] = useState<string>(UNASSIGNED_STAFF);
  const [nextAction, setNextAction] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>('');
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
    { key: 'quote', label: 'Quote' },
    { key: 'confirmed', label: 'Confirmed' },
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


  

  

  
  

  

  const normalizeFolioEntries = (folio: EventFolio): EventFolio => {
    const seenRefs = new Set<string>();
    const uniqueEntries: EventFolioEntry[] = [];
    (folio.entries || []).forEach((entry) => {
      const ref = String(entry.reference || '').trim();
      if (ref) {
        if (seenRefs.has(ref)) return;
        seenRefs.add(ref);
      }
      uniqueEntries.push(entry);
    });
    let running = folio.openingBalance || 0;
    const entries = uniqueEntries.map((entry) => {
      running = running + (entry.debit || 0) - (entry.credit || 0);
      return { ...entry, balance: running };
    });
    return { ...folio, entries };
  };

  



  

  

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

  

  const [eventInvoices, setEventInvoices] = useState<EventInvoice[]>([]);

  const [eventReceipts, setEventReceipts] = useState<EventReceipt[]>([]);

  const [eventFolios, setEventFolios] = useState<EventFolio[]>([]);

  const [billingDocsReady, setBillingDocsReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(eventsDocsStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.invoices)) {
          setEventInvoices(parsed.invoices.filter((doc: EventInvoice) => !isHardcodedBillingDoc(doc)));
        }
        if (Array.isArray(parsed.receipts)) {
          setEventReceipts(
            parsed.receipts
              .filter((doc: EventReceipt) => !isHardcodedBillingDoc(doc))
              .map((doc: EventReceipt) => ({ ...doc, method: resolveReceiptMethod(doc.method) }))
          );
        }
        if (Array.isArray(parsed.folios)) {
          setEventFolios(
            parsed.folios
              .filter((doc: EventFolio) => !isHardcodedBillingDoc(doc))
              .map((doc: EventFolio) => withFolioStatus(normalizeFolioEntries(doc)))
          );
        }
      }
    } catch {
      // Keep starter invoices/receipts if stored docs cannot be read.
    }
    setBillingDocsReady(true);
  }, []);

  useEffect(() => {
    if (!billingDocsReady) return;
    setEventFolios((prev) => prev.map((folio) => withFolioStatus(normalizeFolioEntries(folio))));
    setEventReceipts((prev) => {
      let changed = false;
      const next = prev.map((receipt) => {
        const method = resolveReceiptMethod(receipt.method);
        if (method === receipt.method) return receipt;
        changed = true;
        return { ...receipt, method };
      });
      return changed ? next : prev;
    });
  }, [billingDocsReady]);

  useEffect(() => {
    if (!billingDocsReady) return;
    try {
      localStorage.setItem(
        eventsDocsStorageKey(),
        JSON.stringify({ invoices: eventInvoices, receipts: eventReceipts, folios: eventFolios })
      );
    } catch {
      // Ignore quota / private-mode write failures.
    }
  }, [billingDocsReady, eventInvoices, eventReceipts, eventFolios]);

  useEffect(() => {
    if (!billingDocsReady) return;
    const live = accountingInvoices.filter(
      (invoice) =>
        invoice.sourceModule === 'conference' &&
        !invoice.isProforma &&
        invoice.status !== 'Void' &&
        invoice.reference &&
        !isHardcodedDemoEventId(String(invoice.reference))
    );
    if (!live.length) return;
    setEventInvoices((prev) => {
      const byEvent = new Map(prev.map((inv) => [inv.eventId, inv]));
      let changed = false;
      live.forEach((invoice) => {
        const eventId = String(invoice.reference);
        if (byEvent.has(eventId)) return;
        const eventsInvoiceId = String(invoice.id || '').replace(/^INV-CONFERENCE-/, '') || genId('INV');
        const total = Number(invoice.total || 0);
        const paid = Number(invoice.paidAmount || 0);
        const balance = Math.max(0, total - paid);
        byEvent.set(eventId, {
          id: eventsInvoiceId,
          eventId,
          eventName: invoice.description?.replace(/^Conference Invoice:\s*/, '').split(' (')[0] || 'Event',
          clientName: 'Client',
          issueDate: (invoice.date || new Date().toISOString()).slice(0, 10),
          dueDate: (invoice.dueDate || invoice.date || new Date().toISOString()).slice(0, 10),
          subtotal: Number(invoice.subtotal ?? total),
          tax: Number(invoice.taxAmount ?? 0),
          total,
          balance,
          status: deriveInvoiceStatus(paid > 0 && balance <= 0.01 ? 'Paid' : 'Issued', balance, total),
          reference: invoice.invoiceNumber,
        });
        changed = true;
      });
      return changed ? Array.from(byEvent.values()) : prev;
    });
  }, [billingDocsReady, accountingInvoices]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchEventBookings().catch(() => []);
      if (cancelled) return;
      if (Array.isArray(rows) && rows.length) {
        setCustomEvents((prev) => {
          const map = new Map(prev.map((ev) => [ev.id, ev]));
          rows.forEach((row) => {
            const ui = mapApiBookingToEvent(row);
            if (!ui.id || isHardcodedDemoEventId(ui.id)) return;
            const existing = map.get(ui.id);
            map.set(ui.id, existing ? { ...ui, ...existing } : ui);
          });
          return Array.from(map.values());
        });
      }
      if (cancelled) return;
      setEventsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceModalMode, setInvoiceModalMode] = useState<'create' | 'edit'>('create');
  const [invoiceForm, setInvoiceForm] = useState<Partial<EventInvoice>>({});
  const [invoiceErrors, setInvoiceErrors] = useState<Record<string, string>>({});

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptModalMode, setReceiptModalMode] = useState<'create' | 'edit'>('create');
  const [receiptForm, setReceiptForm] = useState<Partial<EventReceipt>>({});
  const [receiptErrors, setReceiptErrors] = useState<Record<string, string>>({});
  const [receiptPrintAfterSave, setReceiptPrintAfterSave] = useState(true);
  const [receiptInvoiceLocked, setReceiptInvoiceLocked] = useState(false);
  const [receiptInvoiceQuery, setReceiptInvoiceQuery] = useState('');

  const [isFolioModalOpen, setIsFolioModalOpen] = useState(false);
  const [activeFolio, setActiveFolio] = useState<any>(null);
  const [docCautionPrompt, setDocCautionPrompt] = useState<null | {
    kind: 'void-folio' | 'unvoid-folio' | 'delete-folio' | 'void-receipt' | 'unvoid-receipt' | 'delete-receipt';
    title: string;
    message: string;
    confirmLabel: string;
  }>(null);
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
  const [isInvoiceEventPickerOpen, setIsInvoiceEventPickerOpen] = useState(false);
  const [invoiceCreateEventId, setInvoiceCreateEventId] = useState('');
  const [folioCreateForm, setFolioCreateForm] = useState<{ eventId: string; openingBalance: number; note?: string }>({
    eventId: '',
    openingBalance: 0,
    note: ''
  });
  const [folioCreateError, setFolioCreateError] = useState<string>('');
  const [folioEntrySearch, setFolioEntrySearch] = useState('');
  const [folioSortKey, setFolioSortKey] = useState<FolioAccountCol>('date');
  const [folioSortDir, setFolioSortDir] = useState<'asc' | 'desc'>('desc');
  const [folioPage, setFolioPage] = useState(1);
  const folioAccountCols = useFolioAccountColumns();
  const [folioComposerOpen, setFolioComposerOpen] = useState(false);
  const invoiceStatusMeta: Record<EventInvoiceStatus, { color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'; label: string }> = {
    Draft: { color: 'default', label: 'Draft' },
    Issued: { color: 'primary', label: 'Issued' },
    Partial: { color: 'warning', label: 'Partially Paid' },
    Paid: { color: 'success', label: 'Paid' },
    Overdue: { color: 'danger', label: 'Overdue' }
  };
  const receiptMethods: ReceiptMethod[] = ['Bank Transfer', 'Cash', 'Card', 'Mobile Money', 'Cheque'];
  const receiptMethodLabels: Record<ReceiptMethod, string> = {
    'Bank Transfer': 'Bank transfer',
    Cash: 'Cash',
    Card: 'Card',
    'Mobile Money': 'Mobile money',
    Cheque: 'Cheque',
  };
  const receiptMethodColors: Record<ReceiptMethod, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
    Cash: 'secondary',
    Card: 'primary',
    'Bank Transfer': 'success',
    'Mobile Money': 'warning',
    Cheque: 'default',
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
  const DeptMessenger = require('./DeptMessenger').default;
  const complianceCountry = useComplianceStore(state => state.country);
  const complianceTaxRules = useComplianceStore(state => state.taxRules);
  const setComplianceCountry = useComplianceStore(state => state.setCountry);
  const complianceCalculateTax = useCalculateTax();
  
  // Tax schedules are only needed inside the event form. Loading them on open
  // was three extra requests plus an accounting sync before the list appeared.
  const [taxRulesLoaded, setTaxRulesLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!isEventModalOpen || taxRulesLoaded) return;
    const loadTaxRules = async () => {
      try {
        const country = complianceCountry || 'GH';
        await setComplianceCountry(country);
        setTaxRulesLoaded(true);
      } catch (error) {
        console.error('[Events] Failed to load tax rules:', error);
      }
    };
    loadTaxRules();
  }, [isEventModalOpen, taxRulesLoaded, complianceCountry, setComplianceCountry]);
  
  // Function to manually refresh tax rules
  const refreshTaxRules = React.useCallback(async () => {
    try {
      const country = complianceCountry || 'GH';
      await setComplianceCountry(country);
      console.log('[Events] Tax rules refreshed for:', country);
    } catch (error) {
      console.error('[Events] Failed to refresh tax rules:', error);
    }
  }, [complianceCountry, setComplianceCountry]);
  // Quote builder state
  const [quoteTaxExempt, setQuoteTaxExempt] = useState<boolean>(false);
  
  
  const [quoteDays, setQuoteDays] = useState<QuoteDay[]>([]);
  const [activePrintTab, setActivePrintTab] = useState<'quote' | 'invoice' | 'receipt' | 'xls'>('quote');
  const [selectedProformaTemplate, setSelectedProformaTemplate] = useState<string>('');
  const [selectedInvoiceTemplate, setSelectedInvoiceTemplate] = useState<string>('');
  const [selectedReceiptTemplate, setSelectedReceiptTemplate] = useState<string>('');
  const activeAccommodationProforma = useSettingsStore(s => s.printing['accommodation-proforma']);
  const activeAccommodationInvoice = useSettingsStore(s => s.printing['accommodation-invoice']);
  const activeAccommodationReceipt = useSettingsStore(s => s.printing['accommodation-receipt']);
  const activeEventProforma = useSettingsStore(s => s.printing['event-proforma']);
  const activeEventInvoice = useSettingsStore(s => s.printing['event-invoice']);
  const activeEventReceipt = useSettingsStore(s => s.printing['event-receipt']);
  useEffect(() => {
    setSelectedProformaTemplate('');
    setSelectedInvoiceTemplate('');
    setSelectedReceiptTemplate('');
  }, [activeAccommodationProforma, activeAccommodationInvoice, activeAccommodationReceipt, activeEventProforma, activeEventInvoice, activeEventReceipt]);
  const showQuotePrintInModal = useMemo(() => {
    if (!editingEvent) return false;
    const status = normalizeStatus(editingEvent.status || (editingEvent as any).eventStatus);
    return status === 'quote' || status === 'confirmed' || status === 'cancelled';
  }, [editingEvent]);

  const linkedEventInvoice = useMemo(
    () => (editingEvent ? eventInvoices.find((inv) => inv.eventId === editingEvent.id) : undefined),
    [editingEvent, eventInvoices]
  );

  const linkedEventReceipts = useMemo(
    () => (editingEvent ? eventReceipts.filter((rcpt) => rcpt.eventId === editingEvent.id) : []),
    [editingEvent, eventReceipts]
  );

  const editingEventDocSection: 'accommodation' | 'events' = useMemo(
    () => (scheduleHasEventComponent(editingEvent?.dailySchedule || [], editingEvent?.customParticulars || []) ? 'events' : 'accommodation'),
    [editingEvent]
  );

  useEffect(() => {
    // Proforma, Invoice and Receipt all share showQuotePrintInModal's gate now
    // (any event with computed totals, not just ones formally invoiced) — so
    // once it's false, XLS is the only tab left standing.
    if (!showQuotePrintInModal && activePrintTab !== 'xls') {
      setActivePrintTab('xls');
    }
  }, [showQuotePrintInModal, activePrintTab]);

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
  const getFolioSettledStatus = (folio: EventFolio): 'Open' | 'Closed' => {
    const charges = (folio.entries || []).reduce((sum, entry) => sum + Number(entry.debit || 0), 0);
    return charges > 0 && Math.abs(getFolioCurrentBalance(folio)) < 0.01 ? 'Closed' : 'Open';
  };
  const withFolioStatus = (folio: EventFolio): EventFolio => ({
    ...folio,
    status: folio.status === 'Void' ? 'Void' : getFolioSettledStatus(folio),
  });
  const conferenceInvoiceBelongsToEvent = (invoice: { reference?: string; description?: string }, eventId?: string) => {
    if (!eventId) return true;
    return invoice.reference === eventId || String(invoice.description || '').includes(eventId);
  };
  const eventIdSequence = useMemo(
    () =>
      buildIdSequence(
        sortIdsByDate(
          customEvents,
          (event) => String(event.id || ''),
          (event) => String(event.arrivalDate || event.startDate || event.createdAt || '')
        )
      ),
    [customEvents]
  );
  const invoiceIdSequence = useMemo(
    () =>
      buildIdSequence(
        sortIdsByDate(
          eventInvoices,
          (invoice) => String(invoice.id || ''),
          (invoice) => String(invoice.issueDate || '')
        )
      ),
    [eventInvoices]
  );
  const receiptIdSequence = useMemo(
    () =>
      buildIdSequence(
        sortIdsByDate(
          eventReceipts,
          (receipt) => String(receipt.id || ''),
          (receipt) => String(receipt.date || '')
        )
      ),
    [eventReceipts]
  );
  const folioIdSequence = useMemo(
    () =>
      buildIdSequence(
        sortIdsByDate(
          eventFolios,
          (folio) => String(folio.id || ''),
          (folio) => String(folio.createdAt || '')
        )
      ),
    [eventFolios]
  );
  const quoteIdSequence = useMemo(
    () =>
      buildIdSequence(
        sortIdsByDate(
          customEvents.filter((event) => event.quoteNumber || event.status === 'quote'),
          (event) => String(event.id || ''),
          (event) => String(event.createdAt || event.arrivalDate || event.startDate || '')
        )
      ),
    [customEvents]
  );
  const formatFolioNumber = (id?: string) => sequenceLabel('FOL', id, folioIdSequence);
  const formatQuoteNumber = (eventId?: string, fallback = '') => {
    const labeled = sequenceLabel('Q', eventId, quoteIdSequence);
    return labeled === '—' ? fallback || '—' : labeled;
  };
  const getConferenceInvoiceNumber = (eventsInvoiceId?: string, eventId?: string) => {
    if (eventsInvoiceId && invoiceIdSequence.has(eventsInvoiceId)) {
      return sequenceLabel('INV', eventsInvoiceId, invoiceIdSequence);
    }
    if (eventId) {
      const linked = eventInvoices.find((invoice) => invoice.eventId === eventId);
      if (linked) return sequenceLabel('INV', linked.id, invoiceIdSequence);
    }
    return '';
  };
  const getConferenceReceiptNumber = (eventsReceiptId?: string, eventId?: string) => {
    if (eventsReceiptId && receiptIdSequence.has(eventsReceiptId)) {
      return sequenceLabel('RCP', eventsReceiptId, receiptIdSequence);
    }
    if (eventId) {
      const linked = eventReceipts.find((receipt) => receipt.eventId === eventId);
      if (linked) return sequenceLabel('RCP', linked.id, receiptIdSequence);
    }
    return '';
  };
  const formatFolioEntryCopy = (entry: EventFolioEntry) => {
    const linkedInvoice = entry.reference
      ? eventInvoices.find((invoice) => invoice.id === entry.reference)
      : undefined;
    const linkedReceipt = entry.reference
      ? eventReceipts.find((receipt) => receipt.id === entry.reference)
      : undefined;

    if (linkedInvoice) {
      return {
        description: 'Invoice',
        reference: getConferenceInvoiceNumber(linkedInvoice.id, linkedInvoice.eventId) || 'Invoice',
      };
    }
    if (linkedReceipt) {
      const method = paymentMethodLabel(resolveReceiptMethod(linkedReceipt.method));
      return {
        description: method ? `Payment · ${method}` : 'Payment',
        reference: getConferenceReceiptNumber(linkedReceipt.id, linkedReceipt.eventId) || 'Receipt',
      };
    }

    let description = String(entry.description || '')
      .replace(/Invoice\s+INV-[a-z0-9]+/gi, 'Invoice')
      .replace(/Receipt\s+RCPT-[a-z0-9]+/gi, 'Receipt')
      .replace(/\(\s*Invoice\s+INV-[a-z0-9]+\s*\)/gi, '')
      .replace(/\s*-\s*Updated Details/gi, '')
      .replace(/\s*-\s*Event Charges/gi, '')
      .replace(/Payment\s*-\s*/i, 'Payment ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!description) {
      description = entry.debit > 0 ? 'Charge' : entry.credit > 0 ? 'Payment' : 'Note';
    }

    let reference = String(entry.reference || '').trim();
    if (invoiceIdSequence.has(reference)) {
      reference = sequenceLabel('INV', reference, invoiceIdSequence);
    } else if (receiptIdSequence.has(reference)) {
      reference = sequenceLabel('RCP', reference, receiptIdSequence);
    } else if (/^(INV|RCPT|RCP|FOL|FLE)-[a-z0-9]{8,}$/i.test(reference)) {
      reference = '—';
    }

    return { description, reference: reference || '—' };
  };
  const syncEventQuoteToAccounting = (event: any, totals?: { subtotal: number; tax: number; total: number }) => {
    if (!event?.id) return;
    const total = Number(totals?.total ?? event.budgetTotal ?? event.revenue ?? event.totalCost ?? 0);
    if (!(total > 0)) return;
    const subtotal = Number(totals?.subtotal ?? event.subtotal ?? total);
    void initializeAccounting()
      .catch(() => {})
      .then(() => {
        const proformaId = `INV-CONFERENCE-PRO-${event.id}`;
        if (useAccountingStore.getState().invoices.some((invoice) => invoice.id === proformaId)) return;
        captureConferenceProforma({
          eventId: String(event.id),
          customerId: event.clientId || event.orgClientId,
          customerName: getEventClientName(event) || 'Conference Client',
          description: `Conference proforma: ${getEventDisplayName(event)}`,
          subtotal,
          taxAmount: Number(totals?.tax ?? 0),
          total,
          quoteNumber: event.quoteNumber,
        });
      });
  };

  useEffect(() => {
    if (managementMainTab === 'events') return;
    let cancelled = false;
    (async () => {
      await initializeAccounting().catch(() => {});
      if (cancelled) return;
      const liveIds = customEvents.map((event) => String(event.id || '')).filter(Boolean);
      if (liveIds.length) await retireOrphanConferenceInvoices(liveIds).catch(() => {});
      if (cancelled) return;
      customEvents.forEach((event) => {
        if ((event.status === 'quote' || event.quoteNumber) && Number(event.budgetTotal || event.revenue || 0) > 0) {
          syncEventQuoteToAccounting(event);
        }
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [managementMainTab, customEvents, initializeAccounting]);
  
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
    let charges = 0;
    let payments = 0;
    for (const entry of folio.entries) {
      const reversal = /^\s*(REVERSAL|VOID)\b/i.test(entry.description || '');
      const debit = Number(entry.debit || 0);
      const credit = Number(entry.credit || 0);
      if (reversal) {
        charges -= credit;
        payments -= debit;
      } else {
        charges += debit;
        payments += credit;
      }
    }
    return {
      debits: Math.round(charges * 100) / 100,
      credits: Math.round(payments * 100) / 100,
    };
  };
  const deriveInvoiceStatus = (current: EventInvoiceStatus | undefined, balance: number, total: number): EventInvoiceStatus => {
    if (balance <= 0) return 'Paid';
    if (balance < total) return 'Partial';
    if (current && current !== 'Paid') return current;
    return 'Issued';
  };
  const getEventDisplayName = (event: any) => event?.eventName || event?.name || event?.title || 'Unnamed Event';
  const getEventClientName = (event: any) => event?.organization || event?.clientName || event?.contactPerson || '';
  const persistEventBookingPatch = (event: any, extraDetails: Record<string, any> = {}) => {
    if (!event?.id) return;
    const start = event.arrivalDate || event.startDate;
    const end = event.departureDate || event.endDate || start;
    void saveEventBooking({
      id: String(event.id),
      title: getEventDisplayName(event),
      organizer: getEventClientName(event) || '—',
      contactPerson: event.contactPerson || getEventClientName(event),
      contactPhone: event.contactPhone,
      contactEmail: event.contactEmail,
      hallId: event.venueKey || event.venue || '',
      hallName: isUnassignedVenueLabel(event.venueName) ? '' : (event.venueName || ''),
      startDate: start,
      endDate: end,
      attendees: event.pax || event.expectedPax || 0,
      status: event.status || 'confirmed',
      type: event.residential ? 'residential-conference' : (event.eventType || 'conference'),
      catering: Boolean((event.dailySchedule || []).some((day: any) => Number(day.lunchPax || 0) + Number(day.dinnerPax || 0) > 0)),
      totalCost: Number(event.revenue || event.budgetTotal || 0),
      details: {
        ...(event.details || {}),
        quoteBudgetSnapshot: event.quoteBudgetSnapshot,
        particularLabels: event.particularLabels,
        ratesByParticulars: event.ratesByParticulars,
        combinedPackage: event.combinedPackage ?? !event.ratesByParticulars,
        residential: Boolean(event.residential),
        dailySchedule: event.dailySchedule,
        conferenceRate: event.conferenceRate,
        lunchRate: event.lunchRate,
        dinnerRate: event.dinnerRate,
        roomRate: event.roomRate,
        defaultDayRate: event.defaultDayRate,
        completionStatus: event.completionStatus,
        checkedIn: event.checkedIn,
        eventCoordinator: event.eventCoordinator || '',
        nextAction: event.nextAction || '',
        followUpDate: event.followUpDate || '',
        quoteNumber: event.quoteNumber || '',
        venueKey: event.venueKey || event.venue || '',
        venueName: isUnassignedVenueLabel(event.venueName) ? '' : (event.venueName || ''),
        ...extraDetails,
      },
    }).catch(() => {});
  };
  const coordinatorAssignedRef = useRef(false);
  useEffect(() => {
    if (coordinatorAssignedRef.current) return;
    if (!staffCoordinatorNames.length && !preferredEventCoordinator) return;
    const needsRepair = customEvents.some((event) => {
      const current = String(event.eventCoordinator || '').trim();
      const resolved = resolveFromOptions(
        current,
        staffCoordinatorNames,
        preferredEventCoordinator || UNASSIGNED_STAFF
      );
      return Boolean(resolved) && resolved !== UNASSIGNED_STAFF && resolved !== current;
    });
    if (!needsRepair) {
      if (customEvents.length) coordinatorAssignedRef.current = true;
      return;
    }
    coordinatorAssignedRef.current = true;
    setCustomEvents((prev) =>
      prev.map((event) => {
        const current = String(event.eventCoordinator || '').trim();
        const resolved = resolveFromOptions(
          current,
          staffCoordinatorNames,
          preferredEventCoordinator || UNASSIGNED_STAFF
        );
        if (!resolved || resolved === UNASSIGNED_STAFF || resolved === current) return event;
        const updated = { ...event, eventCoordinator: resolved };
        persistEventBookingPatch(updated, { eventCoordinator: resolved });
        return updated;
      })
    );
  }, [customEvents, preferredEventCoordinator, staffCoordinatorNames]);
  const formatDateDisplay = (value?: string) =>
    value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const formatEventId = (id?: string) => sequenceLabel('EVT', id, eventIdSequence);

  const computeLine = (line: QuoteServiceLine) => {
    const subtotal = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
    const exempt = quoteTaxExempt || line.taxGroup === 'none';
    const taxAmount = exempt ? 0 : computeQuoteTax(subtotal, false).totalTax;
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

  // Organization autocomplete state for Event Modal (Phase 1)
  const [orgSearch, setOrgSearch] = useState('');
  const [orgClientId, setOrgClientId] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [orgContactPhone, setOrgContactPhone] = useState<string>('');
  const [orgClientEmail, setOrgClientEmail] = useState<string>('');
  const [clientContactName, setClientContactName] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');
  // Defaults on for a new event — most bookings here are residential, so this
  // way the accommodation fields are already visible for the common case and
  // the rarer day-only event is the one that costs a click (to uncheck it),
  // not the other way around.
  const [isResidential, setIsResidential] = useState<boolean>(true);
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
  
  // Store schedule data as a Map keyed by date for persistence across date changes
  const [scheduleDataMap, setScheduleDataMap] = useState<Map<string, {
    conferencePax: number;
    lunchPax: number;
    dinnerPax: number;
    rooms: number;
    rate: number;
    extras: Record<string, number>;
    extraLines: { id: string; name: string; qty: number; unitPrice: number; taxGroup: string }[];
  }>>(new Map());

  // Compute the current date range from startDate/endDate
  const computedDateRange = useMemo(() => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const dates: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().slice(0, 10));
    }
    return dates;
  }, [startDate, endDate]);

  // Sync dailySchedule array from computedDateRange + scheduleDataMap
  useEffect(() => {
    if (computedDateRange.length === 0) {
      setDailySchedule([]);
      return;
    }
    const newSchedule = computedDateRange.map(date => {
      const existing = scheduleDataMap.get(date);
      if (existing) {
        return { date, ...existing };
      }
      // Default values for new dates
      const rooms = isResidential ? (expectedPax || 0) : 0;
      return {
        date,
        conferencePax: expectedPax || 0,
        lunchPax: expectedPax || 0,
        dinnerPax: expectedPax || 0,
        rooms,
        rate: defaultDayRate || 0,
        extras: {} as Record<string, number>,
        extraLines: [] as { id: string; name: string; qty: number; unitPrice: number; taxGroup: string }[]
      };
    });
    setDailySchedule(newSchedule);
  }, [computedDateRange, scheduleDataMap, expectedPax, isResidential, defaultDayRate]);

  // Persist changes to scheduleDataMap when dailySchedule changes (from user edits)
  const updateScheduleData = useCallback((date: string, updates: Partial<typeof scheduleDataMap extends Map<string, infer V> ? V : never>) => {
    setScheduleDataMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(date) || {
        conferencePax: expectedPax || 0,
        lunchPax: expectedPax || 0,
        dinnerPax: expectedPax || 0,
        rooms: isResidential ? (expectedPax || 0) : 0,
        rate: defaultDayRate || 0,
        extras: {},
        extraLines: []
      };
      newMap.set(date, { ...existing, ...updates });
      return newMap;
    });
  }, [expectedPax, isResidential, defaultDayRate]);

  
  useEffect(() => {
    if (!venueKey) return;
    const resolved = findVenueInCatalog(modernVenues, venueKey);
    if (resolved && resolved.id !== venueKey) {
      setVenueKey(resolved.id);
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
  const [conferenceRates, setConferenceRates] = useState<any[]>(
    () => loadStoredConferenceRates() ?? DEFAULT_CONFERENCE_RATES
  );
  const [guestRatesFilteredCount, setGuestRatesFilteredCount] = useState(
    () => (loadStoredConferenceRates() ?? DEFAULT_CONFERENCE_RATES).length
  );

  useEffect(() => {
    try {
      localStorage.setItem(guestRatesStorageKey(), JSON.stringify(conferenceRates));
    } catch {
      /* ignore storage errors */
    }
  }, [conferenceRates]);

  // Auto-populate rates when organization is selected
  useEffect(() => {
    if (!orgName || isViewMode) return;

    const orgNameLower = orgName.toLowerCase().trim();
    if (!orgNameLower) return;

    const { bestRatesByType } = resolveGuestRatesForEvent(
      conferenceRates,
      orgName,
      startDate,
      endDate || startDate
    );

    const shouldUpdateRate = (type: string) => {
      const best = bestRatesByType[type];
      if (!best) return false;
      if (best.clientSpecific) return true;
      if (type === 'accommodation') return roomRate === 0;
      if (type === 'conference') return conferenceRate === 250;
      if (type === 'lunch') return lunchRate === 0;
      if (type === 'dinner') return dinnerRate === 0;
      return false;
    };

    const labelUpdates: Partial<{ conferencePax: string; lunchPax: string; dinnerPax: string; rooms: string }> = {};

    Object.values(bestRatesByType).forEach((rate) => {
      const customLabel = rate.customLabel || '';
      if (rate.type === 'accommodation' && rate.unit === 'per_room') {
        if (shouldUpdateRate('accommodation')) {
        setRoomRate(rate.baseRate);
        }
        if (customLabel) labelUpdates.rooms = customLabel;
      } else if (rate.type === 'conference' && rate.unit === 'per_person') {
        if (shouldUpdateRate('conference')) {
        setConferenceRate(rate.baseRate);
        }
        if (customLabel) labelUpdates.conferencePax = customLabel;
      } else if (rate.type === 'lunch' && rate.unit === 'per_person') {
        if (shouldUpdateRate('lunch')) {
        setLunchRate(rate.baseRate);
        }
        if (customLabel) labelUpdates.lunchPax = customLabel;
      } else if (rate.type === 'dinner' && rate.unit === 'per_person') {
        if (shouldUpdateRate('dinner')) {
        setDinnerRate(rate.baseRate);
        }
        if (customLabel) labelUpdates.dinnerPax = customLabel;
      }
    });

    // Update particularLabels with custom labels from rates
    if (Object.keys(labelUpdates).length > 0) {
      setParticularLabels(prev => ({ ...prev, ...labelUpdates }));
    }
  }, [orgName, conferenceRates, startDate, endDate, isViewMode, roomRate, conferenceRate, lunchRate, dinnerRate]);
  // Phase 4 - Packages & Add-Ons
  
  
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

  // Availability and clash checks (schedule generation now handled by computedDateRange)
  useEffect(() => {
    if (!venueKey || !startDate || !endDate || !expectedPax) {
      setAvailabilityNote('Select a venue and headcount to check availability.');
      setCapacityOk(false);
      setClashCount(0);
      setHasWarnings(false);
      setConflictingEvents([]);
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
  }, [startDate, endDate, venueKey, expectedPax, isResidential]);

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

  const calculateTaxBreakdownFor = (subtotal: number, category: string, context: Record<string, any>) => {
    let taxImpact = 0;
    const taxBreakdown: Array<{ name: string; rate: number | null; method?: string; fixedAmount?: number | null; amount: number; effect?: string }> = [];

    if (typeof complianceCalculateTax === 'function') {
      const taxResult = complianceCalculateTax(subtotal, category, context);

      (taxResult?.taxes || []).forEach((tax: any) => {
        const rule = complianceRuleMap.get(tax.name);
        const method = rule?.method || 'rate';
        const effect = rule?.effect || 'add';
        const rateValue = method === 'rate' ? (rule?.rate ?? null) : null;
        const fixedAmount = method === 'fixed' ? (rule?.fixedAmount ?? null) : null;
        const baseAmount = subtotal > 0 ? Number(tax?.amount || 0) : 0;
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

    return { taxImpact, taxBreakdown };
  };

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

    // Bulk accommodation-only bookings are taxed under the room category (e.g. Tourism
    // Levy scoping); anything with a conference/catering component is taxed as an event.
    const taxCategory = ratesByParticulars && !scheduleHasEventComponent(dailySchedule, customParticulars) ? 'ROOM' : 'EVENT';
    const { taxImpact, taxBreakdown } = calculateTaxBreakdownFor(subtotal, taxCategory, {
      domain: 'sales',
      operation: 'external',
      numPersons: totalPax || expectedPax || 0,
      numNights: numDays || 0,
      isResidential
    });

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
    if (!eventTotals.taxBreakdown.length) return [];
    return eventTotals.taxBreakdown.map((tax) => ({
      name: tax.name,
      method: tax.method || 'rate',
      rate: tax.method === 'fixed' ? null : (tax.rate ?? null),
      fixedAmount: tax.method === 'fixed' ? (tax.fixedAmount ?? null) : null,
      effect: tax.effect || 'add',
      amount: eventTaxExempt ? 0 : tax.amount
    }));
  }, [eventTotals.taxBreakdown, eventTaxExempt]);

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

  // Corporate clients are picked once at booking time (orgClientId, stored on the
  // event as corporateClientId/clientId) — look the profile back up at print time
  // so the letter-style templates' recipient address line has something to show.
  const resolveClientAddress = (clientId?: string): string | undefined => {
    if (!clientId) return undefined;
    const g = frontOfficeGuests.find(p => p.id === clientId);
    if (!g) return undefined;
    return [g.address, g.city, g.country].filter(Boolean).join('\n') || undefined;
  };

  const buildEventPrintData = (docType: 'proforma' | 'invoice') => {
    const settingsState = useSettingsStore.getState() as any;
    const schedule =
      dailySchedule.length > 0 ? dailySchedule : ((editingEvent as any)?.dailySchedule || []);
    const items = buildPrintLineItemsFromSchedule(
      schedule,
      {
        residential: isResidential,
        roomRate,
        conferenceRate,
        lunchRate,
        dinnerRate,
      },
      { arrivalDate: startDate, startDate, departureDate: endDate, endDate }
    );

    const matrixTable = ratesByParticulars
      ? buildMatrixTableFromSchedule(
          schedule,
          particularLabels,
          { roomRate, dinnerRate, lunchRate, conferenceRate },
          hiddenParticulars,
          customParticulars
        )
      : undefined;

    // Same particulars data as matrixTable, reshaped for the "Daily Schedule
    // (dates as rows)" template — harmless to compute alongside matrixTable
    // since a template only reads whichever of the two block types it uses.
    const scheduleTable = ratesByParticulars
      ? buildScheduleTableFromSchedule(
          schedule,
          particularLabels,
          { roomRate, dinnerRate, lunchRate, conferenceRate },
          hiddenParticulars,
          customParticulars
        )
      : undefined;

    // Accommodation only if there's genuinely no conference/catering component —
    // otherwise (including a mixed group with rooms) it's a single Event document.
    const section: 'accommodation' | 'events' = scheduleHasEventComponent(schedule, customParticulars) ? 'events' : 'accommodation';

    if (!items.length) {
      const fallbackAmount = Number(eventTotals.subtotal || 0);
      items.push({
        description: section === 'accommodation' ? (particularLabels.rooms || 'Accommodation') : (eventName || 'Event Services'),
        qty: schedule.length || undefined,
        unit: schedule.length > 1 ? 'days' : undefined,
        unitPrice: fallbackAmount,
        amount: fallbackAmount,
        date: startDate || new Date().toISOString().split('T')[0],
      });
    }

    const orgProfile = buildOrgProfile(settingsState);

    const totalDays = schedule.length || 1;
    const documentNumber =
      docType === 'invoice'
        ? editingEvent?.invoiceNumber || settingsState.getNextInvoiceNumber()
        : editingEvent?.quoteNumber || settingsState.getNextModuleNumber('events', 'quotation');
    const title = docType === 'invoice' ? 'Invoice' : 'Quotation';
    const taxSpread = mapTaxBreakdownToPrint(eventTotals.taxBreakdown);
    const printTotals: any = {
      subTotal: Number(eventTotals.subtotal || 0),
      taxes: taxSpread,
      grandTotal: Number(eventTotals.total || 0),
      payments: prepaymentEnabled ? cappedPrepaymentAmount : 0,
      balance: balanceDue,
    };
    if (eventTotals.discountAmount) {
      printTotals.discount = Number(eventTotals.discountAmount || 0);
    }
    if (prepaymentEnabled && cappedPrepaymentAmount > 0) {
      printTotals.advance = cappedPrepaymentAmount;
    }
    return {
      type: EVENT_DOC_TYPE[section][docType],
      data: {
        org: orgProfile,
        guest: {
          name: orgName || 'Client',
          company: orgName || '',
          address: resolveClientAddress(orgClientId),
          roomNumber: undefined,
          roomType: undefined,
          arrivalDate: startDate || '',
          departureDate: endDate || '',
          nights: totalDays,
        },
        docNumber: documentNumber,
        docDate: new Date().toISOString(),
        title,
        items,
        matrixTable,
        scheduleTable,
        totals: printTotals,
        footerNotes: [
          'Generated via Events & Conferences workflow.',
          docType === 'invoice'
            ? 'Invoice layout provided by Settings • Template Builder.'
            : 'Quotation layout provided by Settings • Template Builder.',
        ],
        currency: '₵',
      },
    };
  };

  useEffect(() => {
    if (isEventModalOpen) {
      const eventToLoad = customEvents.find(ev => ev.id === editingEvent?.id) || editingEvent || null;
      const resolvedStart = eventToLoad?.arrivalDate || eventToLoad?.startDate || '';
      const resolvedEnd = eventToLoad?.departureDate || eventToLoad?.endDate || '';

      setEventName(eventToLoad?.eventName || eventToLoad?.name || '');
      setEventCoordinator(resolveEventCoordinator(eventToLoad));
      setNextAction(eventToLoad?.nextAction || '');
      setFollowUpDate(eventToLoad?.followUpDate || '');
      setOrgName(eventToLoad?.organization || '');
      setOrgContactPhone(eventToLoad?.contactPhone || eventToLoad?.contact || '');
      setOrgClientEmail(eventToLoad?.contactEmail || eventToLoad?.clientEmail || '');
      setClientContactName((eventToLoad?.contactPerson || '').trim());
      setIsResidential(Boolean(eventToLoad?.residential ?? eventToLoad?.isResidential));
      setOrgClientId(eventToLoad?.clientId || '');
      setOrgSearch(eventToLoad?.organization || '');
      setEventStatus(normalizeStatus(eventToLoad?.status));
      setStartDate(resolvedStart);
      setEndDate(resolvedEnd);
      setVenueKey(eventToLoad?.venueKey || eventToLoad?.venue || '');
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
      setClientContactName('');
      setIsResidential(true);
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
      setEventCoordinator(UNASSIGNED_STAFF);
      setNextAction('');
      setFollowUpDate('');
    }
  }, [isEventModalOpen, editingEvent?.id]);

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

  const validateEventForm = () => {
    const emailOk = !orgClientEmail || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(orgClientEmail);
    if (!orgName.trim()) { setPhase1Error('Organization is required'); return false; }
    if (!venueKey || !findVenueInCatalog(modernVenues, venueKey)) {
      setPhase1Error('Select a venue');
      return false;
    }
    const selectedVenue = modernVenues.find((venue) => venue.id === venueKey);
    const currentVenueKey = editingEvent
      ? eventVenueKey(editingEvent)
      : '';
    if (selectedVenue?.status === 'inactive' && selectedVenue.id !== currentVenueKey) {
      setPhase1Error('This venue is inactive. Choose another hall.');
      return false;
    }
    if (!emailOk) { setPhase1Error('Please enter a valid client email'); return false; }
    setPhase1Error('');
    return true;
  };
  // Save invoice-specific details without modifying the original event
  const closeEventWorkspace = () => {
    setIsEventModalOpen(false);
    setEditingEvent(null);
    setIsCreatingEvent(false);
    setIsAdjustMode(false);
    setIsViewMode(false);
    setIsEditingInvoiceDetails(false);
    setIsCreatingInvoiceFromFolio(false);
    setHoveredGanttEventId(null);
    setEventSubmitting(false);
    onWorkspaceClose?.();
  };

  const closeReceiptWorkspace = () => {
    setIsReceiptModalOpen(false);
    setReceiptErrors({});
    setReceiptPrintAfterSave(false);
    setReceiptInvoiceLocked(false);
    setReceiptInvoiceQuery('');
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
      checkNumber: '',
      recordedBy: 'Events Team',
      notes: '',
    });
  };

  const handleInvoiceDetailsSave = () => {
    if (!editingEvent) {
      alert('❌ No event selected for invoice details editing.');
      return;
    }

    try {
      const currentInvoice = eventInvoices.find(inv => inv.eventId === editingEvent.id);
      const totals = computeEventTotals();
      const today = new Date().toISOString().split('T')[0];
      const formSnapshot: InvoiceFormSnapshot = {
        eventId: editingEvent.id,
        eventName: getEventDisplayName(editingEvent),
        clientName: getEventClientName(editingEvent),
        startDate: startDate,
        endDate: endDate,
        dailySchedule: dailySchedule,
        particularLabels: particularLabels,
        discountEnabled: discountEnabled,
        discountType: discountType,
        discountValue: discountValue,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        balance: totals.total,
        issueDate: currentInvoice?.issueDate || today,
        dueDate: currentInvoice?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: (currentInvoice?.status || 'Issued') as EventInvoiceStatus
      };

      const paidSoFar = currentInvoice
        ? Math.max(0, Number(currentInvoice.total || 0) - Number(currentInvoice.balance || 0))
        : 0;
      const nextBalance = Math.max(0, formSnapshot.total - paidSoFar);
      const updatedInvoice: EventInvoice = {
        id: allocateUniqueEventInvoiceId(currentInvoice?.id || invoiceForm.id, editingEvent.id),
        eventId: editingEvent.id,
        eventName: formSnapshot.eventName,
        clientName: formSnapshot.clientName,
        issueDate: formSnapshot.issueDate,
        dueDate: formSnapshot.dueDate,
        formSnapshot,
        subtotal: formSnapshot.subtotal,
        tax: formSnapshot.tax,
        total: formSnapshot.total,
        balance: nextBalance,
        status: deriveInvoiceStatus(currentInvoice?.status || 'Issued', nextBalance, formSnapshot.total),
        reference: currentInvoice?.reference || invoiceForm.reference || '',
        notes: currentInvoice
          ? `Invoice details updated on ${new Date().toLocaleDateString()}. ${currentInvoice.notes || ''}`.trim()
          : `Invoice created from event ${formSnapshot.eventName}`
      };

      if (currentInvoice) {
        setEventInvoices((prev) => [updatedInvoice, ...prev.filter((inv) => inv.eventId !== editingEvent.id)]);
        if (updatedInvoice.id !== currentInvoice.id || !eventHasLiveAccountingInvoice(editingEvent.id)) {
          persistEventBookingPatch({ ...editingEvent, status: 'invoiced' }, { lastInvoiceId: updatedInvoice.id });
          syncInvoiceToFolio(updatedInvoice, true);
          captureEventInvoiceToAccounting(updatedInvoice, editingEvent);
        }
      } else {
        setEventInvoices((prev) => [updatedInvoice, ...prev.filter((inv) => inv.eventId !== editingEvent.id)]);
        const currentStatus = normalizeStatus(editingEvent.status);
        if (currentStatus === 'confirmed' || currentStatus === 'quote') {
          setCustomEvents(prev => prev.map(ev =>
            ev.id === editingEvent.id
              ? {
                  ...ev,
                  status: 'invoiced' as const,
                  venue: venueKey || ev.venue,
                  venueKey: venueKey || ev.venueKey,
                  venueName: findVenueInCatalog(modernVenues, venueKey, ev.venueName)?.name || ev.venueName,
                }
              : ev
          ));
        }
        persistEventBookingPatch({
          ...editingEvent,
          status: 'invoiced',
          venue: venueKey || editingEvent.venue,
          venueKey: venueKey || editingEvent.venueKey,
          venueName: findVenueInCatalog(modernVenues, venueKey, editingEvent.venueName)?.name || editingEvent.venueName,
        }, { lastInvoiceId: updatedInvoice.id });
        syncInvoiceToFolio(updatedInvoice);
        captureEventInvoiceToAccounting(updatedInvoice, editingEvent);
        setSelectedTab('confirmed');
        setManagementMainTab('invoices');
        setLastCreatedInvoiceId(updatedInvoice.id);
        trackEvent('Events.EventCreated', { action: 'invoice_created', eventId: editingEvent.id, invoiceId: updatedInvoice.id });
      }

      // If this invoice is already imported to a folio, update the folio entry
      const folioForInvoice = eventFolios.find(f => f.eventId === editingEvent.id);
      if (currentInvoice && folioForInvoice) {
        const existingEntry = folioForInvoice.entries.find(e =>
          e.reference === currentInvoice.id || e.description.includes(`Invoice ${currentInvoice.id}`)
        );

        if (existingEntry) {
          // Update the existing folio entry with new totals
          const entryIndex = folioForInvoice.entries.findIndex(e => e.id === existingEntry.id);
          if (entryIndex !== -1) {
            const previousBalance = entryIndex > 0 ? folioForInvoice.entries[entryIndex - 1].balance : 0;
            const newBalance = previousBalance + updatedInvoice.total;

            const updatedEntries = [...folioForInvoice.entries];
            updatedEntries[entryIndex] = {
              ...existingEntry,
              debit: updatedInvoice.total,
              balance: newBalance,
              description: 'Invoice'
            };

            // Update subsequent entries' balances
            for (let i = entryIndex + 1; i < updatedEntries.length; i++) {
              const prevBalance = updatedEntries[i - 1].balance;
              if (updatedEntries[i].debit > 0) {
                updatedEntries[i].balance = prevBalance + updatedEntries[i].debit;
              } else if (updatedEntries[i].credit > 0) {
                updatedEntries[i].balance = prevBalance - updatedEntries[i].credit;
              }
            }

            setEventFolios(prev => prev.map(f =>
              f.id === folioForInvoice.id
                ? { ...f, entries: updatedEntries, updatedAt: new Date().toISOString() }
                : f
            ));

            if (activeFolio?.id === folioForInvoice.id) {
              setActiveFolio({ ...folioForInvoice, entries: updatedEntries, updatedAt: new Date().toISOString() });
            }
          }
        }
      }

      closeEventWorkspace();
      setSelectedTab('confirmed');
      setManagementMainTab('invoices');
      console.log('[Invoice] Saved:', updatedInvoice.id, currentInvoice ? 'updated' : 'created');

    } catch (error) {
      console.error('[Invoice] Error saving invoice details:', error);
      alert(`❌ Error saving invoice details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEventSubmit = (statusOverride?: SimpleEventStatus) => {
    if (eventSubmitting) return;
    if (!validateEventForm()) return;
    setEventSubmitting(true);
    const savedStatus = (
      statusOverride === 'quote' ||
      statusOverride === 'confirmed' ||
      statusOverride === 'invoiced' ||
      statusOverride === 'cancelled'
    ) ? statusOverride : eventStatus;

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
      const venueInfo = findVenueInCatalog(modernVenues, venueKey);

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
      const bookingStatus = bookingStatusMap[savedStatus] || bookingStatusMap.quote;
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
        venueName: venueInfo?.name || '',
        arrivalDate: fallbackStart,
        departureDate: fallbackEnd,
        duration: durationDays,
        pax: attendees || 0,
        residential: isResidential,
        status: savedStatus,
        statusColor: eventStatusColorMap[savedStatus] || eventStatusColorMap[eventStatus],
        revenue: totals.total,
        deposit: depositAmount,
        balance: Math.max(0, totals.total - depositAmount),
        eventCoordinator: resolveCoordinatorValue(eventCoordinator),
        nextAction: nextAction.trim(),
        followUpDate,
        quoteNumber: editingEvent?.quoteNumber || (savedStatus === 'quote' ? useSettingsStore.getState().getNextModuleNumber('events', 'quotation') : ''),
        notes: '',
        specialRequirements: '',
        setupTime: '',
        contactPerson: clientContactName.trim() || orgName,
        contactPhone: orgContactPhone,
        contactEmail: orgClientEmail,
        linkedQuote: editingQuote?.quoteNumber || null,
        linkedBooking: booking.id,
        linkedBEO: editingEvent?.linkedBEO || null,
        linkedFolio: editingEvent?.linkedFolio || null,
        venueKey,
        completionStatus: editingEvent?.completionStatus,
        checkedIn: editingEvent?.checkedIn,
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
      // This function only runs on an explicit form submission (the user is actively
      // saving new schedule/pax/rate values), so the snapshot is always recomputed from
      // whatever was just submitted — regardless of the event's status. Previously this
      // froze the snapshot for any confirmed/invoiced event unless the save also
      // re-targeted status to 'quote', so a coordinator adding days or pax to an already-
      // confirmed event silently kept the old total (and any invoice generated from it).
      const derivedBudgetSnapshot = normalizeBudgetSnapshot(calculateEventBudget(budgetInput));
      const quoteBudgetSnapshot = derivedBudgetSnapshot;
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
      void saveEventBooking({
        id: String(uiEvent.id),
        title: eventName || 'Unnamed',
        organizer: orgName || '—',
        contactPerson: (clientContactName || '').trim() || orgName,
        contactPhone: orgContactPhone,
        contactEmail: orgClientEmail,
        hallId: venueKey || '',
        hallName: venueInfo?.name || '',
        startDate: fallbackStart,
        endDate: fallbackEnd,
        attendees: attendees || 0,
        status: savedStatus || 'pending',
        type: isResidential ? 'residential-conference' : 'conference',
        catering: dinnerCost > 0 || lunchCost > 0,
        audioVisual: false,
        decoration: false,
        totalCost: totals.total,
        details: {
          quoteBudgetSnapshot,
          costBreakdown,
          particularLabels,
          ratesByParticulars: Boolean(ratesByParticulars),
          combinedPackage: !ratesByParticulars,
          residential: Boolean(isResidential),
          dailySchedule: schedule,
          conferenceRate,
          lunchRate,
          dinnerRate,
          roomRate,
          defaultDayRate,
          completionStatus: editingEvent?.completionStatus,
          checkedIn: editingEvent?.checkedIn,
          eventCoordinator: uiEvent.eventCoordinator,
          nextAction: uiEvent.nextAction,
          followUpDate: uiEvent.followUpDate,
          quoteNumber: uiEvent.quoteNumber,
          venueKey: venueKey || '',
          venueName: venueInfo?.name || '',
        },
      }).catch(() => {});
      trackEvent('Events.EventCreated', {
        action: isEditing ? 'updated' : 'created',
        eventId: uiEvent.id,
        attendees,
        venueId: venueKey,
        status: savedStatus
      });

      if (savedStatus === 'quote' && totals.total > 0) {
        syncEventQuoteToAccounting(uiEvent, totals);
      }
      if ((savedStatus === 'invoiced' || eventInvoices.some((inv) => inv.eventId === uiEvent.id)) && uiEvent.id) {
        markConferenceProformaConverted(String(uiEvent.id));
      }
      
      // ===== ACCOUNTING INTEGRATION =====
      // When event is confirmed, capture revenue only if no Events invoice exists yet
      if (savedStatus === 'confirmed' && totals.total > 0) {
        try {
          const hasEventsInvoice = eventInvoices.some((inv) => inv.eventId === uiEvent.id);
          let result: ReturnType<typeof captureRevenue> | undefined;
          if (!hasEventsInvoice) {
            result = captureRevenue({
              id: `EVT-${uiEvent.id}`,
              source: 'conference',
              customerId: orgClientId || `client_${uiEvent.id}`,
              customerName: orgName || 'Conference Client',
              customerEmail: orgClientEmail,
              customerPhone: orgContactPhone,
              reference: uiEvent.id,
              description: `Conference Booking: ${eventName} - ${venueInfo?.name || 'Venue TBD'}`,
              items: [
                {
                  description: `${eventName} - Conference Package (${attendees} pax, ${durationDays} days)`,
                  quantity: 1,
                  unitPrice: totals.subtotal,
                  taxPercent: 0,
                },
              ],
              subtotal: totals.subtotal,
              taxAmount: totals.tax,
              total: totals.total,
              date: new Date().toISOString(),
            }, {
              // Confirming a booking isn't delivering the event — the money is
              // committed/collected now, but not earned until the event actually
              // happens. Held as Deferred Revenue until markEventAsCompleted()
              // recognizes it (see checkInEventGroup/markEventAsCompleted below).
              deferred: true,
            });

            if (result) {
              console.log(`[Events] ✅ Booking revenue captured (deferred) - Invoice: ${result.invoiceId}`);
            }
          } else {
            console.log('[Events] Skipping confirm revenue — Events invoice already exists for', uiEvent.id);
          }

          // If deposit was paid, also capture the payment
          if (depositAmount > 0) {
            const paymentResult = capturePayment({
              id: `DEP-${uiEvent.id}`,
              invoiceId: result?.invoiceId,
              customerId: orgClientId || `client_${uiEvent.id}`,
              customerName: orgName || 'Conference Client',
              amount: depositAmount,
              paymentMethod: 'Bank Transfer',
              reference: `DEP-${uiEvent.id}`,
              description: `Deposit for ${eventName}`,
            }, 'conference');
            
            if (paymentResult) {
              console.log(`[Events] ✅ Deposit captured - Receipt: ${paymentResult.receiptId}`);
            }
          }
        } catch (error) {
          console.error('[Events] ❌ Accounting integration error:', error);
        }
      }
      
      closeEventWorkspace();
      setSelectedTab('confirmed');
      setManagementMainTab('events');
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
    setClientContactName((event?.contactPerson || '').trim());
    setIsResidential(Boolean(event?.residential ?? event?.isResidential));
    setOrgClientId(event?.clientId || '');
    setOrgSearch(event?.organization || '');
    setEventStatus(normalizeStatus(event?.status));
    setStartDate(event?.arrivalDate || event?.startDate || '');
    setEndDate(event?.departureDate || event?.endDate || '');
    setVenueKey(event?.venueKey || event?.venue || '');
    setExpectedPax(
      typeof event?.expectedPax === 'number'
        ? event.expectedPax
        : (event?.pax || 0)
    );
    setEventTaxExempt(Boolean(event?.isTaxExempt ?? event?.taxExempt));
    setEventCoordinator(resolveEventCoordinator(event));
    setNextAction(event?.nextAction || '');
    setFollowUpDate(event?.followUpDate || '');

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

  // Apply invoice snapshot data to form state for editing
  const applyInvoiceSnapshotToState = (snapshot: InvoiceFormSnapshot) => {
    if (!snapshot) return;

    // Apply basic event info
    setEventName(snapshot.eventName || '');
    setOrgName(snapshot.clientName || '');
    setStartDate(snapshot.startDate || '');
    setEndDate(snapshot.endDate || '');

    // Apply schedule and rates data
    if (Array.isArray(snapshot.dailySchedule)) {
      setDailySchedule(snapshot.dailySchedule);
      
      // Also update scheduleDataMap to preserve the snapshot data
      const newMap = new Map<string, {
        conferencePax: number;
        lunchPax: number;
        dinnerPax: number;
        rooms: number;
        rate: number;
        extras: Record<string, number>;
        extraLines: { id: string; name: string; qty: number; unitPrice: number; taxGroup: string }[];
      }>();
      snapshot.dailySchedule.forEach(row => {
        if (row.date) {
          newMap.set(row.date, {
            conferencePax: row.conferencePax || 0,
            lunchPax: row.lunchPax || 0,
            dinnerPax: row.dinnerPax || 0,
            rooms: row.rooms || 0,
            rate: row.rate || 0,
            extras: row.extras || {},
            extraLines: row.extraLines || []
          });
        }
      });
      setScheduleDataMap(newMap);
    }
    if (snapshot.particularLabels) {
      setParticularLabels(snapshot.particularLabels);
    }

    // Apply financial settings
    setDiscountEnabled(snapshot.discountEnabled || false);
    setDiscountType(snapshot.discountType || 'percent');
    setDiscountValue(snapshot.discountValue || 0);
  };

  const resetEventFormState = (seed: Partial<any> = {}) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const arrival = seed.arrivalDate || todayStr;
    const departure = seed.departureDate || arrival;
    const venue = seed.venueKey || seed.venue || '';
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
    setEventCoordinator(UNASSIGNED_STAFF);
    setNextAction('');
    setFollowUpDate('');
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
      id: `EVT-${String(customEvents.length + 1).padStart(3, '0')}`,
      arrivalDate: arrival,
      departureDate: departure,
      venue: seedVenue,
      venueName: seedVenue ? (modernVenues.find(v => v.id === seedVenue)?.name || '') : '',
      duration: 1,
      pax: seedPax,
      status: eventStatus,
      statusColor: eventStatusColorMap[eventStatus],
      // Most bookings here are residential — default a new event to that so
      // the accommodation fields are visible from the start; the rarer
      // day-only event costs one click (unchecking it) instead of the common
      // case costing one.
      residential: true
    };

    setIsCreatingEvent(true);
    setIsEditingInvoiceDetails(false);
    resetEventFormState({
      arrivalDate: arrival,
      departureDate: departure,
      venue: seedVenue,
      pax: seedPax,
      residential: true
    });
    setEditingEvent(blankEvent);
    setIsEventModalOpen(true);
  };

  const openEventForEdit = (event: any, adjustMode: boolean = false, createInvoice: boolean = false) => {
    setIsCreatingEvent(false);
    setIsViewMode(false);
    setIsAdjustMode(adjustMode);
    setIsCreatingInvoiceFromFolio(createInvoice);
    setIsEditingInvoiceDetails(false);
    setEditingEvent(event);
    convertCustomEventToFormState(event);
    if (createInvoice) {
      setEventStatus('invoiced');
    }
    setIsEventModalOpen(true);
  };

  // Open a specific event when hosted as an overlay (e.g. from Accounting).
  const openedExternalEventRef = useRef<string | null>(null);
  useEffect(() => {
    if (!workspaceOnly || !externalEditEventId || !eventsHydrated) return;
    if (openedExternalEventRef.current === String(externalEditEventId)) return;
    const event = customEvents.find((ev) => String(ev.id) === String(externalEditEventId));
    if (!event) {
      window.alert(`Could not find event ${externalEditEventId} to edit.`);
      onWorkspaceClose?.();
      return;
    }
    openedExternalEventRef.current = String(externalEditEventId);
    openEventForEdit(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceOnly, externalEditEventId, eventsHydrated, customEvents]);

  const openEventForView = (event: any) => {
    setIsCreatingEvent(false);
    setIsViewMode(true);
    setIsCreatingInvoiceFromFolio(false); // Reset flag when viewing
    setIsEditingInvoiceDetails(false);
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
          id: genId('INV'),
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
        persistEventBookingPatch({ ...savedEvent, status: shouldUpdateToInvoiced ? 'invoiced' : savedEvent.status }, { lastInvoiceId: newInvoice.id });
        
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
        captureEventInvoiceToAccounting(newInvoice, savedEvent);
        
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

  const getEventsUsingVenue = (venue: VenueDetails) =>
    customEvents.filter(
      (event) => event?.id && !isHardcodedDemoEventId(event.id) && eventUsesVenue(event, venue)
    );

  const deactivateVenue = (venue: VenueDetails) => {
    setModernVenues((prev) =>
      prev.map((item) => (item.id === venue.id ? { ...item, status: 'inactive' } : item))
    );
    trackEvent('Events.VenueBooked', { action: 'deactivated', venueId: venue.id });
  };

  const handleDeleteVenue = async (venue: VenueDetails) => {
    const linked = getEventsUsingVenue(venue);
    if (linked.length) {
      if (venue.status === 'inactive') {
        alert(
          `${venue.name} has ${linked.length} event${linked.length === 1 ? '' : 's'} and cannot be deleted. It is already inactive.`
        );
        return;
      }
      const { confirmDanger } = await import('./DangerConfirm');
      const retire = await confirmDanger({
        tone: 'delete',
        title: `Deactivate ${venue.name}?`,
        message: `${venue.name} has ${linked.length} event${linked.length === 1 ? '' : 's'} and cannot be deleted. It will be marked Inactive so it stays off new bookings. History is kept.`,
        confirmLabel: 'Deactivate',
      });
      if (!retire) return;
      deactivateVenue(venue);
      return;
    }

    const { confirmDelete } = await import('./DangerConfirm');
    if (!(await confirmDelete(venue.name, 'This venue will be permanently removed. This cannot be undone.'))) {
      return;
    }

    setModernVenues((prev) => prev.filter((item) => item.id !== venue.id));

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
      eventId: editingEvent?.id || editingQuote?.eventId,
      quoteNumber: editingQuote?.quoteNumber || useSettingsStore.getState().peekNextModuleNumber('events', 'quotation'),
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

  const handleSaveQuoteDraft = () => {
    const hasServices = quoteDays.some((day) =>
      day.services.some((service) => Number(service.qty || 0) > 0)
    );
    if (!hasServices) {
      alert('Add at least one service line before saving.');
      return;
    }
    if (!editingQuote?.clientName?.trim() || !editingQuote?.eventName?.trim()) {
      alert('Enter client name and event name before saving.');
      return;
    }

    const exportQuote = buildQuoteForExport(editingQuote);
    if (!exportQuote) {
      alert('Unable to build quote from current data.');
      return;
    }
    const totals = calculateQuoteTotals(exportQuote);
    const quoteNumber = editingQuote?.quoteNumber?.trim()
      || useSettingsStore.getState().getNextModuleNumber('events', 'quotation');
    const linkedEventId = exportQuote.eventId || editingEvent?.id;

    if (linkedEventId) {
      setCustomEvents((prev) =>
        prev.map((ev) =>
          ev.id === linkedEventId
            ? {
                ...ev,
                linkedQuote: quoteNumber,
                quoteNumber,
                revenue: totals.grandTotal,
                budgetTotal: totals.grandTotal,
                status:
                  normalizeStatus(ev.status) === 'invoiced' ? ev.status : ('quote' as const),
              }
            : ev
        )
      );
    } else {
      const newEventId = useSettingsStore.getState().getNextModuleNumber('events', 'eventBooking');
      setCustomEvents((prev) => [
        {
          id: newEventId,
          eventName: exportQuote.eventName || 'Untitled Event',
          organization: exportQuote.clientName || '',
          clientName: exportQuote.clientName || '',
          contactEmail: exportQuote.clientEmail || '',
          contactPhone: exportQuote.clientPhone || '',
          arrivalDate: exportQuote.startDate,
          departureDate: exportQuote.endDate,
          startDate: exportQuote.startDate,
          endDate: exportQuote.endDate,
          venue: '',
          venueName: exportQuote.venueName || '',
          pax: exportQuote.pax || 0,
          duration: exportQuote.totalDays || 1,
          status: 'quote',
          linkedQuote: quoteNumber,
          quoteNumber,
          revenue: totals.grandTotal,
          budgetTotal: totals.grandTotal,
          residential: exportQuote.eventType === 'residential-conference',
        },
        ...prev,
      ]);
      setEditingQuote((prev: any) => ({ ...(prev || {}), eventId: newEventId }));
    }

    setEditingQuote({ ...exportQuote, quoteNumber, status: 'draft' });
    trackEvent('Events.EventCreated', { action: 'quote_draft_saved', quoteId: exportQuote.id, quoteNumber });
    alert(`Quote ${quoteNumber} saved.`);
  };

  const getInvoiceableProformas = () =>
    allEvents.filter((ev) => {
      const status = normalizeStatus(ev.status || ev.eventStatus);
      return status !== 'cancelled' && !eventInvoices.some((inv) => inv.eventId === ev.id);
    });

  const getProformaPickerLabel = (ev: any) => {
    const quoteNo = ev?.quoteNumber || formatEventId(ev?.id) || 'Quote';
    const name = getEventDisplayName(ev);
    const client = getEventClientName(ev);
    const amount = formatCurrency(Number(ev?.budgetTotal || ev?.revenue || ev?.totalCost || 0));
    return `${quoteNo} · ${name} · ${client} · ${amount}`;
  };

  const openCreateInvoicePicker = () => {
    const eligible = getInvoiceableProformas();
    if (!eligible.length) {
      alert('No proformas are ready to invoice. Create a quote first, or edit an existing invoice.');
      return;
    }
    if (eligible.length === 1) {
      openEventInvoiceForm(eligible[0]);
      return;
    }
    setInvoiceCreateEventId(eligible[0]?.id || '');
    setIsInvoiceEventPickerOpen(true);
  };

  const confirmCreateInvoiceForEvent = () => {
    const event = allEvents.find((ev) => ev.id === invoiceCreateEventId);
    if (!event) {
      alert('Select a proforma to convert to an invoice.');
      return;
    }
    setIsInvoiceEventPickerOpen(false);
    openEventInvoiceForm(event);
  };

  const handleOpenContractFromEvent = () => {
    if (!validateEventForm()) {
      window.setTimeout(() => {
        document.querySelector('[data-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const contractClient = {
      id: editingEvent?.id ? `event-client-${editingEvent.id}` : `event-client-${Date.now()}`,
      name: clientContactName.trim() || orgName,
      position: '',
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
      specialTerms: ''
    };
    setSelectedClient(contractClient);
    setSelectedContractEventInfo(getCurrentEventSnapshot());
    trackEvent('Events.EventCreated', { action: 'contract_modal_opened', organization: orgName });
    setIsContractModalOpen(true);
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
    const orgProfile = buildOrgProfile(settingsState);

    const taxSpread = mapTaxBreakdownToPrint(eventTotals.taxBreakdown || []);
    const taxLabelMap: Record<string, string> = {
      vat: 'VAT',
      nhil: 'NHIL',
      levy: 'Tourism Levy',
      covid: 'COVID Levy (legacy)',
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

  const buildOrgPrintProfile = () => buildOrgProfile(useSettingsStore.getState() as any);

  /** Resolves a document type's configured template (Settings → Document Templates), so edits there always land exactly where they should. */
  const resolveEventTemplateKey = (type: PrintType) => (useSettingsStore.getState() as any).printing?.[type];

  /** Built-in + custom (Template Builder) templates available for a document type, for the per-print template picker. */
  const listSelectableTemplates = (type: PrintType) => [
    ...listBuiltInTemplates(type).map((t) => ({ key: t.id, name: t.name })),
    ...useSettingsStore.getState().getDocBuilderTemplatesByType(type).map((t) => ({ key: t.id, name: t.name })),
  ];

  const buildQuotePrintDataFromEvent = (eventData: any) => {
    const budget = getQuoteBudgetSnapshot(eventData);
    const allRows = [
      { label: 'Accommodation', amount: budget.accommodation },
      { label: 'Conference', amount: budget.conference },
      { label: 'Lunch', amount: budget.lunch },
      { label: 'Dinner', amount: budget.dinner },
      { label: 'Extras', amount: budget.extras },
    ].filter((row) => row.amount > 0);

    const items =
      allRows.length > 0
        ? allRows.map((row) => ({
            description: row.label,
            amount: row.amount,
          }))
        : [
            {
              description: eventData.eventName || 'Event Services',
              amount: budget.total || Number(eventData.revenue || eventData.budgetTotal || 0),
            },
          ];

    const totalAmount =
      budget.total ||
      allRows.reduce((sum, row) => sum + row.amount, 0) ||
      Number(eventData.revenue || eventData.budgetTotal || 0);

    const section: 'accommodation' | 'events' = budgetHasEventComponent(budget) ? 'events' : 'accommodation';

    return {
      type: EVENT_DOC_TYPE[section].proforma,
      data: {
        org: buildOrgPrintProfile(),
        guest: {
          name: eventData.organization || eventData.clientName || 'Client',
          company: eventData.organization || eventData.clientName || '',
          address: resolveClientAddress(eventData.corporateClientId || eventData.clientId),
          arrivalDate: eventData.arrivalDate || eventData.startDate || '',
          departureDate: eventData.departureDate || eventData.endDate || '',
          nights: eventData.duration || 1,
        },
        docNumber: eventData.quoteNumber || formatEventId(eventData.id),
        docDate: new Date().toISOString(),
        title: 'Quotation',
        items,
        totals: {
          subTotal: totalAmount,
          grandTotal: totalAmount,
          balance: totalAmount,
        },
        footerNotes: [
          'Generated via Events & Conferences workflow.',
          'Quotation layout provided by Settings • Template Builder.',
        ],
        currency: '₵',
      },
    };
  };

  const buildInvoicePrintData = (invoice: EventInvoice, event: any) => {
    const schedule = (event as any).dailySchedule || [];
    const items = buildPrintLineItemsFromSchedule(
      schedule,
      {
        residential: event.residential,
        roomRate: (event as any).roomRate || 0,
        conferenceRate: (event as any).conferenceRate || 0,
        lunchRate: (event as any).lunchRate || 0,
        dinnerRate: (event as any).dinnerRate || 0,
      },
      {
        arrivalDate: event.arrivalDate,
        startDate: event.startDate,
        departureDate: event.departureDate,
        endDate: event.endDate,
      }
    );

    if (items.length === 0) {
      items.push({
        description: invoice.eventName || 'Event Services',
        amount: invoice.subtotal || invoice.total || 0,
      });
    }

    const payments = Math.max(0, (invoice.total || 0) - (invoice.balance || 0));

    const section: 'accommodation' | 'events' = scheduleHasEventComponent(schedule, (event as any).customParticulars || []) ? 'events' : 'accommodation';

    return {
      type: EVENT_DOC_TYPE[section].invoice,
      data: {
        org: buildOrgPrintProfile(),
        guest: {
          name: invoice.clientName || event.organization || 'Client',
          company: invoice.clientName || event.organization || '',
          address: resolveClientAddress((event as any).corporateClientId || (event as any).clientId),
          arrivalDate: event.arrivalDate || event.startDate || '',
          departureDate: event.departureDate || event.endDate || '',
          nights: event.duration || 1,
        },
        docNumber: invoice.id,
        docDate: invoice.issueDate || new Date().toISOString(),
        title: 'Invoice',
        items,
        totals: {
          subTotal: invoice.subtotal || 0,
          taxes: invoice.tax > 0 ? { vat: invoice.tax } : undefined,
          grandTotal: invoice.total || 0,
          payments,
          balance: invoice.balance ?? invoice.total ?? 0,
        },
        footerNotes: [
          'Generated via Events & Conferences workflow.',
          'Invoice layout provided by Settings • Template Builder.',
        ],
        currency: '₵',
      },
    };
  };

  const handlePrintQuotePdf = (templateOverride?: string) => {
    const { type, data } = buildEventPrintData('proforma');
    if (!data) {
      alert('Unable to generate proforma data for this event.');
      return;
    }
    if (!openPrintPreview(type, templateOverride || resolveEventTemplateKey(type), data as any)) return;
    trackEvent('Events.EventCreated', { action: 'quote_pdf_generated', eventName });
  };

  // Print an invoice straight from the event's live computed totals — for a
  // Confirmed/Quote event that doesn't (yet) have a separately tracked
  // EventInvoice record. Keeps Invoice/Receipt usable on any priced event.
  const handlePrintEventInvoicePdf = (templateOverride?: string) => {
    const { type, data } = buildEventPrintData('invoice');
    if (!data) {
      alert('Unable to generate invoice data for this event.');
      return;
    }
    if (!openPrintPreview(type, templateOverride || resolveEventTemplateKey(type), data as any)) return;
    trackEvent('Events.EventCreated', { action: 'invoice_pdf_generated_from_totals', eventName });
  };

  // Print invoice PDF for a specific invoice
  const handleDownloadInvoicePdf = (invoice: EventInvoice, templateOverride?: string) => {
    const event = allEvents.find((ev) => ev.id === invoice.eventId);
    if (!event) {
      alert('Event not found for this invoice.');
      return;
    }

    const { type, data } = buildInvoicePrintData(invoice, event);
    if (!openPrintPreview(type, templateOverride || resolveEventTemplateKey(type), data as any)) return;
    trackEvent('Events.EventCreated', { action: 'invoice_pdf_downloaded', invoiceId: invoice.id, eventId: invoice.eventId });
  };

  const handleDownloadQuotePdf = (eventData: any) => {
    if (!eventData) {
      alert('Quote data not available for this event.');
      return;
    }

    const { type, data } = buildQuotePrintDataFromEvent(eventData);
    openPrintPreview(type, resolveEventTemplateKey(type), data as any);

    trackEvent('Events.EventCreated', {
      action: 'quote_pdf_downloaded',
      eventId: eventData.id,
      quoteNumber: eventData.quoteNumber || formatEventId(eventData.id),
    });
  };

  /** Mirrors buildCustomerReceiptPrintData() in lib/accounting/receiptPrint.ts for front-desk receipts. */
  const buildEventReceiptPrintData = (receipt: EventReceipt) => {
    const method = paymentMethodLabel(receipt.method);
    const event = allEvents.find((ev) => ev.id === receipt.eventId) as any;
    const section: 'accommodation' | 'events' = scheduleHasEventComponent(event?.dailySchedule || [], event?.customParticulars || []) ? 'events' : 'accommodation';
    return {
      type: EVENT_DOC_TYPE[section].receipt,
      data: {
        org: buildOrgPrintProfile(),
        guest: {
          name: receipt.clientName,
          company: event?.organization || undefined,
          address: resolveClientAddress(event?.corporateClientId || event?.clientId),
        },
        docNumber: receipt.id,
        docDate: receipt.date,
        title: 'Receipt',
        items: [
          {
            description: `Payment received (${method})${receipt.checkNumber ? ` · Cheque ${receipt.checkNumber}` : ''}${receipt.reference ? ` · ${receipt.reference}` : ''}`,
            amount: receipt.amount,
            date: receipt.date,
          },
        ],
        totals: {
          subTotal: receipt.amount,
          payments: receipt.amount,
          balance: 0,
          grandTotal: receipt.amount,
        },
        footerNotes: [
          receipt.notes,
          receipt.invoiceId ? `Applied to: Invoice ${receipt.invoiceId}` : undefined,
          `Recorded by ${receipt.recordedBy || 'Events Team'}`,
          'Generated via Events & Conferences workflow.',
        ].filter(Boolean) as string[],
        currency: '₵',
      },
    };
  };

  const handleDownloadReceiptPdf = (receipt: EventReceipt, templateOverride?: string) => {
    if (receipt.status === 'Void') return;
    const { type, data } = buildEventReceiptPrintData(receipt);
    if (!openPrintPreview(type, templateOverride || resolveEventTemplateKey(type), data as any)) return;
    trackEvent('Events.EventCreated', { action: 'receipt_pdf_downloaded', receiptId: receipt.id, eventId: receipt.eventId, method: receipt.method });
  };

  // Comprehensive Quoting System Functions
  
  // Calculate quote totals
  const calculateQuoteTotals = (quote: any) => {
    let subtotal = 0;
    const allTaxes: any[] = [];
    let hasTaxExemption = false;
    
    // Calculate subtotal and collect all taxes
    quote.eventTimeline.forEach((day: any) => {
      day.services.forEach((service: any) => {
        subtotal += service.totalPrice;
        const exempt = quote.taxExempt || service.taxGroup === 'none';
        const { taxes, exemptionApplied } = computeQuoteTax(service.totalPrice, exempt);
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
    if (!openHtmlPrintWindow(html)) return;
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
      id: useSettingsStore.getState().getNextModuleNumber('events', 'eventBooking'),
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
    const contacts = [
      {
        name: event?.contactPerson || event?.organization || '',
        role: 'Client Contact',
        phone: event?.contactPhone || '',
        email: event?.contactEmail || '',
      },
    ];

    const coordinator = resolveEventCoordinator(event);
    if (coordinator !== UNASSIGNED_STAFF) {
      contacts.push({
        name: coordinator,
        role: 'Event Coordinator',
        phone: '',
        email: '',
      });
    }

    return contacts;
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
          notes: selectedEventForBEO.notes || '',
          eventCoordinator:
            resolveEventCoordinator(selectedEventForBEO) === UNASSIGNED_STAFF
              ? ''
              : resolveEventCoordinator(selectedEventForBEO),
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
      });
    } else if (!isBEOModalOpen) {
      setBeoForm(null);
      setBeoWorkspaceTab('overview');
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

    const customInstructions = (beoForm.instructions || []).filter((instruction: string) => instruction.trim().length > 0);
    const instructionSummary = customInstructions.join('\n');
    const combinedSpecialRequirements = [
      beoForm.room.setupNotes,
      instructionSummary
    ].filter(Boolean).join('\n').trim();

    const eventCoordinator = resolveCoordinatorValue(beoForm.eventInfo.eventCoordinator);
    const customContacts = getContactList({
      contactPerson: beoForm.eventInfo.contactPerson,
      contactPhone: beoForm.eventInfo.contactPhone,
      contactEmail: beoForm.eventInfo.contactEmail,
      organization: beoForm.eventInfo.organization,
      eventCoordinator,
    });

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
      eventCoordinator,
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

    const savedEvent = {
      ...updatedEvent,
      linkedBEO: updatedEvent.linkedBEO || `BEO-${updatedEvent.id}`,
    };

    setCustomEvents((prev) => {
      const idx = prev.findIndex((ev) => ev.id === savedEvent.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...savedEvent };
        return next;
      }
      const fromSeed = [...comprehensiveEvents, ...additionalEvents].find((ev) => ev.id === savedEvent.id);
      const base = fromSeed || savedEvent;
      return [...prev, { ...base, ...savedEvent }];
    });

    setSelectedEventForBEO(savedEvent);

    if (savedEvent.linkedBooking) {
      const instructionsSummary = (savedEvent.customInstructions && savedEvent.customInstructions.length)
        ? savedEvent.customInstructions.join('\n')
        : savedEvent.specialRequirements || '';

      enhancedFrontOfficeStore.updateEventBooking(savedEvent.linkedBooking, {
        eventName: savedEvent.eventName,
        startDate: savedEvent.arrivalDate,
        endDate: savedEvent.departureDate,
        attendees: savedEvent.pax,
        corporateClientName: savedEvent.organization,
        contactPhone: savedEvent.contactPhone,
        contactEmail: savedEvent.contactEmail,
        specialRequirements: instructionsSummary
      });
    }

    persistEventBookingPatch(savedEvent, {
      eventCoordinator: savedEvent.eventCoordinator,
      beoForm,
      linkedBEO: savedEvent.linkedBEO,
    });
    generateBEO(savedEvent);
    generateFunctionSheet(savedEvent);
    trackEvent('Events.EventCreated', { action: 'beo_saved', eventId: savedEvent.id });
    setIsBEOModalOpen(false);
  };

  const handleSendFunctionSheetToDepartments = () => {
    if (!beoForm || !selectedEventForBEO) return;
    const name = beoForm.eventInfo?.eventName || selectedEventForBEO.eventName || 'Event';
    const venue = beoForm.eventInfo?.venueName || selectedEventForBEO.venueName || 'venue TBC';
    const dates = formatEventTableRange(beoForm.eventInfo?.arrivalDate, beoForm.eventInfo?.departureDate);
    const pax = beoForm.eventInfo?.pax || selectedEventForBEO.pax || 0;
    const layout = beoForm.room?.layout ? `Layout ${beoForm.room.layout}` : '';
    const meals = [beoForm.catering?.lunch && 'lunch', beoForm.catering?.dinner && 'dinner'].filter(Boolean).join(', ');
    const duties = (beoForm.departmentChecklist || [])
      .filter((item: any) => item?.department)
      .map((item: any) => `${item.department}: ${item.activity || item.status || 'action'}`)
      .slice(0, 6)
      .join('; ');
    const targets: DepartmentKey[] = ['frontdesk', 'housekeeping', 'f&b'];
    if (beoForm.technical?.equipment || beoForm.technical?.notes) targets.push('inventory');
    announcementStore.publish({
      level: 'normal',
      from: 'events',
      departments: Array.from(new Set(targets)),
      mentions: ['frontdesk', 'housekeeping', 'f&b'],
      message: `Function sheet: ${name} · ${venue} · ${dates} · ${pax} pax${layout ? ` · ${layout}` : ''}${meals ? ` · ${meals}` : ''}${duties ? ` · Duties: ${duties}` : ''}. Please action.`,
    });
    persistEventBookingPatch(selectedEventForBEO, { functionSheetSentAt: new Date().toISOString() });
    trackEvent('Events.EventCreated', { action: 'function_sheet_sent', eventId: selectedEventForBEO.id });
    alert('Function sheet sent to Front Office, Housekeeping, and Restaurant.');
  };

  // Helper functions for export operations
  const getFoodBeverageServices = (event: any) => functionFbDuties(event);
  const getHousekeepingNotes = (event: any) => functionHkDuties(event);

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
  const buildFunctionSchedulePrintHtml = (events: any[], scheduleTitle: string) => {
    const confirmedCount = events.filter(
      (e) =>
        normalizeStatus(e.status) === 'confirmed' ||
        e.eventStatus === 'confirmed' ||
        e.eventStatus === 'in-progress'
    ).length;
    const quoteCount = events.filter((e) => normalizeStatus(e.status) === 'quote').length;
    const totalPax = events.reduce((sum, e) => sum + (e.pax || 0), 0);

    const rows = events
      .map(
        (event, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${event.organization || event.clientName || '—'}</td>
            <td>${event.eventName || '—'}</td>
            <td>${event.venueName || event.venue || 'Unassigned'}</td>
            <td>${event.arrivalDate || event.startDate || '—'} – ${event.departureDate || event.endDate || '—'}</td>
            <td>${event.duration || 0} days</td>
            <td>${event.pax || 0}</td>
            <td>${formatScheduleStatus(event.eventStatus || event.status)}</td>
            <td>${getFoodBeverageServices(event)}</td>
            <td>${getHousekeepingNotes(event)}</td>
          </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Function Schedule - ${scheduleTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { font-size: 24px; margin-bottom: 4px; }
            .meta { color: #6b7280; margin-bottom: 20px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
            .summary-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
            .summary-number { font-size: 22px; font-weight: 700; color: #2563eb; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f9fafb; }
          </style>
        </head>
        <body>
          <h1>Provisional Function Schedule</h1>
          <p class="meta">${scheduleTitle} • Generated ${new Date().toLocaleDateString()}</p>
          <div class="summary">
            <div class="summary-item"><div class="summary-number">${events.length}</div><div>Total Functions</div></div>
            <div class="summary-item"><div class="summary-number">${confirmedCount}</div><div>Confirmed</div></div>
            <div class="summary-item"><div class="summary-number">${quoteCount}</div><div>Quote</div></div>
            <div class="summary-item"><div class="summary-number">${totalPax}</div><div>Total Attendees</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Organization</th><th>Event</th><th>Venue</th><th>Dates</th>
                <th>Duration</th><th>Attendees</th><th>Status</th><th>Food &amp; Beverage</th><th>Housekeeping</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="10">No events in this schedule.</td></tr>'}</tbody>
          </table>
        </body>
      </html>`;
  };

  const printFunctionScheduleFromEvents = (
    events: any[],
    scheduleTitle: string,
    trackAction: string
  ) => {
    trackEvent('Events.EventCreated', { action: trackAction, eventCount: events.length });
    const html = buildFunctionSchedulePrintHtml(events, scheduleTitle);
    if (!openHtmlPrintWindow(html)) return;
  };

  const exportFunctionSchedulePDF = () => {
    try {
      printFunctionScheduleFromEvents(allEvents, 'All Events', 'function_schedule_pdf_exported');
    } catch (error) {
      console.error('Error exporting function schedule PDF:', error);
      alert('Failed to export function schedule. Please try again.');
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
        id: genId('INV'),
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
      id: genId('INV'),
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

  const openEventInvoiceForm = (event: any, invoice?: EventInvoice) => {
    if (!event) {
      alert('Event not found for this invoice.');
      return;
    }

    convertCustomEventToFormState(event);
    if (invoice?.formSnapshot) {
      applyInvoiceSnapshotToState(invoice.formSnapshot);
    }

    setIsCreatingEvent(false);
    setIsViewMode(false);
    setIsAdjustMode(false);
    setIsCreatingInvoiceFromFolio(false);
    setEditingEvent(event);
    setEventStatus('invoiced');
    setInvoiceForm((prev) => ({
      ...prev,
      id: allocateUniqueEventInvoiceId(invoice?.id, event.id),
      eventId: event.id,
      eventName: invoice?.eventName || getEventDisplayName(event),
      clientName: invoice?.clientName || getEventClientName(event),
      subtotal: invoice?.subtotal,
      tax: invoice?.tax,
      total: invoice?.total,
      balance: invoice?.balance,
      status: invoice?.status || 'Issued',
      notes: invoice?.notes || '',
      issueDate: invoice?.issueDate,
      dueDate: invoice?.dueDate,
      reference: invoice?.reference || '',
    }));
    setIsEditingInvoiceDetails(true);
    setIsEventModalOpen(true);
  };

  const openInvoiceDetailEdit = (invoice: EventInvoice) => {
    const event = allEvents.find(ev => ev.id === invoice.eventId);
    openEventInvoiceForm(event, invoice);
  };

  const validateInvoiceForm = () => {
    const errors: Record<string, string> = {};
    if (!invoiceForm.eventId) errors.eventId = 'Select an event';
    else {
      const targetEvent = allEvents.find(ev => ev.id === invoiceForm.eventId);
      if ((targetEvent?.status || targetEvent?.eventStatus) === 'cancelled') errors.eventId = 'Cannot invoice a cancelled event';
    }
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
      id: allocateUniqueEventInvoiceId(invoiceForm.id, invoiceForm.eventId || event?.id || ''),
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
        captureEventInvoiceToAccounting(payload, event);
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
        setManagementMainTab('invoices');
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

  const getPayableInvoices = () =>
    eventInvoices.filter((inv) => Number(inv.balance || 0) > 0);

  const getInvoiceReceiptLabel = (inv: EventInvoice) => {
    const outstanding = Number(inv.balance || 0);
    const due = outstanding > 0 ? `${formatCurrency(outstanding)} due` : 'Paid';
    const number = getConferenceInvoiceNumber(inv.id, inv.eventId) || 'Invoice';
    return `${number} · ${inv.eventName || 'Event'} · ${inv.clientName || 'Client'} · ${due}`;
  };

  const openReceiptFromInvoice = (invoice: EventInvoice, receipt?: EventReceipt) => {
    const event = allEvents.find((ev) => ev.id === invoice.eventId);
    openReceiptModal(receipt ? 'edit' : 'create', receipt, {
      ...(event || {}),
      id: invoice.eventId,
      eventId: invoice.eventId,
      invoiceId: invoice.id,
      balance: invoice.balance,
    });
  };

  const openCreateReceiptPicker = () => {
    const payable = getPayableInvoices();
    if (payable.length === 1) {
      openReceiptFromInvoice(payable[0]);
      return;
    }
    if (eventInvoices.length === 1) {
      openReceiptFromInvoice(eventInvoices[0]);
      return;
    }
    openReceiptModal('create', undefined, { skipDefaultEvent: true });
  };

  const openReceiptModal = (mode: 'create' | 'edit', receipt?: EventReceipt, eventOverride?: any) => {
    const today = new Date().toISOString().split('T')[0];
    const recorder = eventStaffOptions[0]?.label || 'Events Team';

    if (receipt) {
      setReceiptForm({ ...receipt });
      setReceiptModalMode(mode);
      setReceiptErrors({});
      setReceiptPrintAfterSave(false);
      setReceiptInvoiceLocked(true);
      setReceiptInvoiceQuery('');
      setIsReceiptModalOpen(true);
      return;
    }

    if (eventOverride?.skipDefaultEvent) {
      setReceiptInvoiceLocked(false);
      setReceiptInvoiceQuery('');
      setReceiptForm({
        id: genId('RCPT'),
        eventId: '',
        eventName: '',
        invoiceId: '',
        clientName: '',
        date: today,
        amount: 0,
        method: 'Cash',
        reference: '',
        checkNumber: '',
        recordedBy: recorder,
        notes: ''
      });
      setReceiptModalMode(mode);
      setReceiptErrors({});
      setReceiptPrintAfterSave(true);
      setIsReceiptModalOpen(true);
      return;
    }

    const defaultEvent =
      eventOverride && (eventOverride.id || eventOverride.eventId)
        ? (allEvents.find((ev) => ev.id === (eventOverride.id || eventOverride.eventId)) || eventOverride)
        : undefined;
    const linkedInvoice = eventOverride?.invoiceId
      ? eventInvoices.find((inv) => inv.id === eventOverride.invoiceId)
      : defaultEvent
        ? eventInvoices.find((inv) => inv.eventId === defaultEvent.id)
        : undefined;
    const outstanding = Number(
      eventOverride?.balance ??
      linkedInvoice?.balance ??
      defaultEvent?.balance ??
      0
    );

    const resolvedInvoiceId = eventOverride?.invoiceId || linkedInvoice?.id || '';
    setReceiptForm({
      id: genId('RCPT'),
      eventId: defaultEvent?.id || eventOverride?.eventId || '',
      eventName: getEventDisplayName(defaultEvent) || eventOverride?.eventName || '',
      invoiceId: resolvedInvoiceId,
      clientName: getEventClientName(defaultEvent) || eventOverride?.clientName || '',
      date: today,
      amount: outstanding,
      method: 'Cash',
      reference: '',
      checkNumber: '',
      recordedBy: recorder,
      notes: ''
    });

    setReceiptModalMode(mode);
    setReceiptErrors({});
    setReceiptPrintAfterSave(true);
    setReceiptInvoiceLocked(Boolean(resolvedInvoiceId));
    setReceiptInvoiceQuery('');
    setIsReceiptModalOpen(true);
  };

  const validateReceiptForm = () => {
    const errors: Record<string, string> = {};
    if (!receiptForm.invoiceId) errors.invoiceId = 'Select the invoice this payment is for';
    if (!receiptForm.eventId) errors.eventId = 'Select an invoice with an event';
    if (!receiptForm.clientName || !receiptForm.clientName.trim()) errors.clientName = 'Client name is required';
    if (!receiptForm.date) errors.date = 'Receipt date is required';
    if (Number.isNaN(Number(receiptForm.amount)) || Number(receiptForm.amount ?? 0) <= 0) errors.amount = 'Enter a valid amount';
    if (receiptForm.method === 'Cheque' && !receiptForm.checkNumber?.trim()) errors.checkNumber = 'Cheque number is required';
    setReceiptErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleReceiptSave = () => {
    if (!validateReceiptForm()) return;
    const event = allEvents.find(ev => ev.id === receiptForm.eventId);
    const amount = Number(receiptForm.amount ?? 0);

    const payload: EventReceipt = {
      id: receiptForm.id || genId('RCPT'),
      eventId: receiptForm.eventId || '',
      eventName: receiptForm.eventName || getEventDisplayName(event),
      invoiceId: receiptForm.invoiceId || '',
      clientName: receiptForm.clientName || getEventClientName(event),
      date: receiptForm.date || new Date().toISOString().split('T')[0],
      amount,
      method: resolveReceiptMethod(receiptForm.method),
      reference: receiptForm.reference || '',
      checkNumber: receiptForm.checkNumber || '',
      recordedBy: receiptForm.recordedBy || 'Events Team',
      notes: receiptForm.notes || '',
      status: 'Posted',
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
          return {
            ...inv,
            balance: newBalance,
            status: deriveInvoiceStatus(inv.status, newBalance, inv.total)
          };
        })
      );
    }

    setEventFolios((prev) => {
      let folio = prev.find((f) => f.eventId === payload.eventId);
      let next = prev;
      if (!folio) {
        const bookedEvent = allEvents.find((ev) => ev.id === payload.eventId);
        if (!bookedEvent) return prev;
        const invoice = eventInvoices.find((inv) => inv.eventId === payload.eventId);
        const openingEntries: EventFolioEntry[] = invoice && invoice.total > 0
          ? [{
              id: genId('FLE'),
              date: invoice.issueDate || new Date().toISOString().split('T')[0],
              description: 'Invoice',
              debit: invoice.total,
              credit: 0,
              balance: invoice.total,
              reference: invoice.id
            }]
          : [];
        folio = {
          id: genId('FOL'),
          eventId: bookedEvent.id,
          eventName: bookedEvent.eventName || 'Unnamed Event',
          clientName: bookedEvent.organization || 'Unknown Client',
          status: 'Open',
          openingBalance: 0,
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          entries: openingEntries
        };
        next = [folio, ...prev];
      }
      if (folio.entries.some((entry) => entry.reference === payload.id)) return next;
      const lastBalance = getFolioCurrentBalance(folio);
      const paymentEntry: EventFolioEntry = {
        id: genId('FLE'),
        date: payload.date || new Date().toISOString().split('T')[0],
        description: payload.method
          ? `Payment · ${paymentMethodLabel(resolveReceiptMethod(payload.method))}`
          : 'Payment',
        debit: 0,
        credit: amount,
        balance: lastBalance - amount,
        reference: payload.id
      };
      return next.map((f) =>
        f.id === folio!.id
          ? withFolioStatus({ ...f, entries: [...f.entries, paymentEntry], updatedAt: new Date().toISOString() })
          : f
      );
    });

    // Post payment to accounting (idempotent by receipt id)
    const linkedInvoiceForAccounting = payload.invoiceId
      ? eventInvoices.find((inv) => inv.id === payload.invoiceId)
      : undefined;
    captureEventReceiptToAccounting(payload, linkedInvoiceForAccounting);

    // Navigate to the Receipts tab in Event Management if creating a new receipt
    if (isNewReceipt) {
      try {
        setSelectedTab('confirmed');
        setManagementMainTab('receipts');
      } catch (error) {
        console.error('Error navigating to receipts tab after receipt creation:', error);
      }
    }

    const shouldPrint = isNewReceipt && receiptPrintAfterSave;
    closeReceiptWorkspace();
    if (shouldPrint) {
      handleDownloadReceiptPdf(payload);
    }
  };

  const openFolioDetails = (folio: EventFolio) => {
    setActiveFolio(folio);
    setFolioEntryForm({ type: 'charge', amount: 0, description: '', reference: '', costCenter: '', revenueCenter: '', method: 'Cash', recordedBy: 'Events Team' });
    setFolioEntrySearch('');
    setFolioComposerOpen(false);
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
  const sortedFolioEntries = useMemo(() => {
    const lines = [...filteredFolioEntries];
    if (activeFolio && activeFolio.openingBalance !== 0 && !folioEntrySearch.trim()) {
      lines.unshift({
        id: '__opening',
        date: activeFolio.createdAt,
        description: 'Opening balance',
        debit: activeFolio.openingBalance > 0 ? activeFolio.openingBalance : 0,
        credit: activeFolio.openingBalance < 0 ? Math.abs(activeFolio.openingBalance) : 0,
        balance: activeFolio.openingBalance,
        reference: '',
      });
    }
    const value = (entry: EventFolioEntry, key: FolioAccountCol): string | number | null => {
      if (key === 'date') return entry.date || '';
      if (key === 'description') return entry.description || '';
      if (key === 'reference') return entry.reference || '';
      if (key === 'charge') return entry.debit > 0 ? entry.debit : null;
      if (key === 'payment') return entry.credit > 0 ? entry.credit : null;
      if (key === 'balance') return entry.balance;
      return null;
    };
    return lines.sort((a, b) => compareFolioValues(value(a, folioSortKey), value(b, folioSortKey), folioSortDir));
  }, [filteredFolioEntries, activeFolio, folioEntrySearch, folioSortKey, folioSortDir]);
  const folioPageCount = Math.max(1, Math.ceil(sortedFolioEntries.length / FOLIO_PAGE_SIZE));
  const folioSafePage = Math.min(folioPage, folioPageCount);
  const folioPageRows = sortedFolioEntries.slice((folioSafePage - 1) * FOLIO_PAGE_SIZE, folioSafePage * FOLIO_PAGE_SIZE);
  const sortFolioAccount = (key: FolioAccountCol) => {
    setFolioPage(1);
    setFolioSortDir((dir) => (folioSortKey === key ? (dir === 'asc' ? 'desc' : 'asc') : (key === 'date' ? 'desc' : 'asc')));
    setFolioSortKey(key);
  };

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

    const entryType = folioEntryForm.type;
    const entryReference = folioEntryForm.reference || '';
    const entryMethod = folioEntryForm.method || 'Cash';
    const entryRecordedBy = folioEntryForm.recordedBy || 'Events Team';
    const entryCostCenter = folioEntryForm.costCenter;
    const entryRevenueCenter = folioEntryForm.revenueCenter;
    const entryDescription = folioEntryForm.description.trim();

    const lastBalance = getFolioCurrentBalance(activeFolio);
    const debit = entryType === 'charge' ? amount : 0;
    const credit = entryType === 'payment' ? amount : 0;
    const newBalance = lastBalance + debit - credit;
    const paymentReceiptId = entryType === 'payment' ? genId('RCPT') : '';

    const newEntry: EventFolioEntry = {
      id: genId('FLE'),
      date: new Date().toISOString().split('T')[0],
      description: entryDescription,
      debit,
      credit,
      balance: newBalance,
      reference: entryType === 'payment' ? paymentReceiptId : entryReference,
      costCenter: entryType === 'charge' ? entryCostCenter : undefined,
      revenueCenter: entryType === 'payment' ? entryRevenueCenter : undefined
    };

    console.log('[Folio] Adding entry:', {
      folioId: activeFolio.id,
      entryType,
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
    
    // ===== ACCOUNTING INTEGRATION =====
    const staffInfo = {
      staffId: entryRecordedBy || 'events-team',
      staffName: entryRecordedBy || 'Events Team',
      staffRole: 'Events Coordinator',
    };
    
    if (entryType === 'charge') {
      const linkedEventsInvoice =
        entryReference
          ? eventInvoices.find((inv) => inv.id === entryReference)
          : eventInvoices.find((inv) => inv.eventId === activeFolio.eventId);
      const invoiceAlreadyInAccounting =
        linkedEventsInvoice &&
        (isConferenceAccountingCaptured(linkedEventsInvoice.id) ||
          isConferenceAccountingCaptured(`EVT-${activeFolio.eventId}`));
      const isInvoiceLineEntry =
        newEntry.description.includes('Invoice ') ||
        Boolean(linkedEventsInvoice && entryReference === linkedEventsInvoice.id);

      if (invoiceAlreadyInAccounting && isInvoiceLineEntry) {
        console.log('[Folio] Skipping duplicate revenue capture — invoice already posted to accounting');
      } else {
        try {
          const result = captureRevenue({
            id: newEntry.id,
            source: 'conference',
            customerId: activeFolio.clientId || activeFolio.eventId,
            customerName: activeFolio.clientName || activeFolio.eventName || 'Conference Client',
            reference: activeFolio.eventId,
            description: `${activeFolio.eventName || 'Conference'} - ${newEntry.description}`,
            items: [
              {
                description: newEntry.description,
                quantity: 1,
                unitPrice: amount,
                taxPercent: 0,
              },
            ],
            subtotal: amount,
            taxAmount: 0,
            total: amount,
            ...staffInfo,
          });

          if (result) {
            console.log(`[Events] ✅ Revenue captured - Invoice: ${result.invoiceId}, JE: ${result.journalEntryId}`);
          }

          if (entryCostCenter) {
            const { recordExpense } = useAccountingStore.getState();
            recordExpense(entryCostCenter, amount);
            console.log('[Folio] Recorded expense to cost center:', entryCostCenter, formatCurrency(amount));
          }
        } catch (error) {
          console.error('[Events] ❌ Accounting integration error:', error);
        }
      }
    } else if (entryType === 'payment') {
      const linkedInvoice = entryReference
        ? eventInvoices.find((inv) => inv.id === entryReference)
        : eventInvoices.find((inv) => inv.eventId === activeFolio.eventId);
      const receipt: EventReceipt = {
        id: paymentReceiptId,
        eventId: activeFolio.eventId,
        eventName: activeFolio.eventName || 'Event',
        invoiceId: linkedInvoice?.id || '',
        clientName: activeFolio.clientName || 'Client',
        date: newEntry.date,
        amount: credit,
        method: entryMethod as ReceiptMethod,
        reference: entryReference,
        recordedBy: entryRecordedBy,
        notes: newEntry.description,
      };

      captureEventReceiptToAccounting(receipt, linkedInvoice);

      setEventReceipts((prev) => [receipt, ...prev]);

      if (linkedInvoice) {
        setEventInvoices((prev) =>
          prev.map((inv) => {
            if (inv.id !== linkedInvoice.id) return inv;
            const newBalance = Math.max(0, (inv.balance || inv.total || 0) - credit);
            return {
              ...inv,
              balance: newBalance,
              status: deriveInvoiceStatus(inv.status, newBalance, inv.total),
            };
          })
        );
      }

      trackEvent('Events.EventCreated', {
        action: 'receipt_created_from_folio_payment',
        folioId: activeFolio.id,
        receiptId: paymentReceiptId,
        invoiceId: receipt.invoiceId || undefined,
        amount: credit,
      });
    }
    
    trackEvent('Events.EventCreated', { 
      action: 'folio_entry_added', 
      folioId: activeFolio.id,
      entryType,
      amount: amount,
      costCenter: entryCostCenter || undefined,
      revenueCenter: entryRevenueCenter || undefined
    });

    setFolioEntryForm({ type: 'charge', amount: 0, description: '', reference: '', costCenter: '', revenueCenter: '', method: 'Cash', recordedBy: 'Events Team' });
    setFolioComposerOpen(false);
  };
  const getEventsWithoutFolio = () =>
    allEvents.filter((ev) => {
      const status = normalizeStatus(ev.status || ev.eventStatus);
      return status !== 'cancelled' && !eventFolios.some((f) => f.eventId === ev.id);
    });

  const getFolioCandidateEvents = () =>
    allEvents.filter((ev) => normalizeStatus(ev.status || ev.eventStatus) !== 'cancelled');

  const getFolioEventLabel = (ev: any) => {
    const existing = eventFolios.find((f) => f.eventId === ev.id);
    const invoice = eventInvoices.find((inv) => inv.eventId === ev.id);
    const name = getEventDisplayName(ev);
    const client = getEventClientName(ev);
    if (existing) return `${name} · ${client} · Has folio ${existing.id}`;
    const extra = invoice
      ? `${invoice.id} · ${formatCurrency(Number(invoice.balance || 0))} due`
      : 'No invoice yet';
    return `${name} · ${client} · ${extra}`;
  };

  const openCreateFolioPicker = () => {
    const eligible = getEventsWithoutFolio();
    const candidates = getFolioCandidateEvents();
    setFolioCreateError('');
    if (eligible.length === 1) {
      setFolioCreateForm({ eventId: eligible[0].id, openingBalance: 0, note: '' });
    } else if (eligible.length === 0 && candidates.length === 1) {
      setFolioCreateForm({ eventId: candidates[0].id, openingBalance: 0, note: '' });
    } else {
      setFolioCreateForm({ eventId: '', openingBalance: 0, note: '' });
    }
    setIsFolioCreateModalOpen(true);
  };

  const handleCreateFolio = () => {
    if (!folioCreateForm.eventId) {
      setFolioCreateError('Select the event this folio belongs to.');
      return;
    }
    const existingFolio = eventFolios.find((f) => f.eventId === folioCreateForm.eventId);
    if (existingFolio) {
      setIsFolioCreateModalOpen(false);
      setFolioCreateForm({ eventId: '', openingBalance: 0, note: '' });
      setFolioCreateError('');
      openFolioDetails(existingFolio);
      return;
    }
    const event = allEvents.find(ev => ev.id === folioCreateForm.eventId);
    if (!event) {
      setFolioCreateError('Selected event could not be found.');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const invoice = eventInvoices.find((inv) => inv.eventId === event.id);
    const relatedReceipts = eventReceipts.filter((rcpt) => rcpt.eventId === event.id);
    const initialEntries: EventFolioEntry[] = [];
    if (invoice && Number(invoice.total || 0) > 0) {
      initialEntries.push({
        id: genId('FLE'),
        date: invoice.issueDate || today,
        description: 'Invoice',
        debit: Number(invoice.total || 0),
        credit: 0,
        balance: Number(invoice.total || 0),
        reference: invoice.id,
      });
    }
    relatedReceipts.forEach((receipt) => {
      if (initialEntries.some((entry) => entry.reference === receipt.id)) return;
      const lastBalance = initialEntries.length ? initialEntries[initialEntries.length - 1].balance : 0;
      initialEntries.push({
        id: genId('FLE'),
        date: receipt.date || today,
        description: receipt.method
          ? `Payment · ${paymentMethodLabel(resolveReceiptMethod(receipt.method))}`
          : 'Payment',
        debit: 0,
        credit: Number(receipt.amount || 0),
        balance: lastBalance - Number(receipt.amount || 0),
        reference: receipt.id,
      });
    });
    const opening = Number(folioCreateForm.openingBalance || 0);
    if (!invoice && opening) {
      initialEntries.unshift({
        id: genId('FLE'),
        date: today,
        description: folioCreateForm.note?.trim() || 'Opening Balance',
        debit: opening > 0 ? opening : 0,
        credit: opening < 0 ? Math.abs(opening) : 0,
        balance: opening,
      });
    }
    const newFolio: EventFolio = {
      id: genId('FOL'),
      eventId: event.id,
      eventName: getEventDisplayName(event),
      clientName: getEventClientName(event),
      status: 'Open',
      openingBalance: invoice ? Number(invoice.total || 0) : opening,
      entries: initialEntries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEventFolios(prev => [newFolio, ...prev]);
    setIsFolioCreateModalOpen(false);
    setFolioCreateForm({ eventId: '', openingBalance: 0, note: '' });
    setFolioCreateError('');
    openFolioDetails(newFolio);
    trackEvent('Events.EventCreated', { action: 'folio_created', folioId: newFolio.id, eventId: event.id });
  };

  const closeFolioModal = () => {
    setIsFolioModalOpen(false);
    setActiveFolio(null);
    setFolioEntryForm({ type: 'charge', amount: 0, description: '', reference: '', costCenter: '', revenueCenter: '', method: 'Cash', recordedBy: 'Events Team' });
    setFolioEntrySearch('');
    setFolioComposerOpen(false);
  };

  const voidActiveFolio = () => {
    if (!activeFolio || activeFolio.status === 'Void') return;
    setDocCautionPrompt({
      kind: 'void-folio',
      title: 'Void this folio?',
      message: `${formatFolioNumber(activeFolio.id)} will stay on file as Void. No further charges or payments can be posted.`,
      confirmLabel: 'Void folio',
    });
  };

  const unvoidActiveFolio = () => {
    if (!activeFolio || activeFolio.status !== 'Void') return;
    setDocCautionPrompt({
      kind: 'unvoid-folio',
      title: 'Unvoid this folio?',
      message: `${formatFolioNumber(activeFolio.id)} counts again. Charges and payments on it are open.`,
      confirmLabel: 'Unvoid folio',
    });
  };

  const deleteActiveFolio = () => {
    if (!activeFolio) return;
    setDocCautionPrompt({
      kind: 'delete-folio',
      title: 'Delete this folio?',
      message: `${formatFolioNumber(activeFolio.id)} will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete folio',
    });
  };

  const reverseReceiptEffects = (receipt: EventReceipt) => {
    const amount = Number(receipt.amount || 0);
    if (receipt.invoiceId && amount > 0) {
      setEventInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== receipt.invoiceId) return inv;
          const restoredBalance = Math.min(
            Number(inv.total || 0),
            Number(inv.balance || 0) + amount
          );
          return {
            ...inv,
            balance: restoredBalance,
            status: deriveInvoiceStatus(inv.status, restoredBalance, inv.total),
          };
        })
      );
    }
    setEventFolios((prev) =>
      prev.map((folio) => {
        if (folio.eventId !== receipt.eventId) return folio;
        if (!(folio.entries || []).some((entry) => entry.reference === receipt.id)) return folio;
        const without = (folio.entries || []).filter((entry) => entry.reference !== receipt.id);
        let running = folio.openingBalance || 0;
        const recalculated = without.map((entry) => {
          running = running + (entry.debit || 0) - (entry.credit || 0);
          return { ...entry, balance: running };
        });
        return withFolioStatus({
          ...folio,
          entries: recalculated,
          updatedAt: new Date().toISOString(),
        });
      })
    );
  };

  const voidActiveReceipt = () => {
    if (receiptModalMode !== 'edit' || !receiptForm.id) return;
    const existing = eventReceipts.find((rcpt) => rcpt.id === receiptForm.id);
    if (!existing || existing.status === 'Void') return;
    const label = getConferenceReceiptNumber(existing.id, existing.eventId) || existing.id;
    setDocCautionPrompt({
      kind: 'void-receipt',
      title: 'Void this receipt?',
      message: `${label} will stay on file as Void. The payment will be reversed on the invoice and folio.`,
      confirmLabel: 'Void receipt',
    });
  };

  const unvoidActiveReceipt = () => {
    if (receiptModalMode !== 'edit' || !receiptForm.id) return;
    const existing = eventReceipts.find((rcpt) => rcpt.id === receiptForm.id);
    if (!existing || existing.status !== 'Void') return;
    const label = getConferenceReceiptNumber(existing.id, existing.eventId) || existing.id;
    setDocCautionPrompt({
      kind: 'unvoid-receipt',
      title: 'Unvoid this receipt?',
      message: `${label} counts again. The payment goes back on the invoice and folio. Unvoid the invoice first if that bill is still void.`,
      confirmLabel: 'Unvoid receipt',
    });
  };

  const deleteActiveReceipt = () => {
    if (receiptModalMode !== 'edit' || !receiptForm.id) return;
    const existing = eventReceipts.find((rcpt) => rcpt.id === receiptForm.id);
    if (!existing) return;
    const label = getConferenceReceiptNumber(existing.id, existing.eventId) || existing.id;
    setDocCautionPrompt({
      kind: 'delete-receipt',
      title: 'Delete this receipt?',
      message: `${label} will be permanently removed and any payment effect reversed. This cannot be undone.`,
      confirmLabel: 'Delete receipt',
    });
  };

  const confirmDocCaution = () => {
    if (!docCautionPrompt) return;
    const kind = docCautionPrompt.kind;
    setDocCautionPrompt(null);

    if (kind === 'void-folio') {
      if (!activeFolio || activeFolio.status === 'Void') return;
      const updatedAt = new Date().toISOString();
      setEventFolios((prev) =>
        prev.map((folio) =>
          folio.id === activeFolio.id ? { ...folio, status: 'Void', updatedAt } : folio
        )
      );
      setActiveFolio((prev: EventFolio | null) => (prev ? { ...prev, status: 'Void', updatedAt } : prev));
      setFolioComposerOpen(false);
      trackEvent('Events.EventCreated', { action: 'folio_voided', folioId: activeFolio.id });
      return;
    }

    if (kind === 'unvoid-folio') {
      if (!activeFolio || activeFolio.status !== 'Void') return;
      const updatedAt = new Date().toISOString();
      const restored = withFolioStatus({ ...activeFolio, status: 'Open', updatedAt });
      setEventFolios((prev) => prev.map((folio) => (folio.id === activeFolio.id ? restored : folio)));
      setActiveFolio(restored);
      trackEvent('Events.EventCreated', { action: 'folio_unvoided', folioId: activeFolio.id });
      return;
    }

    if (kind === 'delete-folio') {
      if (!activeFolio) return;
      setEventFolios((prev) => prev.filter((folio) => folio.id !== activeFolio.id));
      trackEvent('Events.EventCreated', { action: 'folio_deleted', folioId: activeFolio.id });
      closeFolioModal();
      return;
    }

    if (kind === 'void-receipt') {
      const existing = eventReceipts.find((rcpt) => rcpt.id === receiptForm.id);
      if (!existing || existing.status === 'Void') return;
      reverseReceiptEffects(existing);
      setEventReceipts((prev) =>
        prev.map((rcpt) => (rcpt.id === existing.id ? { ...rcpt, status: 'Void' } : rcpt))
      );
      void voidConferenceReceiptInAccounting(existing.id).catch((error) =>
        console.error('[Events] Could not void the receipt in Accounting', error),
      );
      trackEvent('Events.EventCreated', { action: 'receipt_voided', receiptId: existing.id, eventId: existing.eventId });
      closeReceiptWorkspace();
      return;
    }

    if (kind === 'unvoid-receipt') {
      const existing = eventReceipts.find((rcpt) => rcpt.id === receiptForm.id);
      if (!existing || existing.status !== 'Void') return;
      const amount = Number(existing.amount || 0);
      if (existing.invoiceId && amount > 0) {
        setEventInvoices((prev) =>
          prev.map((inv) => {
            if (inv.id !== existing.invoiceId) return inv;
            const nextBalance = Math.max(0, Number(inv.balance || 0) - amount);
            return { ...inv, balance: nextBalance, status: deriveInvoiceStatus(inv.status, nextBalance, inv.total) };
          }),
        );
      }
      setEventFolios((prev) =>
        prev.map((folio) => {
          if (folio.eventId !== existing.eventId) return folio;
          if ((folio.entries || []).some((entry) => entry.reference === existing.id)) return folio;
          const last = getFolioCurrentBalance(folio);
          const entry = {
            id: genId('FLE'),
            date: existing.date || new Date().toISOString().split('T')[0],
            description: existing.method ? `Payment · ${existing.method}` : 'Payment',
            debit: 0,
            credit: amount,
            balance: last - amount,
            reference: existing.id,
          };
          return withFolioStatus({ ...folio, entries: [...(folio.entries || []), entry], updatedAt: new Date().toISOString() });
        }),
      );
      setEventReceipts((prev) => prev.map((rcpt) => (rcpt.id === existing.id ? { ...rcpt, status: 'Posted' } : rcpt)));
      void unvoidConferenceReceiptInAccounting(existing.id).catch((error) =>
        console.error('[Events] Could not unvoid the receipt in Accounting', error),
      );
      trackEvent('Events.EventCreated', { action: 'receipt_unvoided', receiptId: existing.id, eventId: existing.eventId });
      closeReceiptWorkspace();
      return;
    }

    if (kind === 'delete-receipt') {
      const existing = eventReceipts.find((rcpt) => rcpt.id === receiptForm.id);
      if (!existing) return;
      if (existing.status !== 'Void') {
        reverseReceiptEffects(existing);
      }
      setEventReceipts((prev) => prev.filter((rcpt) => rcpt.id !== existing.id));
      trackEvent('Events.EventCreated', { action: 'receipt_deleted', receiptId: existing.id, eventId: existing.eventId });
      closeReceiptWorkspace();
    }
  };

  const handlePrintEventFolio = () => {
    if (!activeFolio) return;
    const escapeHtml = (value: string) =>
      String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const folioNumber = formatFolioNumber(activeFolio.id);
    const rows = (activeFolio.entries || []).map((entry: EventFolioEntry) => {
      const line = formatFolioEntryCopy(entry);
      return `
      <tr>
        <td>${escapeHtml(entry.date ? new Date(entry.date).toLocaleDateString() : '')}</td>
        <td>${escapeHtml(line.description)}</td>
        <td>${escapeHtml(line.reference)}</td>
        <td class="num">${entry.debit > 0 ? escapeHtml(formatCurrency(entry.debit)) : ''}</td>
        <td class="num">${entry.credit > 0 ? escapeHtml(formatCurrency(entry.credit)) : ''}</td>
        <td class="num">${escapeHtml(formatCurrency(entry.balance))}</td>
      </tr>
    `;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(folioNumber)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 28px; color: #111827; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .meta { color: #6b7280; font-size: 13px; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 6px; text-align: left; }
        th { color: #6b7280; font-weight: 600; }
        .num { text-align: right; white-space: nowrap; }
        .totals { margin-top: 16px; width: 280px; margin-left: auto; font-size: 13px; }
        .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
        .due { font-weight: 700; border-top: 1px solid #111827; padding-top: 8px; margin-top: 6px; }
      </style></head><body>
      <h1>Event Folio ${escapeHtml(folioNumber)}</h1>
      <p class="meta">${escapeHtml(activeFolio.eventName || '')} · ${escapeHtml(activeFolio.clientName || '')} · ${escapeHtml(activeFolio.status || '')}</p>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th>Reference</th><th class="num">Charge</th><th class="num">Payment</th><th class="num">Balance</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">No entries</td></tr>'}</tbody>
      </table>
      <div class="totals">
        <div><span>Charges</span><span>${escapeHtml(formatCurrency(activeFolioTotals.debits))}</span></div>
        <div><span>Payments</span><span>${escapeHtml(formatCurrency(activeFolioTotals.credits))}</span></div>
        <div class="due"><span>${activeFolioBalance >= 0 ? 'Amount due' : 'Credit'}</span><span>${escapeHtml(formatCurrency(Math.abs(activeFolioBalance)))}</span></div>
      </div>
      </body></html>`;
    if (!openHtmlPrintWindow(html)) return;
    trackEvent('Events.EventCreated', { action: 'folio_printed', folioId: activeFolio.id });
  };

  const EVENT_CHARGE_REF = 'event-charge';

  const eventIsInProgress = (event: any) => {
    if (!event) return false;
    if (event.completionStatus === 'completed' || event.completionStatus === 'billed') return false;
    if (event.eventStatus === 'in-progress') return true;
    const start = toStartOfDay(new Date(event.arrivalDate || event.startDate || ''));
    const end = toStartOfDay(new Date(event.departureDate || event.endDate || ''));
    const today = toStartOfDay(new Date());
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && today >= start && today <= end;
  };

  const eventEndsToday = (event: any) => {
    const endValue = event?.departureDate || event?.endDate;
    if (!endValue) return false;
    const end = toStartOfDay(new Date(endValue));
    const today = toStartOfDay(new Date());
    return !Number.isNaN(end.getTime()) && end.getTime() === today.getTime();
  };

  const buildOpeningFolioEntries = (event: any, invoice?: { id?: string; total?: number; issueDate?: string } | null) => {
    if (invoice && Number(invoice.total || 0) > 0) {
      const total = Number(invoice.total);
      return [{
        id: genId('FLE'),
        date: invoice.issueDate || new Date().toISOString().split('T')[0],
        description: 'Invoice',
        debit: total,
        credit: 0,
        balance: total,
        reference: invoice.id,
      }];
    }
    if (!eventIsInProgress(event)) return [];
    const snapshotTotal = Number(getQuoteBudgetSnapshot(event).total || 0);
    const revenue = Number(event?.revenue || 0);
    const total = revenue > 0 ? revenue : (snapshotTotal || Number(event?.budgetTotal || 0));
    if (total <= 0) return [];
    const deposit = Math.min(total, Number(event?.deposit || 0));
    const chargeDate = event?.arrivalDate || event?.startDate || new Date().toISOString().split('T')[0];
    const charge = {
      id: genId('FLE'),
      date: chargeDate,
      description: 'Event charge',
      debit: total,
      credit: 0,
      balance: total,
      reference: EVENT_CHARGE_REF,
    };
    if (deposit <= 0) return [charge];
    return [
      charge,
      {
        id: genId('FLE'),
        date: chargeDate,
        description: 'Deposit',
        debit: 0,
        credit: deposit,
        balance: total - deposit,
        reference: `DEP-${event.id}`,
      },
    ];
  };

  const resolveEventFolioEntries = (event: any): EventFolioEntry[] => {
    if (!event?.id) return [];
    const folio = eventFolios.find((item) => item.eventId === event.id);
    const invoice = eventInvoices.find((item) => item.eventId === event.id);
    const opening = buildOpeningFolioEntries(event, invoice);
    const entries = folio?.entries || [];
    const hasInvoiceEntry = entries.some((entry) =>
      (invoice?.id && entry.reference === invoice.id) || entry.description === 'Invoice'
    );
    const provisional = entries.find((entry) => entry.reference === EVENT_CHARGE_REF);
    const desiredCharge = opening.find((entry) => entry.reference === EVENT_CHARGE_REF);
    const needsCharge = Boolean(folio) && !hasInvoiceEntry && !provisional && opening.length > 0;
    const staleCharge = Boolean(
      folio && !hasInvoiceEntry && provisional && desiredCharge && Number(provisional.debit) !== Number(desiredCharge.debit)
    );
    if (folio && !needsCharge && !staleCharge && entries.length > 0) return entries;
    const kept = staleCharge
      ? entries.filter((entry) => entry.reference !== EVENT_CHARGE_REF && entry.reference !== `DEP-${event.id}`)
      : entries;
    let balance = Number(folio?.openingBalance || 0);
    return [...kept, ...opening].map((entry) => {
      balance += Number(entry.debit || 0) - Number(entry.credit || 0);
      return { ...entry, balance };
    });
  };

  const eventAmountDue = (event: any) => {
    const entries = resolveEventFolioEntries(event);
    if (!entries.length) return 0;
    const invoice = eventInvoices.find((item) => item.eventId === event?.id);
    const hasCredits = entries.some((entry) => Number(entry.credit || 0) > 0);
    if (invoice && !hasCredits) return Number(invoice.balance ?? entries[entries.length - 1].balance);
    return Number(entries[entries.length - 1].balance || 0);
  };

  const eventChargeAmount = (event: any) => {
    const entries = resolveEventFolioEntries(event);
    const charges = entries.reduce((sum, entry) => sum + Number(entry.debit || 0), 0);
    if (charges > 0) return charges;
    const invoice = eventInvoices.find((item) => item.eventId === event?.id);
    if (invoice && Number(invoice.total || 0) > 0) return Number(invoice.total);
    const revenue = Number(event?.revenue || 0);
    if (revenue > 0) return revenue;
    return Number(event?.budgetTotal || 0);
  };

  const folioWithoutProvisionalCharge = (folio: EventFolio): EventFolio => {
    if (!folio.entries?.some((entry) => entry.reference === EVENT_CHARGE_REF)) return folio;
    let balance = folio.openingBalance || 0;
    const entries = folio.entries
      .filter((entry) => entry.reference !== EVENT_CHARGE_REF)
      .map((entry) => {
        balance = balance + Number(entry.debit || 0) - Number(entry.credit || 0);
        return { ...entry, balance };
      });
    return { ...folio, entries };
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
            id: genId('FLE'),
            date: invoice.issueDate || new Date().toISOString().split('T')[0],
            description: 'Invoice',
            debit: invoice.total,
            credit: 0,
            balance: invoice.total,
            reference: invoice.id
          });
        }
      }
      
      folio = {
        id: genId('FOL'),
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

  const getConferenceAccountingInvoiceId = (eventsInvoiceId: string) =>
    `INV-CONFERENCE-${eventsInvoiceId}`;

  const isConferenceAccountingCaptured = (transactionId: string) => {
    const store = useAccountingStore.getState();
    return store.journalEntries.some(
      (je) =>
        je.sourceModule === 'conference' &&
        je.sourceTransactionId === transactionId &&
        je.status === 'Posted'
    );
  };

  const eventHasLiveAccountingInvoice = (eventId?: string) => {
    if (!eventId) return false;
    return useAccountingStore.getState().invoices.some(
      (invoice) =>
        invoice.sourceModule === 'conference' &&
        !invoice.isProforma &&
        invoice.status !== 'Void' &&
        conferenceInvoiceBelongsToEvent(invoice, eventId)
    );
  };

  const allocateUniqueEventInvoiceId = (preferredId: string | undefined, eventId: string) => {
    const storeInvoices = useAccountingStore.getState().invoices;
    const isTaken = (id: string) => {
      if (eventInvoices.some((inv) => inv.id === id && inv.eventId !== eventId)) return true;
      return storeInvoices.some(
        (invoice) =>
          invoice.sourceModule === 'conference' &&
          !invoice.isProforma &&
          invoice.status !== 'Void' &&
          (invoice.id === `INV-CONFERENCE-${id}` || String(invoice.description || '').includes(id)) &&
          !conferenceInvoiceBelongsToEvent(invoice, eventId)
      );
    };
    if (preferredId && !isTaken(preferredId)) return preferredId;
    let next = genId('INV');
    while (isTaken(next)) next = genId('INV');
    return next;
  };

  const captureEventInvoiceToAccounting = (invoice: EventInvoice, event?: any) => {
    if (isConferenceAccountingCaptured(invoice.id)) {
      console.log('[Events] Accounting revenue already captured for invoice', invoice.id);
      return null;
    }
    if (invoice.eventId && isConferenceAccountingCaptured(`EVT-${invoice.eventId}`)) {
      // Revenue was already posted at event-confirm time. That doesn't mean nothing more
      // is owed here: if this invoice's total has since diverged (e.g. a manual edit via
      // the invoice form) from what was actually posted, post the difference as a real
      // adjusting entry instead of silently leaving the GL under/over-stated with no
      // reconciling entry.
      try {
        const store = useAccountingStore.getState();
        const originalEntry = store.journalEntries.find(
          (je) => je.sourceModule === 'conference' && je.sourceTransactionId === `EVT-${invoice.eventId}` && je.status === 'Posted'
        );
        const postedTotal = originalEntry?.totalDebit ?? 0;
        const currentTotal = Number(invoice.total ?? 0);
        const delta = Math.round((currentTotal - postedTotal) * 100) / 100;
        if (Math.abs(delta) >= 0.01) {
          const arCode = '1210';
          const revenueCode = '4320';
          const now = new Date().toISOString();
          const entryId = `JE-EVT-ADJ-${invoice.id}-${Date.now()}`;
          const amount = Math.abs(delta);
          const increase = delta > 0;
          store.addJournalEntry({
            id: entryId,
            entryNumber: `JE-EVTADJ-${invoice.id}`,
            date: invoice.issueDate || now,
            reference: invoice.id,
            description: `Conference invoice adjustment — ${invoice.eventName || invoice.eventId} (${invoice.id}): posted total was ${postedTotal}, invoice now ${currentTotal}`,
            totalDebit: amount,
            totalCredit: amount,
            currency: 'GHS',
            status: 'Posted',
            postedBy: 'Events Team',
            postedAt: now,
            createdAt: now,
            updatedAt: now,
            sourceModule: 'conference',
            sourceTransactionId: `EVTADJ-${invoice.id}`,
            lines: [
              {
                id: `JL-${entryId}-ar`,
                journalEntryId: entryId,
                accountCode: arCode,
                description: 'AR adjustment',
                debit: increase ? amount : 0,
                credit: increase ? 0 : amount,
                currency: 'GHS',
                reference: invoice.id,
              },
              {
                id: `JL-${entryId}-rev`,
                journalEntryId: entryId,
                accountCode: revenueCode,
                description: 'Conference revenue adjustment',
                debit: increase ? 0 : amount,
                credit: increase ? amount : 0,
                currency: 'GHS',
                reference: invoice.id,
              },
            ],
          });
          console.log(`[Events] Posted GL adjustment of ${delta} for invoice ${invoice.id} (event total changed after confirm-time posting)`);
        } else {
          console.log('[Events] Revenue already captured on event confirm and invoice total unchanged; skipping duplicate post for', invoice.eventId);
        }
      } catch (e) {
        console.error('[Events] Failed to post invoice-total adjustment:', e);
      }
      return null;
    }

    try {
      const subtotal = Number(invoice.subtotal ?? invoice.total ?? 0);
      const tax = Number(invoice.tax ?? 0);
      const total = Number(invoice.total ?? subtotal + tax);
      const result = captureRevenue({
        id: invoice.id,
        source: 'conference',
        customerId: event?.clientId || (event as any)?.orgClientId || `client_${invoice.eventId}`,
        customerName: invoice.clientName || getEventClientName(event),
        customerEmail: (event as any)?.contactEmail,
        customerPhone: (event as any)?.contactPhone,
        reference: invoice.eventId,
        description: `Conference Invoice: ${invoice.eventName || 'Event'} (${invoice.id})`,
        items: [
          {
            description: invoice.eventName || 'Event Services',
            quantity: 1,
            unitPrice: subtotal,
            taxPercent: subtotal > 0 ? (tax / subtotal) * 100 : 0,
          },
        ],
        subtotal,
        taxAmount: tax,
        total,
        date: invoice.issueDate,
        staffName: 'Events Team',
        staffRole: 'Events Coordinator',
      }, {
        // Same reasoning as the confirm-time capture: billing an event ahead of
        // its actual date isn't earning the revenue yet. Recognized at
        // markEventAsCompleted() via recognizeDeferredRevenue().
        deferred: true,
      });
      if (result) {
        if (invoice.eventId) markConferenceProformaConverted(invoice.eventId);
        console.log(`[Events] ✅ Invoice synced to accounting (deferred): ${result.invoiceId}`);
      }
      return result;
    } catch (error) {
      console.error('[Events] ❌ Failed to capture invoice to accounting:', error);
      return null;
    }
  };

  const captureEventReceiptToAccounting = (
    receipt: EventReceipt,
    linkedEventsInvoice?: EventInvoice | null
  ) => {
    if (isConferenceAccountingCaptured(receipt.id)) {
      console.log('[Events] Accounting payment already captured for receipt', receipt.id);
      return null;
    }

    const eventsInvoiceId = receipt.invoiceId || linkedEventsInvoice?.id;
    const accountingInvoiceId = eventsInvoiceId
      ? getConferenceAccountingInvoiceId(eventsInvoiceId)
      : undefined;

    try {
      const result = capturePayment(
        {
          id: receipt.id,
          invoiceId: accountingInvoiceId,
          customerId: `client_${receipt.eventId}`,
          customerName: receipt.clientName || 'Conference Client',
          amount: receipt.amount,
          paymentMethod: receipt.method as 'Cash' | 'Card' | 'Mobile Money' | 'Bank Transfer' | 'Cheque',
          reference: receipt.eventId,
          description: `Payment for ${receipt.eventName || 'Conference'} — ${receipt.notes || receipt.id}`,
          date: receipt.date,
          staffName: receipt.recordedBy || 'Events Team',
          staffRole: 'Events Coordinator',
        },
        'conference'
      );
      if (result) {
        console.log(`[Events] ✅ Receipt synced to accounting: ${result.receiptId}`);
      }
      return result;
    } catch (error) {
      console.error('[Events] ❌ Failed to capture receipt to accounting:', error);
      return null;
    }
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
        // Replace the in-progress event charge so the invoice does not sit on top of it
        const folioForInvoice = folioWithoutProvisionalCharge(folio);
        const lastBalance = getFolioCurrentBalance(folioForInvoice);
        const newEntry: EventFolioEntry = {
          id: genId('FLE'),
          date: invoice.issueDate || new Date().toISOString().split('T')[0],
          description: 'Invoice',
          debit: invoice.total,
          credit: 0,
          balance: lastBalance + invoice.total,
          reference: invoice.id
        };

    setEventFolios((prev: EventFolio[]) => {
      const updated = prev.map((f: EventFolio) =>
        f.id === folio.id
          ? { ...folioForInvoice, id: f.id, entries: [...folioForInvoice.entries, newEntry], updatedAt: new Date().toISOString() }
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
  const importInvoiceToFolio = async (folio: EventFolio) => {
    const event = allEvents.find(e => e.id === folio.eventId);
    if (!event) {
      alert('❌ Error: Event not found for this folio.');
      console.error('[Folio] Event not found for folio:', folio.id);
      return;
    }

    const invoice = eventInvoices.find((inv: any) => inv.eventId === folio.eventId);
    if (!invoice) {
      alert('❌ Error: No invoice found for this event. Please create an invoice first.');
      console.error('[Folio] No invoice found for event:', event.id);
      return;
    }

    // Check if invoice already exists in folio entries
    const invoiceExists = folio.entries.some(e => e.reference === invoice.id || e.description.includes(`Invoice ${invoice.id}`));

    try {
      if (invoiceExists) {
        const { confirmChoice } = await import('./DangerConfirm');
        const confirmed = await confirmChoice(
          `Update invoice ${invoice.id}?`,
          `This folio already has that invoice. Update it to ${formatCurrency(invoice.total)}.`,
          'Update',
        );
        if (!confirmed) return;

        // Update existing entry
        const success = syncInvoiceToFolio(invoice, true);
        if (success) {
          alert(`✅ Invoice ${invoice.id} updated successfully in folio!`);
          console.log('[Folio] Invoice updated successfully:', invoice.id);
        } else {
          alert('❌ Failed to update invoice in folio. Please try again.');
        }
        return;
      }

      // Import new invoice
      const success = syncInvoiceToFolio(invoice);
      if (success) {
        const event = allEvents.find((ev) => ev.id === invoice.eventId);
        captureEventInvoiceToAccounting(invoice, event);
        alert(`✅ Invoice ${invoice.id} imported successfully to folio!\n\nAmount: ₵${formatCurrency(invoice.total)}`);
        console.log('[Folio] Invoice imported successfully:', invoice.id);
      } else {
        alert('❌ Failed to import invoice to folio. Please try again.');
      }
    } catch (error) {
      console.error('[Folio] Error importing invoice:', error);
      alert(`❌ Error importing invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      id: genId('FLE'),
      date: new Date().toISOString().split('T')[0],
      description: `Refund - ${refundMethod}`,
      debit: amount, // Refund increases what we owe (debit)
      credit: 0,
      balance: lastBalance + amount, // Moves balance toward zero
      reference: genId('REF')
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
      id: genId('FLE'),
      date: new Date().toISOString().split('T')[0],
      description: `Credit Note - ${reason}`,
      debit: amount, // Credit note reduces overpayment
      credit: 0,
      balance: lastBalance + amount, // Moves balance toward zero
      reference: useSettingsStore.getState().getNextModuleNumber('accounting', 'creditNote'),
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
    alert(`Credit note ${newEntry.reference} of ${formatCurrency(amount)} created successfully.`);
  };

  const createDebitNote = (folio: EventFolio) => {
    const debitNoteAmount = prompt('Enter debit note amount:');
    if (!debitNoteAmount) return;

    const amount = parseFloat(debitNoteAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Invalid debit note amount.');
      return;
    }

    const reason = prompt('Reason for debit note:', 'Additional charge');
    if (!reason) return;

    const lastBalance = getFolioCurrentBalance(folio);
    const newEntry: EventFolioEntry = {
      id: genId('FLE'),
      date: new Date().toISOString().split('T')[0],
      description: `Debit Note - ${reason}`,
      debit: amount,
      credit: 0,
      balance: lastBalance + amount,
      reference: useSettingsStore.getState().getNextModuleNumber('accounting', 'debitNote'),
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

    trackEvent('Events.EventCreated', { action: 'folio_debit_note_created', folioId: folio.id, amount });
    alert(`Debit note ${newEntry.reference} of ${formatCurrency(amount)} created successfully.`);
  };

  const folioLineCopy = (entry: EventFolioEntry, action: 'void' | 'delete') => {
    const reversal = /^\s*(REVERSAL|VOID)\b/i.test(entry.description || '');
    const name = entry.description?.trim() || 'this line';
    const charge = reversal ? (entry.credit || 0) > 0 : (entry.debit || 0) > 0;
    if (reversal && !charge) {
      const message = action === 'delete'
        ? 'This reversal is removed, so the payment counts again. Payments go up and amount due goes down. The receipt in Accounting stays void — record the payment again there if the guest still paid.'
        : 'Voiding this reversal puts the payment back. Payments go up and amount due goes down. The receipt in Accounting counts again if its invoice is still live.';
      return { what: name, message };
    }
    if (reversal) {
      const message = action === 'delete'
        ? 'This reversal is removed, so the charge counts again. Charges and amount due go back up, and Accounting is increased to match. This cannot be undone.'
        : 'Voiding this reversal puts the charge back. Charges and amount due go back up, and Accounting is increased to match.';
      return { what: name, message };
    }
    if (action === 'void') {
      return {
        what: name,
        message: charge
          ? 'Charges and amount due go down by this amount. The line stays on the folio so you can see it was voided. Accounting is reduced by the same amount.'
          : 'Payments go down and amount due goes up by this amount. The line stays on the folio as voided. The receipt in Accounting is reversed.',
      };
    }
    return {
      what: name,
      message: charge
        ? 'This charge is removed. Charges and amount due go down by the same amount, and Accounting is reduced to match. This cannot be undone.'
        : 'This payment is removed. Payments go down and amount due goes up by the same amount, and the receipt in Accounting is reversed. This cannot be undone.',
    };
  };

  const applyEventInvoiceDelta = (eventId: string, reference: string | undefined, delta: number) => {
    const targetId = reference?.replace(/^REV-/, '');
    setEventInvoices((prev) => {
      const hits = prev.filter((inv) => (targetId ? inv.id === targetId : inv.eventId === eventId));
      const pick = targetId ? hits : hits.slice(-1);
      const ids = new Set(pick.map((inv) => inv.id));
      if (!ids.size) return prev;
      return prev.map((inv) => {
        if (!ids.has(inv.id)) return inv;
        const nextTotal = Math.max(0, Math.round((Number(inv.total) + delta) * 100) / 100);
        const nextBalance = Math.round((Number(inv.balance ?? inv.total) + delta) * 100) / 100;
        return {
          ...inv,
          total: nextTotal,
          subtotal: Math.max(0, Math.round((Number(inv.subtotal ?? inv.total) + delta) * 100) / 100),
          balance: nextBalance,
          status: deriveInvoiceStatus(inv.status, nextBalance, nextTotal),
        };
      });
    });
  };

  const syncFolioLineToAccounting = (folio: EventFolio, entry: EventFolioEntry, label: string) => {
    void initializeAccounting()
      .catch(() => {})
      .then(() => {
    const reversal = /^\s*(REVERSAL|VOID)\b/i.test(entry.description || '');
    const magnitude = (entry.debit || 0) > 0 ? entry.debit : entry.credit || 0;
    const chargeEffect = ((entry.debit || 0) > 0 && !reversal) || ((entry.credit || 0) > 0 && reversal);
    if (chargeEffect) {
      const delta = (entry.debit || 0) > 0 ? -magnitude : magnitude;
      adjustConferenceChargeInAccounting(folio.eventId, entry.reference, delta, label);
      applyEventInvoiceDelta(folio.eventId, entry.reference, delta);
      return;
    }
    if (reversal && (entry.debit || 0) > 0) {
      const receiptId = String(entry.reference || '').replace(/^REV-/, '');
      void unvoidConferenceReceiptInAccounting(receiptId).catch((error) =>
        console.error('[Folio] Could not unvoid the receipt in Accounting', error),
      );
      setEventReceipts((prev) => prev.map((item) => (item.id === receiptId && item.status === 'Void' ? { ...item, status: 'Posted' } : item)));
      return;
    }
    if (reversal || !(entry.credit > 0)) return;
    const receiptId = entry.reference;
    void voidConferenceReceiptInAccounting(receiptId).catch((error) =>
      console.error('[Folio] Could not reverse the receipt in Accounting', error),
    );
    const receipt = eventReceipts.find((item) => item.id === receiptId);
    if (!receipt || receipt.status === 'Void') return;
    if (receipt.invoiceId && magnitude > 0) {
      setEventInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== receipt.invoiceId) return inv;
          const restored = Math.min(Number(inv.total || 0), Number(inv.balance || 0) + magnitude);
          return { ...inv, balance: restored, status: deriveInvoiceStatus(inv.status, restored, inv.total) };
        }),
      );
    }
    setEventReceipts((prev) => prev.map((item) => (item.id === receipt.id ? { ...item, status: 'Void' } : item)));
      });
  };

  // Delete folio entry
  const deleteFolioEntry = async (folio: EventFolio, entryId: string) => {
    const entry = folio.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const { confirmDelete } = await import('./DangerConfirm');
    const copy = folioLineCopy(entry, 'delete');
    if (!(await confirmDelete(copy.what, copy.message))) {
      return;
    }
    
    const entryIndex = folio.entries.findIndex(e => e.id === entryId);
    if (entryIndex === -1) return;

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
    
    syncFolioLineToAccounting(folio, entry, `Removed folio line — ${entry.description || entry.id}`);
    console.log('[Folio] Deleted entry:', entryId, entry.description);
    trackEvent('Events.EventCreated', { action: 'folio_entry_deleted', folioId: folio.id, entryId: entryId });
  };

  // Reverse folio entry (create opposite entry)
  const reverseFolioEntry = async (folio: EventFolio, entry: EventFolioEntry) => {
    const { confirmVoid } = await import('./DangerConfirm');
    const copy = folioLineCopy(entry, 'void');
    if (!(await confirmVoid(copy.what, copy.message))) {
      return;
    }
    
    const lastBalance = getFolioCurrentBalance(folio);
    const reversalAmount = entry.debit > 0 ? entry.debit : entry.credit;
    
    const newEntry: EventFolioEntry = {
      id: genId('FLE'),
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
    
    syncFolioLineToAccounting(folio, entry, `Void folio line — ${entry.description || entry.id}`);
    console.log('[Folio] Created reversal entry:', entry.id, formatCurrency(reversalAmount));
    trackEvent('Events.EventCreated', { action: 'folio_entry_reversed', folioId: folio.id, entryId: entry.id });
  };

  // Import receipts to folio
  const importReceiptsToFolio = (folio: EventFolio) => {
    const event = allEvents.find(e => e.id === folio.eventId);
    if (!event) {
      alert('❌ Error: Event not found for this folio.');
      console.error('[Folio] Event not found for folio:', folio.id);
      return;
    }

    const receipts = eventReceipts.filter((rec: any) => rec.eventId === folio.eventId);
    if (receipts.length === 0) {
      alert('ℹ️ No receipts found for this event. Create some receipts first.');
      console.log('[Folio] No receipts found for event:', event.id);
      return;
    }

    // Filter out receipts that already exist in folio
    const existingReferences = folio.entries.map(e => e.reference).filter(Boolean);
    const newReceipts = receipts.filter((rec: any) => !existingReferences.includes(rec.id));

    if (newReceipts.length === 0) {
      alert(`ℹ️ All ${receipts.length} receipts have already been imported to this folio.`);
      console.log('[Folio] All receipts already imported for event:', event.id);
      return;
    }

    try {
      let currentBalance = getFolioCurrentBalance(folio);
      const newEntries: EventFolioEntry[] = newReceipts.map((receipt: any) => {
        currentBalance = currentBalance - receipt.amount; // Payments reduce balance
        return {
          id: genId('FLE'),
          date: receipt.date || new Date().toISOString().split('T')[0],
          description: receipt.method
            ? `Payment · ${paymentMethodLabel(resolveReceiptMethod(receipt.method))}`
            : 'Payment',
          debit: 0,
          credit: receipt.amount,
          balance: currentBalance,
          reference: receipt.id,
          revenueCenter: 'CF' // Conference/Event revenue center
        };
      });

      // Update folios state
      setEventFolios(prev =>
        prev.map(f =>
          f.id === folio.id
            ? { ...f, entries: [...f.entries, ...newEntries], updatedAt: new Date().toISOString() }
            : f
        )
      );

      // Update active folio if it's the current one
      setActiveFolio((prev: any) =>
        prev && prev.id === folio.id
          ? { ...prev, entries: [...prev.entries, ...newEntries], updatedAt: new Date().toISOString() }
          : prev
      );

      const totalAmount = newReceipts.reduce((sum, r) => sum + r.amount, 0);

      newReceipts.forEach((receipt: EventReceipt) => {
        const linkedInvoice = receipt.invoiceId
          ? eventInvoices.find((inv) => inv.id === receipt.invoiceId)
          : undefined;
        captureEventReceiptToAccounting(receipt, linkedInvoice);
      });

      alert(`✅ Successfully imported ${newReceipts.length} receipt(s)!\n\nTotal Amount: ₵${formatCurrency(totalAmount)}\nNew Balance: ₵${formatCurrency(currentBalance)}`);

      console.log('[Folio] Imported receipts successfully:', newReceipts.length, formatCurrency(totalAmount));
      trackEvent('Events.EventCreated', { action: 'folio_receipts_imported', folioId: folio.id, receiptCount: newReceipts.length });

    } catch (error) {
      console.error('[Folio] Error importing receipts:', error);
      alert(`❌ Error importing receipts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      printFunctionScheduleFromEvents(allEvents, 'All Events', 'function_schedule_printed');
    } catch (error) {
      console.error('Error printing function schedule:', error);
      alert('Failed to open print preview. Please try again.');
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
      case 'inactive': return 'default';
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
  // Operational lists are booked events only — not the old hardcoded sample rows.
  const allEvents = useMemo(
    () => customEvents.filter((event) => event?.id && !isHardcodedDemoEventId(event.id)),
    [customEvents]
  );

  const filteredModernVenues = useMemo(() => {
    let list = modernVenues;

    if (venueSearchTerm.trim()) {
      const term = venueSearchTerm.trim().toLowerCase();
      list = list.filter(
        venue =>
          venue.name.toLowerCase().includes(term) ||
          (venue.location || '').toLowerCase().includes(term) ||
          venue.type.toLowerCase().includes(term)
      );
    }

    if (venueStatusFilter !== 'all') {
      list = list.filter(venue => venue.status === venueStatusFilter);
    }

    return list;
  }, [
    modernVenues,
    venueSearchTerm,
    venueStatusFilter,
  ]);

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
    () => eventReceipts.reduce((sum, receipt) => sum + (receipt.status === 'Void' ? 0 : (receipt.amount || 0)), 0),
    [eventReceipts]
  );
  const openFolioCount = useMemo(
    () => eventFolios.filter(folio => getFolioSettledStatus(folio) === 'Open').length,
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
      } else if (completionStatus === 'billed') {
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
      const resolvedVenue = findVenueInCatalog(
        modernVenues,
        event.venueKey || event.venue,
        event.venueName
      );
      return {
        ...event,
        venue: resolvedVenue?.id || event.venueKey || event.venue || '',
        venueKey: resolvedVenue?.id || event.venueKey || event.venue || '',
        venueName: resolvedVenue?.name || (isUnassignedVenueLabel(event.venueName) ? '' : (event.venueName || '')),
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
    [eventInvoices, modernVenues]
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
  const goToGuestRates = useCallback(() => setSelectedTab('quoting'), [setSelectedTab]);
  const goToReports = useCallback(() => router.push('/events/reports'), [router]);

  const selectedCategoryInsights = useMemo<ReportInsight[]>(() => {
    if (!selectedReportCategory) return [];
    const activeOpportunities = reportingStatusBuckets.quote + reportingStatusBuckets.confirmed + reportingStatusBuckets.invoiced;
    const conversionRate =
      reportingStatusBuckets.total > 0
        ? Math.round(((reportingStatusBuckets.confirmed + reportingStatusBuckets.invoiced) / reportingStatusBuckets.total) * 100)
        : 0;
    switch (selectedReportCategory.key) {
      case 'events-pipeline':
        return [
          {
            label: 'Active Opportunities',
            value: activeOpportunities.toLocaleString(),
            helper: `${reportingStatusBuckets.quote.toLocaleString()} quotes • ${reportingStatusBuckets.confirmed.toLocaleString()} confirmed`,
          },
          {
            label: 'Conversion Rate',
            value: `${conversionRate}%`,
            helper: `${(reportingStatusBuckets.confirmed + reportingStatusBuckets.invoiced).toLocaleString()} wins`,
          },
          {
            label: 'Pipeline Value',
            value: formatCurrency(reportingPipelineAmounts.total),
            helper: `${formatCurrency(reportingPipelineAmounts.confirmed)} confirmed`,
          },
        ];
      case 'venues-operations':
        return [
          {
            label: 'Venues',
            value: totalVenues.toLocaleString(),
            helper: `${availableVenues} available • ${bookedVenues} booked`,
          },
          {
            label: 'Utilisation',
            value: `${venueUtilizationRate}%`,
            helper: `${setupInProgress} in setup`,
          },
          {
            label: 'BEO Saved',
            value: reportingEvents.length > 0 ? `${reportingEventsWithBEO}/${reportingEvents.length}` : '0',
            helper: `${reportingEventsNeedingBEO} pending`,
          },
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
    reportingEvents.length,
    reportingEventsWithBEO,
    reportingEventsNeedingBEO,
    invoiceSummary.balance,
    outstandingInvoiceCount,
    receiptsTotal,
    openFolioCount,
    folioBalanceTotal,
    unbilledEventsCount,
    eventReceipts.length,
  ]);

  const selectedCategoryLinks = useMemo<ReportQuickLink[]>(() => {
    if (!selectedReportCategory) return [];
    switch (selectedReportCategory.key) {
      case 'events-pipeline':
        return [
          { label: 'Event Master', icon: '📋', action: () => goToEventManagement('events') },
          { label: 'Quotes', icon: '📑', action: () => goToEventManagement('quotes') },
        ];
      case 'venues-operations':
        return [
          { label: 'Venues', icon: '🏢', action: goToVenueManagement },
          { label: 'Active Events', icon: '🟢', action: () => goToEventManagement('active') },
        ];
      case 'finance-billing':
        return [
          { label: 'Invoices', icon: '🧾', action: () => goToEventManagement('invoices') },
          { label: 'Receipts', icon: '💳', action: () => goToEventManagement('receipts') },
          { label: 'Folios', icon: '📂', action: () => goToEventManagement('folios') },
        ];
      default:
        return [];
    }
  }, [selectedReportCategory, goToEventManagement, goToVenueManagement]);

  const activeReportTable = useMemo<ReportTableData>(() => {
    if (!selectedReport) {
      return { columns: [], rows: [], emptyMessage: 'Select a report from the list.' };
    }

    const filteredEvents = filterEventsForReport(reportingEvents, reportFilters);
    const venueTerm = reportFilters.venue.trim().toLowerCase();
    const filteredVenues = venueTerm
      ? modernVenues.filter(
          (venue) =>
            venue.name.toLowerCase().includes(venueTerm) ||
            (venue.location || '').toLowerCase().includes(venueTerm)
        )
      : modernVenues;

    const getInvoiceTotalForEvent = (eventId: string) =>
      eventInvoices
        .filter((inv) => inv.eventId === eventId)
        .reduce((sum, inv) => sum + (inv.total || 0), 0);

    switch (selectedReport.key) {
      case 'pipeline-summary': {
        const statuses: SimpleEventStatus[] = ['quote', 'confirmed', 'invoiced', 'cancelled'];
        return {
          columns: [
            { key: 'status', label: 'Status' },
            { key: 'count', label: 'Events' },
            { key: 'value', label: 'Value (₵)' },
          ],
          rows: statuses.map((status) => ({
            status: eventStatusLabelMap[status],
            count: String(
              filteredEvents.filter((event) => normalizeStatus(event.status || event.eventStatus) === status).length
            ),
            value: formatCurrency(
              filteredEvents
                .filter((event) => normalizeStatus(event.status || event.eventStatus) === status)
                .reduce((sum, event) => sum + (Number(event.revenue || event.budgetTotal || 0) || 0), 0)
            ),
          })),
        };
      }
      case 'open-quotes':
        return {
          columns: [
            { key: 'event', label: 'Event' },
            { key: 'client', label: 'Client' },
            { key: 'dates', label: 'Dates' },
            { key: 'pax', label: 'Pax' },
            { key: 'value', label: 'Quoted (₵)' },
          ],
          rows: filteredEvents
            .filter((event) => normalizeStatus(event.status || event.eventStatus) === 'quote')
            .map((event) => ({
              event: event.eventName || 'Unnamed',
              client: event.organization || '—',
              dates: `${event.arrivalDate || event.startDate || '—'} → ${event.departureDate || event.endDate || '—'}`,
              pax: String(event.pax || event.expectedPax || 0),
              value: formatCurrency(Number(event.revenue || event.budgetTotal || 0)),
            })),
          emptyMessage: 'No quote-stage events in this period.',
        };
      case 'confirmed-events':
        return {
          columns: [
            { key: 'event', label: 'Event' },
            { key: 'venue', label: 'Venue' },
            { key: 'coordinator', label: 'Coordinator' },
            { key: 'dates', label: 'Dates' },
            { key: 'pax', label: 'Pax' },
          ],
          rows: filteredEvents
            .filter((event) => {
              const status = normalizeStatus(event.status || event.eventStatus);
              return status === 'confirmed' || event.eventStatus === 'in-progress';
            })
            .map((event) => ({
              event: event.eventName || 'Unnamed',
              venue: event.venueName || event.venue || '—',
              coordinator: resolveEventCoordinator(event),
              dates: `${event.arrivalDate || event.startDate || '—'} → ${event.departureDate || event.endDate || '—'}`,
              pax: String(event.pax || event.expectedPax || 0),
            })),
          emptyMessage: 'No confirmed events in this period.',
        };
      case 'venue-status':
        return {
          columns: [
            { key: 'venue', label: 'Venue' },
            { key: 'type', label: 'Type' },
            { key: 'capacity', label: 'Capacity' },
            { key: 'status', label: 'Status' },
          ],
          rows: filteredVenues.map((venue) => ({
            venue: venue.name,
            type: venue.type,
            capacity: String(venue.capacity),
            status: venue.status,
          })),
          emptyMessage: 'No venues match this filter.',
        };
      case 'beo-readiness':
        return {
          columns: [
            { key: 'event', label: 'Event' },
            { key: 'venue', label: 'Venue' },
            { key: 'coordinator', label: 'Coordinator' },
            { key: 'beo', label: 'BEO' },
            { key: 'dates', label: 'Dates' },
          ],
          rows: filteredEvents
            .filter((event) => {
              const status = normalizeStatus(event.status || event.eventStatus);
              return status === 'confirmed' || event.eventStatus === 'in-progress';
            })
            .map((event) => ({
              event: event.eventName || 'Unnamed',
              venue: event.venueName || '—',
              coordinator: resolveEventCoordinator(event),
              beo: event.linkedBEO ? 'Saved' : 'Pending',
              dates: `${event.arrivalDate || event.startDate || '—'} → ${event.departureDate || event.endDate || '—'}`,
            })),
          emptyMessage: 'No confirmed events in this period.',
        };
      case 'invoice-aging':
        return {
          columns: [
            { key: 'invoice', label: 'Invoice' },
            { key: 'event', label: 'Event' },
            { key: 'issueDate', label: 'Issue Date' },
            { key: 'total', label: 'Total (₵)' },
            { key: 'balance', label: 'Balance (₵)' },
            { key: 'status', label: 'Status' },
          ],
          rows: eventInvoices
            .filter((inv) => matchesReportDate(inv.issueDate, reportFilters))
            .map((inv) => ({
              invoice: inv.id,
              event: inv.eventName || '—',
              issueDate: inv.issueDate || '—',
              total: formatCurrency(inv.total || 0),
              balance: formatCurrency(inv.balance || 0),
              status: inv.status || '—',
            })),
          emptyMessage: 'No invoices in this period.',
        };
      case 'receipts-register':
        return {
          columns: [
            { key: 'receipt', label: 'Receipt' },
            { key: 'event', label: 'Event' },
            { key: 'date', label: 'Date' },
            { key: 'amount', label: 'Amount (₵)' },
            { key: 'method', label: 'Method' },
          ],
          rows: eventReceipts
            .filter((rcpt) => matchesReportDate(rcpt.date, reportFilters))
            .map((rcpt) => ({
              receipt: rcpt.id,
              event: rcpt.eventName || '—',
              date: rcpt.date || '—',
              amount: formatCurrency(rcpt.amount || 0),
              method: rcpt.method || '—',
            })),
          emptyMessage: 'No receipts in this period.',
        };
      case 'folio-balances':
        return {
          columns: [
            { key: 'folio', label: 'Folio' },
            { key: 'event', label: 'Event' },
            { key: 'status', label: 'Status' },
            { key: 'balance', label: 'Balance (₵)' },
          ],
          rows: eventFolios
            .filter((folio) => matchesReportDate(folio.updatedAt, reportFilters))
            .map((folio) => ({
              folio: folio.id,
              event: folio.eventName || '—',
              status: folio.status || '—',
              balance: formatCurrency(getFolioCurrentBalance(folio)),
            })),
          emptyMessage: 'No folios in this period.',
        };
      case 'budget-variance':
        return {
          columns: [
            { key: 'event', label: 'Event' },
            { key: 'budget', label: 'Budget (₵)' },
            { key: 'invoiced', label: 'Invoiced (₵)' },
            { key: 'variance', label: 'Variance (₵)' },
          ],
          rows: filteredEvents.map((event) => {
            const budget = Number(event.budgetTotal || event.revenue || 0);
            const invoiced = getInvoiceTotalForEvent(event.id);
            const variance = invoiced - budget;
            return {
              event: event.eventName || 'Unnamed',
              budget: formatCurrency(budget),
              invoiced: formatCurrency(invoiced),
              variance: formatCurrency(variance),
            };
          }),
          emptyMessage: 'No events in this period.',
        };
      default:
        return { columns: [], rows: [], emptyMessage: 'Report not available.' };
    }
  }, [
    selectedReport,
    reportingEvents,
    reportFilters,
    modernVenues,
    eventInvoices,
    eventReceipts,
    eventFolios,
    eventStatusLabelMap,
  ]);

  const exportActiveReportPdf = useCallback(() => {
    if (!selectedReport || activeReportTable.columns.length === 0) return;

    const escapeHtml = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const headerCells = activeReportTable.columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('');
    const bodyRows =
      activeReportTable.rows.length > 0
        ? activeReportTable.rows
            .map(
              (row) =>
                `<tr>${activeReportTable.columns
                  .map((col) => `<td>${escapeHtml(String(row[col.key] ?? ''))}</td>`)
                  .join('')}</tr>`
            )
            .join('')
        : `<tr><td colspan="${activeReportTable.columns.length}">${escapeHtml(activeReportTable.emptyMessage || 'No data')}</td></tr>`;

    const periodLabel =
      reportFilters.fromDate && reportFilters.toDate
        ? `${reportFilters.fromDate} → ${reportFilters.toDate}`
        : 'All dates';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(selectedReport.label)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        p { color: #6b7280; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
        th { background: #f9fafb; }
      </style></head><body>
      <h1>${escapeHtml(selectedReport.label)}</h1>
      <p>${escapeHtml(selectedReport.description)}</p>
      <p>Period: ${escapeHtml(periodLabel)}${reportFilters.venue ? ` • Venue filter: ${escapeHtml(reportFilters.venue)}` : ''}</p>
      <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
      </body></html>`;

    if (!openHtmlPrintWindow(html)) return;
    trackEvent('Analytics.Exported', {
      scope: 'events',
      reportKey: selectedReport.key,
      filters: reportFilters,
    });
  }, [selectedReport, activeReportTable, reportFilters]);

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

  const cancelMissedEvent = async (event: any): Promise<boolean> => {
    if (!event?.id) return false;
    const { confirmChoice } = await import('./DangerConfirm');
    const ok = await confirmChoice(
      'Cancel this booking?',
      'The booking is marked Cancelled and shows under Cancelled on Event Master. A deposit or invoice already posted stays until you void or credit it.',
      'Cancel booking',
    );
    if (!ok) return false;
    const updated = { ...event, status: 'cancelled' };
    setCustomEvents((prev) => prev.map((item) => (item.id === event.id ? { ...item, status: 'cancelled' } : item)));
    persistEventBookingPatch(updated, { status: 'cancelled' });
    trackEvent('Events.EventStatusUpdated', { eventId: event.id, newStatus: 'cancelled', action: 'no_show_cancelled' });
    return true;
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
  const markEventAsCompleted = async (event: any): Promise<boolean> => {
    const today = new Date().toISOString().split('T')[0];
    const eventEndDate = event.departureDate || event.endDate || today;
    const isEndingEarly = eventEndDate > today;

    const { confirmChoice } = await import('./DangerConfirm');
    if (await confirmChoice(
      isEndingEarly ? 'End this event now?' : 'End this event?',
      isEndingEarly
        ? `It was scheduled to end on ${new Date(eventEndDate).toLocaleDateString()}. Ending it today moves it to completed events.`
        : 'This finalizes the event and moves it to completed events.',
      'End event',
    )) {
      // Update the event with completion status and set end date to today if ending early
      const updatedEvent = {
        ...event,
        // Keep business status as-is; use completionStatus + managedEvents to derive lifecycle status
        completionStatus: 'completed' as const,
        // If ending early, update the departure/end date to today
        ...(isEndingEarly ? {
          departureDate: today,
          endDate: today,
          scheduledDepartureDate: event.departureDate || event.endDate,
          scheduledEndDate: event.endDate || event.departureDate,
          // Recalculate duration based on actual dates
          duration: Math.max(1, Math.ceil((new Date(today).getTime() - new Date(event.arrivalDate || event.startDate || today).getTime()) / (1000 * 60 * 60 * 24)) + 1)
        } : {})
      };
      
      // This will trigger allEvents to recompute, which will then trigger managedEvents to recompute
      setCustomEvents(prev => prev.map(ev =>
        ev.id === event.id ? updatedEvent : ev
      ));
      persistEventBookingPatch(updatedEvent, {
        completionStatus: 'completed',
        ...(isEndingEarly ? {
          scheduledDepartureDate: event.departureDate || event.endDate,
          scheduledEndDate: event.endDate || event.departureDate,
        } : {}),
      });

      // The event is actually delivered now — reclassify whatever confirm-time
      // revenue was held as Deferred Revenue into real, recognized revenue.
      // No-ops cleanly if this event was never confirmed (nothing was deferred)
      // or was already recognized (re-completing an already-completed event).
      try {
        const recognized = recognizeDeferredRevenue('conference', event.id, `${updatedEvent.eventName || event.eventName || 'Event'} — delivered`);
        if (recognized) {
          console.log(`[Events] ✅ Deferred revenue recognized — JE(s): ${recognized.journalEntryIds.join(', ')}`);
        }
      } catch (e) {
        console.warn('[Events] Deferred revenue recognition failed', e);
      }

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
            id: genId('FLE'),
            date: invoice.issueDate || new Date().toISOString().split('T')[0],
            description: 'Invoice',
            debit: invoice.total,
            credit: 0,
            balance: invoice.total
          });
        }
        
        const newFolio: EventFolio = withFolioStatus({
          id: genId('FOL'),
          eventId: updatedEvent.id,
          eventName: updatedEvent.eventName || 'Unnamed Event',
          clientName: updatedEvent.organization || 'Unknown Client',
          status: 'Open',
          openingBalance: 0,
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          entries: entries
        });
        
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

  const reopenEndedEvent = async (event: any): Promise<boolean> => {
    if (event.completionStatus !== 'completed') return false;
    const { confirmChoice } = await import('./DangerConfirm');
    const putBack = await confirmChoice(
      'Put this event back?',
      'It leaves the completed list. Any money End counted as earned goes back to not yet earned.',
      'Reopen',
    );
    if (!putBack) return false;

    await initializeAccounting().catch(() => {});
    try {
      reverseRecognizedRevenue('conference', event.id);
    } catch (error) {
      console.warn('[Events] Could not reverse the earned revenue', error);
    }

    const scheduledDeparture = event.scheduledDepartureDate || '';
    const scheduledEnd = event.scheduledEndDate || scheduledDeparture;
    const restoreDates = Boolean(scheduledDeparture || scheduledEnd);
    const arrival = event.arrivalDate || event.startDate || scheduledDeparture;
    const departure = scheduledEnd || scheduledDeparture;
    const restoredDuration = restoreDates
      ? Math.max(1, Math.ceil((new Date(departure).getTime() - new Date(arrival).getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : event.duration;
    const updatedEvent = {
      ...event,
      completionStatus: undefined,
      status: event.status === 'completed' ? 'confirmed' : event.status,
      scheduledDepartureDate: undefined,
      scheduledEndDate: undefined,
      ...(restoreDates ? { departureDate: departure, endDate: departure, duration: restoredDuration } : {}),
    };
    setCustomEvents((prev) => prev.map((item) => (item.id === event.id ? updatedEvent : item)));
    persistEventBookingPatch(updatedEvent, {
      completionStatus: '',
      scheduledDepartureDate: '',
      scheduledEndDate: '',
    });
    trackEvent('Events.EventStatusUpdated', { eventId: event.id, action: 'event_reopened' });
    return true;
  };

  // Bulk group check-in — for a confirmed, accommodation-only booking (no
  // conference/catering component; see scheduleHasEventComponent) there's no
  // per-guest reservation to check in one at a time, and no individual room/
  // name assignment (the whole point of booking this way — see the pasted
  // Menish/Noda-style day-by-day headcounts). This just marks the group
  // in-house as one action, mirroring markEventAsCompleted's side-field
  // pattern rather than overloading the business `status` union.
  const checkInEventGroup = async (event: any): Promise<boolean> => {
    if (event.checkedIn) return false;
    // Matches the same fallback order the Active Events table itself displays
    // (event.pax || event.expectedPax || 0) — keeps the confirm dialog, the
    // stored headcount, and the KPI contribution all reading the same number.
    const pax = event.pax || event.expectedPax || event.attendees || 0;
    const { confirmChoice } = await import('./DangerConfirm');
    const groupOk = await confirmChoice(
      `Check in this group${pax ? ` (${pax} pax)` : ''}?`,
      'This marks the whole booking as in-house. It does not create individual guest or room records.',
      'Check in',
    );
    if (!groupOk) return false;

    const updatedEvent = { ...event, checkedIn: true, checkedInAt: new Date().toISOString() };
    setCustomEvents(prev => prev.map(ev => (ev.id === event.id ? updatedEvent : ev)));
    persistEventBookingPatch(updatedEvent, { checkedIn: true, checkedInAt: updatedEvent.checkedInAt });
    frontOfficeStore.addInHouseGroup(event.id, pax, event.eventName);
    trackEvent('Events.EventStatusUpdated', { eventId: event.id, action: 'group_checked_in' });
    return true;
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
  

  // Event Management Component
  

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

  const contractTemplateBlocks = (templateKey?: string) => {
    const state = useSettingsStore.getState();
    const key = templateKey || (state.printing as any)['event-contract'];
    return (state.getDocBuilderTemplate(key) || getBuiltInTemplate(key))?.blocks;
  };

  const handleContractPrint = (templateKey?: string) => {
    if (!selectedClient) return;
    const hotel = buildOrgProfile(useSettingsStore.getState() as any);
    openPrintPreview('event-contract', templateKey || '', buildContractPrintData(selectedClient, selectedContractEventInfo, hotel));
    trackEvent('Analytics.ActionClicked', { action: 'ContractPrinted', clientId: selectedClient.id });
  };

  const handleContractDocx = (templateKey?: string) => {
    if (!selectedClient) return;
    const state = useSettingsStore.getState();
    const hotel = buildOrgProfile(state as any);
    const terms = contractTermsFromBlocks(contractTemplateBlocks(templateKey), hotel.name);
    void downloadContractDocx(buildContractModel(selectedClient, selectedContractEventInfo, hotel, terms)).catch((err) => {
      console.error('Contract Word download failed', err);
      alert('The Word file could not be created. Try again.');
    });
    trackEvent('Analytics.ActionClicked', { action: 'ContractDocxDownloaded', clientId: selectedClient.id });
  };

  // Removed local add-client modal; creation now redirects to canonical form

  const handleClientEdit = () => {
    // Handle client edit
    setIsClientEditModalOpen(false);
    trackEvent('Analytics.ActionClicked', { action: 'EventsClientEdited', clientId: selectedClient?.id });
    console.log('Client edited successfully');
  };
    const eventsScreen = {
    DAY_IN_MS,
    EVENT_CHARGE_REF,
    PRE_EVENT_STATUS_OPTIONS,
    activeFolio,
    activeFolioBalance,
    activeFolioTotals,
    activePrintTab,
    addDays,
    addExtraLineToDay,
    addMonths,
    allEvents,
    balanceDue,
    beoCoordinatorOptions,
    beoDepartmentOptions,
    beoForm,
    beoResponsibleOptions,
    beoWorkspaceTab,
    buildOpeningFolioEntries,
    calculateFolioTotals,
    calendarDateInputValue,
    calendarDayNames,
    calendarGridDays,
    calendarHeaderTitle,
    calendarMonthInputValue,
    calendarWeekDays,
    capacityOk,
    cappedPrepaymentAmount,
    checkInEventGroup,
    clampDateToRange,
    clashCount,
    clientContactName,
    closeEventWorkspace,
    closeFolioModal,
    closeReceiptWorkspace,
    closeVenueModal,
    computeDayAmounts,
    computeEventDurationDays,
    conferenceRate,
    conferenceRates,
    confirmCreateInvoiceForEvent,
    confirmDocCaution,
    conflictingEvents,
    createCreditNote,
    createDebitNote,
    customParticulars,
    dailySchedule,
    defaultDayRate,
    deleteActiveFolio,
    deleteActiveReceipt,
    deleteFolioEntry,
    detailedTaxRows,
    dinnerRate,
    discountEnabled,
    discountType,
    discountValue,
    docCautionPrompt,
    editingEvent,
    editingEventDocSection,
    editingService,
    editingVenue,
    endDate,
    eventAmountDue,
    eventCalendarDate,
    eventCalendarView,
    eventChargeAmount,
    eventCoordinator,
    eventEndsToday,
    eventFolios,
    eventInvoices,
    eventName,
    eventReceipts,
    eventStaffOptions,
    eventStatus,
    eventSubmitting,
    eventTaxExempt,
    eventTotals,
    expectedPax,
    exportEventsForView,
    exportFunctionSchedulePDF,
    exportFunctionSheetPDF,
    filteredFolioEntries,
    filteredModernVenues,
    folioAccountCols,
    folioComposerOpen,
    folioCreateError,
    folioCreateForm,
    folioEntryForm,
    folioEntrySearch,
    folioPageCount,
    folioPageRows,
    folioSafePage,
    folioSortDir,
    folioSortKey,
    followUpDate,
    formatCurrency,
    formatDateDisplay,
    formatDateKey,
    formatEventId,
    formatFolioEntryCopy,
    formatFolioNumber,
    formatQuoteNumber,
    frontOfficeGuests,
    generateBEO,
    generateFunctionSheet,
    getConferenceInvoiceNumber,
    getConferenceReceiptNumber,
    getEndOfMonth,
    getEventClientName,
    getEventDisplayName,
    getEventsUsingVenue,
    getFolioCandidateEvents,
    getFolioCurrentBalance,
    getFolioEventLabel,
    getFolioSettledStatus,
    getInvoiceReceiptLabel,
    getInvoiceableProformas,
    getNextSortState,
    getProformaPickerLabel,
    getProgrammeType,
    getStartOfMonth,
    getStatusColor,
    handleAddBeoChecklist,
    handleAddBeoInstruction,
    handleAddBeoTimeline,
    handleAddFolioEntry,
    handleCalendarDateInput,
    handleCalendarNavigate,
    handleCalendarToday,
    handleCalendarViewChange,
    handleContractDocx,
    handleContractPrint,
    handleCreateFolio,
    handleDeleteVenue,
    handleDownloadInvoicePdf,
    handleDownloadQuotePdf,
    handleDownloadReceiptPdf,
    handleEditInvoiceFromFolio,
    handleEditReceiptFromFolio,
    handleEventSubmit,
    handleExportEventXls,
    handleInvoiceDetailsSave,
    handleInvoiceSave,
    handleOpenContractFromEvent,
    handlePrintEventFolio,
    handlePrintEventInvoicePdf,
    handlePrintQuotePdf,
    handleReceiptSave,
    handleRemoveBeoChecklist,
    handleRemoveBeoInstruction,
    handleRemoveBeoTimeline,
    handleSaveBeoForm,
    handleSendFunctionSheetToDepartments,
    handleServiceSubmit,
    handleVenueFieldChange,
    handleVenueSubmit,
    hasWarnings,
    hiddenParticulars,
    invoiceCreateEventId,
    invoiceErrors,
    invoiceForm,
    invoiceModalMode,
    invoiceStatusMeta,
    isAdjustMode,
    isBEOModalOpen,
    isClientEditModalOpen,
    isClientViewModalOpen,
    isContractModalOpen,
    isCreatingEvent,
    isCreatingInvoiceFromFolio,
    isEditingInvoiceDetails,
    isEventModalOpen,
    isFolioCreateModalOpen,
    isFolioModalOpen,
    isInvoiceEventPickerOpen,
    isInvoiceModalOpen,
    isReceiptModalOpen,
    isResidential,
    isServiceModalOpen,
    isVenueModalOpen,
    isViewMode,
    lastCreatedInvoiceId,
    linkedEventInvoice,
    linkedEventReceipts,
    listSelectableTemplates,
    lunchRate,
    managementMainTab,
    managementStatusFilter,
    markEventAsCompleted,
    reopenEndedEvent,
    cancelMissedEvent,
    modernVenues,
    nextAction,
    normalizeStatus,
    openCreateFolioPicker,
    openCreateInvoicePicker,
    openCreateReceiptPicker,
    openEventForEdit,
    openEventForView,
    openEventInvoiceForm,
    openFolioDetails,
    openInvoiceDetailEdit,
    openNewEventModal,
    openReceiptFromInvoice,
    openReceiptModal,
    openVenueModal,
    orgClientEmail,
    orgClientId,
    orgContactPhone,
    orgName,
    orgSearch,
    padNumber,
    parseDateValue,
    particularLabels,
    phase1Error,
    prepaymentDisplay,
    prepaymentEnabled,
    prepaymentType,
    prepaymentValue,
    printFunctionScheduleFromEvents,
    processRefund,
    ratesByParticulars,
    receiptErrors,
    receiptForm,
    receiptInvoiceLocked,
    receiptInvoiceQuery,
    receiptMethodLabels,
    receiptMethods,
    receiptModalMode,
    receiptPrintAfterSave,
    refreshTaxRules,
    removeExtraLineFromDay,
    reportingEvents,
    resolveCoordinatorValue,
    resolveEventCoordinator,
    resolveEventTemplateKey,
    reverseFolioEntry,
    roomRate,
    scheduleDataMap,
    selectedClient,
    selectedContractEventInfo,
    selectedInvoiceTemplate,
    selectedProformaTemplate,
    selectedReceiptTemplate,
    setActivePrintTab,
    setBeoWorkspaceTab,
    setClientContactName,
    setConferenceRate,
    setConferenceRates,
    setCustomParticulars,
    setDailySchedule,
    setDefaultDayRate,
    setDinnerRate,
    setDiscountEnabled,
    setDiscountType,
    setDiscountValue,
    setDocCautionPrompt,
    setEndDate,
    setEventCoordinator,
    setEventFolios,
    setEventName,
    setEventStatus,
    setEventTaxExempt,
    setExpectedPax,
    setFolioComposerOpen,
    setFolioCreateError,
    setFolioCreateForm,
    setFolioEntryForm,
    setFolioEntrySearch,
    setFolioPage,
    setFollowUpDate,
    setHiddenParticulars,
    setInvoiceCreateEventId,
    setInvoiceForm,
    setIsBEOModalOpen,
    setIsClientEditModalOpen,
    setIsClientViewModalOpen,
    setIsContractModalOpen,
    setIsEditingInvoiceDetails,
    setIsFolioCreateModalOpen,
    setIsInvoiceEventPickerOpen,
    setIsInvoiceModalOpen,
    setIsResidential,
    setIsServiceModalOpen,
    setIsViewMode,
    setLastCreatedInvoiceId,
    setLunchRate,
    setManagementMainTab,
    setManagementStatusFilter,
    setNextAction,
    setOrgClientEmail,
    setOrgClientId,
    setOrgContactPhone,
    setOrgName,
    setOrgSearch,
    setParticularLabels,
    setPhase1Error,
    setPrepaymentEnabled,
    setPrepaymentType,
    setPrepaymentValue,
    setQuoteTaxExempt,
    setRatesByParticulars,
    setReceiptErrors,
    setReceiptForm,
    setReceiptInvoiceQuery,
    setReceiptPrintAfterSave,
    setRoomRate,
    setSelectedContractEventInfo,
    setSelectedEventForBEO,
    setSelectedInvoiceTemplate,
    setSelectedProformaTemplate,
    setSelectedReceiptTemplate,
    setShowDiscountModal,
    setShowPrepaymentModal,
    setStartDate,
    setVenueKey,
    setVenueSearchTerm,
    setVenueStatusFilter,
    showDiscountModal,
    showPrepaymentModal,
    showQuotePrintInModal,
    sortFolioAccount,
    sortRows,
    sortedFolioEntries,
    startDate,
    toStartOfDay,
    todayKey,
    updateBeoChecklistItem,
    updateBeoFormSection,
    updateBeoInstruction,
    updateBeoTimelineItem,
    updateExtraLineOnDay,
    updateScheduleData,
    venueForm,
    venueKey,
    venueSearchTerm,
    venueStatusFilter,
    voidActiveFolio,
    unvoidActiveFolio,
    voidActiveReceipt,
    unvoidActiveReceipt,
  };

  return (
    <EventsScreenProvider value={eventsScreen}>
    <>
      {!workspaceOnly && (
      <div className={fullPage ? 'px-3 pt-1 pb-3' : 'p-6'}>
      {/* Removed top notices; bottom section contains notices & activities */}
      {!fullPage && <DeptMessenger from="events" mode="drawer" />}
      
      <div className={`${fullPage ? 'mb-2' : 'mb-3'} flex items-center justify-between gap-3`}>
        <h2 className={`${fullPage ? 'text-xl' : 'text-2xl'} font-bold text-ghana-black`}>🎪 Events & Conferences</h2>
        {!fullPage && (
          <ModuleExpandButton
            href={selectedTab === 'reports' ? '/events/reports' : '/events/ops'}
            label={selectedTab === 'reports' ? 'Open reports full page' : 'Open events full page'}
          />
        )}
      </div>
      <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(String(key))}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
            aria-label="Events and conferences operations"
          >
            <Tab key="confirmed" title="📋 Event Management">
              <EventManagementTab />
            </Tab>
            <Tab key="venues" title={`🏢 Venue Management (${filteredModernVenues.length})`}>
              <VenueManagementTab />
            </Tab>
            <Tab key="quoting" title={`💰 Guest Rates (${guestRatesFilteredCount})`}>
              <GuestRatesPanel onFilteredCountChange={setGuestRatesFilteredCount} />
            </Tab>
            <Tab key="reports" title="📊 Reports & Analysis">
              <div className="mt-2">
                <EventsReportsAnalysis embedded />
              </div>
            </Tab>

            <Tab key="staff" title="👥 Staff Management">
              <DepartmentStaffTab
                departmentLabel="Events & Conferences"
                overtimePermissionId="events-conferences.log-overtime"
                departmentNameHints={['events', 'conference', 'banquet']}
                alsoStaffNames={customEvents.map((event) => String(event.eventCoordinator || '').trim())}
                emptyLabel="No Events department in HR and no coordinators assigned on bookings."
                helperText="HR staff in an Events / Conference / Banquet department, plus coordinators already assigned on bookings. Names come from the HR file — this tab does not invent staff."
              />
            </Tab>
      </Tabs>
    </div>
      )}

      {isEventModalOpen && <EventEditorModal />}
      {isVenueModalOpen && <VenueModal />}
      {(isServiceModalOpen || isBEOModalOpen) && <EventFunctionSheetModal />}
      {(isClientViewModalOpen || isClientEditModalOpen || isContractModalOpen) && <EventClientModals />}
      {isFolioModalOpen && <EventFolioModal />}
      {isInvoiceModalOpen && <EventInvoiceModal />}
      {isReceiptModalOpen && <EventReceiptModal />}
      {isFolioCreateModalOpen && <EventFolioCreateModal />}
      {isInvoiceEventPickerOpen && <EventProformaPickerModal />}
      {docCautionPrompt && <EventDocCautionModal />}
    </>
    </EventsScreenProvider>
  );
}