import { mapCoaTypeToRollup, syncCoaLegacyFields, migrateCoaParentIds } from './coaTree';
import type { ChartOfAccounts } from './models';
import type { RollupCoa } from './financialReportRollup';

export function codeNum(code: string): number {
  return parseInt((code || '').replace(/\D/g, '') || '0', 10);
}

/** Ensure rollup rows carry parentId links for tree building. */
export function enrichRollupCoaParents(accounts: RollupCoa[]): RollupCoa[] {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  return accounts.map((acc) => {
    if (!acc.parentId && acc.parentAccount) {
      const parent = byCode.get(acc.parentAccount);
      return { ...acc, parentId: parent?.id ?? null };
    }
    return acc;
  });
}

export function toRollupCoa(
  accounts: Array<{
    id?: string;
    code: string;
    name: string;
    type: string;
    category?: string;
    level: number;
    parentId?: string | null;
    parentAccount?: string;
  }>
): RollupCoa[] {
  const normalized = syncCoaLegacyFields(
    migrateCoaParentIds(
      accounts.map((a, i) => ({
        id: a.id ?? `rollup-${i}`,
        name: a.name,
        type: a.type as ChartOfAccounts['type'],
        parentId: a.parentId ?? null,
        position: 0,
        code: a.code,
        level: a.level,
        parentAccount: a.parentAccount,
        category: a.category ?? a.type,
        isActive: true,
        currency: 'GHS',
        createdAt: '',
        updatedAt: '',
      }))
    )
  );

  const mapped: RollupCoa[] = normalized.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: mapCoaTypeToRollup(a.type),
    category: a.category,
    level: a.level,
    parentId: a.parentId,
    parentAccount: a.parentAccount,
  }));
  return enrichRollupCoaParents(mapped);
}

export function verifyCoaHierarchy(accounts: ChartOfAccounts[]): string[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const errors: string[] = [];

  for (const acc of accounts) {
    if (!acc.parentId) continue;
    const parent = byId.get(acc.parentId);
    if (!parent) {
      errors.push(`${acc.name}: parent id ${acc.parentId} not found`);
      continue;
    }
    if (parent.id === acc.id) {
      errors.push(`${acc.name}: cannot be its own parent`);
    }
  }

  return errors;
}

// Legacy exports kept for any remaining imports
export function hasChildAccounts(parentId: string, allAccounts: ChartOfAccounts[]): boolean {
  return allAccounts.some((a) => a.parentId === parentId);
}

export function getParentDisplayName(
  parentId: string | null | undefined,
  allAccounts: ChartOfAccounts[]
): string {
  if (!parentId) return '—';
  const p = allAccounts.find((a) => a.id === parentId);
  return p ? p.name : parentId;
}
