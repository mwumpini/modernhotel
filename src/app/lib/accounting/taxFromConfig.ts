/**
 * Tax amounts + GL accounts from `TaxConfig[]` (store / settings).
 *
 * Basis: VAT, NHIL, GETFund, Tourism (and any "Other") are each computed
 * independently on the plain tax-exclusive base — none of them feed into
 * another's base. This matches the Value Added Tax Act, 2025 (Act 1151,
 * effective 1 Jan 2026), which recoupled NHIL/GETFund with VAT onto one flat
 * base and scrapped the old cascading calculation (NHIL+GETFund+COVID added
 * to the price first, VAT then charged on top of that). A ₵1,000 taxable
 * sale now produces VAT 150 + NHIL 25 + GETFund 25 = ₵200 tax, not the old
 * cascaded ~₵206. The Tourism Development Levy was never part of the VAT
 * base even under the old law (Tourism Levy Regulations 2012, L.I. 2185 —
 * calculated on the VAT-exclusive net price, remitted to the Ghana Tourism
 * Authority, not GRA) — it was already meant to be independent; this fixes
 * a pre-existing bug where this file folded it in alongside NHIL/GETFund.
 * The COVID-19 Health Recovery Levy was abolished by the same Act; its
 * template rate is already 0 (see GHANA_TAX_CODES in models.ts).
 * Withholding is excluded from automatic stacks unless you add dedicated flows.
 */

import type { TaxConfig } from './models';
import { GHANA_TAX_CODES } from './models';
import { useSettingsStore } from '../settings/store';

/** Setup > Rounding Rule (defaults to 'nearest' outside the browser or before it's set). */
function getRoundingRule(): 'nearest' | 'up' | 'down' {
  try {
    return useSettingsStore.getState().financialSettings?.roundingRule || 'nearest';
  } catch {
    return 'nearest';
  }
}

export function roundMoney2(n: number): number {
  const rule = getRoundingRule();
  if (rule === 'up') return Math.ceil(n * 100 - Number.EPSILON) / 100;
  if (rule === 'down') return Math.floor(n * 100 + Number.EPSILON) / 100;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Cash-rounding for a folio/invoice grand total — Setup/Settings "Round Total To
 * Nearest" (e.g. 0.50) applied in the same direction as the Rounding Rule. Tax
 * lines stay exact; callers post the gap as a separate rounding-adjustment GL line
 * so debits still equal credits (see postGuestFolioCheckoutToLedger).
 */
export function roundToIncrement(amount: number): number {
  let increment = 0;
  try {
    increment = Number(useSettingsStore.getState().financialSettings?.roundToNearest) || 0;
  } catch {
    increment = 0;
  }
  if (!(increment > 0)) return roundMoney2(amount);

  const rule = getRoundingRule();
  const units = amount / increment;
  let roundedUnits: number;
  if (rule === 'up') roundedUnits = Math.ceil(units - 1e-9);
  else if (rule === 'down') roundedUnits = Math.floor(units + 1e-9);
  else roundedUnits = Math.round(units + 1e-9);
  return roundMoney2(roundedUnits * increment);
}

export type StackedTaxLine = {
  taxCode: string;
  name: string;
  type: TaxConfig['type'];
  rate: number;
  amount: number;
  glAccountCode: string;
};

export type TaxStackContext = 'sales' | 'purchase';

function defaultStackOrder(type: TaxConfig['type']): number {
  switch (type) {
    case 'NHIL':
      return 10;
    case 'GETFund':
      return 20;
    case 'Tourism':
      return 30;
    case 'COVID19':
      return 40;
    case 'Other':
      return 50;
    case 'VAT':
      return 100;
    default:
      return 200;
  }
}

function stackOrder(c: TaxConfig): number {
  return c.purchaseStackOrder ?? defaultStackOrder(c.type);
}

/** Country bootstrap before compliance tax-rule sync runs. */
export function bootstrapTaxConfigsForCountry(countryCode: string): TaxConfig[] {
  const code = (countryCode || 'GH').toUpperCase();
  if (code === 'GH') return taxConfigsFromGhanaTemplate();
  // Future countries: return [] and rely on compliance → accounting sync.
  return [];
}

/** Seed `TaxConfig[]` when the store has not run `initializeAccounting` yet. */
export function taxConfigsFromGhanaTemplate(): TaxConfig[] {
  const entries = Object.entries(GHANA_TAX_CODES) as [keyof typeof GHANA_TAX_CODES, (typeof GHANA_TAX_CODES)['VAT']][];
  return entries.map(([key, tax], index) => {
    const type: TaxConfig['type'] =
      key === 'GETFUND'
        ? 'GETFund'
        : key === 'COVID19'
          ? 'COVID19'
          : key === 'TOURISM'
            ? 'Tourism'
            : key === 'WITHHOLDING' || key === 'WHT_CERT' || key === 'WHT_VAT_CERT'
              ? 'Withholding'
              : key === 'VAT'
                ? 'VAT'
                : key === 'NHIL'
                  ? 'NHIL'
                  : 'Other';
    // NHIL, GETFund and Tourism are non-creditable — businesses cannot claim input tax
    // relief on them. They appear on sales invoices but are a cost (not recoverable) on purchases.
    const nonCreditable = type === 'NHIL' || type === 'GETFund' || type === 'Tourism';
    const applyOnPurchases = !nonCreditable && type !== 'Withholding';
    const applyOnSales = type !== 'Withholding';
    return {
      id: String(index + 1),
      code: tax.code,
      name: tax.name,
      rate: tax.rate,
      type,
      glAccountCode: tax.glCode,
      isRecoverable: !nonCreditable && type !== 'Withholding',
      isActive: tax.rate > 0 || type === 'COVID19',
      effectiveFrom: new Date().toISOString(),
      countryCode: 'GH',
      purchaseStackOrder: defaultStackOrder(type),
      applyOnPurchases,
      applyOnSales,
    };
  });
}

function passesContextFilters(c: TaxConfig, context: TaxStackContext): boolean {
  if (!c.isActive || c.rate <= 0) return false;
  if (c.type === 'Withholding') return false;
  if (context === 'purchase') {
    if (c.applyOnPurchases === false) return false;
    if (!c.isRecoverable) return false;
  } else {
    if (c.applyOnSales === false) return false;
  }
  return true;
}

/**
 * Compute stacked tax lines from active configs.
 * @param targetTotalTax If set, scales pre-VAT lines then sets VAT (or last slice) so the sum matches.
 */
export function computeStackedTaxLines(
  exclusiveAmount: number,
  configs: TaxConfig[],
  context: TaxStackContext,
  targetTotalTax?: number
): { lines: StackedTaxLine[]; totalTax: number; gross: number } {
  const net = Math.max(0, exclusiveAmount);
  const pool = configs.filter((c) => passesContextFilters(c, context));
  const preVat = pool.filter((c) => c.type !== 'VAT').sort((a, b) => stackOrder(a) - stackOrder(b));
  const vatCfg = pool.find((c) => c.type === 'VAT');

  const buildRawLines = (): StackedTaxLine[] => {
    const out: StackedTaxLine[] = [];
    // NHIL/GETFund/Tourism/Other each apply to the plain net amount — none of
    // them compound into another's base (see file header: Act 1151 recoupled
    // NHIL/GETFund onto VAT's own flat base; Tourism was always independent).
    for (const c of preVat) {
      const amount = roundMoney2(net * (c.rate / 100));
      if (amount <= 0) continue;
      out.push({
        taxCode: c.code,
        name: c.name,
        type: c.type,
        rate: c.rate,
        amount,
        glAccountCode: c.glAccountCode,
      });
    }
    if (vatCfg) {
      const vatAmt = roundMoney2(net * (vatCfg.rate / 100));
      if (vatAmt > 0) {
        out.push({
          taxCode: vatCfg.code,
          name: vatCfg.name,
          type: 'VAT',
          rate: vatCfg.rate,
          amount: vatAmt,
          glAccountCode: vatCfg.glAccountCode,
        });
      }
    }
    return out;
  };

  let lines = buildRawLines();
  let totalTax = roundMoney2(lines.reduce((s, l) => s + l.amount, 0));

  if (targetTotalTax !== undefined && targetTotalTax <= 0) {
    return { lines: [], totalTax: 0, gross: net };
  }

  if (
    targetTotalTax !== undefined &&
    targetTotalTax > 0 &&
    totalTax > 0 &&
    Math.abs(targetTotalTax - totalTax) > 0.005
  ) {
    const scale = targetTotalTax / totalTax;
    const preLines = lines.filter((l) => l.type !== 'VAT');
    const vatLine = lines.find((l) => l.type === 'VAT');
    const scaledPre = preLines.map((l) => ({ ...l, amount: roundMoney2(l.amount * scale) }));
    const preScaledSum = roundMoney2(scaledPre.reduce((s, l) => s + l.amount, 0));
    const vatAmt = vatLine ? Math.max(0, roundMoney2(targetTotalTax - preScaledSum)) : 0;
    lines = [...scaledPre];
    if (vatLine && vatAmt > 0) {
      lines.push({ ...vatLine, amount: vatAmt });
    } else if (!vatLine && targetTotalTax > preScaledSum) {
      const v = configs.find((c) => c.type === 'VAT' && c.isActive);
      if (v) {
        lines.push({
          taxCode: v.code,
          name: v.name,
          type: 'VAT',
          rate: v.rate,
          amount: roundMoney2(targetTotalTax - preScaledSum),
          glAccountCode: v.glAccountCode,
        });
      }
    }
    totalTax = roundMoney2(lines.reduce((s, l) => s + l.amount, 0));
  } else if (targetTotalTax !== undefined && targetTotalTax > 0 && totalTax <= 0) {
    const v = configs.find((c) => c.type === 'VAT' && c.isActive && (context === 'sales' || c.isRecoverable));
    if (v) {
      lines = [
        {
          taxCode: v.code,
          name: v.name,
          type: 'VAT',
          rate: v.rate,
          amount: roundMoney2(targetTotalTax),
          glAccountCode: v.glAccountCode,
        },
      ];
      totalTax = roundMoney2(targetTotalTax);
    }
  }

  return { lines, totalTax, gross: roundMoney2(net + totalTax) };
}

/** Use store configs when initialized; otherwise Ghana template (matches `initializeAccounting` seed). */
export function getEffectiveTaxConfigs(configs: TaxConfig[]): TaxConfig[] {
  return configs.length > 0 ? configs : taxConfigsFromGhanaTemplate();
}
