/**
 * Bring a business's saved chart of accounts up to date with the standard template:
 * accounts added to the template later (e.g. Non-Current Liabilities, Guest Deposits)
 * are added, and a standard heading still carrying its old default name is renamed.
 * Nothing the business added or renamed itself is touched, and nothing is removed.
 */

import type { ChartOfAccounts } from './models';

/** Standard headings renamed in the template: code → the old default name. */
const RENAMED_DEFAULTS: Record<string, string> = {
  '1500': 'Fixed Assets',
};

/** Old category labels that now read differently on reports. */
const RENAMED_CATEGORIES: Record<string, string> = {
  'Fixed Assets': 'Non-Current Assets',
};

export type CoaTemplateSyncResult = {
  accounts: ChartOfAccounts[];
  /** Accounts to save: newly added, or renamed from an old default. */
  changed: Array<{ account: ChartOfAccounts; parentCode: string | null }>;
};

export function syncChartWithTemplate(existing: ChartOfAccounts[], template: ChartOfAccounts[]): CoaTemplateSyncResult {
  const byCode = new Map(existing.map((a) => [a.code, a]));
  const templateCodeById = new Map(template.map((a) => [a.id, a.code]));
  const changed: CoaTemplateSyncResult['changed'] = [];
  const parentCodeOf = (acc: ChartOfAccounts, list: Map<string, ChartOfAccounts>) => {
    if (acc.parentAccount) return acc.parentAccount;
    if (!acc.parentId) return null;
    for (const a of list.values()) if (a.id === acc.parentId) return a.code;
    return null;
  };

  let accounts = existing.map((acc) => {
    const category = RENAMED_CATEGORIES[acc.category] ?? acc.category;
    const tpl = template.find((t) => t.code === acc.code);
    const oldName = RENAMED_DEFAULTS[acc.code];
    if (tpl && oldName && acc.name === oldName) {
      const renamed = { ...acc, name: tpl.name, category: tpl.category, updatedAt: new Date().toISOString() };
      changed.push({ account: renamed, parentCode: parentCodeOf(acc, byCode) });
      return renamed;
    }
    return category === acc.category ? acc : { ...acc, category };
  });

  // Template rows are in code order, so a new heading is added before its new children.
  for (const tpl of [...template].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))) {
    if (byCode.has(tpl.code)) continue;
    const parentCode = tpl.parentId ? templateCodeById.get(tpl.parentId) ?? null : null;
    const parent = parentCode ? byCode.get(parentCode) : undefined;
    const added: ChartOfAccounts = {
      ...tpl,
      parentId: parent?.id ?? null,
      parentAccount: parentCode ?? undefined,
    };
    accounts = [...accounts, added];
    byCode.set(added.code, added);
    changed.push({ account: added, parentCode });
  }

  return { accounts, changed };
}
