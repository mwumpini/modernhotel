/**
 * Goods Received, Not Invoiced (GRNI). Pure: works on journal entries only.
 *
 * Receiving stock puts its value in 2350 GRNI (the hotel owes for goods it has, but the
 * supplier's bill has not been entered). When the bill is entered in Accounts Payable with
 * the delivery (GRN) number, or the PO number, it clears what that delivery left in GRNI
 * instead of being counted as a second debt. A bill dearer than the goods received adds
 * the difference to the stock value; a bill for part of a delivery leaves the rest in GRNI.
 */

import type { JournalEntry } from './models';

export const GL_GRNI = '2350';
export const GRN_SOURCE = 'inventory_grn';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type GrniDelivery = { grnNumber: string; poNumber?: string; received: number; billed: number; open: number };

/** Each delivery's value in GRNI, and how much of it bills have already cleared. */
export function grniByDelivery(journalEntries: JournalEntry[]): Map<string, GrniDelivery> {
  const out = new Map<string, GrniDelivery>();
  const posted = journalEntries.filter((je) => je.status === 'Posted');
  for (const je of posted) {
    if (je.sourceModule !== GRN_SOURCE) continue;
    const credit = je.lines.filter((l) => l.accountCode === GL_GRNI).reduce((s, l) => s + (Number(l.credit) || 0) - (Number(l.debit) || 0), 0);
    if (credit <= 0.004) continue;
    const grnNumber = String(je.reference || '');
    const po = /\(PO ([^)]+)\)/.exec(je.description || '')?.[1];
    const row = out.get(grnNumber) || { grnNumber, poNumber: po, received: 0, billed: 0, open: 0 };
    row.received = r2(row.received + credit);
    out.set(grnNumber, row);
  }
  for (const je of posted) {
    if (je.sourceModule === GRN_SOURCE) continue;
    for (const l of je.lines) {
      if (l.accountCode !== GL_GRNI) continue;
      const ref = String(l.reference || '');
      const grn = ref.startsWith('GRN:') ? ref.slice(4) : '';
      const row = grn ? out.get(grn) : undefined;
      if (row) row.billed = r2(row.billed + (Number(l.debit) || 0) - (Number(l.credit) || 0));
    }
  }
  for (const row of out.values()) row.open = r2(Math.max(0, row.received - row.billed));
  return out;
}

/** Deliveries a bill refers to: its GRN number(s) if given, otherwise every delivery on its PO. */
export function deliveriesForBill(bill: { receiptNumber?: string; poNumber?: string }, deliveries: Map<string, GrniDelivery>): GrniDelivery[] {
  const refs = String(bill.receiptNumber || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  if (refs.length) return refs.map((r) => deliveries.get(r)).filter((d): d is GrniDelivery => Boolean(d));
  const po = String(bill.poNumber || '').trim();
  if (!po) return [];
  return [...deliveries.values()].filter((d) => d.poNumber === po);
}

/**
 * How a bill of `subtotal` (before tax) clears GRNI: up to what its deliveries still hold.
 * Returns the amount per delivery and any price difference (bill dearer than goods received).
 */
export function planGrniClearing(subtotal: number, deliveries: GrniDelivery[]): { clear: Array<{ grnNumber: string; amount: number }>; cleared: number; extra: number } {
  let left = r2(Math.max(0, subtotal));
  const clear: Array<{ grnNumber: string; amount: number }> = [];
  for (const d of deliveries) {
    if (left <= 0.004) break;
    const amount = r2(Math.min(left, d.open));
    if (amount <= 0.004) continue;
    clear.push({ grnNumber: d.grnNumber, amount });
    left = r2(left - amount);
  }
  const cleared = r2(clear.reduce((s, c) => s + c.amount, 0));
  // Only a dearer bill leaves an extra amount; a bill for part of a delivery leaves the rest open.
  const extra = deliveries.length > 0 && cleared > 0 ? r2(subtotal - cleared) : 0;
  return { clear, cleared, extra: extra > 0.004 ? extra : 0 };
}
