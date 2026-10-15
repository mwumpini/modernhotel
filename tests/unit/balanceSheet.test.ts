import { describe, expect, it } from 'vitest';
import { orderAssetsForStatement, orderLiabilitiesForStatement } from '@/app/lib/accounting/statementLayout';
import { syncChartWithTemplate } from '@/app/lib/accounting/coaTemplateSync';
import { buildChartOfAccountsFromTemplate } from '@/app/lib/accounting/chartOfAccountsTemplates';
import { inventoryGlForCategory, PAYMENT_GL_MAP } from '@/app/lib/accounting/glAccounts';

type Node = { code: string; name: string; category: string; children: Node[] };
const node = (code: string, name: string, children: Node[] = [], category = ''): Node => ({ code, name, category, children });

describe('Statement of financial position (IFRS order)', () => {
  it('puts non-current assets first and current assets from least to most liquid', () => {
    const assets = [
      node('1000', 'Current Assets', [node('1100', 'Cash'), node('1200', 'Receivables'), node('1300', 'Inventory'), node('1400', 'Prepaid')]),
      node('1500', 'Non-Current Assets'),
    ];
    const ordered = orderAssetsForStatement(assets);
    expect(ordered.map((n) => n.code)).toEqual(['1500', '1000']);
    expect(ordered[1].children.map((n) => n.code)).toEqual(['1300', '1200', '1400', '1100']);
  });

  it('puts non-current liabilities before current ones', () => {
    const ordered = orderLiabilitiesForStatement([node('2000', 'Current Liabilities'), node('2500', 'Non-Current Liabilities')]);
    expect(ordered.map((n) => n.code)).toEqual(['2500', '2000']);
  });

  it('an old chart still named "Fixed Assets" is treated as non-current', () => {
    const ordered = orderAssetsForStatement([node('1000', 'Current Assets'), node('1500', 'Fixed Assets')]);
    expect(ordered[0].code).toBe('1500');
  });
});

describe('Chart of accounts for a business that already has one', () => {
  const template = buildChartOfAccountsFromTemplate('GH');
  const oldChart = template
    .filter((a) => !['1250', '1260', '1530', '1540', '1550', '1560', '1570', '2180', '2450', '2460', '2500', '2510', '2520', '2530', '2540', '2550', '3150', '3400', '4950'].includes(a.code))
    .map((a) => ({ ...a, id: `db-${a.code}`, parentId: null, ...(a.code === '1500' ? { name: 'Fixed Assets', category: 'Fixed Assets' } : {}) }));

  it('adds the new standard accounts under the right heading', () => {
    const { accounts, changed } = syncChartWithTemplate(oldChart, template);
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    expect(byCode.get('2500')?.name).toBe('Non-Current Liabilities');
    expect(byCode.get('2510')?.parentAccount).toBe('2500');
    expect(byCode.get('2510')?.parentId).toBe(byCode.get('2500')?.id);
    expect(byCode.get('2450')?.parentId).toBe('db-2000');
    expect(changed.map((c) => c.account.code)).toContain('4950');
  });

  it('renames the old default heading but keeps names the business chose', () => {
    const custom = oldChart.map((a) => (a.code === '1100' ? { ...a, name: 'Cash & Bank' } : a));
    const { accounts } = syncChartWithTemplate(custom, template);
    expect(accounts.find((a) => a.code === '1500')?.name).toBe('Non-Current Assets');
    expect(accounts.find((a) => a.code === '1100')?.name).toBe('Cash & Bank');
  });

  it('changes nothing when the chart is already up to date', () => {
    expect(syncChartWithTemplate(template, template).changed).toHaveLength(0);
  });
});

describe('Posting accounts', () => {
  it('goods received go to the stock account for their category', () => {
    expect(inventoryGlForCategory('food')).toBe('1310');
    expect(inventoryGlForCategory('beverage')).toBe('1310');
    expect(inventoryGlForCategory('cleaning')).toBe('1320');
    expect(inventoryGlForCategory('maintenance')).toBe('1330');
    expect(inventoryGlForCategory(undefined)).toBe('1310');
  });

  it('a bill credit reduces revenue and "billed to company" stays in receivables', () => {
    expect(PAYMENT_GL_MAP.Credit).toBe('4950');
    expect(PAYMENT_GL_MAP['Corporate Account']).toBe('1210');
    expect(PAYMENT_GL_MAP['Bank Transfer']).toBe('1120');
  });
});
