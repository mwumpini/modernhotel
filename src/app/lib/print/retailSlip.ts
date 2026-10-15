import type { PrintData, PrintLineItem, PrintTender } from './templates';
import { money } from './templates';
import { computeTotalsBreakdown } from './taxBreakdown';

/**
 * 80mm till slip laid out like a grocery receipt: centred store lines, items
 * with the price on the right, a dashed rule, tax, a heavier total, then the
 * way it was paid. The mark is the hotel's own logo (samples supply the AGM one);
 * a hotel with no logo prints none.
 */
export function renderRetailSlipDocument(data: PrintData): string {
  const currency = data.currency || '₵';
  const org = data.org;
  const logo = org.logoUrl || '';
  const address = addressLines(org.address);
  const when = slipStamp(data.docDate);
  const code = (data.docNumber || '').trim();
  const { preTaxLines, taxLines, grand } = computeTotalsBreakdown(data);
  const taxable = Math.max(0, (data.totals?.subTotal || 0) - (data.totals?.discount || 0) - (data.totals?.advance || 0));

  const items = (data.items || []).map(item => row(itemName(item), money(itemAmount(item), currency), 'item')).join('');
  const figures = [
    ...preTaxLines.map(([label, value]) => row(figureLabel(label, value, taxable), money(value, currency), 'figure')),
    ...taxLines.map(([label, value]) => row(figureLabel(label, value, taxable), money(value, currency), 'figure')),
  ].join('');
  const tender = renderTender(data.tender, currency, code);

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(data.title || 'Receipt')}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #e7e5e4; color: #111; }
  .slip {
    width: 80mm;
    max-width: 320px;
    margin: 16px auto;
    background: #fff;
    padding: 16px 14px 18px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.35;
    color: #111;
  }
  .mark { text-align: center; }
  .mark img { display: block; width: 64px; height: 64px; margin: 0 auto 2px; object-fit: contain; }
  .stripes {
    width: 132px;
    height: 7px;
    margin: 2px auto 10px;
    background: repeating-linear-gradient(90deg, #0B5F64 0 8px, #0B5F64 8px 11px, #E9A23B 11px 19px, #E9A23B 19px 22px);
  }
  .store, .addr, .tel { text-align: center; text-transform: uppercase; letter-spacing: 0.04em; }
  .store { font-weight: 700; font-size: 13px; letter-spacing: 0.08em; }
  .addr, .tel { font-size: 11px; margin-top: 1px; }
  .tel { margin-bottom: 10px; }
  .meta { margin: 10px 0 12px; }
  .when { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; text-transform: uppercase; letter-spacing: 0.03em; font-size: 11px; }
  .when .rcpt { text-align: right; white-space: nowrap; }
  .server { margin-top: 3px; font-size: 12px; }
  .line { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin: 1px 0; }
  .figure .name, .figure .amt, .total .name, .total .amt { text-transform: uppercase; }
  .amt { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .rule { border-top: 1px dashed #222; margin: 8px 0; }
  .total { font-weight: 800; font-size: 15px; margin-top: 2px; }
  .tender { margin-top: 8px; }
  .brand { margin-top: 2px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .fine { margin-top: 1px; font-size: 11px; }
  .barcode { display: block; margin: 10px auto 0; }
  .thanks {
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 11px;
    line-height: 1.5;
    margin: 14px 0 0;
  }
  @media print {
    html, body { background: #fff; }
    .slip { width: 72mm; max-width: 72mm; margin: 0 auto; padding: 2mm 0 4mm; box-shadow: none; }
  }
</style>
</head><body>
  <div class="slip">
    <div class="mark">
      ${logo ? `<img src="${esc(logo)}" alt="" />` : ''}
      <div class="stripes" aria-hidden="true"></div>
    </div>
    ${org.name ? `<div class="store">${esc(org.name)}</div>` : ''}
    ${address.map(line => `<div class="addr">${esc(line)}</div>`).join('')}
    ${org.phone ? `<div class="tel">Tel: ${esc(org.phone)}</div>` : '<div class="tel"></div>'}
    <div class="meta">
      <div class="when"><span>${esc(when)}</span><span class="rcpt">${esc(code)}</span></div>
      ${data.attendantName ? `<div class="server">Waiter: ${esc(data.attendantName)}</div>` : ''}
    </div>
    ${items}
    <div class="rule"></div>
    ${figures}
    <div class="rule"></div>
    ${row('Total', money(grand, currency), 'total')}
    ${tender}
    <p class="thanks">A big thank you<br>for dining with us</p>
  </div>
</body></html>`;
}

function renderTender(tender: PrintTender | undefined, currency: string, code: string): string {
  if (!tender) return '';
  const method = tender.method.toLowerCase();
  const brand = tender.brand ? `<div class="brand">${esc(tender.brand)}</div>` : '';
  if (method === 'cash') {
    const tendered = tender.tendered ?? tender.amount;
    const change = tender.change ?? Math.max(0, tendered - tender.amount);
    return `<div class="tender">${row('Cash', money(tendered, currency), 'figure')}${change > 0.004 ? row('Change', money(change, currency), 'figure') : ''}</div>`;
  }
  if (method === 'card') {
    return `<div class="tender">
      ${row('Card Payment', money(tender.amount, currency), 'pay')}
      ${brand}
      ${tender.aid ? `<div class="fine">AID: ${esc(tender.aid)}</div>` : ''}
      ${authLine(tender)}
      ${tender.verification ? `<div class="fine">${esc(tender.verification)}</div>` : ''}
      ${barcode(code)}
    </div>`;
  }
  if (method.includes('mobile')) {
    return `<div class="tender">
      ${row('Mobile Money', money(tender.amount, currency), 'pay')}
      ${brand}
      ${barcode(code)}
    </div>`;
  }
  if (method.includes('room')) {
    return `<div class="tender">${row('Room Charge', money(tender.amount, currency), 'pay')}</div>`;
  }
  return `<div class="tender">${row(tender.method, money(tender.amount, currency), 'pay')}${brand}</div>`;
}

function authLine(tender: PrintTender): string {
  const parts = [
    tender.authCode ? `AUTH: ${tender.authCode}` : '',
    tender.terminalId ? `TID: ${tender.terminalId}` : '',
  ].filter(Boolean);
  return parts.length ? `<div class="fine">${esc(parts.join('  '))}</div>` : '';
}

function row(label: string, value: string, kind: 'item' | 'figure' | 'total' | 'pay'): string {
  return `<div class="line ${kind}"><span class="name">${esc(label)}</span><span class="amt">${esc(value)}</span></div>`;
}

function figureLabel(label: string, amount: number | undefined, taxable: number): string {
  if (label === 'Sub Total') return 'Sub-total';
  if (label === 'VAT' && taxable > 0 && amount) {
    const rate = (amount / taxable) * 100;
    return `VAT @ ${rate.toFixed(1)}%`;
  }
  return label;
}

function itemName(item: PrintLineItem): string {
  const name = (item.description || '').trim();
  const qty = Number(item.qty);
  if (Number.isFinite(qty) && qty !== 1) return `${name} x ${Number.isInteger(qty) ? qty : qty}`;
  return name;
}

function itemAmount(item: PrintLineItem): number {
  if (item.amount != null && !Number.isNaN(Number(item.amount))) return Number(item.amount);
  return (item.qty || 0) * (item.unitPrice || 0);
}

function addressLines(address?: string): string[] {
  if (!address) return [];
  return address.split(/\n|,/).map(part => part.trim()).filter(Boolean);
}

function slipStamp(iso?: string): string {
  const parsed = iso ? new Date(iso) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' }).replace(/\./g, '').toUpperCase();
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-GB', { month: 'short' }).replace(/\./g, '').toUpperCase();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${weekday} ${day} ${month} ${date.getFullYear()}  ${hours}:${minutes}`;
}

/** Visual bars for the receipt number. Not a payment cryptogram. */
function barcode(value: string): string {
  const src = (value || '0').replace(/[^A-Za-z0-9]/g, '') || '0';
  const widths: number[] = [2];
  for (const ch of src) {
    const n = ch.charCodeAt(0);
    widths.push((n % 3) + 1, 1, ((n >> 2) % 3) + 1, 1, ((n >> 4) % 2) + 1, 1);
  }
  widths.push(2);
  let x = 0;
  const rects: string[] = [];
  widths.forEach((w, i) => {
    if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="42" fill="#111"/>`);
    x += w;
  });
  return `<svg class="barcode" viewBox="0 0 ${x} 42" width="168" height="42" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Receipt ${esc(value)}">${rects.join('')}</svg>`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ));
}
