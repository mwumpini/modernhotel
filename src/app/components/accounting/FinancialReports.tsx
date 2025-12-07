'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Badge, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Tabs, Tab, Textarea, Divider, Spinner, Alert, Progress, Pagination
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';

export default function FinancialReportsPage() {
  const {
    financialPeriods,
    currentFinancialPeriod,
    getTrialBalance,
    getIncomeStatement,
    getBalanceSheet,
    getCashFlow,
    isLoading,
    error
  } = useAccountingStore();

  const [selectedTab, setSelectedTab] = useState("overview");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    if (!selectedPeriod && currentFinancialPeriod) {
      setSelectedPeriod(currentFinancialPeriod.id);
    }
  }, [selectedPeriod, currentFinancialPeriod]);

  // Get financial data
  const trialBalance = useMemo(() => {
    return getTrialBalance(selectedPeriod) || [];
  }, [getTrialBalance, selectedPeriod]);

  // Pagination for trial balance
  const paginatedTrialBalance = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return trialBalance.slice(start, start + rowsPerPage);
  }, [trialBalance, page]);

  const trialBalancePages = Math.ceil(trialBalance.length / rowsPerPage);

  const incomeStatement = useMemo(() => {
    return getIncomeStatement(selectedPeriod) || {
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
      grossProfit: 0,
      operatingExpenses: 0
    };
  }, [getIncomeStatement, selectedPeriod]);

  const balanceSheet = useMemo(() => {
    return getBalanceSheet(selectedPeriod) || {
      currentAssets: 0,
      fixedAssets: 0,
      totalAssets: 0,
      currentLiabilities: 0,
      longTermLiabilities: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      totalLiabilitiesAndEquity: 0
    };
  }, [getBalanceSheet, selectedPeriod]);

  const cashFlow = useMemo(() => {
    return getCashFlow(selectedPeriod) || {
      operatingCashFlow: 0,
      investingCashFlow: 0,
      financingCashFlow: 0,
      netCashFlow: 0
    };
  }, [getCashFlow, selectedPeriod]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">📊 Financial Reports</h1>
        <p className="text-gray-600 mt-2">
          Generate and analyze financial statements and reports
        </p>
      </div>

      {/* Period Selection */}
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              placeholder="Select Financial Period"
              selectedKeys={[selectedPeriod]}
              onSelectionChange={(keys) => setSelectedPeriod(Array.from(keys)[0] as string)}
            >
              {financialPeriods.map(period => (
                <SelectItem key={period.id}>{period.name}</SelectItem>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert color="danger" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Card>
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
          >
            <Tab key="overview" title="📈 Overview">
              <div className="p-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-green-600">₵{incomeStatement.totalRevenue.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Total Revenue</div>
                      <Progress value={100} size="sm" color="success" className="mt-2" />
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-red-600">₵{incomeStatement.totalExpenses.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Total Expenses</div>
                      <Progress value={100} size="sm" color="danger" className="mt-2" />
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody className="text-center">
                      <div className={`text-2xl font-bold ${incomeStatement.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₵{incomeStatement.netIncome.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Net Income</div>
                      <Progress value={100} size="sm" color={incomeStatement.netIncome >= 0 ? 'success' : 'danger'} className="mt-2" />
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-blue-600">₵{balanceSheet.totalAssets.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Total Assets</div>
                      <Progress value={100} size="sm" color="primary" className="mt-2" />
                    </CardBody>
                  </Card>
                </div>

                {/* Quick glance trial balance */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Trial Balance Snapshot</h3>
                  <Table aria-label="Trial Balance Snapshot">
                    <TableHeader>
                      <TableColumn>ACCOUNT</TableColumn>
                      <TableColumn>TYPE</TableColumn>
                      <TableColumn className="text-right">DEBIT</TableColumn>
                      <TableColumn className="text-right">CREDIT</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {trialBalance.map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="font-medium">{row.accountName}</div>
                            <div className="text-xs text-gray-500 font-mono">{row.accountCode}</div>
                          </TableCell>
                          <TableCell>{row.type}</TableCell>
                          <TableCell className="text-right">₵{(row.debitBalance ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">₵{(row.creditBalance ?? 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Tab>

            <Tab key="income-statement" title="📈 Income Statement">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Income Statement</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardBody>
                      <div className="flex justify-between"><span>Total Revenue</span><span className="font-semibold">₵{incomeStatement.totalRevenue.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Total Expenses</span><span className="font-semibold">₵{incomeStatement.totalExpenses.toLocaleString()}</span></div>
                      <Divider className="my-2" />
                      <div className="flex justify-between"><span>Net Income</span><span className={`font-semibold ${incomeStatement.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>₵{incomeStatement.netIncome.toLocaleString()}</span></div>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody>
                      <div className="flex justify-between"><span>Gross Profit</span><span className="font-semibold">₵{incomeStatement.grossProfit.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Operating Expenses</span><span className="font-semibold">₵{incomeStatement.operatingExpenses.toLocaleString()}</span></div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="balance-sheet" title="⚖️ Balance Sheet">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Balance Sheet</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardBody>
                      <div className="flex justify-between"><span>Current Assets</span><span className="font-semibold">₵{balanceSheet.currentAssets.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Fixed Assets</span><span className="font-semibold">₵{balanceSheet.fixedAssets.toLocaleString()}</span></div>
                      <Divider className="my-2" />
                      <div className="flex justify-between"><span>Total Assets</span><span className="font-semibold">₵{balanceSheet.totalAssets.toLocaleString()}</span></div>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody>
                      <div className="flex justify-between"><span>Current Liabilities</span><span className="font-semibold">₵{balanceSheet.currentLiabilities.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Long-term Liabilities</span><span className="font-semibold">₵{balanceSheet.longTermLiabilities.toLocaleString()}</span></div>
                      <Divider className="my-2" />
                      <div className="flex justify-between"><span>Total Liabilities</span><span className="font-semibold">₵{balanceSheet.totalLiabilities.toLocaleString()}</span></div>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody>
                      <div className="flex justify-between"><span>Total Equity</span><span className="font-semibold">₵{balanceSheet.totalEquity.toLocaleString()}</span></div>
                      <Divider className="my-2" />
                      <div className="flex justify-between"><span>Total Liabilities & Equity</span><span className="font-semibold">₵{balanceSheet.totalLiabilitiesAndEquity.toLocaleString()}</span></div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="cash-flow" title="💸 Cash Flow">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Cash Flow Statement</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card><CardBody><div className="flex justify-between"><span>Operating</span><span className="font-semibold">₵{cashFlow.operatingCashFlow.toLocaleString()}</span></div></CardBody></Card>
                  <Card><CardBody><div className="flex justify-between"><span>Investing</span><span className="font-semibold">₵{cashFlow.investingCashFlow.toLocaleString()}</span></div></CardBody></Card>
                  <Card><CardBody><div className="flex justify-between"><span>Financing</span><span className="font-semibold">₵{cashFlow.financingCashFlow.toLocaleString()}</span></div></CardBody></Card>
                </div>
                <Card className="mt-6"><CardBody><div className="flex justify-between"><span>Net Cash Flow</span><span className="font-semibold">₵{cashFlow.netCashFlow.toLocaleString()}</span></div></CardBody></Card>
              </div>
            </Tab>

            <Tab key="trial-balance" title="📋 Trial Balance">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Trial Balance</h3>
                <Table aria-label="Trial Balance">
                  <TableHeader>
                    <TableColumn>ACCOUNT</TableColumn>
                    <TableColumn>TYPE</TableColumn>
                    <TableColumn className="text-right">DEBIT</TableColumn>
                    <TableColumn className="text-right">CREDIT</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No trial balance rows.">
                    {paginatedTrialBalance.map((row: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="font-medium">{row.accountName}</div>
                          <div className="text-xs text-gray-500 font-mono">{row.accountCode}</div>
                        </TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell className="text-right">₵{(row.debitBalance ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">₵{(row.creditBalance ?? 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {trialBalancePages > 1 && (
                  <div className="flex justify-center mt-4 p-4">
                    <Pagination 
                      total={trialBalancePages} 
                      page={page} 
                      onChange={setPage}
                      showControls
                    />
                </div>
                )}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
