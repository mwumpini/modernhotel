import type { BankAccount, BankTransaction } from './models';

/** Stable register ids so a repair and a later checkout share one cashbook. */
export const CASH_REGISTER_ID = 'reg-cash-1110';
export const BANK_REGISTER_ID = 'reg-bank-1120';

export function registerIdForGl(glCode: string): string | null {
  const gl = (glCode || '').trim();
  if (gl === '1110') return CASH_REGISTER_ID;
  if (gl === '1120') return BANK_REGISTER_ID;
  const n = parseInt(gl, 10);
  if (!isNaN(n) && n >= 1121 && n <= 1199) return BANK_REGISTER_ID;
  return null;
}

type CashbookStore = {
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  addBankAccount: (account: BankAccount) => void;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  addBankTransaction: (transaction: BankTransaction) => void;
};

function registerSeed(id: string, now: string): BankAccount {
  const cash = id === CASH_REGISTER_ID;
  return {
    id,
    accountNumber: cash ? 'CASH-1110' : 'BANK-1120',
    accountName: cash ? 'Cash in hand' : 'Operating bank',
    bankName: cash ? 'Front office cash' : 'Operating account',
    currency: 'GHS',
    glAccountCode: cash ? '1110' : '1120',
    openingBalanceType: 'period',
    openingBalance: 0,
    currentBalance: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Write a cashbook line for a receipt or refund that already posted to 1110/1120.
 * Does not post another journal — the ledger entry already holds the cash.
 */
export function mirrorGlCashToCashbook(
  getStore: () => CashbookStore,
  params: {
    glCode: string;
    amount: number;
    direction: 'in' | 'out';
    date: string;
    reference: string;
    description: string;
    journalEntryId: string;
  }
): void {
  const registerId = registerIdForGl(params.glCode);
  const amount = Math.abs(params.amount);
  if (!registerId || amount < 0.005) return;
  const store = getStore();
  if (store.bankTransactions.some((t) => t.journalEntryId === params.journalEntryId && t.bankAccountId === registerId)) {
    return;
  }

  const now = new Date().toISOString();
  if (!store.bankAccounts.some((b) => b.id === registerId)) {
    store.addBankAccount(registerSeed(registerId, now));
  }
  const bank = getStore().bankAccounts.find((b) => b.id === registerId);
  if (!bank) return;

  const signed = params.direction === 'in' ? amount : -amount;
  const newBalance = +((bank.currentBalance || 0) + signed).toFixed(2);
  store.updateBankAccount(registerId, { currentBalance: newBalance, updatedAt: now });
  store.addBankTransaction({
    id: `BT-${params.journalEntryId}`,
    bankAccountId: registerId,
    transactionDate: (params.date || now).slice(0, 10),
    reference: params.reference,
    description: params.description,
    amount,
    type: params.direction === 'in' ? 'Deposit' : 'Withdrawal',
    currency: 'GHS',
    balance: newBalance,
    status: 'Cleared',
    journalEntryId: params.journalEntryId,
    createdAt: now,
  });
}
