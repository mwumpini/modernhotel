'use client';

type StoreLike = any;
import { useSettingsStore } from '../../settings/store';
import { useAccountingStore } from '../../accounting/store';
import { postGuestFolioCheckoutToLedger } from '../../accounting/simpleFlow';
import { folioChargeGlCode } from './folio';

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

  const subtotal = folio.charges.reduce((sum: number, c: any) => sum + c.amount, 0);
  const taxAmount = folio.charges.reduce((sum: number, c: any) => sum + (c.tax || 0), 0);
  const total = subtotal + taxAmount;
  const paid = folio.totalPayments || 0;
  const balance = Math.max(0, (folio.balance ?? (total - paid)));

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

  const paymentRows: Array<{ amount: number; method: string; date: string }> = [];
  try {
    (folio.payments || []).forEach((p: any, idx: number) => {
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
      paymentRows.push({
        amount: amt,
        method,
        date: p.date || new Date().toISOString(),
      });
      accounting.addPayment({
        id: `A-PAY-${newId}-${idx}-${Math.random().toString(36).slice(2, 10)}`,
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

  try {
    postGuestFolioCheckoutToLedger({
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
    });
  } catch (e) {
    console.warn('[FO Invoice] postGuestFolioCheckoutToLedger failed', e);
  }

  (reservation as any).invoiceGenerated = true;
  (reservation as any).invoiceGeneratedDate = new Date().toISOString();
  (reservation as any).invoiceStatus = balance === 0 ? 'paid' : 'sent';
  folio.status = 'closed';
  self.notify();
}


