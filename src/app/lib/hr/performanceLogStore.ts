'use client';

import { create } from 'zustand';
import type { PerformanceLogEntry } from './performanceLog';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';
import { notifyError } from '../notifications/notify';
import { newId } from './newId';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

interface NewEntry {
  employeeId: string;
  /** YYYY-MM-DD */
  date: string;
  score: number;
  category: string;
  note: string;
  attachments: string[];
  recordedById?: string;
  recordedByName?: string;
}

interface PerformanceLogState {
  entries: PerformanceLogEntry[];
  addEntry: (input: NewEntry) => PerformanceLogEntry;
  /** The staff member's side of a (usually negative) entry. */
  respond: (id: string, response: string) => void;
  /** Entries are never deleted — a wrong one is voided with a reason. */
  voidEntry: (id: string, reason: string, by: string) => void;
  hydrateFromApi: () => Promise<void>;
}

const dateFields = ['date', 'respondedAt', 'voidedAt', 'createdAt', 'updatedAt'];
const toDates = (row: any): PerformanceLogEntry => {
  const out = { ...row };
  for (const f of dateFields) if (out[f]) out[f] = new Date(out[f]);
  return out;
};

export const usePerformanceLogStore = create<PerformanceLogState>((set, get) => {
  // Optimistic locally, then confirmed by the server. If the server refuses (no permission,
  // bad data) the screen must not keep showing an entry that was never saved.
  const save = async (entry: PerformanceLogEntry) => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/hr/performance-logs', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(entry) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        notifyError(body.error || 'The performance log entry could not be saved.', 'Not saved');
        await get().hydrateFromApi();
      }
    } catch {
      notifyError('Could not reach the server — the entry was not saved.', 'Not saved');
      await get().hydrateFromApi();
    }
  };

  const change = (id: string, patch: Partial<PerformanceLogEntry>) => {
    let updated: PerformanceLogEntry | undefined;
    set((s) => ({
      entries: s.entries.map((e) => {
        if (e.id !== id) return e;
        updated = { ...e, ...patch, updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) void save(updated);
  };

  return {
    entries: [],

    addEntry: (input) => {
      const entry: PerformanceLogEntry = {
        ...input,
        id: newId('pl_'),
        date: new Date(input.date),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      set((s) => ({ entries: [entry, ...s.entries] }));
      void save(entry);
      return entry;
    },

    respond: (id, response) => change(id, { employeeResponse: response.trim(), respondedAt: new Date() }),

    voidEntry: (id, reason, by) => change(id, { status: 'voided', voidedReason: reason.trim(), voidedBy: by, voidedAt: new Date() }),

    hydrateFromApi: async () => {
      if (typeof window === 'undefined') return;
      try {
        const res = await fetch('/api/hr/performance-logs', { headers: hrTenantHeaders(), cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.logs)) set({ entries: data.logs.map(toDates) });
      } catch (e) {
        console.warn('[HR] Failed to hydrate performance log from server:', e);
      }
    },
  };
});
