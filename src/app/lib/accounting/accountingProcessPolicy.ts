/**
 * Accounting process policy — 1-to-1 sync matrix between operational events,
 * subledgers (AR/AP/folio), and general ledger postings.
 *
 * Guest folio revenue: checkout + no-show only (see revenueSourcePolicy).
 * Departmental walk-in: captureRevenue at point of sale.
 * Manual AR/AP: post via invoicePostingBridge when invoice/receipt is posted.
 */

import type { Invoice, JournalEntry, Payment } from './models';
import {
  AUTHORITATIVE_GUEST_REVENUE_SOURCES,
  REVENUE_SOURCE_GROUPS,
  isAuthoritativeRevenueSource,
  revenueSourceGroup,
  shouldIncludeJeLineInRevenueRollup,
} from './revenueSourcePolicy';

export {
  AUTHORITATIVE_GUEST_REVENUE_SOURCES,
  REVENUE_SOURCE_GROUPS,
  isAuthoritativeRevenueSource,
  revenueSourceGroup,
  shouldIncludeJeLineInRevenueRollup,
};

/** Sources that create invoice + JE together in integration.ts */
export const DEPARTMENTAL_CAPTURE_SOURCES = REVENUE_SOURCE_GROUPS.DEPARTMENTAL_REALTIME;

/** FO folio checkout / no-show — GL via simpleFlow.ts, not manual post */
export const GUEST_FOLIO_GL_SOURCES = [
  REVENUE_SOURCE_GROUPS.GUEST_FOLIO_CHECKOUT,
  REVENUE_SOURCE_GROUPS.GUEST_NOSHOW,
] as const;

/** In-house folio receipts recorded from finance AR — folio only, no GL until checkout */
export const OPERATIONAL_FOLIO_RECEIPT_SOURCES = ['front_office_folio'] as const;

/** Extended integration captures (AP, payroll, PPE, etc.) */
export const INTEGRATION_EXTENDED_SOURCES = [
  'integration_extended_expense',
  'integration_extended_supplier_payment',
  'integration_extended_inventory',
  'integration_extended_payroll',
  'integration_extended_welfare',
  'integration_extended_fixed_asset',
  'integration_extended_depreciation',
  'integration_extended_accrual',
  'integration_extended_prepayment',
  'integration_extended_tax',
] as const;

export const PERIOD_CLOSE_SOURCE = 'pl_period_close';

export const BANK_RECON_SOURCE = 'bank_reconciliation';

export const MANUAL_AR_AP_SOURCE = 'manual_ar_ap';

/** Finance reporting uses accounting subledger only — see arSubledger.ts (Option B). */
export const FINANCE_AR_POLICY = {
  master: 'accounting_subledger',
  operationalGuestLedger: 'folio_in_house',
  financeAgingApi: '/api/accounting/receivables/aging',
  folioApiNotice: 'guest_ledger_operational',
} as const;

export type AccountingSyncStatus =
  | 'synced'
  | 'subledger_only'
  | 'gl_only'
  | 'duplicate_risk'
  | 'not_applicable';

export function findJournalEntryForInvoice(
  invoice: Invoice,
  journalEntries: JournalEntry[],
): JournalEntry | undefined {
  if (invoice.journalEntryId) {
    return journalEntries.find((je) => je.id === invoice.journalEntryId);
  }
  return journalEntries.find(
    (je) =>
      je.sourceTransactionId === invoice.id ||
      je.reference === invoice.invoiceNumber ||
      je.reference === invoice.id,
  );
}

export function findJournalEntryForPayment(
  payment: Payment,
  journalEntries: JournalEntry[],
): JournalEntry | undefined {
  if (payment.journalEntryId) {
    return journalEntries.find((je) => je.id === payment.journalEntryId);
  }
  return journalEntries.find(
    (je) =>
      je.sourceTransactionId === payment.id ||
      je.reference === payment.paymentNumber ||
      je.reference === payment.id,
  );
}

/** Whether an invoice still needs a GL posting (manual AR/AP or legacy Posted-without-JE). */
export function invoiceNeedsGlPost(
  invoice: Invoice,
  journalEntries: JournalEntry[],
): boolean {
  if ((invoice as { isProforma?: boolean }).isProforma) return false;
  if (invoice.status !== 'Posted' && invoice.status !== 'Paid') return false;
  if (invoice.journalEntryId) return false;
  if (findJournalEntryForInvoice(invoice, journalEntries)) return false;
  if (
    (GUEST_FOLIO_GL_SOURCES as readonly string[]).includes(invoice.sourceModule || '')
  ) {
    return false;
  }
  if (
    invoice.sourceModule &&
    (DEPARTMENTAL_CAPTURE_SOURCES as readonly string[]).includes(invoice.sourceModule)
  ) {
    return false;
  }
  if (
    invoice.sourceModule &&
    (INTEGRATION_EXTENDED_SOURCES as readonly string[]).includes(invoice.sourceModule)
  ) {
    return false;
  }
  return true;
}

/** Whether a posted receipt/payment still needs GL. */
/** Match AR UI source filter keys to stored sourceModule values. */
export function sourceMatchesFilter(sourceModule: string | undefined, filter: string): boolean {
  if (filter === 'all') return true;
  const src = sourceModule || 'manual';
  if (filter === 'manual') return src === 'manual' || src === 'manual_ar_ap';
  if (filter === 'front_office') {
    return (
      src === 'front_office' ||
      src === 'front_office_checkout' ||
      src === 'front_office_folio' ||
      src === 'guest_noshow'
    );
  }
  return src === filter;
}

export function paymentNeedsGlPost(
  payment: Payment,
  journalEntries: JournalEntry[],
): boolean {
  if ((payment as { isWHTCertificate?: boolean }).isWHTCertificate) return false;
  if (payment.sourceModule === 'manual_ar_ap_wht') return false;
  if (payment.status !== 'Posted') return false;
  if (payment.journalEntryId) return false;
  if (findJournalEntryForPayment(payment, journalEntries)) return false;
  if (
    payment.sourceModule &&
    (OPERATIONAL_FOLIO_RECEIPT_SOURCES as readonly string[]).includes(payment.sourceModule)
  ) {
    return false;
  }
  if (
    payment.sourceModule &&
    (GUEST_FOLIO_GL_SOURCES as readonly string[]).includes(payment.sourceModule)
  ) {
    return false;
  }
  if (
    payment.sourceModule &&
    (DEPARTMENTAL_CAPTURE_SOURCES as readonly string[]).includes(payment.sourceModule)
  ) {
    return false;
  }
  if (
    payment.sourceModule &&
    (INTEGRATION_EXTENDED_SOURCES as readonly string[]).includes(payment.sourceModule)
  ) {
    return false;
  }
  return true;
}

export function invoiceSyncStatus(
  invoice: Invoice,
  journalEntries: JournalEntry[],
): AccountingSyncStatus {
  if ((invoice as { isProforma?: boolean }).isProforma) return 'not_applicable';
  const je = findJournalEntryForInvoice(invoice, journalEntries);
  if (je && (invoice.status === 'Posted' || invoice.status === 'Paid')) return 'synced';
  if (invoiceNeedsGlPost(invoice, journalEntries)) return 'subledger_only';
  if (je && invoice.status === 'Draft') return 'gl_only';
  return 'not_applicable';
}

export function paymentSyncStatus(
  payment: Payment,
  journalEntries: JournalEntry[],
): AccountingSyncStatus {
  const je = findJournalEntryForPayment(payment, journalEntries);
  if (je && payment.status === 'Posted') return 'synced';
  if (paymentNeedsGlPost(payment, journalEntries)) return 'subledger_only';
  return 'not_applicable';
}

/** Audit matrix row for documentation / diagnostics. */
export interface AccountingProcessRow {
  process: string;
  trigger: string;
  subledger: string;
  glTiming: string;
  sourceModule: string;
  syncCheck: string;
}

export const ACCOUNTING_PROCESS_MATRIX: AccountingProcessRow[] = [
  {
    process: 'Guest folio checkout',
    trigger: 'FO checkout / close folio',
    subledger: 'Folio → AR invoice',
    glTiming: 'Once at checkout',
    sourceModule: REVENUE_SOURCE_GROUPS.GUEST_FOLIO_CHECKOUT,
    syncCheck: 'simpleFlow.postGuestFolioCheckoutToLedger',
  },
  {
    process: 'Finance AR aging',
    trigger: 'Accounts Receivable / finance reports',
    subledger: 'Accounting invoices (Posted/Paid sales)',
    glTiming: 'At invoice post / checkout',
    sourceModule: 'manual_ar_ap | front_office_checkout | departmental',
    syncCheck: 'arSubledger.ts — excludes proformas & open folios',
  },
  {
    process: 'Guest folio (in-house)',
    trigger: 'Charges during stay',
    subledger: 'Folio operational ledger only',
    glTiming: 'Deferred to checkout',
    sourceModule: '(none until checkout)',
    syncCheck: '/api/ar/* = operational; not finance aging',
  },
  {
    process: 'No-show penalty',
    trigger: 'markNoShow / night audit',
    subledger: 'Folio charge (closed without checkout invoice)',
    glTiming: 'Immediate on no-show',
    sourceModule: REVENUE_SOURCE_GROUPS.GUEST_NOSHOW,
    syncCheck: 'simpleFlow.postNoShowPenaltyToLedger',
  },
  {
    process: 'Walk-in POS / events',
    trigger: 'captureRevenue / captureCompleteSale',
    subledger: 'AR sales invoice',
    glTiming: 'At sale',
    sourceModule: 'restaurant | bar | conference | …',
    syncCheck: 'integration.captureRevenue + JE',
  },
  {
    process: 'Guest folio charges (in-house)',
    trigger: 'addCharge / room night audit',
    subledger: 'Folio only',
    glTiming: 'Deferred to checkout',
    sourceModule: '(none until checkout)',
    syncCheck: 'No GL during stay',
  },
  {
    process: 'Manual AR invoice',
    trigger: 'Accounts Receivable save / post',
    subledger: 'AR invoice',
    glTiming: 'On post (Dr AR, Cr revenue + tax)',
    sourceModule: MANUAL_AR_AP_SOURCE,
    syncCheck: 'invoicePostingBridge.postInvoiceToLedger',
  },
  {
    process: 'Manual customer receipt',
    trigger: 'Accounts Receivable receipt save / post',
    subledger: 'AR payment receipt',
    glTiming: 'On post (Dr cash, Cr AR)',
    sourceModule: MANUAL_AR_AP_SOURCE,
    syncCheck: 'invoicePostingBridge.postPaymentToLedger',
  },
  {
    process: 'Supplier payment',
    trigger: 'Accounts Payable post payment',
    subledger: 'AP payment voucher',
    glTiming: 'On post (Dr AP, Cr bank)',
    sourceModule: MANUAL_AR_AP_SOURCE,
    syncCheck: 'store.postPayment (Payment type)',
  },
  {
    process: 'Period close',
    trigger: 'Financial Reports → Close P&L',
    subledger: 'N/A',
    glTiming: 'Idempotent by date',
    sourceModule: PERIOD_CLOSE_SOURCE,
    syncCheck: 'periodClose.hasPeriodCloseForDate',
  },
  {
    process: 'Bank reconciliation',
    trigger: 'Complete bank recon',
    subledger: 'Bank statement vs cashbook',
    glTiming: 'Interest/charges/suspense JEs',
    sourceModule: BANK_RECON_SOURCE,
    syncCheck: 'bankRecon/ledgerSync',
  },
  {
    process: 'Extended captures',
    trigger: 'AP, payroll, PPE, inventory modules',
    subledger: 'Module-specific',
    glTiming: 'On capture',
    sourceModule: 'integration_extended_*',
    syncCheck: 'integrationExtendedCaptures',
  },
];
