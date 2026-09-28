'use client';

import React from 'react';
import { Input, Select, SelectItem } from '@heroui/react';

export type EventsDateFilterMode = 'all' | 'today' | 'thisMonth' | 'monthToDate' | 'specific' | 'range';

export interface EventsStatusOption {
  key: string;
  label: string;
}

export interface EventsModuleFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  statusFilter?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: EventsStatusOption[];
  statusPlaceholder?: string;
  showDateFilter?: boolean;
  dateFilterMode?: EventsDateFilterMode;
  onDateFilterModeChange?: (mode: EventsDateFilterMode) => void;
  dateFilterSingle?: string;
  onDateFilterSingleChange?: (value: string) => void;
  dateFilterFrom?: string;
  onDateFilterFromChange?: (value: string) => void;
  dateFilterTo?: string;
  onDateFilterToChange?: (value: string) => void;
  extraFilters?: React.ReactNode;
  singleRow?: boolean;
}

const DATE_FILTER_OPTIONS: { key: EventsDateFilterMode; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'monthToDate', label: 'Month to date' },
  { key: 'specific', label: 'Specific date…' },
  { key: 'range', label: 'Date range…' },
  { key: 'all', label: 'All dates' },
];

export function getDateFilterDisplayLabel(
  mode: EventsDateFilterMode,
  single: string,
  from: string,
  to: string
): string {
  switch (mode) {
    case 'today':
      return 'Today';
    case 'thisMonth':
      return 'This month';
    case 'monthToDate':
      return 'MTD';
    case 'specific':
      return single || 'Specific date';
    case 'range':
      if (from && to) return `${from} → ${to}`;
      if (from || to) return from || to;
      return 'Date range';
    case 'all':
    default:
      return 'All dates';
  }
}

export function getEventsDateRangeBounds(
  mode: EventsDateFilterMode,
  single: string,
  from: string,
  to: string
): { from: string; to: string } | null {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  switch (mode) {
    case 'all':
      return null;
    case 'today':
      return { from: todayStr, to: todayStr };
    case 'thisMonth':
      return { from: monthStart, to: monthEnd };
    case 'monthToDate':
      return { from: monthStart, to: todayStr };
    case 'specific':
      return single ? { from: single, to: single } : null;
    case 'range':
      return from || to ? { from: from || to, to: to || from } : null;
    default:
      return null;
  }
}

export function matchesEventsDateFilter(
  dateValue: string | undefined | null,
  mode: EventsDateFilterMode,
  single: string,
  from: string,
  to: string
): boolean {
  if (mode === 'all') return true;

  const normalized = (dateValue || '').slice(0, 10);
  if (!normalized) return false;

  if (mode === 'today') {
    const today = new Date().toISOString().slice(0, 10);
    return normalized === today;
  }

  if (mode === 'thisMonth' || mode === 'monthToDate') {
    const bounds = getEventsDateRangeBounds(mode, single, from, to);
    if (!bounds) return true;
    return normalized >= bounds.from && normalized <= bounds.to;
  }

  if (mode === 'specific' && single) return normalized === single;
  if (mode === 'range' && (from || to)) {
    if (from && normalized < from) return false;
    if (to && normalized > to) return false;
    return true;
  }

  return true;
}

export function eventPrimaryDate(event: { arrivalDate?: string; startDate?: string; createdAt?: string }): string {
  return (event.arrivalDate || event.startDate || event.createdAt || '').slice(0, 10);
}

export default function EventsModuleFilters({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search events...',
  statusFilter,
  onStatusChange,
  statusOptions,
  statusPlaceholder = 'Status',
  showDateFilter = true,
  dateFilterMode = 'all',
  onDateFilterModeChange,
  dateFilterSingle = '',
  onDateFilterSingleChange,
  dateFilterFrom = '',
  onDateFilterFromChange,
  dateFilterTo = '',
  onDateFilterToChange,
  extraFilters,
  singleRow = false,
}: EventsModuleFiltersProps) {
  const showStatus = Boolean(onStatusChange && statusOptions && statusOptions.length > 0);
  const showDatePicker =
    showDateFilter &&
    onDateFilterModeChange &&
    (dateFilterMode === 'specific' || dateFilterMode === 'range');

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2">
      <div className={singleRow
        ? 'flex flex-nowrap items-center gap-2 overflow-x-auto'
        : 'flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center'
      }>
        <Input
          size="sm"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onValueChange={onSearchChange}
          className={singleRow ? 'min-w-[140px] flex-1' : 'w-full lg:flex-1 lg:min-w-[180px]'}
          aria-label={searchPlaceholder}
        />

        {showStatus && (
          <Select
            size="sm"
            aria-label={statusPlaceholder}
            placeholder={statusPlaceholder}
            selectedKeys={[statusFilter || 'all']}
            className={singleRow ? 'w-36 shrink-0' : 'w-full lg:w-40'}
            disallowEmptySelection
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              onStatusChange?.(value || 'all');
            }}
          >
            {statusOptions!.map((option) => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>
        )}

        {showDateFilter && onDateFilterModeChange && (
          <Select
            size="sm"
            aria-label="Date filter"
            selectedKeys={[dateFilterMode]}
            className={singleRow ? 'w-36 shrink-0' : 'w-full lg:w-44'}
            disallowEmptySelection
            renderValue={() => (
              <span className="text-sm">
                {getDateFilterDisplayLabel(dateFilterMode, dateFilterSingle, dateFilterFrom, dateFilterTo)}
              </span>
            )}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as EventsDateFilterMode;
              if (value) onDateFilterModeChange(value);
            }}
          >
            {DATE_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>
        )}

        {showDatePicker && dateFilterMode === 'specific' && onDateFilterSingleChange && (
          <input
            type="date"
            value={dateFilterSingle}
            onChange={(e) => onDateFilterSingleChange(e.target.value)}
            className="h-8 px-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Specific date"
          />
        )}

        {showDatePicker && dateFilterMode === 'range' && onDateFilterFromChange && onDateFilterToChange && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFilterFrom}
              onChange={(e) => onDateFilterFromChange(e.target.value)}
              className="h-8 px-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Date from"
            />
            <span className="text-gray-400 text-xs">→</span>
            <input
              type="date"
              value={dateFilterTo}
              onChange={(e) => onDateFilterToChange(e.target.value)}
              className="h-8 px-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Date to"
            />
          </div>
        )}

        {extraFilters && (
          <div className={singleRow ? 'contents' : 'w-full lg:w-auto lg:min-w-[200px] lg:flex-1'}>
            {extraFilters}
          </div>
        )}
      </div>
    </div>
  );
}
