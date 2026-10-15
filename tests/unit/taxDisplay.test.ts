import { describe, expect, it } from 'vitest';
import {
  displayTaxLines,
  displayTaxesFromAmounts,
  formatRate,
  rateFromAmounts,
  taxLineLabel,
} from '@/app/lib/tax/displayLines';

describe('Tax lines as guests see them', () => {
  const engine = [
    { name: 'Tourism Development Levy', type: 'Tourism', rate: 1, amount: 10 },
    { name: 'Value Added Tax', type: 'VAT', rate: 15, amount: 150 },
    { name: 'GETFund Levy', type: 'GETFund', rate: 2.5, amount: 25 },
    { name: 'National Health Insurance Levy', type: 'NHIL', rate: 2.5, amount: 25 },
  ];

  it('joins NHIL and GETFund into one 5% line, then VAT, then Tourism Levy', () => {
    expect(displayTaxLines(engine)).toEqual([
      { name: 'NHIL/GETFund', rate: 5, amount: 50 },
      { name: 'VAT', rate: 15, amount: 150 },
      { name: 'Tourism Levy', rate: 1, amount: 10 },
    ]);
  });

  it('uses the short NHIL/GFL label on till slips', () => {
    expect(displayTaxLines(engine, 'short')[0].name).toBe('NHIL/GFL');
  });

  it('drops zero-amount levies', () => {
    expect(displayTaxLines([{ name: 'COVID-19 Levy', amount: 0 }, { name: 'VAT', amount: 3 }])).toEqual([
      { name: 'VAT', rate: undefined, amount: 3 },
    ]);
  });

  it('labels a line with its rate: "NHIL/GETFund (5%)"', () => {
    expect(taxLineLabel({ name: 'NHIL/GETFund', rate: 5, amount: 50 })).toBe('NHIL/GETFund (5%)');
    expect(taxLineLabel({ name: 'VAT', amount: 3 })).toBe('VAT');
  });
});

describe('Rates worked out from printed amounts', () => {
  it('reads through pesewa rounding to the nearest half percent', () => {
    expect(rateFromAmounts(1.26, 25)).toBe(5);
    expect(rateFromAmounts(93, 620)).toBe(15);
    expect(rateFromAmounts(6.2, 620)).toBe(1);
  });

  it('has no rate without a taxable amount', () => {
    expect(rateFromAmounts(5, 0)).toBeUndefined();
    expect(formatRate(undefined)).toBe('');
    expect(formatRate(2.5)).toBe('2.5%');
  });

  it('turns a bill’s tax amounts into ordered lines with rates (the sample bill)', () => {
    expect(displayTaxesFromAmounts({ nhil: 31, vat: 93, levy: 6.2 }, 620)).toEqual([
      { name: 'NHIL/GETFund', rate: 5, amount: 31 },
      { name: 'VAT', rate: 15, amount: 93 },
      { name: 'Tourism Levy', rate: 1, amount: 6.2 },
    ]);
  });
});
