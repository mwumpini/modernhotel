'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardBody,
  Button,
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
import { useAccountingStore } from '../lib/accounting/store';
import { usePayrollStore } from '../lib/hr/payrollStore';
import {
  DEFAULT_COMPLIANCE_TAB_LABELS,
  getComplianceTabLabels,
  setComplianceTabLabels,
} from '../lib/compliance/tabLabels';
import CountrySelector from './CountrySelector';
import ComplianceReports from './ComplianceReports';
import TaxRateBuilder from './TaxRateBuilder';
import PayrollBuilderPanel from './PayrollBuilderPanel';
import { syncOpenSalesTaxFilings } from '../lib/compliance/salesFilingSync';
import { deskBookTabsClassNames } from './dashboard/deskTabsUi';
import { useSummaryCollapsed } from '../lib/dashboard/useSummaryCollapsed';
import { SummaryToggle } from './dashboard/SummaryToggle';

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
  const { collapsed: summaryCollapsed, toggle: toggleSummary } = useSummaryCollapsed('compliance.summaryCollapsed');
  const { country, taxRules, reportingRules, reports, getComplianceScore, isLoading, error } =
    useComplianceStore();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [tabLabels, setTabLabels] = useState(DEFAULT_COMPLIANCE_TAB_LABELS);
  const [draftLabels, setDraftLabels] = useState(DEFAULT_COMPLIANCE_TAB_LABELS);

  useEffect(() => {
    void (async () => {
      await useComplianceStore.getState().syncCountryFromSetup();
      await useComplianceStore.getState().hydrateReportFilingsFromApi();
      await Promise.all([
        useAccountingStore.getState().initializeAccounting().catch(() => {}),
        usePayrollStore.getState().hydrateFromApi().catch(() => {}),
      ]);
      syncOpenSalesTaxFilings();
    })();
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
        try { localStorage.removeItem('compliance.tab'); } catch {}
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
    <div className="p-6 space-y-3">
      {error && (
        <Card className={`border ${error.includes('default') ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
          <CardBody>
            <p className={`text-sm ${error.includes('default') ? 'text-amber-900' : 'text-red-800'}`}>{error}</p>
          </CardBody>
        </Card>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-ghana-black">⚖️ Compliance & Reports</h2>
        <div className="flex flex-wrap items-center gap-2">
          <SummaryToggle collapsed={summaryCollapsed} onToggle={toggleSummary} />
          <CountrySelector />
          <Button size="sm" variant="bordered" onPress={openSettings}>
            Rooms &amp; company
          </Button>
          <Button size="sm" variant="light" onPress={openRename}>
            Rename tabs
          </Button>
        </div>
      </div>

      {!summaryCollapsed && (
      <Card className="border border-slate-200 shadow-none">
        <CardBody className="px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-y-1 divide-x divide-slate-200">
            <div className="flex items-baseline gap-1.5 px-3 first:pl-0">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tax rules</span>
              <span className="text-sm font-bold tabular-nums text-slate-950">{metrics.taxRules}</span>
            </div>
            <div className="flex items-baseline gap-1.5 px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filing schedules</span>
              <span className="text-sm font-bold tabular-nums text-slate-950">{metrics.reportingRules}</span>
            </div>
            <div className="flex items-baseline gap-1.5 px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filed</span>
              <span className="text-sm font-bold tabular-nums text-slate-950">{metrics.complianceScore}%</span>
            </div>
            <div className="flex items-baseline gap-1.5 px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Submitted</span>
              <span className="text-sm font-bold tabular-nums text-slate-950">{metrics.submitted}</span>
            </div>
          </div>
        </CardBody>
      </Card>
      )}

      <Card className="border border-slate-200 shadow-sm">
        <CardBody className="p-3 pt-2">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as ComplianceTab)}
            size="sm"
            variant="solid"
            className="w-full"
            aria-label="Compliance"
            classNames={deskBookTabsClassNames}
          >
            <Tab key="tax" title={tabLabels.tax}>
              <div className="pt-2">
                <TaxRateBuilder />
              </div>
            </Tab>
            <Tab key="payroll" title={tabLabels.payroll}>
              <div className="pt-2">
                <PayrollBuilderPanel />
              </div>
            </Tab>
            <Tab key="reports" title={tabLabels.reports}>
              <div className="pt-2">
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
