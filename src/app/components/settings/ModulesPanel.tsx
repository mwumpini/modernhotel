'use client';

import React from 'react';
import { Card, CardBody, Switch } from '@heroui/react';
import { useSettingsStore, type ModuleSettings } from '../../lib/settings/store';
import { PAID_MODULES } from '../../lib/platform/hotelModules';

const HOTEL_SWITCHES: { key: keyof ModuleSettings; label: string; description: string }[] = [
  { key: 'kitchenTerminal', label: 'Kitchen screen', description: 'Shows the kitchen screen and Send to kitchen. Off: the till keeps the receipt and payment, and can still print a ticket.' },
  { key: 'analytics', label: 'Reports inside each menu', description: 'Off hides the reports item inside a menu. The menu itself stays.' },
  { key: 'security', label: 'Security', description: 'Incidents, patrols, and the security menu.' },
];

export default function ModulesPanel() {
  const modules = useSettingsStore((s) => s.moduleSettings);
  const paid = useSettingsStore((s) => s.paidModules);
  const updateModuleSettings = useSettingsStore((s) => s.updateModuleSettings);
  const canManage = useSettingsStore((s) => s.hasPermission('settings.edit') || s.hasPermission('settings.manage-modules') || s.hasPermission('settings.manage-security-policy'));
  const restaurantOn = paid.foodBeverage !== false;

  return (
    <div className="mt-2 max-w-3xl space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Modules</h3>
        <p className="text-xs text-gray-600">
          Paid areas are turned on by your provider. These switches only change how the hotel runs what it already has.
        </p>
      </div>

      <div className="space-y-2">
        {PAID_MODULES.map((mod) => {
          const on = paid[mod.key] !== false;
          return (
            <Card key={mod.key} className="shadow-none border border-gray-200">
              <CardBody className="flex flex-row items-center justify-between gap-3 px-3 py-2">
                <div>
                  <h4 className="text-sm font-medium">{mod.label}</h4>
                  <p className="text-xs text-gray-600">{on ? 'On' : 'Off'} · your provider changes this</p>
                </div>
                <Switch size="sm" isSelected={on} isDisabled aria-label={mod.label} />
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="space-y-2">
        {HOTEL_SWITCHES.map((mod) => {
          const locked = mod.key === 'kitchenTerminal' && !restaurantOn;
          return (
            <Card key={mod.key} className="shadow-none border border-gray-200">
              <CardBody className="flex flex-row items-center justify-between gap-3 px-3 py-2">
                <div>
                  <h4 className="text-sm font-medium">{mod.label}</h4>
                  <p className="text-xs text-gray-600">
                    {locked ? 'Comes on with Restaurant & bar.' : mod.description}
                  </p>
                </div>
                <Switch
                  size="sm"
                  isSelected={locked ? false : modules[mod.key] !== false}
                  onValueChange={(on) => updateModuleSettings({ [mod.key]: on })}
                  isDisabled={!canManage || locked}
                  aria-label={mod.label}
                />
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
