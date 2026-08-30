import { openPrintPreview } from '../print/engine';
import type { PrintData, PrintOrgInfo } from '../print/templates';
import type { Invoice, Payment } from './models';
import type { Folio, FolioPayment, Reservation } from '../frontoffice/types';
import type { ReceiptTarget } from './receiptTargets';
import { invoiceRemainingBalance } from './receiptTargets';

export const FRONT_OFFICE_FOLIO_RECEIPT_SOURCE = 'front_office_folio';

export type StoredReceiptPayment = Payment & {
  customerName?: string;
  staffName?: string;
  reservationId?: string;
  folioPaymentId?: string;
  receiptTargetKey?: string;
};

export function suggestReceiptRevenueCenter(
  target: ReceiptTarget | null | undefined,
  invoice?: (Invoice & { customerName?: string }) | null,
): string {
  if (target?.kind === 'folio') return 'RM';
  if (!invoice) return '';
  if (invoice.sourceModule === 'front_office_checkout') return 'RM';
  const lineCc = invoice.lines?.find((l) => l.costCenter)?.costCenter;
  if (lineCc) return lineCc;
  switch (invoice.department) {
    case 'conference':
      return 'CF';
    case 'restaurant':
    case 'food_beverage':
      return 'REST';
    case 'bar':
      return 'BAR';
    case 'room_service':
      return 'RS';
    case 'front_office':
      return 'RM';
    default:
      break;
  }
  switch (invoice.sourceModule) {
    case 'restaurant':
      return 'REST';
    case 'bar':
      return 'BAR';
    case 'room_service':
      return 'RS';
    case 'conference':
      return 'CF';
    default:
      return 'SC';
  }
}

export function mapUiPaymentMethodToStore(method: string): Payment['paymentMethod'] {
  switch (method) {
    case 'Bank':
    case 'Bank Transfer':
      return 'Bank';
    case 'Cheque':
    case 'Check':
      return 'Check';
    case 'Card':
      return 'Card';
    case 'Mobile Money':
      return 'Mobile Money';
    default:
      return 'Cash';
  }
}

export function paymentMethodLabel(method?: string): string {
  switch (method) {
    case 'Bank':
    case 'Bank Transfer':
      return 'Bank transfer';
    case 'Check':
    case 'Cheque':
      return 'Cheque';
    case 'Card':
      return 'Card';
    case 'Mobile Money':
      return 'Mobile money';
    default:
      return method || 'Cash';
  }
}

export function buildCustomerReceiptPrintData(args: {
  payment: Pick<
    StoredReceiptPayment,
    'paymentNumber' | 'id' | 'date' | 'amount' | 'paymentMethod' | 'reference' | 'description'
  >;
  customerName: string;
  target?: ReceiptTarget | null;
  invoice?: (Invoice & { customerName?: string }) | null;
  reservation?: Reservation | null;
  folio?: Folio | null;
  org: PrintOrgInfo;
  currency?: string;
  docNumber?: string;
}): PrintData {
  const currency = args.currency || '₵';
  const amount = args.payment.amount ?? 0;
  const method = paymentMethodLabel(args.payment.paymentMethod);
  const appliedLabel =
    args.target?.kind === 'folio'
      ? `In-house folio${args.reservation?.roomId ? ` · Rm ${args.reservation.roomId}` : ''}`
      : args.invoice?.invoiceNumber
        ? `Invoice ${args.invoice.invoiceNumber}`
        : args.target?.sourceBadge;

  const folioBalance = args.folio?.balance ?? args.target?.balance;
  const invoiceBalance =
    args.invoice != null ? invoiceRemainingBalance(args.invoice) : undefined;

  const footerNotes = [
    args.payment.description,
    appliedLabel ? `Applied to: ${appliedLabel}` : undefined,
    args.target?.kind === 'folio'
      ? 'Guest folio payment — accounting invoice posts at checkout.'
      : undefined,
  ].filter(Boolean) as string[];

  return {
    org: args.org,
    guest: {
      name: args.customerName,
      roomNumber: args.reservation?.roomId || args.target?.roomNumber,
      arrivalDate: args.reservation?.arrival,
      departureDate: args.reservation?.departure,
    },
    docNumber: args.docNumber || args.payment.paymentNumber || args.payment.id,
    docDate: args.payment.date,
    title: 'Payment Receipt',
    items: [
      {
        description: `Payment received (${method})${args.payment.reference ? ` · ${args.payment.reference}` : ''}`,
        amount,
        date: args.payment.date,
      },
    ],
    totals: {
      subTotal: amount,
      payments: amount,
      balance:
        args.target?.kind === 'folio'
          ? Math.max(0, (folioBalance ?? 0))
          : args.invoice
            ? Math.max(0, invoiceBalance ?? 0)
            : 0,
      grandTotal: amount,
    },
    footerNotes,
    currency,
  };
}

export function resolvePaymentsForReceiptTarget(
  target: ReceiptTarget,
  payments: StoredReceiptPayment[],
  folio?: Folio | null,
): StoredReceiptPayment[] {
  if (target.kind === 'invoice') {
    return payments
      .filter((p) => p.type === 'Receipt' && p.status !== 'Void' && p.invoiceId === target.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const fromAccounting = payments
    .filter(
      (p) =>
        p.type === 'Receipt' &&
        p.status !== 'Void' &&
        p.sourceModule === FRONT_OFFICE_FOLIO_RECEIPT_SOURCE &&
        p.reservationId === target.id,
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (fromAccounting.length > 0) return fromAccounting;

  if (!folio) return [];

  return folio.payments
    .filter((p: FolioPayment) => p.status === 'completed')
    .map(
      (fp: FolioPayment) =>
        ({
          id: fp.id,
          paymentNumber: fp.id,
          date: fp.date,
          type: 'Receipt',
          businessPartnerId: target.businessPartnerId || target.id,
          amount: fp.amount,
          currency: 'GHS',
          paymentMethod: mapUiPaymentMethodToStore(fp.method),
          reference: fp.ref,
          description: fp.notes || 'In-house folio payment',
          status: 'Posted',
          sourceModule: FRONT_OFFICE_FOLIO_RECEIPT_SOURCE,
          reservationId: target.id,
          folioPaymentId: fp.id,
          customerName: target.customerName,
          staffName: fp.processedBy,
          createdAt: fp.date,
          updatedAt: fp.date,
        }) as StoredReceiptPayment,
    )
    .sort(
      (a: StoredReceiptPayment, b: StoredReceiptPayment) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
}

export function printCustomerReceipt(templateKey: string, data: PrintData) {
  openPrintPreview('receipt', templateKey, data);
}

export function receiptCanEdit(receipt: StoredReceiptPayment): boolean {
  if (receipt.status === 'Void' || receipt.isWHTCertificate) return false;
  return (
    receipt.sourceModule === FRONT_OFFICE_FOLIO_RECEIPT_SOURCE ||
    !receipt.sourceModule ||
    receipt.sourceModule === 'manual' ||
    receipt.sourceModule === 'manual_ar_ap'
  );
}

export function receiptCanVoid(receipt: StoredReceiptPayment): boolean {
  return receiptCanEdit(receipt);
}
