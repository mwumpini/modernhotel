'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardBody,
  Button,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tabs,
  Tab,
  useDisclosure,
} from '@heroui/react';
import { useComplianceStore } from '../lib/compliance/store';
import {
  DEFAULT_COMPLIANCE_TAB_LABELS,
  getComplianceTabLabels,
  setComplianceTabLabels,
} from '../lib/compliance/tabLabels';
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
  const { country, taxRules, reportingRules, reports, getComplianceScore, isLoading, error } =
    useComplianceStore();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [tabLabels, setTabLabels] = useState(DEFAULT_COMPLIANCE_TAB_LABELS);
  const [draftLabels, setDraftLabels] = useState(DEFAULT_COMPLIANCE_TAB_LABELS);

  useEffect(() => {
    void useComplianceStore.getState().syncCountryFromSetup();
    void useComplianceStore.getState().hydrateReportFilingsFromApi();
  }, []);

  useEffect(() => {
    const next = getComplianceTabLabels(country);
    setTabLabels(next);
    setDraftLabels(next);
  }, [country]);

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

    const submitted = reports.filter(
      (r) =>
        r.countryCode === country &&
        (r.status === 'submitted' || r.status === 'approved')
    ).length;

    return {
      taxRules: activeRules.length,
      reportingRules: activeReportingRules.length,
      taxReports: activeReportingRules.length,
      submitted,
      complianceScore: getComplianceScore(),
    };
  }, [taxRules, reportingRules, reports, country, getComplianceScore]);

  const openSettings = () => {
    try {
      localStorage.setItem('nav.section', 'settings');
      window.dispatchEvent(new CustomEvent('app.navigate', { detail: { section: 'settings' } }));
    } catch {}
  };

  const openRename = () => {
    setDraftLabels(tabLabels);
    onOpen();
  };

  const saveLabels = () => {
    const next = setComplianceTabLabels(country, draftLabels);
    setTabLabels(next);
    onClose();
  };

  const resetDraftToDefaults = () => {
    setDraftLabels({ ...DEFAULT_COMPLIANCE_TAB_LABELS });
  };

  return (
    <div className="p-6 space-y-5">
      {error && (
        <Card className={`border ${error.includes('default') ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
          <CardBody>
            <p className={`text-sm ${error.includes('default') ? 'text-amber-900' : 'text-red-800'}`}>{error}</p>
          </CardBody>
        </Card>
      )}

      <Card className="border border-slate-200 shadow-sm">
        <CardBody className="gap-4 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-ghana-black">Compliance &amp; Tax</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Country rates for invoices, rooms and payroll. Name the sections and the rates — Ghana starts with VAT and levies.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CountrySelector />
              <Button size="sm" variant="bordered" onPress={openSettings}>
                Rooms &amp; company
              </Button>
              <Button size="sm" variant="light" onPress={openRename}>
                Rename tabs
              </Button>
            </div>
          </div>
          <Divider />
          <div className="flex flex-wrap items-baseline divide-x divide-slate-200">
            <div className="flex items-baseline gap-2 px-4 first:pl-0">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tax rules</span>
              <span className="text-base font-bold text-slate-950">{metrics.taxRules}</span>
            </div>
            <div className="flex items-baseline gap-2 px-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filing schedules</span>
              <span className="text-base font-bold text-slate-950">{metrics.reportingRules}</span>
            </div>
            <div className="flex items-baseline gap-2 px-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filed</span>
              <span className="text-base font-bold text-slate-950">{metrics.complianceScore}%</span>
            </div>
            <div className="flex items-baseline gap-2 px-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted</span>
              <span className="text-base font-bold text-slate-950">{metrics.submitted}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="border border-slate-200 shadow-sm">
        <CardBody className="p-4 pt-2">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as ComplianceTab)}
            color="primary"
            variant="underlined"
            className="w-full"
            aria-label="Compliance"
            classNames={{ tabList: 'gap-6', cursor: 'w-full', tab: 'px-0 h-10' }}
          >
            <Tab key="tax" title={tabLabels.tax}>
              <div className="pt-4">
                <TaxRateBuilder />
              </div>
            </Tab>
            <Tab key="payroll" title={tabLabels.payroll}>
              <div className="pt-4">
                <PayrollBuilderPanel />
              </div>
            </Tab>
            <Tab key="reports" title={tabLabels.reports}>
              <div className="pt-4">
                <ComplianceReports />
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalContent>
          <ModalHeader>Name these sections</ModalHeader>
          <ModalBody>
            <p className="text-sm text-slate-600">
              Saved for this country. Rate names (VAT, GST, sales tax) stay on each rule — not on the tab.
            </p>
            <Input
              label="Sales & purchase rates"
              value={draftLabels.tax}
              onValueChange={(value) => setDraftLabels((prev) => ({ ...prev, tax: value }))}
              variant="bordered"
            />
            <Input
              label="Staff withholdings"
              value={draftLabels.payroll}
              onValueChange={(value) => setDraftLabels((prev) => ({ ...prev, payroll: value }))}
              variant="bordered"
            />
            <Input
              label="Statutory filings"
              value={draftLabels.reports}
              onValueChange={(value) => setDraftLabels((prev) => ({ ...prev, reports: value }))}
              variant="bordered"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={resetDraftToDefaults}>
              Use defaults
            </Button>
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
            <Button className="bg-ghana-green text-white" onPress={saveLabels}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {isLoading && (
        <p className="text-sm text-slate-500">Loading compliance data…</p>
      )}
    </div>
  );
}
