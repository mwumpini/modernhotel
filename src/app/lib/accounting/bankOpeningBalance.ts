import type { BankAccount, JournalEntry, JournalEntryLine } from './models';
import { assertPeriodNotClosed } from './periodClose';
import { logAccountingProcessWarn } from './accountingProcessLog';

/** Offset for bank opening balances — Retained Earnings (3200) in the Ghana hotel COA. */
export const GL_OPENING_BALANCE_EQUITY = '3200';

export const BANK_OPENING_SOURCE = 'bank_opening_balance';
export const BANK_OPENING_ADJ_SOURCE = 'bank_opening_balance_adjustment';

function lineId(jeId: string, seq: number) {
  return `JEL-${jeId}-${seq}`;
}

function jeNumber(seq: number) {
  return `JE-${new Date().getFullYear()}-${String(seq + 1).padStart(4, '0')}`;
}

/** Net debit posted to the bank GL from opening-balance journal entries. */
export function getPostedBankOpeningAmount(
  bankAccountId: string,
  bankGlCode: string,
  journalEntries: JournalEntry[]
): number {
  let net = 0;
  for (const je of journalEntries) {
    if (je.status !== 'Posted') continue;
    if (je.sourceModule !== BANK_OPENING_SOURCE && je.sourceModule !== BANK_OPENING_ADJ_SOURCE) continue;
    if (je.sourceTransactionId !== bankAccountId) continue;
    for (const line of je.lines) {
      if (line.accountCode === bankGlCode) {
        net += (line.debit || 0) - (line.credit || 0);
      }
    }
  }
  return Math.round(net * 100) / 100;
}

type GlStore = {
  journalEntries: JournalEntry[];
  currentPeriod: string;
  addJournalEntry: (entry: JournalEntry) => void;
  updateGLBalance: (
    accountCode: string,
    period: string,
    updates: { currentDebit?: number; currentCredit?: number }
  ) => void;
};

/** Whether opening balance should post to the general ledger. */
export function shouldPostOpeningToGl(
  account: Pick<BankAccount, 'id' | 'glAccountCode' | 'openingBalanceType'>,
  journalEntries: JournalEntry[]
): boolean {
  if (account.openingBalanceType === 'period') return false;
  if (account.openingBalanceType === 'go_live') return true;
  // Legacy: keep GL sync only if opening balance was already posted previously
  return (
    getPostedBankOpeningAmount(account.id, account.glAccountCode, journalEntries) !== 0
  );
}

/**
 * Post (or adjust) the GL opening balance for a bank/cash register so COA trial balance matches.
 * Dr Bank GL / Cr Retained Earnings when increasing; reverse when decreasing.
 * Skipped when openingBalanceType is `period` (year/statement opening — register only).
 */
export function syncBankOpeningBalanceToLedger(
  bankAccount: BankAccount,
  store: GlStore,
  equityGlCode = GL_OPENING_BALANCE_EQUITY
): { posted: boolean; delta: number; skipped?: boolean; error?: string } {
  if (!shouldPostOpeningToGl(bankAccount, store.journalEntries)) {
    return { posted: false, delta: 0, skipped: true };
  }

  const target = bankAccount.openingBalance ?? 0;
  const bankGl = bankAccount.glAccountCode;
  if (!bankGl) return { posted: false, delta: 0 };

  const posted = getPostedBankOpeningAmount(bankAccount.id, bankGl, store.journalEntries);
  const delta = Math.round((target - posted) * 100) / 100;
  if (Math.abs(delta) < 0.005) return { posted: false, delta: 0 };

  const now = new Date().toISOString();
  const periodCheck = assertPeriodNotClosed(store.journalEntries, now);
  if (!periodCheck.ok) {
    logAccountingProcessWarn('BankOpeningBalance', 'Bank opening balance GL post blocked — closed period', {
      bankAccountId: bankAccount.id,
      error: periodCheck.error,
    });
    return { posted: false, delta: 0, error: periodCheck.error };
  }
  const jeId = `JE-BOB-${bankAccount.id}-${Date.now()}`;
  const absDelta = Math.abs(delta);
  const isFirst = Math.abs(posted) < 0.005;
  const currency = bankAccount.currency || 'GHS';

  const bankLine: JournalEntryLine = {
    id: lineId(jeId, 1),
    journalEntryId: jeId,
    accountCode: bankGl,
    description: isFirst
      ? `Opening balance — ${bankAccount.accountName}`
      : `Opening balance adjustment — ${bankAccount.accountName}`,
    debit: delta > 0 ? absDelta : 0,
    credit: delta < 0 ? absDelta : 0,
    currency,
    reference: bankAccount.accountNumber || bankAccount.id,
  };

  const equityLine: JournalEntryLine = {
    id: lineId(jeId, 2),
    journalEntryId: jeId,
    accountCode: equityGlCode,
    description: isFirst
      ? `Opening balance offset — ${bankAccount.accountName}`
      : `Opening balance adjustment offset — ${bankAccount.accountName}`,
    debit: delta < 0 ? absDelta : 0,
    credit: delta > 0 ? absDelta : 0,
    currency,
    reference: bankAccount.accountNumber || bankAccount.id,
  };

  const entry: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(store.journalEntries.length),
    date: now.slice(0, 10),
    reference: bankAccount.accountNumber || bankAccount.id,
    description: isFirst
      ? `Bank opening balance — ${bankAccount.accountName}`
      : `Bank opening balance adjustment — ${bankAccount.accountName}`,
    totalDebit: absDelta,
    totalCredit: absDelta,
    currency,
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: isFirst ? BANK_OPENING_SOURCE : BANK_OPENING_ADJ_SOURCE,
    sourceTransactionId: bankAccount.id,
    lines: [bankLine, equityLine],
  };

  store.addJournalEntry(entry);
  for (const line of entry.lines) {
    store.updateGLBalance(line.accountCode, store.currentPeriod, {
      currentDebit: line.debit || 0,
      currentCredit: line.credit || 0,
    });
  }

  return { posted: true, delta };
}
