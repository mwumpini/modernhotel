import type { BankReconciliation, ReconcilingItem } from './types';

export function validateReconciliation(
  recon: Partial<BankReconciliation>,
  items: ReconcilingItem[]
): string[] {
  const errors: string[] = [];

  if (!recon.periodEndDate) errors.push('Period end date is required');
  if (recon.statementBalance == null || Number.isNaN(recon.statementBalance)) {
    errors.push('Bank statement balance is required');
  }
  if (recon.cashbookBalance == null || Number.isNaN(recon.cashbookBalance)) {
    errors.push('Cashbook balance is required');
  }
  if (!recon.bankAccountId) errors.push('Bank account is required');

  for (const item of items) {
    if (!item.description?.trim()) {
      errors.push('Every reconciling item needs a description');
      break;
    }
    if (!item.amount || item.amount <= 0) {
      errors.push('Item amounts must be positive');
      break;
    }
    if (!item.itemType) {
      errors.push('Every item needs a type');
      break;
    }
  }

  return errors;
}

export function validateItem(item: Partial<ReconcilingItem>): string[] {
  const errors: string[] = [];
  if (!item.itemType) errors.push('Item type is required');
  if (!item.description?.trim()) errors.push('Description is required');
  if (!item.amount || item.amount <= 0) errors.push('Amount must be greater than zero');
  return errors;
}
