'use client';

import React from 'react';
import { getClientTenantSubdomain } from '../api/clientTenant';
import type { CashierShiftDTO } from './cashierShiftRepository';

function headers() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

/** Cashier shifts for this tenant — a front-desk agent's till session (opening
 * float, real payments they processed while open, counted closing balance and
 * variance). See /api/frontoffice/cashier-shifts. */
export function useCashierShift(currentUserId?: string) {
  const [shifts, setShifts] = React.useState<CashierShiftDTO[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/frontoffice/cashier-shifts', { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setShifts(Array.isArray(data.shifts) ? data.shifts : []);
      }
    } catch (e) {
      console.warn('[Cashiering] Failed to load shifts:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const myOpenShift = React.useMemo(
    () => shifts.find((s) => s.status === 'open' && (!currentUserId || s.cashierUserId === currentUserId)) || null,
    [shifts, currentUserId]
  );

  const openShift = React.useCallback(async (openingFloat: number, notes?: string) => {
    const res = await fetch('/api/frontoffice/cashier-shifts', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ openingFloat, notes }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) await refresh();
    return { ok: res.ok, error: data?.error, shift: data?.shift as CashierShiftDTO | undefined };
  }, [refresh]);

  const closeShift = React.useCallback(async (id: string, closingCount: number, notes?: string) => {
    const res = await fetch(`/api/frontoffice/cashier-shifts/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ closingCount, notes }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) await refresh();
    return { ok: res.ok, error: data?.error, shift: data?.shift as CashierShiftDTO | undefined };
  }, [refresh]);

  return { shifts, myOpenShift, loading, openShift, closeShift, refresh };
}
