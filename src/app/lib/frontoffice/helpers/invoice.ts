'use client';

type StoreLike = any;
import { useSettingsStore } from '../../settings/store';
import { useAccountingStore } from '../../accounting/store';
import { postGuestFolioCheckoutToLedger, postGuestFolioChargeVoidToLedger } from '../../accounting/simpleFlow';
import { folioChargeGlCode, getFolioDisplayTotals } from './folio';
import { chargeGross, chargeNet } from '../folioLedger';
import { isCorporateGuest } from './guests';
import { creditTermDays } from '../operationalPolicies';

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
  const { subtotal, taxTotal: taxAmount, totalCharges: total, roundingAdjustment, totalPayments: paid, outstandingBalance: balance } = getFolioDisplayTotals(folio);

  if (total <= 0) {
    folio.status = 'closed';
    (reservation as any).invoiceGenerated = true;
    (reservation as any).invoiceGeneratedDate = new Date().toISOString();
    (reservation as any).invoiceStatus = 'none';
    self.notify();
    return;
  }

  const lines = folio.charges.map((c: any, idx: number) => {
    const net = chargeNet(c);
    return {
    id: `IL-${Date.now().toString().slice(-6)}-${idx}`,
    invoiceId: 'pending',
    description: c.description,
    quantity: 1,
    unitPrice: net,
    amount: net,
    taxAmount: c.tax || 0,
    glAccountCode: folioChargeGlCode(c),
  };
  });

  const settings = useSettingsStore.getState();
  const accounting = useAccountingStore.getState();
  const partnerId = reservation.guestId || `guest-${reservation.id}`;
  if (!accounting.businessPartners.some((p: { id: string }) => p.id === partnerId)) {
    const ts = new Date().toISOString();
    accounting.addBusinessPartner({
      id: partnerId,
      code: String(reservation.resId || partnerId).slice(0, 20),
      name: reservation.guestName || 'Guest',
      type: 'Customer',
      glAccountCode: '1210',
      currency: 'GHS',
      balance: 0,
      isActive: true,
      countryCode: 'GH',
      createdAt: ts,
      updatedAt: ts,
    });
  }
  const newId = `A-INV-${Date.now().toString().slice(-6)}`;
  const invNumber = settings.getNextInvoiceNumber();
  const guest = (self.guests || []).find((g: { id?: string }) => g.id === reservation.guestId);
  const corporate = isCorporateGuest(guest) || !!(reservation.companyName || reservation.billingPersonName);
  const invoiceDays = settings.invoiceSettings?.defaultPaymentTerms ?? 30;
  const termDays = corporate
    ? creditTermDays(settings.roomManagement, guest?.paymentTerms, invoiceDays)
    : invoiceDays;
  const dueDate = new Date(Date.now() + (termDays * 24 * 60 * 60 * 1000)).toISOString();

  const invoice: any = {
    id: newId,
    invoiceNumber: invNumber,
    type: 'Sales',
    date: new Date().toISOString(),
    dueDate,
    businessPartnerId: partnerId,
    customerName: reservation.guestName,
    reference: reservation.resId || reservation.id,
    description: `Guest stay folio for ${reservation.guestName}`,
    subtotal,
    taxAmount,
    total,
    roundingAdjustment,
    currency: 'GHS',
    // paidAmount/status start at zero/Posted — the payment loop right below calls
    // accounting.addPayment() for every folio payment, and addPayment() is what
    // actually increments paidAmount and flips status to 'Paid' once it's covered.
    // Pre-baking the folio's paid total here too would double-count it the moment
    // the first addPayment() call lands on top.
    status: 'Posted',
    paidAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines,
    sourceModule: 'front_office_checkout',
  };

  invoice.lines = invoice.lines.map((l: any) => ({ ...l, invoiceId: newId }));
  (reservation as any).invoiceNumber = invNumber;
  (reservation as any).invoiceGeneratedDate = invoice.date;
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
        businessPartnerId: partnerId,
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
        folioPaymentId: p.id,
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
    roundingAdjustment,
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
        invoiceGeneratedDate: (reservation as any).invoiceGeneratedDate,
        invoiceNumber: (reservation as any).invoiceNumber,
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

/**
 * A payment taken after the stay is already in Accounting (checkout left the
 * balance on account, then the guest paid some or all of it). The folio line
 * alone never reaches Receipts, so write the cash receipt against that invoice now.
 * Payments already on the folio at checkout are posted with the invoice instead.
 */
export function postFolioReceiptAfterInvoice(self: StoreLike, reservationId: string, payment: { id: string; amount?: number; method?: string; date?: string; status?: string; ref?: string }) {
  const reservation = self.reservations.find((r: any) => r.id === reservationId);
  if (!reservation?.invoiceGenerated) return;
  if (payment.status && payment.status !== 'completed') return;
  const amount = Number(payment.amount);
  if (!(amount > 0) || Number.isNaN(amount)) return;
  if (payment.method === 'Credit' || payment.method === 'Corporate Account') return;

  const accounting = useAccountingStore.getState();
  const refs = [reservation.resId, reservation.id].filter(Boolean).map((value: unknown) => String(value));
  const invoice = accounting.invoices.find((inv) =>
    inv.type === 'Sales' &&
    inv.status !== 'Void' &&
    (inv as { sourceModule?: string }).sourceModule === 'front_office_checkout' &&
    refs.includes(String(inv.reference || '')),
  );
  if (!invoice) {
    console.warn('[FO Invoice] Checkout invoice not found for receipt', reservationId);
    return;
  }

  const payId = `A-PAY-${invoice.id}-${payment.id}`;
  if (accounting.payments.some((p) => p.id === payId)) return;

  const method =
    payment.method === 'Card' || payment.method === 'Mobile Money' || payment.method === 'Bank Transfer'
      ? payment.method
      : payment.method === 'Check'
        ? 'Cheque'
        : 'Cash';
  const now = new Date().toISOString();
  const settings = useSettingsStore.getState();
  accounting.addPayment({
    id: payId,
    paymentNumber: settings.getNextReceiptNumber(),
    date: payment.date || now,
    type: 'Receipt',
    businessPartnerId: invoice.businessPartnerId,
    customerName: reservation.guestName,
    invoiceId: invoice.id,
    reference: payment.ref || reservation.resId || reservation.id,
    description: `Payment for ${invoice.invoiceNumber}`,
    amount,
    currency: 'GHS',
    paymentMethod: method,
    status: 'Posted',
    createdAt: now,
    updatedAt: now,
    sourceModule: 'front_office',
    folioPaymentId: payment.id,
  } as any);
}

/** Void in Front Office also voids the Accounting receipt and puts the amount back on the invoice. */
export async function voidFolioReceiptInAccounting(
  self: StoreLike,
  reservationId: string,
  payment: { id: string; amount?: number; ref?: string },
) {
  const store = useAccountingStore.getState();
  if (store.payments.length === 0) await store.initializeAccounting();
  else await store.refreshLedgerFromServer();

  const accounting = useAccountingStore.getState();
  const reservation = self.reservations.find((r: any) => r.id === reservationId);
  if (!reservation) return;
  const refs = [reservation.resId, reservation.id].filter(Boolean).map((value: unknown) => String(value));
  const invoice = accounting.invoices.find((inv) =>
    inv.type === 'Sales' &&
    inv.status !== 'Void' &&
    (inv as { sourceModule?: string }).sourceModule === 'front_office_checkout' &&
    refs.includes(String(inv.reference || '')),
  );
  const amount = Number(payment.amount);
  const linkedId = invoice ? `A-PAY-${invoice.id}-${payment.id}` : '';
  const receipts = accounting.payments.filter(
    (p) => p.type === 'Receipt' && p.status !== 'Void',
  );
  const match =
    receipts.find((p) => (p as { folioPaymentId?: string }).folioPaymentId === payment.id) ||
    receipts.find((p) => p.id === linkedId) ||
    receipts.find((p) =>
      !!invoice &&
      p.invoiceId === invoice.id &&
      (p.sourceModule === 'front_office' || p.sourceModule === 'front_office_checkout') &&
      Math.abs(Number(p.amount) - amount) < 0.02 &&
      (!payment.ref || !p.reference || p.reference === payment.ref),
    );
  if (!match) {
    console.warn('[FO Invoice] No accounting receipt matched this void', reservationId, payment.id);
    return;
  }
  await accounting.voidPayment(match.id);
}

/** Put a voided folio receipt back in Accounting. The checkout invoice must already be live. */
export async function unvoidFolioReceiptInAccounting(
  self: StoreLike,
  reservationId: string,
  payment: { id: string; amount?: number; ref?: string },
) {
  const store = useAccountingStore.getState();
  if (store.payments.length === 0) await store.initializeAccounting();
  const accounting = useAccountingStore.getState();
  const reservation = self.reservations.find((r: any) => r.id === reservationId);
  if (!reservation) return;
  const refs = [reservation.resId, reservation.id].filter(Boolean).map((value: unknown) => String(value));
  const invoice = accounting.invoices.find((inv) =>
    inv.type === 'Sales' &&
    (inv as { sourceModule?: string }).sourceModule === 'front_office_checkout' &&
    refs.includes(String(inv.reference || '')),
  );
  const linkedId = invoice ? `A-PAY-${invoice.id}-${payment.id}` : '';
  const match = accounting.payments.find(
    (item) => item.status === 'Void' && (
      (item as { folioPaymentId?: string }).folioPaymentId === payment.id || item.id === linkedId
    ),
  );
  if (!match) return;
  await accounting.unvoidPayment(match.id);
}

/** Delete removes the folio line and the Accounting receipt, including one already marked Void. */
export async function deleteFolioReceiptFromAccounting(
  self: StoreLike,
  reservationId: string,
  payment: { id: string; amount?: number; ref?: string },
) {
  const store = useAccountingStore.getState();
  if (store.payments.length === 0) await store.initializeAccounting();
  else await store.refreshLedgerFromServer();

  const accounting = useAccountingStore.getState();
  const reservation = self.reservations.find((r: any) => r.id === reservationId);
  if (!reservation) return;
  const refs = [reservation.resId, reservation.id].filter(Boolean).map((value: unknown) => String(value));
  const invoice = accounting.invoices.find((inv) =>
    inv.type === 'Sales' &&
    inv.status !== 'Void' &&
    (inv as { sourceModule?: string }).sourceModule === 'front_office_checkout' &&
    refs.includes(String(inv.reference || '')),
  );
  const amount = Number(payment.amount);
  const linkedId = invoice ? `A-PAY-${invoice.id}-${payment.id}` : '';
  const receipts = accounting.payments.filter((p) => p.type === 'Receipt');
  const score = (p: { status?: string }) => (p.status === 'Void' ? 1 : 0);
  const ranked = (rows: typeof receipts) => [...rows].sort((a, b) => score(a) - score(b));
  const match =
    ranked(receipts.filter((p) => (p as { folioPaymentId?: string }).folioPaymentId === payment.id))[0] ||
    ranked(receipts.filter((p) => p.id === linkedId))[0] ||
    ranked(receipts.filter((p) =>
      !!invoice &&
      p.invoiceId === invoice.id &&
      (p.sourceModule === 'front_office' || p.sourceModule === 'front_office_checkout') &&
      Math.abs(Number(p.amount) - amount) < 0.02 &&
      (!payment.ref || !p.reference || p.reference === payment.ref),
    ))[0];
  if (!match) return;
  if (match.status !== 'Void') {
    await accounting.voidPayment(match.id);
    if (useAccountingStore.getState().error) return;
  }
  useAccountingStore.getState().purgePayment(match.id);
}

/**
 * A stay that is already checked out has a sales invoice. Voiding a folio charge
 * lowers that invoice, what the guest owes, and the books by the same amount.
 * A stay that is still in house has no invoice yet — checkout posts the net folio.
 */
export async function voidFolioChargeInAccounting(
  self: StoreLike,
  reservationId: string,
  charge: { id: string; description?: string; category?: string; glAccountCode?: string; amount?: number; tax?: number; serviceCharge?: number; discountAmount?: number },
) {
  const net = chargeNet(charge);
  const tax = Math.max(0, Number(charge.tax || 0));
  const gross = Math.round(chargeGross(charge) * 100) / 100;
  if (!(gross > 0.004)) return;

  const store = useAccountingStore.getState();
  if (store.invoices.length === 0 && store.journalEntries.length === 0) {
    await store.initializeAccounting();
  }
  const accounting = useAccountingStore.getState();
  const reservation = self.reservations.find((r: any) => r.id === reservationId);
  if (!reservation) return;
  const refs = [reservation.resId, reservation.id].filter(Boolean).map(String);
  const invoice = accounting.invoices.find(
    (inv: any) =>
      inv.type === 'Sales' &&
      inv.status !== 'Void' &&
      inv.sourceModule === 'front_office_checkout' &&
      refs.includes(String(inv.reference || '')),
  );
  if (!invoice) return;

  const reduceGross = Math.min(gross, Number(invoice.total) || 0);
  if (reduceGross < 0.01) return;
  const nextTotal = Math.max(0, Math.round((Number(invoice.total) - reduceGross) * 100) / 100);
  const taxCut = Math.min(tax, Number(invoice.taxAmount) || 0, reduceGross);
  const nextTax = Math.max(0, Math.round((Number(invoice.taxAmount || 0) - taxCut) * 100) / 100);
  const nextSub = Math.max(0, Math.round((nextTotal - nextTax) * 100) / 100);
  const paid = Number(invoice.paidAmount || 0);
  const status = invoice.status === 'Draft' || invoice.status === 'Void'
    ? invoice.status
    : paid + 0.009 >= nextTotal
      ? 'Paid'
      : 'Posted';

  accounting.updateInvoice(invoice.id, {
    subtotal: nextSub,
    taxAmount: nextTax,
    total: nextTotal,
    status,
    updatedAt: new Date().toISOString(),
  });

  const netCut = Math.max(0, Math.round((reduceGross - taxCut) * 100) / 100);
  postGuestFolioChargeVoidToLedger({
    chargeId: charge.id,
    invoiceNumber: invoice.invoiceNumber || invoice.id,
    description: charge.description || 'Folio charge',
    glAccountCode: folioChargeGlCode(charge),
    net: netCut || Math.max(0, net),
    tax: taxCut,
    gross: reduceGross,
  });
}

/** Put a voided folio charge back on the checkout invoice and reverse the void journal. */
export async function unvoidFolioChargeInAccounting(
  self: StoreLike,
  reservationId: string,
  charge: { id: string; description?: string; category?: string; glAccountCode?: string; amount?: number; tax?: number; serviceCharge?: number; discountAmount?: number },
) {
  const gross = Math.round(chargeGross(charge) * 100) / 100;
  if (!(gross > 0.004)) return;
  const store = useAccountingStore.getState();
  if (store.invoices.length === 0 && store.journalEntries.length === 0) await store.initializeAccounting();
  const accounting = useAccountingStore.getState();
  const reservation = self.reservations.find((r: any) => r.id === reservationId);
  if (!reservation) return;
  const refs = [reservation.resId, reservation.id].filter(Boolean).map(String);
  const invoice = accounting.invoices.find(
    (inv: any) =>
      inv.type === 'Sales' &&
      inv.status !== 'Void' &&
      inv.sourceModule === 'front_office_checkout' &&
      refs.includes(String(inv.reference || '')),
  );
  const voidJournalId = `JE-FO-VOID-${charge.id}`;
  if (accounting.journalEntries.some((entry) => entry.id === voidJournalId && entry.status === 'Posted')) {
    await accounting.voidJournalEntry(voidJournalId);
  }
  if (!invoice) return;
  const tax = Math.max(0, Number(charge.tax || 0));
  const nextTotal = Math.round((Number(invoice.total) + gross) * 100) / 100;
  const nextTax = Math.round((Number(invoice.taxAmount || 0) + tax) * 100) / 100;
  const nextSub = Math.max(0, Math.round((nextTotal - nextTax) * 100) / 100);
  const paid = Number(invoice.paidAmount || 0);
  accounting.updateInvoice(invoice.id, {
    subtotal: nextSub,
    taxAmount: nextTax,
    total: nextTotal,
    status: paid + 0.009 >= nextTotal ? 'Paid' : 'Posted',
    updatedAt: new Date().toISOString(),
  });
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


