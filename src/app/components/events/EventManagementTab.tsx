'use client';

import { Badge, Button, Card, CardBody, Chip, Input, Pagination, Select, SelectItem, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs, Tooltip } from '@heroui/react';
import type { EventFolio, EventFolioEntry, EventInvoice, EventReceipt, QuoteListItem, SimpleEventStatus, TableSortState } from './eventTypes';
import EventsModuleFilters, { EventsDateFilterMode, eventPrimaryDate, matchesEventsDateFilter } from '../EventsModuleFilters';
import { ManagementMainTabKey, UNASSIGNED_STAFF, eventEndValue, eventRoomCount, eventStartValue, eventStayType, eventVenueKey, eventVenueLabel, formatEventTableDate, functionFbDuties, functionHkDuties, isEventNoShow, parseEventDate, resolveReceiptMethod } from './eventShared';
import { deskTableCardBodyClassName, deskTableCardClassName } from '../dashboard/deskTableUi';
import { genId } from '../../lib/frontoffice/helpers/ids';
import { openHtmlPrintWindow } from '../../lib/print/engine';
import { paymentMethodLabel } from '../../lib/accounting/receiptPrint';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { worksheetTableClassNames } from '../frontoffice/StayWorksheetTable';
import { useEventsScreen } from './eventsScreenContext';

/** Events → Event Management. Event master, invoices, receipts, and folios. */
export function EventManagementTab() {
  const eventsScreen = useEventsScreen();
  const getManagementTabDefaultDateFilter = (_tab: ManagementMainTabKey): EventsDateFilterMode => {
    return 'thisMonth';
  };

  const [managementSearchTerm, setManagementSearchTerm] = useState('');
  const [managementDateFilterMode, setManagementDateFilterMode] = useState<EventsDateFilterMode>(() =>
    getManagementTabDefaultDateFilter(eventsScreen.managementMainTab)
  );
  const [managementDateFilterSingle, setManagementDateFilterSingle] = useState('');
  const [managementDateFilterFrom, setManagementDateFilterFrom] = useState('');
  const [managementDateFilterTo, setManagementDateFilterTo] = useState('');
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
      className="font-semibold text-ghana-black"
      onClick={() => onSort(columnKey)}
    >
      {label}{sortState.column === columnKey ? (sortState.direction === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
  const handleEventMasterSort = (column: string) => {
    setEventMasterPage(1);
    setEventMasterSort(prev => eventsScreen.getNextSortState(prev, column));
  };
  const handleActiveEventsSort = (column: string) => {
    setActiveEventsSort(prev => eventsScreen.getNextSortState(prev, column));
  };
  const handleCompletedEventsSort = (column: string) => {
    setCompletedEventsSort(prev => eventsScreen.getNextSortState(prev, column));
  };
  const handleInvoiceSort = (column: string) => {
    setInvoiceSort(prev => eventsScreen.getNextSortState(prev, column));
  };
  const handleReceiptSort = (column: string) => {
    setReceiptSort(prev => eventsScreen.getNextSortState(prev, column));
  };
  const handleQuoteSort = (column: string) => {
    setQuoteSort(prev => eventsScreen.getNextSortState(prev, column));
  };
  const handleFolioSort = (column: string) => {
    setFolioSort(prev => eventsScreen.getNextSortState(prev, column));
  };

  // Pagination state
  const [eventMasterPage, setEventMasterPage] = useState(1);
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

  const managedEvents = eventsScreen.reportingEvents;

  const applyManagementEventFilters = useCallback(
    (events: any[]) => {
      let filtered = events;

      if (managementSearchTerm.trim()) {
        const term = managementSearchTerm.trim().toLowerCase();
        filtered = filtered.filter(
          (event: any) =>
            (event.eventName || '').toLowerCase().includes(term) ||
            (event.organization || '').toLowerCase().includes(term) ||
            (event.venueName || event.venue || '').toLowerCase().includes(term) ||
            (event.contactPerson || '').toLowerCase().includes(term) ||
            eventsScreen.resolveEventCoordinator(event).toLowerCase().includes(term)
        );
      }

      if (eventsScreen.managementStatusFilter !== 'all') {
        filtered = filtered.filter((event: any) => eventDeskBucket(event) === eventsScreen.managementStatusFilter);
      }

      if (managementDateFilterMode !== 'all') {
        filtered = filtered.filter((event: any) =>
          matchesEventsDateFilter(
            eventPrimaryDate(event),
            managementDateFilterMode,
            managementDateFilterSingle,
            managementDateFilterFrom,
            managementDateFilterTo
          )
        );
      }

      return filtered;
    },
    [
      managementSearchTerm,
      eventsScreen.managementStatusFilter,
      managementDateFilterMode,
      managementDateFilterSingle,
      managementDateFilterFrom,
      managementDateFilterTo,
    ]
  );

  const managementFilterSearch = useMemo(() => {
    switch (eventsScreen.managementMainTab) {
      case 'invoices':
        return managementInvoiceSearch;
      case 'receipts':
        return managementReceiptSearch;
      case 'quotes':
        return managementQuoteSearch;
      case 'folios':
        return managementFolioSearch;
      default:
        return managementSearchTerm;
    }
  }, [
    eventsScreen.managementMainTab,
    managementSearchTerm,
    managementInvoiceSearch,
    managementReceiptSearch,
    managementQuoteSearch,
    managementFolioSearch,
  ]);

  const setManagementFilterSearch = useCallback(
    (value: string) => {
      switch (eventsScreen.managementMainTab) {
        case 'invoices':
          setManagementInvoiceSearch(value);
          break;
        case 'receipts':
          setManagementReceiptSearch(value);
          break;
        case 'quotes':
          setManagementQuoteSearch(value);
          break;
        case 'folios':
          setManagementFolioSearch(value);
          break;
        default:
          setManagementSearchTerm(value);
          break;
      }
    },
    [eventsScreen.managementMainTab]
  );

  const managementFilterPlaceholder = useMemo(() => {
    switch (eventsScreen.managementMainTab) {
      case 'invoices':
        return 'Search invoices, events, or clients...';
      case 'receipts':
        return 'Search receipts, events, or clients...';
      case 'quotes':
        return 'Search quotes, events, or clients...';
      case 'folios':
        return 'Search folios, events, or clients...';
      default:
        return 'Search events...';
    }
  }, [eventsScreen.managementMainTab]);

  const eventDeskBucket = (event: any): 'quote' | 'active' | 'completed' | 'cancelled' | 'noshow' => {
    const normalized = eventsScreen.normalizeStatus(event?.eventStatus || event?.status);
    if (normalized === 'cancelled') return 'cancelled';
    if (normalized === 'invoiced') return 'completed';
    if (isEventNoShow(event)) return 'noshow';
    if (normalized === 'confirmed') return 'active';
    return 'quote';
  };

  const managementStatusOptions = useMemo(
    () => [
      { key: 'all', label: 'All' },
      { key: 'quote', label: 'Quote' },
      { key: 'active', label: 'Active' },
      { key: 'completed', label: 'Completed' },
      { key: 'cancelled', label: 'Cancelled' },
    ],
    []
  );

  const showManagementStatusFilter = eventsScreen.managementMainTab === 'events';

  useEffect(() => {
    if (
      managementSelectedGanttVenue !== 'all' &&
      managementSelectedGanttVenue !== 'unassigned' &&
      !eventsScreen.modernVenues.some(venue => venue.id === managementSelectedGanttVenue)
    ) {
      setManagementSelectedGanttVenue('all');
    }
  }, [managementSelectedGanttVenue, eventsScreen.modernVenues]);

  const filteredManagedEvents = useMemo(
    () => applyManagementEventFilters(managedEvents),
    [managedEvents, applyManagementEventFilters]
  );

  const managementEventsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    if (managementViewMode !== 'calendar') return map;
    filteredManagedEvents.forEach((event: any) => {
      const start = parseEventDate(eventStartValue(event));
      const end = parseEventDate(eventEndValue(event)) || start;
      if (!start || !end) return;
      const last = end < start ? start : end;
      const cursor = new Date(start);
      while (cursor <= last) {
        const key = eventsScreen.formatDateKey(cursor);
        const existing = map.get(key);
        if (existing) existing.push(event);
        else map.set(key, [event]);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [filteredManagedEvents, managementViewMode]);

  const managementDayEvents = useMemo(
    () => managementEventsByDay.get(eventsScreen.formatDateKey(eventsScreen.eventCalendarDate)) || [],
    [managementEventsByDay, eventsScreen.eventCalendarDate]
  );

  const managementCalendarMonthEventCount = useMemo(() => {
    const month = eventsScreen.eventCalendarDate.getMonth();
    const year = eventsScreen.eventCalendarDate.getFullYear();
    const seen = new Set<string>();
    managementEventsByDay.forEach((events, key) => {
      const day = parseEventDate(key);
      if (!day || day.getMonth() !== month || day.getFullYear() !== year) return;
      events.forEach((event: any) => {
        if (event?.id) seen.add(event.id);
      });
    });
    return seen.size;
  }, [managementEventsByDay, eventsScreen.eventCalendarDate]);

  const managementCalendarWeekEventCount = useMemo(() => {
    const seen = new Set<string>();
    eventsScreen.calendarWeekDays.forEach((day) => {
      (managementEventsByDay.get(eventsScreen.formatDateKey(day)) || []).forEach((event: any) => {
        if (event?.id) seen.add(event.id);
      });
    });
    return seen.size;
  }, [eventsScreen.calendarWeekDays, managementEventsByDay]);

  const eventStatusBuckets = useMemo(
    () =>
      managedEvents.reduce(
        (acc: Record<SimpleEventStatus | 'total', number>, event: any) => {
          const normalized = eventsScreen.normalizeStatus(event.status || event.eventStatus);
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
          const normalized = eventsScreen.normalizeStatus(event.status || event.eventStatus);
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
    if (!eventsScreen.lastCreatedInvoiceId) return;

    try {
      // Switch the inner management tabs to Invoices
      eventsScreen.setManagementMainTab('invoices');
      setManagementInvoiceSearch('');
      setInvoicesPage(1);
    } catch (error) {
      console.error('Error switching to Invoices tab after invoice creation:', error);
    } finally {
      // Clear the hint so this only runs once per invoice creation
      eventsScreen.setLastCreatedInvoiceId(null);
    }
  }, [eventsScreen.lastCreatedInvoiceId]);

  // Gantt chart computed values (after managedEvents is defined)
  const managementGanttTimelineStart = useMemo(() => eventsScreen.getStartOfMonth(managementGanttReferenceDate), [managementGanttReferenceDate]);
  const managementGanttTimelineEnd = useMemo(() => eventsScreen.getEndOfMonth(managementGanttReferenceDate), [managementGanttReferenceDate]);
  const managementGanttTimelineTitle = useMemo(() => {
    return managementGanttReferenceDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [managementGanttReferenceDate]);
  const managementGanttTimelineRangeLabel = `${eventsScreen.formatDateKey(managementGanttTimelineStart)} → ${eventsScreen.formatDateKey(managementGanttTimelineEnd)}`;
  const managementTimelineDayCount = Math.max(1, Math.round((eventsScreen.toStartOfDay(managementGanttTimelineEnd).getTime() - eventsScreen.toStartOfDay(managementGanttTimelineStart).getTime()) / eventsScreen.DAY_IN_MS) + 1);
  const managementTimelineDays = useMemo(() => Array.from({ length: managementTimelineDayCount }, (_, index) => eventsScreen.addDays(managementGanttTimelineStart, index)), [managementGanttTimelineStart, managementTimelineDayCount]);
  const managementGanttMonthInputValue = `${managementGanttReferenceDate.getFullYear()}-${eventsScreen.padNumber(managementGanttReferenceDate.getMonth() + 1)}`;

  const managementGanttVenues = useMemo(() => {
    const venueMap = new Map<string, string>();
    filteredManagedEvents.forEach((event: any) => {
      const venueId = eventVenueKey(event);
      const venueName =
        event.venueName ||
        eventsScreen.modernVenues.find(venue => venue.id === venueId)?.name ||
        (venueId === 'unassigned' ? 'Unassigned' : venueId);
      venueMap.set(venueId, venueName);
    });
    return Array.from(venueMap.entries()).map(([id, name]) => ({ id, name }));
  }, [filteredManagedEvents, eventsScreen.modernVenues]);

  const managementGanttVenuesToRender = useMemo(() => {
    if (managementSelectedGanttVenue === 'all') {
      return managementGanttVenues;
    }
    return managementGanttVenues.filter(venue => venue.id === managementSelectedGanttVenue);
  }, [managementGanttVenues, managementSelectedGanttVenue]);

  // Get events for a specific venue (using managedEvents)
  const getManagedEventsForVenue = (venueId: string, rangeStart?: Date, rangeEnd?: Date) => {
    const filtered = filteredManagedEvents.filter((event: any) => {
      const eventVenueId = eventVenueKey(event);
      const matchesVenue =
        venueId === 'all'
          ? true
          : venueId === 'unassigned'
            ? eventVenueId === 'unassigned'
            : eventVenueId === venueId;
      if (!matchesVenue) return false;

      if (rangeStart && rangeEnd) {
        const eventStart = parseEventDate(eventStartValue(event));
        const eventEnd = parseEventDate(eventEndValue(event)) || eventStart;
        if (!eventStart || !eventEnd) return false;
        return eventEnd >= rangeStart && eventStart <= rangeEnd;
      }

      return true;
    });

    return filtered.sort((a: any, b: any) => {
      const aTime = parseEventDate(eventStartValue(a))?.getTime() || 0;
      const bTime = parseEventDate(eventStartValue(b))?.getTime() || 0;
      return aTime - bTime;
    });
  };

  const managementGanttDailyPax = useMemo(() => {
    if (managementViewMode !== 'gantt') return [];
    const events = getManagedEventsForVenue(
      managementSelectedGanttVenue,
      managementGanttTimelineStart,
      managementGanttTimelineEnd
    );
    return managementTimelineDays.map((day) => {
      const dayStart = eventsScreen.toStartOfDay(day);
      return events.reduce((sum: number, event: any) => {
        const start = parseEventDate(eventStartValue(event));
        const end = parseEventDate(eventEndValue(event)) || start;
        if (!start || !end) return sum;
        if (dayStart < start || dayStart > end) return sum;
        return sum + (Number(event.pax || event.expectedPax || 0) || 0);
      }, 0);
    });
  }, [
    managementSelectedGanttVenue,
    managementGanttTimelineStart,
    managementGanttTimelineEnd,
    managementTimelineDays,
    filteredManagedEvents,
    managementViewMode,
  ]);

  // Gantt navigation handlers
  const handleManagementGanttNavigate = (direction: number) => {
    const newDate = eventsScreen.addMonths(managementGanttReferenceDate, direction);
    setManagementGanttReferenceDate(eventsScreen.getStartOfMonth(newDate));
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
    if (eventsScreen.managementMainTab === 'active') return 'active';
    if (eventsScreen.managementMainTab === 'completed') return 'completed';
    // Invoices, receipts and folios follow the event as soon as it is booked.
    if (
      eventsScreen.managementMainTab === 'invoices' ||
      eventsScreen.managementMainTab === 'receipts' ||
      eventsScreen.managementMainTab === 'folios'
    ) {
      return 'all';
    }
    return 'active';
  };

  const getFilteredEventIds = useMemo(() => {
    const statusContext = getEventStatusContext();
    let eventsToUse = managedEvents;

    if (statusContext === 'active') {
      eventsToUse = managedEvents.filter((e: any) => e.eventStatus === 'confirmed' || e.eventStatus === 'in-progress');
    } else if (statusContext === 'completed') {
      eventsToUse = managedEvents.filter((e: any) => e.eventStatus === 'completed' || e.eventStatus === 'billed');
    }

    return eventsToUse.map((e: any) => e.id);
  }, [managedEvents, eventsScreen.managementMainTab]);

  const managementFilteredInvoices = useMemo(() => {
    let filtered = eventsScreen.eventInvoices.filter(inv => getFilteredEventIds.includes(inv.eventId));
    const q = managementInvoiceSearch.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(inv =>
        [inv.id, inv.eventName, inv.clientName, inv.status, inv.reference]
          .filter(Boolean)
          .some(field => String(field).toLowerCase().includes(q))
      );
    }
    if (managementDateFilterMode !== 'all') {
      filtered = filtered.filter(inv =>
        matchesEventsDateFilter(
          inv.issueDate,
          managementDateFilterMode,
          managementDateFilterSingle,
          managementDateFilterFrom,
          managementDateFilterTo
        )
      );
    }
    return filtered;
  }, [
    eventsScreen.eventInvoices,
    getFilteredEventIds,
    managementInvoiceSearch,
    managementDateFilterMode,
    managementDateFilterSingle,
    managementDateFilterFrom,
    managementDateFilterTo,
  ]);

  const managementFilteredReceipts = useMemo(() => {
    let filtered = eventsScreen.eventReceipts.filter(rcpt => getFilteredEventIds.includes(rcpt.eventId));
    const q = managementReceiptSearch.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(rcpt =>
        [rcpt.id, rcpt.eventName, rcpt.clientName, rcpt.method, rcpt.reference]
          .filter(Boolean)
          .some(field => String(field).toLowerCase().includes(q))
      );
    }
    if (managementDateFilterMode !== 'all') {
      filtered = filtered.filter(rcpt =>
        matchesEventsDateFilter(
          rcpt.date,
          managementDateFilterMode,
          managementDateFilterSingle,
          managementDateFilterFrom,
          managementDateFilterTo
        )
      );
    }
    return filtered;
  }, [
    eventsScreen.eventReceipts,
    getFilteredEventIds,
    managementReceiptSearch,
    managementDateFilterMode,
    managementDateFilterSingle,
    managementDateFilterFrom,
    managementDateFilterTo,
  ]);
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
        quoteNumber: eventsScreen.formatQuoteNumber(event.id, event.quoteNumber || eventsScreen.formatEventId(event.id)),
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
        venueName: event.venueName || eventVenueLabel(event, eventsScreen.modernVenues),
        rawEvent: event
      };
    });

    const term = managementQuoteSearch.trim().toLowerCase();
    let filtered = quotes;
    if (term) {
      filtered = filtered.filter(q =>
        q.quoteNumber.toLowerCase().includes(term) ||
        q.eventName.toLowerCase().includes(term) ||
        q.clientName.toLowerCase().includes(term)
      );
    }
    if (managementDateFilterMode !== 'all') {
      filtered = filtered.filter(q =>
        matchesEventsDateFilter(
          q.issuedOn || q.checkIn,
          managementDateFilterMode,
          managementDateFilterSingle,
          managementDateFilterFrom,
          managementDateFilterTo
        )
      );
    }
    return filtered;
  }, [
    managedEvents,
    managementQuoteSearch,
    managementDateFilterMode,
    managementDateFilterSingle,
    managementDateFilterFrom,
    managementDateFilterTo,
  ]);

  const managementFilteredFolios = useMemo(() => {
    let filtered = eventsScreen.eventFolios.filter(folio => getFilteredEventIds.includes(folio.eventId));
    const q = managementFolioSearch.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(folio =>
        [folio.id, folio.eventName, folio.clientName, folio.status]
          .filter(Boolean)
          .some(field => String(field).toLowerCase().includes(q))
      );
    }
    if (managementDateFilterMode !== 'all') {
      filtered = filtered.filter(folio =>
        matchesEventsDateFilter(
          folio.updatedAt,
          managementDateFilterMode,
          managementDateFilterSingle,
          managementDateFilterFrom,
          managementDateFilterTo
        )
      );
    }
    return filtered;
  }, [
    eventsScreen.eventFolios,
    getFilteredEventIds,
    managementFolioSearch,
    managementDateFilterMode,
    managementDateFilterSingle,
    managementDateFilterFrom,
    managementDateFilterTo,
  ]);

  const managementTabCounts = useMemo(() => {
    const base = applyManagementEventFilters(managedEvents);
    const countableEventIds = new Set(managedEvents.map((e: any) => e.id));

    const countFinancialDocs = <T extends { eventId: string }>(
      docs: T[],
      search: string,
      getSearchFields: (doc: T) => (string | undefined | null)[],
      getDateValue: (doc: T) => string | undefined | null
    ) => {
      let filtered = docs.filter((doc) => countableEventIds.has(doc.eventId));
      const q = search.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter((doc) =>
          getSearchFields(doc)
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(q))
        );
      }
      if (managementDateFilterMode !== 'all') {
        filtered = filtered.filter((doc) =>
          matchesEventsDateFilter(
            getDateValue(doc),
            managementDateFilterMode,
            managementDateFilterSingle,
            managementDateFilterFrom,
            managementDateFilterTo
          )
        );
      }
      return filtered.length;
    };

    return {
      events: base.length,
      active: base.filter(
        (e: any) => e.eventStatus === 'confirmed' || e.eventStatus === 'in-progress'
      ).length,
      completed: base.filter(
        (e: any) => e.eventStatus === 'completed' || e.eventStatus === 'billed'
      ).length,
      invoices: countFinancialDocs(
        eventsScreen.eventInvoices,
        managementInvoiceSearch,
        (inv) => [inv.id, inv.eventName, inv.clientName, inv.status, inv.reference],
        (inv) => inv.issueDate
      ),
      receipts: countFinancialDocs(
        eventsScreen.eventReceipts,
        managementReceiptSearch,
        (rcpt) => [rcpt.id, rcpt.eventName, rcpt.clientName, rcpt.method, rcpt.reference],
        (rcpt) => rcpt.date
      ),
      quotes: managementFilteredQuotes.length,
      folios: countFinancialDocs(
        eventsScreen.eventFolios,
        managementFolioSearch,
        (folio) => [folio.id, folio.eventName, folio.clientName, folio.status],
        (folio) => folio.updatedAt
      ),
    };
  }, [
    managedEvents,
    applyManagementEventFilters,
    eventsScreen.eventInvoices,
    eventsScreen.eventReceipts,
    eventsScreen.eventFolios,
    managementInvoiceSearch,
    managementReceiptSearch,
    managementFolioSearch,
    managementFilteredQuotes.length,
    managementDateFilterMode,
    managementDateFilterSingle,
    managementDateFilterFrom,
    managementDateFilterTo,
  ]);

  const managementTabOptions = useMemo(
    () =>
      [
        { key: 'events' as const, label: `📊 Event Master (${managementTabCounts.events})` },
        { key: 'invoices' as const, label: `🧾 Invoices (${managementTabCounts.invoices})` },
        { key: 'receipts' as const, label: `💳 Receipts (${managementTabCounts.receipts})` },
        { key: 'folios' as const, label: `📂 Folios (${managementTabCounts.folios})` },
      ],
    [managementTabCounts]
  );

  const eventMasterSortAccessors = useMemo(() => ({
    eventId: (row: any) => row.id || '',
    eventName: (row: any) => row.eventName || '',
    stayType: (row: any) => eventStayType(row),
    venueName: (row: any) => row.venueName || '',
    startDate: (row: any) => eventsScreen.parseDateValue(row.arrivalDate || row.startDate),
    endDate: (row: any) => eventsScreen.parseDateValue(row.departureDate || row.endDate),
    duration: (row: any) => eventsScreen.computeEventDurationDays(row),
    pax: (row: any) => Number(row.pax || row.expectedPax || 0),
    status: (row: any) => row.eventStatus || row.status || '',
    coordinator: (row: any) => eventsScreen.resolveEventCoordinator(row),
    amount: (row: any) => eventsScreen.eventChargeAmount(row),
    outstanding: (row: any) => eventsScreen.eventAmountDue(row)
  }), [eventsScreen.resolveEventCoordinator, eventsScreen.eventFolios, eventsScreen.eventInvoices]);

  const managementTableClassNames = {
    ...worksheetTableClassNames,
    base: 'max-w-full overflow-x-auto',
    table: 'w-full min-w-max',
    th: `${worksheetTableClassNames.th} relative`,
  };

  const activeEventsSortAccessors = useMemo(() => ({
    eventId: (row: any) => row.id || '',
    eventName: (row: any) => row.eventName || '',
    stayType: (row: any) => eventStayType(row),
    organization: (row: any) => row.organization || '',
    startDate: (row: any) => eventsScreen.parseDateValue(row.arrivalDate || row.startDate),
    endDate: (row: any) => eventsScreen.parseDateValue(row.departureDate || row.endDate),
    dates: (row: any) => eventsScreen.parseDateValue(row.arrivalDate || row.startDate),
    venueName: (row: any) => row.venueName || '',
    duration: (row: any) => eventsScreen.computeEventDurationDays(row),
    pax: (row: any) => Number(row.pax || row.expectedPax || 0),
    budget: (row: any) => Number(row.budgetTotal || 0),
    status: (row: any) => row.eventStatus || row.status || ''
  }), []);

  const completedEventsSortAccessors = useMemo(() => ({
    eventId: (row: any) => row.id || '',
    eventName: (row: any) => row.eventName || '',
    stayType: (row: any) => eventStayType(row),
    organization: (row: any) => row.organization || '',
    startDate: (row: any) => eventsScreen.parseDateValue(row.arrivalDate || row.startDate),
    endDate: (row: any) => eventsScreen.parseDateValue(row.departureDate || row.endDate),
    dates: (row: any) => eventsScreen.parseDateValue(row.arrivalDate || row.startDate),
    venueName: (row: any) => row.venueName || '',
    duration: (row: any) => eventsScreen.computeEventDurationDays(row),
    pax: (row: any) => Number(row.pax || row.expectedPax || 0),
    budget: (row: any) => Number(row.budgetTotal || row.quoteTotal || 0),
    actual: (row: any) => (row.invoiceTotal !== undefined ? Number(row.invoiceTotal) : (row.actualTotal !== undefined ? Number(row.actualTotal) : null)),
    variance: (row: any) => (row.variance !== undefined ? Number(row.variance) : null),
    status: (row: any) => row.eventStatus || row.status || ''
  }), []);

  const invoiceSortAccessors = useMemo(() => ({
    invoiceId: (row: EventInvoice) => row.id,
    eventName: (row: EventInvoice) => row.eventName || '',
    issueDate: (row: EventInvoice) => eventsScreen.parseDateValue(row.issueDate),
    dueDate: (row: EventInvoice) => eventsScreen.parseDateValue(row.dueDate),
    total: (row: EventInvoice) => Number(row.total || 0),
    balance: (row: EventInvoice) => Number(row.balance || 0),
    status: (row: EventInvoice) => row.status || ''
  }), []);

  const receiptSortAccessors = useMemo(() => ({
    receiptId: (row: EventReceipt) => row.id,
    eventName: (row: EventReceipt) => row.eventName || '',
    date: (row: EventReceipt) => eventsScreen.parseDateValue(row.date),
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
    checkIn: (row: QuoteListItem) => eventsScreen.parseDateValue(row.checkIn),
    checkOut: (row: QuoteListItem) => eventsScreen.parseDateValue(row.checkOut),
    pax: (row: QuoteListItem) => Number(row.pax || 0),
    issuedOn: (row: QuoteListItem) => eventsScreen.parseDateValue(row.issuedOn),
    amount: (row: QuoteListItem) => Number(row.total || 0)
  }), []);

  const folioSortAccessors = useMemo(() => ({
    folioId: (row: EventFolio) => row.id,
    createdAt: (row: EventFolio) => eventsScreen.parseDateValue(row.createdAt),
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
    updatedAt: (row: EventFolio) => eventsScreen.parseDateValue(row.updatedAt)
  }), []);

  const eventMasterTableRows = useMemo(() => {
    return eventsScreen.sortRows(filteredManagedEvents, eventMasterSort, eventMasterSortAccessors);
  }, [filteredManagedEvents, eventMasterSort, eventMasterSortAccessors]);

  const eventMasterPages = Math.max(1, Math.ceil(eventMasterTableRows.filter((event: any) => event?.id).length / rowsPerPage));
  const pagedEventMasterRows = eventMasterTableRows
    .filter((event: any) => event?.id)
    .slice((eventMasterPage - 1) * rowsPerPage, eventMasterPage * rowsPerPage);

  const activeEventsList = useMemo(() => {
    return filteredManagedEvents.filter((e: any) => e.eventStatus === 'confirmed' || e.eventStatus === 'in-progress');
  }, [filteredManagedEvents]);

  const sortedActiveEvents = useMemo(() => {
    return eventsScreen.sortRows(activeEventsList, activeEventsSort, activeEventsSortAccessors);
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
    return eventsScreen.sortRows(completedEventsList, completedEventsSort, completedEventsSortAccessors);
  }, [completedEventsList, completedEventsSort, completedEventsSortAccessors]);

  const paginatedCompletedEvents = useMemo(() => {
    const start = (completedEventsPage - 1) * rowsPerPage;
    return sortedCompletedEvents.slice(start, start + rowsPerPage);
  }, [sortedCompletedEvents, completedEventsPage, rowsPerPage]);

  const completedEventsPages = useMemo(() => {
    return Math.ceil(completedEventsList.length / rowsPerPage);
  }, [completedEventsList, rowsPerPage]);

  const sortedInvoices = useMemo(() => {
    return eventsScreen.sortRows(managementFilteredInvoices, invoiceSort, invoiceSortAccessors);
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
    return eventsScreen.sortRows(managementFilteredReceipts, receiptSort, receiptSortAccessors);
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
    return eventsScreen.sortRows(managementFilteredQuotes, quoteSort, quoteSortAccessors);
  }, [managementFilteredQuotes, quoteSort, quoteSortAccessors]);

  const paginatedQuotes = useMemo(() => {
    const start = (quotesPage - 1) * rowsPerPage;
    return sortedQuotes.slice(start, start + rowsPerPage);
  }, [sortedQuotes, quotesPage, rowsPerPage]);

  const quotesPages = useMemo(() => {
    return Math.ceil(managementFilteredQuotes.length / rowsPerPage);
  }, [managementFilteredQuotes, rowsPerPage]);

  const sortedFolios = useMemo(() => {
    return eventsScreen.sortRows(managementFilteredFolios, folioSort, folioSortAccessors);
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
    setEventMasterPage(1);
    setActiveEventsPage(1);
    setCompletedEventsPage(1);
  }, [managementSearchTerm, eventsScreen.managementStatusFilter, managementDateFilterMode, managementDateFilterSingle, managementDateFilterFrom, managementDateFilterTo]);

  useEffect(() => {
    setManagementDateFilterMode(getManagementTabDefaultDateFilter(eventsScreen.managementMainTab));
    setManagementDateFilterSingle('');
    setManagementDateFilterFrom('');
    setManagementDateFilterTo('');
  }, [eventsScreen.managementMainTab]);

  useEffect(() => {
    setInvoicesPage(1);
  }, [managementInvoiceSearch, eventsScreen.managementMainTab]);

  useEffect(() => {
    setReceiptsPage(1);
  }, [managementReceiptSearch, eventsScreen.managementMainTab]);

  useEffect(() => {
    setQuotesPage(1);
  }, [managementQuoteSearch, eventsScreen.managementMainTab]);

  useEffect(() => {
    setFoliosPage(1);
  }, [managementFolioSearch, eventsScreen.managementMainTab]);

  const handleMarkEventAsCompleted = async (event: any) => {
    const wasCompleted = await eventsScreen.markEventAsCompleted(event);
    if (!wasCompleted) return;
    eventsScreen.setManagementMainTab('events');
    eventsScreen.setManagementStatusFilter('completed');
    setEventMasterPage(1);
  };

  // Function to open or create folio for an event
  const handleOpenEventFolio = (event: any) => {
    try {
      if (!event || !event.id) {
        console.error('Invalid event provided to handleOpenEventFolio');
        return;
      }

      // Check if folio already exists for this event
      const existingFolio = eventsScreen.eventFolios.find(f => f.eventId === event.id);

      if (existingFolio) {
        const invoice = eventsScreen.eventInvoices?.find((inv: any) => inv.eventId === event.id);
        const opening = eventsScreen.buildOpeningFolioEntries(event, invoice);
        const provisional = (existingFolio.entries || []).find((entry: EventFolioEntry) => entry.reference === eventsScreen.EVENT_CHARGE_REF);
        const desiredCharge = opening.find((entry) => entry.reference === eventsScreen.EVENT_CHARGE_REF);
        const hasInvoiceEntry = (existingFolio.entries || []).some((entry: EventFolioEntry) =>
          entry.reference === invoice?.id || entry.description === 'Invoice'
        );
        const needsCharge = !hasInvoiceEntry && !provisional && opening.length > 0;
        const staleCharge = !hasInvoiceEntry && provisional && desiredCharge && Number(provisional.debit) !== Number(desiredCharge.debit);
        if (needsCharge || staleCharge) {
          const kept = staleCharge
            ? (existingFolio.entries || []).filter((entry: EventFolioEntry) => entry.reference !== eventsScreen.EVENT_CHARGE_REF && entry.reference !== `DEP-${event.id}`)
            : (existingFolio.entries || []);
          let balance = existingFolio.openingBalance || 0;
          const entries = [...kept, ...opening].map((entry: EventFolioEntry) => {
            balance = balance + Number(entry.debit || 0) - Number(entry.credit || 0);
            return { ...entry, balance };
          });
          const chargedFolio = {
            ...existingFolio,
            entries,
            updatedAt: new Date().toISOString(),
          };
          eventsScreen.setEventFolios(prev => prev.map((folio) => folio.id === existingFolio.id ? chargedFolio : folio));
          eventsScreen.openFolioDetails(chargedFolio);
        } else {
          eventsScreen.openFolioDetails(existingFolio);
        }
      } else {
        // Create new folio and open it
        const invoice = eventsScreen.eventInvoices?.find((inv: any) => inv.eventId === event.id);
        const entries = eventsScreen.buildOpeningFolioEntries(event, invoice);

        const newFolio: EventFolio = {
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

        // Add the new folio to the list
        eventsScreen.setEventFolios(prev => [...prev, newFolio]);

        // Open the newly created folio
        eventsScreen.openFolioDetails(newFolio);

        trackEvent('Events.EventCreated', { action: 'folio_created', eventId: event.id, folioId: newFolio.id });
      }
    } catch (error) {
      console.error('Error opening/creating folio:', error);
      alert('Failed to open folio. Please try again.');
    }
  };

  // Open invoice edit from the invoices table using the full invoice detail edit form
  const openInvoiceFromTable = (invoice: EventInvoice) => {
    // Use the same full form as "Create/Edit Invoice" from folio
    eventsScreen.openInvoiceDetailEdit(invoice);
  };

  // Wrapper functions for function view exports using filteredManagedEvents
  const exportManagementFunctionSchedulePDF = () => {
    try {
      eventsScreen.printFunctionScheduleFromEvents(
        filteredManagedEvents,
        managementGanttTimelineTitle || 'Filtered Events',
        'function_schedule_pdf_exported'
      );
    } catch (error) {
      console.error('Error exporting function schedule PDF:', error);
      alert('Failed to export function schedule. Please try again.');
    }
  };

  const downloadManagementFunctionScheduleCSV = () => {
    try {
      trackEvent('Events.EventCreated', { action: 'function_schedule_csv_downloaded', eventCount: filteredManagedEvents.length });

      const headers = ['Item', 'Arrival Date', 'Departure Date', 'Organization', 'Event Name', 'Programme Type', 'No. of Pax', 'No. of Rooms', 'Room Nights', 'Conference Days', 'Event Venue', 'Food & Beverage', 'Housekeeping/Front Desk', 'Status'];
      const rows = filteredManagedEvents.map((event: any, index: number) => {
        const rooms = eventRoomCount(event);
        const days = eventsScreen.computeEventDurationDays(event);
        return [
          index + 1,
          eventStartValue(event),
          eventEndValue(event),
          event.organization || '',
          event.eventName || '',
          eventsScreen.getProgrammeType(event),
          event.pax || event.expectedPax || 0,
          rooms ?? '',
          rooms ? rooms * days : '',
          days,
          event.venueName || event.venue || 'Unassigned',
          functionFbDuties(event),
          functionHkDuties(event),
          getConfirmedStatusLabel(event.eventStatus || event.status)
        ];
      });

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

  const printDepartmentFunctionBriefing = () => {
    const events = filteredManagedEvents;
    const departmentRows = (title: string, duty: (event: any) => string) =>
      events
        .map((event: any) => `
          <tr>
            <td>${event.eventName || '—'}</td>
            <td>${event.organization || '—'}</td>
            <td>${eventStartValue(event) || '—'} – ${eventEndValue(event) || '—'}</td>
            <td>${event.venueName || event.venue || '—'}</td>
            <td>${event.pax || event.expectedPax || 0}</td>
            <td>${duty(event)}</td>
          </tr>`)
        .join('');

    const html = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Function Schedule — Department Briefing</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            h2 { font-size: 16px; margin: 24px 0 8px; }
            p { color: #6b7280; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f9fafb; }
          </style>
        </head>
        <body>
          <h1>Function Schedule — Department Briefing</h1>
          <p>Post or circulate this sheet. Duties come from the BEO on Event Master.</p>
          <h2>Food &amp; Beverage</h2>
          <table>
            <thead><tr><th>Event</th><th>Organization</th><th>Dates</th><th>Venue</th><th>Pax</th><th>Duty</th></tr></thead>
            <tbody>${departmentRows('Food & Beverage', functionFbDuties) || '<tr><td colspan="6">No events.</td></tr>'}</tbody>
          </table>
          <h2>Housekeeping / Front Desk</h2>
          <table>
            <thead><tr><th>Event</th><th>Organization</th><th>Dates</th><th>Venue</th><th>Pax</th><th>Duty</th></tr></thead>
            <tbody>${departmentRows('Housekeeping', functionHkDuties) || '<tr><td colspan="6">No events.</td></tr>'}</tbody>
          </table>
          <h2>Reservations</h2>
          <table>
            <thead><tr><th>Event</th><th>Organization</th><th>Dates</th><th>Venue</th><th>Pax</th><th>Status</th></tr></thead>
            <tbody>${departmentRows('Reservations', (event) => getConfirmedStatusLabel(event.eventStatus || event.status)) || '<tr><td colspan="6">No events.</td></tr>'}</tbody>
          </table>
        </body>
      </html>`;

    trackEvent('Events.EventCreated', { action: 'function_schedule_shared_to_departments', eventCount: events.length });
    if (!openHtmlPrintWindow(html)) {
      alert('Please allow pop-ups to print the department briefing.');
    }
  };

  const renderCalendarEventChip = (event: any) => {
    const stayType = eventStayType(event);
    return (
      <button
        key={event.id}
        type="button"
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-left transition-colors hover:bg-slate-50"
        onClick={() => eventsScreen.openEventForView(event)}
      >
        <p className="truncate text-xs font-medium text-slate-900">{event.eventName || 'Unnamed Event'}</p>
        <p className="truncate text-[11px] text-slate-500">
          {event.venueName || 'No venue'} · {stayType === 'Residential' ? 'Res' : 'Non-res'}
        </p>
      </button>
    );
  };

  const ganttBarTone = (event: any) => {
    const status = event.eventStatus || event.status || 'confirmed';
    switch (status) {
      case 'in-progress':
        return 'bg-amber-500 border-amber-600';
      case 'completed':
        return 'bg-slate-500 border-slate-600';
      case 'billed':
      case 'invoiced':
        return 'bg-blue-500 border-blue-600';
      case 'cancelled':
        return 'bg-rose-400 border-rose-500';
      case 'quote':
        return 'bg-orange-400 border-orange-500';
      default:
        return 'bg-emerald-500 border-emerald-600';
    }
  };

  return (
    <div className="space-y-2 mt-2">
      <h3 className="text-lg font-semibold text-ghana-black">Event Management</h3>

      <div
        role="tablist"
        aria-label="Event management views"
        className="flex w-full overflow-x-auto flex-nowrap gap-1 p-1 border border-gray-200 rounded-lg bg-gray-50 scrollbar-thin"
      >
        {managementTabOptions.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={eventsScreen.managementMainTab === tab.key}
            onClick={() => eventsScreen.setManagementMainTab(tab.key)}
            className={`whitespace-nowrap flex-shrink-0 px-3 min-h-9 rounded-md text-sm transition-colors ${
              eventsScreen.managementMainTab === tab.key
                ? 'bg-white text-ghana-black font-semibold shadow-sm'
                : 'text-gray-600 hover:text-ghana-black hover:bg-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <EventsModuleFilters
        searchTerm={managementFilterSearch}
        onSearchChange={setManagementFilterSearch}
        searchPlaceholder={managementFilterPlaceholder}
        statusFilter={showManagementStatusFilter ? eventsScreen.managementStatusFilter : undefined}
        onStatusChange={showManagementStatusFilter ? eventsScreen.setManagementStatusFilter : undefined}
        statusOptions={showManagementStatusFilter ? managementStatusOptions : undefined}
        dateFilterMode={managementDateFilterMode}
        onDateFilterModeChange={setManagementDateFilterMode}
        dateFilterSingle={managementDateFilterSingle}
        onDateFilterSingleChange={setManagementDateFilterSingle}
        dateFilterFrom={managementDateFilterFrom}
        onDateFilterFromChange={setManagementDateFilterFrom}
        dateFilterTo={managementDateFilterTo}
        onDateFilterToChange={setManagementDateFilterTo}
      />

      <Tabs
        selectedKey={eventsScreen.managementMainTab}
        onSelectionChange={(key) => {
          const newTab = key as ManagementMainTabKey;
          eventsScreen.setManagementMainTab(newTab);
        }}
        classNames={{
          base: 'w-full',
          tabList: 'hidden',
          panel: 'pt-0',
        }}
      >
        <Tab key="events" title={`📊 Event Master (${managementTabCounts.events})`}>
          <Card className={`mt-2 ${deskTableCardClassName}`}>
            <CardBody className={deskTableCardBodyClassName}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-800">Event Master</h3>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {([
                      ['table', 'Table'],
                      ['calendar', 'Calendar'],
                      ['gantt', 'Gantt'],
                      ['function', 'Function'],
                    ] as const).map(([key, label]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={managementViewMode === key ? 'solid' : 'light'}
                        color={managementViewMode === key ? 'primary' : 'default'}
                        className="min-w-[4.5rem]"
                        onPress={() => setManagementViewMode(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="bordered"
                    onPress={() => {
                      if (managementViewMode === 'function') {
                        exportManagementFunctionSchedulePDF();
                      } else {
                        eventsScreen.exportEventsForView(managementViewMode as 'table' | 'calendar' | 'gantt', 'pdf');
                      }
                    }}
                  >
                    PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="bordered"
                    onPress={() => {
                      if (managementViewMode === 'function') {
                        downloadManagementFunctionScheduleCSV();
                      } else {
                        eventsScreen.exportEventsForView(managementViewMode as 'table' | 'calendar' | 'gantt', 'csv');
                      }
                    }}
                  >
                    Excel
                  </Button>
                  <Button color="primary" variant="solid" size="sm" onPress={eventsScreen.openNewEventModal}>
                    New event
                  </Button>
                </div>
              </div>
              {managementViewMode === 'table' && (
              <>
              <Table
                aria-label="Events management table"
                removeWrapper
                classNames={managementTableClassNames}
              >
                <TableHeader>
                  <TableColumn key="eventId">
                    {renderSortableHeader('Event ID', 'eventId', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="eventName">
                    {renderSortableHeader('Event', 'eventName', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="stayType">
                    {renderSortableHeader('Type', 'stayType', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="venueName">
                    {renderSortableHeader('Venue', 'venueName', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="startDate">
                    {renderSortableHeader('Start', 'startDate', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="endDate">
                    {renderSortableHeader('End', 'endDate', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="duration">
                    {renderSortableHeader('Days', 'duration', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="pax">
                    {renderSortableHeader('Pax', 'pax', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="status">
                    {renderSortableHeader('Status', 'status', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="coordinator">
                    {renderSortableHeader('Coordinator', 'coordinator', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="amount" align="end">
                    {renderSortableHeader('Amount', 'amount', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                  <TableColumn key="outstanding" align="end">
                    {renderSortableHeader('Outstanding', 'outstanding', eventMasterSort, handleEventMasterSort)}
                  </TableColumn>
                </TableHeader>
                <TableBody emptyContent="No events in this view.">
                  {pagedEventMasterRows.map((event: any) => {
                        const durationDays = eventsScreen.computeEventDurationDays(event);
                        const amount = eventsScreen.eventChargeAmount(event);
                        const outstanding = eventsScreen.eventAmountDue(event);
                        const coordinator = eventsScreen.resolveEventCoordinator(event);
                        const bucket = eventDeskBucket(event);
                        return (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleOpenEventFolio(event)}
                      >
                        <TableCell>
                          <span className="whitespace-nowrap font-mono text-xs text-gray-600">
                            {eventsScreen.formatEventId(event.id)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[16rem]">
                            <p className="truncate font-semibold text-ghana-black" title={event.eventName || 'Unnamed Event'}>{event.eventName || 'Unnamed Event'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{event.organization || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap text-slate-700">{eventStayType(event)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap text-slate-700">{event.venueName || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap">
                            {formatEventTableDate(event.arrivalDate || event.startDate) || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap">
                            {formatEventTableDate(event.departureDate || event.endDate) || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="tabular-nums text-slate-600">{durationDays}</span>
                        </TableCell>
                        <TableCell>
                          <span className="tabular-nums text-slate-600">{event.pax || event.expectedPax || 0}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <Chip size="sm" variant="flat" color={isEventNoShow(event) ? 'danger' : getConfirmedStatusColor(event.eventStatus || event.status || 'confirmed') as any}>
                              {isEventNoShow(event) ? 'No show' : getConfirmedStatusLabel(event.eventStatus || event.status || 'confirmed')}
                            </Chip>
                            {event.eventStatus === 'in-progress' && eventsScreen.eventEndsToday(event) && (
                              <span className="text-[11px] text-amber-700">Ends today</span>
                            )}
                            {bucket === 'active' && event.checkedIn && (
                              <span className="text-[11px] text-emerald-700">In house</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`whitespace-nowrap text-sm ${coordinator === UNASSIGNED_STAFF ? 'text-amber-600' : 'text-slate-700'}`}>
                            {coordinator}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap tabular-nums font-medium text-slate-900">
                            {eventsScreen.formatCurrency(amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap tabular-nums font-medium text-slate-900">
                            {eventsScreen.formatCurrency(outstanding)}
                          </span>
                        </TableCell>
                      </TableRow>
                        );
                      })}
                </TableBody>
              </Table>
              <div className="flex justify-end mt-3">
                <Pagination
                  page={eventMasterPage}
                  total={eventMasterPages}
                  onChange={setEventMasterPage}
                  showControls
                  size="sm"
                />
              </div>
              </>
              )}
              {managementViewMode === 'calendar' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h5 className="text-base font-semibold text-slate-800">{eventsScreen.calendarHeaderTitle}</h5>
                      <p className="text-xs text-slate-500">
                        {eventsScreen.eventCalendarView === 'day'
                          ? `${managementDayEvents.length} event${managementDayEvents.length === 1 ? '' : 's'} on this day`
                          : eventsScreen.eventCalendarView === 'week'
                            ? `${managementCalendarWeekEventCount} event${managementCalendarWeekEventCount === 1 ? '' : 's'} this week`
                            : `${managementCalendarMonthEventCount} event${managementCalendarMonthEventCount === 1 ? '' : 's'} in this month`}
                        {eventsScreen.eventCalendarView === 'month' && filteredManagedEvents.length !== managementCalendarMonthEventCount
                          ? ` · ${filteredManagedEvents.length} match the current filters`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button size="sm" variant="light" onPress={() => eventsScreen.handleCalendarNavigate(-1)}>‹</Button>
                      <Button size="sm" variant="bordered" onPress={eventsScreen.handleCalendarToday}>Today</Button>
                      <Button size="sm" variant="light" onPress={() => eventsScreen.handleCalendarNavigate(1)}>›</Button>
                      <Input
                        size="sm"
                        type={eventsScreen.eventCalendarView === 'month' ? 'month' : 'date'}
                        aria-label={eventsScreen.eventCalendarView === 'month' ? 'Month' : 'Date'}
                        value={eventsScreen.eventCalendarView === 'month' ? eventsScreen.calendarMonthInputValue : eventsScreen.calendarDateInputValue}
                        onChange={(e) => eventsScreen.handleCalendarDateInput(e.target.value)}
                        className="w-[150px]"
                      />
                      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                        {(['month', 'week', 'day'] as const).map((view) => (
                          <Button
                            key={view}
                            size="sm"
                            variant={eventsScreen.eventCalendarView === view ? 'solid' : 'light'}
                            color={eventsScreen.eventCalendarView === view ? 'primary' : 'default'}
                            className="min-w-[4.25rem] capitalize"
                            onPress={() => eventsScreen.handleCalendarViewChange(view)}
                          >
                            {view}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {eventsScreen.eventCalendarView === 'month' && (
                    <div className="grid grid-cols-7 gap-1.5">
                      {eventsScreen.calendarDayNames.map(day => (
                        <div key={`header-${day}`} className="px-1 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {day}
                        </div>
                      ))}
                      {eventsScreen.calendarGridDays.map(dayInfo => {
                        const cellEvents = managementEventsByDay.get(dayInfo.key) || [];
                        const isToday = dayInfo.key === eventsScreen.todayKey;
                        return (
                          <div
                            key={dayInfo.key}
                            className={`min-h-[108px] rounded-lg border p-2 ${
                              dayInfo.isCurrentMonth ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'
                            } ${isToday ? 'border-primary-400 ring-1 ring-primary-300' : ''}`}
                          >
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className={`text-xs font-semibold ${
                                isToday ? 'text-primary-600' : dayInfo.isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
                              }`}>
                                {dayInfo.date.getDate()}
                              </span>
                              {cellEvents.length > 0 && (
                                <span className="text-[10px] tabular-nums text-slate-400">{cellEvents.length}</span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {cellEvents.slice(0, 3).map(renderCalendarEventChip)}
                              {cellEvents.length > 3 && (
                                <p className="text-[11px] text-slate-500">+{cellEvents.length - 3} more</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {eventsScreen.eventCalendarView === 'week' && (
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-7">
                      {eventsScreen.calendarWeekDays.map(day => {
                        const key = eventsScreen.formatDateKey(day);
                        const eventsForDay = managementEventsByDay.get(key) || [];
                        const isToday = key === eventsScreen.todayKey;
                        return (
                          <div
                            key={key}
                            className={`min-h-[160px] rounded-lg border p-2 ${
                              isToday ? 'border-primary-400 bg-primary-50/40' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className={`text-xs font-semibold ${isToday ? 'text-primary-700' : 'text-slate-700'}`}>
                                {day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                              </span>
                              {eventsForDay.length > 0 && (
                                <span className="text-[10px] tabular-nums text-slate-400">{eventsForDay.length}</span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {eventsForDay.length === 0 ? (
                                <p className="text-[11px] text-slate-400">No events</p>
                              ) : (
                                eventsForDay.map(renderCalendarEventChip)
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {eventsScreen.eventCalendarView === 'day' && (
                    <Table
                      aria-label="Events for selected day"
                      removeWrapper
                      classNames={managementTableClassNames}
                    >
                      <TableHeader>
                        <TableColumn>Event ID</TableColumn>
                        <TableColumn>Event</TableColumn>
                        <TableColumn>Type</TableColumn>
                        <TableColumn>Venue</TableColumn>
                        <TableColumn>Start</TableColumn>
                        <TableColumn>End</TableColumn>
                        <TableColumn>Pax</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn align="end"> </TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="No events on this day.">
                        {managementDayEvents.map((event: any) => (
                          <TableRow key={event.id}>
                            <TableCell>
                              <span className="whitespace-nowrap font-mono text-xs text-slate-500">{eventsScreen.formatEventId(event.id)}</span>
                            </TableCell>
                            <TableCell>
                              <div className="min-w-[160px] max-w-[260px]">
                                <p className="font-medium text-slate-900 leading-5">{event.eventName || 'Unnamed Event'}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{event.organization || '—'}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="whitespace-nowrap">{eventStayType(event)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="whitespace-nowrap">{event.venueName || '—'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="whitespace-nowrap">{formatEventTableDate(eventStartValue(event)) || '—'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="whitespace-nowrap">{formatEventTableDate(eventEndValue(event)) || '—'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="tabular-nums">{event.pax || event.expectedPax || 0}</span>
                            </TableCell>
                            <TableCell>
                              <Chip size="sm" variant="flat" color={isEventNoShow(event) ? 'danger' : getConfirmedStatusColor(event.eventStatus || event.status || 'confirmed') as any}>
                                {isEventNoShow(event) ? 'No show' : getConfirmedStatusLabel(event.eventStatus || event.status || 'confirmed')}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <Button size="sm" variant="light" onPress={() => eventsScreen.openEventForView(event)}>
                                  View
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
              {managementViewMode === 'gantt' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h5 className="text-base font-semibold text-slate-800">{managementGanttTimelineTitle}</h5>
                      <p className="text-xs text-slate-500">
                        {managementGanttTimelineRangeLabel} · daily pax totals at the bottom
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button size="sm" variant="light" onPress={() => handleManagementGanttNavigate(-1)}>‹</Button>
                      <Button
                        size="sm"
                        variant="bordered"
                        onPress={() => setManagementGanttReferenceDate(eventsScreen.getStartOfMonth(new Date()))}
                      >
                        Today
                      </Button>
                      <Button size="sm" variant="light" onPress={() => handleManagementGanttNavigate(1)}>›</Button>
                      <Input
                        size="sm"
                        type="month"
                        aria-label="Timeline month"
                        value={managementGanttMonthInputValue}
                        onChange={(e) => handleManagementGanttMonthInput(e.target.value)}
                        className="w-[150px]"
                      />
                      <Select
                        size="sm"
                        aria-label="Venue"
                        selectedKeys={[managementSelectedGanttVenue]}
                        onSelectionChange={(keys) => setManagementSelectedGanttVenue(Array.from(keys)[0] as string)}
                        className="w-48"
                        items={[{ id: 'all', name: 'All venues' }, ...managementGanttVenues]}
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
                    <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                      No venues in the current Event Master filters.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <div className="min-w-[760px]">
                        <div className="flex border-b border-slate-200 bg-slate-50">
                          <div className="w-40 shrink-0 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Venue
                          </div>
                          <div className="relative flex-1">
                            <div className="flex">
                              {managementTimelineDays.map((day) => {
                                const isToday = eventsScreen.formatDateKey(day) === eventsScreen.todayKey;
                                return (
                                  <div
                                    key={`gantt-head-${eventsScreen.formatDateKey(day)}`}
                                    className={`flex-1 py-1.5 text-center ${isToday ? 'text-primary-600' : 'text-slate-400'}`}
                                  >
                                    <div className="text-[10px] uppercase">{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</div>
                                    <div className={`text-[11px] tabular-nums ${isToday ? 'font-semibold' : ''}`}>{day.getDate()}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        {managementGanttVenuesToRender.map((venue) => {
                          const eventsForVenueTimeline = getManagedEventsForVenue(
                            venue.id,
                            managementGanttTimelineStart,
                            managementGanttTimelineEnd
                          );
                          const positionedEvents: Array<{
                            event: any;
                            leftPercent: number;
                            widthPercent: number;
                            overlapIndex: number;
                          }> = [];
                          const levelEndMap = new Map<number, Date>();

                          eventsForVenueTimeline.forEach((event: any) => {
                            const rawStart = parseEventDate(eventStartValue(event));
                            const rawEnd = parseEventDate(eventEndValue(event)) || rawStart;
                            if (!rawStart || !rawEnd) return;
                            const clampedStart = eventsScreen.clampDateToRange(rawStart, managementGanttTimelineStart, managementGanttTimelineEnd);
                            const clampedEnd = eventsScreen.clampDateToRange(rawEnd, managementGanttTimelineStart, managementGanttTimelineEnd);
                            const offsetDays = Math.max(0, Math.round((clampedStart.getTime() - managementGanttTimelineStart.getTime()) / eventsScreen.DAY_IN_MS));
                            const spanDays = Math.max(1, Math.round((clampedEnd.getTime() - clampedStart.getTime()) / eventsScreen.DAY_IN_MS) + 1);
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

                            positionedEvents.push({ event, leftPercent, widthPercent, overlapIndex });
                          });

                          const laneCount = Math.max(1, positionedEvents.reduce((max, row) => Math.max(max, row.overlapIndex + 1), 0));
                          const trackHeight = 16 + laneCount * 30;
                          const today = eventsScreen.toStartOfDay(new Date());
                          const todayInRange = today >= managementGanttTimelineStart && today <= managementGanttTimelineEnd;
                          const todayLeft = todayInRange
                            ? (Math.round((today.getTime() - managementGanttTimelineStart.getTime()) / eventsScreen.DAY_IN_MS) / managementTimelineDayCount) * 100
                            : null;

                          return (
                            <div key={venue.id} className="flex border-b border-slate-100 last:border-b-0">
                              <div className="w-40 shrink-0 px-3 py-3">
                                <p className="text-sm font-medium text-slate-800">{venue.name}</p>
                                <p className="text-xs text-slate-500">
                                  {eventsForVenueTimeline.length} event{eventsForVenueTimeline.length === 1 ? '' : 's'}
                                </p>
                              </div>
                              <div className="relative flex-1 bg-white" style={{ height: trackHeight }}>
                                <div className="pointer-events-none absolute inset-0 flex">
                                  {managementTimelineDays.map((day) => (
                                    <div
                                      key={`gantt-grid-${venue.id}-${eventsScreen.formatDateKey(day)}`}
                                      className={`flex-1 border-l border-slate-100 first:border-l-0 ${
                                        eventsScreen.formatDateKey(day) === eventsScreen.todayKey ? 'bg-primary-50/50' : ''
                                      }`}
                                    />
                                  ))}
                                </div>
                                {todayLeft !== null && (
                                  <div
                                    className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-primary-500"
                                    style={{ left: `${todayLeft}%` }}
                                  />
                                )}
                                {positionedEvents.length === 0 && (
                                  <div className="absolute inset-0 flex items-center px-3 text-xs text-slate-400">
                                    No events in this month
                                  </div>
                                )}
                                {positionedEvents.map(({ event, leftPercent, widthPercent, overlapIndex }) => (
                                  <Tooltip
                                    key={event.id}
                                    content={
                                      <div className="max-w-xs space-y-0.5 p-1 text-slate-700">
                                        <p className="text-xs font-mono text-slate-400">{eventsScreen.formatEventId(event.id)}</p>
                                        <p className="text-sm font-semibold text-slate-900">{event.eventName || 'Unnamed Event'}</p>
                                        <p className="text-xs text-slate-500">{event.organization || '—'}</p>
                                        <p className="text-xs text-slate-500">
                                          {formatEventTableDate(eventStartValue(event)) || '—'} – {formatEventTableDate(eventEndValue(event)) || '—'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {eventStayType(event)} · {event.pax || event.expectedPax || 0} pax
                                        </p>
                                      </div>
                                    }
                                  >
                                    <button
                                      type="button"
                                      className={`absolute h-6 overflow-hidden rounded border px-2 text-left text-white ${ganttBarTone(event)}`}
                                      style={{
                                        left: `calc(${leftPercent}% + 1px)`,
                                        width: `calc(${widthPercent}% - 2px)`,
                                        top: 8 + overlapIndex * 30,
                                        minWidth: 8,
                                      }}
                                      onClick={() => eventsScreen.openEventForView(event)}
                                      onMouseEnter={() => setHoveredGanttEventId(event.id)}
                                      onMouseLeave={() => setHoveredGanttEventId(null)}
                                    >
                                      <span className="block truncate text-[11px] font-medium leading-6">
                                        {event.pax || event.expectedPax || 0} · {event.eventName || event.organization || eventsScreen.formatEventId(event.id)}
                                      </span>
                                    </button>
                                  </Tooltip>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex border-t border-slate-200 bg-slate-50">
                          <div className="w-40 shrink-0 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total pax</p>
                            <p className="text-[11px] text-slate-400">
                              {managementGanttDailyPax.reduce((sum, value) => sum + value, 0).toLocaleString()} this month
                            </p>
                          </div>
                          <div className="flex flex-1">
                            {managementGanttDailyPax.map((total, index) => {
                              const day = managementTimelineDays[index];
                              const isToday = day ? eventsScreen.formatDateKey(day) === eventsScreen.todayKey : false;
                              return (
                                <div
                                  key={`gantt-total-${index}`}
                                  className={`flex-1 py-2 text-center tabular-nums ${
                                    isToday ? 'bg-primary-50 font-semibold text-primary-700' : 'text-slate-700'
                                  }`}
                                >
                                  <span className="text-xs">{total > 0 ? total.toLocaleString() : '—'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {managementViewMode === 'function' && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h5 className="font-semibold text-lg sm:text-xl">📋 Provisional Function Schedule</h5>
                      <p className="text-xs text-slate-500">
                        Department duties from the BEO. Print or send so F&B, housekeeping, and reservations can post their work.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        color="primary" 
                        variant="flat"
                        className="flex-1 sm:flex-none min-w-[120px]"
                        onPress={() => exportManagementFunctionSchedulePDF()}
                      >
                        🖨️ Print Schedule
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
                        onPress={printDepartmentFunctionBriefing}
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

                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600">📊</span>
                      <span className="text-sm text-blue-800">
                        <strong>Department sheet:</strong> {filteredManagedEvents.length} event{filteredManagedEvents.length === 1 ? '' : 's'} · complete a BEO on Event Master to fill F&B and housekeeping duties
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table aria-label="Function schedule table" removeWrapper classNames={managementTableClassNames}>
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
                            const arrivalDate = new Date(event.arrivalDate || event.startDate);
                            const departureDate = new Date(event.departureDate || event.endDate);
                            const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

                            const formatDate = (date: Date) => {
                              if (Number.isNaN(date.getTime())) return '—';
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

                            const rooms = eventRoomCount(event);
                            const days = eventsScreen.computeEventDurationDays(event);

                            const getStatusBadge = (status: string) => {
                              const normalized = eventsScreen.normalizeStatus(status);
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
                                    {eventsScreen.getProgrammeType(event)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center font-medium">{event.pax || event.expectedPax || 0}</TableCell>
                                <TableCell className="text-center">
                                  {rooms ?? 'N/A'}
                                </TableCell>
                                <TableCell className="text-center">
                                  {rooms ? rooms * days : 'N/A'}
                                </TableCell>
                                <TableCell className="text-center font-medium">{days}</TableCell>
                                <TableCell>
                                  <Badge color="secondary" variant="flat">{event.venueName}</Badge>
                                </TableCell>
                                <TableCell className="max-w-xs">
                                  <div className="text-xs text-gray-700">
                                    {functionFbDuties(event)}
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-xs">
                                  <div className="text-xs text-gray-700">
                                    {functionHkDuties(event)}
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
        <Tab key="invoices" title={`🧾 Invoices (${managementTabCounts.invoices})`}>
          <Card className={`mt-2 ${deskTableCardClassName}`}>
            <CardBody className={deskTableCardBodyClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-800">Invoices</h3>
                <Button size="sm" color="primary" variant="solid" onPress={eventsScreen.openCreateInvoicePicker}>
                  New invoice
                </Button>
              </div>
              <Table
                aria-label="Event invoices"
                removeWrapper
                classNames={managementTableClassNames}
              >
                  <TableHeader>
                    <TableColumn key="invoiceId">
                      {renderSortableHeader('Invoice', 'invoiceId', invoiceSort, handleInvoiceSort)}
                    </TableColumn>
                    <TableColumn key="eventName">
                      {renderSortableHeader('Event', 'eventName', invoiceSort, handleInvoiceSort)}
                    </TableColumn>
                    <TableColumn key="issueDate">
                      {renderSortableHeader('Issued', 'issueDate', invoiceSort, handleInvoiceSort)}
                    </TableColumn>
                    <TableColumn key="dueDate">
                      {renderSortableHeader('Due', 'dueDate', invoiceSort, handleInvoiceSort)}
                    </TableColumn>
                    <TableColumn key="total" align="end">
                      {renderSortableHeader('Total', 'total', invoiceSort, handleInvoiceSort)}
                    </TableColumn>
                    <TableColumn key="balance" align="end">
                      {renderSortableHeader('Balance', 'balance', invoiceSort, handleInvoiceSort)}
                    </TableColumn>
                    <TableColumn key="status">
                      {renderSortableHeader('Status', 'status', invoiceSort, handleInvoiceSort)}
                    </TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No invoices in this view.">
                    {paginatedInvoices.map(invoice => (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          const relatedEvent = managedEvents.find((e: any) => e.id === invoice.eventId) || eventsScreen.allEvents.find((e: any) => e.id === invoice.eventId);
                          if (!relatedEvent) {
                            alert('Could not find the related event for this invoice. It may have been removed.');
                            return;
                          }
                          handleOpenEventFolio(relatedEvent);
                        }}
                      >
                        <TableCell>
                          <div className="font-mono text-xs text-slate-700">{eventsScreen.getConferenceInvoiceNumber(invoice.id, invoice.eventId) || invoice.id}</div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[160px] max-w-[260px]">
                            <p className="font-medium text-slate-900 leading-5">{invoice.eventName || '—'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{invoice.clientName || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap">{eventsScreen.formatDateDisplay(invoice.issueDate)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap">{eventsScreen.formatDateDisplay(invoice.dueDate)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap tabular-nums font-medium text-slate-900">{eventsScreen.formatCurrency(invoice.total)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap tabular-nums">{eventsScreen.formatCurrency(invoice.balance)}</span>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" color={eventsScreen.invoiceStatusMeta[invoice.status].color as any}>
                            {eventsScreen.invoiceStatusMeta[invoice.status].label}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end mt-3">
                    <Pagination
                      total={Math.max(1, invoicesPages)}
                      page={invoicesPage}
                      onChange={setInvoicesPage}
                      showControls
                      size="sm"
                    />
                  </div>
            </CardBody>
          </Card>
        </Tab>
        <Tab key="receipts" title={`💳 Receipts (${managementTabCounts.receipts})`}>
          <Card className={`mt-2 ${deskTableCardClassName}`}>
            <CardBody className={deskTableCardBodyClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-800">Receipts</h3>
                <Button size="sm" color="primary" variant="solid" onPress={eventsScreen.openCreateReceiptPicker}>
                  Record receipt
                </Button>
              </div>
              <Table
                aria-label="Event receipts"
                removeWrapper
                classNames={managementTableClassNames}
              >
                  <TableHeader>
                    <TableColumn key="receiptId">
                      {renderSortableHeader('Receipt', 'receiptId', receiptSort, handleReceiptSort)}
                    </TableColumn>
                    <TableColumn key="eventName">
                      {renderSortableHeader('Event', 'eventName', receiptSort, handleReceiptSort)}
                    </TableColumn>
                    <TableColumn key="date">
                      {renderSortableHeader('Date', 'date', receiptSort, handleReceiptSort)}
                    </TableColumn>
                    <TableColumn key="amount" align="end">
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
                    <TableColumn key="actions" align="end"> </TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No receipts in this view.">
                    {paginatedReceipts.map(receipt => (
                      <TableRow
                        key={receipt.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => eventsScreen.openReceiptModal('edit', receipt)}
                      >
                        <TableCell>
                          <div className="font-mono text-xs text-slate-700">{eventsScreen.getConferenceReceiptNumber(receipt.id, receipt.eventId) || receipt.id}</div>
                          <div className="text-xs text-slate-400">{receipt.recordedBy || receipt.id}</div>
                          {receipt.status === 'Void' && (
                            <Chip size="sm" variant="flat" color="danger" className="mt-1">
                              Void
                            </Chip>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[160px] max-w-[260px]">
                            <p className="font-medium text-slate-900 leading-5">{receipt.eventName || '—'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{receipt.clientName || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap">{eventsScreen.formatDateDisplay(receipt.date)}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`whitespace-nowrap tabular-nums font-medium ${receipt.status === 'Void' ? 'text-slate-400 line-through' : 'text-slate-900'}`} title={receipt.status === 'Void' ? 'Voided amount' : undefined}>
                            {eventsScreen.formatCurrency(receipt.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap">{paymentMethodLabel(resolveReceiptMethod(receipt.method))}</span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap text-slate-600">{receipt.reference || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap font-mono text-xs text-slate-500">{eventsScreen.getConferenceInvoiceNumber(receipt.invoiceId, receipt.eventId) || receipt.invoiceId || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                            {receipt.status !== 'Void' && (
                              <Button size="sm" variant="light" onPress={() => eventsScreen.handleDownloadReceiptPdf(receipt)}>
                                Print
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end mt-3">
                    <Pagination
                      total={Math.max(1, receiptsPages)}
                      page={receiptsPage}
                      onChange={setReceiptsPage}
                      showControls
                      size="sm"
                    />
                  </div>
            </CardBody>
          </Card>
        </Tab>
        <Tab key="folios" title={`📂 Folios (${managementTabCounts.folios})`}>
          <Card className={`mt-2 ${deskTableCardClassName}`}>
            <CardBody className={deskTableCardBodyClassName}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-800">Folios</h3>
                <Button size="sm" color="primary" variant="solid" onPress={eventsScreen.openCreateFolioPicker}>
                  New folio
                </Button>
              </div>
              <Table
                aria-label="Event folios"
                removeWrapper
                classNames={managementTableClassNames}
              >
                  <TableHeader>
                    <TableColumn key="folioId">
                      {renderSortableHeader('Folio', 'folioId', folioSort, handleFolioSort)}
                    </TableColumn>
                    <TableColumn key="createdAt">
                      {renderSortableHeader('Date', 'createdAt', folioSort, handleFolioSort)}
                    </TableColumn>
                    <TableColumn key="eventName">
                      {renderSortableHeader('Event', 'eventName', folioSort, handleFolioSort)}
                    </TableColumn>
                    <TableColumn key="status">
                      {renderSortableHeader('Status', 'status', folioSort, handleFolioSort)}
                    </TableColumn>
                    <TableColumn key="charges" align="end">
                      {renderSortableHeader('Charges', 'charges', folioSort, handleFolioSort)}
                    </TableColumn>
                    <TableColumn key="payments" align="end">
                      {renderSortableHeader('Payments', 'payments', folioSort, handleFolioSort)}
                    </TableColumn>
                    <TableColumn key="balance" align="end">
                      {renderSortableHeader('Balance', 'balance', folioSort, handleFolioSort)}
                    </TableColumn>
                    <TableColumn key="updatedAt">
                      {renderSortableHeader('Updated', 'updatedAt', folioSort, handleFolioSort)}
                    </TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No folios in this view.">
                    {paginatedFolios.map(folio => {
                      const totals = eventsScreen.calculateFolioTotals(folio);
                      const balance = eventsScreen.getFolioCurrentBalance(folio);
                      return (
                        <TableRow
                          key={folio.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => eventsScreen.openFolioDetails(folio)}
                        >
                          <TableCell>
                            <span className="whitespace-nowrap font-medium text-slate-900">{eventsScreen.formatFolioNumber(folio.id)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="whitespace-nowrap text-slate-600">{eventsScreen.formatDateDisplay(folio.createdAt)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[160px] max-w-[260px]">
                              <p className="font-medium text-slate-900 leading-5">{folio.eventName || '—'}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{folio.clientName || '—'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="sm"
                              variant="flat"
                              color={
                                folio.status === 'Void'
                                  ? 'danger'
                                  : eventsScreen.getFolioSettledStatus(folio) === 'Open'
                                    ? 'warning'
                                    : 'success'
                              }
                            >
                              {folio.status === 'Void'
                                ? 'Void'
                                : eventsScreen.getFolioSettledStatus(folio) === 'Closed'
                                  ? 'Settled'
                                  : 'Open'}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <span className="whitespace-nowrap tabular-nums">{eventsScreen.formatCurrency(totals.debits)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="whitespace-nowrap tabular-nums">{eventsScreen.formatCurrency(totals.credits)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="whitespace-nowrap tabular-nums font-medium text-slate-900">{eventsScreen.formatCurrency(balance)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="whitespace-nowrap">{eventsScreen.formatDateDisplay(folio.updatedAt)}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex justify-end mt-3">
                    <Pagination
                      total={Math.max(1, foliosPages)}
                      page={foliosPage}
                      onChange={setFoliosPage}
                      showControls
                      size="sm"
                    />
                  </div>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>
    </div>
  );
}
