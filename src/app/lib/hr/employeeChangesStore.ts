'use client';

import { create } from 'zustand';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

export type EmployeeChangeType =
  | 'promotion'
  | 'transfer'
  | 'salary_change'
  | 'status_change'
  | 'department_change'
  | 'position_change'
  | 'profile_update';

export interface EmployeeChange {
  id: string;
  employeeId: string;
  employeeName?: string;
  type: EmployeeChangeType;
  field?: string;
  previousValue?: string | number | null;
  newValue?: string | number | null;
  changedBy?: string;
  notes?: string;
  timestamp: Date;
}

function syncChangeToApi(change: EmployeeChange) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/employee-changes', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(change) })
    .catch((e) => console.warn('[HR] Failed to sync employee change to server:', e));
}

interface EmployeeChangesState {
  changes: EmployeeChange[];

  logChange: (change: Omit<EmployeeChange, 'id'>) => EmployeeChange;
  getRecentChanges: (days?: number) => EmployeeChange[];
  getChangesByEmployee: (employeeId: string) => EmployeeChange[];
  clearChanges: () => void;

  // Persistence — pulls the real change log from the database.
  hydrateFromApi: () => Promise<void>;
}

export const useEmployeeChangesStore = create<EmployeeChangesState>((set, get) => ({
  changes: [],

  logChange: (change) => {
    const entry: EmployeeChange = { ...change, id: `chg_${Date.now()}` };
    console.log('[HR][ChangeLog] logChange', entry);
    set((state) => ({ changes: [entry, ...state.changes] }));
    syncChangeToApi(entry);
    return entry;
  },

  getRecentChanges: (days = 30) => {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    return get().changes.filter((c) => c.timestamp.getTime() >= since);
  },

  getChangesByEmployee: (employeeId) => get().changes.filter((c) => c.employeeId === employeeId),

  clearChanges: () => set({ changes: [] }),

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/hr/employee-changes', { headers: hrTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.changes)) {
        set({ changes: data.changes.map((row: any) => ({ ...row, timestamp: new Date(row.timestamp) })) });
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate employee changes from server:', e);
    }
  },
}));
