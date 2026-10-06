'use client';

import React from 'react';
import { Input } from '@heroui/react';
import { useSettingsStore } from '@/app/lib/settings/store';
import {
  financialYearContaining,
  financialYearCycleLabel,
  formatDayMonthYear,
  toIsoDate,
} from '@/app/lib/accounting/financialYear';

export default function CompanyYearPanel() {
  const yearStart = useSettingsStore((s) => s.companySettings?.financialYearStartDate || '');
  const updateNestedSetting = useSettingsStore((s) => s.updateNestedSetting);
  const canEdit = useSettingsStore((s) => {
    const roleId = s.sessionRoleId ?? s.currentUser?.roleId;
    return roleId === 'admin' || roleId === 'manager' || s.hasPermission('settings.manage-company-finance');
  });

  const open = financialYearContaining(new Date(), yearStart);
  const value = /^\d{4}-\d{2}-\d{2}/.test(yearStart) ? yearStart.slice(0, 10) : toIsoDate(open.start);

  return (
    <div className="max-w-xl space-y-4 py-2">
      <div>
        <h3 className="text-base font-semibold text-ghana-black">Accounting year</h3>
        <p className="text-sm text-gray-500">
          The month and day the books open each year. Reports, quarters, and filings that fall due after the year ends follow this date.
        </p>
      </div>
      <Input
        type="date"
        label="Year opens on"
        value={value}
        isDisabled={!canEdit}
        onChange={(e) => {
          const next = e.target.value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
          updateNestedSetting('companySettings.financialYearStartDate', next);
        }}
        description={`Each year runs ${financialYearCycleLabel(yearStart || value)}. The year open now ends ${formatDayMonthYear(open.end)}. The calendar year on the date is only a sample.`}
      />
      {!canEdit && (
        <p className="text-sm text-gray-500">An admin or a manager can change the opening day.</p>
      )}
      <p className="text-sm text-gray-500">
        Changing the opening day does not reopen a year that was already closed. Void that close entry under Changes in equity if the books need a correction.
      </p>
    </div>
  );
}
