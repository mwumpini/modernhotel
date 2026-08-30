/**
 * System default chart of accounts — Ghana hotel GL with coded main / sub / detail levels.
 * Shipped prebuilt; users may keep, delete, or extend via the tree UI.
 */

import { migrateCoaParentIds, normalizeCoaList } from './coaTree';
import { GHANA_CHART_OF_ACCOUNTS } from './models';
import type { ChartOfAccounts, CoaAccountType } from './models';

type CoaTemplateRow = (typeof GHANA_CHART_OF_ACCOUNTS)[number];

const PREBUILT_BY_COUNTRY: Record<string, { countryCode: string; currency: string; rows: CoaTemplateRow[] }> = {
  GH: { countryCode: 'GH', currency: 'GHS', rows: GHANA_CHART_OF_ACCOUNTS },
};

function codeNum(code: string): number {
  return parseInt((code || '').replace(/\D/g, '') || '0', 10);
}

function mapTemplateType(raw: string): CoaAccountType {
  if (raw === 'Expense') return 'Operating Expense';
  return raw as CoaAccountType;
}

function recalcSiblingPositions(accounts: ChartOfAccounts[]): ChartOfAccounts[] {
  const byId = new Map(accounts.map((a) => [a.id, { ...a }]));
  const byParent = new Map<string | null, ChartOfAccounts[]>();

  for (const acc of accounts) {
    const key = acc.parentId ?? null;
    const bucket = byParent.get(key) ?? [];
    bucket.push(acc);
    byParent.set(key, bucket);
  }

  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => codeNum(a.code) - codeNum(b.code));
    siblings.forEach((acc, index) => {
      byId.set(acc.id, { ...byId.get(acc.id)!, position: index });
    });
  }

  return Array.from(byId.values());
}

function rowsToChartOfAccounts(
  rows: CoaTemplateRow[],
  countryCode: string,
  currency: string
): ChartOfAccounts[] {
  const ts = new Date().toISOString();
  const draft: ChartOfAccounts[] = rows.map((row) => ({
    id: `${countryCode.toLowerCase()}-coa-${row.code}`,
    code: row.code,
    name: row.name,
    type: mapTemplateType(row.type),
    parentId: null,
    position: 0,
    level: row.level,
    category: row.category,
    description: 'description' in row ? (row as { description?: string }).description : undefined,
    isActive: true,
    currency,
    createdAt: ts,
    updatedAt: ts,
  }));

  return normalizeCoaList(recalcSiblingPositions(migrateCoaParentIds(draft)));
}

/** Full prebuilt COA for the tenant country (default: Ghana hotel GL). */
export function buildPrebuiltChartOfAccounts(countryCode?: string): ChartOfAccounts[] {
  const code = (countryCode ?? 'GH').toUpperCase();
  const tpl = PREBUILT_BY_COUNTRY[code] ?? PREBUILT_BY_COUNTRY.GH;
  return rowsToChartOfAccounts(tpl.rows, tpl.countryCode, tpl.currency);
}

/** Level label for UI: main (1), sub (2), detail (3+). */
export function coaLevelLabel(level: number): string {
  if (level <= 1) return 'Main';
  if (level === 2) return 'Sub';
  return 'Detail';
}
