/**
 * Pure TaxRule → TaxConfig mapping (no accounting store — safe for client/server import).
 */

import type { TaxRule } from '../models';
import type { TaxConfig } from './models';
import { remapComplianceGlToChart } from '../tax/glMap';

export function taxRuleEligibleForAccountingSync(rule: TaxRule): boolean {
  if (!rule?.id || !String(rule.glCode || '').trim()) return false;
  const method = rule.method || 'rate';
  if (method !== 'rate') return false;
  const domain = rule.domain || 'sales';
  if (domain === 'payroll' || domain === 'corporate') return false;
  const effect = rule.effect || 'add';
  if (effect === 'informational' || effect === 'exclude_total') return false;
  return true;
}

function inferTaxType(rule: TaxRule): TaxConfig['type'] {
  if (rule.calculationBase === 'subtotal_plus_applied') return 'VAT';
  const n = String(rule.name || '').toLowerCase();
  if (n.includes('withholding')) return 'Withholding';
  if (n.includes('vat')) return 'VAT';
  if (n.includes('nhil')) return 'NHIL';
  if (n.includes('getfund') || n.includes('get fund')) return 'GETFund';
  if (n.includes('tourism')) return 'Tourism';
  if (n.includes('covid')) return 'COVID19';
  return 'Other';
}

/** NHIL, GETFund and Tourism are output-only levies — no input tax relief on purchases,
 *  matching GHANA_TAX_CODES / taxConfigsFromGhanaTemplate's documented creditability model. */
function isNonCreditableLevy(type: TaxConfig['type']): boolean {
  return type === 'NHIL' || type === 'GETFund' || type === 'Tourism';
}

function mapApplyFlags(rule: TaxRule, type: TaxConfig['type']): Pick<TaxConfig, 'applyOnPurchases' | 'applyOnSales'> {
  if (type === 'Withholding') {
    return { applyOnPurchases: false, applyOnSales: false };
  }
  // VAT is charged — and reclaimable as input tax — on both sales and purchases, regardless
  // of which domain the rule itself is scoped to (the compliance engine only has one VAT
  // rule, tagged domain:'sales' for guest-billing purposes; that tag doesn't mean VAT is
  // absent from supplier invoices).
  if (type === 'VAT') {
    return { applyOnPurchases: true, applyOnSales: true };
  }
  if (isNonCreditableLevy(type)) {
    return { applyOnPurchases: false, applyOnSales: true };
  }
  const domain = rule.domain || 'sales';
  if (domain === 'purchases') {
    return { applyOnPurchases: true, applyOnSales: false };
  }
  if (domain === 'sales') {
    return { applyOnPurchases: false, applyOnSales: true };
  }
  return { applyOnPurchases: true, applyOnSales: true };
}

export function mapRuleToTaxConfig(rule: TaxRule): TaxConfig {
  const type = inferTaxType(rule);
  const { applyOnPurchases, applyOnSales } = mapApplyFlags(rule, type);
  let isRecoverable = type !== 'Withholding' && !isNonCreditableLevy(type);
  if (rule.domain === 'purchases') isRecoverable = true;

  return {
    id: rule.id,
    code: `TCR-${rule.id}`,
    name: rule.name,
    rate: rule.rate,
    type,
    glAccountCode: remapComplianceGlToChart(String(rule.glCode).trim()),
    isRecoverable,
    isActive: rule.enabled !== false,
    effectiveFrom: rule.effectiveFrom || new Date().toISOString(),
    effectiveTo: rule.effectiveTo,
    countryCode: rule.countryCode,
    purchaseStackOrder: rule.priority ?? undefined,
    applyOnPurchases,
    applyOnSales,
  };
}

export function mapComplianceRulesToTaxConfigs(rules: TaxRule[]): TaxConfig[] {
  return rules.filter(taxRuleEligibleForAccountingSync).map(mapRuleToTaxConfig);
}
