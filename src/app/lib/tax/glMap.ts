/**
 * Canonical tax GL accounts — must match `GHANA_CHART_OF_ACCOUNTS` in accounting/models.ts.
 * Compliance TaxRateBuilder rules are remapped here when syncing to accounting.
 */

import { GHANA_TAX_CODES } from '../accounting/models';

/** Legacy compliance-builder codes → chart leaf accounts.
 *
 *  '2150' is deliberately NOT remapped here even though an older compliance
 *  builder once used it for NHIL: current compliance tax rules (seed-taxes.json
 *  and the live DB) use '2150' as Tourism's own real glCode, matching the
 *  chart directly. Remapping it to NHIL's account caused the Tourism sync to
 *  delete the just-synced NHIL tax config as a false "same GL" conflict (both
 *  ended up with glAccountCode '2120'), while leaving the old template's
 *  Tourism entry (glAccountCode '2150', untouched by the misdirected conflict
 *  check) to survive alongside the new one — NHIL vanishing and Tourism
 *  showing twice on every invoice's tax breakdown. */
export const LEGACY_COMPLIANCE_GL_REMAP: Record<string, string> = {
  '2151': GHANA_TAX_CODES.GETFUND.glCode,   // was GETFund in builder
  '2153': GHANA_TAX_CODES.VAT.glCode,       // was VAT in builder
  '2154': GHANA_TAX_CODES.TOURISM.glCode,   // was Tourism in builder
  '2155': GHANA_TAX_CODES.TOURISM.glCode,   // flat rate placeholder
  '2300': GHANA_TAX_CODES.WITHHOLDING.glCode,
};

export function remapComplianceGlToChart(glCode: string): string {
  const g = String(glCode || '').trim();
  return LEGACY_COMPLIANCE_GL_REMAP[g] || g;
}

/** All tax-related liability GL accounts used for inflow/outflow rollup */
export const TAX_LIABILITY_GL: Record<string, { code: string; name: string; category: 'sales' | 'payroll' | 'withholding' }> = {
  VAT: { code: GHANA_TAX_CODES.VAT.glCode, name: GHANA_TAX_CODES.VAT.name, category: 'sales' },
  NHIL: { code: GHANA_TAX_CODES.NHIL.glCode, name: GHANA_TAX_CODES.NHIL.name, category: 'sales' },
  GETFUND: { code: GHANA_TAX_CODES.GETFUND.glCode, name: GHANA_TAX_CODES.GETFUND.name, category: 'sales' },
  COVID19: { code: GHANA_TAX_CODES.COVID19.glCode, name: GHANA_TAX_CODES.COVID19.name, category: 'sales' },
  TOURISM: { code: GHANA_TAX_CODES.TOURISM.glCode, name: GHANA_TAX_CODES.TOURISM.name, category: 'sales' },
  WHT: { code: GHANA_TAX_CODES.WITHHOLDING.glCode, name: GHANA_TAX_CODES.WITHHOLDING.name, category: 'withholding' },
  PAYE: { code: '2210', name: 'PAYE Payable', category: 'payroll' },
  SSNIT: { code: '2220', name: 'SSNIT & Tier-1 Payable', category: 'payroll' },
};

export const ALL_TAX_GL_CODES = new Set(Object.values(TAX_LIABILITY_GL).map((t) => t.code));

export function taxCodeForGl(gl: string): string | undefined {
  const entry = Object.entries(TAX_LIABILITY_GL).find(([, v]) => v.code === gl);
  return entry?.[0];
}

/** TAX_LIABILITY_GL keys that have their own statutory filing schedule (see
 * compliance/config/seed-reports.json's `reportType`) — used to auto-mark a filing as
 * submitted when its remittance posts. GETFUND and COVID19 are administratively bundled
 * into the VAT return and have no schedule of their own, so they're deliberately absent. */
export const TAX_CODE_TO_REPORT_TYPE: Record<string, string> = {
  VAT: 'VAT',
  NHIL: 'NHIL',
  TOURISM: 'Tourism',
  WHT: 'WHT',
  PAYE: 'PAYE',
  SSNIT: 'SSNIT',
};
