'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Badge, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Tabs, Tab, Textarea, Divider, Spinner, Alert, Progress
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

  // Get financial data
  const trialBalance = useMemo(() => {
    return getTrialBalance(selectedPeriod) || [];
  }, [getTrialBalance, selectedPeriod]);

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

                <div className="text-center p-8 text-gray-500">
                  <h3 className="text-lg font-semibold mb-2">Financial Reports Overview</h3>
                  <p>Detailed financial analysis and reporting coming soon...</p>
                </div>
              </div>
            </Tab>

            <Tab key="income-statement" title="📈 Income Statement">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Income Statement</h3>
                <div className="text-center p-8 text-gray-500">
                  Detailed income statement report coming soon...
                </div>
              </div>
            </Tab>

            <Tab key="balance-sheet" title="⚖️ Balance Sheet">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Balance Sheet</h3>
                <div className="text-center p-8 text-gray-500">
                  Detailed balance sheet report coming soon...
                </div>
              </div>
            </Tab>

            <Tab key="cash-flow" title="💸 Cash Flow">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Cash Flow Statement</h3>
                <div className="text-center p-8 text-gray-500">
                  Detailed cash flow statement coming soon...
                </div>
              </div>
            </Tab>

            <Tab key="trial-balance" title="📋 Trial Balance">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Trial Balance</h3>
                <div className="text-center p-8 text-gray-500">
                  Trial balance report coming soon...
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
