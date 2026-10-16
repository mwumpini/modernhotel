import { describe, expect, it } from 'vitest';
import { listCurrencies, workingCurrency } from '@/app/lib/settings/currencies';

describe('hotel currencies', () => {
  it('keeps cedis as the home currency with rate 1', () => {
    const list = listCurrencies([
      { code: 'usd', majorName: 'US dollar', minorName: 'cents', rate: 15.5 },
    ]);
    expect(list[0]).toMatchObject({ code: 'GHS', majorName: 'Ghana Cedis', minorName: 'Pesewas', rate: 1 });
    expect(list[1].code).toBe('USD');
  });

  it('uses the switched-on currency, and cedis when none is on', () => {
    const currencies = [
      { code: 'GHS', majorName: 'Ghana Cedis', minorName: 'Pesewas', rate: 1 },
      { code: 'USD', majorName: 'US dollar', minorName: 'cents', rate: 15.5 },
    ];
    expect(workingCurrency({ currencies, activeCurrencyCode: 'USD' }).code).toBe('USD');
    expect(workingCurrency({ currencies, activeCurrencyCode: 'GHS' }).code).toBe('GHS');
    expect(workingCurrency({ currencies }).majorName).toBe('Ghana Cedis');
  });
});
