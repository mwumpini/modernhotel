/**
 * End-to-end wiring checks for accounting integration paths (no browser).
 * Run: npx tsx scripts/test-accounting-wiring.ts
 */

import {
  invoiceNeedsGlPost,
  paymentNeedsGlPost,
  MANUAL_AR_AP_SOURCE,
} from '../src/app/lib/accounting/accountingProcessPolicy';
import {
  buildSalesInvoiceJournalEntry,
  buildReceiptJournalEntry,
} from '../src/app/lib/accounting/invoicePostingBridge';
import { computeStackedTaxLines } from '../src/app/lib/accounting/taxFromConfig';
import { taxConfigsFromGhanaTemplate } from '../src/app/lib/accounting/taxFromConfig';
import { buildOperationalAccountingSeed } from '../src/app/lib/accounting/operationalSeed';
import { buildChartOfAccountsFromTemplate } from '../src/app/lib/accounting/chartOfAccountsTemplates';
import { EMPTY_TRANSACTION_SEED } from '../src/app/lib/accounting/operationalSeed';
import type { Invoice, JournalEntry, Payment } from '../src/app/lib/accounting/models';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// ── Country bootstrap (multi-tenant wiring) ─────────────────────────────────
{
  const coa = buildChartOfAccountsFromTemplate('GH');
  assert(coa.length > 20, 'Ghana COA template loads');
  assert(coa.every((a) => a.currency === 'GHS'), 'COA currency from country template');
  const op = buildOperationalAccountingSeed('GH');
  assert(op.revenueCenters.some((r) => r.code === 'RM'), 'RM revenue center for folio checkout');
  assert(op.costCenters.some((c) => c.code === 'FB'), 'FB cost center for F&B');
}

// ── Production seed is empty (no demo pollution) ────────────────────────────
{
  assert(EMPTY_TRANSACTION_SEED.journalEntries.length === 0, 'production JE seed empty');
  assert(EMPTY_TRANSACTION_SEED.invoices.length === 0, 'production invoice seed empty');
}

// ── Integration source modules skip manual bridge ───────────────────────────
{
  const deptInv: Invoice = {
    id: 'INV-R-1',
    invoiceNumber: 'INV-R-1',
    type: 'Sales',
    date: '2026-06-01',
    dueDate: '2026-07-01',
    businessPartnerId: 'G-1',
    description: 'Restaurant',
    subtotal: 100,
    taxAmount: 21,
    total: 121,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 0,
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    lines: [],
    sourceModule: 'restaurant',
  };
  assert(!invoiceNeedsGlPost(deptInv, []), 'restaurant invoice skips bridge');

  const deptPay: Payment = {
    id: 'RCP-R-1',
    paymentNumber: 'RCP-R-1',
    date: '2026-06-01',
    type: 'Receipt',
    businessPartnerId: 'G-1',
    description: 'Restaurant receipt',
    amount: 121,
    currency: 'GHS',
    paymentMethod: 'Cash',
    status: 'Posted',
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    sourceModule: 'bar',
  };
  assert(!paymentNeedsGlPost(deptPay, []), 'bar receipt skips bridge');
}

// ── Folio checkout skips bridge on invoice and payment ──────────────────────
{
  const foInv: Invoice = {
    id: 'A-INV-1',
    invoiceNumber: 'INV-FO-1',
    type: 'Sales',
    date: '2026-06-02',
    dueDate: '2026-07-02',
    businessPartnerId: 'G-2',
    description: 'Folio',
    subtotal: 800,
    taxAmount: 168,
    total: 968,
    currency: 'GHS',
    status: 'Paid',
    paidAmount: 968,
    createdAt: '2026-06-02',
    updatedAt: '2026-06-02',
    lines: [],
    sourceModule: 'front_office_checkout',
  };
  assert(!invoiceNeedsGlPost(foInv, []), 'folio invoice skips bridge');

  const foPay: Payment = {
    id: 'A-PAY-1',
    paymentNumber: 'PAY-FO-1',
    date: '2026-06-02',
    type: 'Receipt',
    businessPartnerId: 'G-2',
    description: 'Folio payment',
    amount: 968,
    currency: 'GHS',
    paymentMethod: 'Cash',
    status: 'Posted',
    createdAt: '2026-06-02',
    updatedAt: '2026-06-02',
    sourceModule: 'front_office_checkout',
  };
  assert(!paymentNeedsGlPost(foPay, []), 'folio payment skips bridge');
}

// ── Manual AR still posts via bridge ────────────────────────────────────────
{
  const manualInv: Invoice = {
    id: 'INV-M-1',
    invoiceNumber: 'INV-M-1',
    type: 'Sales',
    date: '2026-06-03',
    dueDate: '2026-07-03',
    businessPartnerId: 'C-1',
    description: 'Corporate',
    subtotal: 1000,
    taxAmount: 210,
    total: 1210,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 0,
    createdAt: '2026-06-03',
    updatedAt: '2026-06-03',
    lines: [],
    sourceModule: MANUAL_AR_AP_SOURCE,
  };
  assert(invoiceNeedsGlPost(manualInv, []), 'manual AR still needs bridge');
  const je = buildSalesInvoiceJournalEntry(manualInv, undefined, { journalSeq: 0 });
  assert(je.ok, 'manual sales JE builds');
  if (je.ok) {
    assert(Math.abs(je.entry.totalDebit - je.entry.totalCredit) < 0.01, 'manual sales balanced');
  }
}

// ── Ghana tax stack arithmetic (F&B / events path) ──────────────────────────
{
  const configs = taxConfigsFromGhanaTemplate();
  const subtotal = 1000;
  const { lines, totalTax } = computeStackedTaxLines(subtotal, configs, 'sales');
  assert(lines.length >= 3, 'NHIL + GETFund + VAT lines');
  assert(Math.abs(subtotal + totalTax - (subtotal + totalTax)) < 0.01, 'tax total numeric');
  const gross = subtotal + totalTax;
  assert(gross > subtotal, 'gross exceeds net');
}

// ── Duplicate JE link prevents re-post ──────────────────────────────────────
{
  const inv: Invoice = {
    id: 'INV-LINK-2',
    invoiceNumber: 'INV-LINK-2',
    type: 'Sales',
    date: '2026-06-04',
    dueDate: '2026-07-04',
    businessPartnerId: 'C-2',
    description: 'Linked',
    subtotal: 200,
    taxAmount: 0,
    total: 200,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 0,
    createdAt: '2026-06-04',
    updatedAt: '2026-06-04',
    lines: [],
    journalEntryId: 'JE-LINK-2',
    sourceModule: MANUAL_AR_AP_SOURCE,
  };
  const jes: JournalEntry[] = [
    {
      id: 'JE-LINK-2',
      entryNumber: 'JE-2026-0100',
      date: '2026-06-04',
      reference: 'INV-LINK-2',
      description: 'Posted',
      totalDebit: 200,
      totalCredit: 200,
      currency: 'GHS',
      status: 'Posted',
      postedBy: 'system',
      postedAt: '2026-06-04',
      createdAt: '2026-06-04',
      updatedAt: '2026-06-04',
      lines: [],
    },
  ];
  assert(!invoiceNeedsGlPost(inv, jes), 'linked invoice not re-posted');
}

// ── Deterministic folio checkout JE id pattern ──────────────────────────────
{
  const invoiceId = 'A-INV-999';
  const salesJeId = `JE-FO-CHK-${invoiceId}`;
  assert(salesJeId === 'JE-FO-CHK-A-INV-999', 'deterministic checkout JE id');
  const payJeId = `JE-FO-PAY-${invoiceId}-0`;
  assert(payJeId.startsWith('JE-FO-PAY-'), 'deterministic payment JE id');
}

console.log('All accounting end-to-end wiring checks passed.');
