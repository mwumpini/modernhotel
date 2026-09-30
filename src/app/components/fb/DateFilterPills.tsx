'use client';

import { useState } from 'react';
import { Select, SelectItem } from '@heroui/react';

export type DateMode = 'all' | 'today' | 'specific' | 'range';

export function localDayKey(value?: string | Date | null) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const when = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(when.getTime())) return '';
  const month = String(when.getMonth() + 1).padStart(2, '0');
  const day = String(when.getDate()).padStart(2, '0');
  return `${when.getFullYear()}-${month}-${day}`;
}

export function matchesDateFilter(
  value: string | Date | null | undefined,
  mode: DateMode,
  single: string,
  from: string,
  to: string,
) {
  if (mode === 'all') return true;
  const key = localDayKey(value ?? null);
  const today = localDayKey(new Date());
  if (mode === 'today') return key === today;
  if (mode === 'specific') return !single || key === single;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

export function useDateFilter() {
  const [mode, setMode] = useState<DateMode>('all');
  const [single, setSingle] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  return { mode, setMode, single, setSingle, from, setFrom, to, setTo };
}

const LABELS: Record<DateMode, string> = {
  all: 'All Dates',
  today: 'Today',
  specific: 'Specific Date',
  range: 'Date Range',
};

const DATE_OPTIONS: { key: DateMode; label: string }[] = [
  { key: 'all', label: 'All Dates' },
  { key: 'today', label: 'Today' },
  { key: 'specific', label: 'Specific Date' },
  { key: 'range', label: 'Date Range' },
];

function displayLabel(mode: DateMode, single: string, from: string, to: string) {
  if (mode === 'specific' && single) return single;
  if (mode === 'range' && (from || to)) return `${from || '…'} → ${to || '…'}`;
  return LABELS[mode];
}

export function DateFilterPills({
  mode,
  onMode,
  single,
  onSingle,
  from,
  onFrom,
  to,
  onTo,
}: {
  mode: DateMode;
  onMode: (mode: DateMode) => void;
  single: string;
  onSingle: (value: string) => void;
  from: string;
  onFrom: (value: string) => void;
  to: string;
  onTo: (value: string) => void;
}) {
  const showPicker = mode === 'specific' || mode === 'range';

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {/* Compact Select below lg / zoomed; chip bar on standard desktop */}
      <div className="w-[12.5rem] max-w-full shrink-0 lg:hidden">
        <Select
          size="sm"
          aria-label="Date filter"
          selectedKeys={[mode]}
          disallowEmptySelection
          className="w-full"
          renderValue={() => (
            <span className="text-sm">{displayLabel(mode, single, from, to)}</span>
          )}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as DateMode;
            if (value) onMode(value);
          }}
        >
          {DATE_OPTIONS.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
      </div>

      <div className="hidden min-w-0 flex-wrap items-center justify-end gap-2 lg:flex">
        <span className="mr-1 text-sm font-medium text-gray-500">📅 Date:</span>
        {DATE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onMode(option.key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              mode === option.key
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {showPicker && mode === 'specific' && (
        <input
          type="date"
          aria-label="Specific date"
          value={single}
          onChange={(event) => onSingle(event.target.value)}
          className="h-8 min-w-[min(100%,10rem)] flex-1 basis-[10rem] max-w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 sm:max-w-[12rem]"
        />
      )}
      {showPicker && mode === 'range' && (
        <div className="flex min-w-[min(100%,14rem)] flex-1 basis-[14rem] max-w-full flex-wrap items-center gap-1.5 sm:max-w-none">
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(event) => onFrom(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(event) => onTo(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      )}
    </div>
  );
}
