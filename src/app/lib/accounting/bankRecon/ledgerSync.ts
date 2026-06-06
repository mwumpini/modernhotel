import type { JournalEntry } from '../models';
import { GHANA_CHART_OF_ACCOUNTS } from '../models';
import { buildFinancialAccountTree, type AccountNode, type RollupCoa } from '../financialReportRollup';
import { useAccountingStore } from '../store';
import type { BankAccount } from '../models';
import type { ReconcilingItem, ReconcilingItemType } from './types';
import { bookSideItemsNeedingJournal } from './calculations';

const GL_INTEREST_INCOME = '4300';
const GL_BANK_CHARGES = '5625';
const GL_SUSPENSE = '4300';

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
  return raw.map((a) => ({
    code: a.code,
    name: a.name,
    type: a.type as RollupCoa['type'],
    category: a.category,
    level: a.level,
  }));
}

export function reportDateFromInput(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Cumulative GL balance for bank/cash account through period end. */
export function getGlCashbookBalance(
  journalEntries: JournalEntry[],
  chartOfAccounts: RollupCoa[] | undefined,
  glAccountCode: string,
  periodEndDate: string
): number {
  const endDate = reportDateFromInput(periodEndDate);
  const tree = buildFinancialAccountTree(resolveCoa(chartOfAccounts), journalEntries, {
    kind: 'cumulative',
    endDate,
  });
  const flat = flattenTree(tree);
  const node = flat.find((n) => n.code === glAccountCode);
  return node?.balance ?? 0;
}

export interface CashbookLedgerLink {
  glAccountCode: string;
  glBalance: number;
  bankRecordBalance: number;
  inSync: boolean;
  gap: number;
}

export function linkCashbookToLedger(
  bankAccount: BankAccount,
  journalEntries: JournalEntry[],
  chartOfAccounts: RollupCoa[] | undefined,
  periodEndDate: string
): CashbookLedgerLink {
  const glBalance = getGlCashbookBalance(
    journalEntries,
    chartOfAccounts,
    bankAccount.glAccountCode,
    periodEndDate
  );
  const gap = Math.round((glBalance - bankAccount.currentBalance) * 100) / 100;
  return {
    glAccountCode: bankAccount.glAccountCode,
    glBalance,
    bankRecordBalance: bankAccount.currentBalance,
    inSync: Math.abs(gap) < 0.01,
    gap,
  };
}

function lineId() {
  return `JEL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function jeNumber() {
  return `JE-${Date.now().toString().slice(-8)}`;
}

function offsetForType(item: ReconcilingItem, bankGl: string): { debit: string; credit: string } {
  const offset = item.offsetGlCode;
  switch (item.itemType) {
    case 'BANK_CREDIT_NOT_IN_BOOK':
      return { debit: bankGl, credit: offset || GL_INTEREST_INCOME };
    case 'BANK_CHARGE_NOT_IN_BOOK':
      return { debit: offset || GL_BANK_CHARGES, credit: bankGl };
    case 'BOOK_ERROR_ADD':
      return { debit: bankGl, credit: offset || GL_SUSPENSE };
    case 'BOOK_ERROR_DEDUCT':
      return { debit: offset || GL_BANK_CHARGES, credit: bankGl };
    default:
      return { debit: bankGl, credit: offset || GL_SUSPENSE };
  }
}

export function captureBookSideItem(
  item: ReconcilingItem,
  bankGlCode: string,
  periodEndDate: string,
  reconId: string
): { journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const jeId = `JE-BRECON-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const { debit, credit } = offsetForType(item, bankGlCode);
  const date = item.transactionDate?.slice(0, 10) || periodEndDate;

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date,
    reference: item.reference || item.id,
    description: `Bank recon — ${item.description}`,
    totalDebit: item.amount,
    totalCredit: item.amount,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'bank_reconciliation',
    sourceTransactionId: reconId,
    lines: [
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: debit,
        description: item.description,
        debit: item.amount,
        credit: 0,
        currency: 'GHS',
      },
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: credit,
        description: item.description,
        debit: 0,
        credit: item.amount,
        currency: 'GHS',
      },
    ],
  };

  try {
    store.addJournalEntry(je);
    store.addAuditTrail({
      id: `AT-BRECON-${Date.now()}`,
      tableName: 'BankReconciliation',
      recordId: reconId,
      action: 'Post',
      newValues: { description: item.description, journalEntryId: jeId, amount: item.amount },
      userId: 'system',
      timestamp: now,
    });
    return { journalEntryId: jeId };
  } catch {
    return null;
  }
}

export interface PostBookSideResult {
  ok: boolean;
  posted: number;
  errors: string[];
  mappings: { itemId: string; journalEntryId: string }[];
}

export function postBookSideItemsToLedger(
  items: ReconcilingItem[],
  bankGlCode: string,
  periodEndDate: string,
  reconId: string
): PostBookSideResult {
  const pending = bookSideItemsNeedingJournal(items);
  const mappings: { itemId: string; journalEntryId: string }[] = [];
  const errors: string[] = [];

  for (const item of pending) {
    const result = captureBookSideItem(item, bankGlCode, periodEndDate, reconId);
    if (result) {
      mappings.push({ itemId: item.id, journalEntryId: result.journalEntryId });
    } else {
      errors.push(`Failed to post: ${item.description}`);
    }
  }

  return {
    ok: errors.length === 0,
    posted: mappings.length,
    errors,
    mappings,
  };
}

export function navigateToBankReconciliation(bankAccountId?: string, tab: 'reconciliation' | 'banking' = 'reconciliation') {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accounting.tab', tab === 'banking' ? 'banking' : 'reconciliation');
  localStorage.setItem('accounting.banking.subtab', 'reconciliation');
  if (bankAccountId) localStorage.setItem('bankRecon.accountId', bankAccountId);
  window.dispatchEvent(new Event('accounting-navigate'));
}

export const RECON_ITEM_TYPES: {
  type: ReconcilingItemType;
  label: string;
  side: 'bank' | 'book';
  effect: 'add' | 'deduct';
  hint: string;
}[] = [
  { type: 'DEPOSIT_IN_TRANSIT', label: 'Deposit in transit', side: 'bank', effect: 'add', hint: 'In books, not yet on statement' },
  { type: 'OUTSTANDING_CHEQUE', label: 'Outstanding cheque', side: 'bank', effect: 'deduct', hint: 'Issued, not yet cleared' },
  { type: 'BANK_ERROR_ADD', label: 'Bank error (add)', side: 'bank', effect: 'add', hint: 'Bank understated balance' },
  { type: 'BANK_ERROR_DEDUCT', label: 'Bank error (deduct)', side: 'bank', effect: 'deduct', hint: 'Bank overstated balance' },
  { type: 'BANK_CREDIT_NOT_IN_BOOK', label: 'Bank credit not in cashbook', side: 'book', effect: 'add', hint: 'Interest, direct credit — posts to GL' },
  { type: 'BANK_CHARGE_NOT_IN_BOOK', label: 'Bank charge not in cashbook', side: 'book', effect: 'deduct', hint: 'Fees — posts to GL' },
  { type: 'BOOK_ERROR_ADD', label: 'Cashbook error (add)', side: 'book', effect: 'add', hint: 'Understated receipt — posts to GL' },
  { type: 'BOOK_ERROR_DEDUCT', label: 'Cashbook error (deduct)', side: 'book', effect: 'deduct', hint: 'Overstated receipt — posts to GL' },
];

export const BANK_SIDE_TYPES = RECON_ITEM_TYPES.filter((t) => t.side === 'bank');
export const BOOK_SIDE_TYPES = RECON_ITEM_TYPES.filter((t) => t.side === 'book');
