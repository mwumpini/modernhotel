'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardBody } from '@heroui/react';
import { Tabs, Tab } from '@heroui/react';
import { Chip } from '@heroui/react';
import TaxCalculationPreview from './TaxCalculationPreview';
import CurrencyExchangeManager from './CurrencyExchangeManager';
import TaxExemptionManager from './TaxExemptionManager';

interface DashboardStats {
  totalExemptions: number;
  pendingApprovals: number;
  activeCurrencies: number;
  totalTaxSaved: number;
  lastCalculations: number;
  complianceScore: number;
}

export default function RateAndTaxDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalExemptions: 24,
    pendingApprovals: 3,
    activeCurrencies: 8,
    totalTaxSaved: 15680.50,
    lastCalculations: 47,
    complianceScore: 94
  });

  const [recentCalculations, setRecentCalculations] = useState([
    {
      id: 'calc-1',
      guestName: 'John Doe',
      amount: 2500,
      currency: 'USD',
      totalTax: 312.50,
      date: '2024-01-25T10:30:00Z',
      status: 'completed'
    },
    {
      id: 'calc-2',
      guestName: 'Ghana Export Corp',
      amount: 5000,
      currency: 'GHS',
      totalTax: 0,
      date: '2024-01-25T09:15:00Z',
      status: 'exempt'
    },
    {
      id: 'calc-3',
      guestName: 'US Embassy',
      amount: 1800,
      currency: 'USD',
      totalTax: 0,
      date: '2024-01-25T08:45:00Z',
      status: 'exempt'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'primary';
      case 'exempt': return 'success';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '💰';
      case 'exempt': return '✅';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: { [key: string]: string } = {
      'GHS': '₵',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    return `${symbols[currency] || currency}${amount.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Rate & Tax Management Dashboard</h1>
            <p className="text-gray-600">Comprehensive management of pricing, taxation, and compliance</p>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Total Exemptions</p>
                <p className="text-2xl font-bold text-blue-800">{dashboardStats.totalExemptions}</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600">Pending Approvals</p>
                <p className="text-2xl font-bold text-orange-800">{dashboardStats.pendingApprovals}</p>
              </div>
              <div className="text-3xl">⏳</div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Active Currencies</p>
                <p className="text-2xl font-bold text-green-800">{dashboardStats.activeCurrencies}</p>
              </div>
              <div className="text-3xl">💱</div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Tax Saved</p>
                <p className="text-2xl font-bold text-purple-800">₵{dashboardStats.totalTaxSaved.toLocaleString()}</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card>
        <CardBody className="p-0">
          <Tabs
            aria-label="Rate and Tax Management"
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            className="w-full"
            classNames={{
              tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
              cursor: "w-full bg-primary",
              tab: "max-w-fit px-0 h-12",
              tabContent: "group-data-[selected=true]:text-primary"
            }}
          >
            <Tab
              key="overview"
              title={
                <div className="flex items-center space-x-2">
                  <span>📊</span>
                  <span>Overview</span>
                </div>
              }
            >
              <div className="p-6 space-y-6">
                {/* Compliance Score */}
                <Card className="bg-gradient-to-r from-emerald-50 to-teal-50">
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Compliance Score</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-emerald-600">{dashboardStats.complianceScore}%</div>
                        <div className="text-sm text-gray-600">Overall Compliance</div>
                      </div>
                      <div className="text-6xl">🏆</div>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Tax Rules</span>
                        <span>100%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Exemptions</span>
                        <span>94%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '94%' }}></div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Currency Rates</span>
                        <span>88%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '88%' }}></div>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Recent Calculations */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Recent Tax Calculations</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-3">
                      {recentCalculations.map((calculation) => (
                        <div
                          key={calculation.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{getStatusIcon(calculation.status)}</span>
                            <div>
                              <div className="font-medium">{calculation.guestName}</div>
                              <div className="text-sm text-gray-500">
                                {new Date(calculation.date).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="font-mono font-medium">
                              {formatCurrency(calculation.amount, calculation.currency)}
                            </div>
                            <div className="text-sm text-gray-500">
                              Tax: {calculation.totalTax > 0 ? formatCurrency(calculation.totalTax, calculation.currency) : 'Exempt'}
                            </div>
                          </div>
                          
                          <Chip
                            size="sm"
                            color={getStatusColor(calculation.status)}
                            variant="flat"
                          >
                            {calculation.status}
                          </Chip>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Quick Actions</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors">
                        <CardBody className="p-4 text-center">
                          <div className="text-3xl mb-2">🧮</div>
                          <h4 className="font-medium text-blue-800">Calculate Tax</h4>
                          <p className="text-sm text-blue-600">Quick tax calculation for guests</p>
                        </CardBody>
                      </Card>
                      
                      <Card className="bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors">
                        <CardBody className="p-4 text-center">
                          <div className="text-3xl mb-2">📋</div>
                          <h4 className="font-medium text-green-800">Manage Exemptions</h4>
                          <p className="text-sm text-green-600">Handle tax exemptions and approvals</p>
                        </CardBody>
                      </Card>
                      
                      <Card className="bg-purple-50 border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors">
                        <CardBody className="p-4 text-center">
                          <div className="text-3xl mb-2">💱</div>
                          <h4 className="font-medium text-purple-800">Currency Rates</h4>
                          <p className="text-sm text-purple-600">Update exchange rates</p>
                        </CardBody>
                      </Card>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            <Tab
              key="tax-calculator"
              title={
                <div className="flex items-center space-x-2">
                  <span>🧮</span>
                  <span>Tax Calculator</span>
                </div>
              }
            >
              <div className="p-6">
                <TaxCalculationPreview />
              </div>
            </Tab>

            <Tab
              key="exemptions"
              title={
                <div className="flex items-center space-x-2">
                  <span>📋</span>
                  <span>Tax Exemptions</span>
                  {dashboardStats.pendingApprovals > 0 && (
                    <Chip color="warning" size="sm" variant="flat">{dashboardStats.pendingApprovals}</Chip>
                  )}
                </div>
              }
            >
              <div className="p-6">
                <TaxExemptionManager />
              </div>
            </Tab>

            <Tab
              key="currencies"
              title={
                <div className="flex items-center space-x-2">
                  <span>💱</span>
                  <span>Currency Management</span>
                </div>
              }
            >
              <div className="p-6">
                <CurrencyExchangeManager />
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
