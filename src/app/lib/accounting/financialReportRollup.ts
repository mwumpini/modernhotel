import type { JournalEntry } from './models';
import { shouldIncludeJeLineInRevenueRollup } from './revenueSourcePolicy';

/** Minimal COA row for roll-ups (store or Ghana template). */
export type RollupCoa = {
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  category?: string;
  level: number;
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
  if (!code) return false;
  const c = code.trim();
  return c === '1000' || c === '1100' || c === '1110' || c === '1120';
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

    je.lines.forEach((line) => {
      const code = line.accountCode;
      const accType = allAccounts.find((a) => a.code === code)?.type;
      if (!shouldIncludeJeLineInRevenueRollup(je, accType)) return;

      if (!accountBalances[code]) {
        accountBalances[code] = { debit: 0, credit: 0 };
      }
      accountBalances[code].debit += line.debit || 0;
      accountBalances[code].credit += line.credit || 0;
    });
  });

  const buildTree = (parentCode?: string, parentLevel?: number): AccountNode[] => {
    const targetLevel = parentLevel !== undefined ? parentLevel + 1 : 1;

    const children = allAccounts.filter((acc) => {
      if (acc.level !== targetLevel) return false;
      if (!parentCode) return true;
      const parentPrefix = parentCode.slice(0, parentLevel === 1 ? 2 : parentLevel === 2 ? 3 : 4);
      return acc.code.startsWith(parentPrefix);
    });

    return children.map((acc) => {
      const bal = accountBalances[acc.code] || { debit: 0, credit: 0 };
      const childNodes = buildTree(acc.code, acc.level);

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
