/**
 * Journal-entry-driven financial rollups for store getters (trial balance, P&L, balance sheet, cash flow).
 * Uses the same COA / JE semantics as FinancialReports + financialReportRollup.
 */

import { toRollupCoa } from './coaHierarchy';
import type { ChartOfAccounts, GLBalance, JournalEntry } from './models';
import { GHANA_CHART_OF_ACCOUNTS } from './models';
import type { AccountNode, RollupCoa } from './financialReportRollup';
import { buildFinancialAccountTree, computeCashFlowFromJournals } from './financialReportRollup';

/** Ghana template as roll-up rows when the store COA list is still empty. */
export function defaultRollupCoa(): RollupCoa[] {
  return toRollupCoa(GHANA_CHART_OF_ACCOUNTS);
}

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

export function coaToRollup(chartOfAccounts: ChartOfAccounts[], fallback: RollupCoa[]): RollupCoa[] {
  const raw = chartOfAccounts.length > 0 ? chartOfAccounts : [];
  if (raw.length === 0) return fallback;
  return toRollupCoa(raw);
}

/** Resolve `YYYY-MM` to calendar month bounds (local). */
export function periodToMonthRange(period: string): { startDate: Date; endDate: Date; openingEndDate: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!m) {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth() + 1;
    return periodToMonthRange(`${y}-${String(mo).padStart(2, '0')}`);
  }
  const y = Number(m[1]);
  const month = Number(m[2]);
  const startDate = dayStart(new Date(y, month - 1, 1));
  const lastDom = new Date(y, month, 0).getDate();
  const endDate = dayEnd(new Date(y, month - 1, lastDom));
  const openingEndDate = dayEnd(new Date(y, month - 1, 0));
  return { startDate, endDate, openingEndDate };
}

function inferTypeFromCode(code: string): ChartOfAccounts['type'] {
  const c = (code || '').trim();
  const n = parseInt(c[0] || '0', 10);
  if (n === 1) return 'Asset';
  if (n === 2) return 'Liability';
  if (n === 3) return 'Equity';
  if (n === 4) return 'Revenue';
  return 'Expense';
}

function accountTypeForCode(code: string, rollup: RollupCoa[]): ChartOfAccounts['type'] {
  const row = rollup.find((r) => r.code === code);
  return row?.type || inferTypeFromCode(code);
}

function collectAccountCodes(rollup: RollupCoa[], journalEntries: JournalEntry[]): string[] {
  const set = new Set<string>();
  rollup.forEach((r) => set.add(r.code));
  journalEntries.forEach((je) => {
    (je.lines || []).forEach((l) => {
      if (l.accountCode) set.add(l.accountCode.trim());
    });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function aggregateAccount(
  journalEntries: JournalEntry[],
  accountCode: string,
  endInclusive: Date
): { debit: number; credit: number } {
  let debit = 0;
  let credit = 0;
  const endTs = dayEnd(endInclusive).getTime();
  for (const je of journalEntries) {
    if (je.status !== 'Posted') continue;
    if (jeTime(je) > endTs) continue;
    for (const line of je.lines || []) {
      if (line.accountCode !== accountCode) continue;
      debit += line.debit || 0;
      credit += line.credit || 0;
    }
  }
  return { debit, credit };
}

function aggregateAccountPeriod(
  journalEntries: JournalEntry[],
  accountCode: string,
  startDate: Date,
  endDate: Date
): { debit: number; credit: number } {
  let debit = 0;
  let credit = 0;
  const startTs = dayStart(startDate).getTime();
  const endTs = dayEnd(endDate).getTime();
  for (const je of journalEntries) {
    if (je.status !== 'Posted') continue;
    const t = jeTime(je);
    if (t < startTs || t > endTs) continue;
    for (const line of je.lines || []) {
      if (line.accountCode !== accountCode) continue;
      debit += line.debit || 0;
      credit += line.credit || 0;
    }
  }
  return { debit, credit };
}

/** Signed balance: debit-normal accounts positive when debits exceed credits. */
export function signedBalance(
  type: ChartOfAccounts['type'],
  totalDebit: number,
  totalCredit: number
): number {
  if (type === 'Asset' || type === 'Expense') return totalDebit - totalCredit;
  return totalCredit - totalDebit;
}

export function computeTrialBalanceGLBalances(
  chartOfAccounts: ChartOfAccounts[],
  journalEntries: JournalEntry[],
  rollupFallback: RollupCoa[],
  period: string,
  currency = 'GHS'
): GLBalance[] {
  const rollup = coaToRollup(chartOfAccounts, rollupFallback);
  const { startDate, endDate, openingEndDate } = periodToMonthRange(period);
  const codes = collectAccountCodes(rollup, journalEntries);
  const now = new Date().toISOString();
  const rows: GLBalance[] = [];

  for (const code of codes) {
    const type = accountTypeForCode(code, rollup);
    const openAgg = aggregateAccount(journalEntries, code, openingEndDate);
    const periodAgg = aggregateAccountPeriod(journalEntries, code, startDate, endDate);
    const closeAgg = {
      debit: openAgg.debit + periodAgg.debit,
      credit: openAgg.credit + periodAgg.credit,
    };

    const openingBalance = signedBalance(type, openAgg.debit, openAgg.credit);
    const closingBalance = signedBalance(type, closeAgg.debit, closeAgg.credit);

    if (
      periodAgg.debit < 0.005 &&
      periodAgg.credit < 0.005 &&
      Math.abs(openingBalance) < 0.005 &&
      Math.abs(closingBalance) < 0.005
    ) {
      continue;
    }

    rows.push({
      id: `tb-${code}-${period}`,
      accountCode: code,
      period,
      openingBalance,
      currentDebit: periodAgg.debit,
      currentCredit: periodAgg.credit,
      closingBalance,
      currency,
      lastUpdated: now,
    });
  }

  return rows;
}

export type IncomeStatementJE = {
  period: string;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  grossProfit: number;
  operatingExpenses: number;
  revenueByAccount: { code: string; name: string; amount: number }[];
  expenseByAccount: { code: string; name: string; amount: number }[];
};

export function computeIncomeStatementFromJE(
  chartOfAccounts: ChartOfAccounts[],
  journalEntries: JournalEntry[],
  rollupFallback: RollupCoa[],
  period: string
): IncomeStatementJE {
  const rollup = coaToRollup(chartOfAccounts, rollupFallback);
  const { startDate, endDate } = periodToMonthRange(period);
  const tree = buildFinancialAccountTree(rollup, journalEntries, { kind: 'period', startDate, endDate });
  const revenueNodes = tree.filter((n) => n.type === 'Revenue');
  const expenseNodes = tree.filter((n) => n.type === 'Expense');

  const totalRevenue = revenueNodes.reduce((s, n) => s + n.balance, 0);
  const totalExpenses = expenseNodes.reduce((s, n) => s + n.balance, 0);
  const netIncome = totalRevenue - totalExpenses;

  const cogs = expenseNodes
    .filter((n) => n.code.startsWith('51'))
    .reduce((s, n) => s + n.balance, 0);
  const grossProfit = totalRevenue - cogs;
  const operatingExpenses = Math.max(0, totalExpenses - cogs);

  const nameLookup = new Map(rollup.map((r) => [r.code, r.name]));
  const revenueByAccount = revenueNodes
    .filter((n) => Math.abs(n.balance) > 0.005)
    .map((n) => ({ code: n.code, name: nameLookup.get(n.code) || n.name, amount: n.balance }));
  const expenseByAccount = expenseNodes
    .filter((n) => Math.abs(n.balance) > 0.005)
    .map((n) => ({ code: n.code, name: nameLookup.get(n.code) || n.name, amount: n.balance }));

  return {
    period,
    totalRevenue,
    totalExpenses,
    netIncome,
    grossProfit,
    operatingExpenses,
    revenueByAccount,
    expenseByAccount,
  };
}

export type CashFlowJE = {
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  netCashFlow: number;
  openingCash: number;
  closingCash: number;
  reconciliationDiff: number;
};

export function computeCashFlowForPeriod(
  journalEntries: JournalEntry[],
  period: string
): CashFlowJE {
  const { startDate, endDate } = periodToMonthRange(period);
  const cf = computeCashFlowFromJournals(journalEntries, startDate, endDate);
  return {
    operatingCashFlow: cf.operating,
    investingCashFlow: cf.investing,
    financingCashFlow: cf.financing,
    netCashFlow: cf.netChange,
    openingCash: cf.openingCash,
    closingCash: cf.closingCash,
    reconciliationDiff: cf.reconciliationDiff,
  };
}
