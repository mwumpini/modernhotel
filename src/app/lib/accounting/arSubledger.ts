/**
 * Finance AR subledger — single source of truth for receivables aging & outstanding.
 *
 * Policy (Option B):
 * - Guest folio = operational ledger during stay (not finance AR).
 * - At checkout → accounting invoice + GL (front_office_checkout).
 * - All finance aging / outstanding / reports use this module only.
 */

import type { BusinessPartner, Invoice } from './models';
import { roundMoney2 } from './taxFromConfig';

export const FINANCE_AR_SOURCE = 'accounting_subledger';

/** Sales invoices that belong on the finance AR subledger (posted to GL or ready). */
export function isFinanceArInvoice(inv: Invoice): boolean {
  if (inv.type !== 'Sales') return false;
  if ((inv as { isProforma?: boolean }).isProforma) return false;
  if (inv.invoiceNumber?.startsWith('PRO-')) return false;
  if (inv.status === 'Void' || inv.status === 'Draft') return false;
  return inv.status === 'Posted' || inv.status === 'Paid';
}

export function invoiceOpenBalance(inv: Invoice): number {
  if (!isFinanceArInvoice(inv)) return 0;
  return Math.max(0, +((inv.total || 0) - (inv.paidAmount || 0)).toFixed(2));
}

export function filterFinanceArInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter(isFinanceArInvoice);
}

/** Net receivables, including customer credits, so the headline matches the balance column and GL 1210. */
export function totalFinanceReceivables(invoices: Invoice[]): number {
  return roundMoney2(
    filterFinanceArInvoices(invoices).reduce(
      (s, i) => s + ((i.total || 0) - (i.paidAmount || 0)),
      0,
    ),
  );
}

export interface FinanceAgingBucket {
  label: string;
  start: number;
  end: number;
  total: number;
  count: number;
}

/** Aging by due date (standard AR). Days past due bucketed. */
export function computeFinanceAgingBuckets(
  invoices: Invoice[],
  asOf: Date = new Date(),
  bucketStarts: number[] = [0, 30, 60, 90, 120],
): FinanceAgingBucket[] {
  const open = filterFinanceArInvoices(invoices).filter((i) => invoiceOpenBalance(i) > 0.005);

  const segments: FinanceAgingBucket[] = bucketStarts.map((start, idx) => ({
    label: idx === bucketStarts.length - 1 ? `>${start}` : `${start}-${bucketStarts[idx + 1]}`,
    start,
    end: bucketStarts[idx + 1] ?? Infinity,
    total: 0,
    count: 0,
  }));

  for (const inv of open) {
    const balance = invoiceOpenBalance(inv);
    const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
    const daysPastDue = Math.floor((asOf.getTime() - due.getTime()) / 86400000);

    for (const seg of segments) {
      const inRange =
        seg.end === Infinity
          ? daysPastDue >= seg.start
          : daysPastDue >= seg.start && daysPastDue < seg.end;
      if (inRange) {
        seg.total = roundMoney2(seg.total + balance);
        seg.count += 1;
        break;
      }
    }
  }

  return segments;
}

export interface CustomerAgingRow {
  customerId: string;
  customerName: string;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  invoiceCount: number;
  source?: string;
}

export function computeCustomerAgingFromInvoices(
  invoices: Invoice[],
  partners: BusinessPartner[],
  asOf: Date = new Date(),
): CustomerAgingRow[] {
  const sales = filterFinanceArInvoices(invoices);

  const partnerName = (id: string, inv?: Invoice) => {
    const p = partners.find((bp) => bp.id === id);
    return (inv as { customerName?: string })?.customerName || p?.name || id;
  };

  const customerIds = [...new Set(sales.map((i) => i.businessPartnerId).filter(Boolean))];

  return customerIds
    .map((customerId) => {
      const customerInvoices = sales.filter((i) => i.businessPartnerId === customerId);
      const totalInvoiced = customerInvoices.reduce((s, i) => s + (i.total || 0), 0);
      const totalPaid = customerInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
      const balance = +((totalInvoiced - totalPaid).toFixed(2));

      let current = 0;
      let days30 = 0;
      let days60 = 0;
      let days90 = 0;
      let over90 = 0;

      for (const inv of customerInvoices) {
        const invBalance = invoiceOpenBalance(inv);
        if (invBalance <= 0) continue;
        const dueDate = new Date(inv.dueDate || inv.date);
        const daysDiff = Math.floor((asOf.getTime() - dueDate.getTime()) / 86400000);
        if (daysDiff <= 0) current += invBalance;
        else if (daysDiff <= 30) days30 += invBalance;
        else if (daysDiff <= 60) days60 += invBalance;
        else if (daysDiff <= 90) days90 += invBalance;
        else over90 += invBalance;
      }

      return {
        customerId,
        customerName: partnerName(customerId, customerInvoices[0]),
        totalInvoiced: +totalInvoiced.toFixed(2),
        totalPaid: +totalPaid.toFixed(2),
        balance: +balance.toFixed(2),
        current: +current.toFixed(2),
        days30: +days30.toFixed(2),
        days60: +days60.toFixed(2),
        days90: +days90.toFixed(2),
        over90: +over90.toFixed(2),
        invoiceCount: customerInvoices.length,
        source: customerInvoices[0]?.sourceModule,
      };
    })
    .filter((c) => c.balance > 0 || c.invoiceCount > 0)
    .sort((a, b) => b.balance - a.balance);
}
