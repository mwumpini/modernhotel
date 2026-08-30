import type { AccountType, PrismaClient } from '@prisma/client';
import { normalizeCoaList } from './coaTree';
import type { ChartOfAccounts } from './models';

export type SeedCoaRow = {
  code: string;
  name: string;
  type: ChartOfAccounts['type'];
  category?: string;
  level: number;
  parentId?: string | null;
  position?: number;
};

/**
 * Idempotent two-pass COA seed: create accounts, then wire parentId from resolved links.
 */
export async function seedChartOfAccountsForTenant(
  prisma: PrismaClient,
  tenantId: string,
  rows: SeedCoaRow[],
  typeMap: Record<string, AccountType>
): Promise<number> {
  const ts = new Date().toISOString();
  const coaRows: ChartOfAccounts[] = rows.map((row, index) => ({
    id: `seed-${tenantId}-${row.code}`,
    code: row.code,
    name: row.name,
    type: row.type,
    parentId: row.parentId ?? null,
    position: row.position ?? index,
    category: row.category || row.type,
    level: row.level,
    currency: 'GHS',
    isActive: true,
    createdAt: ts,
    updatedAt: ts,
  }));

  const linked = normalizeCoaList(coaRows);

  for (const account of linked) {
    await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: account.code } },
      update: { name: account.name, type: typeMap[account.type] ?? typeMap.Expense, isActive: true },
      create: {
        tenantId,
        code: account.code,
        name: account.name,
        type: typeMap[account.type] ?? typeMap.Expense,
        isActive: true,
      },
    });
  }

  const dbAccounts = await prisma.account.findMany({
    where: { tenantId },
    select: { id: true, code: true },
  });
  const codeToId = new Map(dbAccounts.map((a) => [a.code, a.id]));
  const seedIdToDbId = new Map(
    linked.map((a) => [a.id, codeToId.get(a.code)]).filter(([, dbId]) => dbId) as [string, string][]
  );

  for (const account of linked) {
    const dbId = codeToId.get(account.code);
    if (!dbId) continue;
    const parentDbId = account.parentId ? seedIdToDbId.get(account.parentId) ?? null : null;
    await prisma.account.update({
      where: { id: dbId },
      data: { parentId: parentDbId },
    });
  }

  return linked.length;
}
