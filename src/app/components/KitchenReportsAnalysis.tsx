'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, Button,
  Tabs, Tab, Select, SelectItem, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Textarea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip
} from '@heroui/react';
import {
  ArrowDownToLine, BarChart3, CalendarDays, FileSpreadsheet, FileText,
  Filter, Printer, RefreshCw, RotateCcw, Search, SlidersHorizontal, StickyNote, TrendingUp, X
} from 'lucide-react';
import ReportPageInfoTip from './dashboard/ReportPageInfoTip';
import { fetchFbOrders, fbTenantHeaders, type FbOrderDto } from '../lib/fb/api';
import { kitchenOpsStore } from '../lib/fb/kitchenOpsStore';
import { buildLiveStationBoard, stationForItem } from '../lib/fb/kitchenStations';
import { useSettingsStore } from '../lib/settings/store';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import { reportDataToSections, sectionsToCSV, sectionsToExcelHtml, sectionsToPdfBlob } from '../lib/frontoffice/reportExportFormat';
import { SortableReportTable } from './reports/SortableReportTable';

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function formatReportValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return shortStamp(String(value));
}

/** Local calendar day, plus the clock when the record has a real time. */
function stamp(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  const clock = `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  return clock === '00:00' ? day : `${day} ${clock}`;
}

function shortStamp(text: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? stamp(text) : text;
}

function money(value: number) {
  return `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function inDateRange(day: string, startDate: string, endDate: string) {
  return Boolean(day) && day >= startDate && day <= endDate;
}

function dayOf(iso?: string | null) {
  return (iso || '').slice(0, 10);
}

function kitchenItems(order: FbOrderDto) {
  return order.items.filter((item) => (item.route ?? 'kitchen') === 'kitchen');
}

function isKitchenTicket(order: FbOrderDto) {
  return kitchenItems(order).length > 0;
}

function prepMinutes(order: FbOrderDto): number | null {
  const startRaw = order.preparingAt || order.createdAt;
  const endRaw = order.servedAt;
  if (!endRaw) return null;
  const mins = (new Date(endRaw).getTime() - new Date(startRaw).getTime()) / 60_000;
  if (!Number.isFinite(mins) || mins <= 0 || mins >= 180) return null;
  return Math.round(mins * 10) / 10;
}

const RANGE_REPORT_KEYS = new Set([
  'tickets', 'prep-times', 'operations-log', 'requisitions', 'cook-performance',
]);
const NO_DATE_REPORT_KEYS = new Set(['stations', 'inventory', 'recipes']);

const REPORT_GROUPS = {
  board: {
    title: 'Board & Stations',
    description: 'Kitchen tickets, prep times, station load and the operations log.',
    reports: [
      ['tickets', 'Tickets'],
      ['prep-times', 'Prep Times'],
      ['stations', 'Station Load'],
      ['operations-log', 'Operations Log'],
    ],
  },
  stores: {
    title: 'Stores',
    description: 'Kitchen on-hand stock and requisitions sent to Stores.',
    reports: [
      ['inventory', 'Inventory'],
      ['requisitions', 'Requisitions'],
    ],
  },
  control: {
    title: 'Control',
    description: 'Recipes on file and cook throughput for the period.',
    reports: [
      ['recipes', 'Recipes'],
      ['cook-performance', 'Cook Performance'],
    ],
  },
} as const;

type ReportGroupKey = keyof typeof REPORT_GROUPS;
type ReportFilters = {
  query: string;
  status: string;
  station: string;
  staff: string;
  category: string;
  priority: string;
};

const EMPTY_REPORT_FILTERS: ReportFilters = {
  query: '',
  status: 'all',
  station: 'all',
  staff: 'all',
  category: 'all',
  priority: 'all',
};

const REPORT_DESCRIPTIONS: Record<string, string> = {
  tickets: 'Kitchen-routed tickets: table or room, cook, items, status and priority.',
  'prep-times': 'Tickets that have a served time, with minutes from fire to pass.',
  stations: 'Current station load from open kitchen tickets.',
  'operations-log': 'Assign, status and ready events recorded from the kitchen display.',
  inventory: 'Kitchen on-hand stock after Stores has fulfilled requisitions.',
  requisitions: 'Stock requests Kitchen sent to Stores, with status.',
  recipes: 'Recipes currently on file for the kitchen.',
  'cook-performance': 'Tickets and items attributed to each assigned cook.',
};

type ReportColumnDefinition = { key: string; label: string; defaultVisible?: boolean };

const REPORT_COLUMNS: Record<string, ReportColumnDefinition[]> = {
  tickets: [
    { key: 'orderNumber', label: 'Ticket' },
    { key: 'createdAt', label: 'Fired' },
    { key: 'venue', label: 'Venue' },
    { key: 'table', label: 'Table / room' },
    { key: 'guestName', label: 'Guest', defaultVisible: false },
    { key: 'cook', label: 'Cook' },
    { key: 'itemCount', label: 'Items' },
    { key: 'items', label: 'Dish list' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
  ],
  'prep-times': [
    { key: 'orderNumber', label: 'Ticket' },
    { key: 'cook', label: 'Cook' },
    { key: 'items', label: 'Dishes' },
    { key: 'startedAt', label: 'Started' },
    { key: 'servedAt', label: 'Served' },
    { key: 'prepMinutes', label: 'Prep (min)' },
    { key: 'status', label: 'Status' },
  ],
  stations: [
    { key: 'name', label: 'Station' },
    { key: 'status', label: 'Status' },
    { key: 'chef', label: 'Cook' },
    { key: 'activeCount', label: 'Open tickets' },
    { key: 'currentOrders', label: 'Tickets' },
    { key: 'specializations', label: 'Specialties', defaultVisible: false },
  ],
  'operations-log': [
    { key: 'at', label: 'Time' },
    { key: 'orderId', label: 'Ticket' },
    { key: 'table', label: 'Table' },
    { key: 'itemName', label: 'Items' },
    { key: 'action', label: 'Action' },
    { key: 'fromStatus', label: 'From', defaultVisible: false },
    { key: 'toStatus', label: 'To' },
    { key: 'assignedToName', label: 'Cook' },
    { key: 'priority', label: 'Priority', defaultVisible: false },
  ],
  inventory: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'onHand', label: 'On hand' },
    { key: 'unit', label: 'Unit' },
    { key: 'unitCost', label: 'Unit cost' },
    { key: 'stockValue', label: 'Value' },
    { key: 'isActive', label: 'Active', defaultVisible: false },
  ],
  requisitions: [
    { key: 'requisitionNumber', label: 'Requisition' },
    { key: 'requestedDate', label: 'Requested' },
    { key: 'requestedBy', label: 'Requested by' },
    { key: 'status', label: 'Status' },
    { key: 'itemCount', label: 'Lines' },
    { key: 'items', label: 'Items' },
    { key: 'notes', label: 'Notes', defaultVisible: false },
  ],
  recipes: [
    { key: 'name', label: 'Recipe' },
    { key: 'category', label: 'Category' },
    { key: 'preparationTime', label: 'Prep (min)' },
    { key: 'difficulty', label: 'Difficulty' },
    { key: 'ingredientCount', label: 'Ingredients' },
    { key: 'allergens', label: 'Allergens', defaultVisible: false },
  ],
  'cook-performance': [
    { key: 'cook', label: 'Cook' },
    { key: 'tickets', label: 'Tickets' },
    { key: 'items', label: 'Items' },
    { key: 'completed', label: 'Completed' },
    { key: 'avgPrepMinutes', label: 'Avg prep (min)' },
  ],
};

type InventoryRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  isActive: boolean;
};

type RequisitionRow = {
  requisitionNumber: string;
  requestedBy: string;
  requestedDate: string;
  status: string;
  notes: string;
  items: { itemName: string; quantity: number }[];
};

type RecipeRow = {
  name: string;
  category: string;
  preparationTime: number;
  difficulty: string;
  allergens: string[];
  ingredients: unknown[];
};

function ticketRows(orders: FbOrderDto[], startDate: string, endDate: string) {
  return orders
    .filter(isKitchenTicket)
    .filter((order) => inDateRange(dayOf(order.createdAt), startDate, endDate))
    .map((order) => {
      const items = kitchenItems(order);
      return {
        orderNumber: order.orderNumber,
        createdAt: stamp(order.createdAt),
        venue: order.venue || '—',
        table: order.tableNumber || order.roomNumber || '—',
        guestName: order.guestName || '—',
        cook: order.assignedToName || 'Unassigned',
        itemCount: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
        items: items.map((item) => `${item.quantity}× ${item.name}`).join(', '),
        status: order.status,
        priority: order.priority || (order.urgent ? 'urgent' : 'normal'),
        station: [...new Set(items.map((item) => stationForItem(item.name, item.category)))].join(', '),
      };
    });
}

function prepTimeRows(orders: FbOrderDto[], startDate: string, endDate: string) {
  return orders
    .filter(isKitchenTicket)
    .filter((order) => inDateRange(dayOf(order.servedAt || order.createdAt), startDate, endDate))
    .map((order) => ({
      orderNumber: order.orderNumber,
      cook: order.assignedToName || 'Unassigned',
      items: kitchenItems(order).map((item) => `${item.quantity}× ${item.name}`).join(', '),
      startedAt: stamp(order.preparingAt || order.createdAt),
      servedAt: stamp(order.servedAt),
      prepMinutes: prepMinutes(order),
      status: order.status,
    }))
    .filter((row) => row.prepMinutes !== null);
}

function cookPerformanceRows(orders: FbOrderDto[], startDate: string, endDate: string) {
  const byCook: Record<string, { tickets: number; items: number; completed: number; prep: number[] }> = {};
  for (const order of orders.filter(isKitchenTicket).filter((row) => inDateRange(dayOf(row.createdAt), startDate, endDate))) {
    const cook = order.assignedToName || 'Unassigned';
    if (!byCook[cook]) byCook[cook] = { tickets: 0, items: 0, completed: 0, prep: [] };
    byCook[cook].tickets += 1;
    byCook[cook].items += kitchenItems(order).reduce((sum, item) => sum + (item.quantity || 0), 0);
    if (order.status === 'ready' || order.status === 'served' || order.status === 'billed') byCook[cook].completed += 1;
    const mins = prepMinutes(order);
    if (mins !== null) byCook[cook].prep.push(mins);
  }
  return Object.entries(byCook)
    .map(([cook, data]) => ({
      cook,
      tickets: data.tickets,
      items: data.items,
      completed: data.completed,
      avgPrepMinutes: data.prep.length
        ? Math.round((data.prep.reduce((sum, value) => sum + value, 0) / data.prep.length) * 10) / 10
        : null,
    }))
    .sort((a, b) => b.tickets - a.tickets);
}

export default function KitchenReportsAnalysis({ embedded = false }: { embedded?: boolean } = {}) {
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('board');
  const [selectedReport, setSelectedReport] = useState('tickets');
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
  const [orders, setOrders] = useState<FbOrderDto[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryRow[]>([]);
  const [stockOnHand, setStockOnHand] = useState<Record<string, number>>({});
  const [requisitions, setRequisitions] = useState<RequisitionRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [opsTick, setOpsTick] = useState(0);

  const settings = useSettingsStore();
  const orgProfile = buildOrgProfile(settings);
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kitchen.report-summary-preferences');
      if (saved) setHiddenKpisByReport(JSON.parse(saved));
      const savedColumns = localStorage.getItem('kitchen.report-column-preferences');
      if (savedColumns) setHiddenColumnsByReport(JSON.parse(savedColumns));
    } catch {
      // A blocked or malformed local preference should never prevent reporting.
    }
  }, []);

  const loadReports = async () => {
    const headers = fbTenantHeaders();
    const [nextOrders, inventoryRes, stockRes, requisitionRes, recipeRes] = await Promise.all([
      fetchFbOrders().catch(() => [] as FbOrderDto[]),
      fetch('/api/inventory/items', { headers }).then((res) => (res.ok ? res.json() : { items: [] })).catch(() => ({ items: [] })),
      fetch('/api/inventory/stock-levels?department=kitchen', { headers }).then((res) => (res.ok ? res.json() : { items: [] })).catch(() => ({ items: [] })),
      fetch('/api/inventory/requisitions?department=kitchen', { headers }).then((res) => (res.ok ? res.json() : { requisitions: [] })).catch(() => ({ requisitions: [] })),
      fetch('/api/fb/recipes', { headers }).then((res) => (res.ok ? res.json() : { recipes: [] })).catch(() => ({ recipes: [] })),
    ]);
    setOrders(nextOrders);
    setInventoryItems((inventoryRes.items || []).map((item: any) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category?.name || '—',
      unit: item.unit?.name || '—',
      unitCost: Number(item.defaultCost || 0),
      isActive: item.isActive,
    })));
    setStockOnHand(Object.fromEntries((stockRes.items || []).map((item: any) => [item.id, Number(item.onHand || 0)])));
    setRequisitions((requisitionRes.requisitions || []).map((req: any) => ({
      requisitionNumber: req.requisitionNumber,
      requestedBy: req.requestedBy,
      requestedDate: req.requestedDate || req.createdAt,
      status: req.status,
      notes: req.notes || '',
      items: (req.items || []).map((item: any) => ({ itemName: item.itemName, quantity: Number(item.quantity) })),
    })));
    setRecipes((recipeRes.recipes || []).map((recipe: any) => ({
      name: recipe.name,
      category: recipe.category,
      preparationTime: recipe.preparationTime,
      difficulty: recipe.difficulty,
      allergens: recipe.allergens || [],
      ingredients: recipe.ingredients || [],
    })));
  };

  useEffect(() => {
    loadReports();
    const unsub = kitchenOpsStore.subscribe(() => setOpsTick((tick) => tick + 1));
    return unsub;
  }, []);

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, selectedTab, startDate, endDate, refreshVersion, orders, opsTick]);

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
    loadReports().then(() => {
      setRefreshVersion((version) => version + 1);
      setGeneratedAt(new Date().toLocaleString('en-GH'));
    });
  };

  const getCurrentReportData = () => {
    switch (selectedReport) {
      case 'tickets':
        return ticketRows(orders, startDate, endDate);
      case 'prep-times':
        return prepTimeRows(orders, startDate, endDate);
      case 'stations':
        return buildLiveStationBoard(orders).map((station) => ({
          name: station.name,
          status: station.status,
          chef: station.chef,
          activeCount: station.activeCount,
          currentOrders: station.currentOrders.join(', ') || '—',
          specializations: station.specializations.join(', '),
        }));
      case 'operations-log':
        return kitchenOpsStore.all()
          .filter((row) => inDateRange(dayOf(row.at), startDate, endDate))
          .map((row) => ({
            at: stamp(row.at),
            orderId: row.orderId,
            table: row.table || '—',
            itemName: row.itemName,
            action: row.action,
            fromStatus: row.fromStatus || '—',
            toStatus: row.toStatus || '—',
            assignedToName: row.assignedToName || row.preparedByName || '—',
            priority: row.priority || 'normal',
          }));
      case 'inventory':
        return inventoryItems.map((item) => ({
          code: item.code,
          name: item.name,
          category: item.category,
          onHand: stockOnHand[item.id] ?? 0,
          unit: item.unit,
          unitCost: item.unitCost,
          stockValue: (stockOnHand[item.id] ?? 0) * item.unitCost,
          isActive: item.isActive,
        }));
      case 'requisitions':
        return requisitions
          .filter((row) => inDateRange(dayOf(row.requestedDate), startDate, endDate))
          .map((row) => ({
            requisitionNumber: row.requisitionNumber,
            requestedDate: row.requestedDate ? new Date(row.requestedDate).toLocaleString('en-GH') : '—',
            requestedBy: row.requestedBy || '—',
            status: row.status,
            itemCount: row.items.length,
            items: row.items.map((item) => `${item.quantity}× ${item.itemName}`).join(', '),
            notes: row.notes || '—',
          }));
      case 'recipes':
        return recipes.map((recipe) => ({
          name: recipe.name,
          category: recipe.category,
          preparationTime: recipe.preparationTime,
          difficulty: recipe.difficulty,
          ingredientCount: recipe.ingredients.length,
          allergens: (recipe.allergens || []).join(', ') || '—',
        }));
      case 'cook-performance':
        return cookPerformanceRows(orders, startDate, endDate);
      default:
        return ticketRows(orders, startDate, endDate);
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
    station: uniqueValues(['station', 'name']),
    staff: uniqueValues(['cook', 'chef', 'assignedToName', 'requestedBy']),
    category: uniqueValues(['category', 'action', 'difficulty']),
    priority: uniqueValues(['priority']),
  };
  const rows = rawRows.filter((row) => {
    const query = filters.query.trim().toLocaleLowerCase();
    const matchesQuery = !query || Object.values(row).some((value) => {
      const searchable = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      return searchable.toLocaleLowerCase().includes(query);
    });
    return matchesQuery
      && (filters.status === 'all' || fieldValue(row, ['status']) === filters.status)
      && (filters.station === 'all' || fieldValue(row, ['station', 'name']) === filters.station)
      && (filters.staff === 'all' || fieldValue(row, ['cook', 'chef', 'assignedToName', 'requestedBy']) === filters.staff)
      && (filters.category === 'all' || fieldValue(row, ['category', 'action', 'difficulty']) === filters.category)
      && (filters.priority === 'all' || fieldValue(row, ['priority']) === filters.priority);
  });
  const filteredReportData = Array.isArray(reportData) ? rows : reportData;
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === 'query' ? Boolean(value.trim()) : value !== 'all').length;
  const facetDefinitions = ([
    { key: 'status', label: 'Status', options: filterOptions.status },
    { key: 'station', label: 'Station', options: filterOptions.station },
    { key: 'staff', label: 'Cook', options: filterOptions.staff },
    { key: 'category', label: 'Category', options: filterOptions.category },
    { key: 'priority', label: 'Priority', options: filterOptions.priority },
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
      localStorage.setItem('kitchen.report-column-preferences', JSON.stringify(next));
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
    if (selectedReport === 'tickets') {
      const open = rows.filter((row) => row.status === 'pending' || row.status === 'preparing' || row.status === 'ready').length;
      return [
        { label: 'Tickets', value: count.toLocaleString(), hint: 'Kitchen-routed orders' },
        { label: 'Open on the pass', value: open.toLocaleString(), hint: 'Pending, preparing or ready' },
        { label: 'Items', value: rows.reduce((sum, row) => sum + Number(row.itemCount || 0), 0).toLocaleString(), hint: 'Kitchen line quantities' },
        { label: 'Urgent', value: rows.filter((row) => String(row.priority) === 'urgent').length.toLocaleString(), hint: 'Marked urgent' },
      ];
    }
    if (selectedReport === 'prep-times') {
      const times = rows.map((row) => Number(row.prepMinutes || 0)).filter((value) => value > 0);
      const avg = times.length ? times.reduce((sum, value) => sum + value, 0) / times.length : 0;
      return [
        { label: 'Timed tickets', value: count.toLocaleString(), hint: 'Have a served time' },
        { label: 'Avg prep', value: avg ? `${avg.toLocaleString(undefined, { maximumFractionDigits: 1 })} min` : '—', hint: 'Fire to served' },
        { label: 'Fastest', value: times.length ? `${Math.min(...times)} min` : '—', hint: 'Shortest recorded' },
        { label: 'Slowest', value: times.length ? `${Math.max(...times)} min` : '—', hint: 'Longest recorded' },
      ];
    }
    if (selectedReport === 'stations') {
      return [
        { label: 'Stations', value: count.toLocaleString(), hint: 'Configured board' },
        { label: 'Busy', value: rows.filter((row) => row.status === 'busy').length.toLocaleString(), hint: 'Holding tickets' },
        { label: 'Open tickets', value: rows.reduce((sum, row) => sum + Number(row.activeCount || 0), 0).toLocaleString(), hint: 'Across stations' },
        { label: 'Clear', value: rows.filter((row) => row.status === 'available').length.toLocaleString(), hint: 'No open tickets' },
      ];
    }
    if (selectedReport === 'operations-log') {
      return [
        { label: 'Events', value: count.toLocaleString(), hint: 'KDS actions in period' },
        { label: 'Assigned', value: rows.filter((row) => row.action === 'assigned').length.toLocaleString(), hint: 'Cook assignments' },
        { label: 'Status changes', value: rows.filter((row) => row.action === 'status').length.toLocaleString(), hint: 'Board bumps' },
        { label: 'Prepared', value: rows.filter((row) => row.action === 'prepared').length.toLocaleString(), hint: 'Marked prepared' },
      ];
    }
    if (selectedReport === 'inventory') {
      return [
        { label: 'Catalog items', value: count.toLocaleString(), hint: 'Kitchen catalog' },
        { label: 'In stock', value: rows.filter((row) => Number(row.onHand || 0) > 0).length.toLocaleString(), hint: 'On-hand above zero' },
        { label: 'Zero stock', value: rows.filter((row) => Number(row.onHand || 0) <= 0).length.toLocaleString(), hint: 'Need a requisition' },
        { label: 'Stock value', value: money(rows.reduce((sum, row) => sum + Number(row.stockValue || 0), 0)), hint: 'On-hand cost' },
      ];
    }
    if (selectedReport === 'requisitions') {
      return [
        { label: 'Requisitions', value: count.toLocaleString(), hint: 'Sent to Stores' },
        { label: 'Pending', value: rows.filter((row) => row.status === 'pending').length.toLocaleString(), hint: 'Awaiting approval' },
        { label: 'Ready', value: rows.filter((row) => row.status === 'ready').length.toLocaleString(), hint: 'Staged for pickup' },
        { label: 'Lines', value: rows.reduce((sum, row) => sum + Number(row.itemCount || 0), 0).toLocaleString(), hint: 'Requested items' },
      ];
    }
    if (selectedReport === 'recipes') {
      return [
        { label: 'Recipes', value: count.toLocaleString(), hint: 'On file' },
        { label: 'Hard', value: rows.filter((row) => row.difficulty === 'hard').length.toLocaleString(), hint: 'Difficulty' },
        { label: 'Avg prep', value: count ? `${Math.round(rows.reduce((sum, row) => sum + Number(row.preparationTime || 0), 0) / count)} min` : '—', hint: 'Recipe time' },
        { label: 'Categories', value: new Set(rows.map((row) => row.category).filter(Boolean)).size.toLocaleString(), hint: 'On file' },
      ];
    }
    if (selectedReport === 'cook-performance') {
      const timed = rows.map((row) => Number(row.avgPrepMinutes || 0)).filter((value) => value > 0);
      return [
        { label: 'Cooks', value: count.toLocaleString(), hint: 'With attributed tickets' },
        { label: 'Tickets', value: rows.reduce((sum, row) => sum + Number(row.tickets || 0), 0).toLocaleString(), hint: 'In period' },
        { label: 'Completed', value: rows.reduce((sum, row) => sum + Number(row.completed || 0), 0).toLocaleString(), hint: 'Ready, served or billed' },
        { label: 'Avg prep', value: timed.length ? `${(timed.reduce((sum, value) => sum + value, 0) / timed.length).toLocaleString(undefined, { maximumFractionDigits: 1 })} min` : '—', hint: 'Across cooks with times' },
      ];
    }
    return [
      { label: 'Records', value: count.toLocaleString(), hint: 'Matching the filters' },
      { label: 'Period start', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : startDate, hint: 'Business date' },
      { label: 'Period end', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : endDate, hint: reportDateMode === 'range' ? 'Inclusive' : 'Single day' },
      { label: 'Status', value: 'Current', hint: generatedAt ? `Refreshed ${generatedAt}` : 'Preparing report' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshVersion, mounted, filters, orders, opsTick, inventoryItems, stockOnHand, requisitions, recipes]);

  const hiddenKpiLabels = hiddenKpisByReport[selectedReport] || [];
  const visibleReportKpis = reportKpis.filter((kpi) => !hiddenKpiLabels.includes(kpi.label));
  const saveKpiPreferences = (hiddenLabels: string[]) => {
    const next = { ...hiddenKpisByReport, [selectedReport]: hiddenLabels };
    setHiddenKpisByReport(next);
    try {
      localStorage.setItem('kitchen.report-summary-preferences', JSON.stringify(next));
    } catch {
      // Keep the in-session preference even when storage is unavailable.
    }
  };
  const summaryCustomizationControls = (
    <>
      {hiddenKpiLabels.length > 0 && (
        <Button size="sm" variant="light" startContent={<RotateCcw size={14} />} onPress={() => saveKpiPreferences([])}>
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
    } catch (error) {
      console.error('[KITCHEN REPORTS] Error exporting report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderReportTable = () => {
    if (!mounted || reportData === null) {
      return (
        <div className="py-8 text-center">
          <p className="text-gray-500">Preparing report…</p>
        </div>
      );
    }

    if (rows.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-gray-500">
            {activeFilterCount > 0
              ? 'No records match the active filters. Clear or adjust the filters to continue.'
              : 'No data available for the selected report and date.'}
          </p>
        </div>
      );
    }

    return (
      <SortableReportTable
        ariaLabel={`${selectedReport} report table`}
        columns={visibleColumns}
        rows={rows}
        renderCell={(row, column) => (
          typeof row[column.key] === 'number' && /(amount|total|cost|value|price)/i.test(column.key)
            ? money(row[column.key] as number)
            : typeof row[column.key] === 'boolean'
            ? (row[column.key] ? 'Yes' : 'No')
            : row[column.key] === null || row[column.key] === undefined
            ? '—'
            : formatReportValue(row[column.key])
        )}
      />
    );
  };

  return (
    <div className={embedded ? 'px-2 py-1' : 'min-h-screen bg-slate-50/70 p-4 md:p-6'}>
      <div className="mx-auto max-w-[1600px] space-y-2">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <BarChart3 size={16} />
              KITCHEN INTELLIGENCE
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Reports & Analysis</h1>
              <ReportPageInfoTip text="Pass control, station load and kitchen stock from one workspace." />
            </div>
          </div>
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto">
            <Button size="sm" variant="flat" className="shrink-0" startContent={<RefreshCw size={16} />} onPress={handleRefresh}>
              Refresh
            </Button>
            <Button size="sm" variant="bordered" className="shrink-0" startContent={<StickyNote size={16} />} onPress={onOpen}>
              Notes
            </Button>
            <Button size="sm" variant="bordered" className="shrink-0" startContent={<Printer size={16} />} onPress={() => window.print()}>
              Print
            </Button>
            <Dropdown>
              <DropdownTrigger>
                <Button size="sm" color="primary" className="shrink-0" startContent={<ArrowDownToLine size={16} />} isLoading={isGenerating}>
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
          <CardBody className="gap-2 px-3 py-2">
            <Tabs
              selectedKey={selectedTab}
              onSelectionChange={handleTabChange}
              aria-label="Report categories"
              color="primary"
              variant="underlined"
              classNames={{ tabList: 'gap-3', cursor: 'w-full', tab: 'px-0 h-8' }}
            >
              {Object.entries(REPORT_GROUPS).map(([key, group]) => (
                <Tab key={key} title={group.title} />
              ))}
            </Tabs>

            <div className="flex flex-col gap-2 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between min-[900px]:gap-3">
              <Select
                label="Report"
                className="w-full max-w-full min-[900px]:w-64 min-[900px]:max-w-[16rem] min-[900px]:shrink-0"
                classNames={{
                  trigger: 'min-h-[48px] h-[48px] py-1',
                  label: 'text-xs',
                  value: 'text-sm',
                }}
                selectedKeys={[selectedReport]}
                onSelectionChange={(keys) => {
                  const next = Array.from(keys)[0] as string;
                  if (next) setSelectedReport(next);
                }}
                startContent={<TrendingUp size={15} className="text-slate-400" />}
              >
                {REPORT_GROUPS[selectedTab].reports.map(([key, label]) => (
                  <SelectItem key={key}>{label}</SelectItem>
                ))}
              </Select>

              {!NO_DATE_REPORT_KEYS.has(selectedReport) && (
                <div className="flex min-w-0 flex-col items-stretch min-[900px]:items-end">
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 min-[900px]:justify-end">
                    <CalendarDays size={14} /> Reporting period
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 min-[900px]:flex-nowrap min-[900px]:justify-end">
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
                        className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
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
                        className="w-[8.5rem] max-w-[8.5rem] shrink-0"
                        classNames={{ inputWrapper: 'w-[8.5rem] max-w-[8.5rem]', input: 'text-xs' }}
                        size="sm"
                      />
                    )}
                    {reportDateMode === 'range' && RANGE_REPORT_KEYS.has(selectedReport) && (
                      <>
                        <Input
                          aria-label="Start date"
                          type="date"
                          value={startDate}
                          onChange={(event) => setStartDate(event.target.value)}
                          className="w-[8.5rem] max-w-[8.5rem] shrink-0"
                          classNames={{ inputWrapper: 'w-[8.5rem] max-w-[8.5rem]', input: 'text-xs' }}
                          size="sm"
                        />
                        <span className="shrink-0 text-sm text-slate-400">to</span>
                        <Input
                          aria-label="End date"
                          type="date"
                          value={endDate}
                          min={startDate}
                          onChange={(event) => setEndDate(event.target.value)}
                          className="w-[8.5rem] max-w-[8.5rem] shrink-0"
                          classNames={{ inputWrapper: 'w-[8.5rem] max-w-[8.5rem]', input: 'text-xs' }}
                          size="sm"
                        />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(rawRows.length > 0 || facetDefinitions.length > 0) && (
              <div className="border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Search report results"
                    placeholder="Ticket, cook, dish, station..."
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
          <CardBody className="overflow-x-auto px-3 py-1.5">
            <div className="flex min-w-max items-center gap-3">
              <div className="flex flex-1 items-center divide-x divide-slate-200">
                {visibleReportKpis.length > 0 ? visibleReportKpis.map((kpi) => (
                  <div key={kpi.label} className="flex items-baseline gap-1.5 px-3 first:pl-0 last:pr-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</span>
                    <span className="text-sm font-bold text-slate-950">{kpi.value}</span>
                  </div>
                )) : (
                  <p className="pr-3 text-sm text-slate-500">All summary metrics are hidden.</p>
                )}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-slate-200 pl-3">
                {summaryCustomizationControls}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card id="report-print-area" className="border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-1.5">
            <div className="min-w-0">
              <div className="hidden print:block">
                <h2 className="text-xl font-bold">{orgProfile.name}</h2>
                {(orgProfile.address || orgProfile.phone || orgProfile.email) && (
                  <p className="text-xs text-slate-500">
                    {[orgProfile.address, orgProfile.phone, orgProfile.email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-lg font-bold text-slate-950">{reportLabel}</h2>
                <ReportPageInfoTip
                  text={REPORT_DESCRIPTIONS[selectedReport] || REPORT_GROUPS[selectedTab].description}
                  label={`About ${reportLabel}`}
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="whitespace-nowrap text-[11px] text-slate-500">
                {NO_DATE_REPORT_KEYS.has(selectedReport)
                  ? 'Current snapshot'
                  : startDate === endDate
                    ? startDate
                    : `${startDate} – ${endDate}`}
                <span className="mx-1.5 text-slate-300">·</span>
                Generated {generatedAt ?? '…'} by {currentUserLabel}
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
          <CardBody className="p-3 sm:p-5">
            {renderReportTable()}
            {reportNotes && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Notes</p>
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
            <Textarea
              label="Report Notes"
              placeholder="Add any additional notes or observations about this report..."
              value={reportNotes}
              onChange={(event) => setReportNotes(event.target.value)}
              minRows={4}
            />
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
