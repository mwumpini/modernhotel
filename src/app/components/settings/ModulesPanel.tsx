'use client';

import React from 'react';
import { Card, CardBody, Switch } from '@heroui/react';
import { useSettingsStore, type ModuleSettings } from '../../lib/settings/store';

const MODULES: { key: keyof ModuleSettings; label: string; description: string }[] = [
  { key: 'frontOffice', label: 'Front Office', description: 'Reservations, check-in, and the front desk menu.' },
  { key: 'foodBeverage', label: 'Restaurant, Bar, and Kitchen', description: 'Hides both the restaurant menu and the kitchen menu.' },
  { key: 'housekeeping', label: 'Housekeeping', description: 'The housekeeping menu stays if Maintenance is still on.' },
  { key: 'maintenance', label: 'Maintenance', description: 'Shares the housekeeping menu. Both switches off hides that menu.' },
  { key: 'inventory', label: 'Inventory & Stores', description: 'Stock, purchasing, and stores.' },
  { key: 'accounting', label: 'Accounting & Finance', description: 'Ledgers, invoices, and payments.' },
  { key: 'hr', label: 'HR & Payroll', description: 'Staff, attendance, and payroll.' },
  { key: 'security', label: 'Security Operations', description: 'Incidents, patrols, and the security menu.' },
  { key: 'compliance', label: 'Compliance & Reports', description: 'Tax rules and compliance filings.' },
  { key: 'analytics', label: 'Reports & Analysis', description: 'Hides the reports item inside each menu. The menus themselves stay.' },
];

export default function ModulesPanel() {
  const modules = useSettingsStore((s) => s.moduleSettings);
  const updateModuleSettings = useSettingsStore((s) => s.updateModuleSettings);
  const canManage = useSettingsStore((s) => s.hasPermission('settings.edit') || s.hasPermission('settings.manage-security-policy'));

  return (
    <div className="space-y-4 mt-4 max-w-3xl">
      <div>
        <h3 className="text-xl font-semibold">Modules</h3>
        <p className="text-sm text-gray-600">
          A switch that is off removes that area from the side menu. System Settings stays available so it can be turned back on.
        </p>
      </div>
      {MODULES.map((mod) => (
        <Card key={mod.key}>
          <CardBody className="flex flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-medium">{mod.label}</h4>
              <p className="text-sm text-gray-600">{mod.description}</p>
            </div>
            <Switch
              isSelected={modules[mod.key] !== false}
              onValueChange={(on) => updateModuleSettings({ [mod.key]: on })}
              isDisabled={!canManage}
              aria-label={mod.label}
            />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
