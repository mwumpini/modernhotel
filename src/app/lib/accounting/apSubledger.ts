/**
 * Finance AP subledger — the payables-side mirror of arSubledger.ts. A Draft or
 * Void purchase invoice has no GL impact (nothing posted to 2200 for it), so it
 * must not count toward payables/aging any more than a Draft/Void sale counts
 * toward receivables.
 */

import type { Invoice } from './models';

/** Purchase invoices that belong on the finance AP subledger (posted to GL or ready). */
export function isFinanceApInvoice(inv: Invoice): boolean {
  if (inv.type !== 'Purchase') return false;
  if (inv.status === 'Void' || inv.status === 'Draft') return false;
  return inv.status === 'Posted' || inv.status === 'Paid';
}

export function invoiceOpenPayable(inv: Invoice): number {
  if (!isFinanceApInvoice(inv)) return 0;
  return Math.max(0, +((inv.total || 0) - (inv.paidAmount || 0)).toFixed(2));
}

export function filterFinanceApInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter(isFinanceApInvoice);
}
