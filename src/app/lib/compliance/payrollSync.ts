'use client';

/**
 * After a payroll run, upsert in-memory compliance filing hints (PAYE / SSNIT).
 */

import { useComplianceStore } from './store';

export function syncPayrollRunToComplianceFiling(input: {
  countryCode: string;
  period: string;
  payeTotal: number;
  ssnitTotal: number;
  employeeCount: number;
}): void {
  const store = useComplianceStore.getState();
  const dueDay = 15;
  const dueDate = new Date(input.period + '-01');
  dueDate.setMonth(dueDate.getMonth() + 1);
  dueDate.setDate(dueDay);
  const dueIso = dueDate.toISOString().slice(0, 10);

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
