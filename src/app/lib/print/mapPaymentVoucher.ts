import type { PaymentVoucher } from '../accounting/models';
import type { PrintData, PrintOrgInfo, PrintSignature } from './templates';

/**
 * Maps a PaymentVoucher record onto the shared PrintData binding contract, ready for
 * `renderPrint('payment-voucher', templateKey, data)` — same call shape every other
 * document type already uses. Not wired to a live "Print" button anywhere yet: the
 * Payment Voucher management screen itself is currently stubbed out
 * (see AccountsPayable.tsx) and rebuilding it is a separate follow-up task.
 */
export function paymentVoucherToPrintData(voucher: PaymentVoucher, org: PrintOrgInfo): PrintData {
  const signatures: PrintSignature[] = [];
  if (voucher.preparedBy) {
    signatures.push({ label: 'Prepared By', name: voucher.preparedBy, signedDate: voucher.preparedDate?.toISOString() });
  }
  if (voucher.approvedBy) {
    signatures.push({ label: 'Approved By', name: voucher.approvedBy, signedDate: voucher.approvedDate?.toISOString() });
  }
  if (voucher.recordedBy) {
    signatures.push({ label: 'Recorded By', name: voucher.recordedBy, signedDate: voucher.recordedDate?.toISOString() });
  }
  if (voucher.receivedBy) {
    signatures.push({ label: 'Received By', role: 'Payee', name: voucher.receivedBy, signedDate: voucher.receivedDate?.toISOString() });
  }

  return {
    org,
    guest: { name: voucher.payTo },
    docNumber: voucher.voucherNumber,
    docDate: voucher.date.toISOString(),
    title: 'Payment Voucher',
    items: [],
    totals: { subTotal: voucher.totalDebit },
    debitCreditLines: voucher.lines.map((l) => ({
      accountName: l.accountName || l.accountCode,
      details: l.details,
      debit: l.debit,
      credit: l.credit,
    })),
    signatures: signatures.length ? signatures : undefined,
    footerNotes: voucher.description ? [voucher.description] : undefined,
    currency: voucher.currency,
  };
}
