/**
 * How taxes are shown to guests: NHIL and GETFund together on one line, then VAT,
 * then the Tourism Levy, then anything else (legacy COVID levy, other levies).
 *
 *   NHIL/GETFund 5%   (invoices, bills, front-desk receipts)
 *   NHIL/GFL 5%       (short restaurant till slips)
 *   VAT 15%
 *   Tourism Levy 1%
 *
 * Display only. Accounting and the GRA filing keep NHIL and GETFund apart (own GL
 * accounts, own return lines). No browser or store imports, so any renderer can use it.
 */

export type TaxLabelStyle = 'full' | 'short';

export type TaxDisplayLine = { name: string; rate?: number; amount: number };

type Kind = 'nhil' | 'getfund' | 'vat' | 'tourism' | 'covid' | 'other';

const ORDER: Kind[] = ['nhil', 'vat', 'tourism', 'covid', 'other']; // getfund joins nhil

function kindOf(line: { name?: string; type?: string; code?: string; taxCode?: string }): Kind {
  const text = `${line.type || ''} ${line.code || ''} ${line.taxCode || ''} ${line.name || ''}`.toLowerCase();
  if (/withholding|wht/.test(text)) return 'other';
  if (/nhil|health insurance/.test(text)) return 'nhil';
  if (/getfund|gefl|gfl|education trust/.test(text)) return 'getfund';
  if (/covid/.test(text)) return 'covid';
  if (/tourism/.test(text)) return 'tourism';
  if (/\bvat\b|value added/.test(text)) return 'vat';
  return 'other';
}

function label(kind: Kind, style: TaxLabelStyle, fallback: string): string {
  switch (kind) {
    case 'nhil': return style === 'short' ? 'NHIL/GFL' : 'NHIL/GETFund';
    case 'vat': return 'VAT';
    case 'tourism': return 'Tourism Levy';
    case 'covid': return 'COVID-19 Levy';
    default: return fallback;
  }
}

/** Rate worked out from the amounts when the line carries none. Ghana rates come in halves
 *  (2.5, 5, 15, 1), so the nearest 0.5 hides pesewa rounding: 1.26 on 25.00 reads 5%. */
export function rateFromAmounts(amount: number, taxable: number): number | undefined {
  if (!(taxable > 0) || !(amount > 0)) return undefined;
  return Math.round((amount / taxable) * 200) / 2;
}

export function formatRate(rate?: number): string {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return '';
  return `${Number.isInteger(rate) ? rate : Number(rate.toFixed(2))}%`;
}

/** Engine or stored tax lines → guest-facing lines in the standard order. */
export function displayTaxLines(
  lines: Array<{ name?: string; type?: string; code?: string; taxCode?: string; rate?: number; amount: number }>,
  style: TaxLabelStyle = 'full',
): TaxDisplayLine[] {
  const groups = new Map<string, { kind: Kind; name: string; rate?: number; amount: number }>();
  for (const line of lines) {
    const amount = Number(line.amount) || 0;
    if (amount === 0) continue;
    const raw = kindOf(line);
    const kind = raw === 'getfund' ? 'nhil' : raw;
    const key = kind === 'other' ? `other:${line.name || line.code || ''}` : kind;
    const current = groups.get(key) || { kind, name: label(kind, style, line.name || 'Tax'), rate: undefined, amount: 0 };
    current.amount += amount;
    const rate = Number(line.rate);
    if (Number.isFinite(rate) && rate > 0) current.rate = (current.rate || 0) + rate;
    groups.set(key, current);
  }
  return [...groups.values()]
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
    .map(({ name, rate, amount }) => ({ name, rate, amount: Math.round(amount * 100) / 100 }));
}

/** A print document's tax amounts (keyed by levy) → guest-facing lines, rates from the amounts. */
export function displayTaxesFromAmounts(
  taxes: { vat?: number; nhil?: number; gefl?: number; levy?: number; covid?: number; gtal?: number },
  taxable: number,
  style: TaxLabelStyle = 'full',
): TaxDisplayLine[] {
  const lines = displayTaxLines([
    { name: 'NHIL', amount: taxes.nhil || 0 },
    { name: 'GETFund', amount: taxes.gefl || 0 },
    { name: 'VAT', amount: taxes.vat || 0 },
    { name: 'Tourism Levy', amount: taxes.levy || 0 },
    { name: 'COVID-19 Levy', amount: taxes.covid || 0 },
    { name: 'GTAL', amount: taxes.gtal || 0 },
  ], style);
  return lines.map((line) => ({ ...line, rate: rateFromAmounts(line.amount, taxable) }));
}

/** "NHIL/GETFund (5%)" style label for a totals table. */
export function taxLineLabel(line: TaxDisplayLine): string {
  const rate = formatRate(line.rate);
  return rate ? `${line.name} (${rate})` : line.name;
}
