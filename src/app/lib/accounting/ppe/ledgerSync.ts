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
// 2200 is the "Accounts Payable" category HEADER (see GHANA_CHART_OF_ACCOUNTS in models.ts).
// 2205 is the postable leaf for supplier invoices, matching GL_ACCOUNTS.ACCOUNTS_PAYABLE.
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

export interface PpeAssetGap {
  assetId: string;
  assetCode: string;
  assetName: string;
  registerCost: number;
  booksCost: number;
  registerDep: number;
  booksDep: number;
  whatHappened: string;
  fix: string;
}

export interface PpeOtherLedgerEntry {
  id: string;
  date: string;
  description: string;
  cost: number;
  depreciation: number;
}

function ppeNet(
  journalEntries: JournalEntry[],
  assetId: string,
  accountCode: string
): number {
  let total = 0;
  for (const entry of journalEntries) {
    if (entry.status !== 'Posted' || entry.sourceTransactionId !== assetId) continue;
    if (!(entry.sourceModule || '').startsWith('ppe_register')) continue;
    for (const line of entry.lines || []) {
      if (line.accountCode !== accountCode) continue;
      total += (line.debit || 0) - (line.credit || 0);
    }
  }
  return +total.toFixed(2);
}

function gapSentence(kind: 'cost' | 'depreciation', register: number, books: number): { happened: string; fix: string } | null {
  const diff = +(books - register).toFixed(2);
  if (Math.abs(diff) < 0.01) return null;
  const label = kind === 'cost' ? 'Cost' : 'Depreciation';
  if (diff > 0) {
    return {
      happened: `${label} on the books is higher than the list.`,
      fix: `Fix removes the extra ${label.toLowerCase()}.`,
    };
  }
  return {
    happened: `${label} is on the list and not fully on the books.`,
    fix: `Fix posts the missing ${label.toLowerCase()}.`,
  };
}

/** Per-asset reason the register and accounts 1510/1520 disagree, plus ledger entries tied to no asset. */
export function explainPpeLedgerGap(
  assets: PpeAsset[],
  categories: PpeCategory[],
  journalEntries: JournalEntry[],
  reportDateStr: string
): { assets: PpeAssetGap[]; otherEntries: PpeOtherLedgerEntry[] } {
  const reportDate = reportDateFromInput(reportDateStr);
  const rows = computeAllAssets(assets, categories, reportDate);
  const assetIds = new Set(assets.map((asset) => asset.id));
  const gaps: PpeAssetGap[] = [];

  for (const { asset, computed } of rows) {
    if (asset.capExp === 'Expense') continue;
    const held = asset.capExp === 'Capitalise';
    const registerCost = held ? computed.totalCost : 0;
    const registerDep = held ? computed.accumDep : 0;
    const booksCost = ppeNet(journalEntries, asset.id, GL_COST);
    const booksDep = +(-ppeNet(journalEntries, asset.id, GL_ACCUM_DEP)).toFixed(2);
    if (!held) {
      if (Math.abs(booksCost) < 0.01 && Math.abs(booksDep) < 0.01) continue;
      gaps.push({
        assetId: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        registerCost: 0,
        booksCost,
        registerDep: 0,
        booksDep,
        whatHappened: 'Disposed, so cost and depreciation on the books should be zero. The disposal removed one posting, and another posting of this asset is still there.',
        fix: 'Fix removes the posting the disposal did not clear.',
      });
      continue;
    }
    const cost = gapSentence('cost', registerCost, booksCost);
    const dep = gapSentence('depreciation', registerDep, booksDep);
    if (!cost && !dep) continue;
    gaps.push({
      assetId: asset.id,
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      registerCost,
      booksCost,
      registerDep,
      booksDep,
      whatHappened: [cost?.happened, dep?.happened].filter(Boolean).join(' '),
      fix: [cost?.fix, dep?.fix].filter(Boolean).join(' '),
    });
  }

  const otherEntries: PpeOtherLedgerEntry[] = [];
  for (const entry of journalEntries) {
    if (entry.status !== 'Posted') continue;
    const linked = !!entry.sourceTransactionId && assetIds.has(entry.sourceTransactionId) && (entry.sourceModule || '').startsWith('ppe_register');
    if (linked) continue;
    let cost = 0;
    let depreciation = 0;
    for (const line of entry.lines || []) {
      if (line.accountCode === GL_COST) cost += (line.debit || 0) - (line.credit || 0);
      if (line.accountCode === GL_ACCUM_DEP) depreciation += (line.credit || 0) - (line.debit || 0);
    }
    cost = +cost.toFixed(2);
    depreciation = +depreciation.toFixed(2);
    if (Math.abs(cost) < 0.01 && Math.abs(depreciation) < 0.01) continue;
    otherEntries.push({
      id: entry.id,
      date: (entry.date || '').slice(0, 10),
      description: entry.description || entry.reference || entry.entryNumber,
      cost,
      depreciation,
    });
  }

  return { assets: gaps, otherEntries };
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
      if (!asset.disposalJournalEntryId) {
        const category = categories.find((c) => c.id === asset.categoryId);
        if (!category) {
          errors.push(`Unknown category for ${asset.assetCode}`);
          continue;
        }
        const result = postPpeDisposalIfNeeded(asset, category, callbacks);
        if (result && !result.ok) {
          errors.push(result.error || `Failed to post disposal for ${asset.assetCode}`);
          continue;
        }
        if (result?.ok) {
          disposed += 1;
          messages.push(`Disposed ${asset.assetCode}: gain/(loss) ${(result.gainLoss ?? 0).toFixed(2)}`);
        }
      }
      const journalsNow = useAccountingStore.getState().journalEntries;
      const costLeft = ppeNet(journalsNow, asset.id, GL_COST);
      const depLeft = +(-ppeNet(journalsNow, asset.id, GL_ACCUM_DEP)).toFixed(2);
      if (costLeft > 0.01) {
        const reversal = capturePpeCostAdjustment({
          ppeAssetId: asset.id,
          assetCode: asset.assetCode,
          name: asset.assetName,
          date: asset.disposalDate || reportDateStr,
          delta: -costLeft,
        });
        if (reversal) messages.push(`${asset.assetCode} was disposed, so the remaining cost of ${costLeft.toFixed(2)} was removed`);
        else errors.push(`Failed to clear remaining cost for disposed ${asset.assetCode}`);
      }
      if (Math.abs(depLeft) > 0.01) {
        const depReversal = capturePpeBookDepreciation({
          ppeAssetId: asset.id,
          assetCode: asset.assetCode,
          name: asset.assetName,
          amount: -depLeft,
          date: asset.disposalDate || reportDateStr,
          period: (asset.disposalDate || reportDateStr).slice(0, 7),
        });
        if (depReversal) messages.push(`${asset.assetCode} was disposed, so the remaining depreciation of ${depLeft.toFixed(2)} was removed`);
        else errors.push(`Failed to clear remaining depreciation for disposed ${asset.assetCode}`);
      }
      continue;
    }

    if (asset.capExp !== 'Capitalise') continue;

    const journals = useAccountingStore.getState().journalEntries;
    const postedForAsset = (sourceModules: string[]) =>
      journals.filter(
        (entry) =>
          entry.status === 'Posted' &&
          entry.sourceTransactionId === asset.id &&
          sourceModules.includes(entry.sourceModule || '')
      );
    const netOn = (sourceModules: string[], accountCode: string) =>
      +postedForAsset(sourceModules)
        .reduce((sum, entry) => {
          for (const line of entry.lines || []) {
            if (line.accountCode !== accountCode) continue;
            sum += (line.debit || 0) - (line.credit || 0);
          }
          return sum;
        }, 0)
        .toFixed(2);

    const cost = assetTotalCost(asset);
    if (!asset.capitalizationJournalEntryId) {
      const already = postedForAsset(['ppe_register_capitalize']);
      if (already.length) {
        callbacks.setCapitalizationJournalId(asset.id, already[already.length - 1].id);
        messages.push(`${asset.assetCode} is already on the books`);
      } else {
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
    }

    const costOnBooks = netOn(
      ['ppe_register_capitalize', 'ppe_register_cost_adjustment', 'ppe_register_disposal'],
      GL_COST
    );
    const costExcess = +(costOnBooks - cost).toFixed(2);
    if (costExcess > 0.01) {
      const reversal = capturePpeCostAdjustment({
        ppeAssetId: asset.id,
        assetCode: asset.assetCode,
        name: asset.assetName,
        date: reportDateStr,
        delta: -costExcess,
      });
      if (reversal) messages.push(`Removed duplicate cost for ${asset.assetCode}: ${costExcess.toFixed(2)}`);
      else errors.push(`Failed to remove duplicate cost for ${asset.assetCode}`);
    }

    const row = computeAllAssets([asset], categories, reportDate)[0];
    if (!row) continue;
    const targetAccum = row.computed.accumDep;
    const postedAccum = -netOn(['ppe_register_depreciation', 'ppe_register_disposal'], GL_ACCUM_DEP);
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

  const cleared = clearAssetsNoLongerOnTheList(
    new Set(assets.map((asset) => asset.id)),
    reportDateStr
  );
  messages.push(...cleared.messages);
  errors.push(...cleared.errors);

  return {
    ok: errors.length === 0,
    capitalized,
    depreciationPosted,
    disposed,
    messages,
    errors,
  };
}

/** Posted PPE journals whose asset was removed from the list. Their net is taken off the books
 *  so the register and the asset accounts agree without a trip to the Journal. */
function clearAssetsNoLongerOnTheList(
  assetIds: Set<string>,
  reportDateStr: string
): { messages: string[]; errors: string[] } {
  const messages: string[] = [];
  const errors: string[] = [];
  const asOf = reportDateStr.slice(0, 10);
  const groups = new Map<string, { name: string; nets: Map<string, number> }>();

  for (const entry of useAccountingStore.getState().journalEntries) {
    if (entry.status !== 'Posted') continue;
    if (!(entry.sourceModule || '').startsWith('ppe_register')) continue;
    const sourceId = entry.sourceTransactionId || '';
    if (!sourceId || assetIds.has(sourceId)) continue;
    if ((entry.date || '').slice(0, 10) > asOf) continue;

    let group = groups.get(sourceId);
    if (!group) {
      const description = entry.description || '';
      const named = description.includes('—') ? description.split('—').pop()?.trim() : '';
      group = { name: named || entry.reference || 'Removed asset', nets: new Map() };
      groups.set(sourceId, group);
    }
    for (const line of entry.lines || []) {
      const next = (group.nets.get(line.accountCode) || 0) + (line.debit || 0) - (line.credit || 0);
      group.nets.set(line.accountCode, next);
    }
  }

  for (const [sourceId, group] of groups) {
    const cost = group.nets.get(GL_COST) || 0;
    const dep = group.nets.get(GL_ACCUM_DEP) || 0;
    if (Math.abs(cost) < 0.01 && Math.abs(dep) < 0.01) continue;
    if (postOffsetForRemovedAsset(sourceId, group.name, asOf, group.nets)) {
      messages.push(`${group.name} is no longer on the list, so it was taken off the books`);
    } else {
      errors.push(`Could not take ${group.name} off the books`);
    }
  }

  return { messages, errors };
}

function postOffsetForRemovedAsset(
  sourceId: string,
  name: string,
  date: string,
  nets: Map<string, number>
): boolean {
  const store = useAccountingStore.getState();
  const periodCheck = assertPeriodNotClosed(store.journalEntries, date);
  if (!periodCheck.ok) return false;

  const pieces = [...nets.entries()]
    .map(([accountCode, net]) => ({ accountCode, net: +net.toFixed(2) }))
    .filter((piece) => Math.abs(piece.net) >= 0.01);
  if (!pieces.length) return true;

  const jeId = `JE-PPE-CLR-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  let totalDebit = 0;
  let totalCredit = 0;
  const lines: JournalEntryLine[] = pieces.map((piece) => {
    const amount = Math.abs(piece.net);
    const debit = piece.net < 0 ? amount : 0;
    const credit = piece.net > 0 ? amount : 0;
    totalDebit += debit;
    totalCredit += credit;
    return {
      id: lineId(),
      journalEntryId: jeId,
      accountCode: piece.accountCode,
      description: 'Removed because the asset is no longer on the list',
      debit,
      credit,
      currency: 'GHS',
    };
  });
  if (Math.abs(totalDebit - totalCredit) > 0.02) return false;

  const now = new Date().toISOString();
  try {
    store.addJournalEntry({
      id: jeId,
      entryNumber: jeNumber(),
      date,
      reference: name,
      description: `Removed from the books — ${name}`,
      totalDebit,
      totalCredit,
      currency: 'GHS',
      status: 'Posted',
      postedBy: 'system',
      postedAt: now,
      createdAt: now,
      updatedAt: now,
      sourceModule: 'ppe_register_cost_adjustment',
      sourceTransactionId: sourceId,
      lines,
    });
    return true;
  } catch {
    return false;
  }
}

