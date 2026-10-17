import { formatHotelDate } from '../settings/hotelDates';
import type { PrintOrgInfo } from '../print/templates';

export interface PurchaseOrderPrintInput {
  org: PrintOrgInfo;
  poNumber: string;
  supplierName: string;
  supplierLines?: string[];
  orderDate?: Date | string;
  expectedDeliveryDate?: Date | string;
  priority?: string;
  paymentTerms?: string;
  notes?: string;
  preparedBy?: string;
  items: Array<{ itemCode: string; itemName: string; quantity: number; unitCost: number; totalCost: number }>;
  subtotal: number;
  taxLines?: Array<{ name: string; amount: number }>;
  shipping?: number;
  discount?: number;
  total: number;
}

const TERMS: Record<string, string> = {
  immediate: 'Immediate',
  net30: 'Net 30',
  net60: 'Net 60',
  net90: 'Net 90',
};

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ));
}

function money(n: number): string {
  return `₵${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateText(value?: Date | string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatHotelDate(date.toISOString());
}

/** Purchase order stationery: logo and hotel name, the supplier, the lines, and the total. */
export function purchaseOrderPrintHtml(input: PurchaseOrderPrintInput): string {
  const org = input.org;
  const logo = org.logoUrl
    ? `<img class="logo" src="${esc(org.logoUrl)}" alt="" />`
    : `<div class="logo-name">${esc(org.name || '')}</div>`;
  const contacts = [
    org.name ? `<div class="org-name">${esc(org.name)}</div>` : '',
    org.address ? `<div>${esc(org.address)}</div>` : '',
    org.phone ? `<div>Tel. ${esc(org.phone)}</div>` : '',
    org.email ? `<div>Email: ${esc(org.email)}</div>` : '',
    org.taxId ? `<div>TIN: ${esc(org.taxId)}</div>` : '',
  ].join('');
  const supplierExtra = (input.supplierLines || []).filter(Boolean);
  const terms = TERMS[input.paymentTerms || ''] || input.paymentTerms || '';
  const facts = [
    input.expectedDeliveryDate ? ['Expected', dateText(input.expectedDeliveryDate)] : null,
    terms ? ['Terms', terms] : null,
    input.priority ? ['Priority', input.priority.charAt(0).toUpperCase() + input.priority.slice(1)] : null,
  ].filter(Boolean) as Array<[string, string]>;
  const rows = input.items.map((item) => `<tr>
    <td class="code">${esc(item.itemCode)}</td>
    <td>${esc(item.itemName)}</td>
    <td class="mid">${esc(String(item.quantity))}</td>
    <td class="amt">${money(item.unitCost)}</td>
    <td class="amt">${money(item.totalCost)}</td>
  </tr>`).join('');
  const taxRows = (input.taxLines || [])
    .filter((line) => line.amount)
    .map((line) => `<tr><td>${esc(line.amount < 0 ? `${line.name} (withheld)` : line.name)}</td><td class="amt">${line.amount < 0 ? '−' : ''}${money(Math.abs(line.amount))}</td></tr>`)
    .join('');
  const shipping = Number(input.shipping || 0);
  const discount = Number(input.discount || 0);

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>Purchase Order ${esc(input.poNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 22px 28px; color: #111; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; }
  .head { display: flex; gap: 16px; align-items: flex-start; }
  .logo { width: 92px; height: auto; object-fit: contain; }
  .logo-name { width: 92px; font-weight: 800; font-size: 14px; }
  .contacts { flex: 1; text-align: center; line-height: 1.35; }
  .org-name { font-weight: 800; font-size: 14px; }
  .meta { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 16px; }
  .invbox { border: 1px solid #111; display: flex; min-width: 220px; }
  .invbox span { padding: 4px 10px; font-weight: 700; }
  .invbox .word { border-right: 1px solid #111; }
  .supplier { margin-top: 14px; font-weight: 800; font-size: 14px; }
  .where { margin-top: 2px; font-weight: 400; font-size: 12px; line-height: 1.35; }
  h1 { margin: 12px 0 10px; text-align: center; font-size: 14px; text-decoration: underline; letter-spacing: 0.02em; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 4px 6px; vertical-align: middle; }
  th { text-align: center; font-weight: 700; }
  td.amt, th.amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.mid { text-align: center; }
  td.code { font-variant-numeric: tabular-nums; }
  .totals { width: 280px; margin-left: auto; margin-top: 12px; }
  .totals td.lbl { text-align: right; font-weight: 600; }
  .totals tr.grand td { font-weight: 800; }
  .facts { margin-top: 14px; }
  .facts span { margin-right: 16px; }
  .notes { margin-top: 14px; white-space: pre-wrap; }
  .sign { margin-top: 28px; width: 220px; }
  .sign .line { border-bottom: 1px solid #111; height: 36px; }
  .who { margin-top: 4px; font-weight: 700; }
</style></head><body>
<div class="head">${logo}<div class="contacts">${contacts}</div></div>
<div class="meta">
  <div>${esc(dateText(input.orderDate))}</div>
  <div class="invbox"><span class="word">PURCHASE ORDER</span><span>${esc(input.poNumber)}</span></div>
</div>
<div class="supplier">${esc(input.supplierName)}</div>
${supplierExtra.length ? `<div class="where">${supplierExtra.map((line) => esc(line)).join('<br>')}</div>` : ''}
<h1>PURCHASE ORDER</h1>
<table>
  <thead><tr><th>Item code</th><th>Item</th><th>Qty</th><th class="amt">Unit cost</th><th class="amt">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<table class="totals">
  <tr><td class="lbl">Subtotal</td><td class="amt">${money(input.subtotal)}</td></tr>
  ${taxRows}
  ${shipping ? `<tr><td class="lbl">Shipping</td><td class="amt">${money(shipping)}</td></tr>` : ''}
  ${discount ? `<tr><td class="lbl">Discount</td><td class="amt">−${money(discount)}</td></tr>` : ''}
  <tr class="grand"><td class="lbl">Total</td><td class="amt">${money(input.total)}</td></tr>
</table>
${facts.length ? `<div class="facts">${facts.map(([label, value]) => `<span><strong>${esc(label)}</strong> ${esc(value)}</span>`).join(' · ')}</div>` : ''}
${input.notes ? `<div class="notes">${esc(input.notes)}</div>` : ''}
<div class="sign"><div>Prepared by</div><div class="line"></div>${input.preparedBy ? `<div class="who">${esc(input.preparedBy)}</div>` : ''}</div>
</body></html>`;
}
