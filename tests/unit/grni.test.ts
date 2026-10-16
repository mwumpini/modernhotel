import { describe, expect, it } from 'vitest';
import { deliveriesForBill, grniByDelivery, planGrniClearing } from '@/app/lib/accounting/grni';
import { buildPurchaseInvoiceJournalEntry } from '@/app/lib/accounting/invoicePostingBridge';
import type { Invoice, JournalEntry } from '@/app/lib/accounting/models';

const now = '2026-10-16T10:00:00.000Z';
// Goods received GRN-0001 on PO-0007: ₵1,000 of food stock, owed until the bill comes.
const grnEntry: JournalEntry = {
  id: 'JE-GRN-1', entryNumber: 'JE-GRN-GRN-0001', date: now, reference: 'GRN-0001',
  description: 'Goods received — Fresh Farms (PO PO-0007)', totalDebit: 1000, totalCredit: 1000, currency: 'GHS',
  status: 'Posted', createdAt: now, updatedAt: now, sourceModule: 'inventory_grn', sourceTransactionId: 'grn1',
  lines: [
    { id: 'a', journalEntryId: 'JE-GRN-1', accountCode: '1310', description: 'Goods received', debit: 1000, credit: 0, currency: 'GHS' },
    { id: 'b', journalEntryId: 'JE-GRN-1', accountCode: '2350', description: 'Not invoiced', debit: 0, credit: 1000, currency: 'GHS' },
  ],
};

const bill = (subtotal: number, refs: Partial<Invoice> = {}): Invoice => ({
  id: `bill-${subtotal}`, invoiceNumber: `SUP-${subtotal}`, type: 'Purchase', date: now, dueDate: now,
  businessPartnerId: 'fresh', description: 'Fresh Farms bill', subtotal, taxAmount: subtotal * 0.2, total: subtotal * 1.2,
  currency: 'GHS', status: 'Posted', paidAmount: 0, createdAt: now, updatedAt: now,
  lines: [{ id: 'l1', invoiceId: `bill-${subtotal}`, description: 'Produce', quantity: 1, unitPrice: subtotal, amount: subtotal, taxAmount: 0, glAccountCode: '1310' }],
  ...refs,
} as Invoice);

const post = (inv: Invoice, entries: JournalEntry[]) => {
  const grni = planGrniClearing(inv.subtotal, deliveriesForBill(inv, grniByDelivery(entries)));
  const res = buildPurchaseInvoiceJournalEntry(inv, undefined, { journalSeq: 1, ...(grni.cleared > 0 ? { grni } : {}) });
  if (!res.ok) throw new Error(res.error);
  return res.entry;
};
const net = (entries: JournalEntry[], code: string) =>
  Math.round(entries.flatMap((e) => e.lines).filter((l) => l.accountCode === code).reduce((s, l) => s + l.debit - l.credit, 0) * 100) / 100;

describe('Goods received, not invoiced: a supplier is never owed twice', () => {
  it('the bill with the GRN number clears the delivery; the supplier is owed once', () => {
    const je = post(bill(1000, { receiptNumber: 'GRN-0001' }), [grnEntry]);
    const all = [grnEntry, je];
    expect(net(all, '2350')).toBe(0);
    expect(net(all, '1310')).toBe(1000); // stock counted once, from the delivery
    expect(net(all, '2205')).toBe(-1200); // owed to the supplier once, with VAT
    expect(net(all, '2110')).toBe(200); // input VAT
  });

  it('matches by PO number when no GRN number is given', () => {
    const je = post(bill(1000, { poNumber: 'PO-0007' }), [grnEntry]);
    expect(net([grnEntry, je], '2350')).toBe(0);
  });

  it('a dearer bill adds the difference to the stock value', () => {
    const je = post(bill(1050, { receiptNumber: 'GRN-0001' }), [grnEntry]);
    const all = [grnEntry, je];
    expect(net(all, '2350')).toBe(0);
    expect(net(all, '1310')).toBe(1050);
  });

  it('a bill for part of the delivery leaves the rest waiting for its bill', () => {
    const first = post(bill(400, { receiptNumber: 'GRN-0001' }), [grnEntry]);
    expect(net([grnEntry, first], '2350')).toBe(-600);
    const second = post(bill(600, { id: 'bill-600b', invoiceNumber: 'SUP-600b', receiptNumber: 'GRN-0001' } as Partial<Invoice>), [grnEntry, first]);
    expect(net([grnEntry, first, second], '2350')).toBe(0);
  });

  it('a bill with no delivery behind it posts as an ordinary expense, as before', () => {
    const je = post(bill(300), [grnEntry]);
    expect(je.lines.some((l) => l.accountCode === '2350')).toBe(false);
    expect(net([je], '1310')).toBe(300);
    expect(net([grnEntry, je], '2350')).toBe(-1000);
  });
});
