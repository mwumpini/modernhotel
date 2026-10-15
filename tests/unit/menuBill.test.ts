import { describe, expect, it } from 'vitest';
import { quoteMenuBill } from '@/app/lib/fb/menuPriceTax';
import { computeStackedTaxLines, taxConfigsFromGhanaTemplate } from '@/app/lib/accounting/taxFromConfig';

const ghana = taxConfigsFromGhanaTemplate();
const taxOnExclusive = (net: number) => {
  const { lines, totalTax } = computeStackedTaxLines(net, ghana, 'sales');
  return { totalTax, lines };
};

describe('Restaurant bills from menu prices', () => {
  it('a tax-inclusive ₵121 dish costs the guest ₵121, of which ₵21 is tax', () => {
    const q = quoteMenuBill({ lines: [{ unitPrice: 121, quantity: 1, priceIncludesTax: true }], taxOnExclusive });
    expect(q.guestTotal).toBe(121);
    expect(q.taxAmount).toBe(21);
    expect(q.exclusiveSubtotal).toBe(100);
  });

  it('a ₵100 before-tax dish costs the guest ₵121', () => {
    const q = quoteMenuBill({ lines: [{ unitPrice: 100, quantity: 1, priceIncludesTax: false }], taxOnExclusive });
    expect(q.guestTotal).toBe(121);
    expect(q.taxAmount).toBe(21);
  });

  it('the tax lines add up to the tax on the bill', () => {
    const q = quoteMenuBill({
      lines: [
        { unitPrice: 60, quantity: 2, priceIncludesTax: true },
        { unitPrice: 25, quantity: 1, priceIncludesTax: true },
      ],
      taxOnExclusive,
    });
    const sum = Math.round(q.taxLines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    expect(sum).toBe(q.taxAmount);
    expect(q.guestTotal).toBe(145);
  });

  it('a discount lowers the price the guest pays and the tax in it', () => {
    const q = quoteMenuBill({
      lines: [{ unitPrice: 121, quantity: 2, priceIncludesTax: true }],
      discountAmount: 24.2,
      taxOnExclusive,
    });
    expect(q.guestTotal).toBe(217.8);
    expect(q.taxAmount).toBeCloseTo(37.8, 2);
  });

  it('a discount can never take the bill below zero', () => {
    const q = quoteMenuBill({ lines: [{ unitPrice: 50, quantity: 1, priceIncludesTax: true }], discountAmount: 500, taxOnExclusive });
    expect(q.guestTotal).toBe(0);
    expect(q.taxAmount).toBe(0);
  });

  it('service charge is taxed on top', () => {
    const q = quoteMenuBill({
      lines: [{ unitPrice: 100, quantity: 1, priceIncludesTax: false }],
      serviceCharge: 10,
      taxOnExclusive,
    });
    expect(q.guestTotal).toBe(133.1);
  });
});
