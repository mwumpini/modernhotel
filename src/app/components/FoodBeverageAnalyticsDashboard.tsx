'use client';

/**
 * F&B's Reports & Analysis screen, rebuilt on the same pattern as Front Office's
 * (FrontOfficeReportsAnalysis.tsx): report picker + Today/Specific/Range period,
 * search/facet Filters, customizable summary KPIs, Columns picker, Notes, and
 * Excel/PDF/CSV export — reading only real persisted F&B data.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, CardBody, CardHeader, Button, Select, SelectItem, Tabs, Tab, Input,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Textarea,
} from '@heroui/react';
import {
  ArrowDownToLine, BarChart3, CalendarDays, FileSpreadsheet, FileText, Filter,
  Printer, RefreshCw, RotateCcw, Search, SlidersHorizontal, StickyNote, TrendingUp, X,
} from 'lucide-react';
import { reportingStore, type MenuCostRef, type RecipeUsageRef } from '../lib/fb/reportingStore';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import { ordersStore } from '../lib/fb/ordersStore';
import { customerStore } from '../lib/fb/customerStore';
import { useTenantStaffStore } from '../lib/tenant/tenantStaffStore';
import { useSettingsStore } from '../lib/settings/store';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import { formatReportValue, labelize, type ReportDateMode } from './reports/ReportBasics';
import { SortableReportTable } from './reports/SortableReportTable';
import ReportPageInfoTip from './dashboard/ReportPageInfoTip';

const REPORT_LABELS: Record<string, string> = {
  'sales-summary': 'Sales Summary',
  'sales': 'Detailed Sales',
  'daily-sales': 'Daily Sales Report',
  'discounts': 'Discount Report',
  'customer-analytics': 'Customer Analytics',
  'product-mix': 'Product Mix Report',
  'category-sales': 'Sales by Category',
  'item-profitability': 'Item Profitability',
  'theoretical-usage': 'Theoretical Usage',
  inventory: 'Inventory',
  requisitions: 'Requisitions',
  'kitchen-tickets': 'Kitchen Tickets (KOT)',
  'bar-tickets': 'Bar Tickets (BOT)',
  'voided-orders': 'Voided/Cancelled Orders',
  'table-sales': 'Table Sales Report',
  'sales-by-employee': 'Sales by Employee',
  'room-charges': 'Room Charge Report',
};

type ReportCategory = { key: string; label: string; icon: string; reports: string[] };

const REPORT_CATEGORIES: ReportCategory[] = [
  { key: 'sales-financial', label: 'Sales & Financial', icon: '💰', reports: ['sales-summary', 'sales', 'daily-sales', 'sales-by-employee', 'discounts', 'customer-analytics', 'room-charges'] },
  { key: 'product-inventory', label: 'Product & Inventory', icon: '🍲', reports: ['product-mix', 'category-sales', 'item-profitability', 'theoretical-usage', 'inventory', 'requisitions'] },
  { key: 'operational-service', label: 'Operational & Service', icon: '🧾', reports: ['kitchen-tickets', 'bar-tickets', 'voided-orders', 'table-sales'] },
];

const RANGE_REPORT_KEYS = new Set([
  'sales-summary', 'sales', 'product-mix', 'category-sales', 'item-profitability', 'theoretical-usage', 'requisitions', 'sales-by-employee', 'kitchen-tickets', 'bar-tickets', 'voided-orders', 'discounts', 'table-sales', 'room-charges',
]);
const NO_DATE_REPORT_KEYS = new Set(['customer-analytics', 'inventory']);

type ReportColumnDefinition = { key: string; label: string; defaultVisible?: boolean };

const REPORT_COLUMNS: Record<string, ReportColumnDefinition[]> = {
  'sales-summary': [
    { key: 'date', label: 'Date' },
    { key: 'orders', label: 'Orders' },
    { key: 'covers', label: 'Covers' },
    { key: 'grossSales', label: 'Gross sales' },
    { key: 'discounts', label: 'Discounts' },
    { key: 'netSales', label: 'Net sales' },
    { key: 'serviceCharge', label: 'Service charge' },
    { key: 'tax', label: 'Tax' },
    { key: 'grandTotal', label: 'Grand total' },
    { key: 'averageCheck', label: 'Avg check' },
    { key: 'voids', label: 'Voids' },
  ],
  sales: [
    { key: 'date', label: 'Date' },
    { key: 'orderNumber', label: 'Order' },
    { key: 'time', label: 'Time' },
    { key: 'venue', label: 'Venue' },
    { key: 'table', label: 'Table' },
    { key: 'room', label: 'Room', defaultVisible: false },
    { key: 'category', label: 'Category' },
    { key: 'item', label: 'Item' },
    { key: 'quantity', label: 'Qty' },
    { key: 'unitPrice', label: 'Unit price', defaultVisible: false },
    { key: 'amount', label: 'Amount' },
    { key: 'customer', label: 'Customer' },
    { key: 'customerType', label: 'Customer type' },
    { key: 'server', label: 'Server' },
    { key: 'paymentMethod', label: 'Payment method' },
    { key: 'discount', label: 'Discount', defaultVisible: false },
    { key: 'tax', label: 'Tax', defaultVisible: false },
    { key: 'billedPaid', label: 'Billed/Paid' },
  ],
  'daily-sales': [
    { key: 'orderNumber', label: 'Order' },
    { key: 'time', label: 'Time' },
    { key: 'venue', label: 'Venue' },
    { key: 'table', label: 'Table' },
    { key: 'room', label: 'Room', defaultVisible: false },
    { key: 'category', label: 'Category' },
    { key: 'item', label: 'Item' },
    { key: 'quantity', label: 'Qty' },
    { key: 'unitPrice', label: 'Unit price', defaultVisible: false },
    { key: 'amount', label: 'Amount' },
    { key: 'customer', label: 'Customer' },
    { key: 'customerType', label: 'Customer type' },
    { key: 'server', label: 'Server' },
    { key: 'paymentMethod', label: 'Payment method' },
    { key: 'discount', label: 'Discount', defaultVisible: false },
    { key: 'tax', label: 'Tax', defaultVisible: false },
    { key: 'billedPaid', label: 'Billed/Paid' },
  ],
  discounts: [
    { key: 'orderNumber', label: 'Order' },
    { key: 'date', label: 'Date' },
    { key: 'table', label: 'Table' },
    { key: 'server', label: 'Server' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'discountAmount', label: 'Discount' },
    { key: 'discountPercentage', label: 'Discount %' },
    { key: 'serviceCharge', label: 'Service charge', defaultVisible: false },
    { key: 'total', label: 'Total' },
  ],
  'customer-analytics': [
    { key: 'name', label: 'Customer' },
    { key: 'totalSpent', label: 'Total spent' },
    { key: 'visitCount', label: 'Visits' },
    { key: 'loyaltyPoints', label: 'Loyalty points' },
    { key: 'tier', label: 'Tier' },
    { key: 'customerId', label: 'Customer ID', defaultVisible: false },
  ],
  'product-mix': [
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'quantity', label: 'Qty sold' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'percentageOfSales', label: '% of sales' },
    { key: 'averageOrderValue', label: 'Avg order value', defaultVisible: false },
    { key: 'itemId', label: 'Item ID', defaultVisible: false },
  ],
  'category-sales': [
    { key: 'category', label: 'Category' },
    { key: 'itemCount', label: 'Items' },
    { key: 'quantity', label: 'Qty sold' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'sharePercentage', label: '% of sales' },
  ],
  'item-profitability': [
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'quantity', label: 'Qty sold' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'cost', label: 'Cost' },
    { key: 'margin', label: 'Margin' },
    { key: 'foodCostPercentage', label: 'Food cost %' },
  ],
  'theoretical-usage': [
    { key: 'ingredient', label: 'Ingredient' },
    { key: 'unit', label: 'Unit' },
    { key: 'usedQuantity', label: 'Quantity' },
    { key: 'source', label: 'Source' },
    { key: 'dishes', label: 'Dishes' },
  ],
  inventory: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'onHand', label: 'On hand' },
    { key: 'unit', label: 'Unit' },
    { key: 'unitCost', label: 'Unit cost' },
    { key: 'stockValue', label: 'Value' },
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
  'kitchen-tickets': [
    { key: 'orderNumber', label: 'Ticket' },
    { key: 'table', label: 'Table' },
    { key: 'item', label: 'Item' },
    { key: 'quantity', label: 'Qty' },
    { key: 'kitchenBarStatus', label: 'Kitchen status' },
    { key: 'billedPaid', label: 'Billed/Paid' },
    { key: 'sentAt', label: 'Sent' },
    { key: 'startedPreparingAt', label: 'Started', defaultVisible: false },
    { key: 'servedAt', label: 'Served', defaultVisible: false },
    { key: 'prepTimeMinutes', label: 'Prep (min)' },
    { key: 'preparedBy', label: 'Prepared by' },
    { key: 'orderStatus', label: 'Order status', defaultVisible: false },
  ],
  'bar-tickets': [
    { key: 'orderNumber', label: 'Ticket' },
    { key: 'table', label: 'Table' },
    { key: 'item', label: 'Item' },
    { key: 'quantity', label: 'Qty' },
    { key: 'kitchenBarStatus', label: 'Bar status' },
    { key: 'billedPaid', label: 'Billed/Paid' },
    { key: 'sentAt', label: 'Sent' },
    { key: 'startedPreparingAt', label: 'Started', defaultVisible: false },
    { key: 'servedAt', label: 'Served', defaultVisible: false },
    { key: 'prepTimeMinutes', label: 'Prep (min)' },
    { key: 'preparedBy', label: 'Prepared by' },
    { key: 'orderStatus', label: 'Order status', defaultVisible: false },
  ],
  'voided-orders': [
    { key: 'orderNumber', label: 'Order' },
    { key: 'table', label: 'Table' },
    { key: 'venue', label: 'Venue' },
    { key: 'server', label: 'Server' },
    { key: 'items', label: 'Items' },
    { key: 'total', label: 'Total' },
    { key: 'cancelledAt', label: 'Cancelled at' },
  ],
  'table-sales': [
    { key: 'table', label: 'Table' },
    { key: 'orders', label: 'Orders' },
    { key: 'covers', label: 'Covers' },
    { key: 'sales', label: 'Sales' },
    { key: 'averageCheck', label: 'Avg check' },
  ],
  'sales-by-employee': [
    { key: 'staff', label: 'Staff' },
    { key: 'role', label: 'Role' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'grossSales', label: 'Gross sales' },
    { key: 'discounts', label: 'Discounts' },
    { key: 'netSales', label: 'Net sales' },
    { key: 'tax', label: 'Tax', defaultVisible: false },
    { key: 'grandTotal', label: 'Grand total' },
    { key: 'averageCheck', label: 'Avg check' },
    { key: 'voids', label: 'Voids' },
  ],
  'room-charges': [
    { key: 'orderNumber', label: 'Order' },
    { key: 'date', label: 'Date' },
    { key: 'room', label: 'Room' },
    { key: 'guest', label: 'Guest' },
    { key: 'table', label: 'Table', defaultVisible: false },
    { key: 'staff', label: 'Staff' },
    { key: 'amount', label: 'Amount' },
    { key: 'tax', label: 'Tax', defaultVisible: false },
    { key: 'total', label: 'Total' },
    { key: 'postingStatus', label: 'Posting status' },
  ],
};

type ReportFilters = {
  query: string;
  category: string;
  status: string;
  staff: string;
  venue: string;
  customerType: string;
  customer: string;
  paymentMethod: string;
  item: string;
  table: string;
};

const EMPTY_REPORT_FILTERS: ReportFilters = {
  query: '',
  category: 'all',
  status: 'all',
  staff: 'all',
  venue: 'all',
  customerType: 'all',
  customer: 'all',
  paymentMethod: 'all',
  item: 'all',
  table: 'all',
};

const SALES_REPORTS = new Set(['sales', 'sales-summary', 'daily-sales']);

function salesSliceFromFilters(filters: ReportFilters) {
  return {
    staff: filters.staff === 'all' ? undefined : [filters.staff],
    customerTypes: filters.customerType === 'all' ? undefined : [filters.customerType],
    categories: filters.category === 'all' ? undefined : [filters.category],
    items: filters.item === 'all' ? undefined : [filters.item],
    customer: filters.customer === 'all' ? undefined : filters.customer,
    paymentMethod: filters.paymentMethod === 'all' ? undefined : filters.paymentMethod,
    venue: filters.venue === 'all' ? undefined : filters.venue,
    table: filters.table === 'all' ? undefined : filters.table,
  };
}

function money(value: number) {
  return `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toRawRows(selectedReport: string, reportData: unknown): Record<string, any>[] {
  if (Array.isArray(reportData)) return reportData as Record<string, any>[];
  if (!reportData || typeof reportData !== 'object') return [];
  const data = reportData as Record<string, any>;
  if (selectedReport === 'product-mix' && Array.isArray(data.productPerformance)) return data.productPerformance;
  if (selectedReport === 'customer-analytics' && Array.isArray(data.topCustomers)) return data.topCustomers;
  return [];
}

export default function FoodBeverageAnalyticsDashboard({ embedded = true }: { embedded?: boolean }) {
  const [selectedCategory, setSelectedCategory] = useState(REPORT_CATEGORIES[0].key);
  const [selectedReport, setSelectedReport] = useState('sales-summary');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportDateMode, setReportDateMode] = useState<ReportDateMode>('today');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportNotes, setReportNotes] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [hiddenKpisByReport, setHiddenKpisByReport] = useState<Record<string, string[]>>({});
  const [hiddenColumnsByReport, setHiddenColumnsByReport] = useState<Record<string, string[]>>({});

  const category = REPORT_CATEGORIES.find((c) => c.key === selectedCategory) || REPORT_CATEGORIES[0];

  useEffect(() => {
    if (category.reports.length > 0 && !category.reports.includes(selectedReport)) {
      setSelectedReport(category.reports[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fb.report-summary-preferences');
      if (saved) setHiddenKpisByReport(JSON.parse(saved));
      const savedColumns = localStorage.getItem('fb.report-column-preferences');
      if (savedColumns) setHiddenColumnsByReport(JSON.parse(savedColumns));
    } catch {
      // A blocked or malformed preference should never prevent reporting.
    }
  }, []);

  const settings = useSettingsStore();
  const orgProfile = buildOrgProfile(settings);
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  const [dataTick, setDataTick] = useState(0);
  const [menuCosts, setMenuCosts] = useState<MenuCostRef[]>([]);
  const [recipeUsage, setRecipeUsage] = useState<RecipeUsageRef[]>([]);
  const [restaurantStock, setRestaurantStock] = useState<Array<{
    code: string;
    name: string;
    category: string;
    onHand: number;
    unit: string;
    unitCost: number;
    stockValue: number;
  }>>([]);
  const [restaurantRequisitions, setRestaurantRequisitions] = useState<Array<{
    requisitionNumber: string;
    requestedDate: string;
    requestedBy: string;
    status: string;
    notes: string;
    items: { itemName: string; quantity: number }[];
  }>>([]);
  const loadProductCatalog = async () => {
    const headers = { 'x-tenant-subdomain': getClientTenantSubdomain() };
    const [menuRes, recipeRes, stockRes, requisitionRes] = await Promise.all([
      fetch('/api/fb/menu', { headers, cache: 'no-store' }).then((res) => (res.ok ? res.json() : { items: [] })).catch(() => ({ items: [] })),
      fetch('/api/fb/recipes', { headers, cache: 'no-store' }).then((res) => (res.ok ? res.json() : { recipes: [] })).catch(() => ({ recipes: [] })),
      fetch('/api/inventory/stock-levels?department=restaurant', { headers, cache: 'no-store' }).then((res) => (res.ok ? res.json() : { items: [] })).catch(() => ({ items: [] })),
      fetch('/api/inventory/requisitions?department=restaurant', { headers, cache: 'no-store' }).then((res) => (res.ok ? res.json() : { requisitions: [] })).catch(() => ({ requisitions: [] })),
    ]);
    setMenuCosts((menuRes.items || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category || 'Uncategorized',
      costPrice: Number(item.costPrice) || 0,
      unit: item.unit || undefined,
      inventoryItemId: item.inventoryItemId || undefined,
    })));
    setRecipeUsage((recipeRes.recipes || []).map((recipe: any) => ({
      name: recipe.name,
      menuItemId: recipe.menuItemId || null,
      isActive: recipe.isActive !== false,
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    })));
    setRestaurantStock((stockRes.items || []).map((item: any) => {
      const onHand = Number(item.onHand || 0);
      const unitCost = Number(item.defaultCost || 0);
      return {
        code: item.code,
        name: item.name,
        category: item.category || '—',
        onHand,
        unit: item.unit || '—',
        unitCost,
        stockValue: onHand * unitCost,
      };
    }));
    setRestaurantRequisitions((requisitionRes.requisitions || []).map((req: any) => ({
      requisitionNumber: req.requisitionNumber,
      requestedDate: req.requestedDate || req.createdAt || '',
      requestedBy: req.requestedBy || '—',
      status: req.status,
      notes: req.notes || '',
      items: (req.items || []).map((item: any) => ({ itemName: item.itemName, quantity: Number(item.quantity) })),
    })));
  };
  useEffect(() => {
    ordersStore.hydrateFromApi().then(() => setDataTick((t) => t + 1));
    customerStore.hydrateFromApi().then(() => setDataTick((t) => t + 1));
    void loadProductCatalog();
    const unsubOrders = ordersStore.subscribe(() => setDataTick((t) => t + 1));
    const unsubCustomers = customerStore.subscribe(() => setDataTick((t) => t + 1));
    void useTenantStaffStore.getState().hydrateFromApi();
    return () => { unsubOrders(); unsubCustomers(); };
  }, []);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, startDate, endDate]);

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

  const getCurrentReportData = () => {
    const salesSlice = salesSliceFromFilters(filters);
    switch (selectedReport) {
      case 'sales-summary':
        return reportingStore.generateSalesSummaryReport(startDate, endDate, salesSlice);
      case 'sales':
        return reportingStore.generateSalesReport(startDate, endDate, salesSlice);
      case 'daily-sales':
        return reportingStore.generateDailySalesReport(startDate, salesSlice);
      case 'product-mix':
        return reportingStore.generateProductMixReport(startDate, endDate);
      case 'category-sales':
        return reportingStore.generateCategorySalesReport(startDate, endDate);
      case 'item-profitability':
        return reportingStore.generateItemProfitabilityReport(startDate, endDate, menuCosts);
      case 'theoretical-usage':
        return reportingStore.generateTheoreticalUsageReport(startDate, endDate, menuCosts, recipeUsage);
      case 'inventory':
        return restaurantStock;
      case 'requisitions':
        return restaurantRequisitions
          .filter((row) => {
            const day = (row.requestedDate || '').slice(0, 10);
            return Boolean(day) && day >= startDate && day <= endDate;
          })
          .map((row) => ({
            requisitionNumber: row.requisitionNumber,
            requestedDate: row.requestedDate ? new Date(row.requestedDate).toLocaleString('en-GH') : '—',
            requestedBy: row.requestedBy || '—',
            status: row.status,
            itemCount: row.items.length,
            items: row.items.map((item) => `${item.quantity}× ${item.itemName}`).join(', '),
            notes: row.notes || '—',
          }));
      case 'sales-by-employee':
        return reportingStore.generateSalesByEmployeeReport(startDate, endDate);
      case 'kitchen-tickets':
        return reportingStore.generateKitchenTicketsReport(startDate, endDate);
      case 'bar-tickets':
        return reportingStore.generateBarTicketsReport(startDate, endDate);
      case 'voided-orders':
        return reportingStore.generateVoidedOrdersReport(startDate, endDate);
      case 'discounts':
        return reportingStore.generateDiscountReport(startDate, endDate);
      case 'table-sales':
        return reportingStore.generateTableSalesReport(startDate, endDate);
      case 'room-charges':
        return reportingStore.generateRoomChargeReport(startDate, endDate);
      case 'customer-analytics':
        return reportingStore.generateCustomerAnalyticsReport();
      default:
        return reportingStore.generateDailySalesReport(startDate);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reportData = useMemo(
    () => getCurrentReportData(),
    // filters are applied inside the sales generators so the summary totals follow the slice
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedReport, startDate, endDate, dataTick, refreshKey, filters, menuCosts, recipeUsage, restaurantStock, restaurantRequisitions]
  );

  const rawRows = toRawRows(selectedReport, reportData);
  const fieldValue = (row: Record<string, any>, keys: string[]) => {
    const value = keys.map((key) => row[key]).find((candidate) => candidate !== undefined && candidate !== null && candidate !== '');
    return value === undefined ? '' : String(value);
  };
  const uniqueValues = (keys: string[]) =>
    Array.from(new Set(rawRows.map((row) => fieldValue(row, keys)).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const salesFamily = SALES_REPORTS.has(selectedReport);
  const salesOptions = useMemo(() => {
    if (!salesFamily) return null;
    return reportingStore.salesFilterOptions(
      startDate,
      selectedReport === 'daily-sales' ? startDate : endDate,
      selectedReport === 'daily-sales' ? 'day' : 'range',
    );
  }, [salesFamily, selectedReport, startDate, endDate, dataTick, refreshKey]);

  const unfilteredRowCount = useMemo(() => {
    if (!salesFamily) return rawRows.length;
    if (selectedReport === 'sales-summary') return reportingStore.generateSalesSummaryReport(startDate, endDate).length;
    if (selectedReport === 'sales') return reportingStore.generateSalesReport(startDate, endDate).length;
    return reportingStore.generateDailySalesReport(startDate).length;
  }, [salesFamily, selectedReport, startDate, endDate, dataTick, refreshKey, rawRows.length]);

  const filterOptions = salesOptions || {
    customer: [] as string[],
    paymentMethod: [] as string[],
    category: uniqueValues(['category']),
    status: uniqueValues(['orderStatus', 'kitchenBarStatus', 'postingStatus', 'billedPaid', 'status', 'tier']),
    staff: uniqueValues(['server', 'staff', 'preparedBy']),
    venue: uniqueValues(['venue']),
    customerType: uniqueValues(['customerType']),
    item: uniqueValues(['item', 'name']),
    table: uniqueValues(['table', 'room']),
  };

  const rows = rawRows.filter((row) => {
    const query = filters.query.trim().toLocaleLowerCase();
    const matchesQuery = !query || Object.values(row).some((value) => {
      const searchable = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      return searchable.toLocaleLowerCase().includes(query);
    });
    // Sales reports already drop non-matching orders before the summary is totaled.
    if (salesFamily) return matchesQuery;
    return matchesQuery
      && (filters.category === 'all' || fieldValue(row, ['category']) === filters.category)
      && (filters.status === 'all' || fieldValue(row, ['orderStatus', 'kitchenBarStatus', 'postingStatus', 'billedPaid', 'status', 'tier']) === filters.status)
      && (filters.staff === 'all' || fieldValue(row, ['server', 'staff', 'preparedBy']) === filters.staff)
      && (filters.venue === 'all' || fieldValue(row, ['venue']) === filters.venue)
      && (filters.customerType === 'all' || fieldValue(row, ['customerType']) === filters.customerType)
      && (filters.customer === 'all' || fieldValue(row, ['customer']) === filters.customer)
      && (filters.paymentMethod === 'all' || fieldValue(row, ['paymentMethod']) === filters.paymentMethod)
      && (filters.item === 'all' || fieldValue(row, ['item', 'name']) === filters.item)
      && (filters.table === 'all' || fieldValue(row, ['table', 'room']) === filters.table);
  });

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => (key === 'query' ? Boolean(value.trim()) : value !== 'all')).length;
  const facetDefinitions = ([
    { key: 'customer', label: 'Customer', options: salesFamily ? salesOptions?.customer || [] : [] },
    { key: 'staff', label: 'Staff', options: filterOptions.staff },
    { key: 'paymentMethod', label: 'Payment method', options: salesFamily ? salesOptions?.paymentMethod || [] : [] },
    { key: 'venue', label: 'Venue', options: filterOptions.venue },
    { key: 'customerType', label: 'Customer type', options: filterOptions.customerType },
    { key: 'category', label: 'Category', options: filterOptions.category },
    { key: 'status', label: 'Status', options: salesFamily ? [] : uniqueValues(['orderStatus', 'kitchenBarStatus', 'postingStatus', 'billedPaid', 'status', 'tier']) },
    { key: 'item', label: 'Item', options: filterOptions.item },
    { key: 'table', label: 'Table / room', options: filterOptions.table },
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
      localStorage.setItem('fb.report-column-preferences', JSON.stringify(next));
    } catch {
      // Column choices remain active for this session if storage is blocked.
    }
  };

  const exportableReportData = rows.map((row) =>
    Object.fromEntries(visibleColumns.map((column) => [column.label, row[column.key]]))
  );

  const reportLabel = REPORT_LABELS[selectedReport] || selectedReport;
  const categoryLabel = category.label;

  const reportKpis = useMemo(() => {
    const count = rows.length;
    if (selectedReport === 'sales-summary') {
      return [
        { label: 'Days', value: count.toLocaleString(), hint: 'Days with activity' },
        { label: 'Orders', value: rows.reduce((sum, row) => sum + Number(row.orders || 0), 0).toLocaleString(), hint: 'Sold orders' },
        { label: 'Net sales', value: money(rows.reduce((sum, row) => sum + Number(row.netSales || 0), 0)), hint: 'Gross less discounts' },
        { label: 'Grand total', value: money(rows.reduce((sum, row) => sum + Number(row.grandTotal || 0), 0)), hint: 'Including tax and service' },
      ];
    }
    if (selectedReport === 'sales' || selectedReport === 'daily-sales') {
      return [
        { label: 'Line items', value: count.toLocaleString(), hint: 'Sold lines in period' },
        { label: 'Sales total', value: money(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)), hint: 'Sum of amount' },
        { label: 'Discounts', value: money(rows.reduce((sum, row) => sum + Number(row.discount || 0), 0)), hint: 'Order-level discounts' },
        { label: 'Billed/Paid', value: rows.filter((row) => row.billedPaid === 'Yes').length.toLocaleString(), hint: 'Paid lines' },
      ];
    }
    if (selectedReport === 'discounts') {
      return [
        { label: 'Discounted orders', value: count.toLocaleString(), hint: 'With a discount' },
        { label: 'Discount total', value: money(rows.reduce((sum, row) => sum + Number(row.discountAmount || 0), 0)), hint: 'Sum of discounts' },
        { label: 'Net sales', value: money(rows.reduce((sum, row) => sum + Number(row.total || 0), 0)), hint: 'After discount' },
        { label: 'Avg discount', value: count ? money(rows.reduce((sum, row) => sum + Number(row.discountAmount || 0), 0) / count) : money(0), hint: 'Per discounted order' },
      ];
    }
    if (selectedReport === 'product-mix') {
      const mix = reportData && !Array.isArray(reportData) ? reportData as { totalRevenue?: number; totalOrders?: number } : null;
      return [
        { label: 'Products', value: count.toLocaleString(), hint: 'Items sold' },
        { label: 'Total revenue', value: money(Number(mix?.totalRevenue ?? rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0))), hint: 'Period sales' },
        { label: 'Orders', value: Number(mix?.totalOrders || 0).toLocaleString(), hint: 'Orders with matching items' },
        { label: 'Top item share', value: rows[0] ? `${Number(rows[0].percentageOfSales || 0).toFixed(1)}%` : '0.0%', hint: 'Best seller' },
      ];
    }
    if (selectedReport === 'category-sales') {
      return [
        { label: 'Categories', value: count.toLocaleString(), hint: 'With sales' },
        { label: 'Qty sold', value: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0).toLocaleString(), hint: 'Portions' },
        { label: 'Revenue', value: money(rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0)), hint: 'Period sales' },
        { label: 'Top share', value: rows[0] ? `${Number(rows[0].sharePercentage || 0).toFixed(1)}%` : '0.0%', hint: 'Largest category' },
      ];
    }
    if (selectedReport === 'item-profitability') {
      const costRows = rows.filter((row) => row.cost !== null && row.cost !== undefined);
      const revenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
      const costedRevenue = costRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
      const cost = costRows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
      return [
        { label: 'Items', value: count.toLocaleString(), hint: 'Sold in the period' },
        { label: 'Revenue', value: money(revenue), hint: 'Selling price' },
        { label: 'Cost', value: money(cost), hint: 'Menu cost × qty' },
        { label: 'Food cost', value: costedRevenue > 0 ? `${((cost / costedRevenue) * 100).toFixed(1)}%` : '0.0%', hint: 'Cost ÷ revenue where a cost is set' },
      ];
    }
    if (selectedReport === 'theoretical-usage') {
      return [
        { label: 'Ingredients', value: count.toLocaleString(), hint: 'Consumed by sales' },
        { label: 'From recipes', value: rows.filter((row) => row.source === 'Recipe').length.toLocaleString(), hint: 'Recipe lines' },
        { label: 'Direct links', value: rows.filter((row) => row.source === 'Menu link').length.toLocaleString(), hint: 'Menu items tied to stock' },
        { label: 'Dishes', value: new Set(rows.flatMap((row) => String(row.dishes || '').split(', ').filter(Boolean))).size.toLocaleString(), hint: 'Dishes with a recipe or stock link' },
      ];
    }
    if (selectedReport === 'inventory') {
      return [
        { label: 'Catalog items', value: count.toLocaleString(), hint: 'Restaurant & Bar floor' },
        { label: 'In stock', value: rows.filter((row) => Number(row.onHand || 0) > 0).length.toLocaleString(), hint: 'On-hand above zero' },
        { label: 'Zero stock', value: rows.filter((row) => Number(row.onHand || 0) <= 0).length.toLocaleString(), hint: 'Nothing on the floor' },
        { label: 'Stock value', value: money(rows.reduce((sum, row) => sum + Number(row.stockValue || 0), 0)), hint: 'On-hand cost' },
      ];
    }
    if (selectedReport === 'requisitions') {
      return [
        { label: 'Requisitions', value: count.toLocaleString(), hint: 'Sent to Stores' },
        { label: 'Pending', value: rows.filter((row) => row.status === 'pending').length.toLocaleString(), hint: 'Awaiting approval' },
        { label: 'Approved', value: rows.filter((row) => row.status === 'approved' || row.status === 'ready').length.toLocaleString(), hint: 'Approved or ready' },
        { label: 'Lines', value: rows.reduce((sum, row) => sum + Number(row.itemCount || 0), 0).toLocaleString(), hint: 'Requested items' },
      ];
    }
    if (selectedReport === 'customer-analytics') {
      const analytics = reportData && !Array.isArray(reportData) ? reportData as Record<string, any> : null;
      return [
        { label: 'Total customers', value: Number(analytics?.totalCustomers || 0).toLocaleString(), hint: 'On file' },
        { label: 'Active', value: Number(analytics?.activeCustomers || 0).toLocaleString(), hint: 'Recent activity' },
        { label: 'Avg lifetime value', value: money(Number(analytics?.averageCustomerLifetimeValue || 0)), hint: 'Per customer' },
        { label: 'Top customers', value: count.toLocaleString(), hint: 'Shown below' },
      ];
    }
    if (selectedReport === 'kitchen-tickets' || selectedReport === 'bar-tickets') {
      return [
        { label: 'Ticket lines', value: count.toLocaleString(), hint: 'Items routed' },
        { label: 'Pending', value: rows.filter((row) => row.kitchenBarStatus === 'Pending').length.toLocaleString(), hint: 'Still open' },
        { label: 'Completed', value: rows.filter((row) => row.kitchenBarStatus === 'Completed').length.toLocaleString(), hint: 'Ready / served / billed' },
        { label: 'Qty', value: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0).toLocaleString(), hint: 'Items prepared' },
      ];
    }
    if (selectedReport === 'voided-orders') {
      return [
        { label: 'Voids', value: count.toLocaleString(), hint: 'Cancelled orders' },
        { label: 'Void value', value: money(rows.reduce((sum, row) => sum + Number(row.total || 0), 0)), hint: 'Cancelled totals' },
        { label: 'Venues', value: new Set(rows.map((row) => row.venue).filter(Boolean)).size.toLocaleString(), hint: 'Distinct venues' },
        { label: 'Servers', value: new Set(rows.map((row) => row.server).filter((v) => v && v !== '—')).size.toLocaleString(), hint: 'Staff involved' },
      ];
    }
    if (selectedReport === 'table-sales') {
      return [
        { label: 'Tables', value: count.toLocaleString(), hint: 'With sales' },
        { label: 'Orders', value: rows.reduce((sum, row) => sum + Number(row.orders || 0), 0).toLocaleString(), hint: 'Across tables' },
        { label: 'Sales', value: money(rows.reduce((sum, row) => sum + Number(row.sales || 0), 0)), hint: 'Period total' },
        { label: 'Covers', value: rows.reduce((sum, row) => sum + Number(row.covers || 0), 0).toLocaleString(), hint: 'Guests seated' },
      ];
    }
    if (selectedReport === 'sales-by-employee') {
      return [
        { label: 'Staff', value: count.toLocaleString(), hint: 'With attributed sales' },
        { label: 'Gross sales', value: money(rows.reduce((sum, row) => sum + Number(row.grossSales || 0), 0)), hint: 'Before discounts' },
        { label: 'Net sales', value: money(rows.reduce((sum, row) => sum + Number(row.netSales || 0), 0)), hint: 'After discounts' },
        { label: 'Voids', value: rows.reduce((sum, row) => sum + Number(row.voids || 0), 0).toLocaleString(), hint: 'Cancelled orders' },
      ];
    }
    if (selectedReport === 'room-charges') {
      return [
        { label: 'Room charges', value: count.toLocaleString(), hint: 'Orders with a room' },
        { label: 'Total', value: money(rows.reduce((sum, row) => sum + Number(row.total || 0), 0)), hint: 'Including tax' },
        { label: 'Posted', value: rows.filter((row) => row.postingStatus === 'Posted').length.toLocaleString(), hint: 'On guest folio' },
        { label: 'Not posted', value: rows.filter((row) => row.postingStatus === 'Not Posted').length.toLocaleString(), hint: 'Awaiting folio' },
      ];
    }
    return [
      { label: 'Records', value: count.toLocaleString(), hint: 'Matching the filters' },
      { label: 'Period start', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : startDate, hint: 'Business date' },
      { label: 'Period end', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : endDate, hint: reportDateMode === 'range' ? 'Inclusive' : 'Single day' },
      { label: 'Status', value: 'Current', hint: generatedAt ? `Refreshed ${generatedAt}` : 'Preparing report' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshKey, mounted, filters, reportData, dataTick]);

  const hiddenKpiLabels = hiddenKpisByReport[selectedReport] || [];
  const visibleReportKpis = reportKpis.filter((kpi) => !hiddenKpiLabels.includes(kpi.label));
  const saveKpiPreferences = (hiddenLabels: string[]) => {
    const next = { ...hiddenKpisByReport, [selectedReport]: hiddenLabels };
    setHiddenKpisByReport(next);
    try {
      localStorage.setItem('fb.report-summary-preferences', JSON.stringify(next));
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

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    setGeneratedAt(new Date().toLocaleString('en-GH'));
    void ordersStore.hydrateFromApi();
    void customerStore.hydrateFromApi();
    void loadProductCatalog();
    void useTenantStaffStore.getState().hydrateFromApi();
  };

  const handleExportReport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsGenerating(true);
    try {
      const extension = format === 'excel' ? 'xls' : format;
      const filename = `${selectedReport}_report_${startDate}.${extension}`;
      const generatedLabel = generatedAt ? `Generated on ${generatedAt} by ${currentUserLabel}` : undefined;
      const fileUrl = await reportingStore.exportReport(exportableReportData, format, filename, generatedLabel);
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(fileUrl);
    } catch (error) {
      console.error('[F&B REPORTS] Error exporting report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderReportTable = () => {
    if (!mounted) {
      return (
        <div className="py-8 text-center">
          <p className="text-gray-500">Loading…</p>
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
        renderCell={(row, column) => formatReportValue(row[column.key], column.key)}
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
              F&B INTELLIGENCE
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Reports & Analysis</h1>
              <ReportPageInfoTip text="Sales, product mix, tickets and staff performance for Restaurant & Bar from one workspace." />
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
                <DropdownItem key="pdf" startContent={<FileText size={16} />} onPress={() => handleExportReport('pdf')}>
                  Download PDF
                </DropdownItem>
                <DropdownItem key="excel" startContent={<FileSpreadsheet size={16} />} onPress={() => handleExportReport('excel')}>
                  Download Excel
                </DropdownItem>
                <DropdownItem key="csv" startContent={<ArrowDownToLine size={16} />} onPress={() => handleExportReport('csv')}>
                  Download CSV
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        <Card className="border border-slate-200 shadow-sm">
          <CardBody className="gap-2 px-3 py-2">
            <Tabs
              selectedKey={selectedCategory}
              onSelectionChange={(key) => setSelectedCategory(String(key))}
              aria-label="Report categories"
              color="primary"
              variant="underlined"
              classNames={{ tabList: 'gap-3', cursor: 'w-full', tab: 'px-0 h-8' }}
            >
              {REPORT_CATEGORIES.map((c) => (
                <Tab key={c.key} title={c.label} />
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
                    {category.reports.map((key) => (
                      <SelectItem key={key}>{REPORT_LABELS[key]}</SelectItem>
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
                        placeholder="Order, item, table, guest..."
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
                        Showing {rows.length} of {salesFamily ? unfilteredRowCount : rawRows.length}
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
                      text={`${categoryLabel} report for Restaurant & Bar.`}
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
                  {availableColumns.length > 0 && (
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
              placeholder="Add notes for this report..."
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              minRows={4}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>Cancel</Button>
            <Button color="primary" onPress={onClose}>
              Save Notes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
