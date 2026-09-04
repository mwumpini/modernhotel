'use client';

/**
 * Unified tax computation — single entry point for all modules.
 * Reads active `TaxConfig[]` from the accounting store (synced from compliance TaxRateBuilder).
 * Falls back to `GHANA_TAX_CODES` template when the store has not been initialized.
 */

import { useAccountingStore } from '../accounting/store';
import {
  computeStackedTaxLines,
  roundMoney2,
  roundToIncrement,
  type StackedTaxLine,
  type TaxStackContext,
} from '../accounting/taxFromConfig';
import type { TaxConfig } from '../accounting/models';
import { resolveClientTaxConfigs } from './resolveConfigs.client';

export type TaxComputationResult = {
  lines: StackedTaxLine[];
  totalTax: number;
  gross: number;
  exclusiveAmount: number;
};

/** Active tax configs for the current country (accounting store → compliance JSON → template). */
export function getActiveTaxConfigs(countryCode = 'GH'): TaxConfig[] {
  const all = useAccountingStore.getState().taxConfigs;
  return resolveClientTaxConfigs(all, countryCode);
}

/**
 * Compute Ghana stacked sales tax on a tax-exclusive amount.
 * @param targetTotalTax When the caller already computed a lump tax (e.g. folio), scale lines to match.
 */
export function computeSalesTax(
  exclusiveAmount: number,
  targetTotalTax?: number
): TaxComputationResult {
  const configs = getActiveTaxConfigs();
  const { lines, totalTax, gross } = computeStackedTaxLines(
    exclusiveAmount,
    configs,
    'sales',
    targetTotalTax
  );
  return { lines, totalTax, gross, exclusiveAmount: exclusiveAmount };
}

/** Compute purchase / input tax stack (recoverable levies + VAT). */
export function computePurchaseTax(
  exclusiveAmount: number,
  targetTotalTax?: number
): TaxComputationResult {
  const configs = getActiveTaxConfigs();
  const { lines, totalTax, gross } = computeStackedTaxLines(
    exclusiveAmount,
    configs,
    'purchase',
    targetTotalTax
  );
  return { lines, totalTax, gross, exclusiveAmount: exclusiveAmount };
}

/** Convenience: total tax only (replaces scattered `layeredTaxFromSettings` calls). */
export function computeSalesTaxTotal(exclusiveAmount: number): number {
  return computeSalesTax(exclusiveAmount).totalTax;
}

/** Rates snapshot for display (derived from active configs, not settings). */
export function getCanonicalTaxRates(): {
  vat: number;
  nhil: number;
  getfund: number;
  tourismLevy: number;
  withholding: number;
} {
  const configs = getActiveTaxConfigs();
  const rateOf = (type: TaxConfig['type']) =>
    configs.find((c) => c.type === type && c.isActive)?.rate ?? 0;
  return {
    vat: rateOf('VAT'),
    nhil: rateOf('NHIL'),
    getfund: rateOf('GETFund'),
    tourismLevy: rateOf('Tourism'),
    withholding: rateOf('Withholding'),
  };
}

/** Multiplier: tax-exclusive → tax-inclusive (e.g. ₵100 net → ₵121.90 gross). */
export function salesGrossMultiplier(): number {
  const sample = 100;
  const { gross } = computeSalesTax(sample);
  return sample > 0 ? gross / sample : 1;
}

export function grossFromExclusive(exclusive: number): number {
  return computeSalesTax(exclusive).gross;
}

export function exclusiveFromGross(gross: number): number {
  if (gross <= 0) return 0;
  const m = salesGrossMultiplier();
  return m > 0 ? roundMoney2(gross / m) : gross;
}

/** Effective stacked tax rate as a fraction (totalTax / exclusive). */
export function effectiveSalesTaxRate(): number {
  const sample = 100;
  const { totalTax } = computeSalesTax(sample);
  return sample > 0 ? totalTax / sample : 0;
}

export type QuoteTaxLine = { id: string; name: string; rate: number; amount: number; authority?: string };

/** Event quotes and similar — uses the same stack as folios/POS. */
export function computeQuoteTax(
  exclusiveAmount: number,
  isTaxExempt = false
): { taxes: QuoteTaxLine[]; totalTax: number; exemptionApplied: boolean } {
  if (isTaxExempt || exclusiveAmount <= 0) {
    return { taxes: [], totalTax: 0, exemptionApplied: isTaxExempt };
  }
  const { lines, totalTax } = computeSalesTax(exclusiveAmount);
  return {
    taxes: lines.map((l) => ({
      id: l.taxCode,
      name: l.name,
      rate: l.rate,
      amount: l.amount,
      authority: 'Ghana Revenue Authority',
    })),
    totalTax,
    exemptionApplied: false,
  };
}

/** Receipt/display breakdown keyed by levy type. */
export function salesTaxBreakdown(exclusiveAmount: number): {
  vat: number;
  nhil: number;
  getfund: number;
  tourism: number;
  total: number;
} {
  const { lines, totalTax } = computeSalesTax(exclusiveAmount);
  const pick = (type: string) =>
    lines.find((l) => l.type === type || l.taxCode.toUpperCase().includes(type))?.amount ?? 0;
  return {
    nhil: pick('NHIL'),
    getfund: pick('GETFund'),
    vat: pick('VAT'),
    tourism: pick('Tourism'),
    total: totalTax,
  };
}

export { roundMoney2, roundToIncrement, type StackedTaxLine, type TaxStackContext };
