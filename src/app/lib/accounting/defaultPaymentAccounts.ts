import type { BankAccount } from './models';

/** One till for each default method of payment. Balances start at zero. */
export const DEFAULT_PAYMENT_ACCOUNTS: Array<
  Pick<BankAccount, 'id' | 'accountNumber' | 'accountName' | 'bankName' | 'glAccountCode'>
> = [
  { id: 'default-cash-1110', accountNumber: '1110-0001', accountName: 'Cash', bankName: 'Cash', glAccountCode: '1110' },
  { id: 'default-bank-1120', accountNumber: '1120-0001', accountName: 'Bank', bankName: 'Bank', glAccountCode: '1120' },
  { id: 'reg-momo-1130', accountNumber: '1130-0001', accountName: 'Mobile Money', bankName: 'Mobile Money', glAccountCode: '1130' },
];

export function buildDefaultPaymentAccounts(now = new Date().toISOString()): BankAccount[] {
  return DEFAULT_PAYMENT_ACCOUNTS.map((row) => ({
    ...row,
    currency: 'GHS',
    openingBalanceType: 'period' as const,
    openingBalance: 0,
    currentBalance: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
}
