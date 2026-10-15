/**
 * Statement of financial position in IFRS (IAS 1) order:
 * non-current assets, then current assets from least to most liquid
 * (inventory, receivables, prepayments, cash); equity, then non-current
 * liabilities, then current liabilities. Totals are unchanged, only the order.
 */

type StatementNode = { code: string; name: string; category?: string; children: StatementNode[] };

const codeNum = (code: string) => parseInt((code || '').replace(/\D/g, '') || '0', 10);

/** Non-current by its label, or by its place in the standard chart (15xx assets, 25xx liabilities). */
export function isNonCurrentGroup(node: Pick<StatementNode, 'code' | 'name' | 'category'>, kind: 'Asset' | 'Liability'): boolean {
  const label = `${node.category || ''} ${node.name || ''}`.toLowerCase();
  if (/non[- ]?current|fixed asset|long[- ]term/.test(label)) return true;
  if (/\bcurrent\b/.test(label)) return false;
  const n = codeNum(node.code);
  return kind === 'Asset' ? n >= 1500 && n < 2000 : n >= 2500 && n < 3000;
}

/** Inventory first, cash last. Anything not in the standard ranges sits before cash. */
function liquidityRank(code: string): number {
  const n = codeNum(code);
  if (n >= 1300 && n < 1400) return 0;
  if (n >= 1200 && n < 1300) return 1;
  if (n >= 1400 && n < 1500) return 2;
  if (n >= 1100 && n < 1200) return 4;
  return 3;
}

export function orderAssetsForStatement<T extends StatementNode>(nodes: T[]): T[] {
  const ordered = [...nodes].sort(
    (a, b) => Number(isNonCurrentGroup(b, 'Asset')) - Number(isNonCurrentGroup(a, 'Asset')) || codeNum(a.code) - codeNum(b.code)
  );
  return ordered.map((node) =>
    isNonCurrentGroup(node, 'Asset')
      ? node
      : ({ ...node, children: [...node.children].sort((a, b) => liquidityRank(a.code) - liquidityRank(b.code) || codeNum(a.code) - codeNum(b.code)) } as T)
  );
}

export function orderLiabilitiesForStatement<T extends StatementNode>(nodes: T[]): T[] {
  return [...nodes].sort(
    (a, b) => Number(isNonCurrentGroup(b, 'Liability')) - Number(isNonCurrentGroup(a, 'Liability')) || codeNum(a.code) - codeNum(b.code)
  );
}
