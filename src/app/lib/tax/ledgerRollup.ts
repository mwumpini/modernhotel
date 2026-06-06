'use client';

/**
 * Tax inflow / outflow measurement from posted journal entries.
 *
 * Inflows  = credits to tax liability GL (output tax collected on sales, payroll withheld)
 * Offsets  = debits to tax liability GL from purchases (recoverable input tax)
 * Outflows = debits to tax liability GL from remittance JEs (payments to GRA)
 * Net owed = inflows + payrollWithheld − offsets − outflows
 */

import type { JournalEntry } from '../accounting/models';
import { ALL_TAX_GL_CODES, TAX_LIABILITY_GL, taxCodeForGl } from './glMap';

export type TaxPeriodRow = {
  period: string;
  taxCode: string;
  taxName: string;
  glAccountCode: string;
  /** Output tax collected (Cr liability from sales / checkout / POS) */
  outputCollected: number;
  /** Recoverable input tax (Dr liability from purchases) */
  inputOffset: number;
  /** Payroll tax withheld (Cr 2210 / 2220) */
  payrollWithheld: number;
  /** Remitted to authority (Dr liability, outflow) */
  remitted: number;
  /** outputCollected + payrollWithheld − inputOffset − remitted */
  netPosition: number;
};

export type TaxLedgerSummary = {
  rows: TaxPeriodRow[];
  totals: {
    outputCollected: number;
    inputOffset: number;
    payrollWithheld: number;
    remitted: number;
    netPosition: number;
  };
  periods: string[];
};

function periodOf(iso?: string): string {
  if (!iso) return 'unknown';
  return iso.slice(0, 7);
}

function isPurchaseJe(je: JournalEntry): boolean {
  const mod = String(je.sourceModule || '').toLowerCase();
  const desc = String(je.description || '').toLowerCase();
  return (
    mod.includes('purchase') ||
    mod.includes('expense') ||
    mod.includes('ap') ||
    mod.includes('supplier') ||
    desc.includes('supplier') ||
    desc.includes('purchase') ||
    desc.includes('ap:')
  );
}

function isRemittanceJe(je: JournalEntry): boolean {
  const mod = String(je.sourceModule || '').toLowerCase();
  const desc = String(je.description || '').toLowerCase();
  return (
    mod.includes('tax_remittance') ||
    mod.includes('tax_payment') ||
    desc.includes('tax remit') ||
    desc.includes('gra payment') ||
    desc.includes('vat return') ||
    desc.includes('tax return')
  );
}

function isPayrollJe(je: JournalEntry): boolean {
  const mod = String(je.sourceModule || '').toLowerCase();
  return mod.includes('payroll') || mod.includes('hr');
}

type Bucket = Omit<TaxPeriodRow, 'netPosition'>;

function bucketKey(period: string, gl: string) {
  return `${period}|${gl}`;
}

function ensureBucket(map: Map<string, Bucket>, period: string, gl: string): Bucket {
  const key = bucketKey(period, gl);
  let b = map.get(key);
  if (!b) {
    const code = taxCodeForGl(gl) || gl;
    const meta = Object.values(TAX_LIABILITY_GL).find((t) => t.code === gl);
    b = {
      period,
      taxCode: code,
      taxName: meta?.name || code,
      glAccountCode: gl,
      outputCollected: 0,
      inputOffset: 0,
      payrollWithheld: 0,
      remitted: 0,
    };
    map.set(key, b);
  }
  return b;
}

/**
 * Roll up tax flows from posted journal entries, grouped by calendar month and tax GL.
 */
export function rollupTaxLedger(
  journalEntries: JournalEntry[],
  options?: { fromPeriod?: string; toPeriod?: string }
): TaxLedgerSummary {
  const map = new Map<string, Bucket>();
  const posted = journalEntries.filter((je) => je.status === 'Posted');

  for (const je of posted) {
    const period = periodOf(je.date);
    if (options?.fromPeriod && period < options.fromPeriod) continue;
    if (options?.toPeriod && period > options.toPeriod) continue;

    const purchase = isPurchaseJe(je);
    const remittance = isRemittanceJe(je);
    const payroll = isPayrollJe(je);

    for (const line of je.lines || []) {
      const gl = String(line.accountCode || '').trim();
      if (!ALL_TAX_GL_CODES.has(gl)) continue;

      const b = ensureBucket(map, period, gl);
      const dr = Number(line.debit || 0);
      const cr = Number(line.credit || 0);

      if (cr > 0) {
        if (payroll || gl === TAX_LIABILITY_GL.PAYE.code || gl === TAX_LIABILITY_GL.SSNIT.code) {
          b.payrollWithheld += cr;
        } else {
          b.outputCollected += cr;
        }
      }
      if (dr > 0) {
        if (remittance) {
          b.remitted += dr;
        } else if (purchase) {
          b.inputOffset += dr;
        } else {
          // Debit without purchase/remittance context — treat as remittance/outflow
          b.remitted += dr;
        }
      }
    }
  }

  const rows = Array.from(map.values())
    .map((b) => ({
      ...b,
      netPosition: round2(
        b.outputCollected + b.payrollWithheld - b.inputOffset - b.remitted
      ),
      outputCollected: round2(b.outputCollected),
      inputOffset: round2(b.inputOffset),
      payrollWithheld: round2(b.payrollWithheld),
      remitted: round2(b.remitted),
    }))
    .sort((a, b) => a.period.localeCompare(b.period) || a.taxCode.localeCompare(b.taxCode));

  const totals = rows.reduce(
    (acc, r) => {
      acc.outputCollected += r.outputCollected;
      acc.inputOffset += r.inputOffset;
      acc.payrollWithheld += r.payrollWithheld;
      acc.remitted += r.remitted;
      acc.netPosition += r.netPosition;
      return acc;
    },
    { outputCollected: 0, inputOffset: 0, payrollWithheld: 0, remitted: 0, netPosition: 0 }
  );

  const periods = [...new Set(rows.map((r) => r.period))].sort();

  return { rows, totals, periods };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
