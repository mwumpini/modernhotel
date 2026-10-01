'use client';

import React from 'react';
import { getZonedClockParts } from '../frontoffice/propertyTime';
import { resolvePropertyTimezone } from '../frontoffice/propertyTimeClient';

/**
 * Per-module KPI period preference — same localStorage home as hide/show cards.
 * Snapshot KPIs (balances, rooms occupied) stay current-state; activity KPIs
 * (invoiced, orders, journals) filter to this window.
 */
export type DashboardPeriod = 'today' | 'month' | 'ytd' | 'all';

export const DASHBOARD_PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'month', label: 'This month' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'all', label: 'All time' },
];

const VALID = new Set<DashboardPeriod>(DASHBOARD_PERIOD_OPTIONS.map((o) => o.id));

export function periodShortLabel(period: DashboardPeriod): string {
  return DASHBOARD_PERIOD_OPTIONS.find((o) => o.id === period)?.label ?? period;
}

/** Hotel-local calendar day (YYYY-MM-DD), not browser/UTC. */
export function propertyTodayISO(now = new Date()): string {
  return getZonedClockParts(now, resolvePropertyTimezone()).date;
}

export function isoDay(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

/** Inclusive start/end for the period, or null when period is All time. */
export function getPeriodBounds(
  period: DashboardPeriod,
  todayISO: string = propertyTodayISO(),
): { start: string; end: string } | null {
  if (period === 'all') return null;
  if (period === 'today') return { start: todayISO, end: todayISO };
  const [y, m] = todayISO.split('-').map(Number);
  if (period === 'month') {
    return { start: `${y}-${String(m).padStart(2, '0')}-01`, end: todayISO };
  }
  return { start: `${y}-01-01`, end: todayISO };
}

export function isInPeriod(
  value: unknown,
  period: DashboardPeriod,
  todayISO: string = propertyTodayISO(),
): boolean {
  if (period === 'all') return true;
  const day = isoDay(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const bounds = getPeriodBounds(period, todayISO);
  if (!bounds) return true;
  return day >= bounds.start && day <= bounds.end;
}

/** Stay overlaps the Customize window (arrival ≤ end and departure ≥ start). */
export function stayOverlapsPeriod(
  arrival: unknown,
  departure: unknown,
  period: DashboardPeriod,
  todayISO: string = propertyTodayISO(),
): boolean {
  if (period === 'all') return true;
  const bounds = getPeriodBounds(period, todayISO);
  if (!bounds) return true;
  const a = isoDay(arrival);
  const d = isoDay(departure) || a;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a)) return false;
  return a <= bounds.end && d >= bounds.start;
}

/** Map Customize period onto the shared Events-style date filter controls. */
export function periodToDateFilter(period: DashboardPeriod, todayISO: string = propertyTodayISO()): {
  mode: 'all' | 'today' | 'specific' | 'range';
  single: string;
  from: string;
  to: string;
} {
  if (period === 'all') return { mode: 'all', single: '', from: '', to: '' };
  if (period === 'today') return { mode: 'today', single: '', from: '', to: '' };
  const bounds = getPeriodBounds(period, todayISO);
  return {
    mode: 'range',
    single: '',
    from: bounds?.start ?? '',
    to: bounds?.end ?? todayISO,
  };
}

export function useDashboardPeriod(
  storageKey: string,
  defaultPeriod: DashboardPeriod = 'today',
) {
  const [period, setPeriodState] = React.useState<DashboardPeriod>(defaultPeriod);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw && VALID.has(raw as DashboardPeriod)) {
        setPeriodState(raw as DashboardPeriod);
      } else {
        setPeriodState(defaultPeriod);
      }
    } catch {
      setPeriodState(defaultPeriod);
    } finally {
      setLoaded(true);
    }
  }, [storageKey, defaultPeriod]);

  // Keep sibling hooks on the same key in sync (Customize in parent, KPI strips in children).
  React.useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ key?: string; period?: DashboardPeriod }>).detail;
      if (!detail || detail.key !== storageKey) return;
      if (detail.period && VALID.has(detail.period)) setPeriodState(detail.period);
    };
    window.addEventListener('dashboard-period-change', onChange);
    return () => window.removeEventListener('dashboard-period-change', onChange);
  }, [storageKey]);

  const setPeriod = React.useCallback(
    (next: DashboardPeriod) => {
      if (!VALID.has(next)) return;
      setPeriodState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // ignore write failures
      }
      try {
        window.dispatchEvent(
          new CustomEvent('dashboard-period-change', { detail: { key: storageKey, period: next } }),
        );
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  const todayISO = propertyTodayISO();
  const bounds = React.useMemo(() => getPeriodBounds(period, todayISO), [period, todayISO]);

  return {
    period,
    setPeriod,
    defaultPeriod,
    loaded,
    todayISO,
    bounds,
    label: periodShortLabel(period),
    isDefault: period === defaultPeriod,
  };
}
