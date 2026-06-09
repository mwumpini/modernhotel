'use client';

import { useMemo } from 'react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { usePayrollStore } from '@/app/lib/hr/payrollStore';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { buildAllFilingSnapshots } from '@/app/lib/compliance/filingAggregates';

export function useFilingSnapshots(period?: string) {
  const journalEntries = useAccountingStore((s) => s.journalEntries);
  const invoices = useAccountingStore((s) => s.invoices);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const payrollPeriods = usePayrollStore((s) => s.payrollPeriods);
  const reportingRules = useComplianceStore((s) => s.reportingRules);
  const country = useComplianceStore((s) => s.country);

  const rules = useMemo(
    () => reportingRules.filter((r) => r.countryCode === country && r.isActive !== false),
    [reportingRules, country]
  );

  return useMemo(
    () =>
      buildAllFilingSnapshots(rules, {
        journalEntries,
        invoices,
        payrollRecords,
        payrollPeriods,
        period,
      }),
    [journalEntries, invoices, payrollRecords, payrollPeriods, rules, period]
  );
}
