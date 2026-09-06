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
  /** Withheld from a supplier/payee, not collected on a sale (Cr liability, category 'withholding') */
  withholding: number;
  /** Recoverable input tax (Dr liability from purchases) */
  inputOffset: number;
  /** Payroll tax withheld (Cr 2210 / 2220) */
  payrollWithheld: number;
  /** Remitted to authority (Dr liability, outflow) */
  remitted: number;
  /** Portion of `remitted` from a debit that didn't clearly match a purchase or a tagged
   *  remittance — assumed paid so Net Tax Position isn't silently wrong, but worth a look. */
  remittedUnconfirmed: number;
  /** outputCollected + withholding + payrollWithheld − inputOffset − remitted */
  netPosition: number;
};

export type TaxLedgerSummary = {
  rows: TaxPeriodRow[];
  totals: {
    outputCollected: number;
    withholding: number;
    inputOffset: number;
    payrollWithheld: number;
    remitted: number;
    remittedUnconfirmed: number;
    netPosition: number;
  };
  periods: string[];
};

function periodOf(iso?: string): string {
  if (!iso) return 'unknown';
  return iso.slice(0, 7);
}

/** captureTaxRemittance encodes the accrual period it settles as `sourceTransactionId =
 *  "<glCode>-<YYYY-MM>"`. Falls back to null (caller uses the JE's own date) for anything
 *  posted before this convention existed, or a remittance-shaped entry from elsewhere. */
function remittancePeriodFromJe(je: JournalEntry, gl: string): string | null {
  const stx = je.sourceTransactionId;
  if (!stx) return null;
  const prefix = `${gl}-`;
  if (!stx.startsWith(prefix)) return null;
  const period = stx.slice(prefix.length);
  return /^\d{4}-\d{2}$/.test(period) ? period : null;
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
      withholding: 0,
      inputOffset: 0,
      payrollWithheld: 0,
      remitted: 0,
      remittedUnconfirmed: 0,
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
    const postedPeriod = periodOf(je.date);
    const purchase = isPurchaseJe(je);
    const remittance = isRemittanceJe(je);

    for (const line of je.lines || []) {
      const gl = String(line.accountCode || '').trim();
      if (!ALL_TAX_GL_CODES.has(gl)) continue;

      const dr = Number(line.debit || 0);
      const cr = Number(line.credit || 0);
      // The GL map already knows whether this account is a sales, payroll, or withholding
      // liability — use that directly instead of re-guessing it from sourceModule/description
      // text (which previously mislabeled every withheld-on-payment credit, e.g. WHT, as
      // "Output Tax Collected").
      const taxCode = taxCodeForGl(gl);
      const category = taxCode ? TAX_LIABILITY_GL[taxCode]?.category : undefined;

      // A remittance settles a specific accrual period, encoded at posting time by
      // captureTaxRemittance — bucket it there (not the month the payment happened to be
      // made) so paying a period's liability actually zeroes that period's row out instead
      // of leaving it looking unpaid while a separate, later-period credit appears.
      const period = remittance ? remittancePeriodFromJe(je, gl) || postedPeriod : postedPeriod;
      if (options?.fromPeriod && period < options.fromPeriod) continue;
      if (options?.toPeriod && period > options.toPeriod) continue;

      const b = ensureBucket(map, period, gl);

      if (cr > 0) {
        if (category === 'payroll') {
          b.payrollWithheld += cr;
        } else if (category === 'withholding') {
          b.withholding += cr;
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
          // Debit without purchase/remittance context — most likely a manual settlement that
          // wasn't posted through "Record remittance", so it's still counted (Net Tax Position
          // shouldn't silently ignore it) but flagged separately for the user to verify.
          b.remitted += dr;
          b.remittedUnconfirmed += dr;
        }
      }
    }
  }

  const rows = Array.from(map.values())
    .map((b) => ({
      ...b,
      netPosition: round2(
        b.outputCollected + b.withholding + b.payrollWithheld - b.inputOffset - b.remitted
      ),
      outputCollected: round2(b.outputCollected),
      withholding: round2(b.withholding),
      inputOffset: round2(b.inputOffset),
      payrollWithheld: round2(b.payrollWithheld),
      remitted: round2(b.remitted),
      remittedUnconfirmed: round2(b.remittedUnconfirmed),
    }))
    .sort((a, b) => a.period.localeCompare(b.period) || a.taxCode.localeCompare(b.taxCode));

  const totals = rows.reduce(
    (acc, r) => {
      acc.outputCollected += r.outputCollected;
      acc.withholding += r.withholding;
      acc.inputOffset += r.inputOffset;
      acc.payrollWithheld += r.payrollWithheld;
      acc.remitted += r.remitted;
      acc.remittedUnconfirmed += r.remittedUnconfirmed;
      acc.netPosition += r.netPosition;
      return acc;
    },
    { outputCollected: 0, withholding: 0, inputOffset: 0, payrollWithheld: 0, remitted: 0, remittedUnconfirmed: 0, netPosition: 0 }
  );

  const periods = [...new Set(rows.map((r) => r.period))].sort();

  return { rows, totals, periods };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
