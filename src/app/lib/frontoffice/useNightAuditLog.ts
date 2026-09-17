'use client';

import React from 'react';
import { getClientTenantSubdomain } from '../api/clientTenant';
import type { NightAuditLogDTO } from './nightAuditLogRepository';

function headers() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

/** History of night-audit runs (server cron + manual button) for this tenant. See /api/frontoffice/night-audit-log.
 * With no range: the last ~60 runs, for a "recent activity" widget. With
 * `range`, every run whose businessDate falls in it (e.g. Reports & Analysis
 * querying a specific past date or period) — refetches whenever the range
 * changes. */
export function useNightAuditLog(range?: { startDate: string; endDate: string }) {
  const [logs, setLogs] = React.useState<NightAuditLogDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const startDate = range?.startDate;
  const endDate = range?.endDate;

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
      const res = await fetch(`/api/frontoffice/night-audit-log${qs}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      }
    } catch (e) {
      console.warn('[NightAuditLog] Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const recordManualRun = React.useCallback(async (entry: {
    businessDate: string;
    roomChargesPosted: number;
    noShowsMarked: number;
    status?: 'completed' | 'failed';
    errors?: string[];
  }) => {
    try {
      await fetch('/api/frontoffice/night-audit-log', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(entry),
      });
    } catch (e) {
      console.warn('[NightAuditLog] Failed to record manual run:', e);
    } finally {
      await refresh();
    }
  }, [refresh]);

  return { logs, loading, refresh, recordManualRun };
}
