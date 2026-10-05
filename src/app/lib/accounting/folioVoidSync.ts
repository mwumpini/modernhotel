'use client';

/**
 * When a conference folio charge is voided or deleted, the sales invoice,
 * the customer balance, and the general ledger move by the same amount.
 * A voided folio payment is a voided receipt.
 */

import { useAccountingStore } from './store';
import { GL_ACCOUNTS, REVENUE_CENTERS } from './integration';
import { applyJournalEntryToGlBalances } from './invoicePostingBridge';
import type { Invoice } from './models';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function findConferenceInvoice(eventId: string, reference?: string) {
  const store = useAccountingStore.getState();
  const cleanRef = reference?.replace(/^REV-/, '');
  if (cleanRef) {
    const byId = store.invoices.find(
      (inv) => inv.id === `INV-CONFERENCE-${cleanRef}` && inv.status !== 'Void',
    );
    if (byId) return byId;
  }
  return store.invoices.find(
    (inv) =>
      inv.type === 'Sales' &&
      inv.status !== 'Void' &&
      String(inv.reference || '') === eventId &&
      String((inv as { sourceModule?: string }).sourceModule || '') === 'conference',
  );
}

/** delta is negative when charges fall, positive when a voided charge is put back. */
export function adjustConferenceChargeInAccounting(
  eventId: string,
  reference: string | undefined,
  delta: number,
  label: string,
) {
  if (!eventId || Math.abs(delta) < 0.01) return;
  const invoice = findConferenceInvoice(eventId, reference);
  if (!invoice) return;

  const store = useAccountingStore.getState();
  const prevTotal = Number(invoice.total) || 0;
  const nextTotal = Math.max(0, round2(prevTotal + delta));
  const applied = round2(nextTotal - prevTotal);
  if (Math.abs(applied) < 0.01) return;

  const prevTax = Number(invoice.taxAmount) || 0;
  const taxDelta = prevTotal > 0 ? round2(prevTax * (applied / prevTotal)) : 0;
  const nextTax = Math.max(0, round2(prevTax + taxDelta));
  const nextSub = Math.max(0, round2(nextTotal - nextTax));
  const paid = Number(invoice.paidAmount) || 0;
  const status: Invoice['status'] =
    invoice.status === 'Draft' || invoice.status === 'Void'
      ? invoice.status
      : paid + 0.009 >= nextTotal
        ? 'Paid'
        : 'Posted';

  store.updateInvoice(invoice.id, {
    total: nextTotal,
    subtotal: nextSub,
    taxAmount: nextTax,
    status,
    updatedAt: new Date().toISOString(),
  });

  const amount = Math.abs(applied);
  const increase = applied > 0;
  const original = invoice.journalEntryId
    ? store.journalEntries.find((je) => je.id === invoice.journalEntryId && je.status === 'Posted')
    : undefined;
  const creditLines = (original?.lines || []).filter((line) => (line.credit || 0) > 0.004);
  const creditSum = creditLines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const shares = creditLines.length && creditSum > 0
    ? creditLines.map((line) => ({
        accountCode: line.accountCode,
        description: line.description || 'Conference charge',
        share: round2(amount * ((line.credit || 0) / creditSum)),
      }))
    : [{ accountCode: GL_ACCOUNTS.CONFERENCE_REVENUE, description: 'Conference charge', share: amount }];
  const shareSum = shares.reduce((sum, line) => sum + line.share, 0);
  const drift = round2(amount - shareSum);
  if (shares.length && Math.abs(drift) >= 0.01) {
    shares[shares.length - 1].share = round2(shares[shares.length - 1].share + drift);
  }

  const now = new Date().toISOString();
  const entryId = `JE-EVT-FOLIO-${invoice.id}-${Date.now()}`;
  const lines = [
    ...shares
      .filter((line) => line.share > 0.004)
      .map((line, index) => ({
        id: `JL-${entryId}-${index}`,
        journalEntryId: entryId,
        accountCode: line.accountCode,
        description: line.description,
        debit: increase ? 0 : line.share,
        credit: increase ? line.share : 0,
        currency: 'GHS',
      })),
    {
      id: `JL-${entryId}-ar`,
      journalEntryId: entryId,
      accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      description: increase ? 'Amount due restored' : 'Amount due reduced',
      debit: increase ? amount : 0,
      credit: increase ? 0 : amount,
      currency: 'GHS',
    },
  ];

  const entry = {
    id: entryId,
    entryNumber: `JE-EVTFOL-${String(eventId).slice(-6)}`,
    date: now.slice(0, 10),
    reference: invoice.invoiceNumber || invoice.id,
    description: label,
    totalDebit: amount,
    totalCredit: amount,
    currency: 'GHS',
    status: 'Posted' as const,
    postedBy: 'Events Team',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'conference',
    sourceTransactionId: entryId,
    lines,
  };
  store.addJournalEntry(entry as never);
  applyJournalEntryToGlBalances(entry as never, useAccountingStore.getState());

  const subDelta = round2(nextSub - (Number(invoice.subtotal) || 0));
  if (Math.abs(subDelta) >= 0.01) store.recordRevenue(REVENUE_CENTERS.CONFERENCE, subDelta);
}

/** Folio payment lines store the events receipt id. Accounting receipts are RCP-CONFERENCE-{that id}. */
export async function voidConferenceReceiptInAccounting(eventsReceiptId?: string) {
  if (!eventsReceiptId) return;
  const clean = eventsReceiptId.replace(/^REV-/, '');
  const store = useAccountingStore.getState();
  const payment =
    store.payments.find(
      (item) => item.status !== 'Void' && (item.id === clean || item.id === `RCP-CONFERENCE-${clean}`),
    ) ||
    store.payments.find((item) => {
      if (item.status === 'Void' || !item.journalEntryId) return false;
      const entry = store.journalEntries.find((je) => je.id === item.journalEntryId);
      return entry?.sourceTransactionId === clean;
    });
  if (!payment) return;
  await store.voidPayment(payment.id);
}

/** Put a voided conference receipt back. The sales invoice must already be live. */
export async function unvoidConferenceReceiptInAccounting(eventsReceiptId?: string) {
  if (!eventsReceiptId) return;
  const clean = eventsReceiptId.replace(/^REV-/, '');
  const store = useAccountingStore.getState();
  const payment = store.payments.find(
    (item) => item.status === 'Void' && (item.id === clean || item.id === `RCP-CONFERENCE-${clean}`),
  );
  if (!payment) return;
  await store.unvoidPayment(payment.id);
}
