'use client';

import React, { useEffect, useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Progress, 
  Badge, 
  Tabs, 
  Tab,
  Divider,
  Alert
} from "@heroui/react";
import { useComplianceStore } from '@/app/lib/compliance/store';
import { useComplianceSummary } from '@/app/hooks/useCalculateTax';
import CountrySelector from './CountrySelector';
import Checkout from './Checkout';
import ComplianceReports from './ComplianceReports';
import TaxRateBuilder from './TaxRateBuilder';

export default function AutoComplianceDashboard() {
  const { country, taxRules, reportingRules, isLoading, error } = useComplianceStore();
  const getComplianceSummary = useComplianceSummary();
  const [summary, setSummary] = useState(getComplianceSummary());
  const [selectedTab, setSelectedTab] = useState("overview");

  useEffect(() => {
    setSummary(getComplianceSummary());
  }, [taxRules, reportingRules, country]);

  const getCountryName = (code: string) => {
    const names: Record<string, string> = {
      'GH': 'Ghana',
      'ZW': 'Zimbabwe', 
      'US': 'United States'
    };
    return names[code] || code;
  };

  const getCountryFlag = (code: string) => {
    const flags: Record<string, string> = {
      'GH': '🇬🇭',
      'ZW': '🇿🇼',
      'US': '🇺🇸'
    };
    return flags[code] || '🌍';
  };

  const getTaxBreakdown = () => {
    return taxRules.map(rule => ({
      name: rule.name,
      rate: rule.rate,
      glCode: rule.glCode
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="h-20 w-20 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-3xl flex items-center justify-center shadow-2xl">
                <span className="text-4xl">⚖️</span>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-ghana-black to-ghana-green bg-clip-text text-transparent">
                  Auto Compliance System
                </h1>
                <p className="text-xl text-gray-600 mt-2">
                  Intelligent tax calculation and regulatory compliance for {getCountryName(country)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <CountrySelector />
              <div className="text-right">
                <p className="text-sm text-gray-500">Compliance Score</p>
                <p className="text-3xl font-bold text-ghana-green">{summary.complianceScore}%</p>
                <Progress 
                  value={summary.complianceScore} 
                  className="w-24 mt-2"
                  color={summary.complianceScore >= 80 ? 'success' : summary.complianceScore >= 60 ? 'warning' : 'danger'}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6" color="danger" variant="flat">
            <span>Error: {error}</span>
          </Alert>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-xl flex items-center justify-center mr-4">
                  <span className="text-2xl">🧾</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Tax Rules</p>
                  <p className="text-2xl font-bold text-ghana-black">{summary.activeTaxRules}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-gradient-to-br from-ghana-red to-ghana-gold rounded-xl flex items-center justify-center mr-4">
                  <span className="text-2xl">📊</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Reporting Rules</p>
                  <p className="text-2xl font-bold text-ghana-black">{reportingRules.length}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-ghana-gold rounded-xl flex items-center justify-center mr-4">
                  <span className="text-2xl">⏰</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pending Reports</p>
                  <p className="text-2xl font-bold text-ghana-red">{summary.pendingReports}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-gradient-to-br from-ghana-green to-ghana-red rounded-xl flex items-center justify-center mr-4">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Submitted</p>
                  <p className="text-2xl font-bold text-ghana-green">{summary.submittedReports}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card className="border-0 shadow-lg">
          <CardBody className="p-0">
            <Tabs 
              selectedKey={selectedTab} 
              onSelectionChange={(key) => setSelectedTab(key as string)}
              className="w-full"
              classNames={{
                tabList: "gap-6 w-full relative rounded-none p-6 border-b border-divider",
                cursor: "w-full bg-ghana-green",
                tab: "max-w-fit px-0 h-12",
                tabContent: "group-data-[selected=true]:text-ghana-green"
              }}
            >
              <Tab key="overview" title="📋 Overview">
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Current Country Info */}
                    <Card className="border border-gray-200">
                      <CardHeader>
                        <h3 className="text-lg font-semibold text-ghana-black">Current Country Configuration</h3>
                      </CardHeader>
                      <CardBody>
                        <div className="flex items-center space-x-4 mb-4">
                          <span className="text-4xl">{getCountryFlag(country)}</span>
                          <div>
                            <h4 className="text-xl font-bold">{getCountryName(country)}</h4>
                            <p className="text-gray-600">Active compliance jurisdiction</p>
                          </div>
                        </div>
                        
                        <Divider className="my-4" />
                        
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span>Tax Rules:</span>
                            <Badge color="success" variant="flat">{taxRules.length} Active</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Reporting Rules:</span>
                            <Badge color="primary" variant="flat">{reportingRules.length} Required</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Compliance Score:</span>
                            <Badge 
                              color={summary.complianceScore >= 80 ? 'success' : summary.complianceScore >= 60 ? 'warning' : 'danger'} 
                              variant="flat"
                            >
                              {summary.complianceScore}%
                            </Badge>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    {/* Tax Rules Summary */}
                    <Card className="border border-gray-200">
                      <CardHeader>
                        <h3 className="text-lg font-semibold text-ghana-black">Active Tax Rules</h3>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          {getTaxBreakdown().map((tax, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium">{tax.name}</p>
                                <p className="text-sm text-gray-600 font-mono">{tax.glCode}</p>
                              </div>
                              <Badge color="success" variant="flat">
                                {tax.rate}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              </Tab>

              <Tab key="tax-calculator" title="🧮 Tax Calculator">
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h2 className="text-2xl font-bold text-ghana-black mb-6">Live Tax Calculator</h2>
                      <p className="text-gray-600 mb-6">
                        Test the auto compliance system with real-time tax calculations based on {getCountryName(country)}'s tax rules.
                      </p>
                      <Checkout 
                        subtotal={100}
                        onComplete={(total, taxes) => {
                          console.log('Payment completed:', { total, taxes });
                        }}
                      />
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-ghana-black mb-4">How it works:</h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="font-semibold text-blue-800 mb-2">1. Country Selection</h4>
                          <p className="text-blue-700 text-sm">Switch countries to automatically update tax rules and rates</p>
                        </div>
                        
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <h4 className="font-semibold text-green-800 mb-2">2. Automatic Calculation</h4>
                          <p className="text-green-700 text-sm">Taxes are calculated in real-time based on current country rules</p>
                        </div>
                        
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <h4 className="font-semibold text-purple-800 mb-2">3. GL Code Integration</h4>
                          <p className="text-purple-700 text-sm">Each tax includes proper accounting codes for seamless bookkeeping</p>
                        </div>
                        
                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                          <h4 className="font-semibold text-orange-800 mb-2">4. Transaction Recording</h4>
                          <p className="text-orange-700 text-sm">All transactions are automatically recorded for compliance reporting</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Tab>

              <Tab key="compliance-reports" title="📊 Compliance Reports">
                <div className="p-6">
                  <ComplianceReports />
                </div>
              </Tab>

              <Tab key="tax-builder" title="🔧 Tax Rate Builder">
                <div className="p-6">
                  <TaxRateBuilder />
                </div>
              </Tab>

              <Tab key="settings" title="⚙️ Settings">
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-ghana-black mb-6">Compliance Settings</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border border-gray-200">
                      <CardHeader>
                        <h3 className="text-lg font-semibold text-ghana-black">Automation Settings</h3>
                      </CardHeader>
                      <CardBody className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">Auto-calculate taxes</p>
                            <p className="text-sm text-gray-600">Automatically apply tax rules to all transactions</p>
                          </div>
                          <Button size="sm" color="success" variant="flat">Enabled</Button>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium">Auto-record transactions</p>
                          <Button size="sm" color="success" variant="flat">Enabled</Button>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium">Auto-update tax rates</p>
                          <Button size="sm" color="warning" variant="flat">Manual</Button>
                        </div>
                      </CardBody>
                    </Card>

                    <Card className="border border-gray-200">
                      <CardHeader>
                        <h3 className="text-lg font-semibold text-ghana-black">Integration Status</h3>
                      </CardHeader>
                      <CardBody className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span>Tax Rules API:</span>
                          <Badge color="success" variant="flat">Connected</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Reporting Rules API:</span>
                          <Badge color="success" variant="flat">Connected</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Transaction Store:</span>
                          <Badge color="success" variant="flat">Active</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Compliance Store:</span>
                          <Badge color="success" variant="flat">Active</Badge>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
