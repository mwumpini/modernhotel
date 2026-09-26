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
import { computeStackedTaxLines } from './taxFromConfig';
import { getActiveTaxConfigs } from '../tax/engine';
import { GHANA_TAX_CODES } from './models';
import { GL_ACCOUNTS, PAYMENT_GL_MAP } from './glAccounts';
import { assertPeriodNotClosed } from './periodClose';

// AR/AP/CASH/BANK share the one canonical GL_ACCOUNTS table (glAccounts.ts) so every
// posting path lands guest/departmental/supplier transactions in the same leaf accounts.
// The rest here (VAT, WHT, EXPENSE) are specific to manual/legacy AR-AP documents and
// have no equivalent in GL_ACCOUNTS.
const GL = {
  AR: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
  AP: GL_ACCOUNTS.ACCOUNTS_PAYABLE,
  CASH: GL_ACCOUNTS.CASH,
  BANK: GL_ACCOUNTS.BANK,
  VAT: '2110',
  SALES_REVENUE: GL_ACCOUNTS.OTHER_REVENUE,
  WHT_RECEIVABLE: '1230',
  WHT_VAT_RECEIVABLE: '1240',
  WHT_PAYABLE: GHANA_TAX_CODES.WITHHOLDING.glCode,
  WHT_VAT_PAYABLE: GHANA_TAX_CODES.WITHHOLDING_VAT.glCode,
  // Catch-all leaf for a purchase invoice line with no glAccountCode of its
  // own — the expense-side mirror of SALES_REVENUE/4300 on the revenue side.
  EXPENSE: '5680',
} as const;

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
    // Real configured rates (Settings → Tax Rate Builder), not the hardcoded template —
    // the invoice's own tax total (`tax`, already correct) is only being SPLIT across GL
    // accounts here, but using the hardcoded ratios instead of real ones misallocates the
    // split whenever a rate has been changed from its default, which corrupts the VAT
    // return filed off these GL balances even though the journal entry itself still balances.
    const taxConfigs = getActiveTaxConfigs()
    const { lines: taxLines } = computeStackedTaxLines(subtotal, taxConfigs, 'sales', tax)
    if (taxLines.length > 0) {
      for (const tl of taxLines) {
        lines.push({
          id: jl(),
          journalEntryId: entryId,
          accountCode: tl.glAccountCode || GL.VAT,
          description: `${tl.name} — ${invoice.invoiceNumber}`,
          debit: 0,
          credit: tl.amount,
          currency: invoice.currency || 'GHS',
          reference: invoice.invoiceNumber,
          taxCode: tl.taxCode,
        })
      }
    } else {
      // Fallback: post full tax to VAT account if configs produce no lines
      lines.push({
        id: jl(),
        journalEntryId: entryId,
        accountCode: GL.VAT,
        description: `Output Tax — ${invoice.invoiceNumber}`,
        debit: 0,
        credit: tax,
        currency: invoice.currency || 'GHS',
        reference: invoice.invoiceNumber,
      })
    }
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
    costCenter: payment.revenueCenterCode,
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
    costCenter: payment.revenueCenterCode,
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

/** WHT certificate clearing: Dr WHT receivable(s), Cr AR. */
export function buildWHTClearingJournalEntry(
  params: {
    paymentId: string;
    invoiceNumber: string;
    whtAmount: number;
    whtVatAmount: number;
    date: string;
    currency?: string;
  },
  partner: BusinessPartner | undefined,
  opts: { journalSeq: number; postedBy?: string },
): PostResult {
  const whtAmount = +(params.whtAmount || 0).toFixed(2);
  const whtVatAmount = +(params.whtVatAmount || 0).toFixed(2);
  const total = +(whtAmount + whtVatAmount).toFixed(2);
  if (total <= 0) return { ok: false, error: 'WHT amount must be greater than zero.' };
  const currency = params.currency || 'GHS';

  const entryId = `JE-WHT-${params.paymentId}`;
  const ts = nowIso();
  let lineSeq = 0;
  const jl = () => `JL-${entryId}-${++lineSeq}`;
  const lines: JournalEntryLine[] = [];

  if (whtAmount > 0) {
    lines.push({
      id: jl(),
      journalEntryId: entryId,
      accountCode: GL.WHT_RECEIVABLE,
      description: `WHT receivable — ${params.invoiceNumber}`,
      debit: whtAmount,
      credit: 0,
      currency,
      reference: params.invoiceNumber,
    });
  }
  if (whtVatAmount > 0) {
    lines.push({
      id: jl(),
      journalEntryId: entryId,
      accountCode: GL.WHT_VAT_RECEIVABLE,
      description: `WHT-VAT receivable — ${params.invoiceNumber}`,
      debit: whtVatAmount,
      credit: 0,
      currency,
      reference: params.invoiceNumber,
    });
  }
  lines.push({
    id: jl(),
    journalEntryId: entryId,
    accountCode: partnerArCode(partner),
    description: `Clear AR for WHT on ${params.invoiceNumber}`,
    debit: 0,
    credit: total,
    currency,
    reference: params.invoiceNumber,
  });

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: nextEntryNumber(opts.journalSeq),
    date: params.date,
    reference: params.invoiceNumber,
    description: `WHT clearing — ${params.invoiceNumber}`,
    totalDebit: total,
    totalCredit: total,
    currency,
    status: 'Posted',
    postedBy: opts.postedBy || 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines,
    sourceModule: MANUAL_AR_AP_SOURCE,
    sourceTransactionId: params.paymentId,
  };

  return { ok: true, entry };
}

/** WHT withheld from a supplier payment: Dr AP (clears the withheld portion of the liability), Cr WHT Payable (owed to GRA). */
export function buildAPWHTPayableJournalEntry(
  params: {
    paymentId: string;
    invoiceNumber: string;
    whtAmount: number;
    whtVatAmount?: number;
    date: string;
    currency?: string;
  },
  partner: BusinessPartner | undefined,
  opts: { journalSeq: number; postedBy?: string },
): PostResult {
  const whtAmount = +(params.whtAmount || 0).toFixed(2);
  const whtVatAmount = +(params.whtVatAmount || 0).toFixed(2);
  const total = +(whtAmount + whtVatAmount).toFixed(2);
  if (total <= 0) return { ok: false, error: 'WHT amount must be greater than zero.' };
  const currency = params.currency || 'GHS';

  const entryId = `JE-APWHT-${params.paymentId}`;
  const ts = nowIso();
  const lines: JournalEntryLine[] = [
    {
      id: `JL-${entryId}-dr`,
      journalEntryId: entryId,
      accountCode: partnerApCode(partner),
      description: `Clear AP for WHT withheld — ${params.invoiceNumber}`,
      debit: total,
      credit: 0,
      currency,
      reference: params.invoiceNumber,
    },
  ];
  if (whtAmount > 0) {
    lines.push({
      id: `JL-${entryId}-cr-wht`,
      journalEntryId: entryId,
      accountCode: GL.WHT_PAYABLE,
      description: `WHT payable (to remit to GRA) — ${params.invoiceNumber}`,
      debit: 0,
      credit: whtAmount,
      currency,
      reference: params.invoiceNumber,
    });
  }
  if (whtVatAmount > 0) {
    lines.push({
      id: `JL-${entryId}-cr-vat`,
      journalEntryId: entryId,
      accountCode: GL.WHT_VAT_PAYABLE,
      description: `WHT-VAT payable (to remit to GRA) — ${params.invoiceNumber}`,
      debit: 0,
      credit: whtVatAmount,
      currency,
      reference: params.invoiceNumber,
    });
  }

  const entry: JournalEntry = {
    id: entryId,
    entryNumber: nextEntryNumber(opts.journalSeq),
    date: params.date,
    reference: params.invoiceNumber,
    description: `WHT withheld on supplier payment — ${params.invoiceNumber}`,
    totalDebit: total,
    totalCredit: total,
    currency,
    status: 'Posted',
    postedBy: opts.postedBy || 'system',
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
    lines,
    sourceModule: MANUAL_AR_AP_SOURCE,
    sourceTransactionId: params.paymentId,
  };

  return { ok: true, entry };
}

export function applyJournalEntryToGlBalances(
  entry: JournalEntry,
  store: Pick<StoreGlActions, 'updateGLBalance' | 'currentPeriod'>,
): void {
  for (const line of entry.lines) {
    store.updateGLBalance(line.accountCode, store.currentPeriod, {
      currentDebit: line.debit || 0,
      currentCredit: line.credit || 0,
    });
  }
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

  const periodCheck = assertPeriodNotClosed(store.journalEntries, invoice.date);
  if (!periodCheck.ok) {
    logAccountingProcessWarn('AccountingInvoicePost', 'Invoice GL post blocked — closed period', {
      invoiceId: invoice.id,
      error: periodCheck.error,
    });
    return periodCheck;
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

  const periodCheck = assertPeriodNotClosed(store.journalEntries, payment.date);
  if (!periodCheck.ok) {
    logAccountingProcessWarn('AccountingPaymentPost', 'Payment GL post blocked — closed period', {
      paymentId: payment.id,
      error: periodCheck.error,
    });
    return periodCheck;
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
