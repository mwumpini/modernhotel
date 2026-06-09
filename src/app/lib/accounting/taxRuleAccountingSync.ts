/**
 * Compliance TaxRule → accounting store TaxConfig sync (uses store — import dynamically from compliance store).
 */

import type { TaxRule } from '../models';
import { remapComplianceGlToChart } from '../tax/glMap';
import { useAccountingStore } from './store';
import {
  mapRuleToTaxConfig,
  mapComplianceRulesToTaxConfigs,
  taxRuleEligibleForAccountingSync,
} from './taxRuleToConfig';

export { mapComplianceRulesToTaxConfigs, taxRuleEligibleForAccountingSync } from './taxRuleToConfig';

export function chartHasGlCode(chart: { code: string }[], glCode: string): boolean {
  const g = String(glCode || '').trim();
  if (!g) return false;
  return chart.some((a) => String(a.code).trim() === g);
}

function normalizeRuleFromApi(raw: unknown): TaxRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.countryCode !== 'string' || typeof o.name !== 'string') return null;
  if (typeof o.rate !== 'number' || typeof o.glCode !== 'string') return null;
  return {
    id: o.id,
    countryCode: o.countryCode,
    name: o.name,
    typeId: typeof o.typeId === 'string' ? o.typeId : undefined,
    rate: o.rate,
    glCode: o.glCode,
    description: typeof o.description === 'string' ? o.description : undefined,
    appliesTo: Array.isArray(o.appliesTo) ? (o.appliesTo as string[]) : undefined,
    enabled: o.enabled !== false,
    priority: typeof o.priority === 'number' ? o.priority : undefined,
    calculationBase: o.calculationBase as TaxRule['calculationBase'],
    method: o.method as TaxRule['method'],
    fixedAmount: typeof o.fixedAmount === 'number' ? o.fixedAmount : undefined,
    tiers: o.tiers as TaxRule['tiers'],
    stacking: o.stacking as TaxRule['stacking'],
    rounding: o.rounding as TaxRule['rounding'],
    roundTo: typeof o.roundTo === 'number' ? o.roundTo : undefined,
    effectiveFrom: typeof o.effectiveFrom === 'string' ? o.effectiveFrom : undefined,
    effectiveTo: typeof o.effectiveTo === 'string' ? o.effectiveTo : undefined,
    domain: o.domain as TaxRule['domain'],
    operation: o.operation as TaxRule['operation'],
    effect: o.effect as TaxRule['effect'],
    tags: Array.isArray(o.tags) ? (o.tags as string[]) : undefined,
  };
}

export type TaxAccountingSyncResult =
  | { ok: true; mode: 'upserted' | 'skipped' }
  | { ok: false; error: string };

export function syncTaxRuleToAccounting(rule: TaxRule): TaxAccountingSyncResult {
  if (!taxRuleEligibleForAccountingSync(rule)) {
    return { ok: true, mode: 'skipped' };
  }

  const gl = remapComplianceGlToChart(String(rule.glCode).trim());
  const cc = rule.countryCode;
  const store = useAccountingStore.getState();

  if (!chartHasGlCode(store.chartOfAccounts, gl)) {
    return {
      ok: false,
      error: `GL "${gl}" is not on the chart of accounts. Add the account (or run Initialize Accounting) so this tax can post to the ledger.`,
    };
  }

  let s = useAccountingStore.getState();
  const conflicts = s.taxConfigs.filter(
    (t) => t.glAccountCode === gl && t.countryCode === cc && t.id !== rule.id
  );
  for (const t of conflicts) {
    s.deleteTaxConfig(t.id);
    s = useAccountingStore.getState();
  }

  const payload = mapRuleToTaxConfig(rule);
  const exists = useAccountingStore.getState().taxConfigs.some((t) => t.id === rule.id);
  if (exists) {
    useAccountingStore.getState().updateTaxConfig(rule.id, payload);
  } else {
    useAccountingStore.getState().addTaxConfig(payload);
  }

  return { ok: true, mode: 'upserted' };
}

export function removeTaxRuleFromAccounting(ruleId: string): void {
  const s = useAccountingStore.getState();
  if (s.taxConfigs.some((t) => t.id === ruleId)) {
    s.deleteTaxConfig(ruleId);
  }
}

export function syncTaxRuleFromApiResponse(body: unknown): TaxAccountingSyncResult {
  const rule = normalizeRuleFromApi(body);
  if (!rule) return { ok: false, error: 'Invalid tax rule response from server.' };
  return syncTaxRuleToAccounting(rule);
}

export function resyncCountryTaxRulesToAccounting(rules: TaxRule[], countryCode: string): string[] {
  const errors: string[] = [];
  for (const r of rules) {
    if (r.countryCode !== countryCode) continue;
    const res = syncTaxRuleToAccounting(r);
    if (!res.ok && res.error) errors.push(`${r.name}: ${res.error}`);
  }
  return errors;
}
