import type { JournalEntry } from './models';
import { isBankOrCashGlCode } from './bankCoaLink';
import { enrichRollupCoaParents, codeNum } from './coaHierarchy';
import { shouldIncludeJeLineInRevenueRollup } from './revenueSourcePolicy';
import { CLOSE_SOURCE } from './periodClose';

/** Minimal COA row for roll-ups (store or template). */
export type RollupCoa = {
  id?: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  category?: string;
  level: number;
  parentId?: string | null;
  parentAccount?: string;
};

export type AccountNode = {
  code: string;
  name: string;
  type: string;
  category: string;
  level: number;
  debit: number;
  credit: number;
  balance: number;
  children: AccountNode[];
};

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

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

/** Cash & bank GL codes used in integration / folio flows. */
export function isCashEquivalentAccount(code: string): boolean {
  return isBankOrCashGlCode(code);
}

/**
 * IAS 7-style bucket: classify whole entry by non-cash lines (simplified).
 */
export function classifyCashFlowActivity(je: JournalEntry): 'operating' | 'investing' | 'financing' {
  const codes = je.lines.map((l) => l.accountCode || '');
  const nonCash = codes.filter((c) => !isCashEquivalentAccount(c));
  const pool = nonCash.length > 0 ? nonCash : codes;

  const hits = (test: (c: string) => boolean) => pool.some(test);

  if (hits((c) => c.startsWith('151') || c.startsWith('152') || c === '1500' || c === '1510' || c === '1520')) {
    return 'investing';
  }
  if (hits((c) => c.startsWith('3100') || c === '3100')) {
    return 'financing';
  }
  return 'operating';
}

export type CashFlowSummary = {
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  openingCash: number;
  closingCash: number;
  reconciliationDiff: number;
};

/**
 * Posted cash activity in period, split operating / investing / financing from journal lines.
 */
export function computeCashFlowFromJournals(
  journalEntries: JournalEntry[],
  startDate: Date,
  endDate: Date
): CashFlowSummary {
  const posted = journalEntries.filter((je) => je.status === 'Posted');
  const s = dayStart(startDate).getTime();
  const e = dayEnd(endDate).getTime();

  function cashNetForJe(je: JournalEntry): number {
    let n = 0;
    for (const line of je.lines) {
      if (!isCashEquivalentAccount(line.accountCode)) continue;
      n += (line.debit || 0) - (line.credit || 0);
    }
    return n;
  }

  function cashBalanceBefore(cutoff: number): number {
    let deb = 0;
    let cred = 0;
    for (const je of posted) {
      if (jeTime(je) >= cutoff) continue;
      for (const line of je.lines) {
        if (!isCashEquivalentAccount(line.accountCode)) continue;
        deb += line.debit || 0;
        cred += line.credit || 0;
      }
    }
    return deb - cred;
  }

  function cashBalanceThrough(cutoff: number): number {
    let deb = 0;
    let cred = 0;
    for (const je of posted) {
      if (jeTime(je) > cutoff) continue;
      for (const line of je.lines) {
        if (!isCashEquivalentAccount(line.accountCode)) continue;
        deb += line.debit || 0;
        cred += line.credit || 0;
      }
    }
    return deb - cred;
  }

  let operating = 0;
  let investing = 0;
  let financing = 0;

  for (const je of posted) {
    const t = jeTime(je);
    if (t < s || t > e) continue;
    const net = cashNetForJe(je);
    if (Math.abs(net) < 1e-6) continue;
    const bucket = classifyCashFlowActivity(je);
    if (bucket === 'investing') investing += net;
    else if (bucket === 'financing') financing += net;
    else operating += net;
  }

  const openingCash = cashBalanceBefore(s);
  const closingCash = cashBalanceThrough(e);
  const netChange = closingCash - openingCash;
  const summed = operating + investing + financing;
  const reconciliationDiff = netChange - summed;

  return {
    operating,
    investing,
    financing,
    netChange,
    openingCash,
    closingCash,
    reconciliationDiff,
  };
}

export type UnmappedGlCode = { code: string; debit: number; credit: number };

/**
 * Posted journal lines whose accountCode has no matching entry in the current Chart of
 * Accounts. buildFinancialAccountTree() only walks the COA's own parent/child structure to
 * build its tree, so a line posted to a code that isn't (or is no longer) in the COA is
 * silently excluded from every rollup built from it — Balance Sheet, Income Statement, Trial
 * Balance totals all just... don't include it, with no error. That money isn't lost from the
 * ledger, just invisible in every report, and it's exactly the kind of thing that makes a
 * debit=credit balance check fail for no apparent reason. Surface it explicitly instead.
 */
export function findUnmappedGlCodes(allAccounts: RollupCoa[], journalEntries: JournalEntry[]): UnmappedGlCode[] {
  const known = new Set(allAccounts.map((a) => a.code));
  const totals: Record<string, { debit: number; credit: number }> = {};

  journalEntries
    .filter((je) => je.status === 'Posted')
    .forEach((je) => {
      je.lines.forEach((line) => {
        const code = line.accountCode;
        if (known.has(code)) return;
        if (!totals[code]) totals[code] = { debit: 0, credit: 0 };
        totals[code].debit += Number(line.debit) || 0;
        totals[code].credit += Number(line.credit) || 0;
      });
    });

  return Object.entries(totals)
    .map(([code, t]) => ({ code, debit: t.debit, credit: t.credit }))
    .filter((u) => Math.abs(u.debit) > 0.005 || Math.abs(u.credit) > 0.005);
}

type BuildMode = { kind: 'period'; startDate: Date; endDate: Date } | { kind: 'cumulative'; endDate: Date };

/**
 * Build hierarchical account balances from posted journal lines.
 * - **period**: IAS 1 profit or loss — movement in [start, end].
 * - **cumulative**: Statement of financial position — all posted entries through end date.
 */
export function buildFinancialAccountTree(allAccounts: RollupCoa[], journalEntries: JournalEntry[], mode: BuildMode): AccountNode[] {
  const accountBalances: Record<string, { debit: number; credit: number }> = {};

  allAccounts.forEach((acc) => {
    accountBalances[acc.code] = { debit: 0, credit: 0 };
  });

  const posted = journalEntries.filter((je) => je.status === 'Posted');
  const startTs = mode.kind === 'period' ? dayStart(mode.startDate).getTime() : null;
  const endTs = dayEnd(mode.endDate).getTime();

  posted.forEach((je) => {
    const t = jeTime(je);
    if (t > endTs) return;
    if (mode.kind === 'period' && startTs !== null && t < startTs) return;
    // A period-close entry zeroes revenue/expense accounts back to nil as of the close date.
    // In cumulative (Balance Sheet) mode that's correct — it's the real effect on retained
    // earnings. But in period mode (Income Statement movement between two dates), including it
    // would cancel out real revenue/expense activity for any period whose range spans the
    // close date, suppressing the very figures the close is supposed to summarize.
    if (mode.kind === 'period' && je.sourceModule === CLOSE_SOURCE) return;

    je.lines.forEach((line) => {
      const code = line.accountCode;
      const accType = allAccounts.find((a) => a.code === code)?.type;
      if (!shouldIncludeJeLineInRevenueRollup(je, accType)) return;

      if (!accountBalances[code]) {
        accountBalances[code] = { debit: 0, credit: 0 };
      }
      accountBalances[code].debit += Number(line.debit) || 0;
      accountBalances[code].credit += Number(line.credit) || 0;
    });
  });

  const linked = enrichRollupCoaParents(allAccounts);
  const byId = new Map(linked.filter((a) => a.id).map((a) => [a.id!, a]));

  const buildTree = (parentKey?: string): AccountNode[] => {
    const children = linked
      .filter((acc) => {
        if (!parentKey) return !acc.parentId;
        if (byId.has(parentKey)) {
          return acc.parentId === parentKey;
        }
        return acc.parentAccount === parentKey;
      })
      .sort((a, b) => codeNum(a.code) - codeNum(b.code));

    return children.map((acc) => {
      const bal = accountBalances[acc.code] || { debit: 0, credit: 0 };
      const childNodes = buildTree(acc.id ?? acc.code);

      const childrenDebit = childNodes.reduce((sum, c) => sum + c.debit, 0);
      const childrenCredit = childNodes.reduce((sum, c) => sum + c.credit, 0);
      const totalDebit = bal.debit + childrenDebit;
      const totalCredit = bal.credit + childrenCredit;

      let balance = 0;
      if (acc.type === 'Asset' || acc.type === 'Expense') {
        balance = totalDebit - totalCredit;
      } else {
        balance = totalCredit - totalDebit;
      }
      if (!Number.isFinite(balance)) balance = 0;

      return {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        category: acc.category || '',
        level: acc.level,
        debit: totalDebit,
        credit: totalCredit,
        balance,
        children: childNodes,
      };
    });
  };

  return buildTree();
}
