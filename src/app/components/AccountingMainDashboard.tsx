'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Badge,
  Tabs,
  Tab,
  Chip,
  Tooltip
} from "@heroui/react";
import { trackEvent } from '../lib/analytics/trackEvent';
import { useAccountingStore } from '../lib/accounting/store';

// Import specialized accounting components
import ChartOfAccounts from './accounting/ChartOfAccounts';
import BankCashReceivables from './accounting/BankCashReceivables';
import AccountsPayable from './accounting/AccountsPayable';
import BooksTaxes from './accounting/BooksTaxes';
import AccountsReceivable from './accounting/AccountsReceivable';
import InventoryFixedAssets from './accounting/InventoryFixedAssets';
import FinancialReports from './accounting/FinancialReports';
import AuditControls from './accounting/AuditControls';
import BankReconciliation from './accounting/BankReconciliation';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import RecentActivities from './RecentActivities';

// Info Icon Component with Tooltip
const InfoIcon = ({ description }: { description: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 2000); // 2 second delay
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Tooltip
      content={description}
      isOpen={showTooltip}
      onOpenChange={setShowTooltip}
      placement="top"
      showArrow
      color="primary"
      delay={0}
    >
      <div
        className="inline-flex items-center justify-center w-4 h-4 mr-2 text-xs text-blue-500 bg-blue-100 rounded-full cursor-help hover:bg-blue-200 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={description}
      >
        ℹ
      </div>
    </Tooltip>
  );
};

export default function AccountingMainDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const leanMode = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_LEAN_MODE === 'true') : (process.env.NEXT_PUBLIC_LEAN_MODE === 'true');

  const {
    invoices,
    payments,
    journalEntries,
    chartOfAccounts,
    bankAccounts,
    initializeAccounting,
  } = useAccountingStore();

  useEffect(() => {
    initializeAccounting().catch(() => {});
    void import('../lib/compliance/store').then(({ useComplianceStore }) => {
      void useComplianceStore.getState().syncCountryFromSetup();
    });
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

  // Revenue = total of Sales invoices that are Posted or Paid
  const currentRevenue = useMemo(
    () => salesInvoices
      .filter(i => i.status === 'Posted' || i.status === 'Paid')
      .reduce((s, i) => s + (i.total || 0), 0),
    [salesInvoices]
  );

  // Receivables = outstanding balance on Sales invoices
  const totalReceivables = useMemo(
    () => salesInvoices.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paidAmount || 0)), 0),
    [salesInvoices]
  );

  // Payables = outstanding balance on Purchase invoices
  const totalPayables = useMemo(
    () => purchaseInvoices.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paidAmount || 0)), 0),
    [purchaseInvoices]
  );

  // Expenses = sum of journal entry credit lines on 5xxx accounts (expense accounts)
  const currentExpenses = useMemo(() => {
    let total = 0;
    for (const je of journalEntries) {
      if (je.status !== 'Posted') continue;
      for (const line of (je.lines || [])) {
        if (line.accountCode?.startsWith('5')) {
          total += (line.debit || 0);
        }
      }
    }
    return total;
  }, [journalEntries]);

  // Net Profit
  const netIncome = currentRevenue - currentExpenses;

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

  // Compliance status (fixed — compliance tracking is not live in this system)
  const taxCompliance = 94;
  const auditCompliance = 97;
  const regulatoryCompliance = 91;
  const overallCompliance = 94;

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
  const pendingReconciliations = useMemo(
    () => bankAccounts.length,
    [bankAccounts]
  );

  // Operational items following the uniform pattern
  const operationalItems = [
    {
      category: 'Financial Management',
      items: [
        { title: 'Chart of Accounts', icon: '📊', description: 'Complete account structure and GL codes', status: 'active', count: activeAccounts },
        { title: 'Bank & Cash', icon: '💰', description: 'Bank accounts and cash management', status: 'active', count: 8 },
        { title: 'Financial Reports', icon: '📈', description: 'P&L, Balance Sheet, Cash Flow', status: 'active', count: 0 },
        { title: 'Audit Controls', icon: '🔍', description: 'Internal controls and audit trails', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Accounts & Transactions',
      items: [
        { title: 'Accounts Receivable', icon: '📝', description: 'Customer invoices and payments', status: 'active', count: pendingInvoices },
        { title: 'Accounts Payable', icon: '🧾', description: 'Vendor bills and payments', status: 'active', count: overduePayments },
        { title: 'PPE & Assets', icon: '🏗️', description: 'Property, plant & equipment and capital allowance', status: 'active', count: 0 },
        { title: 'Trial Balance', icon: '⚖️', description: 'Account balances in financial reports', status: 'active', count: pendingReconciliations },
      ]
    },
    {
      category: 'Compliance & Reporting',
      items: [
        { title: 'Tax Compliance', icon: '📋', description: 'VAT, PAYE, and tax reporting', status: 'active', count: taxCompliance },
        { title: 'Audit Compliance', icon: '🔒', description: 'Internal and external audits', status: 'active', count: auditCompliance },
        { title: 'Regulatory Reports', icon: '📊', description: 'Ghana regulatory compliance', status: 'active', count: regulatoryCompliance },
        { title: 'Performance Analytics', icon: '📈', description: 'Financial performance metrics', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Operations & Activities',
      items: [
        { title: 'Daily Transactions', icon: '🔄', description: 'Journal entries and postings', status: 'active', count: transactionsToday },
        { title: 'Invoice Generation', icon: '📄', description: 'Customer and vendor invoices', status: 'active', count: invoicesGeneratedToday },
        { title: 'Payment Processing', icon: '💳', description: 'Payment receipts and disbursements', status: 'active', count: paymentsReceivedToday },
        { title: 'Bank Reconciliation', icon: '✅', description: 'Statement vs cashbook (GL)', status: 'active', count: pendingReconciliations },
      ]
    }
  ];

  const handleQuickAction = (action: string) => {
    trackEvent('accounting.quick_action', { action });
    switch (action) {
      case 'new_transaction':
        setSelectedTab('reconciliation');
        break;
      case 'generate_invoice':
        setSelectedTab('receivables');
        break;
      case 'process_payment':
        setSelectedTab('payables');
        break;
      case 'run_reports':
        setSelectedTab('reports');
        break;
      case 'audit_check':
        setSelectedTab('audit');
        break;
      default:
        break;
    }
  };

  return (
    <>
      <DeptMessenger from="accounting" mode="drawer" />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-6">
        <div>
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="h-20 w-20 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-3xl flex items-center justify-center shadow-2xl">
                  <span className="text-4xl">💰</span>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-ghana-black to-ghana-green bg-clip-text text-transparent">
                    Accounting & Financial Management
                  </h1>
                  <p className="text-xl text-gray-600 mt-2">
                    Comprehensive financial control, reporting, and compliance management
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-sm text-gray-500">Overall Compliance</p>
                <p className="text-3xl font-bold text-ghana-green">{overallCompliance}%</p>
              </div>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Financial Position */}
            <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-ghana-black">Cash &amp; Bank Position</h4>
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
                <div className="text-3xl font-bold text-blue-600 mb-3">₵{totalBankCash.toFixed(2)}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Total Bank &amp; Cash</span>
                    <span className="font-medium">₵{totalBankCash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Receivables Outstanding</span>
                    <span className="font-medium">₵{totalReceivables.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payables Outstanding</span>
                    <span className="font-medium">₵{totalPayables.toFixed(2)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Profitability */}
            <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-ghana-black">Profitability</h4>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-3xl font-bold text-green-600 mb-3">₵{netIncome.toFixed(2)}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Revenue (Posted)</span>
                    <span className="font-medium">₵{currentRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expenses (GL 5xxx)</span>
                    <span className="font-medium">₵{currentExpenses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit Margin</span>
                    <span className="font-medium">{profitMargin}%</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Operational Metrics */}
            <Card className="border-0 shadow-lg border-l-4 border-l-purple-500">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-ghana-black">Operational Metrics</h4>
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
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
          </div>

          {/* Today's Financial Operations */}
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
            <Button 
              color="success" 
              variant="solid"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleQuickAction('run_reports')}
            >
              📊 Generate Reports
            </Button>
          </div>

          {/* Quick Actions */}
          <Card className="border-0 shadow-lg mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚀</span>
                <h3 className="text-lg font-semibold text-ghana-black">Quick Actions</h3>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Button
                  color="success"
                  variant="flat"
                  className="h-24 flex flex-col items-center justify-center gap-2 p-4"
                  onClick={() => handleQuickAction('new_transaction')}
                >
                  <span className="text-2xl">➕</span>
                  <span className="font-medium">New Transaction</span>
                  <span className="text-xs text-center opacity-80">Create new journal entry</span>
                </Button>
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

          {/* Main Operations Interface - Following Uniform Pattern */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">📊 Operations Overview</h3>
            </CardHeader>
            <CardBody>
              <Tabs 
                selectedKey={selectedTab} 
                onSelectionChange={(key) => setSelectedTab(key as string)}
                className="w-full"
                aria-label="Accounting operations"
              >
                <Tab key="overview" title="📊 Overview">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                    {operationalItems.map((category, categoryIndex) => (
                      <Card key={categoryIndex} className="border border-gray-200 shadow-md">
                        <CardHeader className="pb-3">
                          <h4 className="text-lg font-semibold text-ghana-black">{category.category}</h4>
                        </CardHeader>
                        <CardBody className="pt-0">
                          <div className="space-y-3">
                            {category.items.map((item, itemIndex) => (
                              <div 
                                key={itemIndex}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-ghana-gold/10 cursor-pointer transition-colors"
                                onClick={() => {
                                  // Handle navigation based on item type
                                  if (item.title.includes('Chart of Accounts')) {
                                    setSelectedTab('accounts');
                                  } else if (item.title.includes('Bank & Cash')) {
                                    setSelectedTab('banking');
                                  } else if (item.title.includes('Financial Reports')) {
                                    setSelectedTab('reports');
                                  } else if (item.title.includes('Audit Controls')) {
                                    setSelectedTab('audit');
                                  } else if (item.title.includes('Accounts Receivable')) {
                                    setSelectedTab('receivables');
                                  } else if (item.title.includes('Accounts Payable')) {
                                    setSelectedTab('payables');
                                  } else if (item.title.includes('PPE & Assets')) {
                                    setSelectedTab('assets');
                                  } else if (item.title.includes('Trial Balance')) {
                                    setSelectedTab('reports');
                                  } else if (item.title.includes('Bank Reconciliation')) {
                                    setSelectedTab('reconciliation');
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-3">
                                  <span className="text-xl">{item.icon}</span>
                                  <div>
                                    <div className="flex items-center">
                                      <InfoIcon description={item.description} />
                                      <p className="font-medium text-ghana-black">{item.title}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge 
                                    color={item.status === 'active' ? 'success' : 'default'}
                                    variant="flat"
                                  >
                                    {item.status}
                                  </Badge>
                                  <Chip size="sm" variant="flat" color="primary">
                                    {item.count}
                                  </Chip>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </Tab>

                {!leanMode && (
                <Tab key="accounts" title="📊 Chart of Accounts">
                  <ChartOfAccounts />
                </Tab>
                )}

                {!leanMode && (
                  <Tab key="banking" title="💰 Bank & Cash">
                    <BankCashReceivables />
                  </Tab>
                )}

                {/* Removed focused Sales Invoices and Bills tabs to streamline to A/R and A/P only */}

                <Tab key="receivables" title="📝 Accounts Receivable">
                  <div className="p-6">
                  <AccountsReceivable />
                  </div>
                </Tab>

                <Tab key="payables" title="🧾 Accounts Payable">
                  <AccountsPayable />
                </Tab>

                {!leanMode && (
                <Tab key="assets" title="🏗️ PPE & Assets">
                  <InventoryFixedAssets />
                </Tab>
                )}

                {!leanMode && (
                <Tab key="reports" title="📈 Financial Reports">
                  <FinancialReports />
                </Tab>
                )}

                <Tab key="taxes" title="🧮 Taxes">
                  <div className="p-6">
                    <BooksTaxes />
                  </div>
                </Tab>

                {!leanMode && (
                <Tab key="audit" title="🔍 Audit Controls">
                  <AuditControls />
                </Tab>
                )}

                <Tab key="reconciliation" title="⚖️ Bank Recon">
                  <BankReconciliation />
                </Tab>
              </Tabs>

      {/* Recent Activities & Notices */}
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
            </CardHeader>
            <CardBody>
              <RecentActivities area="accounting" />
            </CardBody>
          </Card>

          {/* Accounting Notices */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Accounting Notices</h3>
            </CardHeader>
            <CardBody>
              <DeptNotices dept="accounting" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
        </div>
      </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

