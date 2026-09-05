/**
 * Regression test for the missing "Trade Accounts Payable" leaf account, found via the
 * new findNonLeafPostings audit check: 2200 ("Accounts Payable") is a category header whose
 * only declared children were 2210/2220 (payroll withholdings) — there was no postable leaf
 * for supplier invoices/payments at all, so every AP posting landed on the header by
 * necessity. Fixed by adding 2205 under 2200 and repointing GL_ACCOUNTS.ACCOUNTS_PAYABLE
 * (the one shared constant AR/AP/CASH/BANK posting paths all read from) at it.
 */
import { GHANA_CHART_OF_ACCOUNTS } from '../src/app/lib/accounting/models';
import { buildPrebuiltChartOfAccounts } from '../src/app/lib/accounting/prebuiltChartOfAccounts';
// Note: GL_ACCOUNTS itself is deliberately not imported directly here. integration.ts ->
// store.ts -> invoicePostingBridge.ts -> integration.ts is an existing circular import that
// only resolves safely when entered via invoicePostingBridge.ts first (as the working
// buildPurchaseInvoiceJournalEntry import below does) -- entering via a direct integration.ts
// import first hits a genuine TDZ ReferenceError on GL_ACCOUNTS. The JE-posting check below
// verifies the same constant's effective value behaviorally instead.
import { buildPurchaseInvoiceJournalEntry } from '../src/app/lib/accounting/invoicePostingBridge';
import type { Invoice } from '../src/app/lib/accounting/models';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// 1. The template declares 2205 as a leaf under the 2200 header.
{
  const header = GHANA_CHART_OF_ACCOUNTS.find((a) => a.code === '2200');
  const leaf = GHANA_CHART_OF_ACCOUNTS.find((a) => a.code === '2205');
  assert(!!header && header.level === 2, '2200 must remain the category header (level 2)');
  assert(!!leaf, '2205 (Trade Accounts Payable) must exist in the template');
  assert(leaf!.level === 3, '2205 must be a leaf (level 3), not another header');
}

// 2. The built prebuilt COA links 2205's parent to 2200, not floating or mis-linked.
{
  const built = buildPrebuiltChartOfAccounts('GH');
  const header = built.find((a) => a.code === '2200')!;
  const leaf = built.find((a) => a.code === '2205')!;
  assert(!!header && !!leaf, 'both 2200 and 2205 must appear in the built COA');
  assert(leaf.parentId === header.id, `2205's parentId must resolve to 2200's id, got ${leaf.parentId} vs ${header.id}`);
}

// 3. A purchase invoice for a supplier with no glAccountCode set falls back to the leaf,
//    not the header — this is the actual default every NEW supplier now gets.
{
  const inv: Invoice = {
    id: 'AP-LEAF-TEST',
    invoiceNumber: 'AP-2026-9001',
    type: 'Purchase',
    date: '2026-06-01',
    dueDate: '2026-07-01',
    businessPartnerId: 'SUP-NEW',
    description: 'AP leaf-account regression check',
    subtotal: 100,
    taxAmount: 0,
    total: 100,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 0,
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    lines: [],
  };
  const result = buildPurchaseInvoiceJournalEntry(inv, { id: 'SUP-NEW' } as any, { journalSeq: 0 });
  assert(result.ok, 'purchase JE builds for a supplier with no glAccountCode set');
  if (result.ok) {
    const apLine = result.entry.lines.find((l) => l.credit > 0);
    assert(!!apLine, 'AP credit line exists');
    assert(apLine!.accountCode === '2205', `AP line must default to leaf 2205, got ${apLine!.accountCode}`);
  }
}

console.log('All AP leaf-account regression checks passed.');
