'use client';

/**
 * Pending sales-tax filings follow the ledger. A period with output tax still open gets a
 * pending filing for that net. A period already submitted or approved is left alone — the
 * remittance flow owns that row.
 */

import { useAccountingStore } from '../accounting/store';
import { useComplianceStore } from './store';
import { rollupTaxLedger } from '../tax/ledgerRollup';
import { TAX_LIABILITY_GL, TAX_CODE_TO_REPORT_TYPE } from '../tax/glMap';
import { getNextDueDateForSchedule, scheduleInputFromRule, toIsoDateLocal } from './dueDates';

export function syncOpenSalesTaxFilings(): void {
  const journals = useAccountingStore.getState().journalEntries;
  if (!journals.length) return;

  const compliance = useComplianceStore.getState();
  const rollup = rollupTaxLedger(journals);

  for (const row of rollup.rows) {
    const meta = TAX_LIABILITY_GL[row.taxCode];
    if (!meta || meta.category === 'payroll') continue;
    const reportType = TAX_CODE_TO_REPORT_TYPE[row.taxCode];
    if (!reportType) continue;

    const existing = compliance.reports.find(
      (r) => r.countryCode === compliance.country && r.reportType === reportType && r.period === row.period,
    );
    if (existing && (existing.status === 'submitted' || existing.status === 'approved')) continue;
    if (row.netPosition <= 0.05) continue;
    if (existing && existing.status === 'pending' && Math.abs(existing.amount - row.netPosition) < 0.05) continue;

    const schedule = compliance.reportingRules.find(
      (r) => r.countryCode === compliance.country && r.reportType === reportType,
    );
    const [year, month] = row.period.split('-').map(Number);
    const periodEnd = new Date(year, month, 0);
    const dueDate = schedule
      ? toIsoDateLocal(getNextDueDateForSchedule(scheduleInputFromRule(schedule), periodEnd))
      : toIsoDateLocal(periodEnd);

    compliance.upsertReport({
      countryCode: compliance.country,
      reportType,
      period: row.period,
      dueDate,
      status: 'pending',
      amount: row.netPosition,
      currency: 'GHS',
      notes: `Open ${meta.name} on GL ${meta.code} for ${row.period}`,
    });
  }
}
