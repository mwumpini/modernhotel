/**
 * Bridges AR/AP subledger documents to general ledger for manual and legacy postings.
 * Integration captures (captureRevenue) and FO checkout (simpleFlow) post GL directly.
 */

import type { BusinessPartner, Invoice, JournalEntry, JournalEntryLine, Payment } from './models';
import {
  invoiceNeedsGlPost,
  MANUAL_AR_AP_SOURCE,
  paymentNeedsGlPost,
} from './accountingProcessPolicy';
import { logAccountingProcess, logAccountingProcessWarn } from './accountingProcessLog';

const GL = {
  AR: '1200',
  AP: '2000',
  CASH: '1110',
  BANK: '1100',
  VAT: '2110',
  SALES_REVENUE: '4500',
  EXPENSE: '6000',
} as const;

const PAYMENT_GL_MAP: Record<string, string> = {
  Cash: GL.CASH,
  Card: GL.BANK,
  'Mobile Money': GL.BANK,
  'Bank Transfer': GL.BANK,
  Cheque: GL.BANK,
  Check: GL.BANK,
  Bank: GL.BANK,
};

function nowIso(): string {
  return new Date().toISOString();
}

function nextEntryNumber(seq: number): string {
  return `JE-${new Date().getFullYear()}-${String(seq + 1).padStart(4, '0')}`;
}

function partnerArCode(partner: BusinessPartner | undefined): string {
  return partner?.glAccountCode || GL.AR;
}

function partnerApCode(partner: BusinessPartner | undefined): string {
  return partner?.glAccountCode || GL.AP;
}

export type PostResult =
  | { ok: true; entry: JournalEntry }
  | { ok: false; error: string };

export function buildSalesInvoiceJournalEntry(
  invoice: Invoice,
  partner: BusinessPartner | undefined,
  opts: { journalSeq: number; postedBy?: string },
): PostResult {
  const subtotal = +(invoice.subtotal || 0).toFixed(2);
  const tax = +(invoice.taxAmount || 0).toFixed(2);
  const total = +(invoice.total || 0).toFixed(2);
  if (total <= 0) return { ok: false, error: 'Invoice total must be greater than zero.' };

  const entryId = `JE-INV-${invoice.id}`;
  let lineSeq = 0;
  const jl = () => `JL-${entryId}-${++lineSeq}`;

  const lines: JournalEntryLine[] = [
    {
      id: jl(),
      journalEntryId: entryId,
      accountCode: partnerArCode(partner),
      description: `AR — ${invoice.description || invoice.invoiceNumber}`,
      debit: total,
      credit: 0,
      currency: invoice.currency || 'GHS',
      reference: invoice.invoiceNumber,
    },
  ];

  const revenueLines = (invoice.lines || []).filter((l) => l.amount > 0);
  if (revenueLines.length) {
    for (const line of revenueLines) {
      lines.push({
        id: jl(),
        journalEntryId: entryId,
        accountCode: line.glAccountCode || GL.SALES_REVENUE,
        description: line.description,
        debit: 0,
        credit: +line.amount.toFixed(2),
        currency: invoice.currency || 'GHS',
        reference: invoice.invoiceNumber,
        costCenter: line.costCenter,
      });
    }
  } else if (subtotal > 0) {
    lines.push({
      id: jl(),
      journalEntryId: entryId,
      accountCode: GL.SALES_REVENUE,
      description: invoice.description || 'Sales revenue',
      debit: 0,
      credit: subtotal,
      currency: invoice.currency || 'GHS',
      reference: invoice.invoiceNumber,
    });
  }

  if (tax > 0.005) {
    lines.push({
      id: jl(),
      journalEntryId: entryId,
      accountCode: GL.VAT,
      description: `Output VAT — ${invoice.invoiceNumber}`,
      debit: 0,
      credit: tax,
      currency: invoice.currency || 'GHS',
      reference: invoice.invoiceNumber,
    });
  }

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.02) {
    return { ok: false, error: 'Sales invoice journal entry is not balanced.' };
  }

  const ts = nowIso();
  const entry: JournalEntry = {
    id: entryId,
    entryNumber: nextEntryNumber(opts.journalSeq),
    date: invoice.date,
    reference: invoice.invoiceNumber,
    description: `Sales invoice ${invoice.invoiceNumber} — ${invoice.description || 'Manual AR'}`,
    totalDebit,
    totalCredit,
    currency: invoice.currency || 'GHS',
    status: 'Posted',
    postedBy: opts.postedBy || 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines,
    sourceModule: MANUAL_AR_AP_SOURCE,
    sourceTransactionId: invoice.id,
  };

  return { ok: true, entry };
}

export function buildPurchaseInvoiceJournalEntry(
  invoice: Invoice,
  partner: BusinessPartner | undefined,
  opts: { journalSeq: number; postedBy?: string },
): PostResult {
  const subtotal = +(invoice.subtotal || 0).toFixed(2);
  const tax = +(invoice.taxAmount || 0).toFixed(2);
  const total = +(invoice.total || 0).toFixed(2);
  if (total <= 0) return { ok: false, error: 'Invoice total must be greater than zero.' };

  const entryId = `JE-APINV-${invoice.id}`;
  let lineSeq = 0;
  const jl = () => `JL-${entryId}-${++lineSeq}`;

  const lines: JournalEntryLine[] = [];
  const expenseLines = (invoice.lines || []).filter((l) => l.amount > 0);
  if (expenseLines.length) {
    for (const line of expenseLines) {
      lines.push({
        id: jl(),
        journalEntryId: entryId,
        accountCode: line.glAccountCode || GL.EXPENSE,
        description: line.description,
        debit: +line.amount.toFixed(2),
        credit: 0,
        currency: invoice.currency || 'GHS',
        reference: invoice.invoiceNumber,
        costCenter: line.costCenter,
      });
    }
  } else if (subtotal > 0) {
    lines.push({
      id: jl(),
      journalEntryId: entryId,
      accountCode: GL.EXPENSE,
      description: invoice.description || 'Purchase expense',
      debit: subtotal,
      credit: 0,
      currency: invoice.currency || 'GHS',
      reference: invoice.invoiceNumber,
    });
  }

  if (tax > 0.005) {
    lines.push({
      id: jl(),
      journalEntryId: entryId,
      accountCode: GL.VAT,
      description: `Input VAT — ${invoice.invoiceNumber}`,
      debit: tax,
      credit: 0,
      currency: invoice.currency || 'GHS',
      reference: invoice.invoiceNumber,
    });
  }

  lines.push({
    id: jl(),
    journalEntryId: entryId,
    accountCode: partnerApCode(partner),
    description: `AP — ${invoice.description || invoice.invoiceNumber}`,
    debit: 0,
    credit: total,
    currency: invoice.currency || 'GHS',
    reference: invoice.invoiceNumber,
  });

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.02) {
    return { ok: false, error: 'Purchase invoice journal entry is not balanced.' };
  }

  const ts = nowIso();
  const entry: JournalEntry = {
    id: entryId,
    entryNumber: nextEntryNumber(opts.journalSeq),
    date: invoice.date,
    reference: invoice.invoiceNumber,
    description: `Purchase invoice ${invoice.invoiceNumber} — ${invoice.description || 'Manual AP'}`,
    totalDebit,
    totalCredit,
    currency: invoice.currency || 'GHS',
    status: 'Posted',
    postedBy: opts.postedBy || 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines,
    sourceModule: MANUAL_AR_AP_SOURCE,
    sourceTransactionId: invoice.id,
  };

  return { ok: true, entry };
}

export function buildInvoiceJournalEntry(
  invoice: Invoice,
  partner: BusinessPartner | undefined,
  opts: { journalSeq: number; postedBy?: string },
): PostResult {
  if (invoice.type === 'Purchase') {
    return buildPurchaseInvoiceJournalEntry(invoice, partner, opts);
  }
  return buildSalesInvoiceJournalEntry(invoice, partner, opts);
}

export function buildReceiptJournalEntry(
  payment: Payment,
  partner: BusinessPartner | undefined,
  opts: { journalSeq: number; cashGlAccount?: string; postedBy?: string },
): PostResult {
  const amount = +(payment.amount || 0).toFixed(2);
  if (amount <= 0) return { ok: false, error: 'Receipt amount must be greater than zero.' };

  const cashGl =
    opts.cashGlAccount ||
    PAYMENT_GL_MAP[payment.paymentMethod] ||
    GL.CASH;

  const entryId = `JE-RCP-${payment.id}`;
  const ts = nowIso();
  const debitLine: JournalEntryLine = {
    id: `JL-${entryId}-dr`,
    journalEntryId: entryId,
    accountCode: cashGl,
    description: payment.description || `Receipt ${payment.paymentNumber}`,
    debit: amount,
    credit: 0,
    currency: payment.currency || 'GHS',
    reference: payment.paymentNumber,
  };
  const creditLine: JournalEntryLine = {
    id: `JL-${entryId}-cr`,
    journalEntryId: entryId,
    accountCode: partnerArCode(partner),
    description: payment.description || `Receipt ${payment.paymentNumber}`,
    debit: 0,
    credit: amount,
    currency: payment.currency || 'GHS',
    reference: payment.paymentNumber,
  };

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: nextEntryNumber(opts.journalSeq),
    date: payment.date,
    reference: payment.paymentNumber,
    description: `Customer receipt ${payment.paymentNumber}`,
    totalDebit: amount,
    totalCredit: amount,
    currency: payment.currency || 'GHS',
    status: 'Posted',
    postedBy: opts.postedBy || 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines: [debitLine, creditLine],
    sourceModule: MANUAL_AR_AP_SOURCE,
    sourceTransactionId: payment.id,
  };

  return { ok: true, entry };
}

export function buildSupplierPaymentJournalEntry(
  payment: Payment,
  partner: BusinessPartner | undefined,
  opts: { journalSeq: number; cashGlAccount: string; postedBy?: string },
): PostResult {
  const amount = +(payment.amount || 0).toFixed(2);
  if (amount <= 0) return { ok: false, error: 'Payment amount must be greater than zero.' };

  const entryId = `JE-PAY-${payment.id}`;
  const ts = nowIso();
  const debitLine: JournalEntryLine = {
    id: `JL-${entryId}-dr`,
    journalEntryId: entryId,
    accountCode: partnerApCode(partner),
    description: payment.description || `Payment ${payment.paymentNumber}`,
    debit: amount,
    credit: 0,
    currency: payment.currency || 'GHS',
    reference: payment.reference || payment.paymentNumber,
  };
  const creditLine: JournalEntryLine = {
    id: `JL-${entryId}-cr`,
    journalEntryId: entryId,
    accountCode: opts.cashGlAccount,
    description: payment.description || `Payment ${payment.paymentNumber}`,
    debit: 0,
    credit: amount,
    currency: payment.currency || 'GHS',
    reference: payment.reference || payment.paymentNumber,
  };

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: nextEntryNumber(opts.journalSeq),
    date: payment.date,
    reference: payment.paymentNumber,
    description: `Supplier payment ${payment.paymentNumber} — ${partner?.name || 'Supplier'}`,
    totalDebit: amount,
    totalCredit: amount,
    currency: payment.currency || 'GHS',
    status: 'Posted',
    postedBy: opts.postedBy || 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines: [debitLine, creditLine],
    sourceModule: MANUAL_AR_AP_SOURCE,
    sourceTransactionId: payment.id,
  };

  return { ok: true, entry };
}

export interface StoreGlActions {
  journalEntries: JournalEntry[];
  currentPeriod: string;
  addJournalEntry: (entry: JournalEntry) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  updateGLBalance: (
    accountCode: string,
    period: string,
    updates: { currentDebit?: number; currentCredit?: number },
  ) => void;
}

/** Post invoice to GL if subledger is Posted but no JE exists yet. */
export function syncInvoiceToLedger(
  invoice: Invoice,
  partner: BusinessPartner | undefined,
  store: StoreGlActions,
): PostResult | { ok: true; skipped: true } {
  if (!invoiceNeedsGlPost(invoice, store.journalEntries)) {
    return { ok: true, skipped: true };
  }

  const result = buildInvoiceJournalEntry(invoice, partner, {
    journalSeq: store.journalEntries.length,
  });
  if (!result.ok) {
    logAccountingProcessWarn('AccountingInvoicePost', 'Invoice GL post failed', {
      invoiceId: invoice.id,
      error: result.error,
    });
    return result;
  }

  store.addJournalEntry(result.entry);
  store.updateInvoice(invoice.id, {
    journalEntryId: result.entry.id,
    status: invoice.status === 'Draft' ? 'Posted' : invoice.status,
    updatedAt: nowIso(),
  });

  for (const line of result.entry.lines) {
    store.updateGLBalance(line.accountCode, store.currentPeriod, {
      currentDebit: line.debit || 0,
      currentCredit: line.credit || 0,
    });
  }

  logAccountingProcess('AccountingInvoicePost', 'Invoice posted to GL', {
    invoiceNumber: invoice.invoiceNumber,
    entryNumber: result.entry.entryNumber,
    total: invoice.total,
    type: invoice.type,
  });

  return result;
}

/** Post receipt or supplier payment to GL. */
export function syncPaymentToLedger(
  payment: Payment,
  partner: BusinessPartner | undefined,
  store: StoreGlActions & { bankAccounts: Array<{ id: string; glAccountCode: string; currency: string }> },
): PostResult | { ok: true; skipped: true } {
  if (!paymentNeedsGlPost(payment, store.journalEntries)) {
    return { ok: true, skipped: true };
  }

  let cashGl = PAYMENT_GL_MAP[payment.paymentMethod] || GL.CASH;
  if (payment.bankAccountId) {
    const bank = store.bankAccounts.find((b) => b.id === payment.bankAccountId);
    if (bank) cashGl = bank.glAccountCode;
  }

  const result =
    payment.type === 'Receipt'
      ? buildReceiptJournalEntry(payment, partner, {
          journalSeq: store.journalEntries.length,
          cashGlAccount: cashGl,
        })
      : buildSupplierPaymentJournalEntry(payment, partner, {
          journalSeq: store.journalEntries.length,
          cashGlAccount: cashGl,
        });

  if (!result.ok) {
    logAccountingProcessWarn('AccountingPaymentPost', 'Payment GL post failed', {
      paymentId: payment.id,
      error: result.error,
    });
    return result;
  }

  store.addJournalEntry(result.entry);
  store.updatePayment(payment.id, {
    journalEntryId: result.entry.id,
    status: 'Posted',
    updatedAt: nowIso(),
  });

  for (const line of result.entry.lines) {
    store.updateGLBalance(line.accountCode, store.currentPeriod, {
      currentDebit: line.debit || 0,
      currentCredit: line.credit || 0,
    });
  }

  logAccountingProcess('AccountingPaymentPost', `${payment.type} posted to GL`, {
    paymentNumber: payment.paymentNumber,
    entryNumber: result.entry.entryNumber,
    amount: payment.amount,
    method: payment.paymentMethod,
  });

  return result;
}
