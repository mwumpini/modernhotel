'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import JournalRegister from './accounting/JournalRegister';
import AuditControls from './accounting/AuditControls';
import CostRevenueCenters from './accounting/CostRevenueCenters';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import ModuleExpandButton from './ModuleExpandButton';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';

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
    initializeAccounting,
  } = useAccountingStore();

  const fmt = (amount: number) => formatAccountingCurrency(amount);

  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.accounting', ACCOUNTING_DASHBOARD_SECTIONS);

  useEffect(() => {
    setTabsReady(true);
  }, []);

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

  // Same year-to-date profit and loss as Financial Reports: GL movement from 1 Jan
  // through today, not sales-invoice face values (those include tax and miss journals).
  const profitAndLoss = useMemo(() => {
    const today = new Date();
    const rollup = toRollupCoa(chartOfAccounts.length > 0 ? chartOfAccounts : GHANA_CHART_OF_ACCOUNTS);
    const tree = buildFinancialAccountTree(rollup, journalEntries, {
      kind: 'period',
      startDate: new Date(today.getFullYear(), 0, 1),
      endDate: today,
    });
    const sum = (type: string) => tree.filter((n) => n.type === type).reduce((s, n) => s + n.balance, 0);
    const revenue = Math.round(sum('Revenue') * 100) / 100;
    const expenses = Math.round(sum('Expense') * 100) / 100;
    return { revenue, expenses, net: Math.round((revenue - expenses) * 100) / 100 };
  }, [chartOfAccounts, journalEntries]);
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

  // Cash & Bank from bankAccounts store
  const totalBankCash = useMemo(
    () => bankAccounts.reduce((s, a) => s + (a.currentBalance || 0), 0),
    [bankAccounts]
  );

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

  // Today's operations from live data
  const todayStr = new Date().toISOString().slice(0, 10);
  const transactionsToday = useMemo(
    () => journalEntries.filter(je => (je.date || '').slice(0, 10) === todayStr).length,
    [journalEntries, todayStr]
  );
  const invoicesGeneratedToday = useMemo(
    () => invoices.filter(i => (i.createdAt || '').slice(0, 10) === todayStr).length,
    [invoices, todayStr]
  );
  const paymentsReceivedToday = useMemo(
    () => payments.filter(p => (p.createdAt || '').slice(0, 10) === todayStr).length,
    [payments, todayStr]
  );
  // Tabs hidden entirely when leanMode is on (see the `!leanMode && <Tab .../>` guards below).
  const LEAN_HIDDEN_TABS = new Set(['accounts', 'banking', 'assets', 'reports', 'audit', 'cost-centers']);
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
        goToTab('reports');
        break;
      case 'audit_check':
        goToTab('audit');
        break;
      default:
        break;
    }
  };

  return (
    <>
      {!fullPage && <DeptMessenger from="accounting" mode="drawer" />}
      <div className={fullPage ? 'p-6 pt-2' : 'p-6'}>
        <div>
          {!fullPage && (
          <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-ghana-black">🧾 Accounting & Finance</h2>
            <div className="flex items-center gap-2">
              <CustomizeViewControl
                sections={ACCOUNTING_DASHBOARD_SECTIONS}
                isHidden={isHidden}
                toggle={toggleSection}
                showAll={showAll}
                hiddenCount={hiddenCount}
              />
              <ModuleExpandButton
                href="/accounting/ops"
                label="Open accounting full page"
              />
            </div>
          </div>
          </>
          )}

          {/* Status Cards */}
          {!fullPage && (!isHidden('cashBank') || !isHidden('profitability') || !isHidden('operationalMetrics')) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Financial Position */}
            {!isHidden('cashBank') && (
            <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-ghana-black">Cash &amp; Bank Position</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <HideCardButton onHide={() => hide('cashBank')} label="Cash & Bank Position" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-blue-600 mb-3">{fmt(totalBankCash)}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Total Bank &amp; Cash</span>
                    <span className="font-medium">{fmt(totalBankCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Receivables Outstanding</span>
                    <span className="font-medium">{fmt(totalReceivables)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payables Outstanding</span>
                    <span className="font-medium">{fmt(totalPayables)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
            )}

            {/* Profitability */}
            {!isHidden('profitability') && (
            <Card className={`border-0 shadow-lg border-l-4 ${netIncome >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-lg font-semibold text-ghana-black">Profitability</h4>
                    <span className="text-xs text-gray-500">Year to date</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${netIncome >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <HideCardButton onHide={() => hide('profitability')} label="Profitability" />
                  </div>
                </div>
                <div className={`text-3xl font-bold mb-3 ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(netIncome)}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Revenue</span>
                    <span className="font-medium">{fmt(currentRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expenses</span>
                    <span className="font-medium">{fmt(currentExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net {netIncome >= 0 ? 'Profit' : 'Loss'} Margin</span>
                    <span className="font-medium">{profitMargin}%</span>
                  </div>
                </div>
              </CardBody>
            </Card>
            )}

            {/* Operational Metrics */}
            {!isHidden('operationalMetrics') && (
            <Card className="border-0 shadow-lg border-l-4 border-l-purple-500">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-ghana-black">Operational Metrics</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <HideCardButton onHide={() => hide('operationalMetrics')} label="Operational Metrics" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-purple-600 mb-3">{pendingInvoices}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Open Invoices</span>
                    <span className="font-medium">{pendingInvoices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overdue AR</span>
                    <span className="font-medium text-red-600">{overduePayments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active GL Accounts</span>
                    <span className="font-medium">{activeAccounts}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
            )}
          </div>
          )}

          {/* Today's Financial Operations */}
          {!fullPage && !isHidden('todayOps') && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <h4 className="text-lg font-semibold text-ghana-black">Today's Financial Operations</h4>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-medium">{transactionsToday} Transactions</span>
                  <span className="text-gray-500">Processed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-medium">{invoicesGeneratedToday} Invoices</span>
                  <span className="text-gray-500">Generated</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-600 font-medium">{paymentsReceivedToday} Payments</span>
                  <span className="text-gray-500">Received</span>
                </div>
              </div>
            </div>
            <HideCardButton onHide={() => hide('todayOps')} label="Today's Financial Operations" />
          </div>
          )}

          {/* Quick Actions */}
          {!fullPage && !isHidden('quickActions') && (
          <Card className="border-0 shadow-lg mb-6">
            <CardHeader className="pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚀</span>
                <h3 className="text-lg font-semibold text-ghana-black">Quick Actions</h3>
              </div>
              <HideCardButton onHide={() => hide('quickActions')} label="Quick Actions" />
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  color="warning"
                  variant="flat"
                  className="h-24 flex flex-col items-center justify-center gap-2 p-4"
                  onClick={() => handleQuickAction('generate_invoice')}
                >
                  <span className="text-2xl">📄</span>
                  <span className="font-medium">Generate Invoice</span>
                  <span className="text-xs text-center opacity-80">Create customer invoice</span>
                </Button>
                <Button
                  color="danger"
                  variant="flat"
                  className="h-24 flex flex-col items-center justify-center gap-2 p-4"
                  onClick={() => handleQuickAction('process_payment')}
                >
                  <span className="text-2xl">💳</span>
                  <span className="font-medium">Process Payment</span>
                  <span className="text-xs text-center opacity-80">Record payment receipt</span>
                </Button>
                <Button
                  color="primary"
                  variant="flat"
                  className="h-24 flex flex-col items-center justify-center gap-2 p-4"
                  onClick={() => handleQuickAction('run_reports')}
                >
                  <span className="text-2xl">📊</span>
                  <span className="font-medium">Run Reports</span>
                  <span className="text-xs text-center opacity-80">Generate financial reports</span>
                </Button>
              </div>
            </CardBody>
          </Card>
          )}

          {/* Main Operations Interface - Following Uniform Pattern */}
          <Card className="border-0 shadow-lg">
            {fullPage && (
              <CardHeader className="pb-3">
                <h3 className="text-xl font-semibold text-ghana-black">Accounting</h3>
              </CardHeader>
            )}
            <CardBody>
              {tabsReady ? (
              <Tabs 
                selectedKey={selectedTab} 
                onSelectionChange={(key) => setSelectedTab(key as string)}
                className="w-full"
                aria-label="Accounting operations"
              >
                <Tab key="receivables" title="📝 Accounts Receivable">
                  <div className="p-6">
                  <AccountsReceivable />
                  </div>
                </Tab>

                <Tab key="payables" title="🧾 Accounts Payable">
                  <AccountsPayable />
                </Tab>

                {!leanMode && (
                  <Tab key="banking" title="💰 Bank & Cash">
                    <BankCashReceivables />
                  </Tab>
                )}

                {!leanMode && (
                <Tab key="assets" title="🏗️ PPE & Assets">
                  <InventoryFixedAssets />
                </Tab>
                )}

                <Tab key="taxes" title="🧮 Taxes">
                  <div className="p-6">
                    <BooksTaxes />
                  </div>
                </Tab>

                <Tab key="journal" title="📒 Journal">
                  <JournalRegister />
                </Tab>

                {!leanMode && (
                <Tab key="reports" title="📈 Reports & Analysis">
                  <FinancialReports />
                </Tab>
                )}

                {!leanMode && (
                <Tab key="audit" title="🔍 Audit Controls">
                  <AuditControls />
                </Tab>
                )}

                {!leanMode && (
                <Tab key="accounts" title="📊 Chart of Accounts">
                  <ChartOfAccounts />
                </Tab>
                )}

                {!leanMode && (
                <Tab key="cost-centers" title="🏷️ Cost & Revenue Centers">
                  <CostRevenueCenters />
                </Tab>
                )}
              </Tabs>
              ) : (
                <div className="h-12" aria-hidden />
              )}

      {/* Recent Activities & Notices */}
      {!fullPage && (!isHidden('recentActivities') || !isHidden('notices')) && (
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          {!isHidden('recentActivities') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
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
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Accounting Notices</h3>
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
  );
}

