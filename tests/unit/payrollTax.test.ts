import { describe, expect, it } from 'vitest';
import { computeTaxStack } from '@/app/lib/compliance/calcEngine';
import shipped from '../../prisma/compliance.taxes.json';

type Rule = Parameters<typeof computeTaxStack>[0][number];
const ghana = (shipped as unknown as Rule[]).filter((r) => (r as { countryCode?: string }).countryCode === 'GH');
const payroll = { domain: 'payroll', operation: 'internal' };
// Sum of the tax lines (the stack's own total includes the base amount).
const taxOf = (rules: Rule[], amount: number, category: string) =>
  Math.round(computeTaxStack(rules, amount, category, payroll).taxes.reduce((s, t) => s + t.amount, 0) * 100) / 100;
const paye = (rules: Rule[], taxable: number) => taxOf(rules, taxable, 'PAYE');

describe('Ghana payroll tax', () => {
  it('PAYE follows the Act 1178 monthly bands (0% to 588, 5% next 80, 10% next 100, 17.5% next 2,900)', () => {
    expect(paye(ghana, 588)).toBe(0);
    expect(paye(ghana, 768)).toBe(14);
    expect(paye(ghana, 1768)).toBe(189);
  });

  it('a ₵1,000 basic + ₵300 allowance: SSNIT 5.5% of basic comes off before PAYE', () => {
    const ssnit = taxOf(ghana, 1000, 'TIER1');
    expect(ssnit).toBe(55);
    expect(paye(ghana, 1300 - ssnit)).toBeCloseTo(97.48, 2);
  });

  it('never puts VAT, NHIL or GETFund on a salary, even when a sales rule is set to "custom"', () => {
    const custom = ghana.map((r) => (['gh-vat', 'gh-nhil', 'gh-getfund'].includes(String((r as { id?: string }).id)) ? { ...r, domain: 'custom' } : r)) as Rule[];
    expect(paye(custom, 1768)).toBe(189);
    expect(computeTaxStack(custom, 1768, 'PAYE', payroll).taxes.map((t) => t.name)).toEqual(['PAYE (Income Tax)']);
  });

  it('a "custom" rule still applies outside payroll', () => {
    const custom = ghana.map((r) => ((r as { id?: string }).id === 'gh-vat' ? { ...r, domain: 'custom' } : r)) as Rule[];
    expect(computeTaxStack(custom, 100, 'ROOM', { domain: 'sales', operation: 'external' }).taxes.some((t) => /VAT/.test(t.name))).toBe(true);
  });
});
