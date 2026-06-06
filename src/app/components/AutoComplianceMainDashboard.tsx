'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Tabs, 
  Tab, 
  Chip,
  Tooltip,
  Divider
} from "@heroui/react";
import { useComplianceStore } from '../lib/compliance/store';
import { useSettingsStore } from '../lib/settings/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { trackEvent } from '../lib/analytics/trackEvent';


// Import specialized compliance components
import CountrySelector from './CountrySelector';
import ComplianceReports from './ComplianceReports';
import TaxRateBuilder from './TaxRateBuilder';
import PayrollBuilderPanel from './PayrollBuilderPanel';

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

export default function AutoComplianceMainDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const { country, taxRules, reportingRules, reports, transactions, getComplianceScore, isLoading, error } = useComplianceStore();
  const supportedCountries = useSettingsStore(s => s.supportedCountries);

  const today = new Date().toISOString().slice(0, 10);
  const isToday = (iso?: string) => !!iso && iso.slice(0, 10) === today;

  // Ghana Card verification is owned by Front Office. The front office store is a
  // non-reactive singleton, so sample it after mount to avoid SSR/hydration mismatch.
  const [guestIdStats, setGuestIdStats] = useState({ ghanaCards: 0, missing: 0 });
  useEffect(() => {
    const guests = frontOfficeStore.guests || [];
    setGuestIdStats({
      ghanaCards: guests.filter(g => g.idType === 'ghana_card' && g.idNumber).length,
      missing: guests.filter(g => !g.idNumber).length,
    });
  }, []);

  // All compliance figures are derived from live store data (tax rules, reporting
  // rules, report submissions and tax transactions) scoped to the active country.
  const metrics = useMemo(() => {
    const activeRules = taxRules.filter(r => r.countryCode === country);
    const countryReports = reports.filter(r => r.countryCode === country);
    const countryReportingRules = reportingRules.filter(r => r.countryCode === country);
    const countryTransactions = transactions.filter(t => t.countryCode === country);

    const submittedCount = (rs: typeof countryReports) =>
      rs.filter(r => r.status === 'submitted' || r.status === 'approved').length;
    const scoreOf = (rs: typeof countryReports) =>
      rs.length === 0 ? 100 : Math.round((submittedCount(rs) / rs.length) * 100);
    const byType = (type: string) => countryReports.filter(r => r.reportType === type).length;
    const isOverdue = (r: typeof countryReports[number]) =>
      r.status === 'pending' && new Date(r.dueDate) < new Date();

    const taxReportTypes = ['VAT', 'NHIL', 'Tourism', 'Hotel Tax', 'Sales Tax', 'IncomeTax'];
    const taxReports = countryReports.filter(r => taxReportTypes.includes(r.reportType));
    const recentlyUpdatedRules = countryReportingRules.filter(r => {
      const days = (Date.now() - new Date(r.lastUpdated).getTime()) / 86400000;
      return Number.isFinite(days) && days <= 30;
    });

    const taxCalculationsToday = countryTransactions.filter(t => isToday(t.timestamp)).length;
    const reportsGeneratedToday = countryReports.filter(r => isToday(r.submittedDate)).length;
    const overall = getComplianceScore();

    return {
      // Counts
      totalTaxRules: activeRules.length,
      activeComplianceChecks: countryReportingRules.filter(r => r.isActive).length,
      pendingAudits: countryReports.filter(r => r.status === 'pending').length,
      regulatoryUpdates: recentlyUpdatedRules.length,
      countriesSupported: supportedCountries.length,

      // Scores
      overallCompliance: overall,
      taxCompliance: scoreOf(taxReports),
      regulatoryCompliance: scoreOf(countryReports),
      auditCompliance: overall,
      vatCompliance: scoreOf(countryReports.filter(r => r.reportType === 'VAT')),
      taxReturns: taxReports.length,
      auditPassed: countryReports.every(r => r.status !== 'rejected'),

      // Risk indicators
      highRiskItems: countryReports.filter(r => r.status === 'rejected' || isOverdue(r)).length,
      mediumRiskItems: countryReports.filter(r => r.status === 'pending' && !isOverdue(r)).length,
      lowRiskItems: activeRules.filter(r => r.enabled === false).length,
      noRiskItems: activeRules.filter(r => r.enabled !== false).length + submittedCount(countryReports),

      // Today's operations
      taxCalculationsToday,
      reportsGeneratedToday,
      complianceChecksToday: taxCalculationsToday + reportsGeneratedToday,
      taxReturnsFiled: taxReports.filter(r => isToday(r.submittedDate)).length,
      regulatoryUpdatesApplied: countryReportingRules.filter(r => isToday(r.lastUpdated)).length,
      auditFindingsResolved: countryReports.filter(r => r.status === 'approved' && isToday(r.submittedDate)).length,

      // Regulatory report breakdown
      vatReports: byType('VAT'),
      nhilReports: byType('NHIL'),
      payeReports: byType('PAYE'),
      ssnitReports: byType('SSNIT'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxRules, reportingRules, reports, transactions, country, supportedCountries, getComplianceScore]);

  const {
    totalTaxRules,
    activeComplianceChecks,
    pendingAudits,
    regulatoryUpdates,
    countriesSupported,
    overallCompliance,
    taxCompliance,
    regulatoryCompliance,
    auditCompliance,
    highRiskItems,
    mediumRiskItems,
    lowRiskItems,
    noRiskItems,
    taxCalculationsToday,
    complianceChecksToday,
    reportsGeneratedToday,
    taxReturnsFiled,
    regulatoryUpdatesApplied,
    auditFindingsResolved,
  } = metrics;
  const newComplianceChecks = complianceChecksToday;

  // Operational items following the uniform pattern
  const operationalItems = [
    {
      category: 'Tax Management',
      items: [
        { title: 'Tax Rules Engine', icon: '📊', description: 'Automated tax calculation and rules', status: 'active', count: totalTaxRules },
        { title: 'Tax Calculations', icon: '💰', description: 'Real-time tax computation engine', status: 'active', count: taxCalculationsToday },
        { title: 'Tax Returns', icon: '📋', description: 'Automated tax return filing', status: 'active', count: taxReturnsFiled },
        { title: 'Tax Audits', icon: '🔍', description: 'Tax audit support and compliance', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Regulatory Compliance',
      items: [
        { title: 'Multi-Country Support', icon: '🌍', description: 'Ghana, Zimbabwe, US compliance', status: 'active', count: countriesSupported },
        { title: 'Regulatory Updates', icon: '📋', description: 'Latest compliance requirements', status: 'active', count: regulatoryUpdates },
        { title: 'Compliance Checks', icon: '⚖️', description: 'Automated compliance validation', status: 'active', count: complianceChecksToday },
        { title: 'Compliance Reports', icon: '📊', description: 'Regulatory reporting automation', status: 'active', count: reportsGeneratedToday },
      ]
    },
    {
      category: 'Risk Management',
      items: [
        { title: 'High Risk Items', icon: '🚨', description: 'Critical compliance issues', status: 'warning', count: highRiskItems },
        { title: 'Medium Risk Items', icon: '⚠️', description: 'Moderate compliance concerns', status: 'warning', count: mediumRiskItems },
        { title: 'Low Risk Items', icon: '🟡', description: 'Minor compliance notes', status: 'default', count: lowRiskItems },
        { title: 'No Risk Items', icon: '✅', description: 'Fully compliant areas', status: 'success', count: noRiskItems },
      ]
    },
    {
      category: 'Audit & Monitoring',
      items: [
        { title: 'Active Audits', icon: '🔍', description: 'Ongoing compliance audits', status: 'active', count: pendingAudits },
        { title: 'Audit Findings', icon: '📈', description: 'Audit results and resolutions', status: 'active', count: auditFindingsResolved },
        { title: 'Performance Metrics', icon: '📊', description: 'Compliance performance tracking', status: 'active', count: 0 },
        { title: 'Continuous Monitoring', icon: '🔄', description: 'Real-time compliance monitoring', status: 'active', count: activeComplianceChecks },
      ]
    }
  ];

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

  const handleQuickAction = (action: string) => {
    trackEvent('compliance.quick_action', { action });
    switch (action) {
      case 'compliance_check':
        setSelectedTab('checks');
        break;
      case 'tax_calculation':
        setSelectedTab('tax');
        break;
      case 'regulatory_update':
        setSelectedTab('regulatory');
        break;
      case 'audit_report':
        setSelectedTab('audit');
        break;
      case 'risk_assessment':
        setSelectedTab('risk');
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
                <p className="text-3xl font-bold text-ghana-green">{overallCompliance}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">Error: {error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Tax Compliance */}
          <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Tax Compliance</h4>
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-3">{taxCompliance}%</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>VAT Compliance</span>
                  <span className="font-medium">{metrics.vatCompliance}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax Returns</span>
                  <span className="font-medium">{metrics.taxReturns}</span>
                </div>
                <div className="flex justify-between">
                  <span>Audit Status</span>
                  <span className="font-medium">{metrics.auditPassed ? 'Passed' : 'Review'}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Regulatory Compliance */}
          <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Regulatory Compliance</h4>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-3">{regulatoryCompliance}%</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Countries Supported</span>
                  <span className="font-medium">{countriesSupported}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Rules</span>
                  <span className="font-medium">{totalTaxRules}</span>
                </div>
                <div className="flex justify-between">
                  <span>Updates Applied</span>
                  <span className="font-medium">{regulatoryUpdates}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Risk Management */}
          <Card className="border-0 shadow-lg border-l-4 border-l-purple-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Risk Management</h4>
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-3">{highRiskItems}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>High Risk Items</span>
                  <span className="font-medium">{highRiskItems}</span>
                </div>
                <div className="flex justify-between">
                  <span>Medium Risk</span>
                  <span className="font-medium">{mediumRiskItems}</span>
                </div>
                <div className="flex justify-between">
                  <span>Low Risk</span>
                  <span className="font-medium">{lowRiskItems}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Today's Compliance Operations */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚖️</span>
              <h4 className="text-lg font-semibold text-ghana-black">Today's Compliance Operations</h4>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">{newComplianceChecks} New Checks</span>
                <span className="text-gray-500">Initiated</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-medium">{taxReturnsFiled} Tax Returns</span>
                <span className="text-gray-500">Filed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 font-medium">{regulatoryUpdatesApplied} Updates</span>
                <span className="text-gray-500">Applied</span>
              </div>
            </div>
          </div>
          <Button 
            color="success" 
            variant="solid"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => handleQuickAction('compliance_check')}
          >
            🔍 Run Compliance Check
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
                onClick={() => handleQuickAction('compliance_check')}
              >
                <span className="text-2xl">🔍</span>
                <span className="font-medium">Compliance Check</span>
                <span className="text-xs text-center opacity-80">Run automated compliance check</span>
              </Button>
              <Button
                color="warning"
                variant="flat"
                className="h-24 flex flex-col items-center justify-center gap-2 p-4"
                onClick={() => handleQuickAction('tax_calculation')}
              >
                <span className="text-2xl">💰</span>
                <span className="font-medium">Tax Calculation</span>
                <span className="text-xs text-center opacity-80">Calculate tax for transactions</span>
              </Button>
              <Button
                color="danger"
                variant="flat"
                className="h-24 flex flex-col items-center justify-center gap-2 p-4"
                onClick={() => handleQuickAction('regulatory_update')}
              >
                <span className="text-2xl">📋</span>
                <span className="font-medium">Regulatory Update</span>
                <span className="text-xs text-center opacity-80">Apply regulatory changes</span>
              </Button>
              <Button
                color="primary"
                variant="flat"
                className="h-24 flex flex-col items-center justify-center gap-2 p-4"
                onClick={() => handleQuickAction('audit_report')}
              >
                <span className="text-2xl">📊</span>
                <span className="font-medium">Audit Report</span>
                <span className="text-xs text-center opacity-80">Generate audit report</span>
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
              aria-label="Compliance operations"
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
                                if (item.title.includes('Tax Rules Engine')) {
                                  setSelectedTab('tax');
                                } else if (item.title.includes('Multi-Country Support')) {
                                  setSelectedTab('regulatory');
                                } else if (item.title.includes('High Risk Items')) {
                                  setSelectedTab('risk');
                                } else if (item.title.includes('Active Audits')) {
                                  setSelectedTab('audit');
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
                                  color={item.status === 'active' ? 'success' : item.status === 'warning' ? 'warning' : 'default'}
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

              <Tab key="tax" title="💰 Tax Management">
                <div className="space-y-6 mt-4">
                  <h3 className="text-xl font-semibold text-ghana-black">Tax Management</h3>
                  <TaxRateBuilder />
                  <Divider className="my-4" />
                  <h3 className="text-xl font-semibold text-ghana-black">Payroll (PAYE) Management</h3>
                  <PayrollBuilderPanel />
                </div>
              </Tab>

              <Tab key="regulatory" title="📋 Regulatory Compliance">
                <div className="space-y-6 mt-4">
                  <h3 className="text-xl font-semibold text-ghana-black">Regulatory Compliance</h3>
                  
                  {/* Status Cards for Regulatory Compliance */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-lg font-semibold text-ghana-black">Tax Reports</h4>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                        <div className="text-3xl font-bold text-green-600 mb-3">{metrics.taxReturns}</div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>VAT Reports</span>
                            <span className="font-medium">{metrics.vatReports}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>NHIL Reports</span>
                            <span className="font-medium">{metrics.nhilReports}</span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card className="border-0 shadow-lg border-l-4 border-l-orange-500">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-lg font-semibold text-ghana-black">HR Compliance</h4>
                          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        </div>
                        <div className="text-3xl font-bold text-orange-600 mb-3">{metrics.payeReports + metrics.ssnitReports}</div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>PAYE Reports</span>
                            <span className="font-medium">{metrics.payeReports}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>SSNIT Reports</span>
                            <span className="font-medium">{metrics.ssnitReports}</span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card className="border-0 shadow-lg border-l-4 border-l-purple-500">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-lg font-semibold text-ghana-black">Ghana Cards</h4>
                          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        </div>
                        <div className="text-3xl font-bold text-purple-600 mb-3">{guestIdStats.ghanaCards}</div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Active Cards</span>
                            <span className="font-medium">{guestIdStats.ghanaCards}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Missing ID</span>
                            <span className="font-medium">{guestIdStats.missing}</span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  {/* Quick Actions for Regulatory Compliance */}
                  <div className="flex items-center gap-4">
                    <Button color="success" variant="solid" className="bg-green-600 hover:bg-green-700">
                      📄 Generate Report
                    </Button>
                    <Button color="primary" variant="flat">
                      🆔 Ghana Card Verification
                    </Button>
                    <Button color="warning" variant="flat">
                      📱 Mobile Money Integration
                    </Button>
                    <Button color="secondary" variant="flat">
                      ⚙️ Compliance Settings
                    </Button>
                  </div>

                  {/* Tax rates are managed in the Tax Management tab (single source: TaxRateBuilder) */}
                  <Card className="border border-dashed border-gray-300 shadow-none bg-gray-50">
                    <CardBody className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-ghana-black">Tax Rates</h4>
                        <p className="text-sm text-gray-600">VAT, NHIL, Tourism Levy, WHT and PAYE bands are configured in one place under Tax Management.</p>
                      </div>
                      <Button color="primary" variant="flat" onClick={() => setSelectedTab('tax')}>
                        Open Tax Management
                      </Button>
                    </CardBody>
                  </Card>
                </div>
              </Tab>

              <Tab key="risk" title="🚨 Risk Management">
                <div className="space-y-6 mt-4">
                  <h3 className="text-xl font-semibold text-ghana-black">Risk Management</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <h4 className="font-semibold">High Risk Items</h4>
                      </CardHeader>
                      <CardBody>
                        <p className="text-sm text-gray-600">Critical compliance issues requiring immediate attention</p>
                        <div className="mt-4">
                          <Badge color="danger" variant="flat" className="mr-2">{highRiskItems} High Risk</Badge>
                          <Badge color="warning" variant="flat" className="mr-2">{mediumRiskItems} Medium Risk</Badge>
                          <Badge color="default" variant="flat" className="mr-2">{lowRiskItems} Low Risk</Badge>
                        </div>
                      </CardBody>
                    </Card>
                    <Card>
                      <CardHeader>
                        <h4 className="font-semibold">Risk Assessment</h4>
                      </CardHeader>
                      <CardBody>
                        <p className="text-sm text-gray-600">Overall risk assessment and mitigation strategies</p>
                        <div className="mt-4">
                          <p className="text-sm text-gray-600">Overall Compliance: {((noRiskItems / (highRiskItems + mediumRiskItems + lowRiskItems + noRiskItems)) * 100).toFixed(1)}%</p>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              </Tab>

              <Tab key="audit" title="🔍 Audit & Monitoring">
                <div className="space-y-6 mt-4">
                  <h3 className="text-xl font-semibold text-ghana-black">Audit & Monitoring</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <h4 className="font-semibold">Audit Status</h4>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span>Active Audits:</span>
                            <Badge color="primary">{pendingAudits}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Findings Resolved:</span>
                            <Badge color="success">{auditFindingsResolved}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Compliance Score:</span>
                            <Badge color="success">{auditCompliance}%</Badge>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                    <Card>
                      <CardHeader>
                        <h4 className="font-semibold">Quick Actions</h4>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          <Button color="primary" variant="flat" className="w-full">
                            🔍 Start New Audit
                          </Button>
                          <Button color="secondary" variant="flat" className="w-full">
                            📊 Audit Reports
                          </Button>
                          <Button color="success" variant="flat" className="w-full">
                            ✅ Resolve Findings
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                  <ComplianceReports />
                </div>
              </Tab>

              <Tab key="checks" title="✅ Compliance Checks">
                <div className="space-y-6 mt-4">
                  <h3 className="text-xl font-semibold text-ghana-black">Compliance Checks</h3>
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-2xl font-semibold mb-2">Automated Compliance Checks</h3>
                    <p className="text-gray-600 mb-6">Run automated compliance checks across all systems</p>
                    <Button color="primary" onClick={() => handleQuickAction('compliance_check')}>Run Compliance Check</Button>
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
