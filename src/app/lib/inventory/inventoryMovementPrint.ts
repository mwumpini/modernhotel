import { formatHotelDate } from '../settings/hotelDates';
import type { PrintOrgInfo } from '../print/templates';

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

function named(value?: string): string | undefined {
  const name = (value || '').trim();
  if (!name || name.toLowerCase() === 'system') return undefined;
  return name;
}

function sheet(input: {
  org: PrintOrgInfo;
  title: string;
  boxWord: string;
  docNumber: string;
  date?: Date | string;
  who?: string;
  heading: string;
  columns: string;
  rows: string;
  totals: string;
  facts: Array<[string, string]>;
  notes?: string;
  signLabel: string;
  signName?: string;
}): string {
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
  const facts = input.facts.filter(([, value]) => value);

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(input.title)} ${esc(input.docNumber)}</title>
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
  .totals { width: 280px; margin-left: auto; margin-top: 12px; }
  .totals td.lbl { text-align: right; }
  .totals tr.strong td { font-weight: 800; }
  .facts { margin-top: 14px; }
  .notes { margin-top: 14px; white-space: pre-wrap; }
  .sign { margin-top: 28px; width: 220px; }
  .sign .line { border-bottom: 1px solid #111; height: 36px; }
  .who { margin-top: 4px; font-weight: 700; }
</style></head><body>
<div class="head">${logo}<div class="contacts">${contacts}</div></div>
<div class="meta">
  <div>${esc(dateText(input.date))}</div>
  <div class="invbox"><span class="word">${esc(input.boxWord)}</span><span>${esc(input.docNumber)}</span></div>
</div>
${input.who ? `<div class="who-name">${esc(input.who)}</div>` : ''}
<h1>${esc(input.heading)}</h1>
<table>
  <thead><tr>${input.columns}</tr></thead>
  <tbody>${input.rows}</tbody>
</table>
<table class="totals">${input.totals}</table>
${facts.length ? `<div class="facts">${facts.map(([label, value]) => `<span><strong>${esc(label)}</strong> ${esc(value)}</span>`).join(' · ')}</div>` : ''}
${input.notes ? `<div class="notes">${esc(input.notes)}</div>` : ''}
<div class="sign"><div>${esc(input.signLabel)}</div><div class="line"></div>${input.signName ? `<div class="who">${esc(input.signName)}</div>` : ''}</div>
</body></html>`;
}

export interface TransferPrintItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
}

export function stockTransferPrintHtml(input: {
  org: PrintOrgInfo;
  transferNumber: string;
  fromLocation: string;
  toLocation: string;
  transferDate?: Date | string;
  expectedDeliveryDate?: Date | string;
  status?: string;
  priority?: string;
  notes?: string;
  createdBy?: string;
  items: TransferPrintItem[];
  total: number;
}): string {
  const rows = input.items.map((item) => `<tr>
    <td>${esc(item.itemCode)}</td>
    <td>${esc(item.itemName)}</td>
    <td class="mid">${esc(String(item.quantity))}</td>
    <td class="amt">${money(item.unitCost)}</td>
    <td class="amt">${money(item.totalValue)}</td>
  </tr>`).join('');
  return sheet({
    org: input.org,
    title: 'Stock Transfer',
    boxWord: 'TRANSFER',
    docNumber: input.transferNumber,
    date: input.transferDate,
    who: [input.fromLocation, input.toLocation].filter(Boolean).join(' → '),
    heading: 'STOCK TRANSFER',
    columns: '<th>Item code</th><th>Item</th><th>Qty</th><th class="amt">Unit cost</th><th class="amt">Amount</th>',
    rows,
    totals: `<tr class="strong"><td class="lbl">Total</td><td class="amt">${money(input.total)}</td></tr>`,
    facts: [
      ['Status', (input.status || '').replace(/-/g, ' ')],
      ['Priority', input.priority || ''],
      ['Expected', dateText(input.expectedDeliveryDate)],
    ],
    notes: input.notes,
    signLabel: 'Prepared by',
    signName: named(input.createdBy),
  });
}

export interface GoodsIssuePrintItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  totalValue: number;
  reason?: string;
}

export function goodsIssuePrintHtml(input: {
  org: PrintOrgInfo;
  issueNumber: string;
  department?: string;
  issuedTo?: string;
  issuedBy?: string;
  issueDate?: Date | string;
  status?: string;
  notes?: string;
  items: GoodsIssuePrintItem[];
  total: number;
}): string {
  const rows = input.items.map((item) => `<tr>
    <td>${esc(item.itemCode)}</td>
    <td>${esc(item.itemName)}</td>
    <td class="mid">${esc(String(item.quantity))}</td>
    <td class="amt">${money(item.totalValue)}</td>
    <td>${esc(item.reason || '')}</td>
  </tr>`).join('');
  return sheet({
    org: input.org,
    title: 'Goods Issue',
    boxWord: 'GOODS ISSUE',
    docNumber: input.issueNumber,
    date: input.issueDate,
    who: input.issuedTo,
    heading: 'GOODS ISSUE',
    columns: '<th>Item code</th><th>Item</th><th>Qty</th><th class="amt">Value</th><th>Reason</th>',
    rows,
    totals: `<tr class="strong"><td class="lbl">Total</td><td class="amt">${money(input.total)}</td></tr>`,
    facts: [
      ['Department', input.department || ''],
      ['Issued by', named(input.issuedBy) || ''],
      ['Status', (input.status || '').replace(/-/g, ' ')],
    ],
    notes: input.notes,
    signLabel: 'Issued by',
    signName: named(input.issuedBy),
  });
}

export interface StockCountPrintItem {
  itemCode: string;
  itemName: string;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  varianceValue: number;
}

export function stockCountPrintHtml(input: {
  org: PrintOrgInfo;
  countNumber: string;
  countType?: string;
  location?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  status?: string;
  notes?: string;
  performedBy?: string;
  createdBy?: string;
  items: StockCountPrintItem[];
  totalItems: number;
  varianceItems: number;
  totalValue: number;
  varianceValue: number;
}): string {
  const rows = input.items.map((item) => `<tr>
    <td>${esc(item.itemCode)}</td>
    <td>${esc(item.itemName)}</td>
    <td class="mid">${esc(String(item.expectedQuantity))}</td>
    <td class="mid">${esc(String(item.countedQuantity))}</td>
    <td class="mid">${item.variance > 0 ? '+' : ''}${esc(String(item.variance))}</td>
    <td class="amt">${money(Math.abs(item.varianceValue))}</td>
  </tr>`).join('');
  const signer = named(input.performedBy) || named(input.createdBy);
  return sheet({
    org: input.org,
    title: 'Stock Count',
    boxWord: 'STOCK COUNT',
    docNumber: input.countNumber,
    date: input.startDate,
    who: input.location,
    heading: 'STOCK COUNT',
    columns: '<th>Item code</th><th>Item</th><th>Expected</th><th>Counted</th><th>Variance</th><th class="amt">Variance value</th>',
    rows,
    totals: [
      `<tr><td class="lbl">Total items</td><td class="amt">${esc(String(input.totalItems))}</td></tr>`,
      `<tr><td class="lbl">Variance lines</td><td class="amt">${esc(String(input.varianceItems))}</td></tr>`,
      `<tr><td class="lbl">Stock value</td><td class="amt">${money(input.totalValue)}</td></tr>`,
      `<tr class="strong"><td class="lbl">Variance value</td><td class="amt">${money(input.varianceValue)}</td></tr>`,
    ].join(''),
    facts: [
      ['Type', input.countType || ''],
      ['Status', (input.status || '').replace(/-/g, ' ')],
      ['Ended', dateText(input.endDate)],
    ],
    notes: input.notes,
    signLabel: 'Counted by',
    signName: signer,
  });
}
