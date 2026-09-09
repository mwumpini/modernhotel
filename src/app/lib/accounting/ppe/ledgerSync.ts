import { toRollupCoa } from '../coaHierarchy';
import type { JournalEntry, JournalEntryLine, ChartOfAccounts } from '../models';
import { GHANA_CHART_OF_ACCOUNTS } from '../models';
import { buildFinancialAccountTree, type AccountNode, type RollupCoa } from '../financialReportRollup';
import { useAccountingStore } from '../store';
import type { PpeAsset, PpeCategory } from './types';
import { assetTotalCost, reportDateFromInput, accumDep } from './calculations';
import { computeAllAssets } from './aggregations';
import { assertPeriodNotClosed } from '../periodClose';
import { logAccountingProcessWarn } from '../accountingProcessLog';

const GL_COST = '1510';
const GL_ACCUM_DEP = '1520';
const GL_DEP_EXP = '5710';
// 2200 is the "Accounts Payable" category HEADER (see GHANA_CHART_OF_ACCOUNTS in models.ts) —
// its only declared children are 2210/2220 (payroll withholdings), not trade payables. 2205 is
// the actual postable leaf, matching GL_ACCOUNTS.ACCOUNTS_PAYABLE in integration.ts.
const GL_AP = '2205';
const GL_GAIN_ON_DISPOSAL = '4310';
const GL_LOSS_ON_DISPOSAL = '5690';
// 1100 is the "Cash and Cash Equivalents" category HEADER — 1110 (Cash in Hand) is the leaf,
// matching GL_ACCOUNTS.CASH in integration.ts.
const GL_DEFAULT_PROCEEDS = '1110';

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
  pendingDisposalCount: number;
  depPostingGap: number;
}

export interface PpeSyncResult {
  ok: boolean;
  capitalized: number;
  depreciationPosted: number;
  disposed: number;
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

function resolveCoa(chartOfAccounts: ChartOfAccounts[] | RollupCoa[] | undefined): RollupCoa[] {
  const raw = chartOfAccounts?.length ? chartOfAccounts : GHANA_CHART_OF_ACCOUNTS;
  return toRollupCoa(raw);
}

/** GL 1510 / 1520 balances through report date (posted journals). */
export function getGlFixedAssetBalances(
  journalEntries: JournalEntry[],
  chartOfAccounts: ChartOfAccounts[] | RollupCoa[] | undefined,
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
  chartOfAccounts: ChartOfAccounts[] | RollupCoa[] | undefined,
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
  const pendingDisposalCount = assets.filter(
    (a) => a.capExp === 'Disposed' && a.disposalDate && !a.disposalJournalEntryId
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
      uncapitalizedCount === 0 &&
      pendingDisposalCount === 0,
    uncapitalizedCount,
    pendingDisposalCount,
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
  /** Paid from a real Bank & Cash account — takes priority over paymentGlCode and also
   *  records the withdrawal against that account's own transaction history/balance. */
  paymentBankAccountId?: string;
}): { journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const periodCheck = assertPeriodNotClosed(store.journalEntries, input.purchaseDate);
  if (!periodCheck.ok) {
    logAccountingProcessWarn('PpeCapitalization', 'PPE capitalization GL post blocked — closed period', {
      ppeAssetId: input.ppeAssetId,
      error: periodCheck.error,
    });
    return null;
  }
  const jeId = `JE-PPE-CAP-${Date.now()}`;
  const bank = input.paymentBankAccountId
    ? store.bankAccounts.find((b) => b.id === input.paymentBankAccountId)
    : undefined;
  const creditGl = bank?.glAccountCode || input.paymentGlCode || GL_AP;

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

    // Paid from a real Bank & Cash account — reflect the withdrawal in that account's own
    // transaction history and running balance too (mirrors disposal proceeds the other way).
    if (bank) {
      const newBalance = Math.round(((bank.currentBalance ?? 0) - input.cost) * 100) / 100;
      store.updateBankAccount(bank.id, { currentBalance: newBalance, updatedAt: now });
      store.addBankTransaction({
        id: `BT-PPE-CAP-${jeId}`,
        bankAccountId: bank.id,
        transactionDate: input.purchaseDate.slice(0, 10),
        reference: input.assetCode,
        description: `Asset purchase — ${input.name}`,
        amount: input.cost,
        type: 'Withdrawal',
        currency: bank.currency || 'GHS',
        balance: newBalance,
        status: 'Cleared',
        journalEntryId: jeId,
        createdAt: now,
      });
    }

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

/** Posts book depreciation catch-up for the period. `amount` may be negative — this happens
 *  when an asset's already-posted accum. dep (from an earlier "Sync to ledger" run against a
 *  later report date) exceeds what's actually due as of a newly-recorded, earlier disposal
 *  date; a negative amount posts the reversing entry (Dr accum dep / Cr dep expense) so the
 *  disposal write-off always matches what's really in the GL. */
export function capturePpeBookDepreciation(input: {
  ppeAssetId: string;
  assetCode: string;
  name: string;
  amount: number;
  date: string;
  period: string;
}): { journalEntryId: string } | null {
  if (Math.abs(input.amount) < 0.01) return null;
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const periodCheck = assertPeriodNotClosed(store.journalEntries, input.date);
  if (!periodCheck.ok) {
    logAccountingProcessWarn('PpeBookDepreciation', 'PPE depreciation GL post blocked — closed period', {
      ppeAssetId: input.ppeAssetId,
      error: periodCheck.error,
    });
    return null;
  }
  const jeId = `JE-PPE-DEP-${Date.now()}`;
  const isReversal = input.amount < 0;
  const amount = Math.abs(input.amount);

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.date.slice(0, 10),
    reference: input.assetCode,
    description: `PPE book depreciation${isReversal ? ' reversal' : ''} ${input.period} — ${input.name}`,
    totalDebit: amount,
    totalCredit: amount,
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
        description: isReversal ? 'Depreciation expense reversal' : 'Depreciation expense',
        debit: isReversal ? 0 : amount,
        credit: isReversal ? amount : 0,
        currency: 'GHS',
      },
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: GL_ACCUM_DEP,
        description: isReversal ? 'Accumulated depreciation reversal' : 'Accumulated depreciation',
        debit: isReversal ? amount : 0,
        credit: isReversal ? 0 : amount,
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
  const periodCheck = assertPeriodNotClosed(store.journalEntries, input.date);
  if (!periodCheck.ok) {
    logAccountingProcessWarn('PpeCostAdjustment', 'PPE cost adjustment GL post blocked — closed period', {
      ppeAssetId: input.ppeAssetId,
      error: periodCheck.error,
    });
    return null;
  }
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

/** Writes off an asset's cost and accumulated depreciation on disposal and books the
 *  gain or loss (proceeds vs. NBV at disposal) to 4310/5690. Balances by construction:
 *  Dr accumDep + Dr proceeds + Dr loss(if any) == Cr cost + Cr gain(if any). */
export function capturePpeDisposal(input: {
  ppeAssetId: string;
  assetCode: string;
  name: string;
  disposalDate: string;
  cost: number;
  accumDepAtDisposal: number;
  proceeds: number;
  proceedsBankAccountId?: string;
}): { journalEntryId: string; gainLoss: number } | null {
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const periodCheck = assertPeriodNotClosed(store.journalEntries, input.disposalDate);
  if (!periodCheck.ok) {
    logAccountingProcessWarn('PpeDisposal', 'PPE disposal GL post blocked — closed period', {
      ppeAssetId: input.ppeAssetId,
      error: periodCheck.error,
    });
    return null;
  }
  const jeId = `JE-PPE-DISP-${Date.now()}`;
  const nbv = +(input.cost - input.accumDepAtDisposal).toFixed(2);
  const gainLoss = +(input.proceeds - nbv).toFixed(2);
  const bank = input.proceedsBankAccountId
    ? store.bankAccounts.find((b) => b.id === input.proceedsBankAccountId)
    : undefined;
  const proceedsGl = bank?.glAccountCode || GL_DEFAULT_PROCEEDS;

  const lines: JournalEntryLine[] = [];
  if (input.accumDepAtDisposal > 0.004) {
    lines.push({ id: lineId(), journalEntryId: jeId, accountCode: GL_ACCUM_DEP, description: 'Remove accumulated depreciation on disposal', debit: input.accumDepAtDisposal, credit: 0, currency: 'GHS' });
  }
  if (input.proceeds > 0.004) {
    lines.push({ id: lineId(), journalEntryId: jeId, accountCode: proceedsGl, description: 'Disposal proceeds', debit: input.proceeds, credit: 0, currency: 'GHS' });
  }
  lines.push({ id: lineId(), journalEntryId: jeId, accountCode: GL_COST, description: 'Remove asset cost on disposal', debit: 0, credit: input.cost, currency: 'GHS' });
  if (gainLoss > 0.004) {
    lines.push({ id: lineId(), journalEntryId: jeId, accountCode: GL_GAIN_ON_DISPOSAL, description: 'Gain on disposal', debit: 0, credit: gainLoss, currency: 'GHS' });
  } else if (gainLoss < -0.004) {
    lines.push({ id: lineId(), journalEntryId: jeId, accountCode: GL_LOSS_ON_DISPOSAL, description: 'Loss on disposal', debit: -gainLoss, credit: 0, currency: 'GHS' });
  }

  const totalDebit = +lines.reduce((s, l) => s + l.debit, 0).toFixed(2);
  const totalCredit = +lines.reduce((s, l) => s + l.credit, 0).toFixed(2);

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.disposalDate.slice(0, 10),
    reference: input.assetCode,
    description: `PPE disposal — ${input.name}`,
    totalDebit,
    totalCredit,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'ppe_register_disposal',
    sourceTransactionId: input.ppeAssetId,
    lines,
  };

  try {
    store.addJournalEntry(je);

    // Proceeds went into a real Bank & Cash account — reflect the deposit in that account's
    // own transaction history and running balance too, not just as a bare GL line (mirrors
    // how bank reconciliation's book-side postings keep the register in step with the GL).
    if (bank && input.proceeds > 0.004) {
      const newBalance = Math.round(((bank.currentBalance ?? 0) + input.proceeds) * 100) / 100;
      store.updateBankAccount(bank.id, { currentBalance: newBalance, updatedAt: now });
      store.addBankTransaction({
        id: `BT-PPE-DISP-${jeId}`,
        bankAccountId: bank.id,
        transactionDate: input.disposalDate.slice(0, 10),
        reference: input.assetCode,
        description: `Disposal proceeds — ${input.name}`,
        amount: input.proceeds,
        type: 'Deposit',
        currency: bank.currency || 'GHS',
        balance: newBalance,
        status: 'Cleared',
        journalEntryId: jeId,
        createdAt: now,
      });
    }

    store.addAuditTrail({
      id: `AT-PPE-DISP-${Date.now()}`,
      tableName: 'PpeAsset',
      recordId: input.ppeAssetId,
      action: 'Post',
      newValues: { type: 'ppe_disposal', journalEntryId: jeId, gainLoss },
      userId: 'system',
      timestamp: now,
    });
    return { journalEntryId: jeId, gainLoss };
  } catch {
    return null;
  }
}

export interface PpeDisposalPostResult {
  ok: boolean;
  journalEntryId?: string;
  gainLoss?: number;
  accumDepPosted?: number;
  error?: string;
}

/** Single source of truth for "post this disposed asset to the ledger" — called both from the
 *  edit-save flow (immediate posting the moment an asset is marked Disposed) and from
 *  syncPpeRegisterToLedger (batch retry for anything missed or failed). Catches up any
 *  outstanding depreciation to the disposal date first, then writes off cost/accum dep and
 *  books the gain/loss. No-ops if the asset isn't Disposed, has no disposal date, or was
 *  already posted. */
export function postPpeDisposalIfNeeded(
  asset: PpeAsset,
  category: PpeCategory,
  callbacks: {
    setLedgerAccumDepPosted: (assetId: string, amount: number, journalEntryId?: string) => void;
    setDisposalJournalId: (assetId: string, journalEntryId: string) => void;
  },
  proceedsBankAccountId?: string
): PpeDisposalPostResult | null {
  if (asset.capExp !== 'Disposed' || !asset.disposalDate || asset.disposalJournalEntryId) return null;

  let cost = assetTotalCost(asset);
  if (!asset.capitalizationJournalEntryId) {
    // Never capitalized (e.g. created directly as Disposed) — capitalize retroactively at
    // purchase cost first so there's a cost on the books for the disposal to remove.
    const capResult = capturePpeCapitalization({
      ppeAssetId: asset.id,
      assetCode: asset.assetCode,
      name: asset.assetName,
      purchaseDate: asset.purchaseDate,
      cost,
    });
    if (!capResult) return { ok: false, error: `Failed to capitalize ${asset.assetCode} before disposal` };
  }

  // accumDep() targets the disposal date directly whenever asset.disposalDate is set,
  // regardless of the Date passed in here — see calculations.ts.
  const targetAccum = accumDep(asset, category, new Date());
  const postedAccum = asset.ledgerAccumDepPosted ?? 0;
  const gap = +(targetAccum - postedAccum).toFixed(2);
  if (Math.abs(gap) > 0.01) {
    const period = asset.disposalDate.slice(0, 7);
    const depResult = capturePpeBookDepreciation({
      ppeAssetId: asset.id,
      assetCode: asset.assetCode,
      name: asset.assetName,
      amount: gap,
      date: asset.disposalDate,
      period,
    });
    if (depResult) {
      callbacks.setLedgerAccumDepPosted(asset.id, targetAccum, depResult.journalEntryId);
    } else {
      return { ok: false, error: `Failed to post catch-up depreciation for ${asset.assetCode}` };
    }
  }

  const result = capturePpeDisposal({
    ppeAssetId: asset.id,
    assetCode: asset.assetCode,
    name: asset.assetName,
    disposalDate: asset.disposalDate,
    cost,
    accumDepAtDisposal: targetAccum,
    proceeds: asset.disposalProceeds ?? 0,
    proceedsBankAccountId: proceedsBankAccountId || asset.disposalProceedsBankAccountId,
  });
  if (!result) return { ok: false, error: `Failed to post disposal for ${asset.assetCode}` };

  callbacks.setDisposalJournalId(asset.id, result.journalEntryId);
  return { ok: true, journalEntryId: result.journalEntryId, gainLoss: result.gainLoss, accumDepPosted: targetAccum };
}

export function syncPpeRegisterToLedger(
  assets: PpeAsset[],
  categories: PpeCategory[],
  reportDateStr: string,
  callbacks: {
    setCapitalizationJournalId: (assetId: string, journalEntryId: string) => void;
    setLedgerAccumDepPosted: (assetId: string, amount: number, journalEntryId?: string) => void;
    setDisposalJournalId: (assetId: string, journalEntryId: string) => void;
  }
): PpeSyncResult {
  const reportDate = reportDateFromInput(reportDateStr);
  const messages: string[] = [];
  const errors: string[] = [];
  let capitalized = 0;
  let depreciationPosted = 0;
  let disposed = 0;

  for (const asset of assets) {
    if (asset.capExp === 'Disposed') {
      if (asset.disposalJournalEntryId) continue;
      const category = categories.find((c) => c.id === asset.categoryId);
      if (!category) {
        errors.push(`Unknown category for ${asset.assetCode}`);
        continue;
      }
      const result = postPpeDisposalIfNeeded(asset, category, callbacks);
      if (!result) continue;
      if (result.ok) {
        disposed += 1;
        messages.push(`Disposed ${asset.assetCode}: gain/(loss) ${(result.gainLoss ?? 0).toFixed(2)}`);
      } else {
        errors.push(result.error || `Failed to post disposal for ${asset.assetCode}`);
      }
      continue;
    }

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
    if (Math.abs(gap) > 0.01) {
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
    disposed,
    messages,
    errors,
  };
}

