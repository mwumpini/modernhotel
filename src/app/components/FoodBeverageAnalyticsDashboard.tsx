'use client';

/**
 * F&B's Reports & Analysis screen, rebuilt on the same pattern as Front Office's
 * (FrontOfficeReportsAnalysis.tsx): a report picker + the shared Today/Specific/Range
 * date control + the shared ReportOutput renderer + real Excel/PDF/CSV export — instead
 * of the fixed multi-tab layout this replaced, which spent 5 of its 9 report cards on
 * lib/fb/inventoryStore.ts, supplierStore.ts and employeeStore.ts: three hardcoded,
 * never-hydrated demo stores (fake ingredients, fake suppliers, fake staff like "Kwame
 * Addo") with zero connection to this tenant's real data. Those five reports (Inventory,
 * Waste, Labor Cost, Financial Summary, Supplier Analytics) are dropped rather than
 * reskinned onto real-looking fake numbers.
 *
 * Reports are grouped into 5 categories (a structure proposed against a legacy PMS's
 * F&B report menu, adopted here) instead of one long flat list. "Live Operational
 * Monitors" has no report of its own in this screen — a real-time pending KOT/BOT view
 * is a different kind of screen (KitchenDisplaySystem.tsx already is one), not a
 * history report, so that tab points there instead of faking a live feed.
 *
 * Every report here reads only real, persisted data (ordersStore, customerStore, the
 * tenant's real staff via /api/tenant). Kitchen Tickets/Bar Tickets/Voided Orders/
 * Discounts are real history logs — every ticket, void or discount that happened in
 * the selected period — not a "what's outstanding right now" snapshot.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Select, SelectItem, Tabs, Tab, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { reportingStore, type CategoryFilter, type DailySalesFilters } from '../lib/fb/reportingStore';
import type { CustomerType } from '../lib/fb/ordersStore';
import { ordersStore } from '../lib/fb/ordersStore';
import { customerStore } from '../lib/fb/customerStore';
import { useTenantStaffStore } from '../lib/tenant/tenantStaffStore';
import { useMenuCatalogStore } from '../lib/fb/menuCatalogStore';
import { useSettingsStore } from '../lib/settings/store';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import { ReportOutput, ReportDateControl, TransactionFilters, type ReportDateMode } from './reports/ReportBasics';

const REPORT_LABELS: Record<string, string> = {
  'daily-sales': 'Daily Sales Report',
  'discounts': 'Discount Report',
  'customer-analytics': 'Customer Analytics',
  'product-mix': 'Product Mix Report',
  'kitchen-tickets': 'Kitchen Tickets (KOT)',
  'bar-tickets': 'Bar Tickets (BOT)',
  'voided-orders': 'Voided/Cancelled Orders',
  'table-sales': 'Table Sales Report',
  'sales-by-employee': 'Sales by Employee',
  'room-charges': 'Room Charge Report',
};

type ReportCategory = { key: string; label: string; icon: string; reports: string[] };

// Room Charges lives in Sales & Financial rather than its own "Payments" tab —
// a real Payment Report and Shift/Cashier Report would belong there too, but
// neither is buildable yet (no payment method is captured anywhere for F&B
// orders, and the real CashierShift model is Front-Office-only), so a
// Payments tab with a single report in it isn't worth splitting out yet.
const REPORT_CATEGORIES: ReportCategory[] = [
  { key: 'sales-financial', label: 'Sales & Financial', icon: '💰', reports: ['daily-sales', 'discounts', 'customer-analytics', 'room-charges'] },
  { key: 'product-inventory', label: 'Product & Inventory', icon: '🍲', reports: ['product-mix'] },
  { key: 'operational-service', label: 'Operational & Service', icon: '🧾', reports: ['kitchen-tickets', 'bar-tickets', 'voided-orders', 'table-sales'] },
  { key: 'staff-performance', label: 'Staff & Performance', icon: '🧑‍🍳', reports: ['sales-by-employee'] },
  { key: 'live-monitors', label: 'Live Monitors', icon: '🔴', reports: [] },
];

// Every report except Daily Sales (a single day's sales-by-hour breakdown) and
// Customer Analytics (no date input at all — reads the customer base as it stands
// right now) is a history log or period aggregate, so it supports a date range.
const RANGE_REPORT_KEYS = new Set([
  'product-mix', 'sales-by-employee', 'kitchen-tickets', 'bar-tickets', 'voided-orders', 'discounts', 'table-sales', 'room-charges',
]);
const NO_DATE_REPORT_KEYS = new Set(['customer-analytics']);

// Real, fixed enum (see CustomerType in ordersStore.ts) — not fabricated options.
const CUSTOMER_TYPES: CustomerType[] = ['In-house', 'Walk-in', 'Takeout', 'Bar Tab'];

export default function FoodBeverageAnalyticsDashboard() {
  const [selectedCategory, setSelectedCategory] = useState(REPORT_CATEGORIES[0].key);
  const [selectedReport, setSelectedReport] = useState('daily-sales');
  // Multi-select filters — empty array means "no filter on this dimension", not
  // "match nothing" (see matchesCategoryFilter/matchesList in reportingStore.ts).
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>([]);
  const [staffFilter, setStaffFilter] = useState<string[]>([]);
  const [itemFilter, setItemFilter] = useState<string[]>([]);
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportDateMode, setReportDateMode] = useState<ReportDateMode>('today');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  const category = REPORT_CATEGORIES.find((c) => c.key === selectedCategory) || REPORT_CATEGORIES[0];

  // Switching category should land on one of ITS reports — otherwise the picker
  // below would keep showing a report that isn't even in the list under it.
  useEffect(() => {
    if (category.reports.length > 0 && !category.reports.includes(selectedReport)) {
      setSelectedReport(category.reports[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Report data reads ordersStore/customerStore directly, which start empty on the
  // server (and the client's first paint) and only fill in once hydrateFromApi()
  // resolves — deferring the table itself avoids a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const settings = useSettingsStore();
  const orgProfile = buildOrgProfile(settings);
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  // ordersStore/customerStore start empty and hydrate async from real, persisted
  // records — these ticks force the report below to recompute once that data
  // actually arrives instead of permanently reflecting an empty first render.
  const [dataTick, setDataTick] = useState(0);
  useEffect(() => {
    ordersStore.hydrateFromApi().then(() => setDataTick((t) => t + 1));
    customerStore.hydrateFromApi().then(() => setDataTick((t) => t + 1));
    const unsubOrders = ordersStore.subscribe(() => setDataTick((t) => t + 1));
    const unsubCustomers = customerStore.subscribe(() => setDataTick((t) => t + 1));
    // Real staff names/roles for Sales by Employee (see reportingStore.ts) —
    // the same tenant staff list FBPOS's waiter picker uses.
    void useTenantStaffStore.getState().hydrateFromApi();
    // Real menu categories (food/beverage/dessert/snack/whatever gets added later)
    // for the category filter dropdown — see menuCatalogStore.ts.
    void useMenuCatalogStore.getState().hydrateFromApi();
    return () => { unsubOrders(); unsubCustomers(); };
  }, []);
  const staffList = useTenantStaffStore((s) => s.staff);
  const availableCategories = useMenuCatalogStore((s) => s.categories);
  const availableItems = useMenuCatalogStore((s) => s.items);

  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GH'));
  }, [selectedReport, startDate, endDate]);

  // A report switched to that doesn't support Range shouldn't leave the control
  // stuck on a disabled "Range" pill with nothing to fill in.
  useEffect(() => {
    if (reportDateMode === 'range' && !RANGE_REPORT_KEYS.has(selectedReport)) {
      const today = new Date().toISOString().split('T')[0];
      setReportDateMode('today');
      setStartDate(today);
      setEndDate(today);
    }
  }, [selectedReport, reportDateMode]);

  const getCurrentReportData = () => {
    switch (selectedReport) {
      case 'daily-sales': {
        const filters: DailySalesFilters = {
          categories: categoryFilter,
          staff: staffFilter,
          items: itemFilter,
          customerTypes: customerTypeFilter,
        };
        return reportingStore.generateDailySalesReport(startDate, filters);
      }
      case 'product-mix':
        return reportingStore.generateProductMixReport(startDate, endDate, categoryFilter);
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
        return reportingStore.generateDailySalesReport(startDate, { categories: categoryFilter });
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reportData = useMemo(
    () => getCurrentReportData(),
    [selectedReport, startDate, endDate, categoryFilter, staffFilter, itemFilter, customerTypeFilter, dataTick]
  );

  // Independent of which report is open — the 4 top-row KPI tiles, computed once
  // per date-range/data change (see generateSummaryKPIs for why Pending Orders
  // ignores the date range).
  const kpis = useMemo(
    () => reportingStore.generateSummaryKPIs(startDate, endDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startDate, endDate, dataTick]
  );

  const handleExportReport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsGenerating(true);
    try {
      const extension = format === 'excel' ? 'xls' : format;
      const filename = `${selectedReport}_report_${startDate}.${extension}`;
      const generatedLabel = generatedAt ? `Generated on ${generatedAt} by ${currentUserLabel}` : undefined;
      const fileUrl = await reportingStore.exportReport(reportData, format, filename, generatedLabel);
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

  // One category tab's body: its own report picker (+ category filter, when the
  // selected report supports one) and Print button beside the heading, then the
  // printable Card — same shape as each of Front Office Reports & Analysis's own
  // tabs, but written once and reused instead of copy-pasted per category (Front
  // Office's own 4 tabs repeat this block verbatim; this pulls it out instead).
  const renderCategoryBody = (cat: ReportCategory) => {
    if (cat.reports.length === 0) {
      return (
        <Card>
          <CardBody className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">🔴</div>
            <h3 className="text-lg font-medium mb-2 text-ghana-black">Live Kitchen & Bar Monitor</h3>
            <p className="text-sm max-w-md mx-auto">
              Real-time pending KOT/BOT tracking (what's outstanding right now, with an
              elapsed-time indicator) lives in Kitchen Display — a live operational screen,
              not a history report. Open it from Quick Actions on the Restaurant & Bar overview.
            </p>
          </CardBody>
        </Card>
      );
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-semibold">{cat.label} Reports</h2>
          <div className="flex items-end gap-2 flex-wrap">
            <Select
              selectedKeys={[selectedReport]}
              onSelectionChange={(keys) => setSelectedReport(Array.from(keys)[0] as string)}
              className="w-72"
            >
              {cat.reports.map((key) => (
                <SelectItem key={key}>{REPORT_LABELS[key]}</SelectItem>
              )) as any}
            </Select>
            {selectedReport === 'daily-sales' && (
              <TransactionFilters
                dimensions={[
                  {
                    key: 'category', label: 'Category', selected: categoryFilter, setSelected: setCategoryFilter,
                    options: availableCategories.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
                  },
                  {
                    key: 'staff', label: 'Staff', selected: staffFilter, setSelected: setStaffFilter,
                    options: staffList.map((s) => ({ value: s.name, label: s.name })),
                  },
                  {
                    key: 'item', label: 'Item', selected: itemFilter, setSelected: setItemFilter,
                    options: availableItems.map((i) => ({ value: i, label: i })),
                  },
                  {
                    key: 'customerType', label: 'Customer Type', selected: customerTypeFilter, setSelected: setCustomerTypeFilter,
                    options: CUSTOMER_TYPES.map((c) => ({ value: c, label: c })),
                  },
                  {
                    key: 'paymentType', label: 'Payment Type', selected: [], setSelected: () => {}, options: [],
                    disabled: true, disabledReason: 'Not available — no payment method is captured for F&B sales yet',
                  },
                ]}
              />
            )}
            {selectedReport === 'product-mix' && (
              <TransactionFilters
                dimensions={[
                  {
                    key: 'category', label: 'Category', selected: categoryFilter, setSelected: setCategoryFilter,
                    options: availableCategories.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
                  },
                ]}
              />
            )}
            <Button color="primary" variant="flat" onClick={() => window.print()}>
              🖨️ Print
            </Button>
          </div>
        </div>

        <Card id="report-print-area">
          <CardHeader className="flex flex-col items-start gap-0">
            <div className="hidden print:block">
              <h2 className="text-xl font-bold">{orgProfile.name}</h2>
              {(orgProfile.address || orgProfile.phone || orgProfile.email) && (
                <p className="text-xs text-gray-500">
                  {[orgProfile.address, orgProfile.phone, orgProfile.email].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <h3 className="text-lg font-semibold mt-3">
              {REPORT_LABELS[selectedReport] || selectedReport}
            </h3>
            <p className="hidden print:block text-sm text-gray-600">
              Generated on {generatedAt ?? '…'} by {currentUserLabel}
            </p>
          </CardHeader>
          <CardBody>
            <ReportOutput mounted={mounted} data={reportData} ariaLabel={`${selectedReport} report table`} />
          </CardBody>
        </Card>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ghana-black mb-2">🍽️ F&B Reports & Analysis</h1>
        <p className="text-gray-600">Sales, product mix, staff performance and customer analytics for Restaurant & Bar</p>
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-0 shadow-sm">
          <CardBody className="text-center py-4">
            <div className="text-xl font-bold text-ghana-black">₵{kpis.totalRevenue.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Total Revenue</div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardBody className="text-center py-4">
            <div className="text-xl font-bold text-orange-600">₵{kpis.totalDiscounts.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Total Discounts</div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardBody className="text-center py-4">
            <div className="text-xl font-bold text-red-600">{kpis.totalVoids}</div>
            <div className="text-xs text-gray-500">Total Voids</div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardBody className="text-center py-4">
            <div className="text-xl font-bold text-blue-600">{kpis.pendingOrders}</div>
            <div className="text-xs text-gray-500">Pending Orders (now)</div>
          </CardBody>
        </Card>
      </div>

      {/* Date and Export selection — global across whichever category/report tab is
          active, same top-row position as Front Office Reports & Analysis. */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-end gap-2 flex-wrap">
          {!NO_DATE_REPORT_KEYS.has(selectedReport) && (
            <ReportDateControl
              mode={reportDateMode}
              setMode={setReportDateMode}
              startDate={startDate}
              endDate={endDate}
              setStartDate={setStartDate}
              setEndDate={setEndDate}
              rangeSupported={RANGE_REPORT_KEYS.has(selectedReport)}
            />
          )}
        </div>
        <div className="flex items-end gap-2">
          <Dropdown>
            <DropdownTrigger>
              <Button variant="bordered">📥 Export</Button>
            </DropdownTrigger>
            <DropdownMenu
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[exportFormat]}
              onSelectionChange={(keys) => setExportFormat(Array.from(keys)[0] as 'pdf' | 'excel' | 'csv')}
            >
              <DropdownItem key="pdf">PDF</DropdownItem>
              <DropdownItem key="excel">Excel</DropdownItem>
              <DropdownItem key="csv">CSV</DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Button
            color="primary"
            variant="flat"
            onClick={() => handleExportReport(exportFormat)}
            isLoading={isGenerating}
          >
            {isGenerating ? 'Exporting…' : '⬇️ Download'}
          </Button>
        </div>
      </div>

      {/* Category tabs — each renders its own report picker + Print button + Card,
          same as Front Office's department tabs. */}
      <Tabs
        selectedKey={selectedCategory}
        onSelectionChange={(key) => setSelectedCategory(key as string)}
        className="mb-6"
      >
        {REPORT_CATEGORIES.map((c) => (
          <Tab key={c.key} title={`${c.icon} ${c.label}`}>
            {renderCategoryBody(c)}
          </Tab>
        )) as any}
      </Tabs>
    </div>
  );
}
