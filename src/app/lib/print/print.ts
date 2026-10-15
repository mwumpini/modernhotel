'use client';

import { renderPrint, openHtmlPrintWindow } from './engine';
import { buildOrgProfile } from './buildOrgProfile';
import { useSettingsStore } from '../settings/store';
import { salesTaxBreakdown } from '../tax/engine';

function esc(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}

function slipLogoUrl() {
  try {
    return useSettingsStore.getState().companySettings?.logoUrl || '';
  } catch {
    return '';
  }
}

export function printHtml(title: string, bodyHtml: string) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=480');
  if (!printWindow) return;
  const css = `
    <style>
      :root { color-scheme: light; }
      body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 12px; }
      .receipt { width: 320px; }
      h1, h2, h3 { margin: 0; }
      .center { text-align: center; }
      .muted { color: #666; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { padding: 6px 0; }
      .totals td { padding-top: 8px; }
      .line { border-top: 1px dashed #aaa; margin: 8px 0; }
      @page { size: 80mm auto; margin: 0; }
      @media print {
        body { margin: 0; }
        .receipt { width: 72mm; margin: 0 auto; }
      }
    </style>
  `;
  printWindow.document.write(`<!doctype html><html><head><title>${title}</title>${css}</head><body>${bodyHtml}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 100);
}

export function previewHtml(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=480');
  if (!w) return;
  const css = `
    <style>
      :root { color-scheme: light; }
      body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 12px; }
      .receipt { width: 320px; }
      h1, h2, h3 { margin: 0; }
      .center { text-align: center; }
      .muted { color: #666; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { padding: 6px 0; }
      .totals td { padding-top: 8px; }
      .line { border-top: 1px dashed #aaa; margin: 8px 0; }
    </style>
  `;
  w.document.write(`<!doctype html><html><head><title>${title}</title>${css}</head><body>${bodyHtml}</body></html>`);
  w.document.close();
}

export function buildReceiptHtml(args: {
  hotelName: string;
  contact?: string;
  code: string;
  datetime: string;
  items: Array<{ name: string; qty: number; price: number }>;
  subtotal: number;
  discount: number;
  total: number;
  table?: string;
  waiter?: string;
}) {
  const itemsRows = args.items.map(i => `<tr><td>${i.qty} x ${i.name}</td><td style="text-align:right">₵${(i.price * i.qty).toFixed(2)}</td></tr>`).join('');
  return `
  <div class="receipt">
    <div class="center">
      <h2>${args.hotelName}</h2>
      <div class="muted">${args.contact || ''}</div>
      <div class="muted">${args.datetime}</div>
      <div class="muted">Receipt: ${args.code}</div>
      <div class="muted">${args.table ? 'Table '+args.table : ''} ${args.waiter ? '• '+args.waiter : ''}</div>
    </div>
    <div class="line"></div>
    <table>${itemsRows}</table>
    <div class="line"></div>
    <table class="totals">
      <tr><td>Subtotal</td><td style="text-align:right">₵${args.subtotal.toFixed(2)}</td></tr>
      <tr><td>Discount</td><td style="text-align:right">₵${args.discount.toFixed(2)}</td></tr>
      <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>₵${args.total.toFixed(2)}</strong></td></tr>
    </table>
    <div class="center muted" style="margin-top:6px">Thank you for dining with us!</div>
  </div>`;
}

export function buildKOTHtml(args: {
  code: string; table: string; waiter: string; notes?: string; urgent?: boolean; title?: string; hotelName?: string; items: Array<{ name: string; qty: number }>;
}) {
  const itemsRows = args.items.map((item) => `
    <div class="item"><span class="qty">${esc(String(item.qty))}</span><span>${esc(item.name)}</span></div>
  `).join('');
  return `
  <div class="slip">
    ${slipLogoUrl() ? `<div class="center"><img class="logo" src="${esc(slipLogoUrl())}" alt="" /></div>` : ''}
    <h2 class="center brand">${esc(args.hotelName || 'Restaurant')}</h2>
    <div class="center ticket">${esc(args.title || 'Kitchen Order Ticket')}</div>
    <div class="center meta">${esc(args.code)}</div>
    <div class="center meta">Table ${esc(args.table || '—')} · ${esc(args.waiter || '—')}</div>
    ${args.urgent ? '<div class="center urgent">Urgent</div>' : ''}
    <div class="rule"></div>
    ${itemsRows}
    ${args.notes ? `<div class="rule"></div><div class="notes"><strong>Notes</strong><br>${esc(args.notes)}</div>` : ''}
  </div>`;
}

const SLIP_PREVIEW_CSS = `
  body { margin:0; background:#e7e5e4; font-family: "Segoe UI", Arial, sans-serif; color:#111; }
  .slip { width:320px; margin:16px auto; background:#fff; padding:18px 16px 22px; box-shadow:0 8px 24px rgba(0,0,0,.12); }
  .center { text-align:center; }
  .logo { width:56px; height:56px; object-fit:contain; }
  h2 { margin:8px 0 0; font-size:22px; letter-spacing:.04em; text-transform:uppercase; }
  .ticket { margin-top:4px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
  .meta { margin-top:2px; font-size:12px; color:#444; }
  .urgent { margin-top:6px; color:#b91c1c; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
  .rule { border-top:1px dashed #888; margin:10px 0; }
  .item { display:flex; gap:12px; margin:4px 0; text-transform:uppercase; }
  .qty { width:1.6rem; text-align:right; font-variant-numeric:tabular-nums; }
  .notes { font-size:13px; }
  @page { size: 80mm auto; margin: 0; }
  @media print { body { background:#fff; } .slip { width:72mm; margin:0 auto; padding:2mm 0 4mm; box-shadow:none; } }
`;

/** Full page for the preview window, so the slip sits centered instead of stretching. */
export function slipPreviewDocument(innerHtml: string, title: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${SLIP_PREVIEW_CSS}</style></head><body>${innerHtml}</body></html>`;
}

// Printing integration: browser window (default) or local bridge (HTTP)
export type PrintMethod = 'browser' | 'bridge';

function getPrintSettings(): { method: PrintMethod; bridgeUrl: string; routeReceipt?: PrintMethod; routeKOT?: PrintMethod } {
  try {
    const method = (localStorage.getItem('print.method') as PrintMethod) || 'browser';
    const bridgeUrl = localStorage.getItem('print.bridgeUrl') || 'http://localhost:7777';
    const routeReceipt = (localStorage.getItem('print.route.receipt') as PrintMethod) || undefined;
    const routeKOT = (localStorage.getItem('print.route.kot') as PrintMethod) || undefined;
    return { method, bridgeUrl, routeReceipt, routeKOT };
  } catch {
    return { method: 'browser', bridgeUrl: 'http://localhost:7777' };
  }
}

function textToBase64(text: string) {
  // basic base64 for ASCII ESC/POS
  return btoa(unescape(encodeURIComponent(text)));
}

async function sendToBridge(kind: 'receipt' | 'kot', html: string, escpos: string) {
  const { bridgeUrl } = getPrintSettings();
  try {
    await fetch(`${bridgeUrl}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, html, escposBase64: textToBase64(escpos) })
    });
  } catch (e) {
    // Fallback to browser printing if bridge not available
    printHtml(kind === 'receipt' ? 'Receipt' : 'KOT', html);
  }
}

// Minimal ESC/POS text builders (monospace, 42 chars wide typical)
function escposHeader(text: string) { return `\x1B@\x1B!\x38${text}\n\x1B!\x00`; }
function escposLine() { return `\n------------------------------------------\n`; }

/** POS receipt, using the Restaurant & Bar template set in Document Templates. */
export function renderFbReceipt(args: Parameters<typeof buildReceiptHtml>[0] & {
  guestName?: string;
  guestCompany?: string;
  roomNumber?: string;
  paymentMethod?: string;
  paymentBrand?: string;
  tendered?: number;
  change?: number;
  aid?: string;
  authCode?: string;
  terminalId?: string;
  verification?: string;
  /** When the bill was paid (ISO). A reprint passes it so the slip keeps the original time. */
  billedAt?: string;
}): string {
  const settings = useSettingsStore.getState();
  const taxable = Math.max(0, args.subtotal - args.discount);
  const tax = salesTaxBreakdown(taxable);
  const where = [args.table ? `Table ${args.table}` : '', args.waiter ? `Server ${args.waiter}` : ''].filter(Boolean).join(' · ');
  return renderPrint('fb-receipt', settings.printing['fb-receipt'], {
    org: buildOrgProfile(settings),
    guest: {
      name: args.guestName || 'Walk-in',
      company: args.guestCompany,
      roomNumber: args.roomNumber,
    },
    tableNumber: args.table,
    docNumber: args.code,
    docDate: args.billedAt || new Date().toISOString(),
    title: 'Receipt',
    items: args.items.map((item) => ({
      description: item.name,
      qty: item.qty,
      unitPrice: item.price,
      amount: Math.round(item.price * item.qty * 100) / 100,
    })),
    totals: {
      subTotal: args.subtotal,
      discount: args.discount || undefined,
      taxes: { nhil: tax.nhil, gefl: tax.getfund, levy: tax.tourism, vat: tax.vat },
      grandTotal: args.total,
      payments: args.total,
      balance: 0,
    },
    footerNotes: [where, 'Thank you for dining with us.'].filter(Boolean),
    currency: '₵',
    attendantName: args.waiter,
    tender: args.paymentMethod ? {
      method: args.paymentMethod,
      brand: args.paymentBrand,
      amount: args.total,
      tendered: args.tendered,
      change: args.change,
      aid: args.aid,
      authCode: args.authCode,
      terminalId: args.terminalId,
      verification: args.verification,
    } : undefined,
  });
}

export function printReceipt(args: Parameters<typeof renderFbReceipt>[0]) {
  const html = renderFbReceipt(args);
  const { method, routeReceipt } = getPrintSettings();
  const effective = routeReceipt || method;
  if (effective === 'browser') return openHtmlPrintWindow(html);
  // ESC/POS text (very simple)
  const items = args.items.map(i => `${i.qty} x ${i.name}`.slice(0,42)).join('\n');
  const esc = `${escposHeader('RECEIPT')}${args.hotelName}\n${args.datetime}\n${escposLine()}${items}${escposLine()}Subtotal: ${args.subtotal.toFixed(2)}\nDiscount: ${args.discount.toFixed(2)}\nTOTAL: ${args.total.toFixed(2)}\n\nThank you!\n\x1DVA\x00`;
  return sendToBridge('receipt', html, esc);
}

export function previewReceipt(args: Parameters<typeof renderFbReceipt>[0]) {
  const html = renderFbReceipt(args);
  const w = window.open('', '_blank', 'noopener,noreferrer,width=480');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function printKOTDoc(args: { code: string; table: string; waiter: string; notes?: string; urgent?: boolean; title?: string; hotelName?: string; items: Array<{ name: string; qty: number }>; }) {
  const heading = args.title || 'KOT';
  const html = slipPreviewDocument(buildKOTHtml(args), heading);
  const { method, routeKOT } = getPrintSettings();
  const effective = routeKOT || method;
  if (effective === 'browser') return openHtmlPrintWindow(html);
  const items = args.items.map(i => `${i.qty} x ${i.name}`.slice(0,42)).join('\n');
  const esc = `${escposHeader(heading)}${args.code}\nTable ${args.table} • ${args.waiter}\n${args.urgent ? 'URGENT\n' : ''}${escposLine()}${items}${args.notes ? '\nNotes: '+args.notes : ''}\n\x1DVA\x00`;
  return sendToBridge('kot', html, esc);
}

export async function checkBridge(): Promise<boolean> {
  const { bridgeUrl } = getPrintSettings();
  try {
    const res = await fetch(`${bridgeUrl}/info`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}


