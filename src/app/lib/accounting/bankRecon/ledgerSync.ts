import type { JournalEntry, ChartOfAccounts } from '../models';
import { GHANA_CHART_OF_ACCOUNTS } from '../models';
import { buildFinancialAccountTree, type AccountNode, type RollupCoa } from '../financialReportRollup';
import { toRollupCoa } from '../coaHierarchy';
import { useAccountingStore } from '../store';
import type { BankAccount } from '../models';
import type { ReconcilingItem, ReconcilingItemType } from './types';
import { bookSideItemsNeedingJournal } from './calculations';
import { assertPeriodNotClosed } from '../periodClose';
import { logAccountingProcessWarn } from '../accountingProcessLog';

// Must match bankTransactionLedger.ts's GL_INTEREST_INCOME — both post the same concept.
// '4900' doesn't exist in GHANA_CHART_OF_ACCOUNTS. 4330 (Miscellaneous Revenue) is the
// postable leaf under 4300 (Other Revenue) — 4300 itself is a category header with 4310/4320/
// 4330 as children, not meant to be posted to directly.
const GL_INTEREST_INCOME = '4330';
const GL_BANK_CHARGES = '5625';
// '1220' (Other Receivables) is used as a holding account for unclassified book-side
// reconciling adjustments pending investigation — must NOT share a code with a revenue
// account (it previously matched GL_INTEREST_INCOME's old '4300', silently inflating
// reported Sales Revenue whenever an unmapped adjustment was posted).
const GL_SUSPENSE = '1220';

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

export function reportDateFromInput(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Cumulative GL balance for bank/cash account through period end. */
export function getGlCashbookBalance(
  journalEntries: JournalEntry[],
  chartOfAccounts: ChartOfAccounts[] | RollupCoa[] | undefined,
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
  chartOfAccounts: ChartOfAccounts[] | RollupCoa[] | undefined,
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

/** Default offset GL for a book-side item type — used both to post (when the user leaves the
 *  field untouched) and to reset the "Offset GL code" input when the type selector changes, so
 *  a stale code from a previously-selected type can't silently carry over into a new posting. */
export function defaultOffsetGlForType(itemType: ReconcilingItemType): string {
  switch (itemType) {
    case 'BANK_CREDIT_NOT_IN_BOOK':
      return GL_INTEREST_INCOME;
    case 'BANK_CHARGE_NOT_IN_BOOK':
    case 'BOOK_ERROR_DEDUCT':
      return GL_BANK_CHARGES;
    case 'BOOK_ERROR_ADD':
    default:
      return GL_SUSPENSE;
  }
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

/** Register-transaction type + signed balance effect for a book-side reconciling item. */
function bankTxnShapeForItem(itemType: ReconcilingItem['itemType']): { type: 'Deposit' | 'Withdrawal' | 'Charge' | 'Interest'; inflow: boolean } {
  switch (itemType) {
    case 'BANK_CREDIT_NOT_IN_BOOK':
      return { type: 'Interest', inflow: true };
    case 'BANK_CHARGE_NOT_IN_BOOK':
      return { type: 'Charge', inflow: false };
    case 'BOOK_ERROR_DEDUCT':
      return { type: 'Withdrawal', inflow: false };
    case 'BOOK_ERROR_ADD':
    default:
      return { type: 'Deposit', inflow: true };
  }
}

export function captureBookSideItem(
  item: ReconcilingItem,
  bankGlCode: string,
  periodEndDate: string,
  reconId: string,
  bankAccountId: string
): { journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = new Date().toISOString();
  const jeId = `JE-BRECON-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const { debit, credit } = offsetForType(item, bankGlCode);
  const date = item.transactionDate?.slice(0, 10) || periodEndDate;

  const periodCheck = assertPeriodNotClosed(store.journalEntries, date);
  if (!periodCheck.ok) {
    logAccountingProcessWarn('BankReconciliation', 'Bank recon GL post blocked — closed period', {
      reconId,
      itemId: item.id,
      error: periodCheck.error,
    });
    return null;
  }

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

    // A book-side item means the bank statement already reflects this movement — the register
    // (and its running currentBalance) must catch up too, not just the GL. Without this, the
    // bank account's displayed balance permanently diverges from the GL the moment any bank
    // charge/interest/correction is posted here.
    const bank = store.bankAccounts.find((b) => b.id === bankAccountId);
    if (bank) {
      const { type: txnType, inflow } = bankTxnShapeForItem(item.itemType);
      const signedAmount = inflow ? item.amount : -item.amount;
      const newBalance = Math.round(((bank.currentBalance ?? 0) + signedAmount) * 100) / 100;
      store.updateBankAccount(bankAccountId, { currentBalance: newBalance, updatedAt: now });
      store.addBankTransaction({
        id: `BT-BRECON-${jeId}`,
        bankAccountId,
        transactionDate: date,
        reference: item.reference || item.id,
        description: item.description,
        amount: item.amount,
        type: txnType,
        currency: bank.currency || 'GHS',
        balance: newBalance,
        status: 'Cleared',
        journalEntryId: jeId,
        createdAt: now,
      });
    }

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
  reconId: string,
  bankAccountId: string
): PostBookSideResult {
  const pending = bookSideItemsNeedingJournal(items);
  const mappings: { itemId: string; journalEntryId: string }[] = [];
  const errors: string[] = [];

  for (const item of pending) {
    const result = captureBookSideItem(item, bankGlCode, periodEndDate, reconId, bankAccountId);
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
