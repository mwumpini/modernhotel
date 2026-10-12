import type { PrintData, PrintLineItem, PrintTaxes } from './templates';
import { amountInWords } from './amountInWords';
import { computeTotalsBreakdown } from './taxBreakdown';
import { displayTaxesFromAmounts, formatRate } from '../tax/displayLines';

/**
 * Restaurant bill in the Noda Hotel form: TIN and logo on the left, the hotel
 * name centered, guest and bill details in two columns, a tall ruled item
 * table (Qty, Description, Rate, Total), then the Ghana tax lines on the bill,
 * the amount in words, and a sign line. A hotel with no logo prints none.
 */
export function renderNodaBillDocument(data: PrintData): string {
  const org = data.org;
  const when = parseDate(data.docDate);
  const names = hotelNameLines(org.name || '');
  const address = addressLines(org.address);
  const phones = phoneLines(org.phone);
  const logo = org.logoUrl || '';
  const guest = (data.guest.company || data.guest.name || '').trim();
  const room = (data.guest.roomNumber || '').trim();
  const table = tableLabel(data.tableNumber);
  const attendant = (data.attendantName || '').trim();
  const billNo = (data.docNumber || '').trim();
  const { grand } = computeTotalsBreakdown(data);
  const discount = data.totals.discount || 0;
  const taxRows = nodaTaxLines(data.totals.taxes, Math.max(0, (data.totals.subTotal || 0) - discount))
    .map(([label, amount]) => totalRow(label, gh(amount), false))
    .join('');
  const items = data.items || [];

  const addressHtml = address.map(line => `<div class="addr">${esc(line)}</div>`).join('');
  const phoneHtml = phones.map(line => `<div class="phone">${esc(line)}</div>`).join('');
  const rows = items.map(item => itemRow(item)).join('');
  const discountRow = discount
    ? totalRow('Discount:', gh(-discount), false)
    : '';

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(data.title || 'Restaurant Bill')}</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #e7e5e4; color: #000; }
  .sheet {
    width: 80mm;
    max-width: 80mm;
    margin: 12px auto;
    padding: 6px 6px 10px;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9px;
    line-height: 1.25;
    color: #000;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    font-size: 8px;
    line-height: 1.15;
  }
  .pageno { text-align: right; margin: 0; white-space: nowrap; }
  .tin { white-space: nowrap; }
  .head { position: relative; margin-top: 1px; text-align: center; }
  .logo {
    position: absolute;
    left: 0;
    top: 0;
    width: 30px;
    height: 30px;
    object-fit: contain;
  }
  .letterhead { text-align: center; }
  .hotel {
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.04em;
    line-height: 1.05;
    text-transform: uppercase;
  }
  .ltd {
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 0.04em;
    line-height: 1.1;
  }
  .addr, .phone { font-size: 8px; line-height: 1.2; }
  .title {
    margin: 8px 0 6px;
    text-align: center;
    font-size: 12px;
    font-weight: 800;
    text-decoration: underline;
  }
  .meta {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 2px 6px;
    font-weight: 700;
    font-size: 8.5px;
    line-height: 1.3;
    margin: 0 0 6px;
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8px;
  }
  table.items th, table.items td {
    border: none;
    border-left: 1px solid #000;
    padding: 1px 2px;
    vertical-align: top;
    font-weight: 400;
  }
  table.items th:last-child, table.items td:last-child { border-right: 1px solid #000; }
  table.items th {
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    font-weight: 700;
    text-align: left;
  }
  table.items th.rate, table.items th.total { text-align: right; }
  table.items tr.pad td { height: 16mm; }
  table.items td.summary {
    border: 1px solid #000;
    padding: 3px 4px 5px;
  }
  table.items col.qty { width: 18px; }
  table.items col.rate { width: 36px; }
  table.items col.total { width: 40px; }
  table.items td.qty { font-size: 10px; }
  table.items td.desc { text-transform: uppercase; }
  table.items td.rate, table.items td.total { text-align: right; font-variant-numeric: tabular-nums; }
  .totals {
    margin: 2px 0 0 auto;
    width: max-content;
    max-width: 100%;
    border: none;
    font-size: 8px;
  }
  .totals .line { display: flex; justify-content: flex-end; gap: 10px; }
  .totals .lbl { text-align: right; white-space: nowrap; }
  .totals .amt {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    min-width: 58px;
  }
  .totals .grand { font-weight: 800; }
  .words { margin-top: 8px; font-weight: 800; font-size: 10px; }
  .sign {
    margin-top: 12px;
    display: flex;
    align-items: flex-end;
    gap: 6px;
    font-size: 10px;
  }
  .sign .rule { width: 92px; border-bottom: 1px solid #000; height: 14px; }
  .signdate { margin-top: 6px; font-size: 10px; }
  @media print {
    html, body { background: #fff; }
    .sheet { margin: 0; }
  }
</style>
</head><body>
  <div class="sheet">
    <div class="top">
      <div class="tin">${org.taxId ? `TinNo: ${esc(org.taxId)}` : ''}</div>
      <div class="pageno">Page 1 of 1</div>
    </div>
    <div class="head">
      ${logo ? `<img class="logo" src="${esc(logo)}" alt="" />` : ''}
      <div class="letterhead">
        ${names.main ? `<div class="hotel">${esc(names.main)}</div>` : ''}
        ${names.suffix ? `<div class="ltd">${esc(names.suffix)}</div>` : ''}
        ${addressHtml}
        ${phoneHtml}
      </div>
    </div>
    <div class="title">Restaurant Bill</div>
    <div class="meta">
      <div class="left">
        <div>MOP: ${esc(mopLabel(data.tender?.method))}</div>
        <div>Guest: ${esc(guest.toUpperCase())}</div>
        <div>Room NO:${esc(room)}</div>
        <div>${esc(table)}</div>
        <div>Attendant: ${esc(attendant.toUpperCase())}</div>
      </div>
      <div class="right">
        <div>Date ${esc(billDate(when))}</div>
        <div>Bill No:${esc(billNo)}</div>
        <div>Time:${esc(billTime(when))}</div>
      </div>
    </div>
    <table class="items">
      <colgroup>
        <col class="qty" />
        <col />
        <col class="rate" />
        <col class="total" />
      </colgroup>
      <thead>
        <tr>
          <th>Qty</th>
          <th>Description</th>
          <th class="rate">Rate</th>
          <th class="total">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="pad"><td></td><td></td><td></td><td></td></tr>
      </tbody>
      <tfoot>
        <tr>
          <td class="summary" colspan="4">
            <div class="totals">
              ${totalRow('SubTotal:', gh(data.totals.subTotal || 0), false)}
              ${discountRow}
              ${taxRows}
              ${totalRow('Total:', gh(grand), true)}
            </div>
            <div class="words">${esc(nodaWords(grand))}</div>
          </td>
        </tr>
      </tfoot>
    </table>
    <div class="sign"><span>Sign:</span><span class="rule"></span></div>
    <div class="signdate">${esc(signDate(when))}</div>
  </div>
</body></html>`;
}

function itemRow(item: PrintLineItem): string {
  const qty = item.qty != null && Number.isFinite(Number(item.qty)) ? formatQty(Number(item.qty)) : '';
  const rate = item.unitPrice != null && Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice).toFixed(2) : '';
  const amount = Number.isFinite(Number(item.amount)) ? Number(item.amount).toFixed(2) : '';
  return `<tr>
    <td class="qty">${esc(qty)}</td>
    <td class="desc">${esc(item.description || '')}</td>
    <td class="rate">${esc(rate)}</td>
    <td class="total">${esc(amount)}</td>
  </tr>`;
}

/**
 * Tax lines on the bill: NHIL/GFL together, then VAT, then Tourism Levy (the shared
 * order in tax/displayLines.ts), with each rate worked out from the bill's own amounts.
 */
function nodaTaxLines(taxes: PrintTaxes | undefined, taxable: number): Array<[string, number]> {
  if (!taxes) return [];
  return displayTaxesFromAmounts(taxes, taxable, 'short').map((line) => {
    const rate = formatRate(line.rate);
    return [`${line.name}${rate ? ` ${rate}` : ''}:`, line.amount];
  });
}

function totalRow(label: string, value: string, grand: boolean): string {
  const cls = grand ? ' line grand' : ' line';
  return `<div class="${cls}"><span class="lbl">${esc(label)}</span><span class="amt">${esc(value)}</span></div>`;
}

function gh(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const sign = value < 0 ? '-' : '';
  return `${sign}Gh¢${Math.abs(value).toFixed(2)}`;
}

/** "Two Hundred Fifty Ghana Cedis" — the words, then the currency, with no "Only". */
function nodaWords(amount: number): string {
  const spoken = amountInWords(Math.abs(amount)).replace(/ Only$/, '');
  const body = spoken.replace(/^Ghana Cedis\s+/, '');
  const split = body.match(/^(.*?) and (\w[\w\s-]* Pesewas)$/);
  if (split && split[1]) return `${split[1]} Ghana Cedis and ${split[2]}`;
  return `${body} Ghana Cedis`;
}

function hotelNameLines(name: string): { main: string; suffix: string } {
  const clean = name.trim().replace(/\s+/g, ' ');
  const match = clean.match(/^(.*\S)\s+(ltd\.?|limited\.?)$/i);
  if (!match) return { main: clean.toUpperCase(), suffix: '' };
  const word = match[2].replace(/\./g, '').toUpperCase();
  return { main: match[1].toUpperCase(), suffix: word === 'LIMITED' ? 'LIMITED' : 'LTD.' };
}

function addressLines(address?: string): string[] {
  if (!address?.trim()) return [];
  const raw = address.split(/\n/).map(line => line.trim()).filter(Boolean);
  if (raw.length > 1) return raw;
  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length <= 1) return parts;
  return [`${parts[0]},`, parts.slice(1).join(', ')];
}

function phoneLines(phone?: string): string[] {
  if (!phone?.trim()) return [];
  const parts = phone.split(/\n|\/|,|;/).map(part => part.trim()).filter(Boolean);
  return parts.map((part, index) => (index === 0 ? `Ph: ${part}` : part));
}

function tableLabel(raw?: string): string {
  const text = (raw || '').trim();
  if (!text) return 'Table';
  const withoutWord = text.replace(/^table\s*/i, '').trim();
  const source = withoutWord === text ? text.replace(/^t(?=\d)/i, '') : withoutWord;
  if (/^\d+$/.test(source)) return `Table ${source.padStart(2, '0')}`;
  return `Table ${source}`;
}

function mopLabel(method?: string): string {
  const value = (method || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'card' || value === 'credit' || value.includes('visa') || value.includes('master')) return 'CREDIT';
  if (value === 'cash') return 'CASH';
  if (value.includes('room')) return 'ROOM CHARGE';
  if (value.includes('mobile') || value.includes('momo')) return 'MOBILE MONEY';
  return method!.trim().toUpperCase();
}

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(qty);
}

function parseDate(iso?: string): Date {
  const parsed = iso ? new Date(iso) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function billDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function billTime(date: Date): string {
  const hours24 = date.getHours();
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds} ${suffix}`;
}

function signDate(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ));
}
