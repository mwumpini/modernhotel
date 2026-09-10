'use client';

/**
 * After a payroll run, upsert in-memory compliance filing hints (PAYE / SSNIT).
 */

import { useComplianceStore } from './store';
import { toIsoDateLocal } from './dueDates';

export function syncPayrollRunToComplianceFiling(input: {
  countryCode: string;
  period: string;
  payeTotal: number;
  ssnitTotal: number;
  employeeCount: number;
}): void {
  const store = useComplianceStore.getState();
  const dueDay = 15;
  // `new Date(input.period + '-01')` parses a plain 'YYYY-MM-DD' string as UTC midnight, not
  // local — in a positive-UTC-offset timezone that's already the next day locally before any
  // month/day math even starts. The explicit T00:00:00 suffix forces local-time parsing
  // instead, and toIsoDateLocal (not toISOString) reads it back the same way on the way out —
  // both ends of the same UTC-round-trip bug fixed in remittanceLedgerSync.ts.
  const dueDate = new Date(`${input.period}-01T00:00:00`);
  dueDate.setMonth(dueDate.getMonth() + 1);
  dueDate.setDate(dueDay);
  const dueIso = toIsoDateLocal(dueDate);

  const upsert = (reportType: string, amount: number, notes: string) => {
    store.upsertReport({
      countryCode: input.countryCode,
      reportType,
      period: input.period,
      dueDate: dueIso,
      status: 'pending',
      amount,
      currency: 'GHS',
      notes,
    });
  };

  if (input.payeTotal > 0) {
    upsert(
      'PAYE',
      input.payeTotal,
      `Auto from payroll run — ${input.employeeCount} employee(s), period ${input.period}`
    );
  }
  if (input.ssnitTotal > 0) {
    upsert(
      'SSNIT',
      input.ssnitTotal,
      `Auto from payroll run — ${input.employeeCount} employee(s), period ${input.period}`
    );
  }
}
