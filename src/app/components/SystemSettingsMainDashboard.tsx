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
  Switch,
  Input,
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
import PosWaiterSwitchSetting from './settings/PosWaiterSwitchSetting';
import { deskBookTabsClassNames } from './dashboard/deskTabsUi';

const VALID_TABS = ['users', 'rooms', 'numbering', 'templates', 'locations', 'security', 'approvals', 'modules', 'sample-data', 'audit'] as const;
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
  const updateNestedSetting = useSettingsStore((s) => s.updateNestedSetting);
  const initialSetupCompleted = useSettingsStore((s) => s.initialSetupCompleted);
  const canManage2fa = settings.hasPermission('settings.manage-2fa');
  const canManageSecurityPolicy = settings.hasPermission('settings.manage-security-policy');

  const userCount = settings.users.length;
  const roleCount = settings.roles.length;
  const roomCount = settings.roomManagement.rooms.length;
  const ratePlanCount = settings.roomManagement.ratePlans.length;

  useEffect(() => {
    const tab = resolveInitialTab(searchParams);
    setSelectedTab(tab);
  }, [searchParams]);

  const handleTabChange = (key: string) => {
    if (!VALID_TABS.includes(key as SettingsTab)) return;
    setSelectedTab(key as SettingsTab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', key);
    router.replace(`?${params.toString()}`);
  };

  const openSystemSetup = () => router.replace('/setup');

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

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ghana-black">⚙️ System Settings</h2>
        <div className="flex flex-wrap gap-1.5 items-center">
          <Badge variant="flat" color="primary" size="sm">{userCount} users</Badge>
          <Badge variant="flat" color="secondary" size="sm">{roleCount} roles</Badge>
          <Badge variant="flat" color="success" size="sm">{roomCount} rooms</Badge>
          <Badge variant="flat" color="warning" size="sm">{ratePlanCount} rate plans</Badge>
        </div>
      </div>

      <Card className="border-0 shadow-sm bg-slate-50">
        <CardBody className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-2.5 px-3">
          <div>
            <p className="text-sm font-medium text-ghana-black">Related configuration (not in this screen)</p>
            <p className="text-xs text-gray-600">
              VAT, NHIL, GETFund, and Tourism Levy are managed under Compliance — they drive all invoice and room tax calculations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="flat" color="primary" onPress={openSystemSetup}>
              Company &amp; localization → Setup
            </Button>
            <Button size="sm" variant="flat" color="secondary" onPress={openComplianceTax}>
              Tax rules → Compliance
            </Button>
          </div>
        </CardBody>
      </Card>

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
              <div className="mt-2 max-w-2xl space-y-2">
                <p className="text-xs text-gray-600">
                  Password and session rules apply to all staff accounts. Company name, country, and currency are in{' '}
                  <Button size="sm" variant="light" className="inline h-auto min-h-0 p-0 align-baseline text-xs" onPress={openSystemSetup}>
                    System Setup
                  </Button>
                  . Tax rates (VAT, NHIL, levies) are in{' '}
                  <Button size="sm" variant="light" className="inline h-auto min-h-0 p-0 align-baseline text-xs" onPress={openComplianceTax}>
                    Compliance → Tax rules
                  </Button>.
                </p>
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div>
                    <h4 className="text-sm font-medium">Two-Factor Authentication</h4>
                    <p className="text-xs text-gray-600">Sign-in asks every staff member for a code from an authenticator app</p>
                  </div>
                  <Switch
                    size="sm"
                    isSelected={settings.security.twoFactorAuth}
                    onValueChange={(v) => updateNestedSetting('security.twoFactorAuth', v)}
                    isDisabled={!canManage2fa}
                  />
                </div>
                <PosWaiterSwitchSetting isDisabled={!canManageSecurityPolicy} />
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div>
                    <h4 className="text-sm font-medium">Session Timeout</h4>
                    <p className="text-xs text-gray-600">Auto-logout after inactivity (minutes)</p>
                  </div>
                  <Input
                    type="number"
                    size="sm"
                    className="max-w-[100px]"
                    value={String(settings.security.sessionTimeout)}
                    onChange={(e) => updateNestedSetting('security.sessionTimeout', Number(e.target.value))}
                    isDisabled={!canManageSecurityPolicy}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div>
                    <h4 className="text-sm font-medium">Password Minimum Length</h4>
                    <p className="text-xs text-gray-600">Minimum characters required for passwords</p>
                  </div>
                  <Input
                    type="number"
                    size="sm"
                    className="max-w-[100px]"
                    value={String(settings.security.passwordPolicy.minLength)}
                    onChange={(e) => updateNestedSetting('security.passwordPolicy.minLength', Number(e.target.value))}
                    isDisabled={!canManageSecurityPolicy}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div>
                    <h4 className="text-sm font-medium">Password Expiry</h4>
                    <p className="text-xs text-gray-600">Days before passwords must be changed (0 = never)</p>
                  </div>
                  <Input
                    type="number"
                    size="sm"
                    className="max-w-[100px]"
                    value={String(settings.security.passwordPolicy.expiryDays)}
                    onChange={(e) => updateNestedSetting('security.passwordPolicy.expiryDays', Number(e.target.value))}
                    isDisabled={!canManageSecurityPolicy}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div>
                    <h4 className="text-sm font-medium">Require Uppercase Letters</h4>
                    <p className="text-xs text-gray-600">Passwords must include uppercase</p>
                  </div>
                  <Switch
                    size="sm"
                    isSelected={settings.security.passwordPolicy.requireUppercase}
                    onValueChange={(v) => updateNestedSetting('security.passwordPolicy.requireUppercase', v)}
                    isDisabled={!canManageSecurityPolicy}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div>
                    <h4 className="text-sm font-medium">Require Lowercase Letters</h4>
                    <p className="text-xs text-gray-600">Passwords must include lowercase</p>
                  </div>
                  <Switch
                    size="sm"
                    isSelected={settings.security.passwordPolicy.requireLowercase}
                    onValueChange={(v) => updateNestedSetting('security.passwordPolicy.requireLowercase', v)}
                    isDisabled={!canManageSecurityPolicy}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div>
                    <h4 className="text-sm font-medium">Require Numbers</h4>
                    <p className="text-xs text-gray-600">Passwords must include digits</p>
                  </div>
                  <Switch
                    size="sm"
                    isSelected={settings.security.passwordPolicy.requireNumbers}
                    onValueChange={(v) => updateNestedSetting('security.passwordPolicy.requireNumbers', v)}
                    isDisabled={!canManageSecurityPolicy}
                  />
                </div>
              </div>
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
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
