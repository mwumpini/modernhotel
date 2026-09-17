'use client';

import React from 'react';
import { getClientTenantSubdomain } from '../api/clientTenant';
import type { NightAuditLogDTO } from './nightAuditLogRepository';

function headers() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

/** History of night-audit runs (server cron + manual button) for this tenant. See /api/frontoffice/night-audit-log. */
export function useNightAuditLog() {
  const [logs, setLogs] = React.useState<NightAuditLogDTO[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/frontoffice/night-audit-log', { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      }
    } catch (e) {
      console.warn('[NightAuditLog] Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  }, []);

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
