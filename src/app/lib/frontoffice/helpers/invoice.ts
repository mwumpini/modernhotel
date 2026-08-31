'use client';

type StoreLike = any;
import { useSettingsStore } from '../../settings/store';
import { useAccountingStore } from '../../accounting/store';
import { postGuestFolioCheckoutToLedger } from '../../accounting/simpleFlow';
import { folioChargeGlCode, getFolioDisplayTotals } from './folio';

/**
 * Generate and post an accounting invoice from a reservation folio.
 * GL posting follows the simple flow: invoice + balanced JEs at checkout only
 * (folio is the subledger while the guest is in-house).
 */
export function generateAccountingInvoiceForReservation(self: StoreLike, reservationId: string) {
  const reservation = self.reservations.find((r: any) => r.id === reservationId);
  if (!reservation) return;

  if ((reservation as any).invoiceGenerated) {
    console.warn('[FO Invoice] Checkout invoice already generated for', reservationId);
    return;
  }

  const folio = self.getOrCreateFolio(reservationId);
  self.updateFolioBalances(folio);

  // Canonical aggregation (folio.ts) instead of re-deriving from folio.charges here —
  // this is the same subtotal/tax/total math getFolioDisplayTotals already does for
  // every other folio screen.
  const { subtotal, taxTotal: taxAmount, totalCharges: total, totalPayments: paid, outstandingBalance: balance } = getFolioDisplayTotals(folio);

  if (total <= 0) {
    folio.status = 'closed';
    (reservation as any).invoiceGenerated = true;
    (reservation as any).invoiceGeneratedDate = new Date().toISOString();
    (reservation as any).invoiceStatus = 'none';
    self.notify();
    return;
  }

  const lines = folio.charges.map((c: any, idx: number) => ({
    id: `IL-${Date.now().toString().slice(-6)}-${idx}`,
    invoiceId: 'pending',
    description: c.description,
    quantity: 1,
    unitPrice: c.amount,
    amount: c.amount,
    taxAmount: c.tax || 0,
    glAccountCode: folioChargeGlCode(c),
  }));

  const settings = useSettingsStore.getState();
  const accounting = useAccountingStore.getState();
  const newId = `A-INV-${Date.now().toString().slice(-6)}`;
  const invNumber = settings.getNextInvoiceNumber();
  const dueDate = new Date(Date.now() + (settings.invoiceSettings.defaultPaymentTerms * 24 * 60 * 60 * 1000)).toISOString();

  const invoice: any = {
    id: newId,
    invoiceNumber: invNumber,
    type: 'Sales',
    date: new Date().toISOString(),
    dueDate,
    businessPartnerId: reservation.guestId || reservation.guestName,
    customerName: reservation.guestName,
    reference: reservation.resId || reservation.id,
    description: `Guest stay folio for ${reservation.guestName}`,
    subtotal,
    taxAmount,
    total,
    currency: 'GHS',
    status: balance === 0 ? 'Paid' : 'Posted',
    paidAmount: Math.min(total, paid),
    paidDate: balance === 0 ? new Date().toISOString() : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines,
    sourceModule: 'front_office_checkout',
  };

  invoice.lines = invoice.lines.map((l: any) => ({ ...l, invoiceId: newId }));
  try { accounting.addInvoice(invoice); } catch (e) { console.warn('FO: addInvoice failed', e); }

  const paymentRows: Array<{ amount: number; method: string; date: string; paymentId: string }> = [];
  try {
    (folio.payments || []).forEach((p: any, idx: number) => {
      // Only post payments the folio balance itself counts as paid (status === 'completed',
      // matching folio.ts's `paid` calc above) — otherwise a pending/refunded payment would
      // hit the GL as real cash movement while the invoice's own paid/balance ignores it.
      if (p.status && p.status !== 'completed') return;
      const amt = typeof p.amount === 'number' ? p.amount : 0;
      if (amt === 0 || Number.isNaN(amt)) return;
      const method =
        p.method === 'Card' || p.method === 'Mobile Money'
          ? p.method
          : p.method === 'Bank Transfer'
            ? 'Bank Transfer'
            : p.method === 'Check'
              ? 'Cheque'
              : p.method === 'Corporate Account' || p.method === 'Credit'
                ? 'Bank Transfer'
                : 'Cash';
      const isRefund = amt < 0;
      const payId = `A-PAY-${newId}-${idx}-${Math.random().toString(36).slice(2, 10)}`;
      paymentRows.push({
        amount: amt,
        method,
        date: p.date || new Date().toISOString(),
        paymentId: payId,
      });
      accounting.addPayment({
        id: payId,
        paymentNumber: isRefund ? `RFD-${invNumber}-${idx + 1}` : `PAY-${invNumber}-${idx + 1}`,
        date: p.date,
        type: 'Receipt',
        businessPartnerId: reservation.guestId || reservation.guestName,
        invoiceId: newId,
        reference: p.ref,
        description: isRefund ? `Refund — ${invNumber}` : `Payment for ${invNumber}`,
        amount: amt,
        currency: 'GHS',
        paymentMethod: method as any,
        status: 'Posted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceModule: 'front_office_checkout',
      } as any);
    });
  } catch {}

  const glPostParams = {
    invoiceId: newId,
    invoiceNumber: invNumber,
    reference: String(reservation.resId || reservation.id),
    guestLabel: reservation.guestName || 'Guest',
    reservationId,
    lines: invoice.lines.map((l: any) => ({
      amount: l.amount,
      glAccountCode: l.glAccountCode || '4100',
    })),
    subtotal,
    taxAmount,
    total,
    payments: paymentRows,
  };

  let glPosted = false;
  try {
    const glResult = postGuestFolioCheckoutToLedger(glPostParams);
    glPosted = !!glResult;
    if (!glResult) {
      console.error('[FO Invoice] GL post failed or unbalanced for', reservationId);
    }
  } catch (e) {
    console.warn('[FO Invoice] postGuestFolioCheckoutToLedger failed', e);
  }

  if (!glPosted && total > 0) {
    // The invoice/payment records above are already persisted; only the GL post
    // failed. Keep the exact posting payload so retryPendingGlPost can re-attempt
    // it without recreating the invoice (which would otherwise duplicate it).
    (reservation as any).invoiceStatus = 'gl_pending';
    (reservation as any).pendingGlPost = { ...glPostParams, balance };
    self.notify();
    return;
  }

  (reservation as any).invoiceGenerated = true;
  (reservation as any).invoiceGeneratedDate = new Date().toISOString();
  (reservation as any).invoiceStatus = balance === 0 ? 'paid' : 'sent';
  folio.status = 'closed';
  self.notify();
}

/**
 * Re-attempt the GL post for a reservation stuck in 'gl_pending' (invoice/payments
 * were already created; only the ledger post failed). Safe to call repeatedly —
 * it reuses the original posting payload instead of recreating the invoice.
 * Called from the night-audit sweep and can also be triggered manually from AR/front-office UI.
 */
export function retryPendingGlPost(self: StoreLike, reservationId: string): boolean {
  const reservation = self.reservations.find((r: any) => r.id === reservationId);
  if (!reservation || reservation.invoiceStatus !== 'gl_pending') return false;
  const pending = (reservation as any).pendingGlPost;
  if (!pending) return false;

  try {
    const glResult = postGuestFolioCheckoutToLedger(pending);
    if (!glResult) return false;

    (reservation as any).invoiceGenerated = true;
    (reservation as any).invoiceGeneratedDate = new Date().toISOString();
    (reservation as any).invoiceStatus = pending.balance === 0 ? 'paid' : 'sent';
    (reservation as any).pendingGlPost = null;

    const folio = self.getOrCreateFolio(reservationId);
    folio.status = 'closed';
    self.notify();
    try {
      self.persistReservationPatch(reservationId, {
        invoiceGenerated: true,
        invoiceStatus: (reservation as any).invoiceStatus,
        pendingGlPost: null,
      });
    } catch (e) {
      console.warn('[FO Invoice] retryPendingGlPost: failed to persist recovery', e);
    }
    return true;
  } catch (e) {
    console.warn('[FO Invoice] retryPendingGlPost failed', e);
    return false;
  }
}

/** Sweep every reservation stuck in 'gl_pending' and retry its GL post. Returns counts for logging/UI. */
export function retryAllPendingGlPosts(self: StoreLike): { attempted: number; recovered: number } {
  const pendingIds = self.reservations
    .filter((r: any) => r.invoiceStatus === 'gl_pending' && r.pendingGlPost)
    .map((r: any) => r.id);
  let recovered = 0;
  for (const id of pendingIds) {
    if (retryPendingGlPost(self, id)) recovered++;
  }
  return { attempted: pendingIds.length, recovered };
}


