'use client';

import { useState } from 'react';

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
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <span className="mr-1 text-sm font-medium text-gray-500">📅 Date:</span>
      {(['all', 'today', 'specific', 'range'] as const).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onMode(key)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            mode === key
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600'
          }`}
        >
          {LABELS[key]}
        </button>
      ))}
      {mode === 'specific' && (
        <input
          type="date"
          aria-label="Specific date"
          value={single}
          onChange={(event) => onSingle(event.target.value)}
          className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      )}
      {mode === 'range' && (
        <div className="ml-2 flex items-center gap-2">
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(event) => onFrom(event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <span className="text-sm text-gray-400">→</span>
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(event) => onTo(event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      )}
    </div>
  );
}
