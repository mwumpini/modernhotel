/**
 * Finance AP subledger — the payables-side mirror of arSubledger.ts. A Draft or
 * Void purchase invoice has no GL impact (nothing posted to 2200 for it), so it
 * must not count toward payables/aging any more than a Draft/Void sale counts
 * toward receivables.
 */

import type { BusinessPartner, Invoice, Payment } from './models';

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

export type SupplierAgingRow = BusinessPartner & {
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  current: number;
  overdue30: number;
  overdue60: number;
  overdue90: number;
  overdue90Plus: number;
  lastInvoiceDate: string | null;
  lastPaymentDate: string | null;
};

/**
 * Supplier balance & aging — the payables-side mirror of arSubledger.ts's
 * computeCustomerAgingFromInvoices. Unlike the AR version, every supplier is included
 * (not just ones with invoices) so the whole roster is visible at a glance; buckets are
 * each invoice's own remaining balance (total minus what's actually been paid on it), not
 * the gross invoice total, so a partially- or fully-paid overdue invoice doesn't keep
 * showing as fully owed.
 */
export function computeSupplierAgingFromInvoices(
  suppliers: BusinessPartner[],
  invoices: Invoice[],
  payments: Payment[],
  asOf: Date = new Date(),
): SupplierAgingRow[] {
  const purchaseInvoices = filterFinanceApInvoices(invoices);
  const supplierPayments = payments.filter((p) => p.type === 'Payment');

  return suppliers.map((supplier) => {
    const supplierInvoices = purchaseInvoices.filter((inv) => inv.businessPartnerId === supplier.id);
    const supplierPaymentsFiltered = supplierPayments.filter((pay) => pay.businessPartnerId === supplier.id);

    const totalInvoiced = supplierInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = supplierPaymentsFiltered.reduce((sum, pay) => sum + pay.amount, 0);

    let current = 0, overdue30 = 0, overdue60 = 0, overdue90 = 0, overdue90Plus = 0;
    supplierInvoices.forEach((inv) => {
      const paidForInvoice = inv.paidAmount != null
        ? inv.paidAmount
        : supplierPaymentsFiltered.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
      const balance = Math.max(0, (inv.total || 0) - paidForInvoice);
      if (balance <= 0) return;
      const dueDate = new Date(inv.dueDate || inv.date);
      const daysOverdue = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) current += balance;
      else if (daysOverdue <= 30) overdue30 += balance;
      else if (daysOverdue <= 60) overdue60 += balance;
      else if (daysOverdue <= 90) overdue90 += balance;
      else overdue90Plus += balance;
    });

    const outstandingBalance = current + overdue30 + overdue60 + overdue90 + overdue90Plus;

    return {
      ...supplier,
      totalInvoiced,
      totalPaid,
      outstandingBalance,
      current,
      overdue30,
      overdue60,
      overdue90,
      overdue90Plus,
      lastInvoiceDate: supplierInvoices.length > 0
        ? new Date(Math.max(...supplierInvoices.map((inv) => new Date(inv.date).getTime()))).toISOString().slice(0, 10)
        : null,
      lastPaymentDate: supplierPaymentsFiltered.length > 0
        ? new Date(Math.max(...supplierPaymentsFiltered.map((pay) => new Date(pay.date).getTime()))).toISOString().slice(0, 10)
        : null,
    };
  });
}
