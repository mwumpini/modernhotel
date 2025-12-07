'use client';

type StoreLike = any;
import { useSettingsStore } from '../../settings/store';
import { useAccountingStore } from '../../accounting/store';

/**
 * Generate and post an accounting invoice from a reservation folio.
 * This mirrors prior inline logic but lives outside the store for readability.
 */
export function generateAccountingInvoiceForReservation(self: StoreLike, reservationId: string) {
  const reservation = self.reservations.find((r: any) => r.id === reservationId);
  if (!reservation) return;

  const folio = self.getOrCreateFolio(reservationId);
  self.updateFolioBalances(folio);

  const subtotal = folio.charges.reduce((sum: number, c: any) => sum + c.amount, 0);
  const taxAmount = folio.charges.reduce((sum: number, c: any) => sum + (c.tax || 0), 0);
  const total = subtotal + taxAmount;
  const paid = folio.totalPayments || 0;
  const balance = Math.max(0, (folio.balance ?? (total - paid)));

  const lines = folio.charges.map((c: any, idx: number) => ({
    id: `IL-${Date.now().toString().slice(-6)}-${idx}`,
    invoiceId: 'pending',
    description: c.description,
    quantity: 1,
    unitPrice: c.amount,
    amount: c.amount,
    taxAmount: c.tax || 0,
    glAccountCode: (c.description || '').toLowerCase().includes('room') ? '4100' : '4300'
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
    lines
  };

  invoice.lines = invoice.lines.map((l: any) => ({ ...l, invoiceId: newId }));
  try { accounting.addInvoice(invoice); } catch (e) { console.warn('FO: addInvoice failed', e); }

  try {
    (folio.payments || []).forEach((p: any) => {
      accounting.addPayment({
        id: `A-PAY-${Date.now().toString().slice(-6)}`,
        paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
        date: p.date,
        type: 'Receipt',
        businessPartnerId: reservation.guestId || reservation.guestName,
        invoiceId: newId,
        reference: p.ref,
        description: `Payment for ${invNumber}`,
        amount: p.amount,
        currency: 'GHS',
        paymentMethod: (p.method === 'Card' || p.method === 'Mobile Money') ? p.method : 'Cash',
        status: 'Posted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any);
    });
  } catch {}

  (reservation as any).invoiceGenerated = true;
  (reservation as any).invoiceGeneratedDate = new Date().toISOString();
  (reservation as any).invoiceStatus = balance === 0 ? 'paid' : 'sent';
  folio.status = 'closed';
  self.notify();
}


