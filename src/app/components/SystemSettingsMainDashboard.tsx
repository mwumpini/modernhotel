'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardBody,
  Button,
  Badge,
  Tabs,
  Tab,
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { useRouter } from 'next/navigation';
import RoomConfigurationDashboard from './RoomConfigurationDashboard';
import UserManagementUnified from './UserManagementUnified';
import NumberingSettingsPanel from './settings/NumberingSettingsPanel';
import DocumentTemplatesPanel from './settings/DocumentTemplatesPanel';
import AuditLogPanel from './settings/AuditLogPanel';
import ApprovalThresholdsPanel from './settings/ApprovalThresholdsPanel';
import ModulesPanel from './settings/ModulesPanel';
import StockLocationsPanel from './settings/StockLocationsPanel';
import SampleDataPanel from './settings/SampleDataPanel';
import SecurityPolicyPanel from './settings/SecurityPolicyPanel';
import OperationalPoliciesPanel from './settings/OperationalPoliciesPanel';
import CompanyYearPanel from './settings/CompanyYearPanel';
import { deskBookTabsClassNames } from './dashboard/deskTabsUi';
import { useSummaryCollapsed } from '../lib/dashboard/useSummaryCollapsed';
import { SummaryToggle } from './dashboard/SummaryToggle';

const VALID_TABS = ['users', 'rooms', 'policies', 'company-year', 'numbering', 'templates', 'locations', 'security', 'approvals', 'modules', 'sample-data', 'audit'] as const;
type SettingsTab = (typeof VALID_TABS)[number];

function resolveInitialTab(searchParams: URLSearchParams): SettingsTab {
  const fromUrl = searchParams.get('tab');
  if (fromUrl && VALID_TABS.includes(fromUrl as SettingsTab)) {
    return fromUrl as SettingsTab;
  }
  try {
    const stored = localStorage.getItem('settings.tab');
    if (stored && VALID_TABS.includes(stored as SettingsTab)) {
      localStorage.removeItem('settings.tab');
      return stored as SettingsTab;
    }
  } catch {}
  return 'users';
}

export default function SystemSettingsMainDashboard() {
  const searchParams = useSearchParams();
  const [selectedTab, setSelectedTab] = useState<SettingsTab>(() =>
    resolveInitialTab(searchParams)
  );
  const router = useRouter();
  const settings = useSettingsStore();
  const initialSetupCompleted = useSettingsStore((s) => s.initialSetupCompleted);
  const { collapsed: summaryCollapsed, toggle: toggleSummary } = useSummaryCollapsed('settings.summaryCollapsed');

  const userCount = settings.users.length;
  const roleCount = settings.roles.length;
  const roomCount = settings.roomManagement.rooms.length;
  const ratePlanCount = settings.roomManagement.ratePlans.length;

  useEffect(() => {
    const tab = resolveInitialTab(searchParams);
    setSelectedTab(tab);
  }, [searchParams]);

  useEffect(() => {
    const apply = () => {
      try {
        const stored = localStorage.getItem('settings.tab');
        if (stored && VALID_TABS.includes(stored as SettingsTab)) {
          localStorage.removeItem('settings.tab');
          setSelectedTab(stored as SettingsTab);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('settings-navigate', apply);
    return () => window.removeEventListener('settings-navigate', apply);
  }, []);

  const handleTabChange = (key: string) => {
    if (key === 'setup') {
      openSystemSetup();
      return;
    }
    if (!VALID_TABS.includes(key as SettingsTab)) return;
    setSelectedTab(key as SettingsTab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', key);
    router.replace(`?${params.toString()}`);
  };

  const openSystemSetup = () => {
    window.location.assign('/setup');
  };

  const openComplianceTax = () => {
    try {
      localStorage.setItem('compliance.tab', 'tax');
      window.dispatchEvent(new CustomEvent('compliance.openTab', { detail: { tab: 'tax' } }));
      window.dispatchEvent(new CustomEvent('app.navigate', { detail: { section: 'compliance' } }));
    } catch {}
  };

  return (
    <div className="p-6 space-y-3">
      {!initialSetupCompleted && (
        <Card className="border-0 shadow-lg border-l-4 border-l-amber-500 bg-amber-50">
          <CardBody className="flex items-center justify-between gap-3 py-3">
            <div>
              <h3 className="text-base font-semibold text-ghana-black">System Setup Required</h3>
              <p className="text-sm text-gray-700">
                Complete company, localization, tax, numbering, and security setup before going live.
              </p>
            </div>
            <Button color="warning" size="sm" className="bg-amber-500 text-white" onPress={openSystemSetup}>
              Open System Setup
            </Button>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-ghana-black">⚙️ System Settings</h2>
        <div className="flex flex-wrap gap-1.5 items-center">
          <SummaryToggle collapsed={summaryCollapsed} onToggle={toggleSummary} />
          {!summaryCollapsed && (
            <>
              <Badge variant="flat" color="primary" size="sm">{userCount} users</Badge>
              <Badge variant="flat" color="secondary" size="sm">{roleCount} roles</Badge>
              <Badge variant="flat" color="success" size="sm">{roomCount} rooms</Badge>
              <Badge variant="flat" color="warning" size="sm">{ratePlanCount} rate plans</Badge>
            </>
          )}
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardBody className="p-3 pt-2">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => handleTabChange(key as string)}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
          >
            <Tab key="users" title="Users & Roles">
              <UserManagementUnified />
            </Tab>

            <Tab key="rooms" title="Rooms & Pricing">
              <RoomConfigurationDashboard />
            </Tab>

            <Tab key="policies" title="Operational Policies">
              <OperationalPoliciesPanel />
            </Tab>

            <Tab key="company-year" title="Accounting year">
              <CompanyYearPanel />
            </Tab>

            <Tab key="numbering" title="Document Numbering">
              <NumberingSettingsPanel />
            </Tab>

            <Tab key="templates" title="Document Templates">
              <DocumentTemplatesPanel />
            </Tab>

            <Tab key="locations" title="Stock Locations">
              <StockLocationsPanel />
            </Tab>

            <Tab key="security" title="Security">
              <SecurityPolicyPanel onOpenSetup={openSystemSetup} onOpenTax={openComplianceTax} />
            </Tab>

            <Tab key="approvals" title="Approvals">
              <ApprovalThresholdsPanel />
            </Tab>

            <Tab key="modules" title="Modules">
              <ModulesPanel />
            </Tab>

            <Tab key="sample-data" title="Sample Data">
              <SampleDataPanel />
            </Tab>

            <Tab key="audit" title="Audit Log">
              <AuditLogPanel />
            </Tab>

            <Tab key="setup" title="System Setup" />
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
