'use client';

/**
 * Suggested filing amounts from accounting ledger, invoices, and HR payroll — wired to Reports & Filing.
 */

import type { Invoice, JournalEntry } from '../accounting/models';
import type { ReportingRule } from '../models';
import type { PayrollPeriod, PayrollRecord } from '../hr/models';
import { rollupTaxLedger } from '../tax/ledgerRollup';
import { TAX_LIABILITY_GL } from '../tax/glMap';

export type FilingSnapshot = {
  reportType: string;
  period: string;
  suggestedAmount: number;
  source: 'ledger' | 'payroll' | 'invoices' | 'mixed' | 'none';
  detail: string;
};

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function periodFromDate(d: Date | string | undefined): string | null {
  if (!d) return null;
  const iso = d instanceof Date ? d.toISOString() : String(d);
  return iso.slice(0, 7);
}

function ledgerNetForGl(
  journalEntries: JournalEntry[],
  period: string,
  glCode: string
): number {
  const rollup = rollupTaxLedger(journalEntries, { fromPeriod: period, toPeriod: period });
  const rows = rollup.rows.filter((r) => r.glAccountCode === glCode);
  return rows.reduce((s, r) => s + r.netPosition, 0);
}

function invoiceTaxSum(
  invoices: Invoice[],
  period: string,
  type: 'vat' | 'nhil' | 'getfund' | 'tourism' | 'withholding'
): number {
  return invoices
    .filter((inv) => inv.status !== 'Void' && inv.date?.slice(0, 7) === period)
    .reduce((sum, inv) => {
      const b = inv.taxBreakdown;
      if (!b) return sum + (type === 'vat' ? inv.taxAmount || 0 : 0);
      const pick =
        type === 'vat'
          ? b.vat
          : type === 'nhil'
            ? b.nhil
            : type === 'getfund'
              ? b.getfund
              : type === 'tourism'
                ? b.tourism
                : b.withholding;
      return sum + (pick ?? 0);
    }, 0);
}

function payrollTotalsForPeriod(
  records: PayrollRecord[],
  periods: PayrollPeriod[],
  period: string
): { paye: number; ssnit: number; gross: number; count: number } {
  const periodIds = periods
    .filter((p) => periodFromDate(p.endDate) === period || periodFromDate(p.startDate) === period)
    .map((p) => p.id);
  const rows = records.filter((r) => periodIds.includes(r.payrollPeriodId));
  return {
    paye: rows.reduce((s, r) => s + (r.deductions?.tax ?? 0), 0),
    ssnit: rows.reduce((s, r) => s + (r.deductions?.socialSecurity ?? 0), 0),
    gross: rows.reduce((s, r) => s + r.grossPay, 0),
    count: rows.length,
  };
}

function pickAmount(ledger: number, invoice: number, payroll: number): { amount: number; source: FilingSnapshot['source'] } {
  if (ledger > 0) return { amount: ledger, source: 'ledger' };
  if (payroll > 0) return { amount: payroll, source: 'payroll' };
  if (invoice > 0) return { amount: invoice, source: 'invoices' };
  if (ledger !== 0) return { amount: ledger, source: 'ledger' };
  return { amount: 0, source: 'none' };
}

export function buildFilingSnapshot(
  rule: ReportingRule,
  input: {
    journalEntries: JournalEntry[];
    invoices: Invoice[];
    payrollRecords: PayrollRecord[];
    payrollPeriods: PayrollPeriod[];
    period?: string;
  }
): FilingSnapshot {
  const period = input.period ?? currentPeriod();
  const { journalEntries, invoices, payrollRecords, payrollPeriods } = input;
  const pr = payrollTotalsForPeriod(payrollRecords, payrollPeriods, period);

  let suggestedAmount = 0;
  let source: FilingSnapshot['source'] = 'none';
  let detail = 'No posted activity for this period yet.';

  switch (rule.reportType) {
    case 'VAT': {
      const ledger = ledgerNetForGl(journalEntries, period, TAX_LIABILITY_GL.VAT.code);
      const inv = invoiceTaxSum(invoices, period, 'vat');
      const pick = pickAmount(ledger, inv, 0);
      suggestedAmount = pick.amount;
      source = pick.source;
      detail =
        pick.source === 'ledger'
          ? `Net VAT liability from GL ${TAX_LIABILITY_GL.VAT.code} (${period})`
          : pick.source === 'invoices'
            ? `Output VAT from posted invoices (${period})`
            : detail;
      break;
    }
    case 'NHIL': {
      const ledger = ledgerNetForGl(journalEntries, period, TAX_LIABILITY_GL.NHIL.code);
      const inv = invoiceTaxSum(invoices, period, 'nhil');
      const pick = pickAmount(ledger, inv, 0);
      suggestedAmount = pick.amount;
      source = pick.source;
      detail = pick.source !== 'none' ? `NHIL for ${period}` : detail;
      break;
    }
    case 'Tourism': {
      const ledger = ledgerNetForGl(journalEntries, period, TAX_LIABILITY_GL.TOURISM.code);
      const inv = invoiceTaxSum(invoices, period, 'tourism');
      const pick = pickAmount(ledger, inv, 0);
      suggestedAmount = pick.amount;
      source = pick.source;
      detail = pick.source !== 'none' ? `Tourism levy collected (${period})` : detail;
      break;
    }
    case 'PAYE': {
      const ledger = ledgerNetForGl(journalEntries, period, TAX_LIABILITY_GL.PAYE.code);
      const pick = pickAmount(ledger, 0, pr.paye);
      suggestedAmount = pick.amount;
      source = pick.source;
      detail =
        pick.source === 'payroll'
          ? `PAYE from ${pr.count} payroll record(s) (${period})`
          : pick.source === 'ledger'
            ? `PAYE payable GL (${period})`
            : detail;
      break;
    }
    case 'SSNIT': {
      const ledger = ledgerNetForGl(journalEntries, period, TAX_LIABILITY_GL.SSNIT.code);
      const pick = pickAmount(ledger, 0, pr.ssnit);
      suggestedAmount = pick.amount;
      source = pick.source;
      detail =
        pick.source === 'payroll'
          ? `SSNIT from ${pr.count} payroll record(s) (${period})`
          : pick.source === 'ledger'
            ? `SSNIT payable GL (${period})`
            : detail;
      break;
    }
    case 'WHT': {
      const ledger = ledgerNetForGl(journalEntries, period, TAX_LIABILITY_GL.WHT.code);
      const inv = invoiceTaxSum(invoices, period, 'withholding');
      const pick = pickAmount(ledger, inv, 0);
      suggestedAmount = pick.amount;
      source = pick.source;
      detail = pick.source !== 'none' ? `Withholding tax (${period})` : detail;
      break;
    }
    case 'CIT':
    case 'IncomeTax':
    case 'GSL':
      suggestedAmount = 0;
      source = 'none';
      detail = 'Derived from financial statements — review P&L in Accounting before filing.';
      break;
    default:
      suggestedAmount = 0;
      source = 'none';
      detail = 'Connect ledger or module data to populate this schedule.';
  }

  return {
    reportType: rule.reportType,
    period,
    suggestedAmount: Math.round((suggestedAmount + Number.EPSILON) * 100) / 100,
    source,
    detail,
  };
}

export function buildAllFilingSnapshots(
  rules: ReportingRule[],
  input: {
    journalEntries: JournalEntry[];
    invoices: Invoice[];
    payrollRecords: PayrollRecord[];
    payrollPeriods: PayrollPeriod[];
    period?: string;
  }
): Map<string, FilingSnapshot> {
  const map = new Map<string, FilingSnapshot>();
  for (const rule of rules) {
    map.set(rule.id, buildFilingSnapshot(rule, input));
  }
  return map;
}
