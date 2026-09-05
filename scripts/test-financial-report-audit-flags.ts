/**
 * Regression test for the two audit-assist checks added to the Trial Balance /
 * Financial Reports "Balance Check" diagnostics:
 *  - findUnmappedGlCodes: a posted line referencing a code absent from the CoA.
 *  - findNonLeafPostings: a posted line referencing a code that IS in the CoA
 *    but is a category header (has children), not a postable leaf.
 * Both now return per-entry drill-down (journalEntryId/date/reference/etc.),
 * not just an aggregate code+amount, so an accountant can go straight to the
 * offending entry instead of manually searching Journal Entries by code.
 */
import { findUnmappedGlCodes, findNonLeafPostings, type RollupCoa } from '../src/app/lib/accounting/financialReportRollup';
import type { JournalEntry } from '../src/app/lib/accounting/models';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const coa: RollupCoa[] = [
  { id: 'a1200', code: '1200', name: 'Accounts Receivable', type: 'Asset', level: 2, parentAccount: undefined },
  { id: 'a1210', code: '1210', name: 'Guest Accounts Receivable', type: 'Asset', level: 3, parentId: 'a1200', parentAccount: '1200' },
  { id: 'a4100', code: '4100', name: 'Room Revenue', type: 'Revenue', level: 3 },
];

function je(id: string, lines: Array<{ accountCode: string; debit?: number; credit?: number }>): JournalEntry {
  return {
    id,
    entryNumber: `JE-${id}`,
    date: '2026-06-01',
    reference: `REF-${id}`,
    description: `Test entry ${id}`,
    totalDebit: 0,
    totalCredit: 0,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-06-01',
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    sourceModule: 'test',
    lines: lines.map((l, i) => ({
      id: `${id}-L${i}`,
      journalEntryId: id,
      accountCode: l.accountCode,
      description: '',
      debit: l.debit || 0,
      credit: l.credit || 0,
      currency: 'GHS',
    })),
  } as JournalEntry;
}

// 1. Unmapped code — posted against '6000', not in the CoA at all.
{
  const jes = [je('JE-1', [{ accountCode: '1210', debit: 100 }, { accountCode: '6000', credit: 100 }])];
  const result = findUnmappedGlCodes(coa, jes);
  assert(result.length === 1, `expected 1 unmapped code, got ${result.length}`);
  assert(result[0].code === '6000', `expected code 6000, got ${result[0].code}`);
  assert(result[0].credit === 100, `expected credit 100, got ${result[0].credit}`);
  assert(result[0].entries.length === 1, `expected 1 drill-down entry, got ${result[0].entries.length}`);
  assert(result[0].entries[0].journalEntryId === 'JE-1', 'drill-down entry must point at the real JE id');
  assert(result[0].entries[0].reference === 'REF-JE-1', 'drill-down entry must carry the JE reference');
}

// 2. Non-leaf posting — posted directly against '1200' (a header with child '1210').
{
  const jes = [
    je('JE-2', [{ accountCode: '1200', debit: 500 }, { accountCode: '4100', credit: 500 }]),
    je('JE-3', [{ accountCode: '1210', debit: 50 }, { accountCode: '4100', credit: 50 }]),
  ];
  const result = findNonLeafPostings(coa, jes);
  assert(result.length === 1, `expected 1 non-leaf posting, got ${result.length}`);
  assert(result[0].code === '1200', `expected code 1200, got ${result[0].code}`);
  assert(result[0].name === 'Accounts Receivable', `expected header name, got ${result[0].name}`);
  assert(result[0].debit === 500, `expected debit 500 (only JE-2, not the leaf-posted JE-3), got ${result[0].debit}`);
  assert(result[0].entries.length === 1 && result[0].entries[0].journalEntryId === 'JE-2', 'must point at JE-2 specifically, not JE-3');
}

// 3. A clean, fully-leaf-posted ledger flags neither.
{
  const jes = [je('JE-4', [{ accountCode: '1210', debit: 10 }, { accountCode: '4100', credit: 10 }])];
  assert(findUnmappedGlCodes(coa, jes).length === 0, 'clean ledger must not flag any unmapped code');
  assert(findNonLeafPostings(coa, jes).length === 0, 'clean ledger must not flag any header-account posting');
}

console.log('All financial report audit-flag regression checks passed.');
