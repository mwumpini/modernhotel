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

/** Fallback when a rule has no explicit `isRecoverable` yet (legacy seeds / unedited rules). */
function isNonCreditableLevy(type: TaxConfig['type']): boolean {
  return type === 'NHIL' || type === 'GETFund' || type === 'Tourism';
}

function defaultIsRecoverable(rule: TaxRule, type: TaxConfig['type']): boolean {
  if (type === 'Withholding') return false;
  if (type === 'VAT') return true;
  if (isNonCreditableLevy(type)) return false;
  // Purchase-domain rates (other than WHT) default to claimable input.
  return (rule.domain || 'sales') === 'purchases';
}

function resolveIsRecoverable(rule: TaxRule, type: TaxConfig['type']): boolean {
  if (type === 'Withholding') return false;
  if (typeof rule.isRecoverable === 'boolean') return rule.isRecoverable;
  return defaultIsRecoverable(rule, type);
}

function mapApplyFlags(
  rule: TaxRule,
  type: TaxConfig['type'],
  isRecoverable: boolean,
): Pick<TaxConfig, 'applyOnPurchases' | 'applyOnSales'> {
  if (type === 'Withholding') {
    return { applyOnPurchases: false, applyOnSales: false };
  }
  const domain = rule.domain || 'sales';
  // Claimable taxes enter the purchase/input stack. Sales-domain VAT stays on sales too
  // even when tagged domain:'sales' for guest billing — supplier invoices still carry VAT.
  const applyOnPurchases = isRecoverable;
  const applyOnSales =
    type === 'VAT' || isNonCreditableLevy(type)
      ? true
      : domain !== 'purchases';
  return { applyOnPurchases, applyOnSales };
}

export function mapRuleToTaxConfig(rule: TaxRule): TaxConfig {
  const type = inferTaxType(rule);
  const isRecoverable = resolveIsRecoverable(rule, type);
  const { applyOnPurchases, applyOnSales } = mapApplyFlags(rule, type, isRecoverable);

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
