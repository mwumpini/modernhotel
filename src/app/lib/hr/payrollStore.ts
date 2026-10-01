import { create } from 'zustand';
import { PayrollPeriod, PayrollRecord } from './models';
import { useEmployeeStore } from './employeeStore';
import { useStaffDebtStore, readDebtRepayments } from './staffDebtStore';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';
import { notifyError } from '../notifications/notify';
import { newId } from './newId';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}
// New records store the department name / position title, but earlier runs stored the raw
// departmentId / positionId — show the real label for both, falling back to the stored value.
export function payrollRecordLabels(record: Pick<PayrollRecord, 'department' | 'position'>) {
  const emp = useEmployeeStore.getState();
  return {
    department: emp.getDepartment(record.department)?.name ?? record.department,
    position: emp.getPosition(record.position)?.title ?? record.position,
  };
}
// Optimistic locally, then confirmed by the server. Approving and paying are permission-gated
// there, so if it refuses the screen must go back to what is really saved.
//
// Saves for the same item are sent one after another, in the order they were made. A payroll
// run saves each period twice in quick succession (created, then given its totals); sent
// side by side they could land out of order and leave the period stuck at its first, empty state.
const saveQueues = new Map<string, Promise<unknown>>();
function postToApi(url: string, body: { id?: string }, what: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const key = `${url}:${body.id ?? ''}`;
  const previous = saveQueues.get(key) ?? Promise.resolve();
  const next = previous.then(async () => {
    try {
      const res = await fetch(url, { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notifyError(data.error || `The ${what} could not be saved.`, 'Not saved');
        await usePayrollStore.getState().hydrateFromApi();
        return false;
      }
      return true;
    } catch (e) {
      console.warn(`[HR] Failed to sync ${what} to server:`, e);
      notifyError(`Could not reach the server — the ${what} was not saved.`, 'Not saved');
      await usePayrollStore.getState().hydrateFromApi();
      return false;
    }
  });
  saveQueues.set(key, next);
  return next;
}
function syncPayrollPeriodToApi(period: PayrollPeriod) {
  return postToApi('/api/hr/payroll-periods', period, 'payroll period');
}
// Records changed in the same moment (a run creating every employee's record, or a bank batch
// being marked paid) are sent as ONE request.
let pendingRecords: Array<{ record: PayrollRecord; resolve: (ok: boolean) => void }> = [];
function flushRecords() {
  const batch = pendingRecords;
  pendingRecords = [];
  if (batch.length === 0) return;
  // A record belongs to a period in the database, so wait for any period save still in flight.
  const periodSaves = [...saveQueues.entries()].filter(([k]) => k.startsWith('/api/hr/payroll-periods')).map(([, p]) => p);
  void Promise.all(periodSaves)
    .then(() => postToApi('/api/hr/payroll-records', { id: 'batch', records: batch.map((b) => b.record) } as any, 'payroll records'))
    .then((ok) => batch.forEach((b) => b.resolve(ok)));
}
function syncPayrollRecordToApi(record: PayrollRecord): Promise<boolean> {
  return new Promise((resolve) => {
    pendingRecords.push({ record, resolve });
    if (pendingRecords.length === 1) setTimeout(flushRecords, 0);
  });
}

interface PayrollStore {
  payrollPeriods: PayrollPeriod[];
  payrollRecords: PayrollRecord[];

  createPayrollPeriod: (period: Omit<PayrollPeriod, 'id' | 'createdAt' | 'updatedAt'>) => PayrollPeriod;
  updatePayrollPeriod: (id: string, updates: Partial<PayrollPeriod>) => void;
  createPayrollRecord: (record: Omit<PayrollRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePayrollRecord: (id: string, updates: Partial<PayrollRecord>) => void;
  /** Removes a month that has not been approved yet (and its records, ledger draft and filing
   * hints, on the server). Resolves to whether the server did it. */
  deletePayrollPeriod: (id: string) => Promise<boolean>;

  /** Sign off a processed period. Needs the payroll-approval permission on the server, and
   * resolves to whether the server actually accepted it — callers gate side effects on that. */
  approvePeriod: (periodId: string, approver: string) => Promise<boolean>;
  /** Record that these payroll records (one bank/MoMo/cash batch, or the whole month) were paid on
   * `paidAt`. Once every record of an approved period is paid, the period itself becomes paid.
   * Resolves to whether the server accepted all of it. */
  markRecordsPaid: (periodId: string, recordIds: string[], paidAt: Date) => Promise<boolean>;

  hydrateFromApi: () => Promise<void>;
}

export const usePayrollStore = create<PayrollStore>((set, get) => ({
  // Empty initial state — hydrateFromApi() below replaces this with real data on mount.
  // Never seed with fake records: a slow/failed fetch must show an honest empty state,
  // not fabricated payroll history.
  payrollPeriods: [],

  payrollRecords: [],

  createPayrollPeriod: (period) => {
    const newPeriod: PayrollPeriod = {
      ...period,
      id: newId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set((state) => ({
      payrollPeriods: [...state.payrollPeriods, newPeriod]
    }));
    syncPayrollPeriodToApi(newPeriod);
    return newPeriod;
  },

  updatePayrollPeriod: (id, updates) => {
    let updated: PayrollPeriod | undefined;
    set((state) => ({
      payrollPeriods: state.payrollPeriods.map(period => {
        if (period.id !== id) return period;
        updated = { ...period, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncPayrollPeriodToApi(updated);
  },

  createPayrollRecord: (record) => {
    const newRecord: PayrollRecord = {
      ...record,
      id: newId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    set((state) => ({
      payrollRecords: [...state.payrollRecords, newRecord]
    }));
    syncPayrollRecordToApi(newRecord);
  },

  updatePayrollRecord: (id, updates) => {
    let updated: PayrollRecord | undefined;
    set((state) => ({
      payrollRecords: state.payrollRecords.map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, ...updates, updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) void syncPayrollRecordToApi(updated);
  },

  deletePayrollPeriod: async (id) => {
    if (typeof window === 'undefined') return false;
    try {
      const res = await fetch(`/api/hr/payroll-periods?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notifyError(data.error || 'The payroll month could not be deleted.', 'Not deleted');
        await get().hydrateFromApi();
        return false;
      }
      set((state) => ({
        payrollPeriods: state.payrollPeriods.filter((p) => p.id !== id),
        payrollRecords: state.payrollRecords.filter((r) => r.payrollPeriodId !== id),
      }));
      return true;
    } catch (e) {
      console.warn('[HR] Failed to delete payroll period:', e);
      notifyError('Could not reach the server — the month was not deleted.', 'Not deleted');
      return false;
    }
  },

  approvePeriod: (periodId, approver) => {
    let updated: PayrollPeriod | undefined;
    set((state) => ({
      payrollPeriods: state.payrollPeriods.map((p) => {
        if (p.id !== periodId || p.status === 'approved' || p.status === 'paid' || p.status === 'closed') return p;
        updated = { ...p, status: 'approved', approvedBy: approver, approvedAt: new Date(), updatedAt: new Date() };
        return updated;
      }),
    }));
    return updated ? syncPayrollPeriodToApi(updated) : Promise.resolve(false);
  },

  markRecordsPaid: async (periodId, recordIds, paidAt) => {
    const period = get().payrollPeriods.find((p) => p.id === periodId);
    // Payment follows approval — an unapproved run can't be paid.
    if (!period || (period.status !== 'approved' && period.status !== 'paid')) return false;
    const ids = new Set(recordIds);
    const changed: PayrollRecord[] = [];
    set((state) => ({
      payrollRecords: state.payrollRecords.map((r) => {
        if (r.payrollPeriodId !== periodId || !ids.has(r.id) || r.status === 'paid' || r.status === 'failed') return r;
        const next = { ...r, status: 'paid' as const, paidAt, updatedAt: new Date() };
        changed.push(next);
        return next;
      }),
    }));
    if (changed.length === 0) return true;

    // Debt installment was frozen on the record at prepare; remaining balance drops only once paid.
    for (const rec of changed) {
      const lines = readDebtRepayments(rec.notes);
      if (lines.length) useStaffDebtStore.getState().applyRepaymentsFromPayroll(rec.id, lines, paidAt);
    }

    // The period is paid once nothing in it is left unpaid.
    const remaining = get().payrollRecords.filter((r) => r.payrollPeriodId === periodId && r.status !== 'paid' && r.status !== 'failed');
    let updatedPeriod: PayrollPeriod | undefined;
    if (remaining.length === 0 && period.status !== 'paid') {
      set((state) => ({
        payrollPeriods: state.payrollPeriods.map((p) => {
          if (p.id !== periodId) return p;
          updatedPeriod = { ...p, status: 'paid', updatedAt: new Date() };
          return updatedPeriod;
        }),
      }));
    }
    // Records first, then the period, so the server sees them in the order they became true.
    const results = await Promise.all(changed.map(syncPayrollRecordToApi));
    const periodOk = updatedPeriod ? await syncPayrollPeriodToApi(updatedPeriod) : true;
    return periodOk && results.every(Boolean);
  },

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const headers = hrTenantHeaders();
      const dateFields = ['startDate', 'endDate', 'processedAt', 'approvedAt', 'paidAt', 'createdAt', 'updatedAt'];
      const toDates = (row: any) => {
        const out = { ...row };
        for (const f of dateFields) if (out[f]) out[f] = new Date(out[f]);
        return out;
      };
      const [periodsRes, recordsRes] = await Promise.all([
        fetch('/api/hr/payroll-periods', { headers, cache: 'no-store' }),
        fetch('/api/hr/payroll-records', { headers, cache: 'no-store' }),
      ]);
      if (periodsRes.ok) {
        const data = await periodsRes.json();
        if (Array.isArray(data.payrollPeriods)) {
          set({ payrollPeriods: data.payrollPeriods.map(toDates) });
        }
      }
      if (recordsRes.ok) {
        const data = await recordsRes.json();
        if (Array.isArray(data.payrollRecords)) {
          set({ payrollRecords: data.payrollRecords.map(toDates) });
        }
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate payroll periods/records from server:', e);
    }
  },
}));
