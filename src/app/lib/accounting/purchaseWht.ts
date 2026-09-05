/**
 * Withholding Tax on purchases — reads the real, user-editable compliance rules
 * (domain: 'purchases', e.g. `gh-wht-services`/`gh-wht-goods`/`gh-wht-works`/`gh-wht-rent`)
 * via the compliance tax-rule engine. Never a hardcoded rate.
 */

import { useComplianceStore } from '../compliance/store';

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
