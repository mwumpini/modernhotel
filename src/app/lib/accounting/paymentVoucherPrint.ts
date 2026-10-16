import { openPrintPreview } from '../print/engine';
import type { PrintData, PrintDebitCreditLine, PrintOrgInfo } from '../print/templates';
import { paymentMethodLabel } from './receiptPrint';

/** A bill line as stored on a purchase invoice. Service lines have a description and no stock item. */
export interface VoucherBillLine {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  glAccountCode?: string;
  itemCode?: string;
  itemId?: string;
  lineKind?: 'item' | 'service';
}

export interface VoucherBill {
  invoiceNumber?: string;
  total?: number;
  lines?: VoucherBillLine[];
}

export interface VoucherPayee {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  taxNumber?: string;
}

export interface VoucherBank {
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  branch?: string;
}

function money2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function lineAmount(line: VoucherBillLine): number {
  if (line.amount != null && Number(line.amount) !== 0) return money2(Number(line.amount));
  return money2(Number(line.quantity || 0) * Number(line.unitPrice || 0));
}

function isServiceLine(line: VoucherBillLine): boolean {
  if (line.lineKind === 'service') return true;
  if (line.lineKind === 'item') return false;
  return !line.itemId && !line.itemCode;
}

/**
 * The Payment Voucher for a supplier payment, whether the bill was goods or a service.
 * Debits are what was settled (each service or item, scaled to this payment).
 * Credits are the cash paid and any tax withheld, so the voucher balances.
 */
export function buildSupplierPaymentVoucherPrintData(args: {
  payment: {
    paymentNumber?: string;
    id: string;
    date: string;
    amount?: number;
    paymentMethod?: string;
    reference?: string;
    description?: string;
    checkNumber?: string;
    status?: string;
    whtAmount?: number;
    whtVatAmount?: number;
    receivedBy?: string;
    staffName?: string;
  };
  payee: VoucherPayee;
  bill?: VoucherBill | null;
  bank?: VoucherBank | null;
  accountName?: (code: string) => string | undefined;
  org: PrintOrgInfo;
  currency?: string;
  preparedBy?: string;
}): PrintData {
  const cash = money2(Number(args.payment.amount || 0));
  const wht = money2(Number(args.payment.whtAmount || 0));
  const whtVat = money2(Number(args.payment.whtVatAmount || 0));
  const settled = money2(cash + wht + whtVat);
  const method = paymentMethodLabel(args.payment.paymentMethod);
  const lines = (args.bill?.lines || []).filter((line) => lineAmount(line) > 0);

  const billTotal = money2(Number(args.bill?.total || 0));
  const settlesWholeBill = billTotal > 0 && Math.abs(settled - billTotal) < 0.01;
  const lineTotal = money2(lines.reduce((sum, line) => sum + lineAmount(line), 0));

  const debits: PrintDebitCreditLine[] = [];
  // A part payment is one line. Splitting it across every bill line invents amounts
  // for lines this payment did not settle. Lines with no amount are already left off.
  if (settlesWholeBill && lines.length && lineTotal > 0 && settled > 0) {
    let used = 0;
    lines.forEach((line, index) => {
      const share = index === lines.length - 1
        ? money2(settled - used)
        : money2((settled * lineAmount(line)) / lineTotal);
      used = money2(used + share);
      if (share <= 0) return;
      const service = isServiceLine(line);
      const description = line.description?.trim();
      debits.push({
        accountCode: line.glAccountCode || undefined,
        accountName: (line.glAccountCode && args.accountName?.(line.glAccountCode)) || (service ? 'Service' : 'Purchases'),
        details: description || undefined,
        debit: share,
        credit: 0,
      });
    });
  }
  if (!debits.length) {
    debits.push({
      accountName: 'Accounts payable',
      details: args.payment.description?.trim() || (args.bill?.invoiceNumber ? `Bill ${args.bill.invoiceNumber}` : 'Supplier payment'),
      debit: settled,
      credit: 0,
    });
  }

  const credits: PrintDebitCreditLine[] = [];
  if (cash > 0 || settled === 0) {
    const fromAccount = args.bank?.accountName?.trim();
    credits.push({
      accountName: fromAccount || (method === 'Cash' ? 'Cash' : method),
      details: [fromAccount && fromAccount !== method ? method : '', args.payment.checkNumber ? `Cheque ${args.payment.checkNumber}` : '', args.payment.reference].filter(Boolean).join(' · ') || undefined,
      debit: 0,
      credit: cash,
    });
  }
  if (wht > 0) credits.push({ accountName: 'Withholding tax', details: 'Withheld on this payment', debit: 0, credit: wht });
  if (whtVat > 0) credits.push({ accountName: 'VAT withheld', details: 'Withheld on this payment', debit: 0, credit: whtVat });

  const payeeLines = [
    args.payee.contactPerson,
    args.payee.address,
    args.payee.phone,
    args.payee.email,
    args.payee.taxNumber ? `TIN ${args.payee.taxNumber}` : '',
  ].filter(Boolean);

  const footerNotes = [
    args.bill?.invoiceNumber ? `Bill ${args.bill.invoiceNumber}` : undefined,
    billTotal > 0 && settled + 0.009 < billTotal ? 'Part payment' : undefined,
    args.payment.status === 'Void' ? 'Void' : undefined,
  ].filter(Boolean) as string[];

  const signatures = [
    args.preparedBy || args.payment.staffName ? { label: 'Prepared By', name: args.preparedBy || args.payment.staffName } : undefined,
    args.payment.receivedBy ? { label: 'Received By', role: 'Payee', name: args.payment.receivedBy } : undefined,
  ].filter((line): line is { label: string; name: string; role?: string } => !!line?.name);

  return {
    org: args.org,
    guest: { name: args.payee.name || 'Supplier', address: payeeLines.join('\n') || undefined },
    docNumber: args.payment.paymentNumber || args.payment.id,
    docDate: args.payment.date,
    title: 'Payment Voucher',
    items: [],
    totals: { subTotal: settled, grandTotal: settled },
    debitCreditLines: [...debits, ...credits],
    footerNotes,
    currency: args.currency || '₵',
    chequeNumber: args.payment.checkNumber || undefined,
    bankDetails: args.bank?.bankName || args.bank?.accountNumber
      ? {
          bankName: args.bank.bankName,
          accountName: args.bank.accountName,
          accountNumber: args.bank.accountNumber,
          branch: args.bank.branch,
        }
      : undefined,
    signatures: signatures.length ? signatures : undefined,
  };
}

export function printSupplierPaymentVoucher(templateKey: string, data: PrintData) {
  openPrintPreview('payment-voucher', templateKey, data);
}
