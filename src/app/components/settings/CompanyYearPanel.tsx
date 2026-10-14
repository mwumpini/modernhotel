'use client';

import React from 'react';
import { Select, SelectItem } from '@heroui/react';
import { useSettingsStore } from '@/app/lib/settings/store';
import {
  financialYearAnchor,
  financialYearContaining,
  formatDayMonthYear,
  toIsoDate,
} from '@/app/lib/accounting/financialYear';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
// February stops at 28 so the opening day exists every year.
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * The books open on a day and month each year; the year itself is never asked for.
 * The setting is still saved as a full date (the start of the year now open) because
 * reports, quarters and filing due dates read it that way.
 */
export default function CompanyYearPanel({ bare = false }: { bare?: boolean } = {}) {
  const yearStart = useSettingsStore((s) => s.companySettings?.financialYearStartDate || '');
  const updateNestedSetting = useSettingsStore((s) => s.updateNestedSetting);
  const canEdit = useSettingsStore((s) => {
    const roleId = s.sessionRoleId ?? s.currentUser?.roleId;
    return roleId === 'admin' || roleId === 'manager' || s.hasPermission('settings.manage-company-finance');
  });

  const anchor = financialYearAnchor(yearStart);
  const open = financialYearContaining(new Date(), yearStart);
  const nextStart = new Date(open.end.getFullYear(), open.end.getMonth(), open.end.getDate() + 1);
  const calendarYear = anchor.month === 1 && anchor.day === 1;

  const save = (month: number, day: number) => {
    const safeDay = Math.min(day, DAYS_IN_MONTH[month - 1]);
    const probe = `2000-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
    const start = financialYearContaining(new Date(), probe).start;
    updateNestedSetting('companySettings.financialYearStartDate', toIsoDate(start));
  };

  return (
    <div className={bare ? 'max-w-xl space-y-4' : 'max-w-xl space-y-4 py-2'}>
      {!bare && (
        <div>
          <h3 className="text-base font-semibold text-ghana-black">Accounting year</h3>
          <p className="text-sm text-gray-500">
            The day the books open each year. Reports, quarters, and filings due after the year ends follow it.
          </p>
        </div>
      )}

      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Select
          label="Day"
          size="sm"
          variant="bordered"
          isDisabled={!canEdit}
          selectedKeys={[String(anchor.day)]}
          onSelectionChange={(keys) => {
            const day = Number(Array.from(keys)[0]);
            if (day) save(anchor.month, day);
          }}
        >
          {Array.from({ length: DAYS_IN_MONTH[anchor.month - 1] }, (_, i) => (
            <SelectItem key={String(i + 1)}>{String(i + 1)}</SelectItem>
          ))}
        </Select>
        <Select
          label="Month"
          size="sm"
          variant="bordered"
          isDisabled={!canEdit}
          selectedKeys={[String(anchor.month)]}
          onSelectionChange={(keys) => {
            const month = Number(Array.from(keys)[0]);
            if (month) save(month, anchor.day);
          }}
        >
          {MONTHS.map((name, i) => (
            <SelectItem key={String(i + 1)}>{name}</SelectItem>
          ))}
        </Select>
      </div>

      <div className="rounded-lg border border-default-200 bg-default-50 px-4 py-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-gray-500">Current year</span>
          <span className="font-semibold text-ghana-black">
            {formatDayMonthYear(open.start)} – {formatDayMonthYear(open.end)} <span className="font-normal text-green-700">(open)</span>
          </span>
        </div>
        <div className="mt-1 flex flex-wrap justify-between gap-2">
          <span className="text-gray-500">Next year starts</span>
          <span className="text-ghana-black">{formatDayMonthYear(nextStart)}</span>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        {calendarYear
          ? 'Most Ghana businesses use January to December, the same as the GRA tax year.'
          : 'This differs from January to December, the GRA tax year.'}{' '}
        Changing it is unusual and normally needs GRA&rsquo;s agreement, so check with your accountant first.
      </p>
      {!canEdit && (
        <p className="text-sm text-gray-500">An admin or a manager can change the opening day.</p>
      )}
      <p className="text-sm text-gray-500">
        Changing the opening day does not reopen a year that was already closed. Void that close entry under Changes in equity if the books need a correction.
      </p>
    </div>
  );
}
