import type { BankAccount, BankTransaction, JournalEntry, JournalEntryLine } from './models';
import { assertPeriodNotClosed } from './periodClose';

export const BANK_MANUAL_SOURCE = 'bank_manual_transaction';
export const BANK_MANUAL_REVERSAL_SOURCE = 'bank_manual_reversal';

// 4300 ("Other Revenue") is a category header with 4310/4320/4330 as children, not a postable
// leaf — 4330 (Miscellaneous Revenue) is the real catch-all leaf, mirroring how '5000'
// ("Operating Expenses") is the top-level Expense header and '5680' ("Miscellaneous Expenses")
// is the real catch-all leaf for an uncategorized manual bank withdrawal.
const GL_OTHER_REVENUE = '4330';
const GL_OPERATING_EXPENSE = '5680';
const GL_INTEREST_INCOME = '4330';
const GL_BANK_CHARGES = '5625';

export type ManualBankTransactionInput = {
  bankAccountId: string;
  transferToAccountId?: string;
  type: BankTransaction['type'];
  amount: number;
  reference: string;
  description: string;
  transactionDate: string;
  status?: 'Pending' | 'Cleared';
  postToGl?: boolean;
};

type BankTxnStore = {
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  journalEntries: JournalEntry[];
  currentPeriod: string;
  addBankTransaction: (transaction: BankTransaction) => void;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  updateGLBalance: (
    accountCode: string,
    period: string,
    updates: { currentDebit?: number; currentCredit?: number }
  ) => void;
};

function lineId(jeId: string, seq: number) {
  return `JEL-${jeId}-${seq}`;
}

function jeNumber(seq: number) {
  return `JE-${new Date().getFullYear()}-${String(seq + 1).padStart(4, '0')}`;
}

function round2(n: number) {
  return +n.toFixed(2);
}

/** Positive amount = money in; negative = money out (single-account types). */
export function signedAmountForType(type: BankTransaction['type'], amount: number): number {
  const abs = Math.abs(amount);
  switch (type) {
    case 'Deposit':
    case 'Interest':
      return abs;
    case 'Withdrawal':
    case 'Charge':
      return -abs;
    default:
      return abs;
  }
}

function offsetGlForType(type: BankTransaction['type']): string {
  switch (type) {
    case 'Deposit':
      return GL_OTHER_REVENUE;
    case 'Withdrawal':
      return GL_OPERATING_EXPENSE;
    case 'Charge':
      return GL_BANK_CHARGES;
    case 'Interest':
      return GL_INTEREST_INCOME;
    default:
      return GL_OTHER_REVENUE;
  }
}

function buildSingleAccountJournalEntry(
  bank: BankAccount,
  input: ManualBankTransactionInput,
  journalSeq: number
): JournalEntry {
  const amount = round2(Math.abs(input.amount));
  const bankGl = bank.glAccountCode;
  const offsetGl = offsetGlForType(input.type);
  const currency = bank.currency || 'GHS';
  const now = new Date().toISOString();
  const jeId = `JE-BTX-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const isInflow = input.type === 'Deposit' || input.type === 'Interest';

  const bankLine: JournalEntryLine = {
    id: lineId(jeId, 1),
    journalEntryId: jeId,
    accountCode: bankGl,
    description: input.description || input.reference,
    debit: isInflow ? amount : 0,
    credit: isInflow ? 0 : amount,
    currency,
    reference: input.reference,
  };

  const offsetLine: JournalEntryLine = {
    id: lineId(jeId, 2),
    journalEntryId: jeId,
    accountCode: offsetGl,
    description: `${input.type} — ${input.description || input.reference}`,
    debit: isInflow ? 0 : amount,
    credit: isInflow ? amount : 0,
    currency,
    reference: input.reference,
  };

  return {
    id: jeId,
    entryNumber: jeNumber(journalSeq),
    date: input.transactionDate.slice(0, 10),
    reference: input.reference,
    description: `Bank ${input.type.toLowerCase()} — ${bank.accountName}`,
    totalDebit: amount,
    totalCredit: amount,
    currency,
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: BANK_MANUAL_SOURCE,
    sourceTransactionId: jeId,
    lines: [bankLine, offsetLine],
  };
}

function buildTransferJournalEntry(
  from: BankAccount,
  to: BankAccount,
  input: ManualBankTransactionInput,
  journalSeq: number,
  groupId: string
): JournalEntry {
  const amount = round2(Math.abs(input.amount));
  const currency = from.currency || 'GHS';
  const now = new Date().toISOString();
  const jeId = `JE-BTR-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  const lines: JournalEntryLine[] = [
    {
      id: lineId(jeId, 1),
      journalEntryId: jeId,
      accountCode: to.glAccountCode,
      description: `Transfer in — ${input.description || input.reference}`,
      debit: amount,
      credit: 0,
      currency,
      reference: input.reference,
    },
    {
      id: lineId(jeId, 2),
      journalEntryId: jeId,
      accountCode: from.glAccountCode,
      description: `Transfer out — ${input.description || input.reference}`,
      debit: 0,
      credit: amount,
      currency,
      reference: input.reference,
    },
  ];

  return {
    id: jeId,
    entryNumber: jeNumber(journalSeq),
    date: input.transactionDate.slice(0, 10),
    reference: input.reference,
    description: `Bank transfer — ${from.accountName} → ${to.accountName}`,
    totalDebit: amount,
    totalCredit: amount,
    currency,
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: BANK_MANUAL_SOURCE,
    sourceTransactionId: groupId,
    lines,
  };
}

function applyGlEntry(
  entry: JournalEntry,
  store: Pick<BankTxnStore, 'addJournalEntry' | 'updateGLBalance' | 'currentPeriod'>
) {
  store.addJournalEntry(entry);
  for (const line of entry.lines) {
    store.updateGLBalance(line.accountCode, store.currentPeriod, {
      currentDebit: line.debit || 0,
      currentCredit: line.credit || 0,
    });
  }
}

function bumpBalance(store: BankTxnStore, accountId: string, delta: number) {
  const bank = store.bankAccounts.find((b) => b.id === accountId);
  if (!bank) return 0;
  const newBalance = round2((bank.currentBalance ?? 0) + delta);
  store.updateBankAccount(accountId, {
    currentBalance: newBalance,
    updatedAt: new Date().toISOString(),
  });
  return newBalance;
}

export function createManualBankTransaction(
  input: ManualBankTransactionInput,
  store: BankTxnStore
): { ok: true; transactionIds: string[]; journalEntryId?: string } | { ok: false; error: string } {
  const amount = round2(Math.abs(input.amount));
  if (amount < 0.005) return { ok: false, error: 'Amount must be greater than zero.' };
  if (!input.bankAccountId) return { ok: false, error: 'Bank account is required.' };
  if (!input.reference?.trim()) return { ok: false, error: 'Reference is required.' };

  const fromBank = store.bankAccounts.find((b) => b.id === input.bankAccountId);
  if (!fromBank) return { ok: false, error: 'Bank account not found.' };

  const postToGl = input.postToGl !== false;
  const status = input.status || 'Cleared';
  const now = new Date().toISOString();

  if (postToGl) {
    const periodCheck = assertPeriodNotClosed(store.journalEntries, input.transactionDate);
    if (!periodCheck.ok) return { ok: false, error: periodCheck.error };
  }

  if (input.type === 'Transfer') {
    if (!input.transferToAccountId) {
      return { ok: false, error: 'Select the destination account for a transfer.' };
    }
    if (input.transferToAccountId === input.bankAccountId) {
      return { ok: false, error: 'Transfer from and to accounts must be different.' };
    }
    const toBank = store.bankAccounts.find((b) => b.id === input.transferToAccountId);
    if (!toBank) return { ok: false, error: 'Destination bank account not found.' };

    const groupId = `BTR-${Date.now()}`;
    const outId = `BT-${groupId}-OUT`;
    const inId = `BT-${groupId}-IN`;

    let journalEntryId: string | undefined;
    if (postToGl) {
      const entry = buildTransferJournalEntry(fromBank, toBank, input, store.journalEntries.length, groupId);
      applyGlEntry(entry, store);
      journalEntryId = entry.id;
    }

    const outBalance = bumpBalance(store, fromBank.id, -amount);
    const inBalance = bumpBalance(store, toBank.id, amount);

    const shared = {
      transactionDate: input.transactionDate,
      reference: input.reference.trim(),
      description: input.description?.trim() || `Transfer to ${toBank.accountName}`,
      amount,
      type: 'Transfer' as const,
      currency: fromBank.currency,
      status,
      journalEntryId,
      createdAt: now,
    };

    store.addBankTransaction({
      id: outId,
      bankAccountId: fromBank.id,
      transferToAccountId: toBank.id,
      linkedTransactionId: inId,
      ...shared,
      description: input.description?.trim() || `Transfer to ${toBank.accountName}`,
      balance: outBalance,
    });

    store.addBankTransaction({
      id: inId,
      bankAccountId: toBank.id,
      transferToAccountId: fromBank.id,
      linkedTransactionId: outId,
      ...shared,
      description: input.description?.trim() || `Transfer from ${fromBank.accountName}`,
      balance: inBalance,
    });

    return { ok: true, transactionIds: [outId, inId], journalEntryId };
  }

  const signed = signedAmountForType(input.type, amount);
  let journalEntryId: string | undefined;
  const txnId = `BT-${Date.now()}`;

  if (postToGl) {
    const entry = buildSingleAccountJournalEntry(fromBank, input, store.journalEntries.length);
    entry.sourceTransactionId = txnId;
    applyGlEntry(entry, store);
    journalEntryId = entry.id;
  }

  const newBalance = bumpBalance(store, fromBank.id, signed);

  store.addBankTransaction({
    id: txnId,
    bankAccountId: fromBank.id,
    transactionDate: input.transactionDate,
    reference: input.reference.trim(),
    description: input.description?.trim() || input.type,
    amount,
    type: input.type,
    currency: fromBank.currency,
    balance: newBalance,
    status,
    journalEntryId,
    createdAt: now,
  });

  return { ok: true, transactionIds: [txnId], journalEntryId };
}

/** Reverse register and GL effect of a manual bank transaction (not reconciled). */
export function reverseManualBankTransaction(
  transaction: BankTransaction,
  store: BankTxnStore & { bankTransactions: BankTransaction[] }
): { ok: true } | { ok: false; error: string } {
  if (transaction.status === 'Reconciled') {
    return { ok: false, error: 'Cannot reverse a reconciled transaction.' };
  }

  const bank = store.bankAccounts.find((b) => b.id === transaction.bankAccountId);
  if (!bank) return { ok: false, error: 'Bank account not found.' };

  if (transaction.journalEntryId) {
    const periodCheck = assertPeriodNotClosed(store.journalEntries, new Date().toISOString());
    if (!periodCheck.ok) return { ok: false, error: periodCheck.error };
  }

  const amount = Math.abs(transaction.amount ?? 0);

  if (transaction.type === 'Transfer' && transaction.linkedTransactionId) {
    const linked = store.bankTransactions.find((t) => t.id === transaction.linkedTransactionId);
    if (!linked) return { ok: false, error: 'Linked transfer leg not found.' };

    bumpBalance(store, transaction.bankAccountId, amount);
    bumpBalance(store, linked.bankAccountId, -amount);

    if (transaction.journalEntryId) {
      const original = store.journalEntries.find((je) => je.id === transaction.journalEntryId);
      if (original?.status === 'Posted') {
        const revId = `JE-REV-${transaction.id}-${Date.now()}`;
        const now = new Date().toISOString();
        const reversal: JournalEntry = {
          ...original,
          id: revId,
          entryNumber: jeNumber(store.journalEntries.length),
          description: `Reversal — ${original.description}`,
          date: now.slice(0, 10),
          sourceModule: BANK_MANUAL_REVERSAL_SOURCE,
          sourceTransactionId: transaction.id,
          createdAt: now,
          updatedAt: now,
          postedAt: now,
          lines: original.lines.map((line, i) => ({
            ...line,
            id: lineId(revId, i + 1),
            journalEntryId: revId,
            debit: line.credit,
            credit: line.debit,
          })),
        };
        applyGlEntry(reversal, store);
      }
    }
    return { ok: true };
  }

  const signed = signedAmountForType(transaction.type, amount);
  bumpBalance(store, transaction.bankAccountId, -signed);

  if (transaction.journalEntryId) {
    const original = store.journalEntries.find((je) => je.id === transaction.journalEntryId);
    if (original?.status === 'Posted') {
      const revId = `JE-REV-${transaction.id}-${Date.now()}`;
      const now = new Date().toISOString();
      const reversal: JournalEntry = {
        ...original,
        id: revId,
        entryNumber: jeNumber(store.journalEntries.length),
        description: `Reversal — ${original.description}`,
        date: now.slice(0, 10),
        sourceModule: BANK_MANUAL_REVERSAL_SOURCE,
        sourceTransactionId: transaction.id,
        createdAt: now,
        updatedAt: now,
        postedAt: now,
        lines: original.lines.map((line, i) => ({
          ...line,
          id: lineId(revId, i + 1),
          journalEntryId: revId,
          debit: line.credit,
          credit: line.debit,
        })),
      };
      applyGlEntry(reversal, store);
    }
  }

  return { ok: true };
}
