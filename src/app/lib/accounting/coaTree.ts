import type { ChartOfAccounts, CoaAccountType, CoaTreeNode } from './models';

export function mapCoaTypeToCategory(type: CoaAccountType): string {
  if (type === 'Cost of Sales') return 'Cost of Sales';
  if (type === 'Operating Expense' || type === 'Expense') return 'Operating Expenses';
  if (type === 'Contra') return 'Contra';
  return type;
}

/** Map tree types to legacy five-type rollups used by financial statements. */
export function mapCoaTypeToRollup(
  type: CoaAccountType
): 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense' {
  if (type === 'Asset' || type === 'Contra') return 'Asset';
  if (type === 'Liability') return 'Liability';
  if (type === 'Equity') return 'Equity';
  if (type === 'Revenue') return 'Revenue';
  return 'Expense';
}

export function computeCoaDepth(
  accountId: string,
  byId: Map<string, ChartOfAccounts>,
  memo = new Map<string, number>()
): number {
  if (memo.has(accountId)) return memo.get(accountId)!;
  const acc = byId.get(accountId);
  if (!acc || !acc.parentId) {
    memo.set(accountId, 1);
    return 1;
  }
  const depth = computeCoaDepth(acc.parentId, byId, memo) + 1;
  memo.set(accountId, depth);
  return depth;
}

/** Sync level, parentAccount (code), and category from parentId tree. */
export function syncCoaLegacyFields(accounts: ChartOfAccounts[]): ChartOfAccounts[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return accounts.map((acc) => {
    const level = computeCoaDepth(acc.id, byId);
    const parent = acc.parentId ? byId.get(acc.parentId) : undefined;
    return {
      ...acc,
      level,
      parentAccount: parent?.code,
      category: acc.category || mapCoaTypeToCategory(acc.type),
    };
  });
}

export function buildCoaTree(accounts: ChartOfAccounts[]): CoaTreeNode[] {
  const synced = syncCoaLegacyFields(accounts);
  const byParent = new Map<string | null, ChartOfAccounts[]>();

  for (const acc of synced) {
    const key = acc.parentId ?? null;
    const bucket = byParent.get(key) ?? [];
    bucket.push(acc);
    byParent.set(key, bucket);
  }

  const attach = (parentId: string | null): CoaTreeNode[] => {
    const siblings = (byParent.get(parentId) ?? []).sort((a, b) => a.position - b.position);
    return siblings.map((acc) => ({
      ...acc,
      children: attach(acc.id),
    }));
  };

  return attach(null);
}

export function getCoaSiblings(parentId: string | null, accounts: ChartOfAccounts[]): ChartOfAccounts[] {
  return accounts
    .filter((a) => (a.parentId ?? null) === parentId)
    .sort((a, b) => a.position - b.position);
}

export function collectDescendantIds(rootId: string, accounts: ChartOfAccounts[]): string[] {
  const ids: string[] = [];
  const walk = (parentId: string) => {
    for (const child of accounts.filter((a) => a.parentId === parentId)) {
      ids.push(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return ids;
}

export function hasCoaChildren(accountId: string, accounts: ChartOfAccounts[]): boolean {
  return accounts.some((a) => a.parentId === accountId);
}

let codeCounter = 0;

export function generateCoaCode(type: CoaAccountType, existing: ChartOfAccounts[]): string {
  const prefix =
    type === 'Asset' || type === 'Contra'
      ? '1'
      : type === 'Liability'
        ? '2'
        : type === 'Equity'
          ? '3'
          : type === 'Revenue'
            ? '4'
            : '5';
  const used = new Set(existing.map((a) => a.code));
  let n = existing.filter((a) => a.code.startsWith(prefix)).length + 1;
  let code = `${prefix}${String(n).padStart(4, '0')}`;
  while (used.has(code)) {
    n += 1;
    code = `${prefix}${String(n).padStart(4, '0')}`;
  }
  codeCounter += 1;
  return code;
}

export function createCoaAccount(params: {
  name: string;
  type: CoaAccountType;
  parentId: string | null;
  position: number;
  existing: ChartOfAccounts[];
  currency?: string;
  code?: string;
}): ChartOfAccounts {
  const ts = new Date().toISOString();
  const id = `coa-${Date.now()}-${++codeCounter}`;
  const trimmedCode = params.code?.trim();
  if (trimmedCode && params.existing.some((a) => a.code === trimmedCode)) {
    throw new Error(`Account code ${trimmedCode} already exists`);
  }
  const account: ChartOfAccounts = {
    id,
    name: params.name.trim(),
    type: params.type,
    parentId: params.parentId,
    position: params.position,
    code: trimmedCode || generateCoaCode(params.type, params.existing),
    level: 1,
    category: mapCoaTypeToCategory(params.type),
    isActive: true,
    currency: params.currency ?? 'GHS',
    createdAt: ts,
    updatedAt: ts,
  };
  return syncCoaLegacyFields([...params.existing, account]).find((a) => a.id === id)!;
}

export function validateCoaTreeAccount(
  account: Pick<ChartOfAccounts, 'id' | 'name' | 'parentId'>,
  allAccounts: ChartOfAccounts[]
): string[] {
  const errors: string[] = [];
  if (!account.name?.trim()) errors.push('Account name is required');
  if (account.parentId) {
    const parent = allAccounts.find((a) => a.id === account.parentId);
    if (!parent) errors.push('Parent account not found');
    if (account.parentId === account.id) errors.push('An account cannot be its own parent');
  }
  return errors;
}

export function subtreeMatchesFilter(
  node: CoaTreeNode,
  query: string,
  typeFilter: string
): boolean {
  const q = query.trim().toLowerCase();
  const textMatch =
    !q ||
    node.name.toLowerCase().includes(q) ||
    node.code.toLowerCase().includes(q);
  const typeMatch = !typeFilter || typeFilter === 'all' || node.type === typeFilter;
  if (textMatch && typeMatch) return true;
  return node.children.some((c) => subtreeMatchesFilter(c, query, typeFilter));
}

export function normalizeCoaList(accounts: ChartOfAccounts[]): ChartOfAccounts[] {
  return syncCoaLegacyFields(
    accounts.map((a) => ({
      ...a,
      parentId: a.parentId ?? null,
      position: a.position ?? 0,
      type: a.type === 'Expense' ? 'Operating Expense' : a.type,
    }))
  );
}

function codeNum(code: string): number {
  return parseInt((code || '').replace(/\D/g, '') || '0', 10);
}

/** Infer parent code for legacy numbered COA (Ghana GL template). */
function inferLegacyParentCode(
  child: Pick<ChartOfAccounts, 'code' | 'level'>,
  allAccounts: Pick<ChartOfAccounts, 'code' | 'level'>[]
): string | undefined {
  if (child.level <= 1) return undefined;
  const childNum = codeNum(child.code);
  const candidates = allAccounts.filter(
    (a) => a.code !== child.code && a.level === child.level - 1 && codeNum(a.code) < childNum
  );
  if (!candidates.length) return undefined;
  candidates.sort((a, b) => codeNum(b.code) - codeNum(a.code));
  return candidates[0].code;
}

/** Migrate legacy code-based parentAccount links to parentId. */
export function migrateCoaParentIds(accounts: ChartOfAccounts[]): ChartOfAccounts[] {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  return accounts.map((acc) => {
    if (acc.parentId) return acc;
    let parentCode = acc.parentAccount;
    if (!parentCode && acc.level > 1) {
      parentCode = inferLegacyParentCode(acc, accounts);
    }
    if (!parentCode) return { ...acc, parentId: null };
    const parent = byCode.get(parentCode);
    return { ...acc, parentId: parent?.id ?? null, parentAccount: parentCode };
  });
}
