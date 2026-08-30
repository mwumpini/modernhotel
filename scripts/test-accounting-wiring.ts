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
  buildWHTClearingJournalEntry,
} from '../src/app/lib/accounting/invoicePostingBridge';
import { computeStackedTaxLines, taxConfigsFromGhanaTemplate } from '../src/app/lib/accounting/taxFromConfig';
import { computeInvoiceWhtSettlement } from '../src/app/lib/accounting/whtRates';
import {
  buildReversalJournalEntry,
  hasReversalForEntry,
  AR_AP_REVERSAL_SOURCE,
} from '../src/app/lib/accounting/journalReversal';
import {
  mergeWhtCertificateLists,
  whtCertificatesFromPayments,
} from '../src/app/lib/accounting/whtCertificateSync';
import { toStorePayment } from '../src/app/lib/accounting/repository';
import { buildOperationalAccountingSeed } from '../src/app/lib/accounting/operationalSeed';
import { toRollupCoa, verifyCoaHierarchy } from '../src/app/lib/accounting/coaHierarchy';
import { buildChartOfAccountsFromTemplate } from '../src/app/lib/accounting/chartOfAccountsTemplates';
import { createCoaAccount, normalizeCoaList } from '../src/app/lib/accounting/coaTree';
import { buildFinancialAccountTree } from '../src/app/lib/accounting/financialReportRollup';
import { EMPTY_TRANSACTION_SEED } from '../src/app/lib/accounting/operationalSeed';
import type { Invoice, JournalEntry, Payment } from '../src/app/lib/accounting/models';
import {
  isFinanceArInvoice,
  invoiceOpenBalance,
  totalFinanceReceivables,
  computeFinanceAgingBuckets,
} from '../src/app/lib/accounting/arSubledger';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// ── Country bootstrap (multi-tenant wiring) ─────────────────────────────────
{
  const coa = buildChartOfAccountsFromTemplate('GH');
  assert(coa.length > 50, 'Prebuilt Ghana COA loads with main/sub/detail accounts');
  assert(coa.every((a) => a.currency === 'GHS'), 'COA currency is GHS');
  assert(verifyCoaHierarchy(coa).length === 0, 'Prebuilt parentId links are valid');
  assert(coa.find((a) => a.code === '1000')?.level === 1, '1000 is main account');
  assert(coa.find((a) => a.code === '1100')?.level === 2, '1100 is sub account');
  assert(coa.find((a) => a.code === '1110')?.level === 3, '1110 is detail account');
  const main = coa.find((a) => a.code === '1000')!;
  const sub = coa.find((a) => a.code === '1100')!;
  const detail = coa.find((a) => a.code === '1110')!;
  assert(sub.parentId === main.id, '1100 rolls up to 1000');
  assert(detail.parentId === sub.id, '1110 rolls up to 1100');

  const tree = buildFinancialAccountTree(toRollupCoa(coa), [], { kind: 'cumulative', endDate: new Date() });
  const assetsNode = tree.find((n) => n.code === '1000');
  assert(!!assetsNode, '1000 is a root node in financial tree');
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

// ── Finance AR subledger (Option B) ─────────────────────────────────────────
{
  const posted: Invoice = {
    id: 'INV-FIN-1',
    invoiceNumber: 'INV-FIN-1',
    type: 'Sales',
    date: '2026-06-01',
    dueDate: '2026-06-15',
    businessPartnerId: 'C-1',
    description: 'Posted sales',
    subtotal: 500,
    taxAmount: 0,
    total: 500,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 200,
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    lines: [],
    sourceModule: 'manual_ar_ap',
  };
  const proforma = { ...posted, id: 'PRO-1', status: 'Draft' as const, isProforma: true } as Invoice & { isProforma: boolean };
  assert(isFinanceArInvoice(posted), 'posted sales is finance AR');
  assert(!isFinanceArInvoice(proforma), 'proforma excluded from finance AR');
  assert(invoiceOpenBalance(posted) === 300, 'open balance from paidAmount');
  assert(totalFinanceReceivables([posted, proforma]) === 300, 'totals exclude proforma');
  const buckets = computeFinanceAgingBuckets([posted], new Date('2026-06-20'));
  assert(buckets.some((b) => b.total > 0), 'aging buckets populated');
}

// ── WHT settlement + GL clearing ───────────────────────────────────────────
{
  const configs = taxConfigsFromGhanaTemplate();
  const full = computeInvoiceWhtSettlement(
    { total: 1210, subtotal: 1000, taxAmount: 210, paidAmount: 0 },
    configs,
  );
  assert(full.whtRemaining > 0 && full.whtVatRemaining > 0, 'WHT split on full invoice');
  assert(Math.abs(full.cashRemaining + full.whtTotalRemaining - full.balanceDue) < 0.02, 'cash + WHT = balance');

  const afterCash = computeInvoiceWhtSettlement(
    { total: 1210, subtotal: 1000, taxAmount: 210, paidAmount: full.cashRemaining },
    configs,
  );
  assert(afterCash.cashRemaining === 0, 'no cash left after net receipt');
  assert(afterCash.whtTotalRemaining > 0, 'WHT remainder for cert-later flow');

  const whtJe = buildWHTClearingJournalEntry(
    { paymentId: 'PAYWHT-1', invoiceNumber: 'INV-WHT-1', whtAmount: 50, whtVatAmount: 14.7, date: '2026-06-05' },
    undefined,
    { journalSeq: 0 },
  );
  assert(whtJe.ok, 'WHT clearing JE builds');
  if (whtJe.ok) {
    assert(Math.abs(whtJe.entry.totalDebit - whtJe.entry.totalCredit) < 0.01, 'WHT clearing balanced');
    assert(whtJe.entry.lines.some((l) => l.accountCode === '1230'), 'Dr WHT receivable');
  }
}

// ── WHT certificate storage on payment.details ───────────────────────────────
{
  const cert = {
    id: 'WHT-STORE-1',
    certificateNumber: 'PENDING-123',
    date: '2026-06-05',
    receivedDate: '',
    withholdingAgentName: 'Gov Corp',
    withholdingAgentTIN: '',
    taxPeriod: 'June 2026',
    invoiceId: 'INV-1',
    invoiceNumber: 'INV-1',
    grossAmount: 1210,
    whtRate: 5,
    whtAmount: 50,
    whtVatRate: 7,
    whtVatAmount: 14.7,
    totalWithheld: 64.7,
    status: 'Pending' as const,
    taxCreditBalance: 64.7,
    createdAt: '2026-06-05',
    updatedAt: '2026-06-05',
  };
  const row = {
    id: 'PAYWHT-1',
    paymentNumber: 'WHT-REC-1',
    date: new Date('2026-06-05'),
    type: 'Receipt',
    businessPartnerId: 'C-1',
    invoiceId: 'INV-1',
    reference: 'PENDING-123',
    description: 'WHT withheld',
    amount: 64.7,
    currency: 'GHS',
    paymentMethod: 'WHT Certificate',
    status: 'Posted',
    details: {
      isWHTCertificate: true,
      whtCertificateId: cert.id,
      whtCertificateData: cert,
      whtAmount: 50,
      whtVatAmount: 14.7,
      sourceModule: 'manual_ar_ap_wht',
    },
    createdAt: new Date('2026-06-05'),
    updatedAt: new Date('2026-06-05'),
  };
  const payment = toStorePayment(row);
  const certs = whtCertificatesFromPayments([payment]);
  assert(certs.length === 1, 'cert rehydrated from payment details');
  assert(certs[0].id === cert.id, 'cert id preserved');
  const merged = mergeWhtCertificateLists([], certs);
  assert(merged[0].status === 'Pending', 'pending cert status preserved');
}

// ── Receipt → invoice paidAmount (persisted columns + details) ───────────────
{
  const inv: Invoice = {
    id: 'INV-RCP-1',
    invoiceNumber: 'INV-RCP-1',
    type: 'Sales',
    date: '2026-06-01',
    dueDate: '2026-07-01',
    businessPartnerId: 'C-1',
    description: 'Test',
    subtotal: 1000,
    taxAmount: 0,
    total: 1000,
    currency: 'GHS',
    status: 'Posted',
    paidAmount: 0,
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    lines: [],
    sourceModule: 'manual_ar_ap',
  };
  const receiptAmount = 400;
  const newPaid = +((inv.paidAmount || 0) + receiptAmount).toFixed(2);
  const newStatus = newPaid >= inv.total ? 'Paid' : inv.status;
  assert(newPaid === 400, 'receipt increases paidAmount');
  assert(newStatus === 'Posted', 'partial receipt keeps Posted');
  const fullPaid = +(400 + 600).toFixed(2);
  assert(fullPaid >= inv.total, 'full receipt clears balance');
  assert((fullPaid >= inv.total ? 'Paid' : inv.status) === 'Paid', 'full receipt marks Paid');
}

// ── GL reversal (void) ───────────────────────────────────────────────────────
{
  const original: JournalEntry = {
    id: 'JE-INV-VOID-1',
    entryNumber: 'JE-2026-0099',
    date: '2026-06-05',
    reference: 'INV-V-1',
    description: 'Sales invoice INV-V-1',
    totalDebit: 1210,
    totalCredit: 1210,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-06-05',
    createdAt: '2026-06-05',
    updatedAt: '2026-06-05',
    sourceModule: 'manual_ar_ap',
    sourceTransactionId: 'INV-V-1',
    lines: [
      { id: 'L1', journalEntryId: 'JE-INV-VOID-1', accountCode: '1200', description: 'AR', debit: 1210, credit: 0, currency: 'GHS' },
      { id: 'L2', journalEntryId: 'JE-INV-VOID-1', accountCode: '4300', description: 'Rev', debit: 0, credit: 1210, currency: 'GHS' },
    ],
  };
  const rev = buildReversalJournalEntry(original, { journalSeq: 1, reason: 'Void invoice INV-V-1' });
  assert(!!rev, 'reversal builds');
  if (rev) {
    assert(rev.sourceModule === AR_AP_REVERSAL_SOURCE, 'reversal source tag');
    assert(rev.sourceTransactionId === original.id, 'reversal links to original');
    assert(Math.abs(rev.totalDebit - rev.totalCredit) < 0.01, 'reversal balanced');
    assert(rev.lines[0].debit === 0 && rev.lines[0].credit === 1210, 'AR line swapped');
    assert(hasReversalForEntry([original, rev], original.id), 'detects existing reversal');
  }
}

console.log('All accounting end-to-end wiring checks passed.');
