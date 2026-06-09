'use client';

import type { TaxConfig } from '../accounting/models';
import { taxConfigsFromGhanaTemplate, getEffectiveTaxConfigs } from '../accounting/taxFromConfig';

/** Client-only: accounting store configs, else Ghana template. */
export function resolveClientTaxConfigs(
  storeConfigs: TaxConfig[],
  countryCode = 'GH'
): TaxConfig[] {
  const forCountry = storeConfigs.filter((c) => !c.countryCode || c.countryCode === countryCode);
  if (forCountry.length) return getEffectiveTaxConfigs(forCountry);
  return taxConfigsFromGhanaTemplate();
}
