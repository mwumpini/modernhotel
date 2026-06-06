import type { JournalEntry } from './models';
import { buildFinancialAccountTree, type RollupCoa, type AccountNode } from './financialReportRollup';

function flattenNodes(nodes: AccountNode[]): AccountNode[] {
  const out: AccountNode[] = [];
  for (const n of nodes) {
    out.push(n);
    out.push(...flattenNodes(n.children));
  }
  return out;
}

/** Sum only top-level COA roots (balances already include children). */
function sumRootBalancesByType(tree: AccountNode[], type: string): number {
  return tree.filter((n) => n.type === type).reduce((s, n) => s + n.balance, 0);
}

function balanceForEquityCode(tree: AccountNode[], code: string): number {
  const hit = flattenNodes(tree).find((n) => n.code === code);
  return hit ? hit.balance : 0;
}

/** Last moment before reporting period (for opening balances). */
export function lastInstantBeforePeriod(startDate: Date): Date {
  const d = new Date(startDate);
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 999);
  return d;
}

export type SocieRow = {
  key: string;
  label: string;
  shareCapital: number;
  retainedAndOther: number;
  total: number;
};

export type SocieModel = {
  rows: SocieRow[];
  opening: { share: number; retained: number; total: number };
  closing: { share: number; retained: number; total: number };
  profitForPeriod: number;
  otherMovement: number;
};

/**
 * IAS 1-style statement of changes in equity (share capital vs retained & other).
 */
export function buildStatementOfChangesInEquity(
  journalEntries: JournalEntry[],
  coa: RollupCoa[],
  startDate: Date,
  endDate: Date,
  profitForPeriod: number
): SocieModel {
  const openingEnd = lastInstantBeforePeriod(startDate);
  const openTree = buildFinancialAccountTree(coa, journalEntries, { kind: 'cumulative', endDate: openingEnd });
  const closeTree = buildFinancialAccountTree(coa, journalEntries, { kind: 'cumulative', endDate });

  const openAssets = sumRootBalancesByType(openTree, 'Asset');
  const openLiab = sumRootBalancesByType(openTree, 'Liability');
  const openTotalEq = openAssets - openLiab;

  const closeAssets = sumRootBalancesByType(closeTree, 'Asset');
  const closeLiab = sumRootBalancesByType(closeTree, 'Liability');
  const closeTotalEq = closeAssets - closeLiab;

  const openShare = balanceForEquityCode(openTree, '3100');
  const closeShare = balanceForEquityCode(closeTree, '3100');

  const openRetOther = openTotalEq - openShare;
  const closeRetOther = closeTotalEq - closeShare;

  const shareMovement = closeShare - openShare;
  const otherTotal = closeTotalEq - openTotalEq - profitForPeriod;
  const retainedMovement = otherTotal - shareMovement;

  const rows: SocieRow[] = [
    {
      key: 'open',
      label: 'Balance at beginning of period',
      shareCapital: openShare,
      retainedAndOther: openRetOther,
      total: openTotalEq,
    },
    {
      key: 'profit',
      label: 'Profit / (loss) for the period (total comprehensive income — no OCI in this build)',
      shareCapital: 0,
      retainedAndOther: profitForPeriod,
      total: profitForPeriod,
    },
    {
      key: 'other',
      label: 'Other movements (share issues, dividends, period close, rounding)',
      shareCapital: shareMovement,
      retainedAndOther: retainedMovement,
      total: otherTotal,
    },
    {
      key: 'close',
      label: 'Balance at end of period',
      shareCapital: closeShare,
      retainedAndOther: closeRetOther,
      total: closeTotalEq,
    },
  ];

  return {
    rows,
    opening: { share: openShare, retained: openRetOther, total: openTotalEq },
    closing: { share: closeShare, retained: closeRetOther, total: closeTotalEq },
    profitForPeriod,
    otherMovement: otherTotal,
  };
}
