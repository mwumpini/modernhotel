/**
 * Actuals for Cost & Revenue Centers from posted journals.
 *
 * A centre with a GL code uses the net posted to that account and its children
 * (credit − debit for revenue, debit − credit for expense). When several centres
 * share one parent account, each is matched to its own child (Restaurant → 4210,
 * Bar → 4220) so the same total is not repeated on every row.
 *
 * A cost centre with no GL code uses journal lines tagged with its code or
 * department, then the legacy manual counter.
 */

import type { JournalEntry, JournalEntryLine, CostCenter, RevenueCenter, ChartOfAccounts } from './models';
import { toRollupCoa } from './coaHierarchy';
import type { RollupCoa } from './financialReportRollup';

export type CenterActual = {
  amount: number;
  /** Set when this row is only the centre's own child of a shared parent. */
  accountCode?: string;
  sharedParent?: boolean;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function netOf(line: JournalEntryLine, kind: 'revenue' | 'expense') {
  const debit = line.debit || 0;
  const credit = line.credit || 0;
  return kind === 'revenue' ? credit - debit : debit - credit;
}

function familyCodes(root: string, chart: RollupCoa[]): Set<string> {
  const codes = new Set<string>([root]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const account of chart) {
      if (account.parentAccount && codes.has(account.parentAccount) && !codes.has(account.code)) {
        codes.add(account.code);
        grew = true;
      }
    }
  }
  return codes;
}

function childAccounts(root: string, chart: RollupCoa[]) {
  return chart.filter((account) => account.parentAccount === root);
}

function blob(center: { code: string; name: string; department: string; type: string }) {
  return `${center.code} ${center.name} ${center.department} ${center.type}`.toLowerCase();
}

function centerMatchesAccountName(center: { code: string; name: string; department: string; type: string }, accountName: string) {
  const text = blob(center);
  const name = accountName.toLowerCase();
  if (name.includes('restaurant') && /restaurant|\brest\b/.test(text)) return true;
  if (/\bbar\b/.test(name) && /\bbar\b/.test(text)) return true;
  if (name.includes('room service') && /room service|room_service|\brs\b/.test(text)) return true;
  if ((name.includes('conference') || name.includes('event')) && /conference|event/.test(text)) return true;
  if (name.includes('room revenue') && /room revenue|\brooms\b|\brm\b/.test(text) && !/room service/.test(text)) return true;
  if (name.includes('service charge') && /service charge|\bsc\b/.test(text)) return true;
  if ((name.includes('housekeeping') || name.includes('linen')) && /housekeeping|\bhk\b/.test(text)) return true;
  if (name.includes('maintenance') && /maintenance|\bmt\b/.test(text)) return true;
  if ((name.includes('food') || name.includes('beverage')) && /food|beverage|kitchen|\bfb\b|\bkt\b/.test(text)) return true;
  return false;
}

function lineTaggedTo(line: JournalEntryLine, center: { code: string; department: string; name: string }) {
  const tags = [line.department, line.costCenter, line.project]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  const keys = [center.code, center.department, center.name].map((value) => value.trim().toLowerCase()).filter(Boolean);
  return tags.some((tag) => keys.includes(tag));
}

function sumLines(
  journalEntries: JournalEntry[],
  codes: Set<string>,
  kind: 'revenue' | 'expense',
  center?: { code: string; department: string; name: string },
  taggedOnly = false
) {
  let total = 0;
  for (const entry of journalEntries) {
    if (entry.status !== 'Posted') continue;
    for (const line of entry.lines || []) {
      if (!codes.has(line.accountCode)) continue;
      if (taggedOnly && (!center || !lineTaggedTo(line, center))) continue;
      total += netOf(line, kind);
    }
  }
  return round2(total);
}

function chartOf(accounts?: ChartOfAccounts[]): RollupCoa[] {
  return accounts?.length ? toRollupCoa(accounts) : [];
}

function resolveCodes(
  glCode: string,
  center: { code: string; name: string; department: string; type: string },
  siblingCount: number,
  chart: RollupCoa[]
): { codes: Set<string>; accountCode: string; sharedParent: boolean } {
  const children = childAccounts(glCode, chart);
  if (siblingCount > 1 && children.length) {
    const matched = children.filter((account) => centerMatchesAccountName(center, account.name));
    if (matched.length === 1) {
      return { codes: familyCodes(matched[0].code, chart), accountCode: matched[0].code, sharedParent: true };
    }
  }
  return { codes: familyCodes(glCode, chart), accountCode: glCode, sharedParent: siblingCount > 1 };
}

export function computeRevenueCenterActual(
  center: RevenueCenter,
  journalEntries: JournalEntry[],
  siblings: RevenueCenter[] = [center],
  accounts?: ChartOfAccounts[]
): CenterActual {
  if (!center.glAccountCode) {
    return { amount: center.actualRevenue || 0 };
  }
  const chart = chartOf(accounts);
  const siblingCount = siblings.filter((item) => item.glAccountCode === center.glAccountCode).length;
  const resolved = chart.length
    ? resolveCodes(center.glAccountCode, center, siblingCount, chart)
    : { codes: new Set([center.glAccountCode]), accountCode: center.glAccountCode, sharedParent: siblingCount > 1 };

  if (resolved.sharedParent && resolved.accountCode === center.glAccountCode) {
    return {
      amount: sumLines(journalEntries, resolved.codes, 'revenue', center, true),
      accountCode: center.glAccountCode,
      sharedParent: true,
    };
  }
  return {
    amount: sumLines(journalEntries, resolved.codes, 'revenue'),
    accountCode: resolved.accountCode,
    sharedParent: resolved.sharedParent,
  };
}

export function computeCostCenterActual(
  center: CostCenter,
  journalEntries: JournalEntry[],
  siblings: CostCenter[] = [center],
  accounts?: ChartOfAccounts[]
): CenterActual {
  const chart = chartOf(accounts);
  if (center.glAccountCode) {
    const siblingCount = siblings.filter((item) => item.glAccountCode === center.glAccountCode).length;
    const resolved = chart.length
      ? resolveCodes(center.glAccountCode, center, siblingCount, chart)
      : { codes: new Set([center.glAccountCode]), accountCode: center.glAccountCode, sharedParent: siblingCount > 1 };
    if (resolved.sharedParent && resolved.accountCode === center.glAccountCode) {
      const tagged = sumLines(journalEntries, resolved.codes, 'expense', center, true);
      return { amount: tagged, accountCode: center.glAccountCode, sharedParent: true };
    }
    return {
      amount: sumLines(journalEntries, resolved.codes, 'expense'),
      accountCode: resolved.accountCode,
      sharedParent: resolved.sharedParent,
    };
  }

  const tagged = sumLines(
    journalEntries,
    new Set(chart.filter((account) => account.type === 'Expense').map((account) => account.code)),
    'expense',
    center,
    true
  );
  if (Math.abs(tagged) > 0.004) return { amount: tagged };
  return { amount: center.actualExpenses || 0 };
}
