/**
 * Tax amounts + GL accounts from `TaxConfig[]` (store / settings).
 * Stacking: pre-VAT levies (NHIL, GETFund, Tourism, …) on tax-exclusive base; VAT on (exclusive + sum(pre-VAT)).
 * Withholding is excluded from automatic stacks unless you add dedicated flows.
 */

import type { TaxConfig } from './models';
import { GHANA_TAX_CODES } from './models';

export function roundMoney2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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
    let preSum = 0;
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
      preSum += amount;
    }
    const vatBase = net + preSum;
    if (vatCfg) {
      const vatAmt = roundMoney2(vatBase * (vatCfg.rate / 100));
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

export function resolveTaxGlAccount(configs: TaxConfig[], code: string, fallback: string): string {
  const c = configs.find((t) => t.code === code && t.isActive);
  return (c?.glAccountCode || fallback).trim();
}

/** Use store configs when initialized; otherwise Ghana template (matches `initializeAccounting` seed). */
export function getEffectiveTaxConfigs(configs: TaxConfig[]): TaxConfig[] {
  return configs.length > 0 ? configs : taxConfigsFromGhanaTemplate();
}
