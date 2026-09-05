import {
  computeReconciliation,
  findPriorReconciliation,
  outstandingChequesCarryForward,
} from '../src/app/lib/accounting/bankRecon/calculations';
import type { ReconcilingItem } from '../src/app/lib/accounting/bankRecon/types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function item(partial: Partial<ReconcilingItem> & Pick<ReconcilingItem, 'itemType' | 'amount'>): ReconcilingItem {
  return {
    id: partial.id || 'i1',
    reconciliationId: 'r1',
    description: partial.description || 'test',
    isCleared: partial.isCleared ?? false,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

// Basic balance
{
  const r = computeReconciliation(
    { statementBalance: 10000, cashbookBalance: 9500 },
    [
      item({ itemType: 'DEPOSIT_IN_TRANSIT', amount: 500 }),
      item({ itemType: 'OUTSTANDING_CHEQUE', amount: 200 }),
    ]
  );
  assert(r.adjustedBankBalance === 10300, `bank adj ${r.adjustedBankBalance}`);
  assert(r.adjustedCashbookBalance === 9500, `book adj ${r.adjustedCashbookBalance}`);
  assert(!r.isBalanced, 'should be unbalanced');
}

// Cleared cheque excluded
{
  const r = computeReconciliation(
    { statementBalance: 1000, cashbookBalance: 1000 },
    [item({ itemType: 'OUTSTANDING_CHEQUE', amount: 500, isCleared: true })]
  );
  assert(r.outstandingCheques === 0, 'cleared cheque excluded');
  assert(r.isBalanced, 'should balance when cleared');
}

// Posted book item excluded (no double count after GL post)
{
  const r = computeReconciliation(
    { statementBalance: 5050, cashbookBalance: 5050 },
    [item({ itemType: 'BANK_CREDIT_NOT_IN_BOOK', amount: 50, journalEntryId: 'JE-1' })]
  );
  assert(r.bankCreditsNotInBook === 0, 'posted credit excluded from adjustment');
  assert(r.adjustedCashbookBalance === 5050, 'cashbook not double-counted');
  assert(r.isBalanced, 'balanced after post when statement matches GL');
}

// Classic two-block scenario
{
  const r = computeReconciliation(
    { statementBalance: 12000, cashbookBalance: 10800 },
    [
      item({ itemType: 'DEPOSIT_IN_TRANSIT', amount: 500 }),
      item({ itemType: 'OUTSTANDING_CHEQUE', amount: 1500 }),
      item({ itemType: 'BANK_CREDIT_NOT_IN_BOOK', amount: 200 }),
    ]
  );
  assert(r.adjustedBankBalance === 11000, `bank ${r.adjustedBankBalance}`);
  assert(r.adjustedCashbookBalance === 11000, `book ${r.adjustedCashbookBalance}`);
  assert(r.isBalanced, 'classic recon scenario should balance');
}

// findPriorReconciliation picks the most recent period before the current one,
// regardless of the gap between reconciliation dates (e.g. monthly cadence).
{
  const reconList = [
    { bankAccountId: 'b1', periodEndDate: '2026-04-30' },
    { bankAccountId: 'b1', periodEndDate: '2026-05-31' },
    { bankAccountId: 'b2', periodEndDate: '2026-05-31' },
  ];
  const prior = findPriorReconciliation(reconList, 'b1', '2026-06-30');
  assert(!!prior && prior.periodEndDate === '2026-05-31', `prior ${prior?.periodEndDate}`);
  assert(!findPriorReconciliation(reconList, 'b1', '2026-04-30'), 'no prior before earliest');
}

// carry forward uncleared only
{
  const carried = outstandingChequesCarryForward([
    item({ id: 'c1', itemType: 'OUTSTANDING_CHEQUE', amount: 100, isCleared: false }),
    item({ id: 'c2', itemType: 'OUTSTANDING_CHEQUE', amount: 50, isCleared: true }),
  ]);
  assert(carried.length === 1, 'only uncleared carried');
  assert(carried[0].carriedFromItemId === 'c1', 'carriedFrom set');
}

console.log('All bank recon calculation tests passed.');
