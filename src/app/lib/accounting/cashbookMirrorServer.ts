import { prisma } from '@/app/lib/database/client';
import { pickCashbookAccount } from './cashbookMirror';
import { ensureDefaultPaymentAccounts, ensureMobileMoneyGlAccount } from './repository';
import type { BankAccount } from './models';

/**
 * Same sub-ledger line as the client cashbook, for receipts posted on the server
 * (restaurant and bar). The journal already debited 1110, 1120, or 1130. This raises the
 * Bank & Cash row linked to that general account. It does not post a second journal.
 */
export async function mirrorGlCashToCashbookServer(params: {
  tenantId: string;
  glCode: string;
  amount: number;
  direction: 'in' | 'out';
  date: string;
  reference: string;
  description: string;
  journalEntryId: string;
}): Promise<void> {
  const amount = Math.abs(params.amount);
  if (amount < 0.005 || !params.journalEntryId) return;
  await ensureDefaultPaymentAccounts(params.tenantId);
  if ((params.glCode || '').trim() === '1130') {
    await ensureMobileMoneyGlAccount(params.tenantId);
  }

  const existing = await prisma.bankTransaction.findFirst({
    where: { tenantId: params.tenantId, journalEntryId: params.journalEntryId },
  });
  if (existing) return;

  const rows = await prisma.bankAccount.findMany({
    where: { tenantId: params.tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  const accounts: BankAccount[] = rows.map((row) => ({
    id: row.id,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    bankName: row.bankName,
    currency: row.currency || 'GHS',
    glAccountCode: row.glAccountCode,
    openingBalance: row.openingBalance ?? 0,
    currentBalance: row.currentBalance ?? 0,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
  const bank = pickCashbookAccount(accounts, params.glCode);
  if (!bank) return;

  const signed = params.direction === 'in' ? amount : -amount;
  const updated = await prisma.bankAccount.update({
    where: { id: bank.id },
    data: { currentBalance: { increment: signed } },
  });
  const now = new Date();
  await prisma.bankTransaction.create({
    data: {
      id: `BT-${params.journalEntryId}`,
      tenantId: params.tenantId,
      bankAccountId: bank.id,
      transactionDate: new Date(params.date || now.toISOString()),
      reference: params.reference,
      description: params.description,
      amount,
      type: params.direction === 'in' ? 'Deposit' : 'Withdrawal',
      currency: 'GHS',
      balance: +Number(updated.currentBalance || 0).toFixed(2),
      status: 'Cleared',
      journalEntryId: params.journalEntryId,
    },
  });
}

/** Pull a voided receipt back off the sub-account it was written to. */
export async function reverseCashbookMirrorServer(tenantId: string, journalEntryId: string): Promise<void> {
  if (!journalEntryId) return;
  const txn = await prisma.bankTransaction.findFirst({
    where: { tenantId, journalEntryId, status: { not: 'Void' } },
  });
  if (!txn) return;
  const signed = txn.type === 'Withdrawal' ? Math.abs(txn.amount) : -Math.abs(txn.amount);
  await prisma.bankAccount.update({
    where: { id: txn.bankAccountId },
    data: { currentBalance: { increment: signed } },
  });
  await prisma.bankTransaction.update({
    where: { id: txn.id },
    data: { status: 'Void' },
  });
}
