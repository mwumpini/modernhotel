'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, Textarea,
  Tabs, Tab, Divider, Progress, Avatar, useDisclosure, Tooltip, Switch, Alert
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';

interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  category: string;
  parentAccount?: string;
  isActive: boolean;
  balance: number;
  description?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  entries: JournalEntryLine[];
  status: 'draft' | 'posted' | 'cancelled';
  createdBy: string;
  createdAt: string;
  postedAt?: string;
}

interface JournalEntryLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

interface FinancialReport {
  id: string;
  name: string;
  type: 'income-statement' | 'balance-sheet' | 'cash-flow' | 'trial-balance';
  period: string;
  generatedAt: string;
  data: any;
}

export default function AccountingManagementDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isJournalEntryModalOpen, setIsJournalEntryModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  const settings = useSettingsStore();
  const [tick, setTick] = useState(0);

  // Sample data - in real app, this would come from stores
  const chartOfAccounts: ChartOfAccount[] = [
    {
      id: '1',
      code: '1000',
      name: 'Current Assets',
      type: 'asset',
      category: 'Assets',
      isActive: true,
      balance: 0
    },
    {
      id: '2',
      code: '1100',
      name: 'Cash & Bank',
      type: 'asset',
      category: 'Current Assets',
      parentAccount: '1',
      isActive: true,
      balance: 25000.00
    },
    {
      id: '3',
      code: '1200',
      name: 'Accounts Receivable',
      type: 'asset',
      category: 'Current Assets',
      parentAccount: '1',
      isActive: true,
      balance: 15000.00
    },
    {
      id: '4',
      code: '2000',
      name: 'Current Liabilities',
      type: 'liability',
      category: 'Liabilities',
      isActive: true,
      balance: 0
    },
    {
      id: '5',
      code: '2100',
      name: 'Accounts Payable',
      type: 'liability',
      category: 'Current Liabilities',
      parentAccount: '4',
      isActive: true,
      balance: 8000.00
    },
    {
      id: '6',
      code: '3000',
      name: 'Equity',
      type: 'equity',
      category: 'Equity',
      isActive: true,
      balance: 0
    },
    {
      id: '7',
      code: '3100',
      name: 'Retained Earnings',
      type: 'equity',
      category: 'Equity',
      parentAccount: '6',
      isActive: true,
      balance: 32000.00
    },
    {
      id: '8',
      code: '4000',
      name: 'Revenue',
      type: 'revenue',
      category: 'Revenue',
      isActive: true,
      balance: 0
    },
    {
      id: '9',
      code: '4100',
      name: 'Room Revenue',
      type: 'revenue',
      category: 'Revenue',
      parentAccount: '8',
      isActive: true,
      balance: 45000.00
    },
    {
      id: '10',
      code: '4200',
      name: 'F&B Revenue',
      type: 'revenue',
      category: 'Revenue',
      parentAccount: '8',
      isActive: true,
      balance: 18000.00
    },
    {
      id: '11',
      code: '5000',
      name: 'Expenses',
      type: 'expense',
      category: 'Expenses',
      isActive: true,
      balance: 0
    },
    {
      id: '12',
      code: '5100',
      name: 'Operating Expenses',
      type: 'expense',
      category: 'Expenses',
      parentAccount: '11',
      isActive: true,
      balance: 28000.00
    }
  ];

  const journalEntries: JournalEntry[] = [
    {
      id: '1',
      date: '2024-01-16',
      reference: 'JE-001',
      description: 'Monthly room revenue recognition',
      entries: [
        { id: '1', accountId: '2', accountCode: '1100', accountName: 'Cash & Bank', debit: 0, credit: 45000, description: 'Room revenue received' },
        { id: '2', accountId: '9', accountCode: '4100', accountName: 'Room Revenue', debit: 45000, credit: 0, description: 'Room revenue recognized' }
      ],
      status: 'posted',
      createdBy: 'Admin User',
      createdAt: '2024-01-16T09:00:00Z',
      postedAt: '2024-01-16T09:05:00Z'
    },
    {
      id: '2',
      date: '2024-01-16',
      reference: 'JE-002',
      description: 'F&B revenue and cost of goods sold',
      entries: [
        { id: '3', accountId: '2', accountCode: '1100', accountName: 'Cash & Bank', debit: 0, credit: 18000, description: 'F&B revenue received' },
        { id: '4', accountId: '10', accountCode: '4200', accountName: 'F&B Revenue', debit: 18000, credit: 0, description: 'F&B revenue recognized' }
      ],
      status: 'posted',
      createdBy: 'Admin User',
      createdAt: '2024-01-16T10:00:00Z',
      postedAt: '2024-01-16T10:05:00Z'
    }
  ];

  // Calculate financial metrics
  const totalAssets = chartOfAccounts.filter(a => a.type === 'asset').reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = chartOfAccounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = chartOfAccounts.filter(a => a.type === 'equity').reduce((sum, a) => sum + a.balance, 0);
  const totalRevenue = chartOfAccounts.filter(a => a.type === 'revenue').reduce((sum, a) => sum + a.balance, 0);
  const totalExpenses = chartOfAccounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + a.balance, 0);
  const netIncome = totalRevenue - totalExpenses;
  const workingCapital = totalAssets - totalLiabilities;

  const handleAccountStatusToggle = (accountId: string, isActive: boolean) => {
    trackEvent('ACCT.AccountStatusChanged', { accountId, isActive });
    // In real app, update the account status in the store
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Assets</p>
                <p className="text-2xl font-bold text-ghana-black">₵{totalAssets.toLocaleString()}</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-ghana-black">₵{totalRevenue.toLocaleString()}</p>
              </div>
              <div className="text-3xl">📈</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Net Income</p>
                <p className={`text-2xl font-bold ${netIncome >= 0 ? 'text-ghana-green' : 'text-red-600'}`}>
                  ₵{netIncome.toLocaleString()}
                </p>
              </div>
              <div className="text-3xl">{netIncome >= 0 ? '✅' : '❌'}</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Working Capital</p>
                <p className="text-2xl font-bold text-ghana-black">₵{workingCapital.toLocaleString()}</p>
              </div>
              <div className="text-3xl">🏦</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🚀 Quick Actions</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="flat"
              className="bg-ghana-green text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsJournalEntryModalOpen(true)}
            >
              <span className="text-2xl">📝</span>
              <span className="text-sm font-medium">New Journal Entry</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-gold text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsAccountModalOpen(true)}
            >
              <span className="text-2xl">🏦</span>
              <span className="text-sm font-medium">Add Account</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsReportModalOpen(true)}
            >
              <span className="text-2xl">📊</span>
              <span className="text-sm font-medium">Generate Report</span>
            </Button>
            <Button
              variant="flat"
              className="bg-purple-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">🧮</span>
              <span className="text-sm font-medium">Tax Calculator</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Recent Journal Entries */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Journal Entries</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {journalEntries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`h-3 w-3 rounded-full ${
                    entry.status === 'posted' ? 'bg-green-500' :
                    entry.status === 'draft' ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }`}></div>
                  <span className="text-sm text-gray-800">
                    {entry.reference} - {entry.description} - {entry.entries.length} lines
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    {new Date(entry.date).toLocaleDateString()}
                  </span>
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onClick={() => {
                      setSelectedEntry(entry);
                      setIsJournalEntryModalOpen(true);
                    }}
                  >
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderChartOfAccounts = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">🏦 Chart of Accounts</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsAccountModalOpen(true)}
            >
              ➕ Add Account
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Chart of accounts table">
            <TableHeader>
              <TableColumn>Code</TableColumn>
              <TableColumn>Name</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Category</TableColumn>
              <TableColumn>Balance</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {chartOfAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-mono font-semibold">{account.code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{account.name}</div>
                      {account.description && (
                        <div className="text-sm text-gray-500">{account.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        account.type === 'asset' ? 'success' :
                        account.type === 'liability' ? 'danger' :
                        account.type === 'equity' ? 'primary' :
                        account.type === 'revenue' ? 'warning' :
                        'secondary'
                      } 
                      size="sm"
                    >
                      {account.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Chip color="primary" size="sm" variant="flat">
                      {account.category}
                    </Chip>
                  </TableCell>
                  <TableCell className="font-semibold">
                    <span className={account.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ₵{account.balance.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch
                      isSelected={account.isActive}
                      onValueChange={(checked) => handleAccountStatusToggle(account.id, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        Edit
                      </Button>
                      <Button size="sm" variant="flat" color="secondary">
                        View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderJournalEntries = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📝 Journal Entries</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsJournalEntryModalOpen(true)}
            >
              ➕ New Entry
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Journal entries table">
            <TableHeader>
              <TableColumn>Reference</TableColumn>
              <TableColumn>Date</TableColumn>
              <TableColumn>Description</TableColumn>
              <TableColumn>Lines</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Created By</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {journalEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono font-semibold">{entry.reference}</TableCell>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate">{entry.description}</div>
                  </TableCell>
                  <TableCell>
                    <Badge color="primary" size="sm">
                      {entry.entries.length} lines
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        entry.status === 'posted' ? 'success' :
                        entry.status === 'draft' ? 'warning' :
                        'default'
                      } 
                      size="sm"
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{entry.createdBy}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary" onClick={() => {
                        setSelectedEntry(entry);
                        setIsJournalEntryModalOpen(true);
                      }}>
                        View
                      </Button>
                      {entry.status === 'draft' && (
                        <Button size="sm" variant="flat" color="success">
                          Post
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderFinancialReports = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📊 Financial Reports</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsReportModalOpen(true)}
            >
              📈 Generate Report
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Income Statement */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-2">
                <h4 className="text-lg font-semibold">Income Statement</h4>
                <p className="text-sm text-gray-600">For the period ending {new Date().toLocaleDateString()}</p>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Revenue:</span>
                    <span className="font-semibold">₵{totalRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Expenses:</span>
                    <span className="font-semibold">₵{totalExpenses.toLocaleString()}</span>
                  </div>
                  <Divider />
                  <div className="flex justify-between">
                    <span className="font-semibold">Net Income:</span>
                    <span className={`font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₵{netIncome.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Balance Sheet */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-2">
                <h4 className="text-lg font-semibold">Balance Sheet</h4>
                <p className="text-sm text-gray-600">As of {new Date().toLocaleDateString()}</p>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Assets:</span>
                    <span className="font-semibold">₵{totalAssets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Liabilities:</span>
                    <span className="font-semibold">₵{totalLiabilities.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Equity:</span>
                    <span className="font-semibold">₵{totalEquity.toLocaleString()}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Ghana Tax Compliance */}
            <Card className="border border-gray-200">
              <CardHeader className="pb-2">
                <h4 className="text-lg font-semibold">Tax Compliance</h4>
                <p className="text-sm text-gray-600">Ghana Tax Requirements</p>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">VAT (12.5%):</span>
                    <span className="font-semibold">₵{(totalRevenue * 0.125).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">NHIL (2.5%):</span>
                    <span className="font-semibold">₵{(totalRevenue * 0.025).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Tourism Levy (1%):</span>
                    <span className="font-semibold">₵{(totalRevenue * 0.01).toLocaleString()}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🧾 Accounting & Financial Management</h1>
          <p className="text-gray-600">Complete financial management with Ghana tax compliance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">SaaS Ready</Badge>
        </div>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="Overview" />
        <Tab key="chart-of-accounts" title="Chart of Accounts" />
        <Tab key="journal-entries" title="Journal Entries" />
        <Tab key="financial-reports" title="Financial Reports" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'chart-of-accounts' && renderChartOfAccounts()}
        {selectedTab === 'journal-entries' && renderJournalEntries()}
        {selectedTab === 'financial-reports' && renderFinancialReports()}
      </div>

      {/* Account Modal */}
      <Modal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Add Chart of Account</ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Account form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsAccountModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsAccountModalOpen(false)}>
              Add Account
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Journal Entry Modal */}
      <Modal isOpen={isJournalEntryModalOpen} onClose={() => setIsJournalEntryModalOpen(false)} size="4xl">
        <ModalContent>
          <ModalHeader>
            {selectedEntry ? 'Edit Journal Entry' : 'New Journal Entry'}
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Journal entry form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsJournalEntryModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsJournalEntryModalOpen(false)}>
              {selectedEntry ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Report Modal */}
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Generate Financial Report</ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Report generation form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsReportModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsReportModalOpen(false)}>
              Generate Report
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
