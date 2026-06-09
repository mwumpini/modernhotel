/**
 * Resolve active TaxConfig[] from compliance JSON (server) or accounting store (client).
 * Single source for F&B API, purchase flows, and folio stacking.
 */

import type { TaxRule } from '../models';
import type { TaxConfig } from '../accounting/models';
import { taxConfigsFromGhanaTemplate, getEffectiveTaxConfigs } from '../accounting/taxFromConfig';
import { mapComplianceRulesToTaxConfigs } from '../accounting/taxRuleToConfig';
import { remapComplianceGlToChart } from './glMap';

/** Load tax configs from compliance JSON files (works in API routes). */
export function taxConfigsFromComplianceCountry(countryCode = 'GH'): TaxConfig[] {
  try {
    // Dynamic import avoids bundling fs into client chunks when tree-shaken
    const { ComplianceDB } = require('../compliance/db') as typeof import('../compliance/db');
    const rules = ComplianceDB.getTaxes(countryCode) as TaxRule[];
    const mapped = mapComplianceRulesToTaxConfigs(rules);
    return getEffectiveTaxConfigs(mapped);
  } catch {
    return taxConfigsFromGhanaTemplate();
  }
}

export type PrismaTaxRow = {
  id: string;
  code?: string | null;
  name: string;
  rate: number | string | { toNumber?: () => number };
  type?: string | null;
  glAccountCode?: string | null;
  isActive?: boolean;
  countryCode?: string | null;
};

function prismaRate(rate: PrismaTaxRow['rate']): number {
  if (typeof rate === 'object' && rate && 'toNumber' in rate && typeof rate.toNumber === 'function') {
    return rate.toNumber();
  }
  return Number(rate);
}

function inferTypeFromName(name: string, explicit?: string | null): TaxConfig['type'] {
  if (explicit) {
    const t = explicit as TaxConfig['type'];
    if (['VAT', 'NHIL', 'GETFund', 'Tourism', 'Withholding', 'COVID19', 'Other'].includes(t)) return t;
  }
  const n = name.toLowerCase();
  if (n.includes('withholding')) return 'Withholding';
  if (n.includes('vat')) return 'VAT';
  if (n.includes('nhil')) return 'NHIL';
  if (n.includes('getfund') || n.includes('get fund')) return 'GETFund';
  if (n.includes('tourism')) return 'Tourism';
  if (n.includes('covid')) return 'COVID19';
  return 'Other';
}

export function mapPrismaTaxRowToConfig(t: PrismaTaxRow, countryCode = 'GH'): TaxConfig {
  const type = inferTypeFromName(t.name, t.type);
  const nonCreditable = type === 'NHIL' || type === 'GETFund' || type === 'Tourism';
  const gl =
    t.glAccountCode?.trim() ||
    (type === 'VAT'
      ? '2110'
      : type === 'NHIL'
        ? '2120'
        : type === 'GETFund'
          ? '2130'
          : type === 'Tourism'
            ? '2150'
            : type === 'Withholding'
              ? '2300'
              : '2110');
  return {
    id: t.id,
    code: t.code || `TCR-${t.id}`,
    name: t.name,
    rate: prismaRate(t.rate),
    type,
    glAccountCode: remapComplianceGlToChart(gl),
    isRecoverable: !nonCreditable && type !== 'Withholding',
    isActive: t.isActive !== false,
    effectiveFrom: new Date().toISOString(),
    countryCode: t.countryCode || countryCode,
    applyOnSales: type !== 'Withholding',
    applyOnPurchases: !nonCreditable && type !== 'Withholding',
  };
}

/**
 * Priority: tenant Prisma taxes → compliance JSON → Ghana template.
 */
export function resolveTaxConfigs(options?: {
  countryCode?: string;
  prismaTaxes?: PrismaTaxRow[];
}): TaxConfig[] {
  const country = options?.countryCode ?? 'GH';
  if (options?.prismaTaxes?.length) {
    const mapped = options.prismaTaxes
      .filter((t) => t.isActive !== false)
      .map((t) => mapPrismaTaxRowToConfig(t, country));
    if (mapped.length) return getEffectiveTaxConfigs(mapped);
  }
  return taxConfigsFromComplianceCountry(country);
}
