/**
 * Withholding Tax on purchases — reads the real, user-editable compliance rules
 * (domain: 'purchases', e.g. `gh-wht-services`/`gh-wht-goods`/`gh-wht-works`/`gh-wht-rent`)
 * via the compliance tax-rule engine. Never a hardcoded rate.
 */

import { useComplianceStore } from '../compliance/store';
import { GHANA_TAX_CODES } from './models';

export interface PurchaseWhtLine {
  ruleId: string;
  name: string;
  rate: number;
  amount: number;
  glCode: string;
}

export type PurchaseWhtCategory = 'SERVICE' | 'GOODS' | 'WORKS' | 'RENT';

export const PURCHASE_WHT_CATEGORIES: { key: PurchaseWhtCategory; label: string }[] = [
  { key: 'SERVICE', label: 'Services' },
  { key: 'GOODS', label: 'Goods' },
  { key: 'WORKS', label: 'Works' },
  { key: 'RENT', label: 'Rent' },
];

/** Computes WHT on a purchase invoice's subtotal for the given supplier-transaction category, or null if no active WHT rule applies. */
export function computePurchaseWht(subtotal: number, category: PurchaseWhtCategory): PurchaseWhtLine | null {
  if (!(subtotal > 0)) return null;
  const { taxes } = useComplianceStore.getState().calculateTax(subtotal, category, {
    domain: 'purchases',
    operation: 'internal',
  });
  const line = taxes.find((t) => t.amount !== 0);
  if (!line) return null;
  return { ruleId: line.ruleId, name: line.name, rate: line.rate, amount: line.amount, glCode: line.glCode };
}

export interface PurchaseWhtVatLine {
  rate: number;
  amount: number;
  glCode: string;
}

/**
 * VAT withheld from a supplier payment by a GRA-designated VAT-withholding agent -- a separate,
 * less-common mechanism from the category-based WHT above (see computePurchaseWht), and
 * independent of it: a purchase can have tax withholding, VAT withholding, both, or neither.
 * 7% of the invoice's tax amount, mirroring the AR side's WHT-VAT convention (whtRates.ts) --
 * not yet modeled as an editable compliance rule there either, so this stays a fixed constant
 * for the same reason.
 */
const PURCHASE_VAT_WITHHOLDING_PCT = GHANA_TAX_CODES.WITHHOLDING_VAT.rate;

export function computePurchaseWhtVat(taxAmount: number): PurchaseWhtVatLine | null {
  if (!(taxAmount > 0)) return null;
  return {
    rate: PURCHASE_VAT_WITHHOLDING_PCT,
    amount: +(taxAmount * (PURCHASE_VAT_WITHHOLDING_PCT / 100)).toFixed(2),
    glCode: GHANA_TAX_CODES.WITHHOLDING_VAT.glCode,
  };
}
