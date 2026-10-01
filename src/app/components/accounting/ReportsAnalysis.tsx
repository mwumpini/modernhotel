'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, Button, Tabs, Tab, Select, SelectItem, Input,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Textarea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip,
} from '@heroui/react';
import {
  ArrowDownToLine, BarChart3, CalendarDays, FileSpreadsheet, FileText,
  Filter, Printer, RefreshCw, RotateCcw, Search, SlidersHorizontal, StickyNote, TrendingUp, X,
} from 'lucide-react';
import ReportPageInfoTip from '../dashboard/ReportPageInfoTip';
import { SortableReportTable } from '../reports/SortableReportTable';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { buildAccountingIntelligenceReport, type IntelColumn } from '@/app/lib/accounting/accountingIntelligenceReports';
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';
import { useSettingsStore } from '@/app/lib/settings/store';
import { buildOrgProfile } from '@/app/lib/print/buildOrgProfile';
import { reportDataToSections, sectionsToCSV, sectionsToExcelHtml, sectionsToPdfBlob } from '@/app/lib/frontoffice/reportExportFormat';

const REPORT_GROUPS = {
  performance: {
    title: 'Performance',
    description: 'Posted income, spend and department contribution.',
    reports: [
      ['revenue-department', 'Income by department'],
      ['revenue-account', 'Income by books account'],
      ['revenue-date', 'Income by date'],
      ['revenue-payment', 'Income by payment method'],
      ['revenue-outlet', 'Income by outlet'],
      ['revenue-trend', 'Income trend'],
      ['revenue-mix', 'Income mix'],
      ['expense-account', 'Spend by books account'],
      ['expense-department', 'Spend by department'],
      ['expense-vendor', 'Spend by supplier'],
      ['expense-trend', 'Spend trend'],
      ['expense-ratio', 'Spend as % of income'],
      ['top-expenses', 'Top 10 spends'],
      ['gop', 'Operating profit & margin'],
      ['departmental-profit', 'Department profit'],
      ['rooms-pl', 'Rooms profit'],
      ['restaurant-pl', 'Restaurant profit'],
      ['bar-pl', 'Bar profit'],
    ],
  },
  plan: {
    title: 'Plan vs result',
    description: 'Stored budgets and the same period last year.',
    reports: [
      ['budget-vs-actual', 'Budget vs actual'],
      ['budget-department', 'Department budget vs actual'],
      ['prior-year', 'Same period last year'],
      ['variance', 'Why it moved'],
      ['food-cost-variance', 'Food cost % of income'],
      ['labor-cost-variance', 'Labour cost % of income'],
    ],
  },
  'working-capital': {
    title: 'Cash & bills',
    description: 'Open bills, cash on the register, and bank lines.',
    reports: [
      ['ar-aging', 'Money owed by age'],
      ['ar-customer', 'Who still owes'],
      ['dso', 'Days sales outstanding'],
      ['ap-aging', 'Bills to pay by age'],
      ['ap-forecast', 'Upcoming payments'],
      ['dpo', 'Days to pay suppliers'],
      ['cash-position', 'Cash on hand'],
      ['cash-movement', 'Cash in and out'],
      ['bank-balances', 'Bank balances'],
      ['bank-recon-summary', 'Statement match summary'],
      ['unreconciled', 'Unmatched bank lines'],
      ['working-capital', 'Working capital'],
    ],
  },
  control: {
    title: 'Checks',
    description: 'Tax on the ledger, and whether each desk matches the books.',
    reports: [
      ['tax-collected', 'Tax collected'],
      ['tax-payable', 'Tax still owed'],
      ['vat', 'VAT analysis'],
      ['wht', 'Withholding tax'],
      ['tax-recon', 'Tax reconciliation'],
      ['ratios', 'Financial ratios'],
      ['pms-gl', 'Front office → books'],
      ['pos-gl', 'POS → books'],
      ['ar-gl', 'Receivables → books'],
      ['ap-gl', 'Payables → books'],
      ['bank-gl', 'Bank → books'],
      ['journal-register', 'Journal register'],
      ['adjustments', 'Adjustments'],
      ['reversals', 'Reversals / voids'],
      ['unposted', 'Not yet on the books'],
    ],
  },
} as const;

type ReportGroupKey = keyof typeof REPORT_GROUPS;

/** Current file. The period does not change these rows. */
const NO_DATE_REPORT_KEYS = new Set([
  'ar-customer',
  'ap-forecast',
  'bank-balances',
  'working-capital',
]);

const RANGE_REPORT_KEYS = new Set<string>(
  Object.values(REPORT_GROUPS).flatMap((group) => group.reports.map(([key]) => key)).filter((key) => !NO_DATE_REPORT_KEYS.has(key)),
);

const REPORT_DESCRIPTIONS: Record<string, string> = {
  'revenue-department': 'Posted revenue and direct cost by the department or cost centre on each journal line.',
  'revenue-account': 'Revenue accounts with a balance in the selected period.',
  'revenue-date': 'Posted revenue, spend and net by day.',
  'revenue-payment': 'Posted receipts by payment method. This is collections, not GL revenue.',
  'revenue-outlet': 'Revenue centres and the posted revenue mapped to each one.',
  'revenue-trend': 'Daily posted revenue against the prior days in the same range.',
  'revenue-mix': 'Each revenue account as a share of period revenue.',
  'expense-account': 'Expense accounts with a balance in the selected period.',
  'expense-department': 'Posted spend by the department or cost centre on each journal line.',
  'expense-vendor': 'Purchase bills in the period, grouped by supplier.',
  'expense-trend': 'Daily posted spend in the selected period.',
  'expense-ratio': 'Period spend as a share of period revenue.',
  'top-expenses': 'The ten expense accounts with the largest posted balance.',
  gop: 'Period revenue less period expenses, and the resulting margin.',
  'departmental-profit': 'Revenue less direct cost for every tagged department.',
  'rooms-pl': 'Contribution on journal lines tagged to rooms.',
  'restaurant-pl': 'Contribution on journal lines tagged to restaurant or food.',
  'bar-pl': 'Contribution on journal lines tagged to bar or beverage.',
  'budget-vs-actual': 'Each revenue and cost centre against the budget stored on that centre.',
  'budget-department': 'Those centre budgets rolled up by department.',
  'prior-year': 'Period revenue, spend and net against the same dates last year.',
  variance: 'Expense accounts and each one as a share of period revenue.',
  'food-cost-variance': 'Expense accounts whose name mentions food, as a share of revenue.',
  'labor-cost-variance': 'Expense accounts whose name mentions wages, salary or labour.',
  'ar-aging': 'Each open sales invoice, aged from its due date to the end of the selected period.',
  'ar-customer': 'One row per customer with an open balance: invoice count, oldest due date and the amount still open.',
  dso: 'Each customer still owing. Days overdue is counted from the due date. The DSO figure in the strip is open receivables against posted revenue for the selected dates.',
  'ap-aging': 'Each open purchase bill, aged from its due date to the end of the selected period.',
  'ap-forecast': 'Each open purchase bill, soonest due date first.',
  dpo: 'Each supplier still to be paid. Days overdue is counted from the due date. The DPO figure in the strip is open bills against posted expenses for the selected dates.',
  'cash-position': 'Opening, money in, money out and closing for each register in the selected period. Closing through today is the register balance. An earlier end date uses the last line on or before that day.',
  'cash-movement': 'Each bank register line in the selected period, split into money in and money out.',
  'bank-balances': 'Active registers, with the stored opening balance and the balance now.',
  'bank-recon-summary': 'Register lines through the period end, with how many are reconciled and the amount still open.',
  unreconciled: 'Register lines in the period that are not reconciled.',
  'working-capital': 'Each register, then open receivables and open payables, then cash plus receivables minus payables.',
  'tax-collected': 'Tax ledger rows for the months covered by the period.',
  'tax-payable': 'The same tax ledger, including what is still owed.',
  vat: 'VAT rows from that tax ledger.',
  wht: 'Withholding rows from that tax ledger.',
  'tax-recon': 'Collected, withheld, remitted and net payable from the tax ledger.',
  ratios: 'Period margin plus current assets and liabilities from the books through the period end.',
  'pms-gl': 'Open front-office sales invoices against the receivables accounts.',
  'pos-gl': 'Posted outlet receipts in the period against matching revenue accounts.',
  'ar-gl': 'Open sales invoices against the receivables accounts.',
  'ap-gl': 'Open purchase bills against the payables accounts.',
  'bank-gl': 'Bank register total against the bank GL accounts.',
  'journal-register': 'Journals posted in the selected period.',
  adjustments: 'Posted journals whose source or description says manual or adjustment.',
  reversals: 'Voided journals, and entries whose description says reversal or void.',
  unposted: 'Draft and pending-approval journals dated in the period.',
};

const FACET_SKIP = /amount|balance|revenue|expense|profit|budget|actual|variance|mix|pct|value|debit|collected|withheld|remitted|net|date|description|reference|number|due|note|lines|open|days|gl|\bin\b|\bout\b/i;

const MONEY_KEYS = new Set(['opening', 'in', 'out', 'closing', 'balance', 'total', 'paid', 'open', 'amount', 'openAmount', 'billed']);

function reportCell(value: unknown, key: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && MONEY_KEYS.has(key)) return formatAccountingCurrency(value);
  if (typeof value === 'number') return value.toLocaleString('en-GH', { maximumFractionDigits: 2 });
  return String(value);
}

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function buildFacets(columns: IntelColumn[], rows: Record<string, string | number>[]) {
  const facets: { key: string; label: string; options: string[] }[] = [];
  for (const column of columns) {
    if (FACET_SKIP.test(column.key)) continue;
    const values = [...new Set(rows.map((row) => String(row[column.key] || '').trim()).filter(Boolean))];
    if (values.length < 2 || values.length > 12) continue;
    if (values.some((value) => value.length > 48)) continue;
    facets.push({ key: column.key, label: column.label, options: values.sort((a, b) => a.localeCompare(b)) });
    if (facets.length >= 6) break;
  }
  return facets;
}

export default function ReportsAnalysis({ embedded = false }: { embedded?: boolean } = {}) {
  const today = localToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [selectedTab, setSelectedTab] = useState<ReportGroupKey>('performance');
  const [selectedReport, setSelectedReport] = useState('revenue-account');
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [reportDateMode, setReportDateMode] = useState<'today' | 'specific' | 'range'>('range');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [query, setQuery] = useState('');
  const [facetValues, setFacetValues] = useState<Record<string, string>>({});
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [hiddenKpisByReport, setHiddenKpisByReport] = useState<Record<string, string[]>>({});
  const [hiddenColumnsByReport, setHiddenColumnsByReport] = useState<Record<string, string[]>>({});
  const { isOpen, onOpen, onClose } = useDisclosure();

  const settings = useSettingsStore();
  const orgProfile = buildOrgProfile(settings);
  const currentUserLabel = settings.currentUser
    ? `${settings.currentUser.firstName} ${settings.currentUser.lastName}`.trim() || settings.currentUser.email
    : 'System';

  const initializeAccounting = useAccountingStore((s) => s.initializeAccounting);
  const journalEntries = useAccountingStore((s) => s.journalEntries);
  const chartOfAccounts = useAccountingStore((s) => s.chartOfAccounts);
  const invoices = useAccountingStore((s) => s.invoices);
  const payments = useAccountingStore((s) => s.payments);
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const bankTransactions = useAccountingStore((s) => s.bankTransactions);
  const businessPartners = useAccountingStore((s) => s.businessPartners);
  const costCenters = useAccountingStore((s) => s.costCenters);
  const revenueCenters = useAccountingStore((s) => s.revenueCenters);

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString());
    initializeAccounting().catch(() => {});
    try {
      const kpis = localStorage.getItem('accounting.report-summary-preferences');
      const columns = localStorage.getItem('accounting.report-column-preferences');
      if (kpis) setHiddenKpisByReport(JSON.parse(kpis));
      if (columns) setHiddenColumnsByReport(JSON.parse(columns));
    } catch { /* ignore */ }
  }, [initializeAccounting]);

  const reportLabel = useMemo(
    () => REPORT_GROUPS[selectedTab].reports.find(([key]) => key === selectedReport)?.[1] || 'Report',
    [selectedTab, selectedReport],
  );

  const snapshot = NO_DATE_REPORT_KEYS.has(selectedReport);
  const effectiveStart = snapshot ? today : startDate;
  const effectiveEnd = snapshot ? today : endDate;

  const report = useMemo(
    () => buildAccountingIntelligenceReport({
      reportKey: selectedReport,
      startDate: effectiveStart,
      endDate: effectiveEnd,
      journalEntries,
      chartOfAccounts,
      invoices,
      payments,
      bankAccounts,
      bankTransactions,
      businessPartners,
      costCenters,
      revenueCenters,
    }),
    [selectedReport, effectiveStart, effectiveEnd, journalEntries, chartOfAccounts, invoices, payments, bankAccounts, bankTransactions, businessPartners, costCenters, revenueCenters],
  );

  const rawRows = report.rows;
  const facetDefinitions = useMemo(() => buildFacets(report.columns, rawRows), [report.columns, rawRows]);
  const activeFacetCount = facetDefinitions.filter((facet) => facetValues[facet.key] && facetValues[facet.key] !== 'all').length;
  const activeFilterCount = activeFacetCount + (query.trim() ? 1 : 0);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rawRows.filter((row) => {
      if (needle && !Object.values(row).some((value) => String(value).toLowerCase().includes(needle))) return false;
      return facetDefinitions.every((facet) => {
        const selected = facetValues[facet.key];
        return !selected || selected === 'all' || String(row[facet.key] || '') === selected;
      });
    });
  }, [rawRows, query, facetValues, facetDefinitions]);

  const hiddenColumnKeys = hiddenColumnsByReport[selectedReport] || [];
  const visibleColumns = report.columns.filter((column) => !hiddenColumnKeys.includes(column.key));
  const hiddenKpiLabels = hiddenKpisByReport[selectedReport] || [];
  const visibleKpis = report.kpis.filter((kpi) => !hiddenKpiLabels.includes(kpi.label));

  const saveKpiPreferences = (hiddenLabels: string[]) => {
    const next = { ...hiddenKpisByReport, [selectedReport]: hiddenLabels };
    setHiddenKpisByReport(next);
    try { localStorage.setItem('accounting.report-summary-preferences', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const saveColumnPreferences = (hiddenKeys: string[]) => {
    const next = { ...hiddenColumnsByReport, [selectedReport]: hiddenKeys };
    setHiddenColumnsByReport(next);
    try { localStorage.setItem('accounting.report-column-preferences', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const clearFilters = () => {
    setQuery('');
    setFacetValues({});
    setFiltersExpanded(false);
  };

  const handleTabChange = (key: React.Key) => {
    const groupKey = key as ReportGroupKey;
    const nextReport = REPORT_GROUPS[groupKey].reports[0][0];
    setSelectedTab(groupKey);
    setSelectedReport(nextReport);
    clearFilters();
    if (reportDateMode === 'range' && NO_DATE_REPORT_KEYS.has(nextReport)) setReportDateMode('today');
  };

  const handleRefresh = () => {
    setGeneratedAt(new Date().toLocaleString());
    initializeAccounting().catch(() => {});
  };

  const exportRows = rows.map((row) => {
    const out: Record<string, string> = {};
    for (const column of (visibleColumns.length ? visibleColumns : report.columns)) out[column.label] = reportCell(row[column.key], column.key);
    return out;
  });

  const handleExportReport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsGenerating(true);
    try {
      const extension = format === 'excel' ? 'xls' : format;
      const filename = `accounting_${selectedReport}_${effectiveStart}.${extension}`;
      const generatedLabel = generatedAt ? `Generated on ${generatedAt} by ${currentUserLabel}` : undefined;
      const sections = reportDataToSections(exportRows);
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

  const showDateControls = !snapshot;
  const rangeAllowed = RANGE_REPORT_KEYS.has(selectedReport);

  return (
    <div className={embedded ? 'px-2 py-1' : 'min-h-screen bg-slate-50/70 p-4 md:p-6'}>
      <div className="mx-auto max-w-[1600px] space-y-2">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <BarChart3 size={16} />
              ACCOUNTING INTELLIGENCE
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Reports & Analysis</h1>
              <ReportPageInfoTip text="Posted journals, open bills, bank lines and tax on the ledger. Official statements stay under Statements." />
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
                <DropdownItem key="pdf" startContent={<FileText size={16} />} onPress={() => handleExportReport('pdf')}>Download PDF</DropdownItem>
                <DropdownItem key="excel" startContent={<FileSpreadsheet size={16} />} onPress={() => handleExportReport('excel')}>Download Excel</DropdownItem>
                <DropdownItem key="csv" startContent={<ArrowDownToLine size={16} />} onPress={() => handleExportReport('csv')}>Download CSV</DropdownItem>
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
                classNames={{ trigger: 'min-h-[48px] h-[48px] py-1', label: 'text-xs', value: 'text-sm' }}
                selectedKeys={[selectedReport]}
                onSelectionChange={(keys) => {
                  const next = Array.from(keys)[0] as string;
                  const allowed: string[] = REPORT_GROUPS[selectedTab].reports.map(([key]) => key);
                  if (next && allowed.includes(next)) {
                    setSelectedReport(next);
                    clearFilters();
                    if (reportDateMode === 'range' && NO_DATE_REPORT_KEYS.has(next)) setReportDateMode('today');
                  }
                }}
                startContent={<TrendingUp size={15} className="text-slate-400" />}
              >
                {REPORT_GROUPS[selectedTab].reports.map(([key, label]) => (
                  <SelectItem key={key} textValue={label}>{label}</SelectItem>
                ))}
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
                            const day = localToday();
                            setStartDate(day);
                            setEndDate(day);
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
                    {reportDateMode === 'range' && rangeAllowed && (
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
                    placeholder="Account, supplier, reference..."
                    value={query}
                    onValueChange={setQuery}
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
                      Filters{activeFacetCount ? ` (${activeFacetCount})` : ''}
                    </Button>
                  )}
                  {facetDefinitions.filter((facet) => facetValues[facet.key] && facetValues[facet.key] !== 'all').map((facet) => (
                    <Chip
                      key={facet.key}
                      size="sm"
                      variant="flat"
                      color="primary"
                      onClose={() => setFacetValues((current) => ({ ...current, [facet.key]: 'all' }))}
                    >
                      {facet.label}: {facetValues[facet.key]}
                    </Chip>
                  ))}
                  <span className="ml-auto text-xs text-slate-500">Showing {rows.length} of {rawRows.length}</span>
                  {activeFilterCount > 0 && (
                    <Button size="sm" variant="light" color="danger" startContent={<X size={14} />} onPress={clearFilters}>Clear</Button>
                  )}
                </div>
                {filtersExpanded && facetDefinitions.length > 0 && (
                  <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                    {facetDefinitions.map((facet) => (
                      <Select
                        key={facet.key}
                        aria-label={facet.label}
                        label={facet.label}
                        size="sm"
                        selectedKeys={[facetValues[facet.key] || 'all']}
                        onSelectionChange={(keys) => {
                          const value = (Array.from(keys)[0] as string) || 'all';
                          setFacetValues((current) => ({ ...current, [facet.key]: value }));
                          setFiltersExpanded(false);
                        }}
                      >
                        <SelectItem key="all">All {facet.label.toLocaleLowerCase()}s</SelectItem>
                        {facet.options.map((option) => <SelectItem key={option}>{option}</SelectItem>) as any}
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
                {(visibleKpis.length ? visibleKpis : [{ label: 'Rows', value: String(rows.length) }]).map((kpi) => (
                  <div key={kpi.label} className="flex items-baseline gap-1.5 px-3 first:pl-0 last:pr-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</span>
                    <span className="text-sm font-bold text-slate-950">{kpi.value}</span>
                  </div>
                ))}
              </div>
              {report.kpis.length > 0 && (
                <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-slate-200 pl-3">
                  {hiddenKpiLabels.length > 0 && (
                    <Button size="sm" variant="light" startContent={<RotateCcw size={14} />} onPress={() => saveKpiPreferences([])}>Restore metrics</Button>
                  )}
                  <Dropdown closeOnSelect={false}>
                    <DropdownTrigger>
                      <Button size="sm" variant="bordered" startContent={<SlidersHorizontal size={14} />}>Customize summary</Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="Choose summary metrics"
                      selectionMode="multiple"
                      selectedKeys={new Set(visibleKpis.map((kpi) => kpi.label))}
                      onSelectionChange={(keys) => {
                        const visibleLabels = keys === 'all' ? report.kpis.map((kpi) => kpi.label) : Array.from(keys).map(String);
                        saveKpiPreferences(report.kpis.filter((kpi) => !visibleLabels.includes(kpi.label)).map((kpi) => kpi.label));
                      }}
                    >
                      {report.kpis.map((kpi) => <DropdownItem key={kpi.label}>{kpi.label}</DropdownItem>) as any}
                    </DropdownMenu>
                  </Dropdown>
                </div>
              )}
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
                {snapshot ? 'Current snapshot' : effectiveStart === effectiveEnd ? effectiveStart : `${effectiveStart} – ${effectiveEnd}`}
                <span className="mx-1.5 text-slate-300">·</span>
                Generated {generatedAt ?? '…'} by {currentUserLabel}
              </div>
              {report.columns.length > 0 && (
                <Dropdown closeOnSelect={false}>
                  <DropdownTrigger>
                    <Button size="sm" variant="bordered" startContent={<SlidersHorizontal size={14} />}>Columns</Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Choose table columns"
                    selectionMode="multiple"
                    disallowEmptySelection
                    selectedKeys={new Set((visibleColumns.length ? visibleColumns : report.columns).map((column) => column.key))}
                    onSelectionChange={(keys) => {
                      const selected = keys === 'all' ? report.columns.map((column) => column.key) : Array.from(keys).map(String);
                      saveColumnPreferences(report.columns.filter((column) => !selected.includes(column.key)).map((column) => column.key));
                    }}
                  >
                    {report.columns.map((column) => <DropdownItem key={column.key}>{column.label}</DropdownItem>) as any}
                  </DropdownMenu>
                </Dropdown>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-3 sm:p-5">
            {rows.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-gray-500">
                  {activeFilterCount > 0
                    ? 'No records match the active filters. Clear or adjust the filters to continue.'
                    : report.emptyHint || 'No data available for the selected report and date.'}
                </p>
              </div>
            ) : (
              <SortableReportTable
                ariaLabel={reportLabel}
                columns={visibleColumns.length ? visibleColumns : report.columns}
                rows={rows as Record<string, unknown>[]}
                renderCell={(row, column) => reportCell(row[column.key], column.key)}
              />
            )}
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
