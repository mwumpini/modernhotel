import { formatHotelDate } from '../settings/hotelDates';
import type { PrintOrgInfo } from '../print/templates';

export interface RequisitionPrintInput {
  org: PrintOrgInfo;
  requisitionNumber: string;
  requestedBy?: string;
  requestedDate?: Date | string;
  department?: string;
  status?: string;
  approvedBy?: string;
  notes?: string;
  items: Array<{
    itemCode: string;
    itemName: string;
    quantity: number;
    estimatedPrice: number;
    totalCost: number;
    preferredSupplierName?: string;
  }>;
  total: number;
}

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

/** Requisition stationery, matching the purchase order: logo, requester, lines, and total. */
export function requisitionPrintHtml(input: RequisitionPrintInput): string {
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
  const status = (input.status || '').replace(/-/g, ' ');
  const rows = input.items.map((item) => `<tr>
    <td class="code">${esc(item.itemCode)}</td>
    <td>${esc(item.itemName)}</td>
    <td>${esc(item.preferredSupplierName || '')}</td>
    <td class="mid">${esc(String(item.quantity))}</td>
    <td class="amt">${money(item.estimatedPrice)}</td>
    <td class="amt">${money(item.totalCost)}</td>
  </tr>`).join('');
  const facts = [
    input.department ? ['Department', input.department] : null,
    status ? ['Status', status] : null,
    input.approvedBy ? ['Approved by', input.approvedBy] : null,
  ].filter(Boolean) as Array<[string, string]>;

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>Requisition ${esc(input.requisitionNumber)}</title>
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
  .who-name { margin-top: 14px; font-weight: 800; font-size: 14px; }
  h1 { margin: 12px 0 10px; text-align: center; font-size: 14px; text-decoration: underline; letter-spacing: 0.02em; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 4px 6px; vertical-align: middle; }
  th { text-align: center; font-weight: 700; }
  td.amt, th.amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.mid { text-align: center; }
  td.code { font-variant-numeric: tabular-nums; }
  .totals { width: 280px; margin-left: auto; margin-top: 12px; }
  .totals td.lbl { text-align: right; font-weight: 800; }
  .totals td.amt { font-weight: 800; }
  .facts { margin-top: 14px; }
  .notes { margin-top: 14px; white-space: pre-wrap; }
  .sign { margin-top: 28px; width: 220px; }
  .sign .line { border-bottom: 1px solid #111; height: 36px; }
  .who { margin-top: 4px; font-weight: 700; }
</style></head><body>
<div class="head">${logo}<div class="contacts">${contacts}</div></div>
<div class="meta">
  <div>${esc(dateText(input.requestedDate))}</div>
  <div class="invbox"><span class="word">REQUISITION</span><span>${esc(input.requisitionNumber)}</span></div>
</div>
${input.requestedBy ? `<div class="who-name">${esc(input.requestedBy)}</div>` : ''}
<h1>REQUISITION</h1>
<table>
  <thead><tr><th>Item code</th><th>Item</th><th>Preferred supplier</th><th>Qty</th><th class="amt">Estimated price</th><th class="amt">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<table class="totals">
  <tr><td class="lbl">Total</td><td class="amt">${money(input.total)}</td></tr>
</table>
${facts.length ? `<div class="facts">${facts.map(([label, value]) => `<span><strong>${esc(label)}</strong> ${esc(value)}</span>`).join(' · ')}</div>` : ''}
${input.notes ? `<div class="notes">${esc(input.notes)}</div>` : ''}
<div class="sign"><div>Requested by</div><div class="line"></div>${input.requestedBy ? `<div class="who">${esc(input.requestedBy)}</div>` : ''}</div>
</body></html>`;
}
