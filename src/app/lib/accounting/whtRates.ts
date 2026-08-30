/**
 * WHT certificate rates for AR (a customer who is a designated withholding agent withholds
 * tax when paying our sales invoice, and gives us a certificate/tax credit for it).
 *
 * `onSubtotalPct` is the same statutory resident-WHT-on-services rate used on the purchases
 * side (`gh-wht-services` in the compliance Tax Rate Builder) — GRA applies one rate to
 * services regardless of which party is the withholding agent — so it's read from that same
 * live, user-editable compliance rule (never a hardcoded literal): the only active
 * `type: 'Withholding'` TaxConfig synced from compliance.
 *
 * `onVatPct` (VAT withholding — a separate, less-common GRA mechanism where certain agents
 * withhold a portion of the VAT charged) has no corresponding compliance rule yet, so it
 * stays a fixed statutory constant rather than silently pretending to be configurable.
 */

import type { TaxConfig } from './models';
import { roundMoney2 } from './taxFromConfig';

/** GRA VAT-withholding rate — not yet modeled as an editable compliance rule (see file header). */
const VAT_WITHHOLDING_PCT = 7;

export type WhtCertificateRates = {
  onSubtotalPct: number;
  onVatPct: number;
};

const FALLBACK_RATES: WhtCertificateRates = {
  onSubtotalPct: 7.5,
  onVatPct: VAT_WITHHOLDING_PCT,
};

export function getWhtCertificateRates(taxConfigs?: TaxConfig[]): WhtCertificateRates {
  const sub = taxConfigs?.find((c) => c.type === 'Withholding' && c.isActive);
  return {
    onSubtotalPct: sub?.rate ?? FALLBACK_RATES.onSubtotalPct,
    onVatPct: VAT_WITHHOLDING_PCT,
  };
}

export function computeWhtAmounts(
  subtotal: number,
  taxAmount: number,
  taxConfigs?: TaxConfig[],
): WhtCertificateRates & { whtAmount: number; whtVatAmount: number } {
  const rates = getWhtCertificateRates(taxConfigs);
  return {
    ...rates,
    whtAmount: roundMoney2(subtotal * (rates.onSubtotalPct / 100)),
    whtVatAmount: roundMoney2(taxAmount * (rates.onVatPct / 100)),
  };
}

export function whtFormLabels(rates: WhtCertificateRates) {
  return {
    whtLabel: `WHT Amount (${rates.onSubtotalPct}% of subtotal)`,
    whtVatLabel: `WHT-VAT Amount (${rates.onVatPct}% of VAT)`,
  };
}

export type InvoiceWhtSettlement = {
  balanceDue: number;
  whtRemaining: number;
  whtVatRemaining: number;
  whtTotalRemaining: number;
  cashRemaining: number;
  fullWht: number;
  fullWhtVat: number;
};

/** Remaining cash vs WHT split for an invoice (respects prior receipts and WHT recorded). */
export function computeInvoiceWhtSettlement(
  invoice: {
    subtotal?: number;
    total: number;
    taxAmount?: number;
    paidAmount?: number;
    whtReceived?: number;
    whtVatReceived?: number;
  },
  taxConfigs?: TaxConfig[],
): InvoiceWhtSettlement {
  const subtotal = Number(invoice.subtotal ?? invoice.total - (invoice.taxAmount || 0));
  const taxAmount = Number(invoice.taxAmount || 0);
  const { whtAmount: fullWht, whtVatAmount: fullWhtVat } = computeWhtAmounts(subtotal, taxAmount, taxConfigs);
  const whtReceived = Number(invoice.whtReceived || 0);
  const whtVatReceived = Number(invoice.whtVatReceived || 0);
  const whtRemaining = roundMoney2(Math.max(0, fullWht - whtReceived));
  const whtVatRemaining = roundMoney2(Math.max(0, fullWhtVat - whtVatReceived));
  const balanceDue = roundMoney2(Math.max(0, invoice.total - (invoice.paidAmount || 0)));
  const whtTotalRemaining = roundMoney2(whtRemaining + whtVatRemaining);
  const cashRemaining = roundMoney2(Math.max(0, balanceDue - whtTotalRemaining));
  return {
    balanceDue,
    whtRemaining,
    whtVatRemaining,
    whtTotalRemaining,
    cashRemaining,
    fullWht,
    fullWhtVat,
  };
}
