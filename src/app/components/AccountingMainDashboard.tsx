'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Tabs,
  Tab,
} from "@heroui/react";
import { trackEvent } from '../lib/analytics/trackEvent';
import { useAccountingStore } from '../lib/accounting/store';
import { useComplianceStore } from '../lib/compliance/store';
import {
  formatAccountingCurrency,
  isLeanAccountingUI,
} from '../lib/accounting/tenantAccountingConfig';
import { totalFinanceReceivables } from '../lib/accounting/arSubledger';
import { toRollupCoa } from '../lib/accounting/coaHierarchy';
import { buildFinancialAccountTree } from '../lib/accounting/financialReportRollup';
import { GHANA_CHART_OF_ACCOUNTS } from '../lib/accounting/models';

// Import specialized accounting components
import ChartOfAccounts from './accounting/ChartOfAccounts';
import BankCashReceivables from './accounting/BankCashReceivables';
import AccountsPayable from './accounting/AccountsPayable';
import BooksTaxes from './accounting/BooksTaxes';
import AccountsReceivable from './accounting/AccountsReceivable';
import InventoryFixedAssets from './accounting/InventoryFixedAssets';
import FinancialReports from './accounting/FinancialReports';
import ReportsAnalysis from './accounting/ReportsAnalysis';
import JournalRegister from './accounting/JournalRegister';
import AuditControls from './accounting/AuditControls';
import CostRevenueCenters from './accounting/CostRevenueCenters';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';
import { HideCardButton } from './dashboard/CustomizeViewControl';
import ModuleExpandButton from './ModuleExpandButton';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
import { useDashboardPeriod, isInPeriod } from '../lib/dashboard/useDashboardPeriod';
import { SummaryCollapsedProvider, useSummaryCollapsed } from '../lib/dashboard/useSummaryCollapsed';
import {
  AccountingDeskVisibilityProvider,
  AccountingDeskPeriodProvider,
  ALL_BOOKS_KPI_SECTIONS,
  BOOK_KPI_SECTIONS_BY_TAB,
  DeskKpiCustomize,
  deskBookTabsClassNames,
} from './accounting/DeskKpiStrip';

// Hideable summary cards. The cycle tabs (chart, bank, receivables, payables,
// assets, statements, taxes, audit) stay visible.
const ACCOUNTING_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'cashBank', label: 'Cash & Bank Position' },
  { id: 'profitability', label: 'Profitability' },
  { id: 'operationalMetrics', label: 'Operational Metrics' },
  { id: 'todayOps', label: "Today's Financial Operations" },
  { id: 'quickActions', label: 'Quick Actions' },
  { id: 'recentActivities', label: 'Recent Activities' },
  { id: 'notices', label: 'Accounting Notices' },
];

// Quick actions: one tidy row on phones and short screens, roomy tiles otherwise.
const QUICK_ACTION_BTN =
  'h-auto min-h-9 flex flex-row items-center justify-center gap-1.5 whitespace-normal px-2.5 py-1.5 ' +
  'md:min-h-[4.25rem] md:flex-col md:gap-1 md:py-2 short:min-h-9 short:flex-row short:py-1';

// Main desk strip stays pinned while the book below scrolls, so desks can be
// switched without scrolling back up on a short screen.
const DESK_TABS_STICKY = {
  ...deskBookTabsClassNames,
  base: 'sticky top-0 z-30 w-full rounded-t-large bg-content1 p-1',
};

/** Long desk name on wide screens, short one on narrow. */
function DeskTitle({ icon, short, long }: { icon?: string; short: string; long: string }) {
  return (
    <span>
      {icon ? `${icon} ` : ''}
      <span className="lg:hidden">{short}</span>
      <span className="hidden lg:inline">{long}</span>
    </span>
  );
}

const ALL_ACCOUNTING_SECTIONS: DashboardSectionDef[] = [
  ...ACCOUNTING_DASHBOARD_SECTIONS,
  ...ALL_BOOKS_KPI_SECTIONS,
];

export default function AccountingMainDashboard({
  fullPage = false,
}: {
  fullPage?: boolean;
} = {}) {
  const leanMode = isLeanAccountingUI();
  const [selectedTab, setSelectedTab] = useState('receivables');
  const [tabsReady, setTabsReady] = useState(false);

  const {
    invoices,
    payments,
    journalEntries,
    chartOfAccounts,
    bankAccounts,
    bankTransactions,
    initializeAccounting,
  } = useAccountingStore();

  const fmt = (amount: number) => formatAccountingCurrency(amount);

  const { isHidden, hide, show, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility(
    'dashboard.hidden.accounting',
    ALL_ACCOUNTING_SECTIONS,
  );
  const deskPeriod = useDashboardPeriod('dashboard.period.accounting', 'month');

  const deskVisibility = useMemo(
    () => ({ isHidden, hide, show, toggle: toggleSection, showAll, hiddenCount }),
    [isHidden, hide, show, toggleSection, showAll, hiddenCount],
  );
  const deskPeriodApi = useMemo(
    () => ({
      period: deskPeriod.period,
      setPeriod: deskPeriod.setPeriod,
      defaultPeriod: deskPeriod.defaultPeriod,
      todayISO: deskPeriod.todayISO,
      label: deskPeriod.label,
      isDefault: deskPeriod.isDefault,
      bounds: deskPeriod.bounds,
    }),
    [deskPeriod.period, deskPeriod.setPeriod, deskPeriod.defaultPeriod, deskPeriod.todayISO, deskPeriod.label, deskPeriod.isDefault, deskPeriod.bounds],
  );

  const customizeSections = BOOK_KPI_SECTIONS_BY_TAB[selectedTab] ?? ACCOUNTING_DASHBOARD_SECTIONS;

  useEffect(() => {
    setTabsReady(true);
  }, []);

  const { collapsed: headerCollapsed, toggle: toggleHeader } = useSummaryCollapsed('accounting.headerCollapsed');
  const showSummary = !fullPage && !headerCollapsed;

  useEffect(() => {
    initializeAccounting().catch(() => {});
    void useComplianceStore.getState().syncCountryFromSetup();
  }, [initializeAccounting]);

  useEffect(() => {
    try {
      const wanted = localStorage.getItem('accounting.tab');
      if (wanted) {
        setSelectedTab(wanted);
        localStorage.removeItem('accounting.tab');
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onNavigate = () => {
      try {
        const wanted = localStorage.getItem('accounting.tab');
        if (wanted) {
          setSelectedTab(wanted);
          localStorage.removeItem('accounting.tab');
        }
      } catch {}
    };
    window.addEventListener('accounting-navigate', onNavigate);
    return () => window.removeEventListener('accounting-navigate', onNavigate);
  }, []);

  // ── Real computed KPIs ────────────────────────────────────────────────────
  const salesInvoices = useMemo(() => invoices.filter(i => i.type === 'Sales'), [invoices]);
  const purchaseInvoices = useMemo(() => invoices.filter(i => i.type === 'Purchase'), [invoices]);

  // P&L from Customize KPI period (GL movement), not sales-invoice face values.
  const profitAndLoss = useMemo(() => {
    const rollup = toRollupCoa(chartOfAccounts.length > 0 ? chartOfAccounts : GHANA_CHART_OF_ACCOUNTS);
    const end = new Date(`${deskPeriod.todayISO}T12:00:00`);
    const startISO = deskPeriod.bounds?.start ?? '1970-01-01';
    const start = new Date(`${startISO}T12:00:00`);
    const tree = buildFinancialAccountTree(rollup, journalEntries, {
      kind: 'period',
      startDate: start,
      endDate: end,
    });
    const sum = (type: string) => tree.filter((n) => n.type === type).reduce((s, n) => s + n.balance, 0);
    const revenue = Math.round(sum('Revenue') * 100) / 100;
    const expenses = Math.round(sum('Expense') * 100) / 100;
    return { revenue, expenses, net: Math.round((revenue - expenses) * 100) / 100 };
  }, [chartOfAccounts, journalEntries, deskPeriod.bounds, deskPeriod.todayISO]);
  const currentRevenue = profitAndLoss.revenue;
  const currentExpenses = profitAndLoss.expenses;

  // Receivables = outstanding on finance AR subledger (excludes proformas / open folios)
  const totalReceivables = useMemo(
    () => totalFinanceReceivables(invoices),
    [invoices]
  );

  // Payables = outstanding balance on Purchase invoices (excludes Void/Draft, matching the AR
  // subledger's totalFinanceReceivables convention above)
  const totalPayables = useMemo(
    () => purchaseInvoices
      .filter(i => i.status !== 'Void' && i.status !== 'Draft')
      .reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paidAmount || 0)), 0),
    [purchaseInvoices]
  );

  const netIncome = profitAndLoss.net;

  // Profit margin
  const profitMargin = currentRevenue > 0 ? ((netIncome / currentRevenue) * 100).toFixed(1) : '0.0';

  // Cash & Bank from bankAccounts store (current balances — not period-scoped)
  const totalBankCash = useMemo(
    () => bankAccounts.reduce((s, a) => s + (a.currentBalance || 0), 0),
    [bankAccounts]
  );
  // Period-scoped bank movement so the Cash & Bank card visibly follows Customize period
  const bankNetInPeriod = useMemo(() => {
    const inPeriod = bankTransactions.filter((t) =>
      isInPeriod(t.transactionDate || t.createdAt, deskPeriod.period, deskPeriod.todayISO),
    );
    const inflow = inPeriod
      .filter((t) => t.type === 'Deposit' || t.type === 'Interest')
      .reduce((s, t) => s + (t.amount ?? 0), 0);
    const outflow = inPeriod
      .filter((t) => t.type === 'Withdrawal' || t.type === 'Charge')
      .reduce((s, t) => s + (t.amount ?? 0), 0);
    return inflow - outflow;
  }, [bankTransactions, deskPeriod.period, deskPeriod.todayISO]);

  // Operational metrics from live data
  const pendingInvoices = useMemo(
    () => invoices.filter(i => i.status === 'Draft' || i.status === 'Posted').length,
    [invoices]
  );
  const overduePayments = useMemo(() => {
    const now = new Date();
    return salesInvoices.filter(i => {
      const balance = (i.total || 0) - (i.paidAmount || 0);
      return balance > 0 && i.dueDate && new Date(i.dueDate) < now;
    }).length;
  }, [salesInvoices]);
  const activeAccounts = useMemo(
    () => chartOfAccounts.filter(a => a.isActive !== false).length,
    [chartOfAccounts]
  );

  // Period-scoped ops (Customize → KPI period)
  const transactionsInPeriod = useMemo(
    () => journalEntries.filter((je) => isInPeriod(je.date, deskPeriod.period, deskPeriod.todayISO)).length,
    [journalEntries, deskPeriod.period, deskPeriod.todayISO],
  );
  const invoicesInPeriod = useMemo(
    () => invoices.filter((i) => isInPeriod(i.createdAt || i.date, deskPeriod.period, deskPeriod.todayISO)).length,
    [invoices, deskPeriod.period, deskPeriod.todayISO],
  );
  const paymentsInPeriod = useMemo(
    () => payments.filter((p) => isInPeriod(p.createdAt || p.date, deskPeriod.period, deskPeriod.todayISO)).length,
    [payments, deskPeriod.period, deskPeriod.todayISO],
  );
  // Tabs hidden entirely when leanMode is on (see the `!leanMode && <Tab .../>` guards below).
  const LEAN_HIDDEN_TABS = new Set(['accounts', 'banking', 'assets', 'statements', 'reports', 'audit', 'cost-centers']);
  const goToTab = (key: string) => setSelectedTab(leanMode && LEAN_HIDDEN_TABS.has(key) ? 'receivables' : key);

  const handleQuickAction = (action: string) => {
    trackEvent('accounting.quick_action', { action });
    switch (action) {
      case 'generate_invoice':
        goToTab('receivables');
        break;
      case 'process_payment':
        // Receiving cash from a customer is an AR receipt.
        goToTab('receivables');
        break;
      case 'run_reports':
        goToTab('statements');
        break;
      case 'audit_check':
        goToTab('audit');
        break;
      default:
        break;
    }
  };

  return (
    <AccountingDeskVisibilityProvider value={deskVisibility}>
    <AccountingDeskPeriodProvider value={deskPeriodApi}>
    <SummaryCollapsedProvider collapsed={headerCollapsed}>
    <>
      {!fullPage && <DeptMessenger from="accounting" mode="drawer" />}
      <div className={`acct-desk ${headerCollapsed ? 'acct-summary-off' : ''} ${fullPage ? 'px-3 pt-1 pb-3' : 'p-3 md:p-6 short:p-2'}`}>
        <div>
          <div className={`flex flex-wrap items-center justify-between gap-2 ${fullPage ? 'mb-2' : 'mb-3 md:mb-6 short:mb-2'}`}>
            <h2 className={`${fullPage ? 'text-xl' : 'text-xl md:text-2xl short:text-lg'} font-bold text-ghana-black`}>
              {fullPage ? '🧾 Accounting' : '🧾 Accounting & Finance'}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="flat"
                onPress={toggleHeader}
                aria-expanded={!headerCollapsed}
                aria-label={headerCollapsed ? 'Show summary' : 'Hide summary'}
                className="h-10 md:h-8"
                startContent={headerCollapsed ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronUp className="h-3.5 w-3.5" aria-hidden />}
              >
                {headerCollapsed ? 'Show' : 'Hide'}<span className="hidden sm:inline">&nbsp;summary</span>
              </Button>
              <DeskKpiCustomize sections={customizeSections} className="h-10 md:h-8" />
              {!fullPage && (
                <ModuleExpandButton
                  href={selectedTab === 'reports' ? '/accounting/reports' : '/accounting/ops'}
                  label={selectedTab === 'reports' ? 'Open reports full page' : 'Open accounting full page'}
                />
              )}
            </div>
          </div>

          {/* Status Cards */}
          {showSummary && (!isHidden('cashBank') || !isHidden('profitability') || !isHidden('operationalMetrics')) && (
          <div className="mb-3 flex snap-x gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 md:mb-4 md:gap-6 short:mb-2 short:gap-2">
            {/* Financial Position */}
            {!isHidden('cashBank') && (
            <Card className="min-w-[15rem] shrink-0 snap-start border-0 shadow-lg border-l-4 border-l-blue-500 sm:min-w-0">
              <CardBody className="p-3 md:p-4 short:p-2">
                <div className="mb-2 flex items-center justify-between gap-2 md:mb-3 short:mb-1">
                  <h4 className="text-base font-semibold text-ghana-black lg:text-lg short:text-sm">Cash &amp; Bank Position</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <HideCardButton onHide={() => hide('cashBank')} label="Cash & Bank Position" />
                  </div>
                </div>
                <div className="mb-3 whitespace-nowrap text-xl font-bold tabular-nums text-blue-600 lg:text-2xl xl:text-3xl short:mb-0 short:text-lg">{fmt(totalBankCash)}</div>
                <div className="space-y-1 text-sm text-gray-600 short:hidden">
                  <div className="flex justify-between">
                    <span>Receivables Outstanding</span>
                    <span className="whitespace-nowrap font-medium tabular-nums">{fmt(totalReceivables)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payables Outstanding</span>
                    <span className="whitespace-nowrap font-medium tabular-nums">{fmt(totalPayables)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net movement ({deskPeriod.label})</span>
                    <span className={`whitespace-nowrap font-medium tabular-nums ${bankNetInPeriod >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {fmt(bankNetInPeriod)}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
            )}

            {/* Profitability */}
            {!isHidden('profitability') && (
            <Card className={`min-w-[15rem] shrink-0 snap-start sm:min-w-0 border-0 shadow-lg border-l-4 ${netIncome >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <CardBody className="p-3 md:p-4 short:p-2">
                <div className="mb-2 flex items-center justify-between gap-2 md:mb-3 short:mb-1">
                  <h4 className="text-base font-semibold text-ghana-black lg:text-lg short:text-sm">Profitability</h4>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${netIncome >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <HideCardButton onHide={() => hide('profitability')} label="Profitability" />
                  </div>
                </div>
                <div className={`mb-3 whitespace-nowrap text-xl font-bold tabular-nums lg:text-2xl xl:text-3xl short:mb-0 short:text-lg ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(netIncome)}</div>
                <div className="space-y-1 text-sm text-gray-600 short:hidden">
                  <div className="flex justify-between">
                    <span>Revenue</span>
                    <span className="whitespace-nowrap font-medium tabular-nums">{fmt(currentRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expenses</span>
                    <span className="whitespace-nowrap font-medium tabular-nums">{fmt(currentExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net {netIncome >= 0 ? 'Profit' : 'Loss'} Margin</span>
                    <span className="whitespace-nowrap font-medium tabular-nums">{profitMargin}%</span>
                  </div>
                </div>
              </CardBody>
            </Card>
            )}

            {/* Operational Metrics */}
            {!isHidden('operationalMetrics') && (
            <Card className="min-w-[15rem] shrink-0 snap-start border-0 shadow-lg border-l-4 border-l-purple-500 sm:min-w-0">
              <CardBody className="p-3 md:p-4 short:p-2">
                <div className="mb-2 flex items-center justify-between gap-2 md:mb-3 short:mb-1">
                  <h4 className="text-base font-semibold text-ghana-black lg:text-lg short:text-sm">Operational Metrics</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <HideCardButton onHide={() => hide('operationalMetrics')} label="Operational Metrics" />
                  </div>
                </div>
                <div className="mb-3 whitespace-nowrap text-xl font-bold tabular-nums text-purple-600 lg:text-2xl xl:text-3xl short:mb-0 short:text-lg">{pendingInvoices}</div>
                <div className="space-y-1 text-sm text-gray-600 short:hidden">
                  <div className="flex justify-between">
                    <span>Open Invoices</span>
                    <span className="whitespace-nowrap font-medium tabular-nums">{pendingInvoices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overdue AR</span>
                    <span className="whitespace-nowrap font-medium tabular-nums text-red-600">{overduePayments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active GL Accounts</span>
                    <span className="whitespace-nowrap font-medium tabular-nums">{activeAccounts}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
            )}
          </div>
          )}

          {/* Period financial operations */}
          {showSummary && !isHidden('todayOps') && (
          <div className="mb-2 flex items-start justify-between gap-2 short:mb-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-base short:text-sm">💰</span>
                <h4 className="text-sm font-semibold text-ghana-black lg:text-base short:text-sm">
                  Financial Operations · {deskPeriod.label}
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-blue-600 font-medium">{transactionsInPeriod} Transactions</span>
                  <span className="text-gray-500">Processed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-green-600 font-medium">{invoicesInPeriod} Invoices</span>
                  <span className="text-gray-500">Generated</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-purple-600 font-medium">{paymentsInPeriod} Payments</span>
                  <span className="text-gray-500">Received</span>
                </div>
              </div>
            </div>
            <HideCardButton onHide={() => hide('todayOps')} label="Today's Financial Operations" />
          </div>
          )}

          {/* Quick Actions */}
          {showSummary && !isHidden('quickActions') && (
          <Card className="mb-3 border-0 shadow-lg md:mb-4 short:mb-2">
            <CardHeader className="flex items-center justify-between px-3 py-1.5 md:py-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base short:text-sm">🚀</span>
                <h3 className="text-sm font-semibold text-ghana-black lg:text-base short:text-sm">Quick Actions</h3>
              </div>
              <HideCardButton onHide={() => hide('quickActions')} label="Quick Actions" />
            </CardHeader>
            <CardBody className="px-3 py-2 short:py-1">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 md:gap-2">
                <Button
                  color="warning"
                  variant="flat"
                  className={QUICK_ACTION_BTN}
                  onClick={() => handleQuickAction('generate_invoice')}
                >
                  <span className="text-lg md:text-xl short:text-base">📄</span>
                  <span className="font-medium leading-tight text-sm">Generate Invoice</span>
                  <span className="hidden text-center text-xs opacity-80 md:block short:hidden">Create customer invoice</span>
                </Button>
                <Button
                  color="danger"
                  variant="flat"
                  className={QUICK_ACTION_BTN}
                  onClick={() => handleQuickAction('process_payment')}
                >
                  <span className="text-lg md:text-xl short:text-base">💳</span>
                  <span className="font-medium leading-tight text-sm">Process Payment</span>
                  <span className="hidden text-center text-xs opacity-80 md:block short:hidden">Record payment receipt</span>
                </Button>
                <Button
                  color="primary"
                  variant="flat"
                  className={QUICK_ACTION_BTN}
                  onClick={() => handleQuickAction('run_reports')}
                >
                  <span className="text-lg md:text-xl short:text-base">📑</span>
                  <span className="font-medium leading-tight text-sm">Statements</span>
                  <span className="hidden text-center text-xs opacity-80 md:block short:hidden">P&L, balance sheet, cash flow</span>
                </Button>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Main Operations Interface - Following Uniform Pattern */}
          <Card className="overflow-visible border-0 shadow-lg">
            <CardBody className="overflow-visible p-0">
              {tabsReady ? (
              <Tabs 
                selectedKey={selectedTab} 
                onSelectionChange={(key) => setSelectedTab(key as string)}
                className="w-full"
                size="sm"
                variant="solid"
                classNames={DESK_TABS_STICKY}
                aria-label="Accounting operations"
              >
                <Tab key="receivables" title={<DeskTitle icon="📝" short="Receivable" long="Accounts Receivable" />}>
                  <AccountsReceivable />
                </Tab>

                <Tab key="payables" title={<DeskTitle icon="🧾" short="Payable" long="Accounts Payable" />}>
                  <AccountsPayable />
                </Tab>

                {!leanMode && (
                  <Tab key="banking" title={<DeskTitle icon="💰" short="Bank" long="Bank & Cash" />}>
                    <BankCashReceivables />
                  </Tab>
                )}

                {!leanMode && (
                <Tab key="assets" title={<DeskTitle short="Assets" long="PPE & Assets" />}>
                  <InventoryFixedAssets />
                </Tab>
                )}

                <Tab key="taxes" title={<DeskTitle icon="🧮" short="Tax" long="Taxes" />}>
                  <BooksTaxes />
                </Tab>

                <Tab key="journal" title="Journal">
                  <JournalRegister />
                </Tab>

                {!leanMode && (
                <Tab key="statements" title="Statements">
                  <FinancialReports />
                </Tab>
                )}

                {!leanMode && (
                <Tab key="reports" title="📈 Reports & Analysis">
                  <ReportsAnalysis embedded />
                </Tab>
                )}

                {!leanMode && (
                <Tab key="audit" title={<DeskTitle short="Log" long="Activity log" />}>
                  <AuditControls />
                </Tab>
                )}

                {!leanMode && (
                <Tab key="accounts" title="Books">
                  <ChartOfAccounts />
                </Tab>
                )}

                {!leanMode && (
                <Tab key="cost-centers" title={<DeskTitle short="Cost/Income" long="Cost & Income" />}>
                  <CostRevenueCenters />
                </Tab>
                )}
              </Tabs>
              ) : (
                <div className="h-12" aria-hidden />
              )}

      {/* Recent Activities & Notices */}
      {!fullPage && (!isHidden('recentActivities') || !isHidden('notices')) && (
      <div className="mt-6 md:mt-8">
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
          {/* Recent Activities */}
          {!isHidden('recentActivities') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ghana-black md:text-xl">📋 Recent Activities</h3>
              <HideCardButton onHide={() => hide('recentActivities')} label="Recent Activities" />
            </CardHeader>
            <CardBody>
              <RecentActivities area="accounting" />
            </CardBody>
          </Card>
          )}

          {/* Accounting Notices */}
          {!isHidden('notices') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ghana-black md:text-xl">🔔 Accounting Notices</h3>
              <HideCardButton onHide={() => hide('notices')} label="Accounting Notices" />
            </CardHeader>
            <CardBody>
              <DeptNotices dept="accounting" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
          )}
        </div>
      </div>
      )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
    </SummaryCollapsedProvider>
    </AccountingDeskPeriodProvider>
    </AccountingDeskVisibilityProvider>
  );
}

