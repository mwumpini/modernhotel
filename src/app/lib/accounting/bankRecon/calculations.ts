import type { BankReconciliation, ReconcilingItem, ReconciliationComputed, ReconcilingItemType } from './types';

const BANK_TYPES: ReconcilingItemType[] = [
  'DEPOSIT_IN_TRANSIT',
  'OUTSTANDING_CHEQUE',
  'BANK_ERROR_ADD',
  'BANK_ERROR_DEDUCT',
];

const BOOK_TYPES: ReconcilingItemType[] = [
  'BANK_CREDIT_NOT_IN_BOOK',
  'BANK_CHARGE_NOT_IN_BOOK',
  'BOOK_ERROR_ADD',
  'BOOK_ERROR_DEDUCT',
];

function sumType(
  items: ReconcilingItem[],
  type: ReconcilingItemType,
  opts?: { excludePosted?: boolean; excludeCleared?: boolean }
): number {
  return items
    .filter((i) => {
      if (i.itemType !== type) return false;
      if (opts?.excludePosted && i.journalEntryId) return false;
      if (opts?.excludeCleared && i.isCleared) return false;
      return true;
    })
    .reduce((s, i) => s + i.amount, 0);
}

export function computeReconciliation(
  recon: Pick<BankReconciliation, 'statementBalance' | 'cashbookBalance'>,
  items: ReconcilingItem[]
): ReconciliationComputed {
  const depositsInTransit = sumType(items, 'DEPOSIT_IN_TRANSIT', { excludeCleared: true });
  const outstandingCheques = sumType(items, 'OUTSTANDING_CHEQUE', { excludeCleared: true });
  const bankErrorsAdd = sumType(items, 'BANK_ERROR_ADD');
  const bankErrorsDeduct = sumType(items, 'BANK_ERROR_DEDUCT');

  const adjustedBankBalance =
    recon.statementBalance +
    depositsInTransit -
    outstandingCheques +
    bankErrorsAdd -
    bankErrorsDeduct;

  /** Posted book-side items are already in cashbookBalance — exclude to avoid double-count. */
  const bankCreditsNotInBook = sumType(items, 'BANK_CREDIT_NOT_IN_BOOK', { excludePosted: true });
  const bankChargesNotInBook = sumType(items, 'BANK_CHARGE_NOT_IN_BOOK', { excludePosted: true });
  const bookErrorsAdd = sumType(items, 'BOOK_ERROR_ADD', { excludePosted: true });
  const bookErrorsDeduct = sumType(items, 'BOOK_ERROR_DEDUCT', { excludePosted: true });

  const adjustedCashbookBalance =
    recon.cashbookBalance +
    bankCreditsNotInBook -
    bankChargesNotInBook +
    bookErrorsAdd -
    bookErrorsDeduct;

  const difference = Math.round((adjustedBankBalance - adjustedCashbookBalance) * 100) / 100;
  const isBalanced = Math.abs(difference) < 0.01;

  return {
    statementBalance: recon.statementBalance,
    depositsInTransit,
    outstandingCheques,
    bankErrorsAdd,
    bankErrorsDeduct,
    adjustedBankBalance,
    cashbookBalance: recon.cashbookBalance,
    bankCreditsNotInBook,
    bankChargesNotInBook,
    bookErrorsAdd,
    bookErrorsDeduct,
    adjustedCashbookBalance,
    difference,
    isBalanced,
    status: isBalanced ? 'Balanced' : 'Unbalanced',
  };
}

export function itemsForSide(items: ReconcilingItem[], side: 'bank' | 'book'): ReconcilingItem[] {
  const types = side === 'bank' ? BANK_TYPES : BOOK_TYPES;
  return items.filter((i) => types.includes(i.itemType));
}

export function bookSideItemsNeedingJournal(items: ReconcilingItem[]): ReconcilingItem[] {
  return items.filter(
    (i) =>
      BOOK_TYPES.includes(i.itemType) &&
      !i.journalEntryId
  );
}

export function outstandingChequesCarryForward(items: ReconcilingItem[]): Omit<ReconcilingItem, 'id' | 'reconciliationId' | 'journalEntryId'>[] {
  return items
    .filter((i) => i.itemType === 'OUTSTANDING_CHEQUE' && !i.isCleared)
    .map(({ id, reconciliationId, journalEntryId, ...rest }) => ({
      ...rest,
      carriedFromItemId: id,
    }));
}

export function depositsInTransitCarryForward(items: ReconcilingItem[]): Omit<ReconcilingItem, 'id' | 'reconciliationId' | 'journalEntryId'>[] {
  return items
    .filter((i) => i.itemType === 'DEPOSIT_IN_TRANSIT' && !i.isCleared)
    .map(({ id, reconciliationId, journalEntryId, ...rest }) => ({
      ...rest,
      carriedFromItemId: id,
    }));
}

/** Most recent reconciliation for this bank account whose period ends strictly before `currentPeriodEnd` — the true "prior period," regardless of the gap between reconciliation dates (e.g. monthly cadence). */
export function findPriorReconciliation<T extends { bankAccountId: string; periodEndDate: string }>(
  reconciliations: T[],
  bankAccountId: string,
  currentPeriodEnd: string
): T | undefined {
  return reconciliations
    .filter((r) => r.bankAccountId === bankAccountId && r.periodEndDate < currentPeriodEnd)
    .sort((a, b) => (a.periodEndDate < b.periodEndDate ? 1 : -1))[0];
}
