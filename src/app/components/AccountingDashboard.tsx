'use client';

import React, { useEffect, useState } from 'react';
import { 
  Card, CardBody, CardHeader, Tabs, Tab, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Badge, Progress, Divider, Spinner, Alert, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import { useStockStore } from '@/app/lib/inventory/stockStore';
import { useSupplierStore } from '@/app/lib/inventory/supplierStore';


export default function AccountingDashboard() {
  const {
    chartOfAccounts,
    journalEntries,
    financialPeriods,
    currentFinancialPeriod,
    invoices,
    payments,
    isLoading,
    error,
    initializeAccounting,
    getTrialBalance,
    getIncomeStatement,
    getBalanceSheet,
    getCashFlow
  } = useAccountingStore();

  const [selectedTab, setSelectedTab] = useState("overview");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    const initializeData = async () => {
      await initializeAccounting();
    };
    initializeData();
  }, [initializeAccounting]);

  useEffect(() => {
    if (currentFinancialPeriod) {
      setSelectedPeriod(currentFinancialPeriod.id);
    }
  }, [currentFinancialPeriod]);

  // Add safety checks for financial data
  const trialBalance = getTrialBalance(selectedPeriod) || [];
  const incomeStatement = getIncomeStatement(selectedPeriod) || {
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    grossProfit: 0,
    operatingExpenses: 0
  };
  const balanceSheet = getBalanceSheet(selectedPeriod) || {
    currentAssets: 0,
    fixedAssets: 0,
    totalAssets: 0,
    currentLiabilities: 0,
    longTermLiabilities: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalLiabilitiesAndEquity: 0
  };
  const cashFlow = getCashFlow(selectedPeriod) || {
    operatingCashFlow: 0,
    investingCashFlow: 0,
    financingCashFlow: 0,
    netCashFlow: 0
  };

  // Ensure all numeric values are numbers
  const safeBalanceSheet = {
    currentAssets: Number(balanceSheet.currentAssets) || 0,
    fixedAssets: Number(balanceSheet.fixedAssets) || 0,
    totalAssets: Number(balanceSheet.totalAssets) || 0,
    currentLiabilities: Number(balanceSheet.currentLiabilities) || 0,
    longTermLiabilities: Number(balanceSheet.longTermLiabilities) || 0,
    totalLiabilities: Number(balanceSheet.totalLiabilities) || 0,
    totalEquity: Number(balanceSheet.totalEquity) || 0,
    totalLiabilitiesAndEquity: Number(balanceSheet.totalLiabilitiesAndEquity) || 0
  };

  const safeIncomeStatement = {
    totalRevenue: Number(incomeStatement.totalRevenue) || 0,
    totalExpenses: Number(incomeStatement.totalExpenses) || 0,
    netIncome: Number(incomeStatement.netIncome) || 0,
    grossProfit: Number(incomeStatement.grossProfit) || 0,
    operatingExpenses: Number(incomeStatement.operatingExpenses) || 0
  };

  const safeCashFlow = {
    operatingCashFlow: Number(cashFlow.operatingCashFlow) || 0,
    investingCashFlow: Number(cashFlow.investingCashFlow) || 0,
    financingCashFlow: Number(cashFlow.financingCashFlow) || 0,
    netCashFlow: Number(cashFlow.netCashFlow) || 0
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              ₵{safeBalanceSheet.totalAssets.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Assets</div>
          </CardBody>
        </Card>
        
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-red-600">
              ₵{safeBalanceSheet.totalLiabilities.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Liabilities</div>
          </CardBody>
        </Card>
        
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ₵{safeIncomeStatement.netIncome.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Net Income</div>
          </CardBody>
        </Card>
        
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              ₵{safeCashFlow.netCashFlow.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Net Cash Flow</div>
          </CardBody>
        </Card>
      </div>

      {/* Current Period Info */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">📅 Current Financial Period</h3>
        </CardHeader>
        <CardBody>
          {currentFinancialPeriod ? (
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">{currentFinancialPeriod.name}</div>
                <div className="text-sm text-gray-600">
                  {new Date(currentFinancialPeriod.startDate).toLocaleDateString()} - 
                  {new Date(currentFinancialPeriod.endDate).toLocaleDateString()}
                </div>
              </div>
              <Chip 
                color={currentFinancialPeriod.isOpen ? "success" : "danger"}
                size="sm"
              >
                {currentFinancialPeriod.isOpen ? "Open" : "Closed"}
              </Chip>
            </div>
          ) : (
            <div className="text-center text-gray-500">No current period set</div>
          )}
        </CardBody>
      </Card>

      {/* Recent Journal Entries */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">📝 Recent Journal Entries</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Recent journal entries">
            <TableHeader>
              <TableColumn>Entry #</TableColumn>
              <TableColumn>Date</TableColumn>
              <TableColumn>Reference</TableColumn>
              <TableColumn>Description</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Total</TableColumn>
            </TableHeader>
            <TableBody>
              {journalEntries && journalEntries.length > 0 ? (
                journalEntries.slice(0, 5).map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.entryNumber}</TableCell>
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell>{entry.reference}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>
                      <Chip 
                        color={entry.status === 'Posted' ? 'success' : 
                               entry.status === 'Draft' ? 'default' : 'danger'}
                        size="sm"
                      >
                        {entry.status}
                      </Chip>
                    </TableCell>
                    <TableCell>₵{entry.totalDebit.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    No journal entries found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">🧾 Recent Invoices</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Recent invoices">
            <TableHeader>
              <TableColumn>Invoice #</TableColumn>
              <TableColumn>Customer</TableColumn>
              <TableColumn>Date</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Total</TableColumn>
            </TableHeader>
            <TableBody>
              {invoices && invoices.length > 0 ? (
                invoices.slice(0, 5).map(invoice => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.businessPartnerId}</TableCell>
                    <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip 
                        color={invoice.type === 'Sales' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {invoice.type}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        color={invoice.status === 'Paid' ? 'success' : 
                               invoice.status === 'Posted' ? 'primary' : 'danger'}
                        size="sm"
                      >
                        {invoice.status}
                      </Chip>
                    </TableCell>
                    <TableCell>₵{invoice.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    No invoices found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderChartOfAccounts = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Chart of Accounts</h3>
        <Button color="primary" onPress={onOpen}>Add Account</Button>
      </div>

      <Card>
        <CardBody>
          <Table aria-label="Chart of accounts">
            <TableHeader>
              <TableColumn>Account Code</TableColumn>
              <TableColumn>Account Name</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Category</TableColumn>
              <TableColumn>Level</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {chartOfAccounts && chartOfAccounts.length > 0 ? (
                chartOfAccounts.map(account => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono">{account.code}</TableCell>
                    <TableCell>
                      <div style={{ paddingLeft: `${(account.level - 1) * 20}px` }}>
                        {account.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        color={account.type === 'Asset' ? 'success' : 
                               account.type === 'Liability' ? 'danger' : 
                               account.type === 'Equity' ? 'warning' : 
                               account.type === 'Revenue' ? 'primary' : 'secondary'}
                        size="sm"
                      >
                        {account.type}
                      </Chip>
                    </TableCell>
                    <TableCell>{account.category}</TableCell>
                    <TableCell>{account.level}</TableCell>
                    <TableCell>
                      <Chip 
                        color={account.isActive ? 'success' : 'danger'}
                        size="sm"
                      >
                        {account.isActive ? 'Active' : 'Inactive'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" color="primary">Edit</Button>
                        <Button size="sm" color="secondary">View</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    No accounts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderJournalEntries = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Journal Entries</h3>
        <Button color="primary">Create Entry</Button>
      </div>

      <Card>
        <CardBody>
          <Table aria-label="Journal entries">
            <TableHeader>
              <TableColumn>Entry #</TableColumn>
              <TableColumn>Date</TableColumn>
              <TableColumn>Reference</TableColumn>
              <TableColumn>Description</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Debit</TableColumn>
              <TableColumn>Credit</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {journalEntries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.entryNumber}</TableCell>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell>{entry.reference}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>
                    <Chip 
                      color={entry.status === 'Posted' ? 'success' : 
                             entry.status === 'Draft' ? 'default' : 'danger'}
                      size="sm"
                    >
                      {entry.status}
                    </Chip>
                  </TableCell>
                  <TableCell>₵{entry.totalDebit.toFixed(2)}</TableCell>
                  <TableCell>₵{entry.totalCredit.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" color="primary">View</Button>
                      {entry.status === 'Draft' && (
                        <Button size="sm" color="success">Post</Button>
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

  const renderTrialBalance = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Trial Balance</h3>
        <Select
          placeholder="Select Period"
          selectedKeys={selectedPeriod ? [selectedPeriod] : []}
          onSelectionChange={(keys) => setSelectedPeriod(Array.from(keys)[0] as string)}
          className="max-w-xs"
        >
          {financialPeriods.map(period => (
            <SelectItem key={period.id} value={period.id}>
              {period.name}
            </SelectItem>
          ))}
        </Select>
      </div>

      <Card>
        <CardBody>
          <Table aria-label="Trial balance">
            <TableHeader>
              <TableColumn>Account Code</TableColumn>
              <TableColumn>Account Name</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Debit Balance</TableColumn>
              <TableColumn>Credit Balance</TableColumn>
            </TableHeader>
            <TableBody>
              {trialBalance.map((account: any) => (
                <TableRow key={account.accountCode}>
                  <TableCell className="font-mono">{account.accountCode}</TableCell>
                  <TableCell>{account.accountName}</TableCell>
                  <TableCell>
                    <Chip 
                      color={account.type === 'Asset' ? 'success' : 
                             account.type === 'Liability' ? 'danger' : 
                             account.type === 'Equity' ? 'warning' : 
                             account.type === 'Revenue' ? 'primary' : 'secondary'}
                      size="sm"
                    >
                      {account.type}
                    </Chip>
                  </TableCell>
                  <TableCell>₵{account.debitBalance.toFixed(2)}</TableCell>
                  <TableCell>₵{account.creditBalance.toFixed(2)}</TableCell>
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Financial Reports</h3>
        <Select
          placeholder="Select Period"
          selectedKeys={selectedPeriod ? [selectedPeriod] : []}
          onSelectionChange={(keys) => setSelectedPeriod(Array.from(keys)[0] as string)}
          className="max-w-xs"
        >
          {financialPeriods.map(period => (
            <SelectItem key={period.id} value={period.id}>
              {period.name}
            </SelectItem>
          ))}
        </Select>
      </div>

      {/* Income Statement */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">📊 Income Statement</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
                         <div className="text-center">
               <div className="text-2xl font-bold text-green-600">
                 ₵{safeIncomeStatement.netIncome.toFixed(2)}
               </div>
               <div className="text-sm text-gray-600">Net Income</div>
             </div>
             <Divider />
             <div className="space-y-2">
               <div className="flex justify-between">
                 <span className="font-medium">Revenue</span>
                 <span className="text-green-600">₵{safeIncomeStatement.totalRevenue.toFixed(2)}</span>
               </div>
               <div className="flex justify-between">
                 <span className="font-medium">Expenses</span>
                 <span className="text-red-600">₵{safeIncomeStatement.totalExpenses.toFixed(2)}</span>
               </div>
             </div>
          </div>
        </CardBody>
      </Card>

      {/* Balance Sheet */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">⚖️ Balance Sheet</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Assets</h4>
              <div className="space-y-2">
                                 <div className="flex justify-between">
                   <span>Current Assets</span>
                   <span>₵{safeBalanceSheet.currentAssets.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Fixed Assets</span>
                   <span>₵{safeBalanceSheet.fixedAssets.toFixed(2)}</span>
                 </div>
                 <Divider />
                 <div className="flex justify-between font-bold">
                   <span>Total Assets</span>
                   <span>₵{safeBalanceSheet.totalAssets.toFixed(2)}</span>
                 </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Liabilities & Equity</h4>
              <div className="space-y-2">
                                 <div className="flex justify-between">
                   <span>Current Liabilities</span>
                   <span>₵{safeBalanceSheet.currentLiabilities.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Long-term Liabilities</span>
                   <span>₵{safeBalanceSheet.longTermLiabilities.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Equity</span>
                   <span>₵{safeBalanceSheet.totalEquity.toFixed(2)}</span>
                 </div>
                 <Divider />
                 <div className="flex justify-between font-bold">
                   <span>Total Liabilities & Equity</span>
                   <span>₵{safeBalanceSheet.totalLiabilitiesAndEquity.toFixed(2)}</span>
                 </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Cash Flow */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">💰 Cash Flow Statement</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
                         <div className="text-center">
               <div className="text-2xl font-bold text-purple-600">
                 ₵{safeCashFlow.netCashFlow.toFixed(2)}
               </div>
               <div className="text-sm text-gray-600">Net Cash Flow</div>
             </div>
             <Divider />
             <div className="space-y-2">
               <div className="flex justify-between">
                 <span>Operating Activities</span>
                 <span className={safeCashFlow.operatingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                   ₵{safeCashFlow.operatingCashFlow.toFixed(2)}
                 </span>
               </div>
               <div className="flex justify-between">
                 <span>Investing Activities</span>
                 <span className={safeCashFlow.investingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                   ₵{safeCashFlow.investingCashFlow.toFixed(2)}
                 </span>
               </div>
               <div className="flex justify-between">
                 <span>Financing Activities</span>
                 <span className={safeCashFlow.financingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                   ₵{safeCashFlow.financingCashFlow.toFixed(2)}
                 </span>
               </div>
             </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert color="danger" className="mb-4">
        Error: {error}
      </Alert>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">💰 Accounting System</h1>
        <p className="text-gray-600 mt-2">
          Complete financial management with integrated inventory accounting
        </p>
      </div>

      <Card>
        <CardBody className="p-0">
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="p-6">
                {renderOverview()}
              </div>
            </Tab>

            <Tab key="chart-of-accounts" title="📋 Chart of Accounts">
              <div className="p-6">
                {renderChartOfAccounts()}
              </div>
            </Tab>

            <Tab key="journal-entries" title="📝 Journal Entries">
              <div className="p-6">
                {renderJournalEntries()}
              </div>
            </Tab>

            <Tab key="trial-balance" title="⚖️ Trial Balance">
              <div className="p-6">
                {renderTrialBalance()}
              </div>
            </Tab>

            <Tab key="financial-reports" title="📈 Financial Reports">
              <div className="p-6">
                {renderFinancialReports()}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Add Account Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Add New Account</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input label="Account Code" placeholder="e.g., 1100" />
              <Input label="Account Name" placeholder="e.g., Cash and Cash Equivalents" />
              <Select label="Account Type" placeholder="Select type">
                              <SelectItem key="Asset">Asset</SelectItem>
              <SelectItem key="Liability">Liability</SelectItem>
              <SelectItem key="Equity">Equity</SelectItem>
              <SelectItem key="Revenue">Revenue</SelectItem>
              <SelectItem key="Expense">Expense</SelectItem>
              </Select>
              <Input label="Category" placeholder="e.g., Current Assets" />
              <Select label="Level" placeholder="Select level">
                              <SelectItem key="1">1 - Main Account</SelectItem>
              <SelectItem key="2">2 - Sub Account</SelectItem>
              <SelectItem key="3">3 - Detail Account</SelectItem>
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={onClose}>
              Add Account
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}


