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
import { reportingStore } from '../lib/fb/reportingStore';
import { ordersStore, type FBOrder } from '../lib/fb/ordersStore';
import { inventoryStore } from '../lib/fb/inventoryStore';
import { customerStore } from '../lib/fb/customerStore';
import { useSettingsStore } from '../lib/settings/store';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import { reportDataToSections, sectionsToCSV, sectionsToExcelHtml, sectionsToPdfBlob } from '../lib/frontoffice/reportExportFormat';

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
  return `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function orderTotal(order: FBOrder) {
  if (typeof order.total === 'number' && !Number.isNaN(order.total)) return order.total;
  return order.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function orderDay(order: FBOrder) {
  return (order.createdAt || order.timestamp || '').slice(0, 10);
}

function inDateRange(day: string, startDate: string, endDate: string) {
  return Boolean(day) && day >= startDate && day <= endDate;
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

const RANGE_REPORT_KEYS = new Set([
  'orders', 'product-mix', 'sales-by-employee', 'waste', 'labor', 'financial-summary',
]);
const NO_DATE_REPORT_KEYS = new Set(['customers', 'suppliers']);

const REPORT_GROUPS = {
  service: {
    title: 'Service',
    description: 'Outlet orders, sales mix and covers for the floor.',
    reports: [
      ['orders', 'Orders'],
      ['daily-sales', 'Daily Sales'],
      ['hourly-sales', 'Hourly Sales'],
      ['product-mix', 'Product Mix'],
    ],
  },
  kitchen: {
    title: 'Kitchen',
    description: 'Stock on hand and waste against the outlet.',
    reports: [
      ['inventory', 'Inventory'],
      ['waste', 'Waste'],
    ],
  },
  performance: {
    title: 'Performance',
    description: 'Server sales, labor cost and guest spend.',
    reports: [
      ['sales-by-employee', 'Sales by Employee'],
      ['labor', 'Labor'],
      ['financial-summary', 'Financial Summary'],
      ['customers', 'Customers'],
      ['suppliers', 'Suppliers'],
    ],
  },
} as const;

type ReportGroupKey = keyof typeof REPORT_GROUPS;
type ReportFilters = {
  query: string;
  status: string;
  venue: string;
  customerType: string;
  staff: string;
  category: string;
};

const EMPTY_REPORT_FILTERS: ReportFilters = {
  query: '',
  status: 'all',
  venue: 'all',
  customerType: 'all',
  staff: 'all',
  category: 'all',
};

const REPORT_DESCRIPTIONS: Record<string, string> = {
  orders: 'Outlet tickets for the period: table, server, guest, status and total.',
  'daily-sales': 'Top-selling items and outlet totals for the selected business date.',
  'hourly-sales': 'Covers and revenue by hour for the selected business date.',
  'product-mix': 'Item and category contribution to outlet sales.',
  inventory: 'Stock on hand, low-stock alerts and expiry exposure.',
  waste: 'Recorded waste by ingredient, reason and cost.',
  'sales-by-employee': 'Covers and sales attributed to each server.',
  labor: 'Hours and pay by role against outlet sales.',
  'financial-summary': 'Revenue, COGS, labor and waste for the selected period.',
  customers: 'Highest-spend guests and visit counts from the F&B customer file.',
  suppliers: 'Active suppliers, rating and product coverage.',
};

type ReportColumnDefinition = { key: string; label: string; defaultVisible?: boolean };

const REPORT_COLUMNS: Record<string, ReportColumnDefinition[]> = {
  orders: [
    { key: 'orderNumber', label: 'Order' },
    { key: 'createdAt', label: 'Time' },
    { key: 'venue', label: 'Venue' },
    { key: 'table', label: 'Table' },
    { key: 'guestName', label: 'Guest' },
    { key: 'roomNumber', label: 'Room', defaultVisible: false },
    { key: 'customerType', label: 'Guest type' },
    { key: 'waiter', label: 'Server' },
    { key: 'itemCount', label: 'Items' },
    { key: 'status', label: 'Status' },
    { key: 'total', label: 'Total' },
  ],
  'daily-sales': [
    { key: 'name', label: 'Item' },
    { key: 'quantity', label: 'Qty sold' },
    { key: 'revenue', label: 'Revenue' },
  ],
  'hourly-sales': [
    { key: 'hourLabel', label: 'Hour' },
    { key: 'orders', label: 'Orders' },
    { key: 'revenue', label: 'Revenue' },
  ],
  'product-mix': [
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'quantity', label: 'Qty sold' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'percentageOfSales', label: '% of sales' },
    { key: 'averageOrderValue', label: 'Avg per order', defaultVisible: false },
  ],
  inventory: [
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'currentStock', label: 'On hand' },
    { key: 'unit', label: 'Unit' },
    { key: 'minimumThreshold', label: 'Min' },
    { key: 'reorderPoint', label: 'Reorder', defaultVisible: false },
    { key: 'unitCost', label: 'Unit cost' },
    { key: 'stockValue', label: 'Value' },
    { key: 'status', label: 'Status' },
    { key: 'expiryDate', label: 'Expiry', defaultVisible: false },
  ],
  waste: [
    { key: 'name', label: 'Ingredient' },
    { key: 'quantity', label: 'Qty' },
    { key: 'cost', label: 'Cost' },
    { key: 'reason', label: 'Reason' },
  ],
  'sales-by-employee': [
    { key: 'name', label: 'Server' },
    { key: 'role', label: 'Role', defaultVisible: false },
    { key: 'orders', label: 'Orders' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'averageOrderValue', label: 'Avg order' },
    { key: 'percentageOfSales', label: '% of sales' },
  ],
  labor: [
    { key: 'name', label: 'Role' },
    { key: 'hours', label: 'Hours' },
    { key: 'pay', label: 'Pay' },
    { key: 'efficiency', label: 'Efficiency', defaultVisible: false },
  ],
  'financial-summary': [
    { key: 'line', label: 'Line' },
    { key: 'amount', label: 'Amount' },
    { key: 'note', label: 'Note' },
  ],
  customers: [
    { key: 'name', label: 'Guest' },
    { key: 'totalSpent', label: 'Total spent' },
    { key: 'visitCount', label: 'Visits' },
    { key: 'loyaltyPoints', label: 'Points', defaultVisible: false },
    { key: 'tier', label: 'Tier' },
  ],
  suppliers: [
    { key: 'name', label: 'Supplier' },
    { key: 'rating', label: 'Rating' },
    { key: 'contactPerson', label: 'Contact' },
    { key: 'products', label: 'Products', defaultVisible: false },
  ],
};

function generateOrdersReport(startDate: string, endDate: string) {
  return ordersStore.all()
    .filter((order) => inDateRange(orderDay(order), startDate, endDate))
    .map((order) => ({
      orderNumber: order.orderNumber || order.id,
      createdAt: order.createdAt
        ? new Date(order.createdAt).toLocaleString('en-GH')
        : '—',
      venue: order.venue,
      table: order.table || '—',
      guestName: order.guestName || '—',
      roomNumber: order.roomNumber || '—',
      customerType: order.customerType,
      waiter: order.waiterId || '—',
      itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
      status: order.status,
      total: orderTotal(order),
    }));
}

function generateInventoryRows() {
  return inventoryStore.getAllIngredients().map((item) => {
    const low = item.currentStock <= item.minimumThreshold;
    const expiring = Boolean(item.expiryDate) && new Date(item.expiryDate as string).getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000;
    return {
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      unit: item.unit,
      minimumThreshold: item.minimumThreshold,
      reorderPoint: item.reorderPoint,
      unitCost: item.unitCost,
      stockValue: item.currentStock * item.unitCost,
      status: low ? 'Low stock' : expiring ? 'Expiring' : 'OK',
      expiryDate: item.expiryDate || '—',
    };
  });
}

function generateFinancialRows(startDate: string, endDate: string) {
  const days: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  const sales = days.reduce((acc, day) => {
    const report = reportingStore.generateDailySalesReport(day);
    acc.totalSales += report.totalSales;
    acc.totalOrders += report.totalOrders;
    return acc;
  }, { totalSales: 0, totalOrders: 0 });

  const inventory = reportingStore.generateInventoryReport(endDate);
  const labor = reportingStore.generateLaborReport(startDate, endDate);
  const waste = reportingStore.generateWasteReport(startDate, endDate);
  const grossProfit = sales.totalSales - inventory.cogs;
  const net = grossProfit - labor.totalPay - waste.totalWasteValue;

  return [
    { line: 'Revenue', amount: sales.totalSales, note: 'Ticket sales in the selected period' },
    { line: 'Cost of goods', amount: inventory.cogs, note: 'Inventory COGS as currently recorded' },
    { line: 'Gross profit', amount: grossProfit, note: 'Revenue less COGS' },
    { line: 'Labor cost', amount: labor.totalPay, note: 'Pay in the selected period' },
    { line: 'Waste', amount: waste.totalWasteValue, note: 'Recorded waste in the selected period' },
    { line: 'Net after labor & waste', amount: net, note: 'Gross less labor and waste' },
  ];
}

export default function FoodBeverageReportsAnalysis({ embedded = false }: { embedded?: boolean }) {
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('service');
  const [selectedReport, setSelectedReport] = useState('orders');
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
  const [ordersTick, setOrdersTick] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const settings = useSettingsStore();
  const orgProfile = buildOrgProfile(settings);
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('foodbeverage.report-summary-preferences');
      if (saved) setHiddenKpisByReport(JSON.parse(saved));
      const savedColumns = localStorage.getItem('foodbeverage.report-column-preferences');
      if (savedColumns) setHiddenColumnsByReport(JSON.parse(savedColumns));
    } catch {
      // A blocked or malformed local preference should never prevent reporting.
    }
  }, []);

  useEffect(() => {
    ordersStore.hydrateFromApi().then(() => setOrdersTick((tick) => tick + 1));
    customerStore.hydrateFromApi();
    const unsub = ordersStore.subscribe(() => setOrdersTick((tick) => tick + 1));
    return unsub;
  }, []);

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, selectedTab, startDate, endDate, ordersTick, refreshVersion]);

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
    ordersStore.hydrateFromApi().then(() => setOrdersTick((tick) => tick + 1));
    setRefreshVersion((version) => version + 1);
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  };

  const getCurrentReportData = () => {
    switch (selectedReport) {
      case 'orders':
        return generateOrdersReport(startDate, endDate);
      case 'daily-sales':
        return reportingStore.generateDailySalesReport(startDate).topSellingItems;
      case 'hourly-sales':
        return reportingStore.generateDailySalesReport(startDate).salesByHour.map((row) => ({
          ...row,
          hourLabel: formatHour(row.hour),
        }));
      case 'product-mix':
        return reportingStore.generateProductMixReport(startDate, endDate).productPerformance;
      case 'inventory':
        return generateInventoryRows();
      case 'waste':
        return reportingStore.generateWasteReport(startDate, endDate).wasteByIngredient;
      case 'sales-by-employee':
        return reportingStore.generateSalesByEmployeeReport(startDate, endDate).employeePerformance;
      case 'labor':
        return reportingStore.generateLaborReport(startDate, endDate).employeeBreakdown;
      case 'financial-summary':
        return generateFinancialRows(startDate, endDate);
      case 'customers':
        return reportingStore.generateCustomerAnalyticsReport().topCustomers;
      case 'suppliers':
        return reportingStore.generateSupplierAnalyticsReport().topRatedSuppliers.map((supplier) => ({
          ...supplier,
          products: supplier.products.join(', '),
        }));
      default:
        return generateOrdersReport(startDate, endDate);
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
    venue: uniqueValues(['venue']),
    customerType: uniqueValues(['customerType']),
    staff: uniqueValues(['waiter', 'name']),
    category: uniqueValues(['category', 'reason']),
  };
  const rows = rawRows.filter((row) => {
    const query = filters.query.trim().toLocaleLowerCase();
    const matchesQuery = !query || Object.values(row).some((value) => {
      const searchable = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      return searchable.toLocaleLowerCase().includes(query);
    });
    return matchesQuery
      && (filters.status === 'all' || fieldValue(row, ['status']) === filters.status)
      && (filters.venue === 'all' || fieldValue(row, ['venue']) === filters.venue)
      && (filters.customerType === 'all' || fieldValue(row, ['customerType']) === filters.customerType)
      && (filters.staff === 'all' || fieldValue(row, ['waiter', 'name']) === filters.staff)
      && (filters.category === 'all' || fieldValue(row, ['category', 'reason']) === filters.category);
  });
  const filteredReportData = Array.isArray(reportData) ? rows : reportData;
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === 'query' ? Boolean(value.trim()) : value !== 'all').length;
  const facetDefinitions = ([
    { key: 'status', label: 'Status', options: filterOptions.status },
    { key: 'venue', label: 'Venue', options: filterOptions.venue },
    { key: 'customerType', label: 'Guest type', options: filterOptions.customerType },
    { key: 'staff', label: 'Server', options: filterOptions.staff },
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
      localStorage.setItem('foodbeverage.report-column-preferences', JSON.stringify(next));
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
    if (selectedReport === 'orders') {
      const open = rows.filter((row) => row.status !== 'paid').length;
      return [
        { label: 'Tickets', value: count.toLocaleString(), hint: 'Orders in period' },
        { label: 'Open tickets', value: open.toLocaleString(), hint: 'Not yet paid' },
        { label: 'Sales', value: money(rows.reduce((sum, row) => sum + Number(row.total || 0), 0)), hint: 'Ticket totals' },
        { label: 'Items sold', value: rows.reduce((sum, row) => sum + Number(row.itemCount || 0), 0).toLocaleString(), hint: 'Line quantities' },
      ];
    }
    if (selectedReport === 'daily-sales') {
      const sales = reportingStore.generateDailySalesReport(startDate);
      return [
        { label: 'Sales', value: money(sales.totalSales), hint: 'Item revenue for the date' },
        { label: 'Orders', value: sales.totalOrders.toLocaleString(), hint: 'Tickets' },
        { label: 'Average ticket', value: money(sales.averageOrderValue), hint: 'Sales / orders' },
        { label: 'Top items', value: count.toLocaleString(), hint: 'Shown in the table' },
      ];
    }
    if (selectedReport === 'hourly-sales') {
      const peak = rows.reduce((best, row) => Number(row.revenue || 0) > Number(best.revenue || 0) ? row : best, rows[0] || { hourLabel: '—', revenue: 0 });
      return [
        { label: 'Hours with sales', value: rows.filter((row) => Number(row.orders || 0) > 0).length.toLocaleString(), hint: 'Active service hours' },
        { label: 'Orders', value: rows.reduce((sum, row) => sum + Number(row.orders || 0), 0).toLocaleString(), hint: 'Tickets' },
        { label: 'Sales', value: money(rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0)), hint: 'Hourly revenue' },
        { label: 'Peak hour', value: String(peak.hourLabel || '—'), hint: 'Highest revenue hour' },
      ];
    }
    if (selectedReport === 'product-mix') {
      const mix = reportingStore.generateProductMixReport(startDate, endDate);
      return [
        { label: 'Items sold', value: count.toLocaleString(), hint: 'Distinct menu items' },
        { label: 'Sales', value: money(mix.totalRevenue), hint: 'Period revenue' },
        { label: 'Orders', value: mix.totalOrders.toLocaleString(), hint: 'Tickets' },
        { label: 'Categories', value: Object.keys(mix.categoryBreakdown).length.toLocaleString(), hint: 'Active categories' },
      ];
    }
    if (selectedReport === 'inventory') {
      return [
        { label: 'Stock items', value: count.toLocaleString(), hint: 'Ingredients on file' },
        { label: 'Low stock', value: rows.filter((row) => row.status === 'Low stock').length.toLocaleString(), hint: 'At or below minimum' },
        { label: 'Expiring', value: rows.filter((row) => row.status === 'Expiring').length.toLocaleString(), hint: 'Within 7 days' },
        { label: 'Stock value', value: money(rows.reduce((sum, row) => sum + Number(row.stockValue || 0), 0)), hint: 'On-hand cost' },
      ];
    }
    if (selectedReport === 'waste') {
      return [
        { label: 'Waste lines', value: count.toLocaleString(), hint: 'Recorded entries' },
        { label: 'Waste cost', value: money(rows.reduce((sum, row) => sum + Number(row.cost || 0), 0)), hint: 'Period total' },
        { label: 'Period start', value: startDate, hint: 'Business date' },
        { label: 'Period end', value: endDate, hint: reportDateMode === 'range' ? 'Inclusive' : 'Single day' },
      ];
    }
    if (selectedReport === 'sales-by-employee') {
      const sales = reportingStore.generateSalesByEmployeeReport(startDate, endDate);
      return [
        { label: 'Servers', value: count.toLocaleString(), hint: 'With attributed tickets' },
        { label: 'Sales', value: money(sales.totalSales), hint: 'Period revenue' },
        { label: 'Orders', value: rows.reduce((sum, row) => sum + Number(row.orders || 0), 0).toLocaleString(), hint: 'Tickets' },
        { label: 'Top server', value: rows[0]?.name || '—', hint: 'Highest revenue' },
      ];
    }
    if (selectedReport === 'labor') {
      const labor = reportingStore.generateLaborReport(startDate, endDate);
      return [
        { label: 'Hours', value: labor.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 }), hint: 'Role hours' },
        { label: 'Pay', value: money(labor.totalPay), hint: 'Period labor cost' },
        { label: 'Avg hourly', value: money(labor.averageHourlyRate), hint: 'Pay / hours' },
        { label: 'Labor % of sales', value: `${labor.laborPercentage.toLocaleString('en-GH', { maximumFractionDigits: 1 })}%`, hint: 'Against same-day sales' },
      ];
    }
    if (selectedReport === 'financial-summary') {
      const revenue = Number(rows.find((row) => row.line === 'Revenue')?.amount || 0);
      const net = Number(rows.find((row) => row.line === 'Net after labor & waste')?.amount || 0);
      return [
        { label: 'Revenue', value: money(revenue), hint: 'Ticket sales' },
        { label: 'Gross profit', value: money(Number(rows.find((row) => row.line === 'Gross profit')?.amount || 0)), hint: 'After COGS' },
        { label: 'Labor + waste', value: money(Number(rows.find((row) => row.line === 'Labor cost')?.amount || 0) + Number(rows.find((row) => row.line === 'Waste')?.amount || 0)), hint: 'Operating deductions' },
        { label: 'Net', value: money(net), hint: 'After labor and waste' },
      ];
    }
    if (selectedReport === 'customers') {
      const analytics = reportingStore.generateCustomerAnalyticsReport();
      return [
        { label: 'Customers', value: analytics.totalCustomers.toLocaleString(), hint: 'On file' },
        { label: 'Active', value: analytics.activeCustomers.toLocaleString(), hint: 'Recent guests' },
        { label: 'Avg lifetime spend', value: money(analytics.averageCustomerLifetimeValue), hint: 'Per guest' },
        { label: 'Top guests shown', value: count.toLocaleString(), hint: 'Highest spend' },
      ];
    }
    if (selectedReport === 'suppliers') {
      const analytics = reportingStore.generateSupplierAnalyticsReport();
      return [
        { label: 'Suppliers', value: analytics.totalSuppliers.toLocaleString(), hint: 'On file' },
        { label: 'Active', value: analytics.activeSuppliers.toLocaleString(), hint: 'Currently used' },
        { label: 'Avg rating', value: analytics.averageRating.toLocaleString(undefined, { maximumFractionDigits: 1 }), hint: 'Recorded score' },
        { label: 'Listed', value: count.toLocaleString(), hint: 'Shown in the table' },
      ];
    }
    return [
      { label: 'Records', value: count.toLocaleString(), hint: 'Matching the filters' },
      { label: 'Period start', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : startDate, hint: 'Business date' },
      { label: 'Period end', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : endDate, hint: reportDateMode === 'range' ? 'Inclusive' : 'Single day' },
      { label: 'Status', value: 'Current', hint: generatedAt ? `Refreshed ${generatedAt}` : 'Preparing report' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshVersion, mounted, filters, ordersTick]);

  const hiddenKpiLabels = hiddenKpisByReport[selectedReport] || [];
  const visibleReportKpis = reportKpis.filter((kpi) => !hiddenKpiLabels.includes(kpi.label));
  const saveKpiPreferences = (hiddenLabels: string[]) => {
    const next = { ...hiddenKpisByReport, [selectedReport]: hiddenLabels };
    setHiddenKpisByReport(next);
    try {
      localStorage.setItem('foodbeverage.report-summary-preferences', JSON.stringify(next));
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
      console.error(`[FB REPORTS] Error exporting report:`, error);
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
      <Table
        aria-label={`${selectedReport} report table`}
        classNames={{ base: 'overflow-x-auto', table: 'min-w-max' }}
      >
        <TableHeader>
          {visibleColumns.map((column) => (
            <TableColumn key={column.key}>{column.label}</TableColumn>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row: any, index: number) => (
            <TableRow key={index}>
              {visibleColumns.map((column) => (
                <TableCell key={column.key}>
                  {typeof row[column.key] === 'number' && /(amount|total|revenue|cost|pay|spent|value|price)/i.test(column.key)
                    ? money(row[column.key])
                    : typeof row[column.key] === 'number' && /(percentage|efficiency)/i.test(column.key)
                    ? `${row[column.key].toLocaleString('en-GH', { maximumFractionDigits: 1 })}%`
                    : typeof row[column.key] === 'boolean'
                    ? (row[column.key] ? 'Yes' : 'No')
                    : Array.isArray(row[column.key])
                    ? row[column.key].join(', ')
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
    <div className={embedded ? 'p-2' : 'min-h-screen bg-slate-50/70 p-4 md:p-6'}>
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <BarChart3 size={18} />
              FOOD & BEVERAGE INTELLIGENCE
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Reports & Analysis</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Outlet control, kitchen stock and performance insight from one workspace.
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

            {rawRows.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Search report results"
                    placeholder="Order, guest, item, server..."
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
                <div>{NO_DATE_REPORT_KEYS.has(selectedReport) ? 'Current file' : startDate === endDate ? startDate : `${startDate} – ${endDate}`}</div>
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
