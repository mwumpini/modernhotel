import type { PrintData } from './templates';
import { displayTaxesFromAmounts, taxLineLabel } from '../tax/displayLines';

/**
 * Shared totals math — used by both the block-template engine
 * (blockRenderer.ts's combined totals-summary block and each granular
 * totals-* block) and the legacy hand-written templates (templates.ts's
 * totalsTable()), so the two renderers can never silently drift apart on tax
 * line ordering or the grand-total/balance formula. Lives in its own module
 * (rather than being exported from either renderer) so neither file has to
 * import the other, which would create a circular dependency.
 */
export function computeTotalsBreakdown(data: PrintData) {
  const t = data.totals;
  const preTaxLines: Array<[string, number | undefined]> = [['Sub Total', t.subTotal]];
  if (t.discount) preTaxLines.push(['Discount', t.discount * -1]);
  if (t.advance) preTaxLines.push(['Advance', t.advance * -1]);

  const taxLines: Array<[string, number]> = [];
  if (t.taxes) {
    // NHIL/GETFund together, then VAT, then Tourism Levy (see tax/displayLines.ts).
    // Till slips say NHIL/GFL. Rates come from the amounts, so they follow the hotel's settings.
    const taxable = Math.max(0, (t.subTotal || 0) - (t.discount || 0));
    for (const line of displayTaxesFromAmounts(t.taxes, taxable, data.taxLabelStyle || 'full')) {
      taxLines.push([taxLineLabel(line), line.amount]);
    }
  }
  const taxesTotal = t.taxes ? Object.values(t.taxes).reduce((s, v) => s + (v || 0), 0) : 0;
  const grand = t.grandTotal != null ? t.grandTotal : (t.subTotal - (t.discount || 0) - (t.advance || 0) + taxesTotal);
  const payments = t.payments || 0;
  const balance = t.balance != null ? t.balance : (grand - payments);

  return { preTaxLines, taxLines, taxesTotal, grand, payments, balance, hasBalanceInfo: t.balance != null || payments > 0 };
}
