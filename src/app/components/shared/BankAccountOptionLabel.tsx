'use client';

import type { BankAccount } from '@/app/lib/accounting/models';
import { GL_CASH_IN_HAND } from '@/app/lib/accounting/bankCoaLink';

/**
 * Label for a bank/cash account inside a <SelectItem> — used anywhere a form lets the user
 * pick which real Bank & Cash account a payment/receipt moved through. Bank-vs-cash isn't a
 * stored flag on BankAccount — it's implied by which GL account the account posts to (1110
 * Cash in Hand vs 1120 Bank Accounts / a dedicated 112x code).
 */
export default function BankAccountOptionLabel({ account }: { account: BankAccount }) {
  const isCash = account.glAccountCode === GL_CASH_IN_HAND;
  return (
    <>
      {isCash ? '💵' : '🏦'} {account.accountName}{account.bankName && !isCash ? ` · ${account.bankName}` : ''}{' '}
      <span className="text-xs text-gray-400">({isCash ? 'Cash' : 'Bank'})</span>
    </>
  );
}
