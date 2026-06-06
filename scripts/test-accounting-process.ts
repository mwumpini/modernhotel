import {
  invoiceNeedsGlPost,
  paymentNeedsGlPost,
  findJournalEntryForInvoice,
  invoiceSyncStatus,
  PERIOD_CLOSE_SOURCE,
  MANUAL_AR_AP_SOURCE,
} from '../src/app/lib/accounting/accountingProcessPolicy';
import {
  buildSalesInvoiceJournalEntry,
  buildReceiptJournalEntry,
  buildPurchaseInvoiceJournalEntry,
} from '../src/app/lib/accounting/invoicePostingBridge';
import {
  buildProfitLossCloseEntry,
  hasPeriodCloseForDate,
} from '../src/app/lib/accounting/periodClose';
import {
  isAuthoritativeRevenueSource,
  shouldIncludeJeLineInRevenueRollup,
} from '../src/app/lib/accounting/revenueSourcePolicy';
import type { Invoice, JournalEntry, Payment } from '../src/app/lib/accounting/models';
import { defaultRollupCoa } from '../src/app/lib/accounting/jeDrivenReports';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// Manual AR invoice needs GL; integration departmental invoice does not (same-flow capture)
{
  const manualInv: Invoice = {
    id: 'INV-MAN-1',
    invoiceNumber: 'INV-2026-0001',
    type: 'Sales',
    date: '2026-06-01',
    dueDate: '2026-07-01',
    businessPartnerId: 'CUST-1',
    description: 'Manual sales',
    subtotal: 1000,
    taxAmount: 210,
    total: 1210,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 0,
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    lines: [],
    sourceModule: MANUAL_AR_AP_SOURCE,
  };
  const restInv = { ...manualInv, id: 'INV-REST-1', sourceModule: 'restaurant' };
  assert(invoiceNeedsGlPost(manualInv, []), 'manual invoice needs GL');
  assert(!invoiceNeedsGlPost(restInv, []), 'restaurant invoice deferred to integration');
  assert(invoiceSyncStatus(manualInv, []) === 'subledger_only', 'manual subledger only');
}

// Sales invoice JE is balanced
{
  const inv: Invoice = {
    id: 'INV-2',
    invoiceNumber: 'INV-2026-0002',
    type: 'Sales',
    date: '2026-06-02',
    dueDate: '2026-07-02',
    businessPartnerId: 'CUST-2',
    description: 'Consulting',
    subtotal: 500,
    taxAmount: 105,
    total: 605,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 0,
    createdAt: '2026-06-02',
    updatedAt: '2026-06-02',
    lines: [],
    sourceModule: MANUAL_AR_AP_SOURCE,
  };
  const result = buildSalesInvoiceJournalEntry(inv, undefined, { journalSeq: 0 });
  assert(result.ok, 'sales JE built');
  if (result.ok) {
    assert(result.entry.totalDebit === result.entry.totalCredit, 'sales JE balanced');
    assert(result.entry.lines.some((l) => l.accountCode === '1200' && l.debit === 605), 'Dr AR');
    assert(result.entry.sourceModule === MANUAL_AR_AP_SOURCE, 'manual source tag');
  }
}

// Customer receipt JE
{
  const pay: Payment = {
    id: 'RCP-1',
    paymentNumber: 'RCP-2026-0001',
    date: '2026-06-03',
    type: 'Receipt',
    businessPartnerId: 'CUST-2',
    description: 'Payment on account',
    amount: 605,
    currency: 'GHS',
    paymentMethod: 'Cash',
    status: 'Posted',
    createdAt: '2026-06-03',
    updatedAt: '2026-06-03',
    sourceModule: MANUAL_AR_AP_SOURCE,
  };
  assert(paymentNeedsGlPost(pay, []), 'manual receipt needs GL');
  assert(!paymentNeedsGlPost({ ...pay, sourceModule: 'bar' }, []), 'bar receipt via integration');
  const result = buildReceiptJournalEntry(pay, { id: 'CUST-2', glAccountCode: '1200' } as any, {
    journalSeq: 1,
  });
  assert(result.ok, 'receipt JE built');
  if (result.ok) {
    assert(result.entry.totalDebit === 605, 'receipt amount');
  }
}

// Purchase invoice JE
{
  const inv: Invoice = {
    id: 'AP-1',
    invoiceNumber: 'AP-2026-0001',
    type: 'Purchase',
    date: '2026-06-04',
    dueDate: '2026-07-04',
    businessPartnerId: 'SUP-1',
    description: 'Supplies',
    subtotal: 200,
    taxAmount: 42,
    total: 242,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 0,
    createdAt: '2026-06-04',
    updatedAt: '2026-06-04',
    lines: [],
    sourceModule: MANUAL_AR_AP_SOURCE,
  };
  const result = buildPurchaseInvoiceJournalEntry(inv, { id: 'SUP-1', glAccountCode: '2200' } as any, {
    journalSeq: 2,
  });
  assert(result.ok, 'purchase JE built');
  if (result.ok) {
    assert(result.entry.totalDebit === result.entry.totalCredit, 'AP JE balanced');
  }
}

// Period close idempotency
{
  const coa = defaultRollupCoa();
  const jes: JournalEntry[] = [
    {
      id: 'JE-1',
      entryNumber: 'JE-2026-0001',
      date: '2026-06-01',
      reference: 'SALE-1',
      description: 'Room revenue',
      totalDebit: 1000,
      totalCredit: 1000,
      currency: 'GHS',
      status: 'Posted',
      postedBy: 'system',
      postedAt: '2026-06-01',
      createdAt: '2026-06-01',
      updatedAt: '2026-06-01',
      sourceModule: 'front_office_checkout',
      lines: [
        {
          id: 'l1',
          journalEntryId: 'JE-1',
          accountCode: '1200',
          description: 'AR',
          debit: 1000,
          credit: 0,
          currency: 'GHS',
        },
        {
          id: 'l2',
          journalEntryId: 'JE-1',
          accountCode: '4100',
          description: 'Room',
          debit: 0,
          credit: 1000,
          currency: 'GHS',
        },
      ],
    },
  ];
  const first = buildProfitLossCloseEntry(jes, coa, '2026-06-30');
  assert(first.ok, 'first close builds');
  if (first.ok) {
    jes.push(first.entry);
    assert(hasPeriodCloseForDate(jes, '2026-06-30'), 'close recorded');
    const second = buildProfitLossCloseEntry(jes, coa, '2026-06-30');
    assert(!second.ok, 'duplicate close rejected');
  }
}

// Revenue rollup policy (regression)
{
  const checkoutJe = { sourceModule: 'front_office_checkout' } as JournalEntry;
  const foJe = { sourceModule: 'front_office' } as JournalEntry;
  assert(isAuthoritativeRevenueSource('front_office_checkout'), 'checkout authoritative');
  assert(!isAuthoritativeRevenueSource('front_office'), 'fo builder excluded');
  assert(shouldIncludeJeLineInRevenueRollup(checkoutJe, 'Revenue'), 'checkout in rollup');
  assert(!shouldIncludeJeLineInRevenueRollup(foJe, 'Revenue'), 'fo revenue excluded');
}

// Linked JE detection prevents re-post
{
  const inv: Invoice = {
    id: 'INV-LINK',
    invoiceNumber: 'INV-LINK-1',
    type: 'Sales',
    date: '2026-06-05',
    dueDate: '2026-07-05',
    businessPartnerId: 'C-1',
    description: 'Linked',
    subtotal: 100,
    taxAmount: 0,
    total: 100,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 0,
    createdAt: '2026-06-05',
    updatedAt: '2026-06-05',
    lines: [],
    journalEntryId: 'JE-LINK',
  };
  const jes: JournalEntry[] = [
    {
      id: 'JE-LINK',
      entryNumber: 'JE-2026-0099',
      date: '2026-06-05',
      reference: 'INV-LINK-1',
      description: 'Already posted',
      totalDebit: 100,
      totalCredit: 100,
      currency: 'GHS',
      status: 'Posted',
      postedBy: 'system',
      postedAt: '2026-06-05',
      createdAt: '2026-06-05',
      updatedAt: '2026-06-05',
      lines: [],
    },
  ];
  assert(!invoiceNeedsGlPost(inv, jes), 'linked invoice skipped');
  assert(findJournalEntryForInvoice(inv, jes)?.id === 'JE-LINK', 'JE found');
  assert(invoiceSyncStatus(inv, jes) === 'synced', 'synced status');
}

console.log('All accounting process regression checks passed.');
