/**
 * Country compliance file, then the Ghana template.
 * A hotel's own rules are loaded with salesTaxConfigsForTenant.
 */

import type { TaxRule } from '../models';
import type { TaxConfig } from '../accounting/models';
import { taxConfigsFromGhanaTemplate, getEffectiveTaxConfigs } from '../accounting/taxFromConfig';
import { mapComplianceRulesToTaxConfigs } from '../accounting/taxRuleToConfig';

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

/** Country compliance file, then the Ghana template. Tenant rules are loaded by salesTaxConfigsForTenant. */
export function resolveTaxConfigs(options?: { countryCode?: string }): TaxConfig[] {
  return taxConfigsFromComplianceCountry(options?.countryCode ?? 'GH');
}
