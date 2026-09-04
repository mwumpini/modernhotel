import { computeStackedTaxLines, taxConfigsFromGhanaTemplate } from '../src/app/lib/accounting/taxFromConfig';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// Ghana VAT Act, 2025 (Act 1151, effective 1 Jan 2026) — VAT/NHIL/GETFund all
// apply independently to the plain taxable value; none cascade into another's
// base. Worked example from GRA guidance: ₵1,000 taxable value → VAT 150 +
// NHIL 25 + GETFund 25 = ₵200 GRA tax. Tourism Levy (Ghana Tourism Authority,
// L.I. 2185) is separate and was never part of the VAT base — ₵10 more here.
{
  const configs = taxConfigsFromGhanaTemplate();
  const { lines, totalTax, gross } = computeStackedTaxLines(1000, configs, 'sales');

  const vat = lines.find((l) => l.type === 'VAT');
  const nhil = lines.find((l) => l.type === 'NHIL');
  const getfund = lines.find((l) => l.type === 'GETFund');
  const tourism = lines.find((l) => l.type === 'Tourism');
  const covid = lines.find((l) => l.type === 'COVID19');

  assert(vat?.amount === 150, `VAT should be 150, got ${vat?.amount}`);
  assert(nhil?.amount === 25, `NHIL should be 25, got ${nhil?.amount}`);
  assert(getfund?.amount === 25, `GETFund should be 25, got ${getfund?.amount}`);
  assert(tourism?.amount === 10, `Tourism should be 10, got ${tourism?.amount}`);
  assert(!covid, `COVID-19 levy should be abolished (inactive/zero-rate), got ${covid?.amount}`);
  assert(totalTax === 210, `Total tax should be 210 (200 GRA + 10 tourism), got ${totalTax}`);
  assert(gross === 1210, `Gross should be 1210, got ${gross}`);

  // Cascading regression guard: under the old (pre-2026) formula this would have
  // been VAT on (net + NHIL + GETFund + Tourism) = 1060 * 15% = 159, not 150.
  assert(vat!.amount !== 159, 'VAT must not be computed on a cascaded base');
}

// A purchase (input tax) — NHIL/GETFund/Tourism are non-creditable, so only
// VAT applies to purchases; still on the plain net, not a cascaded base.
{
  const configs = taxConfigsFromGhanaTemplate();
  const { lines, totalTax } = computeStackedTaxLines(1000, configs, 'purchase');
  assert(lines.length === 1 && lines[0].type === 'VAT', 'only VAT applies to purchases');
  assert(lines[0].amount === 150, `Purchase VAT should be 150, got ${lines[0].amount}`);
  assert(totalTax === 150, `Purchase total tax should be 150, got ${totalTax}`);
}

console.log('All tax engine regression checks passed.');
