import { describe, expect, it } from 'vitest';
import { computeStackedTaxLines, taxConfigsFromGhanaTemplate } from '@/app/lib/accounting/taxFromConfig';

const ghana = taxConfigsFromGhanaTemplate();
const amounts = (lines: { type: string; amount: number }[]) =>
  Object.fromEntries(lines.map((l) => [l.type, l.amount]));

describe('Ghana sales tax (VAT Act 2025, Act 1151)', () => {
  it('charges every levy on the same plain base: ₵1,000 → NHIL 25, GETFund 25, VAT 150, Tourism 10', () => {
    const { lines, totalTax, gross } = computeStackedTaxLines(1000, ghana, 'sales');
    expect(amounts(lines)).toEqual({ NHIL: 25, GETFund: 25, VAT: 150, Tourism: 10 });
    expect(totalTax).toBe(210);
    expect(gross).toBe(1210);
  });

  it('lists the lines NHIL, GETFund, VAT, then Tourism Levy last', () => {
    const { lines } = computeStackedTaxLines(500, ghana, 'sales');
    expect(lines.map((l) => l.type)).toEqual(['NHIL', 'GETFund', 'VAT', 'Tourism']);
  });

  it('posts each levy to its own liability account', () => {
    const { lines } = computeStackedTaxLines(100, ghana, 'sales');
    expect(Object.fromEntries(lines.map((l) => [l.type, l.glAccountCode]))).toEqual({
      NHIL: '2120', GETFund: '2130', VAT: '2110', Tourism: '2150',
    });
  });

  it('never puts withholding or the abolished COVID levy on a guest bill', () => {
    const { lines } = computeStackedTaxLines(1000, ghana, 'sales');
    expect(lines.some((l) => /withholding|covid/i.test(`${l.name} ${l.taxCode}`))).toBe(false);
  });

  it('rounds each line to the pesewa', () => {
    const { lines, totalTax } = computeStackedTaxLines(33.33, ghana, 'sales');
    for (const l of lines) expect(Math.round(l.amount * 100) / 100).toBe(l.amount);
    expect(totalTax).toBeCloseTo(lines.reduce((s, l) => s + l.amount, 0), 2);
  });

  it('gives no tax on a zero or negative amount', () => {
    expect(computeStackedTaxLines(0, ghana, 'sales').totalTax).toBe(0);
    expect(computeStackedTaxLines(-50, ghana, 'sales').totalTax).toBe(0);
  });
});

describe('Splitting a stored tax total into levies', () => {
  it('scales the levies so they add back to exactly the stored total', () => {
    const { lines, totalTax } = computeStackedTaxLines(578.78, ghana, 'sales', 117.21);
    expect(totalTax).toBe(117.21);
    expect(Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100).toBe(117.21);
  });

  it('returns no lines when the stored total is zero', () => {
    expect(computeStackedTaxLines(100, ghana, 'sales', 0).lines).toEqual([]);
  });
});

describe('Purchase (input) tax', () => {
  it('claims NHIL, GETFund and VAT but not the Tourism Levy', () => {
    const { lines, totalTax } = computeStackedTaxLines(1000, ghana, 'purchase');
    expect(amounts(lines)).toEqual({ NHIL: 25, GETFund: 25, VAT: 150 });
    expect(totalTax).toBe(200);
  });
});
