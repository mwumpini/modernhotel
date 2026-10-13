import type { TaxConfig } from '../accounting/models';
import { getEffectiveTaxConfigs } from '../accounting/taxFromConfig';
import { mapComplianceRulesToTaxConfigs } from '../accounting/taxRuleToConfig';
import { listTaxRules } from '../compliance/repository';
import type { TaxRule } from '../models';
import { resolveTaxConfigs } from './resolveConfigs';

/** Sales tax for a saved bill: the hotel's Compliance rules, then the country file, then the Ghana template. */
export async function salesTaxConfigsForTenant(tenantId: string, countryCode = 'GH'): Promise<TaxConfig[]> {
  try {
    const rules = await listTaxRules(tenantId, countryCode);
    const mapped = mapComplianceRulesToTaxConfigs(rules as TaxRule[]);
    if (mapped.length) return getEffectiveTaxConfigs(mapped);
  } catch {
    /* country file / template */
  }
  return resolveTaxConfigs({ countryCode });
}
