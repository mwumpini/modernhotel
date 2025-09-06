'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Tabs, 
  Tab, 
  Chip,
  Progress,
  Avatar,
  Tooltip,
  Divider
} from "@heroui/react";
import { trackEvent } from '../lib/analytics/trackEvent';
import { useRouter } from 'next/navigation';

// Import specialized accounting components
import ChartOfAccounts from './accounting/ChartOfAccounts';
import BankCashReceivables from './accounting/BankCashReceivables';
import AccountsPayable from './accounting/AccountsPayable';
import InventoryFixedAssets from './accounting/InventoryFixedAssets';
import FinancialReports from './accounting/FinancialReports';
import AuditControls from './accounting/AuditControls';
import ViewActivities from './accounting/ViewActivities';

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
  
  // Sample accounting data - in real app, this would come from stores
  const totalAssets = 2847500;
  const totalLiabilities = 1250000;
  const totalEquity = 1597500;
  const currentRevenue = 456000;
  const currentExpenses = 312000;
  const netIncome = 144000;
  
  // Financial health indicators
  const profitMargin = ((netIncome / currentRevenue) * 100).toFixed(1);
  
  // Operational metrics
  const pendingInvoices = 23;
  const overduePayments = 7;
  const activeAccounts = 156;
  const pendingReconciliations = 12;
  
  // Compliance status
  const taxCompliance = 94;
  const auditCompliance = 97;
  const regulatoryCompliance = 91;
  const overallCompliance = 94;

  // Today's operations
  const transactionsToday = 45;
  const invoicesGeneratedToday = 8;
  const paymentsReceivedToday = 12;
  const reconciliationsCompletedToday = 3;

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
        { title: 'Inventory Assets', icon: '📦', description: 'Fixed assets and inventory tracking', status: 'active', count: 0 },
        { title: 'Trial Balance', icon: '⚖️', description: 'Account balances and reconciliation', status: 'active', count: pendingReconciliations },
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
        { title: 'Reconciliations', icon: '✅', description: 'Account and bank reconciliations', status: 'active', count: reconciliationsCompletedToday },
      ]
    }
  ];

  const handleQuickAction = (action: string) => {
    trackEvent('accounting.quick_action', { action });
    switch (action) {
      case 'new_transaction':
        setSelectedTab('transactions');
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
                <h4 className="text-lg font-semibold text-ghana-black">Financial Position</h4>
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-3">₵{totalAssets.toLocaleString()}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Total Assets</span>
                  <span className="font-medium">₵{totalAssets.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Liabilities</span>
                  <span className="font-medium">₵{totalLiabilities.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Worth</span>
                  <span className="font-medium">₵{totalEquity.toLocaleString()}</span>
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
              <div className="text-3xl font-bold text-green-600 mb-3">₵{netIncome.toLocaleString()}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Revenue</span>
                  <span className="font-medium">₵{currentRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expenses</span>
                  <span className="font-medium">₵{currentExpenses.toLocaleString()}</span>
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
                  <span>Pending Invoices</span>
                  <span className="font-medium">{pendingInvoices}</span>
                </div>
                <div className="flex justify-between">
                  <span>Overdue Payments</span>
                  <span className="font-medium">{overduePayments}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Accounts</span>
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
                                } else if (item.title.includes('Inventory Assets')) {
                                  setSelectedTab('assets');
                                } else if (item.title.includes('Trial Balance')) {
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

              <Tab key="accounts" title="📊 Chart of Accounts">
                <ChartOfAccounts />
              </Tab>

              <Tab key="banking" title="💰 Bank & Cash">
                <BankCashReceivables />
              </Tab>

              <Tab key="receivables" title="📝 Accounts Receivable">
                <AccountsPayable />
              </Tab>

              <Tab key="payables" title="🧾 Accounts Payable">
                <AccountsPayable />
              </Tab>

              <Tab key="assets" title="📦 Inventory & Assets">
                <InventoryFixedAssets />
              </Tab>

              <Tab key="reports" title="📈 Financial Reports">
                <FinancialReports />
              </Tab>

              <Tab key="audit" title="🔍 Audit Controls">
                <AuditControls />
              </Tab>

              <Tab key="reconciliation" title="⚖️ Reconciliation">
                <ViewActivities />
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

