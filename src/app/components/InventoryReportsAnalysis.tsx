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
import { SortableReportTable } from './reports/SortableReportTable';
import { useStockStore } from '../lib/inventory/stockStore';
import { useSupplierStore } from '../lib/inventory/supplierStore';
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
  return `GH₵ ${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const RANGE_REPORT_KEYS = new Set(['movements', 'purchase-orders', 'requisitions', 'transfers', 'issues', 'stock-counts']);
const NO_DATE_REPORT_KEYS = new Set(['stock-items', 'low-stock', 'out-of-stock', 'overstock', 'stock-by-category', 'stock-by-location', 'suppliers']);

const REPORT_GROUPS = {
  stock: {
    title: 'Stock & Movements',
    description: 'The stock file, reorder exceptions, and movements already posted.',
    reports: [
      ['stock-items', 'Stock Items'],
      ['low-stock', 'Low Stock'],
      ['out-of-stock', 'Out of Stock'],
      ['overstock', 'Overstock'],
      ['stock-by-category', 'Stock by category'],
      ['stock-by-location', 'Stock by location'],
      ['movements', 'Stock Movements'],
    ],
  },
  activity: {
    title: 'Activity',
    description: 'Transfers between locations, issues to departments, and stock counts.',
    reports: [
      ['transfers', 'Transfers'],
      ['issues', 'Issues'],
      ['stock-counts', 'Stock counts'],
    ],
  },
  procurement: {
    title: 'Procurement',
    description: 'Purchase orders, requisitions and suppliers on file.',
    reports: [
      ['purchase-orders', 'Purchase Orders'],
      ['requisitions', 'Requisitions'],
      ['suppliers', 'Suppliers'],
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
};

const EMPTY_REPORT_FILTERS: ReportFilters = {
  query: '',
  status: 'all',
  type: 'all',
  staff: 'all',
  category: 'all',
  method: 'all',
};

const REPORT_DESCRIPTIONS: Record<string, string> = {
  'stock-items': 'Active and inactive items on the stock file. Value is current quantity × stored unit cost.',
  'low-stock': 'Active items still on hand that are at or below their reorder point.',
  'out-of-stock': 'Active items at zero or below their minimum stock.',
  overstock: 'Active items above 80% of their maximum stock.',
  'stock-by-category': 'On-hand quantity and value rolled up by item category.',
  'stock-by-location': 'On-hand quantity and value rolled up by store location.',
  movements: 'Stock movements posted in the selected period.',
  transfers: 'Stock transfers between locations whose transfer date falls in the selected period.',
  issues: 'Goods issued to departments whose issue date falls in the selected period.',
  'stock-counts': 'Stock counts whose start date falls in the selected period, with variance.',
  'purchase-orders': 'Purchase orders whose order date falls in the selected period.',
  requisitions: 'Store requisitions whose request date falls in the selected period.',
  suppliers: 'Suppliers currently on file. Rating is the stored figure, not a computed score.',
};

type ReportColumnDefinition = { key: string; label: string; defaultVisible?: boolean };

const REPORT_COLUMNS: Record<string, ReportColumnDefinition[]> = {
  'stock-items': [
    { key: 'itemCode', label: 'Code' },
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'location', label: 'Location' },
    { key: 'currentStock', label: 'Qty' },
    { key: 'unit', label: 'Unit' },
    { key: 'unitCost', label: 'Unit cost' },
    { key: 'stockValue', label: 'Value' },
    { key: 'reorderPoint', label: 'Reorder', defaultVisible: false },
    { key: 'isActive', label: 'Active' },
  ],
  'low-stock': [
    { key: 'itemCode', label: 'Code' },
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'currentStock', label: 'Qty' },
    { key: 'reorderPoint', label: 'Reorder' },
    { key: 'unitCost', label: 'Unit cost' },
    { key: 'stockValue', label: 'Value' },
    { key: 'supplierName', label: 'Supplier' },
  ],
  'out-of-stock': [
    { key: 'itemCode', label: 'Code' },
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'currentStock', label: 'Qty' },
    { key: 'minimumStock', label: 'Minimum' },
    { key: 'reorderPoint', label: 'Reorder' },
    { key: 'supplierName', label: 'Supplier' },
  ],
  overstock: [
    { key: 'itemCode', label: 'Code' },
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'currentStock', label: 'Qty' },
    { key: 'maximumStock', label: 'Maximum' },
    { key: 'stockValue', label: 'Value' },
  ],
  'stock-by-category': [
    { key: 'category', label: 'Category' },
    { key: 'items', label: 'Items' },
    { key: 'quantity', label: 'Qty' },
    { key: 'stockValue', label: 'Value' },
  ],
  'stock-by-location': [
    { key: 'location', label: 'Location' },
    { key: 'items', label: 'Items' },
    { key: 'quantity', label: 'Qty' },
    { key: 'stockValue', label: 'Value' },
  ],
  movements: [
    { key: 'createdAt', label: 'Date' },
    { key: 'itemCode', label: 'Code' },
    { key: 'itemName', label: 'Item' },
    { key: 'movementType', label: 'Type' },
    { key: 'quantity', label: 'Qty' },
    { key: 'totalValue', label: 'Value' },
    { key: 'referenceNumber', label: 'Reference' },
    { key: 'performedBy', label: 'By', defaultVisible: false },
  ],
  transfers: [
    { key: 'transferNumber', label: 'Transfer' },
    { key: 'transferDate', label: 'Date' },
    { key: 'fromLocation', label: 'From' },
    { key: 'toLocation', label: 'To' },
    { key: 'status', label: 'Status' },
    { key: 'itemCount', label: 'Lines' },
    { key: 'totalValue', label: 'Value' },
    { key: 'createdBy', label: 'By' },
    { key: 'items', label: 'Items' },
  ],
  issues: [
    { key: 'issueNumber', label: 'Issue' },
    { key: 'issueDate', label: 'Date' },
    { key: 'department', label: 'Department' },
    { key: 'issuedTo', label: 'Issued to' },
    { key: 'status', label: 'Status' },
    { key: 'itemCount', label: 'Lines' },
    { key: 'totalValue', label: 'Value' },
    { key: 'issuedBy', label: 'By' },
    { key: 'items', label: 'Items' },
  ],
  'stock-counts': [
    { key: 'countNumber', label: 'Count' },
    { key: 'startDate', label: 'Started' },
    { key: 'location', label: 'Location' },
    { key: 'countType', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'countedItems', label: 'Counted' },
    { key: 'varianceItems', label: 'Variances' },
    { key: 'varianceValue', label: 'Variance value' },
    { key: 'performedBy', label: 'By' },
  ],
  'purchase-orders': [
    { key: 'poNumber', label: 'PO' },
    { key: 'orderDate', label: 'Ordered' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'status', label: 'Status' },
    { key: 'finalAmount', label: 'Amount' },
    { key: 'expectedDeliveryDate', label: 'Expected' },
    { key: 'itemCount', label: 'Lines' },
  ],
  requisitions: [
    { key: 'requisitionNumber', label: 'Requisition' },
    { key: 'requestedDate', label: 'Requested' },
    { key: 'requestedBy', label: 'Requested by' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
    { key: 'itemCount', label: 'Lines' },
    { key: 'items', label: 'Items' },
    { key: 'notes', label: 'Notes', defaultVisible: false },
  ],
  suppliers: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Supplier' },
    { key: 'contactPerson', label: 'Contact' },
    { key: 'phone', label: 'Phone' },
    { key: 'rating', label: 'Rating' },
    { key: 'currentBalance', label: 'Balance' },
    { key: 'isActive', label: 'Active' },
  ],
};

function stockRow(item: {
  itemCode: string;
  name: string;
  category: string;
  location?: string;
  currentStock: number;
  unit?: string;
  unitCost: number;
  reorderPoint?: number;
  minimumStock?: number;
  maximumStock?: number;
  supplierName?: string;
  isActive?: boolean;
}) {
  return {
    itemCode: item.itemCode,
    name: item.name,
    category: item.category,
    location: item.location || '—',
    currentStock: item.currentStock,
    unit: item.unit || '—',
    unitCost: item.unitCost,
    stockValue: item.currentStock * item.unitCost,
    reorderPoint: item.reorderPoint ?? '—',
    minimumStock: item.minimumStock ?? '—',
    maximumStock: item.maximumStock ?? '—',
    supplierName: item.supplierName || '—',
    isActive: item.isActive !== false,
  };
}

export default function InventoryReportsAnalysis({ embedded = false }: { embedded?: boolean }) {
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('stock');
  const [selectedReport, setSelectedReport] = useState('stock-items');
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

  const settings = useSettingsStore();
  const orgProfile = buildOrgProfile(settings);
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  const stockItems = useStockStore((s) => s.stockItems);
  const stockMovements = useStockStore((s) => s.stockMovements);
  const stockTransfers = useStockStore((s) => s.stockTransfers);
  const stockCounts = useStockStore((s) => s.stockCounts);
  const goodsIssues = useStockStore((s) => s.goodsIssues);
  const getLowStockItems = useStockStore((s) => s.getLowStockItems);
  const getOutOfStockItems = useStockStore((s) => s.getOutOfStockItems);
  const getOverstockItems = useStockStore((s) => s.getOverstockItems);
  const hydrateStock = useStockStore((s) => s.hydrateFromApi);
  const suppliers = useSupplierStore((s) => s.suppliers);
  const purchaseOrders = useSupplierStore((s) => s.purchaseOrders);
  const requisitions = useSupplierStore((s) => s.requisitions);
  const hydrateSuppliers = useSupplierStore((s) => s.hydrateSuppliersFromApi);
  const hydratePOs = useSupplierStore((s) => s.hydratePurchaseOrdersFromApi);
  const hydrateRequisitions = useSupplierStore((s) => s.hydrateRequisitionsFromApi);

  const hydrateAll = () => Promise.all([hydrateStock(), hydrateSuppliers(), hydratePOs(), hydrateRequisitions()]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('inventory.report-summary-preferences');
      if (saved) setHiddenKpisByReport(JSON.parse(saved));
      const savedColumns = localStorage.getItem('inventory.report-column-preferences');
      if (savedColumns) setHiddenColumnsByReport(JSON.parse(savedColumns));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    hydrateAll().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrateStock, hydrateSuppliers, hydratePOs, hydrateRequisitions]);
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, selectedTab, startDate, endDate, refreshVersion, stockItems, stockMovements, stockTransfers, stockCounts, goodsIssues, purchaseOrders, requisitions]);
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
    hydrateAll().then(() => {
      setRefreshVersion((v) => v + 1);
      setGeneratedAt(new Date().toLocaleString('en-GH'));
    }).catch(() => setRefreshVersion((v) => v + 1));
  };

  const getCurrentReportData = () => {
    switch (selectedReport) {
      case 'stock-items':
        return stockItems.map(stockRow);
      case 'low-stock':
        return getLowStockItems().map(stockRow);
      case 'out-of-stock':
        return getOutOfStockItems().map(stockRow);
      case 'overstock':
        return getOverstockItems().map(stockRow);
      case 'stock-by-category': {
        const byCategory = new Map<string, { items: number; quantity: number; stockValue: number }>();
        stockItems.forEach((item) => {
          const category = item.category || '—';
          const current = byCategory.get(category) || { items: 0, quantity: 0, stockValue: 0 };
          current.items += 1;
          current.quantity += Number(item.currentStock || 0);
          current.stockValue += Number(item.currentStock || 0) * Number(item.unitCost || 0);
          byCategory.set(category, current);
        });
        return Array.from(byCategory.entries()).map(([category, row]) => ({ category, ...row }));
      }
      case 'stock-by-location': {
        const byLocation = new Map<string, { items: number; quantity: number; stockValue: number }>();
        stockItems.forEach((item) => {
          const location = item.location || '—';
          const current = byLocation.get(location) || { items: 0, quantity: 0, stockValue: 0 };
          current.items += 1;
          current.quantity += Number(item.currentStock || 0);
          current.stockValue += Number(item.currentStock || 0) * Number(item.unitCost || 0);
          byLocation.set(location, current);
        });
        return Array.from(byLocation.entries()).map(([location, row]) => ({ location, ...row }));
      }
      case 'movements':
        return stockMovements
          .filter((row) => inDateRange(dayOf(row.createdAt), startDate, endDate))
          .map((row) => ({
            createdAt: dayOf(row.createdAt),
            itemCode: row.itemCode,
            itemName: row.itemName,
            movementType: row.movementType,
            quantity: row.quantity,
            totalValue: row.totalValue,
            referenceNumber: row.referenceNumber || '—',
            performedBy: row.performedBy || '—',
          }));
      case 'transfers':
        return stockTransfers
          .filter((row) => inDateRange(dayOf(row.transferDate), startDate, endDate))
          .map((row) => ({
            transferNumber: row.transferNumber,
            transferDate: dayOf(row.transferDate),
            fromLocation: row.fromLocation || '—',
            toLocation: row.toLocation || '—',
            status: row.status,
            itemCount: row.items?.length || 0,
            totalValue: row.totalValue,
            createdBy: row.createdBy || '—',
            items: (row.items || []).map((item) => `${item.quantity}× ${item.itemName}`).join(', ') || '—',
          }));
      case 'issues':
        return goodsIssues
          .filter((row) => inDateRange(dayOf(row.issueDate), startDate, endDate))
          .map((row) => ({
            issueNumber: row.issueNumber,
            issueDate: dayOf(row.issueDate),
            department: row.department || '—',
            issuedTo: row.issuedTo || '—',
            status: row.status,
            itemCount: row.items?.length || 0,
            totalValue: row.totalValue,
            issuedBy: row.issuedBy || '—',
            items: (row.items || []).map((item) => `${item.quantity}× ${item.itemName}`).join(', ') || '—',
          }));
      case 'stock-counts':
        return stockCounts
          .filter((row) => inDateRange(dayOf(row.startDate), startDate, endDate))
          .map((row) => ({
            countNumber: row.countNumber,
            startDate: dayOf(row.startDate),
            location: row.location || '—',
            countType: row.countType,
            status: row.status,
            countedItems: row.countedItems,
            varianceItems: row.varianceItems,
            varianceValue: row.varianceValue,
            performedBy: row.performedBy || row.createdBy || '—',
          }));
      case 'purchase-orders':
        return purchaseOrders
          .filter((row) => inDateRange(dayOf(row.orderDate), startDate, endDate))
          .map((row) => ({
            poNumber: row.poNumber,
            orderDate: dayOf(row.orderDate),
            supplierName: row.supplierName,
            status: row.status,
            finalAmount: row.finalAmount,
            expectedDeliveryDate: dayOf(row.expectedDeliveryDate) || '—',
            itemCount: row.items?.length || 0,
          }));
      case 'requisitions':
        return requisitions
          .filter((row) => inDateRange(dayOf(row.requestedDate), startDate, endDate))
          .map((row) => ({
            requisitionNumber: row.requisitionNumber,
            requestedDate: dayOf(row.requestedDate),
            requestedBy: row.requestedBy,
            department: row.department || '—',
            status: row.status,
            itemCount: row.requestedItems?.length || 0,
            items: (row.requestedItems || []).map((item) => `${item.quantity}× ${item.itemName}`).join(', ') || '—',
            notes: row.notes || '—',
          }));
      case 'suppliers':
        return suppliers.map((row) => ({
          code: row.code,
          name: row.name,
          contactPerson: row.contactPerson || '—',
          phone: row.phone || '—',
          rating: row.rating,
          currentBalance: row.currentBalance,
          isActive: row.isActive,
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
    status: uniqueValues(['status', 'isActive']),
    type: uniqueValues(['movementType', 'category', 'countType']),
    staff: uniqueValues(['supplierName', 'requestedBy', 'performedBy', 'createdBy', 'issuedBy', 'issuedTo']),
    category: uniqueValues(['category', 'location', 'department', 'fromLocation', 'toLocation']),
    method: uniqueValues(['unit']),
  };
  const rows = rawRows.filter((row) => {
    const query = filters.query.trim().toLocaleLowerCase();
    const matchesQuery = !query || Object.values(row).some((value) => {
      const searchable = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      return searchable.toLocaleLowerCase().includes(query);
    });
    return matchesQuery
      && (filters.status === 'all' || fieldValue(row, ['status', 'isActive']) === filters.status)
      && (filters.type === 'all' || fieldValue(row, ['movementType', 'category', 'countType']) === filters.type)
      && (filters.staff === 'all' || fieldValue(row, ['supplierName', 'requestedBy', 'performedBy', 'createdBy', 'issuedBy', 'issuedTo']) === filters.staff)
      && (filters.category === 'all' || fieldValue(row, ['category', 'location', 'department', 'fromLocation', 'toLocation']) === filters.category)
      && (filters.method === 'all' || fieldValue(row, ['unit']) === filters.method);
  });
  const filteredReportData = Array.isArray(reportData) ? rows : reportData;
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === 'query' ? Boolean(value.trim()) : value !== 'all').length;
  const facetDefinitions = ([
    { key: 'status', label: 'Status', options: filterOptions.status },
    { key: 'type', label: 'Type', options: filterOptions.type },
    { key: 'staff', label: 'Party', options: filterOptions.staff },
    { key: 'category', label: 'Group', options: filterOptions.category },
    { key: 'method', label: 'Unit', options: filterOptions.method },
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
    try { localStorage.setItem('inventory.report-column-preferences', JSON.stringify(next)); } catch { /* ignore */ }
  };
  const exportableReportData = Array.isArray(filteredReportData)
    ? rows.map((row) => Object.fromEntries(visibleColumns.map((column) => [column.label, row[column.key]])))
    : filteredReportData;
  const reportLabel = REPORT_GROUPS[selectedTab].reports.find(([key]) => key === selectedReport)?.[1]
    || selectedReport.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const reportKpis = useMemo(() => {
    const count = rows.length;
    if (['stock-items', 'low-stock', 'out-of-stock', 'overstock'].includes(selectedReport)) {
      return [
        { label: 'Items', value: count.toLocaleString(), hint: 'On this list' },
        { label: 'Quantity', value: rows.reduce((sum, row) => sum + Number(row.currentStock || 0), 0).toLocaleString(), hint: 'Stored qty' },
        { label: 'Stock value', value: money(rows.reduce((sum, row) => sum + Number(row.stockValue || 0), 0)), hint: 'Qty × unit cost' },
        { label: 'Active', value: rows.filter((row) => row.isActive !== false).length.toLocaleString(), hint: 'Marked active' },
      ];
    }
    if (selectedReport === 'stock-by-category' || selectedReport === 'stock-by-location') {
      return [
        { label: selectedReport === 'stock-by-category' ? 'Categories' : 'Locations', value: count.toLocaleString(), hint: 'With stock on file' },
        { label: 'Items', value: rows.reduce((sum, row) => sum + Number(row.items || 0), 0).toLocaleString(), hint: 'Catalog lines' },
        { label: 'Quantity', value: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0).toLocaleString(), hint: 'On hand' },
        { label: 'Stock value', value: money(rows.reduce((sum, row) => sum + Number(row.stockValue || 0), 0)), hint: 'Qty × unit cost' },
      ];
    }
    if (selectedReport === 'movements') {
      return [
        { label: 'Lines', value: count.toLocaleString(), hint: 'In period' },
        { label: 'In', value: rows.filter((row) => row.movementType === 'in').length.toLocaleString(), hint: 'Receipts' },
        { label: 'Out', value: rows.filter((row) => row.movementType === 'out').length.toLocaleString(), hint: 'Issues' },
        { label: 'Value', value: money(rows.reduce((sum, row) => sum + Number(row.totalValue || 0), 0)), hint: 'Posted value' },
      ];
    }
    if (selectedReport === 'transfers') {
      return [
        { label: 'Transfers', value: count.toLocaleString(), hint: 'In period' },
        { label: 'In transit', value: rows.filter((row) => row.status === 'pending' || row.status === 'in-transit').length.toLocaleString(), hint: 'Not delivered' },
        { label: 'Delivered', value: rows.filter((row) => row.status === 'delivered').length.toLocaleString(), hint: 'Received' },
        { label: 'Value', value: money(rows.reduce((sum, row) => sum + Number(row.totalValue || 0), 0)), hint: 'Transfer value' },
      ];
    }
    if (selectedReport === 'issues') {
      return [
        { label: 'Issues', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Departments', value: new Set(rows.map((row) => row.department).filter((value) => value && value !== '—')).size.toLocaleString(), hint: 'Issued to' },
        { label: 'Lines', value: rows.reduce((sum, row) => sum + Number(row.itemCount || 0), 0).toLocaleString(), hint: 'Item lines' },
        { label: 'Value', value: money(rows.reduce((sum, row) => sum + Number(row.totalValue || 0), 0)), hint: 'Issued cost' },
      ];
    }
    if (selectedReport === 'stock-counts') {
      return [
        { label: 'Counts', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Open', value: rows.filter((row) => row.status === 'planned' || row.status === 'in-progress').length.toLocaleString(), hint: 'Not completed' },
        { label: 'With variance', value: rows.filter((row) => Number(row.varianceItems || 0) !== 0).length.toLocaleString(), hint: 'Counted ≠ expected' },
        { label: 'Variance value', value: money(rows.reduce((sum, row) => sum + Number(row.varianceValue || 0), 0)), hint: 'Cost of differences' },
      ];
    }
    if (selectedReport === 'purchase-orders') {
      return [
        { label: 'Orders', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Open', value: rows.filter((row) => !['delivered', 'closed', 'cancelled'].includes(String(row.status))).length.toLocaleString(), hint: 'Not closed' },
        { label: 'Amount', value: money(rows.reduce((sum, row) => sum + Number(row.finalAmount || 0), 0)), hint: 'PO totals' },
        { label: 'Lines', value: rows.reduce((sum, row) => sum + Number(row.itemCount || 0), 0).toLocaleString(), hint: 'Order lines' },
      ];
    }
    if (selectedReport === 'requisitions') {
      return [
        { label: 'Requisitions', value: count.toLocaleString(), hint: 'In period' },
        { label: 'Pending', value: rows.filter((row) => row.status === 'pending').length.toLocaleString(), hint: 'Awaiting decision' },
        { label: 'Approved', value: rows.filter((row) => row.status === 'approved' || row.status === 'ready').length.toLocaleString(), hint: 'On file' },
        { label: 'Lines', value: rows.reduce((sum, row) => sum + Number(row.itemCount || 0), 0).toLocaleString(), hint: 'Requested lines' },
      ];
    }
    if (selectedReport === 'suppliers') {
      return [
        { label: 'Suppliers', value: count.toLocaleString(), hint: 'On file' },
        { label: 'Active', value: rows.filter((row) => row.isActive).length.toLocaleString(), hint: 'In use' },
        { label: 'Balance', value: money(rows.reduce((sum, row) => sum + Number(row.currentBalance || 0), 0)), hint: 'Stored balance' },
        { label: 'Period', value: 'Current', hint: 'Snapshot' },
      ];
    }
    return [
      { label: 'Records', value: count.toLocaleString(), hint: 'Matching the filters' },
      { label: 'Period start', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : startDate, hint: 'Selected' },
      { label: 'Period end', value: NO_DATE_REPORT_KEYS.has(selectedReport) ? '—' : endDate, hint: reportDateMode === 'range' ? 'Inclusive' : 'Single day' },
      { label: 'Status', value: 'Current', hint: generatedAt ? `Refreshed ${generatedAt}` : 'Preparing report' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, startDate, endDate, reportDateMode, generatedAt, refreshVersion, mounted, filters, stockItems, stockMovements, stockTransfers, stockCounts, goodsIssues, purchaseOrders, requisitions, suppliers]);

  const hiddenKpiLabels = hiddenKpisByReport[selectedReport] || [];
  const visibleReportKpis = reportKpis.filter((kpi) => !hiddenKpiLabels.includes(kpi.label));
  const saveKpiPreferences = (hiddenLabels: string[]) => {
    const next = { ...hiddenKpisByReport, [selectedReport]: hiddenLabels };
    setHiddenKpisByReport(next);
    try { localStorage.setItem('inventory.report-summary-preferences', JSON.stringify(next)); } catch { /* ignore */ }
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
      <SortableReportTable
        ariaLabel={`${selectedReport} report table`}
        columns={visibleColumns}
        rows={rows}
        renderCell={(row, column) => (
          typeof row[column.key] === 'number' && /(value|cost|amount|balance|price)/i.test(column.key)
            ? money(row[column.key] as number)
            : typeof row[column.key] === 'boolean'
            ? (row[column.key] ? 'Yes' : 'No')
            : formatReportValue(row[column.key])
        )}
      />
    );
  };

  const showDateControls = !NO_DATE_REPORT_KEYS.has(selectedReport);
  const rangeAllowed = RANGE_REPORT_KEYS.has(selectedReport);

  return (
    <div className={embedded ? 'px-2 py-1' : 'min-h-screen bg-slate-50/70 p-4 md:p-6'}>
      <div className="mx-auto max-w-[1600px] space-y-2">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <BarChart3 size={16} />
              INVENTORY INTELLIGENCE
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Reports & Analysis</h1>
              <ReportPageInfoTip text="Stock file, movements, transfers, issues, counts, purchase orders, requisitions and suppliers from one workspace." />
            </div>
          </div>
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto">
            <Button size="sm" variant="flat" className="shrink-0" startContent={<RefreshCw size={16} />} onPress={handleRefresh}>Refresh</Button>
            <Button size="sm" variant="bordered" className="shrink-0" startContent={<StickyNote size={16} />} onPress={onOpen}>Notes</Button>
            <Button size="sm" variant="bordered" className="shrink-0" startContent={<Printer size={16} />} onPress={() => window.print()}>Print</Button>
            <Dropdown>
              <DropdownTrigger>
                <Button size="sm" color="primary" className="shrink-0" startContent={<ArrowDownToLine size={16} />} isLoading={isGenerating}>Export</Button>
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
          <CardBody className="gap-2 px-3 py-2">
            <Tabs selectedKey={selectedTab} onSelectionChange={handleTabChange} aria-label="Report categories" color="primary" variant="underlined" classNames={{ tabList: 'gap-3', cursor: 'w-full', tab: 'px-0 h-8' }}>
              {Object.entries(REPORT_GROUPS).map(([key, group]) => <Tab key={key} title={group.title} />)}
            </Tabs>
            <div className="flex flex-col gap-2 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between min-[900px]:gap-3">
              <Select
                label="Report"
                className="w-full max-w-full min-[900px]:w-64 min-[900px]:max-w-[16rem] min-[900px]:shrink-0"
                classNames={{ trigger: 'min-h-[48px] h-[48px] py-1', label: 'text-xs', value: 'text-sm' }}
                selectedKeys={[selectedReport]}
                onSelectionChange={(keys) => { const next = Array.from(keys)[0] as string; if (next) setSelectedReport(next); }}
                startContent={<TrendingUp size={15} className="text-slate-400" />}
              >
                {REPORT_GROUPS[selectedTab].reports.map(([key, label]) => <SelectItem key={key}>{label}</SelectItem>)}
              </Select>
              {showDateControls && (
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
                        disabled={mode === 'range' && !rangeAllowed}
                        className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
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
                      <Input aria-label="Report date" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setEndDate(event.target.value); }} className="w-[8.5rem] max-w-[8.5rem] shrink-0" classNames={{ inputWrapper: 'w-[8.5rem] max-w-[8.5rem]', input: 'text-xs' }} size="sm" />
                    )}
                    {reportDateMode === 'range' && rangeAllowed && (
                      <>
                        <Input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-[8.5rem] max-w-[8.5rem] shrink-0" classNames={{ inputWrapper: 'w-[8.5rem] max-w-[8.5rem]', input: 'text-xs' }} size="sm" />
                        <span className="shrink-0 text-sm text-slate-400">to</span>
                        <Input aria-label="End date" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="w-[8.5rem] max-w-[8.5rem] shrink-0" classNames={{ inputWrapper: 'w-[8.5rem] max-w-[8.5rem]', input: 'text-xs' }} size="sm" />
                      </>
                    )}
                  </div>
              </div>
              )}
            </div>
            {(rawRows.length > 0 || facetDefinitions.length > 0) && (
              <div className="border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Search report results" placeholder="Item, PO, supplier, location..." value={filters.query} onValueChange={(query) => setFilters((current) => ({ ...current, query }))} startContent={<Search size={16} className="text-slate-400" />} size="sm" className="w-full sm:w-64 lg:w-72" />
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
          <CardBody className="overflow-x-auto px-3 py-1.5">
            <div className="flex min-w-max items-center gap-3">
              <div className="flex flex-1 items-center divide-x divide-slate-200">
                {visibleReportKpis.length > 0 ? visibleReportKpis.map((kpi) => (
                  <div key={kpi.label} className="flex items-baseline gap-1.5 px-3 first:pl-0 last:pr-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</span>
                    <span className="text-sm font-bold text-slate-950">{kpi.value}</span>
                  </div>
                )) : <p className="pr-3 text-sm text-slate-500">All summary metrics are hidden.</p>}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-slate-200 pl-3">{summaryCustomizationControls}</div>
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
                <ReportPageInfoTip text={REPORT_DESCRIPTIONS[selectedReport] || REPORT_GROUPS[selectedTab].description} label={`About ${reportLabel}`} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="whitespace-nowrap text-[11px] text-slate-500">
                {NO_DATE_REPORT_KEYS.has(selectedReport) ? 'Current snapshot' : startDate === endDate ? startDate : `${startDate} – ${endDate}`}
                <span className="mx-1.5 text-slate-300">·</span>
                Generated {generatedAt ?? '…'} by {currentUserLabel}
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
