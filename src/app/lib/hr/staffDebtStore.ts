'use client';

import { create } from 'zustand';
import type { StaffDebt, StaffDebtRepayment, StaffDebtStatus, StaffDebtType } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';
import { newId } from './newId';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

function syncDebtToApi(debt: StaffDebt) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/staff-debts', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(debt) })
    .catch((e) => console.warn('[HR] Failed to sync staff debt to server:', e));
}

function deleteDebtFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/hr/staff-debts?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() })
    .catch((e) => console.warn('[HR] Failed to delete staff debt on server:', e));
}

function syncRepaymentToApi(repayment: StaffDebtRepayment) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/staff-debts', {
    method: 'POST',
    headers: hrTenantHeaders(),
    body: JSON.stringify({ ...repayment, _kind: 'repayment' }),
  }).catch((e) => console.warn('[HR] Failed to sync staff debt repayment to server:', e));
}

export type DebtInstallmentLine = { debtId: string; amount: number; type: StaffDebtType; reason?: string };

/** First payroll month (1–12) that may take an installment: issue month + graceMonths. */
export function repaymentStartYm(issuedDate: Date | string, graceMonths = 0): { year: number; month: number } {
  const issued = issuedDate instanceof Date ? issuedDate : new Date(issuedDate);
  const grace = Math.max(0, Math.floor(Number(graceMonths) || 0));
  const start = new Date(issued.getFullYear(), issued.getMonth() + grace, 1);
  return { year: start.getFullYear(), month: start.getMonth() + 1 };
}

export function isDebtRepaymentDue(
  debt: Pick<StaffDebt, 'issuedDate' | 'graceMonths'>,
  year: number,
  month: number,
): boolean {
  const start = repaymentStartYm(debt.issuedDate, debt.graceMonths ?? 0);
  return year * 12 + month >= start.year * 12 + start.month;
}

/** Frozen installment lines written onto a payroll record's notes at prepare time. */
export function readDebtRepayments(notes?: string): DebtInstallmentLine[] {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    return Array.isArray(parsed?.debtRepayments) ? parsed.debtRepayments.filter((l: any) => l && l.debtId && Number(l.amount) > 0) : [];
  } catch {
    return [];
  }
}

interface StaffDebtState {
  debts: StaffDebt[];
  repayments: StaffDebtRepayment[];

  issueDebt: (input: {
    employeeId: string;
    type: StaffDebtType;
    originalAmount: number;
    monthlyInstallment: number;
    graceMonths?: number;
    reason?: string;
    issuedDate?: Date;
    notes?: string;
  }) => StaffDebt;
  updateDebt: (id: string, updates: Partial<StaffDebt>) => StaffDebt | null;
  writeOffDebt: (id: string) => void;
  clearDebt: (id: string) => void;
  deleteDebt: (id: string) => void;

  /** Active debts for one employee with remaining balance > 0. */
  getActiveDebtsForEmployee: (employeeId: string) => StaffDebt[];
  /** Sum of remaining balances across active debts. */
  owedByEmployee: (employeeId: string) => number;
  /** Planned installment lines for prepare/recalculate (min(installment, remaining) each). Skips debts still in grace for that payroll month. */
  installmentDue: (employeeId: string, asOf: { month: number; year: number }) => DebtInstallmentLine[];
  /** Apply frozen repayments from a payroll record once that line is marked paid. */
  applyRepaymentsFromPayroll: (payrollRecordId: string, lines: DebtInstallmentLine[], paidAt?: Date) => void;

  hydrateFromApi: () => Promise<void>;
}

export const useStaffDebtStore = create<StaffDebtState>((set, get) => ({
  debts: [],
  repayments: [],

  issueDebt: (input) => {
    const amount = Math.max(0, Number(input.originalAmount) || 0);
    const installment = Math.max(0, Number(input.monthlyInstallment) || 0);
    const graceMonths = Math.max(0, Math.floor(Number(input.graceMonths) || 0));
    const debt: StaffDebt = {
      id: newId('sd_'),
      employeeId: input.employeeId,
      type: input.type,
      originalAmount: amount,
      remainingBalance: amount,
      monthlyInstallment: installment > 0 ? installment : amount,
      graceMonths,
      reason: input.reason,
      issuedDate: input.issuedDate || new Date(),
      status: 'active',
      notes: input.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((s) => ({ debts: [debt, ...s.debts] }));
    syncDebtToApi(debt);
    return debt;
  },

  updateDebt: (id, updates) => {
    let updated: StaffDebt | null = null;
    set((s) => ({
      debts: s.debts.map((d) => {
        if (d.id !== id) return d;
        const next = { ...d, ...updates, updatedAt: new Date() };
        if (typeof updates.remainingBalance === 'number' && updates.remainingBalance <= 0 && !updates.status) {
          next.remainingBalance = 0;
          next.status = 'cleared';
        }
        updated = next;
        return next;
      }),
    }));
    if (updated) syncDebtToApi(updated);
    return updated;
  },

  writeOffDebt: (id) => {
    get().updateDebt(id, { status: 'written_off' });
  },

  clearDebt: (id) => {
    get().updateDebt(id, { remainingBalance: 0, status: 'cleared' });
  },

  deleteDebt: (id) => {
    set((s) => ({
      debts: s.debts.filter((d) => d.id !== id),
      repayments: s.repayments.filter((r) => r.debtId !== id),
    }));
    deleteDebtFromApi(id);
  },

  getActiveDebtsForEmployee: (employeeId) =>
    get().debts.filter((d) => d.employeeId === employeeId && d.status === 'active' && d.remainingBalance > 0),

  owedByEmployee: (employeeId) =>
    get().getActiveDebtsForEmployee(employeeId).reduce((s, d) => s + d.remainingBalance, 0),

  installmentDue: (employeeId, asOf) =>
    get()
      .getActiveDebtsForEmployee(employeeId)
      .filter((d) => isDebtRepaymentDue(d, asOf.year, asOf.month))
      .map((d) => ({
        debtId: d.id,
        amount: Math.min(Number(d.monthlyInstallment) || 0, Number(d.remainingBalance) || 0),
        type: d.type,
        reason: d.reason,
      }))
      .filter((l) => l.amount > 0),

  applyRepaymentsFromPayroll: (payrollRecordId, lines, paidAt = new Date()) => {
    if (!lines.length) return;
    const already = new Set(
      get().repayments.filter((r) => r.payrollRecordId === payrollRecordId).map((r) => r.debtId),
    );
    const fresh = lines.filter((l) => l.amount > 0 && !already.has(l.debtId));
    if (!fresh.length) return;

    const newRepayments: StaffDebtRepayment[] = [];
    set((s) => {
      const debts = s.debts.map((d) => {
        const line = fresh.find((l) => l.debtId === d.id);
        if (!line) return d;
        const remaining = Math.max(0, Math.round((d.remainingBalance - line.amount) * 100) / 100);
        const status: StaffDebtStatus = remaining <= 0 ? 'cleared' : d.status;
        const next = { ...d, remainingBalance: remaining, status, updatedAt: new Date() };
        syncDebtToApi(next);
        const repayment: StaffDebtRepayment = {
          id: newId('sdr_'),
          debtId: d.id,
          payrollRecordId,
          amount: line.amount,
          paidAt,
          createdAt: new Date(),
        };
        newRepayments.push(repayment);
        syncRepaymentToApi(repayment);
        return next;
      });
      return { debts, repayments: [...newRepayments, ...s.repayments] };
    });
  },

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    const headers = hrTenantHeaders();
    const dateFields = ['issuedDate', 'paidAt', 'createdAt', 'updatedAt'];
    const toDates = (row: any) => {
      const out = { ...row };
      for (const f of dateFields) if (out[f]) out[f] = new Date(out[f]);
      return out;
    };
    try {
      const res = await fetch('/api/hr/staff-debts', { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.debts)) set({ debts: data.debts.map(toDates) });
        if (Array.isArray(data.repayments)) set({ repayments: data.repayments.map(toDates) });
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate staff debts from server:', e);
    }
  },
}));
