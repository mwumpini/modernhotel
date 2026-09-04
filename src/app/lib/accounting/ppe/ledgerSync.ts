import { toRollupCoa } from '../coaHierarchy';
import type { JournalEntry } from '../models';
import { GHANA_CHART_OF_ACCOUNTS } from '../models';
import { buildFinancialAccountTree, type AccountNode, type RollupCoa } from '../financialReportRollup';
import { useAccountingStore } from '../store';
import type { PpeAsset, PpeCategory } from './types';
import { assetTotalCost, reportDateFromInput } from './calculations';
import { computeAllAssets } from './aggregations';

const GL_COST = '1510';
const GL_ACCUM_DEP = '1520';
const GL_DEP_EXP = '5710';
const GL_AP = '2200';

export interface PpeLedgerBalances {
  cost1510: number;
  accumDep1520: number;
  nbv: number;
}

export interface PpeRegisterBookTotals {
  cost: number;
  accumDep: number;
  nbv: number;
  assetCount: number;
}

export interface PpeLedgerReconciliation {
  reportDate: string;
  gl: PpeLedgerBalances;
  register: PpeRegisterBookTotals;
  costGap: number;
  accumDepGap: number;
  nbvGap: number;
  inSync: boolean;
  uncapitalizedCount: number;
  depPostingGap: number;
}

export interface PpeSyncResult {
  ok: boolean;
  capitalized: number;
  depreciationPosted: number;
  messages: string[];
  errors: string[];
}

function flattenTree(nodes: AccountNode[]): AccountNode[] {
  const out: AccountNode[] = [];
  const walk = (list: AccountNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

function resolveCoa(chartOfAccounts: RollupCoa[] | undefined): RollupCoa[] {
  const raw = chartOfAccounts?.length ? chartOfAccounts : GHANA_CHART_OF_ACCOUNTS;
  return toRollupCoa(raw);
}

/** GL 1510 / 1520 balances through report date (posted journals). */
export function getGlFixedAssetBalances(
  journalEntries: JournalEntry[],
  chartOfAccounts: RollupCoa[] | undefined,
  reportDate: Date
): PpeLedgerBalances {
  const tree = buildFinancialAccountTree(resolveCoa(chartOfAccounts), journalEntries, {
    kind: 'cumulative',
    endDate: reportDate,
  });
  const flat = flattenTree(tree);
  const n1510 = flat.find((n) => n.code === GL_COST);
  const n1520 = flat.find((n) => n.code === GL_ACCUM_DEP);
  const cost1510 = n1510?.balance ?? 0;
  /** 1520 is contra-asset: credits reduce NBV (balance typically negative). */
  const accumDep1520 = n1520 ? Math.max(0, n1520.credit - n1520.debit) : 0;
  const nbv = cost1510 - accumDep1520;
  return { cost1510, accumDep1520, nbv };
}

/** IAS book totals from PPE register at report date. */
export function getPpeRegisterBookTotals(
  assets: PpeAsset[],
  categories: PpeCategory[],
  reportDate: Date
): PpeRegisterBookTotals {
  const rows = computeAllAssets(assets, categories, reportDate).filter(
    (r) => r.asset.capExp === 'Capitalise'
  );
  return {
    cost: rows.reduce((s, r) => s + r.computed.totalCost, 0),
    accumDep: rows.reduce((s, r) => s + r.computed.accumDep, 0),
    nbv: rows.reduce((s, r) => s + r.computed.nbv, 0),
    assetCount: rows.length,
  };
}

export function reconcilePpeToLedger(
  assets: PpeAsset[],
  categories: PpeCategory[],
  journalEntries: JournalEntry[],
  chartOfAccounts: RollupCoa[] | undefined,
  reportDateStr: string
): PpeLedgerReconciliation {
  const reportDate = reportDateFromInput(reportDateStr);
  const gl = getGlFixedAssetBalances(journalEntries, chartOfAccounts, reportDate);
  const register = getPpeRegisterBookTotals(assets, categories, reportDate);
  const costGap = +(register.cost - gl.cost1510).toFixed(2);
  const accumDepGap = +(register.accumDep - gl.accumDep1520).toFixed(2);
  const nbvGap = +(register.nbv - gl.nbv).toFixed(2);
  const uncapitalizedCount = assets.filter(
    (a) => a.capExp === 'Capitalise' && !a.capitalizationJournalEntryId
  ).length;
  const depPostingGap = assets
    .filter((a) => a.capExp === 'Capitalise')
    .reduce((s, a) => {
      const row = computeAllAssets([a], categories, reportDate)[0];
      const posted = a.ledgerAccumDepPosted ?? 0;
      return s + Math.max(0, (row?.computed.accumDep ?? 0) - posted);
    }, 0);

  return {
    reportDate: reportDateStr,
    gl,
    register,
    costGap,
    accumDepGap,
    nbvGap,
    inSync:
      Math.abs(costGap) < 0.01 &&
      Math.abs(accumDepGap) < 0.01 &&
      uncapitalizedCount === 0,
    uncapitalizedCount,
    depPostingGap: +depPostingGap.toFixed(2),
  };
}

function lineId() {
  return `JEL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function jeNumber() {
  return `JE-${Date.now().toString().slice(-8)}`;
}

export function capturePpeCapitalization(input: {
  ppeAssetId: string;
  assetCode: string;
  name: string;
  purchaseDate: string;
  cost: number;
  paymentGlCode?: string;
}): { journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const jeId = `JE-PPE-CAP-${Date.now()}`;
  const creditGl = input.paymentGlCode || GL_AP;

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.purchaseDate.slice(0, 10),
    reference: input.assetCode,
    description: `PPE capitalization — ${input.name}`,
    totalDebit: input.cost,
    totalCredit: input.cost,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'ppe_register_capitalize',
    sourceTransactionId: input.ppeAssetId,
    lines: [
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: GL_COST,
        description: 'Property & equipment',
        debit: input.cost,
        credit: 0,
        currency: 'GHS',
      },
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: creditGl,
        description: 'Settlement — AP / cash',
        debit: 0,
        credit: input.cost,
        currency: 'GHS',
      },
    ],
  };

  try {
    store.addJournalEntry(je as JournalEntry);
    store.addAuditTrail({
      id: `AT-PPE-CAP-${Date.now()}`,
      tableName: 'PpeAsset',
      recordId: input.ppeAssetId,
      action: 'Post',
      newValues: { type: 'ppe_capitalize', journalEntryId: jeId, cost: input.cost },
      userId: 'system',
      timestamp: now,
    });
    return { journalEntryId: jeId };
  } catch {
    return null;
  }
}

export function capturePpeBookDepreciation(input: {
  ppeAssetId: string;
  assetCode: string;
  name: string;
  amount: number;
  date: string;
  period: string;
}): { journalEntryId: string } | null {
  if (input.amount <= 0) return null;
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const jeId = `JE-PPE-DEP-${Date.now()}`;

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.date.slice(0, 10),
    reference: input.assetCode,
    description: `PPE book depreciation ${input.period} — ${input.name}`,
    totalDebit: input.amount,
    totalCredit: input.amount,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'ppe_register_depreciation',
    sourceTransactionId: input.ppeAssetId,
    lines: [
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: GL_DEP_EXP,
        description: 'Depreciation expense',
        debit: input.amount,
        credit: 0,
        currency: 'GHS',
      },
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: GL_ACCUM_DEP,
        description: 'Accumulated depreciation',
        debit: 0,
        credit: input.amount,
        currency: 'GHS',
      },
    ],
  };

  try {
    store.addJournalEntry(je as JournalEntry);
    store.addAuditTrail({
      id: `AT-PPE-DEP-${Date.now()}`,
      tableName: 'PpeAsset',
      recordId: input.ppeAssetId,
      action: 'Post',
      newValues: { type: 'ppe_depreciation', journalEntryId: jeId, amount: input.amount },
      userId: 'system',
      timestamp: now,
    });
    return { journalEntryId: jeId };
  } catch {
    return null;
  }
}

/** Posts the cost delta when an already-capitalized asset's cost changes (quantity/unit price
 *  edited after capitalization). The original capitalization JE is left untouched — this adds
 *  a separate correcting entry, so the GL catches up to the register's new cost instead of
 *  silently drifting from it. `delta` may be negative (a downward cost correction). */
export function capturePpeCostAdjustment(input: {
  ppeAssetId: string;
  assetCode: string;
  name: string;
  date: string;
  delta: number;
  paymentGlCode?: string;
}): { journalEntryId: string } | null {
  if (Math.abs(input.delta) < 0.01) return null;
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const jeId = `JE-PPE-ADJ-${Date.now()}`;
  const amount = Math.abs(input.delta);
  const isIncrease = input.delta > 0;
  const otherGl = input.paymentGlCode || GL_AP;

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.date.slice(0, 10),
    reference: input.assetCode,
    description: `PPE cost adjustment (${isIncrease ? 'increase' : 'decrease'}) — ${input.name}`,
    totalDebit: amount,
    totalCredit: amount,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'ppe_register_cost_adjustment',
    sourceTransactionId: input.ppeAssetId,
    lines: [
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: GL_COST,
        description: 'Property & equipment — cost adjustment',
        debit: isIncrease ? amount : 0,
        credit: isIncrease ? 0 : amount,
        currency: 'GHS',
      },
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: otherGl,
        description: 'Settlement — AP / cash (cost adjustment)',
        debit: isIncrease ? 0 : amount,
        credit: isIncrease ? amount : 0,
        currency: 'GHS',
      },
    ],
  };

  try {
    store.addJournalEntry(je as JournalEntry);
    store.addAuditTrail({
      id: `AT-PPE-ADJ-${Date.now()}`,
      tableName: 'PpeAsset',
      recordId: input.ppeAssetId,
      action: 'Post',
      newValues: { type: 'ppe_cost_adjustment', journalEntryId: jeId, delta: input.delta },
      userId: 'system',
      timestamp: now,
    });
    return { journalEntryId: jeId };
  } catch {
    return null;
  }
}

export function syncPpeRegisterToLedger(
  assets: PpeAsset[],
  categories: PpeCategory[],
  reportDateStr: string,
  callbacks: {
    setCapitalizationJournalId: (assetId: string, journalEntryId: string) => void;
    setLedgerAccumDepPosted: (assetId: string, amount: number, journalEntryId?: string) => void;
  }
): PpeSyncResult {
  const reportDate = reportDateFromInput(reportDateStr);
  const messages: string[] = [];
  const errors: string[] = [];
  let capitalized = 0;
  let depreciationPosted = 0;

  for (const asset of assets) {
    if (asset.capExp !== 'Capitalise') continue;

    if (!asset.capitalizationJournalEntryId) {
      const cost = assetTotalCost(asset);
      const result = capturePpeCapitalization({
        ppeAssetId: asset.id,
        assetCode: asset.assetCode,
        name: asset.assetName,
        purchaseDate: asset.purchaseDate,
        cost,
      });
      if (result) {
        callbacks.setCapitalizationJournalId(asset.id, result.journalEntryId);
        capitalized += 1;
        messages.push(`Capitalized ${asset.assetCode} → GL ${GL_COST}`);
      } else {
        errors.push(`Failed to capitalize ${asset.assetCode}`);
      }
    }

    const row = computeAllAssets([asset], categories, reportDate)[0];
    if (!row) continue;
    const targetAccum = row.computed.accumDep;
    const postedAccum = asset.ledgerAccumDepPosted ?? 0;
    const gap = +(targetAccum - postedAccum).toFixed(2);
    if (gap > 0.01) {
      const period = reportDateStr.slice(0, 7);
      const result = capturePpeBookDepreciation({
        ppeAssetId: asset.id,
        assetCode: asset.assetCode,
        name: asset.assetName,
        amount: gap,
        date: reportDateStr,
        period,
      });
      if (result) {
        callbacks.setLedgerAccumDepPosted(asset.id, targetAccum, result.journalEntryId);
        depreciationPosted += gap;
        messages.push(`Book dep ${asset.assetCode}: ${gap.toFixed(2)} → GL ${GL_DEP_EXP}/${GL_ACCUM_DEP}`);
      } else {
        errors.push(`Failed to post depreciation for ${asset.assetCode}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    capitalized,
    depreciationPosted,
    messages,
    errors,
  };
}

