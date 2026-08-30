/**
 * Withholding Tax on purchases (e.g. GRA resident WHT on services) — reads the real,
 * user-editable compliance rule (domain: 'purchases', tag: 'SERVICE', e.g. `gh-wht-services`)
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

/** Computes WHT on a service-type purchase invoice's subtotal, or null if no active WHT rule applies. */
export function computeServiceWht(subtotal: number): PurchaseWhtLine | null {
  if (!(subtotal > 0)) return null;
  const { taxes } = useComplianceStore.getState().calculateTax(subtotal, 'SERVICE', {
    domain: 'purchases',
    operation: 'internal',
  });
  const line = taxes.find((t) => t.amount !== 0);
  if (!line) return null;
  return { ruleId: line.ruleId, name: line.name, rate: line.rate, amount: line.amount, glCode: line.glCode };
}
