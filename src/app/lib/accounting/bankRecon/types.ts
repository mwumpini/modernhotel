export type ReconStatus = 'Draft' | 'Completed' | 'Approved';

export type ReconcilingItemType =
  | 'DEPOSIT_IN_TRANSIT'
  | 'OUTSTANDING_CHEQUE'
  | 'BANK_ERROR_ADD'
  | 'BANK_ERROR_DEDUCT'
  | 'BANK_CREDIT_NOT_IN_BOOK'
  | 'BANK_CHARGE_NOT_IN_BOOK'
  | 'BOOK_ERROR_ADD'
  | 'BOOK_ERROR_DEDUCT';

export type ReconSide = 'bank' | 'book';

export interface ReconcilingItem {
  id: string;
  reconciliationId: string;
  itemType: ReconcilingItemType;
  description: string;
  reference?: string;
  transactionDate?: string;
  amount: number;
  isCleared: boolean;
  clearedDate?: string;
  journalEntryId?: string;
  offsetGlCode?: string;
  carriedFromItemId?: string;
  createdAt: string;
}

export interface BankReconciliation {
  id: string;
  bankAccountId: string;
  periodEndDate: string;
  statementBalance: number;
  /** Snapshot; live draft uses GL via ledgerSync */
  cashbookBalance: number;
  status: ReconStatus;
  preparedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationComputed {
  statementBalance: number;
  depositsInTransit: number;
  outstandingCheques: number;
  bankErrorsAdd: number;
  bankErrorsDeduct: number;
  adjustedBankBalance: number;
  cashbookBalance: number;
  bankCreditsNotInBook: number;
  bankChargesNotInBook: number;
  bookErrorsAdd: number;
  bookErrorsDeduct: number;
  adjustedCashbookBalance: number;
  difference: number;
  isBalanced: boolean;
  status: 'Balanced' | 'Unbalanced';
}

export interface ItemTypeMeta {
  type: ReconcilingItemType;
  label: string;
  side: ReconSide;
  effect: 'add' | 'deduct';
  hint: string;
}
