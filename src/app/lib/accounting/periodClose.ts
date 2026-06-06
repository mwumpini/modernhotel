import type { JournalEntry, JournalEntryLine } from './models';
import type { RollupCoa } from './financialReportRollup';

export const RETAINED_EARNINGS_GL = '3200';

const CLOSE_SOURCE = 'pl_period_close';

function dayEnd(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function jeTime(je: JournalEntry): number {
  const d = new Date(je.date);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

function inferPlType(code: string, coa: RollupCoa[]): 'Revenue' | 'Expense' | null {
  const row = coa.find((a) => a.code === code);
  if (row) {
    if (row.type === 'Revenue' || row.type === 'Expense') return row.type;
    return null;
  }
  const c = code.trim();
  if (c.startsWith('4')) return 'Revenue';
  if (c.startsWith('5')) return 'Expense';
  return null;
}

/**
 * Raw debits/credits per account through date, excluding prior period-close journals so re-run is safe.
 */
export function aggregateBalancesThroughDate(
  journalEntries: JournalEntry[],
  endDate: Date,
  excludeClosing = true
): Map<string, { debit: number; credit: number }> {
  const endTs = dayEnd(endDate).getTime();
  const m = new Map<string, { debit: number; credit: number }>();

  for (const je of journalEntries) {
    if (je.status !== 'Posted') continue;
    if (excludeClosing && je.sourceModule === CLOSE_SOURCE) continue;
    if (jeTime(je) > endTs) continue;
    for (const line of je.lines) {
      const code = (line.accountCode || '').trim();
      if (!code) continue;
      const cur = m.get(code) || { debit: 0, credit: 0 };
      cur.debit += line.debit || 0;
      cur.credit += line.credit || 0;
      m.set(code, cur);
    }
  }
  return m;
}

export function hasPeriodCloseForDate(journalEntries: JournalEntry[], asOfDateIso: string): boolean {
  const key = asOfDateIso.slice(0, 10);
  return journalEntries.some(
    (je) =>
      je.sourceModule === CLOSE_SOURCE &&
      (je.sourceTransactionId === `PL-CLOSE-${key}` || je.reference === `PL-CLOSE-${key}`)
  );
}

export type PeriodCloseResult =
  | { ok: true; entry: JournalEntry }
  | { ok: false; error: string };

/**
 * Build a balanced journal: Dr revenue accounts, Cr expense accounts, Cr/(Dr) retained earnings for the plug (profit/loss).
 * Excludes existing `pl_period_close` entries when reading balances.
 */
export function buildProfitLossCloseEntry(
  journalEntries: JournalEntry[],
  coa: RollupCoa[],
  asOfDate: string,
  opts?: { description?: string }
): PeriodCloseResult {
  const endDate = new Date(asOfDate);
  if (Number.isNaN(endDate.getTime())) {
    return { ok: false, error: 'Invalid closing date.' };
  }

  const dateKey = asOfDate.slice(0, 10);
  if (hasPeriodCloseForDate(journalEntries, asOfDate)) {
    return { ok: false, error: `A period-close entry already exists for ${dateKey}.` };
  }

  const agg = aggregateBalancesThroughDate(journalEntries, endDate, true);
  const lines: JournalEntryLine[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  const now = new Date().toISOString();
  let lineId = 0;
  const jl = () => `JL-PLC-${Date.now()}-${++lineId}`;

  const revenueDebits: { code: string; amount: number }[] = [];
  const expenseCredits: { code: string; amount: number }[] = [];

  for (const [code, { debit, credit }] of agg) {
    const t = inferPlType(code, coa);
    if (t === 'Revenue') {
      const bal = credit - debit;
      if (bal > 0.005) revenueDebits.push({ code, amount: +bal.toFixed(2) });
    } else if (t === 'Expense') {
      const bal = debit - credit;
      if (bal > 0.005) expenseCredits.push({ code, amount: +bal.toFixed(2) });
    }
  }

  const sumRev = revenueDebits.reduce((s, x) => s + x.amount, 0);
  const sumExp = expenseCredits.reduce((s, x) => s + x.amount, 0);

  if (sumRev < 0.005 && sumExp < 0.005) {
    return { ok: false, error: 'No revenue or expense balances to close (already closed or no P&L activity).' };
  }

  const entryId = `JE-PL-CLOSE-${dateKey}-${Date.now().toString(36)}`;

  for (const { code, amount } of revenueDebits) {
    lines.push({
      id: jl(),
      journalEntryId: entryId,
      accountCode: code,
      description: `Year/period close — clear revenue (${dateKey})`,
      debit: amount,
      credit: 0,
      currency: 'GHS',
    });
    totalDebit += amount;
  }

  for (const { code, amount } of expenseCredits) {
    lines.push({
      id: jl(),
      journalEntryId: entryId,
      accountCode: code,
      description: `Year/period close — clear expense (${dateKey})`,
      debit: 0,
      credit: amount,
      currency: 'GHS',
    });
    totalCredit += amount;
  }

  const diff = totalDebit - totalCredit;
  if (diff > 0.005) {
    lines.push({
      id: jl(),
      journalEntryId: entryId,
      accountCode: RETAINED_EARNINGS_GL,
      description: `Year/period close — net profit to retained earnings (${dateKey})`,
      debit: 0,
      credit: +diff.toFixed(2),
      currency: 'GHS',
    });
    totalCredit += diff;
  } else if (diff < -0.005) {
    const loss = -diff;
    lines.push({
      id: jl(),
      journalEntryId: entryId,
      accountCode: RETAINED_EARNINGS_GL,
      description: `Year/period close — net loss from retained earnings (${dateKey})`,
      debit: +loss.toFixed(2),
      credit: 0,
      currency: 'GHS',
    });
    totalDebit += loss;
  }

  if (Math.abs(totalDebit - totalCredit) > 0.02) {
    return { ok: false, error: 'Internal error: close entry not balanced.' };
  }

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: `PLC-${dateKey}-${Date.now().toString().slice(-4)}`,
    date: dateKey,
    reference: `PL-CLOSE-${dateKey}`,
    description:
      opts?.description ||
      `Period close — transfer P&L to retained earnings (${RETAINED_EARNINGS_GL}) as at ${dateKey}`,
    totalDebit: +totalDebit.toFixed(2),
    totalCredit: +totalCredit.toFixed(2),
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    lines,
    sourceModule: CLOSE_SOURCE,
    sourceTransactionId: `PL-CLOSE-${dateKey}`,
  };

  return { ok: true, entry };
}
