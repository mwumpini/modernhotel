import type { Invoice } from './models';
import type { Folio, Reservation } from '../frontoffice/types';

type InvoiceWithCustomer = Invoice & { customerName?: string };

export type ReceiptTargetKind = 'folio' | 'invoice';

export interface ReceiptTarget {
  key: string;
  kind: ReceiptTargetKind;
  id: string;
  label: string;
  customerName: string;
  businessPartnerId?: string;
  balance: number;
  sourceBadge: string;
  roomNumber?: string;
  reservationId?: string;
}

export function invoiceRemainingBalance(inv: InvoiceWithCustomer): number {
  const total = inv.total ?? 0;
  const paid = inv.paidAmount ?? 0;
  return Math.max(0, total - paid);
}

export function buildInvoiceReceiptTargets(invoices: InvoiceWithCustomer[]): ReceiptTarget[] {
  return invoices
    .filter(
      (inv) =>
        inv.status !== 'Void' &&
        inv.status !== 'Paid' &&
        invoiceRemainingBalance(inv) > 0.009
    )
    .map((inv) => {
      const balance = invoiceRemainingBalance(inv);
      const isFo = inv.sourceModule === 'front_office_checkout';
      return {
        key: `invoice:${inv.id}`,
        kind: 'invoice' as const,
        id: inv.id,
        label: `${inv.invoiceNumber || inv.id} — ${inv.customerName || 'Guest'} (${balance.toFixed(2)} due)`,
        customerName: inv.customerName || '',
        businessPartnerId: inv.businessPartnerId,
        balance,
        sourceBadge: isFo ? 'Front office' : 'Posted invoice',
      };
    });
}

export function buildFolioReceiptTargets(
  folios: Folio[],
  reservations: Reservation[]
): ReceiptTarget[] {
  const resById = new Map(reservations.map((r) => [r.id, r]));

  return folios
    .filter((f) => {
      // A corporate reservation carries two Folio rows (its own + an auto-created
      // 'split' "Company Folio") sharing the same reservationId. This list is keyed
      // by reservationId only, so including both would render two entries with the
      // exact same guest name/label and no way to tell which is which — exclude the
      // split folio here rather than ship an ambiguous duplicate.
      if (f.type === 'split') return false;
      const res = resById.get(f.reservationId);
      if (!res) return false;
      if (res.status !== 'checked-in') return false;
      if (res.invoiceGenerated) return false;
      return (f.balance ?? 0) > 0.009;
    })
    .map((f) => {
      const res = resById.get(f.reservationId)!;
      const balance = f.balance ?? 0;
      const room = res.roomId ? `Rm ${res.roomId}` : '';
      return {
        key: `folio:${f.reservationId}`,
        kind: 'folio' as const,
        id: f.reservationId,
        label: `${res.guestName}${room ? ` · ${room}` : ''} — in-house (${balance.toFixed(2)} due)`,
        customerName: res.guestName,
        businessPartnerId: res.guestId || undefined,
        balance,
        sourceBadge: 'In-house folio',
        roomNumber: res.roomId,
        reservationId: f.reservationId,
      };
    });
}

export function parseReceiptTargetKey(key: string): { kind: ReceiptTargetKind; id: string } | null {
  if (key.startsWith('folio:')) return { kind: 'folio', id: key.slice(6) };
  if (key.startsWith('invoice:')) return { kind: 'invoice', id: key.slice(8) };
  return null;
}
