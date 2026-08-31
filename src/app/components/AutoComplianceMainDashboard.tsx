'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardBody,
  Button,
  Badge,
  Tabs,
  Tab,
} from '@heroui/react';
import { useComplianceStore } from '../lib/compliance/store';
import CountrySelector from './CountrySelector';
import ComplianceReports from './ComplianceReports';
import TaxRateBuilder from './TaxRateBuilder';
import PayrollBuilderPanel from './PayrollBuilderPanel';

const VALID_TABS = ['tax', 'payroll', 'reports'] as const;
type ComplianceTab = (typeof VALID_TABS)[number];

function resolveInitialTab(): ComplianceTab {
  try {
    const stored = localStorage.getItem('compliance.tab');
    if (stored === 'tax' || stored === 'payroll' || stored === 'reports') {
      localStorage.removeItem('compliance.tab');
      return stored;
    }
    // Legacy tabs from the old dashboard
    if (stored === 'regulatory' || stored === 'audit') {
      localStorage.removeItem('compliance.tab');
      return 'reports';
    }
    if (stored) {
      localStorage.removeItem('compliance.tab');
    }
  } catch {}
  return 'tax';
}

export default function AutoComplianceMainDashboard() {
  const [selectedTab, setSelectedTab] = useState<ComplianceTab>(resolveInitialTab);
  const { country, taxRules, reportingRules, getComplianceScore, isLoading, error } =
    useComplianceStore();

  useEffect(() => {
    void useComplianceStore.getState().syncCountryFromSetup();
  }, []);

  useEffect(() => {
    const handler = (ev: Event) => {
      const tab = (ev as CustomEvent<{ tab?: string }>).detail?.tab;
      if (tab === 'tax' || tab === 'payroll' || tab === 'reports') {
        setSelectedTab(tab);
      }
    };
    window.addEventListener('compliance.openTab', handler);
    return () => window.removeEventListener('compliance.openTab', handler);
  }, []);

  const metrics = useMemo(() => {
    const activeRules = taxRules.filter((r) => r.countryCode === country);
    const activeReportingRules = reportingRules.filter(
      (r) => r.countryCode === country && r.isActive !== false
    );

    return {
      taxRules: activeRules.length,
      reportingRules: activeReportingRules.length,
      taxReports: activeReportingRules.length,
      complianceScore: getComplianceScore(),
    };
  }, [taxRules, reportingRules, country, getComplianceScore]);

  const openSettings = () => {
    try {
      localStorage.setItem('nav.section', 'settings');
      window.dispatchEvent(new CustomEvent('app.navigate', { detail: { section: 'settings' } }));
    } catch {}
  };

  return (
    <div className="p-6">
      {error && (
        <Card className={`mb-6 border ${error.includes('default') ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
          <CardBody>
            <p className={`text-sm ${error.includes('default') ? 'text-amber-900' : 'text-red-800'}`}>{error}</p>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">Compliance &amp; Tax</h2>
          <p className="text-sm text-gray-600 mt-1">
            Tax rules, payroll bands, and regulatory reporting — rates here drive invoices, room pricing, and accounting
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CountrySelector />
          <Badge variant="flat" color="primary">{metrics.taxRules} tax rules</Badge>
          <Badge variant="flat" color="secondary">{metrics.reportingRules} report schedules</Badge>
          <Badge variant="flat" color="success">{metrics.complianceScore}% filed</Badge>
        </div>
      </div>

      <Card className="mb-6 border-0 shadow-md bg-slate-50">
        <CardBody className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-4">
          <div>
            <p className="text-sm font-medium text-ghana-black">Related configuration (not in this screen)</p>
            <p className="text-xs text-gray-600 mt-1">
              Room prices and company details are managed under Settings and System Setup — not here.
            </p>
          </div>
          <Button size="sm" variant="flat" color="primary" onPress={openSettings}>
            Rooms &amp; company → Settings
          </Button>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardBody>
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as ComplianceTab)}
            className="w-full"
            aria-label="Compliance"
          >
            <Tab key="tax" title="Tax Management">
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-4">
                  Configure tax rules and GL mapping for the selected country. Changes sync to accounting and tax calculations across the system.
                </p>
                <TaxRateBuilder />
              </div>
            </Tab>

            <Tab key="payroll" title="Income Taxes">
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-4">
                  Payroll tax bands and statutory deductions for the selected country — separate from sales tax rules.
                </p>
                <PayrollBuilderPanel />
              </div>
            </Tab>

            <Tab key="reports" title="Reports &amp; Filing">
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-4">
                  Filing schedules and submission tracking for the selected country.
                </p>
                <ComplianceReports />
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {isLoading && (
        <p className="text-sm text-gray-500 mt-4">Loading compliance data…</p>
      )}
    </div>
  );
}
