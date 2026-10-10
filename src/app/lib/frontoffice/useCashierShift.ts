'use client';

import React from 'react';
import { getClientTenantSubdomain } from '../api/clientTenant';
import type { CashierOutlet, CashierShiftDTO } from './cashierShiftRepository';

function headers() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

export type ShiftPreview = {
  totalCash: number;
  totalCard: number;
  totalMobileMoney: number;
  totalOther: number;
  totalPaidOut: number;
  expectedCash: number;
};

/** Cashier shifts for this tenant — till session (opening float, payments while
 * open, counted closing balance and variance). Outlet scopes FO vs Restaurant. */
export function useCashierShift(currentUserId?: string, outlet: CashierOutlet = 'frontoffice') {
  const [shifts, setShifts] = React.useState<CashierShiftDTO[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/frontoffice/cashier-shifts?outlet=${outlet}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setShifts(Array.isArray(data.shifts) ? data.shifts : []);
      }
    } catch (e) {
      console.warn('[Cashiering] Failed to load shifts:', e);
    } finally {
      setLoading(false);
    }
  }, [outlet]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const myOpenShift = React.useMemo(
    () => shifts.find((s) => s.status === 'open' && (!currentUserId || s.cashierUserId === currentUserId)) || null,
    [shifts, currentUserId]
  );

  const openShift = React.useCallback(async (openingFloat: number, notes?: string, businessDate?: string) => {
    const res = await fetch('/api/frontoffice/cashier-shifts', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ openingFloat, notes, outlet, businessDate }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) await refresh();
    return { ok: res.ok, error: data?.error, shift: data?.shift as CashierShiftDTO | undefined };
  }, [refresh, outlet]);

  const recordPaidOut = React.useCallback(async (
    id: string,
    paidOut: { amount: number; expenseCode: string; description: string },
  ) => {
    const res = await fetch(`/api/frontoffice/cashier-shifts/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ action: 'paid-out', ...paidOut }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) await refresh();
    return { ok: res.ok, error: data?.error as string | undefined, shift: data?.shift as CashierShiftDTO | undefined };
  }, [refresh]);

  const voidPaidOut = React.useCallback(async (id: string, paidOutId: string) => {
    const res = await fetch(`/api/frontoffice/cashier-shifts/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ action: 'void-paid-out', paidOutId }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) await refresh();
    return { ok: res.ok, error: data?.error as string | undefined, shift: data?.shift as CashierShiftDTO | undefined };
  }, [refresh]);

  const closeShift = React.useCallback(async (id: string, closingCount: number, notes?: string, momoDeclared?: number) => {
    const res = await fetch(`/api/frontoffice/cashier-shifts/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ action: 'close', closingCount, notes, momoDeclared }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) await refresh();
    return { ok: res.ok, error: data?.error, shift: data?.shift as CashierShiftDTO | undefined };
  }, [refresh]);

  const updateShift = React.useCallback(async (
    id: string,
    patch: {
      businessDate?: string;
      openingFloat?: number;
      closingCount?: number;
      momoDeclared?: number | null;
      notes?: string | null;
      recompute?: boolean;
      transferTo?: 'accounts' | 'cashier' | null;
      transferToName?: string | null;
      transferToUserId?: string | null;
      transferAmount?: number | null;
    },
  ) => {
    const res = await fetch(`/api/frontoffice/cashier-shifts/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ action: 'update', ...patch }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) await refresh();
    return { ok: res.ok, error: data?.error, shift: data?.shift as CashierShiftDTO | undefined };
  }, [refresh]);

  const deleteShift = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/frontoffice/cashier-shifts/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) await refresh();
    return { ok: res.ok, error: data?.error as string | undefined };
  }, [refresh]);

  const fetchPreview = React.useCallback(async (id: string): Promise<ShiftPreview | null> => {
    try {
      const res = await fetch(`/api/frontoffice/cashier-shifts/${id}`, { headers: headers() });
      if (!res.ok) return null;
      const data = await res.json();
      return (data?.preview as ShiftPreview) || null;
    } catch {
      return null;
    }
  }, []);

  return { shifts, myOpenShift, loading, openShift, closeShift, recordPaidOut, voidPaidOut, updateShift, deleteShift, fetchPreview, refresh };
}
