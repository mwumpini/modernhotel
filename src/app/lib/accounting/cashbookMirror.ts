import type { BankAccount, BankTransaction } from './models';

/** Stable register ids so a repair and a later checkout share one cashbook. */
export const CASH_REGISTER_ID = 'reg-cash-1110';
export const BANK_REGISTER_ID = 'reg-bank-1120';
export const MOMO_REGISTER_ID = 'reg-momo-1130';

export function registerIdForGl(glCode: string): string | null {
  const gl = (glCode || '').trim();
  if (gl === '1110') return CASH_REGISTER_ID;
  if (gl === '1130') return MOMO_REGISTER_ID;
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

const SYNTHETIC_IDS = new Set([CASH_REGISTER_ID, BANK_REGISTER_ID, MOMO_REGISTER_ID]);

function isPettyCash(account: BankAccount): boolean {
  return `${account.accountName || ''} ${account.bankName || ''}`.toLowerCase().includes('petty');
}

/**
 * Sub-account under the general cash (1110), bank (1120), or mobile money (1130) account.
 * The journal already debited that general account. This picks the Bank & Cash
 * row that holds the same amount, so the sub-ledger matches the general account.
 * A later guest till on 1110 is preferred over petty cash. A later mobile-money
 * wallet on 1130 is preferred over the default wallet. Hidden registers are
 * used only when no real account is linked to that general account.
 */
export function pickCashbookAccount(accounts: BankAccount[], glCode: string): BankAccount | null {
  const gl = (glCode || '').trim();
  const n = parseInt(gl, 10);
  const isCash = gl === '1110';
  const isMomo = gl === '1130';
  const isBank = gl === '1120' || (!isNaN(n) && n >= 1121 && n <= 1199 && !isMomo);
  if (!isCash && !isBank && !isMomo) return null;

  const pool = accounts.filter((account) => {
    if (account.isActive === false) return false;
    const code = (account.glAccountCode || '').trim();
    if (isCash) return code === '1110';
    if (isMomo) return code === '1130';
    return code === gl;
  });
  if (!pool.length) return null;

  const real = pool.filter((account) => !SYNTHETIC_IDS.has(account.id));
  const base = real.length ? real : pool;
  const tills = isCash ? base.filter((account) => !isPettyCash(account)) : base;
  const ranked = (tills.length ? tills : base)
    .slice()
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return ranked[0] || null;
}

function registerSeed(id: string, now: string): BankAccount {
  const cash = id === CASH_REGISTER_ID;
  const momo = id === MOMO_REGISTER_ID;
  return {
    id,
    accountNumber: cash ? 'CASH-1110' : momo ? '1130-0001' : 'BANK-1120',
    accountName: cash ? 'Cash in hand' : momo ? 'Mobile Money' : 'Operating bank',
    bankName: cash ? 'Front office cash' : momo ? 'Mobile Money' : 'Operating account',
    currency: 'GHS',
    glAccountCode: cash ? '1110' : momo ? '1130' : '1120',
    openingBalanceType: 'period',
    openingBalance: 0,
    currentBalance: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Write a cashbook line for a receipt or refund that already posted to 1110, 1120, or 1130.
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
  if (!registerIdForGl(params.glCode)) return;
  const amount = Math.abs(params.amount);
  if (amount < 0.005) return;
  const store = getStore();
  if (store.bankTransactions.some((t) => t.journalEntryId === params.journalEntryId)) return;

  const now = new Date().toISOString();
  let bank = pickCashbookAccount(store.bankAccounts, params.glCode);
  if (!bank) {
    const registerId = registerIdForGl(params.glCode);
    if (!registerId) return;
    if (!store.bankAccounts.some((b) => b.id === registerId)) {
      store.addBankAccount(registerSeed(registerId, now));
    }
    bank = getStore().bankAccounts.find((b) => b.id === registerId) || null;
  }
  if (!bank) return;

  const signed = params.direction === 'in' ? amount : -amount;
  const newBalance = +((bank.currentBalance || 0) + signed).toFixed(2);
  store.updateBankAccount(bank.id, { currentBalance: newBalance, updatedAt: now });
  store.addBankTransaction({
    id: `BT-${params.journalEntryId}`,
    bankAccountId: bank.id,
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
