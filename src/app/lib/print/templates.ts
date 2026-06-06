export type PrintType = 'receipt' | 'invoice' | 'proforma';

export interface PrintOrgInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  logoUrl?: string;
}

export interface PrintGuestInfo {
  name: string;
  company?: string;
  roomNumber?: string;
  roomType?: string;
  arrivalDate?: string;
  departureDate?: string;
  nights?: number;
}

export interface PrintLineItem {
  description: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  amount: number;
  date?: string;
}

export interface PrintTaxes {
  vat?: number; // absolute amount
  nhil?: number;
  levy?: number;
  covid?: number;
  gefl?: number;
  gtal?: number;
}

export interface PrintTotals {
  subTotal: number;
  taxes?: PrintTaxes;
  payments?: number;
  balance?: number;
  discount?: number;
  advance?: number;
  grandTotal?: number;
}

export interface PrintData {
  org: PrintOrgInfo;
  guest: PrintGuestInfo;
  docNumber?: string;
  docDate?: string;
  title?: string;
  items: PrintLineItem[];
  totals: PrintTotals;
  footerNotes?: string[];
  currency?: string; // e.g., GHS
}

function cssBase() {
  return `
  <style>
    :root { --fg:#111; --muted:#555; --border:#ddd; --brand:#222; }
    * { box-sizing:border-box; }
    body { font-family: Arial, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", sans-serif; color:var(--fg); margin:0; padding:24px; }
    h1,h2,h3,h4 { margin:0; }
    .header { display:flex; align-items:center; gap:16px; border-bottom:2px solid var(--border); padding-bottom:12px; }
    .logo { width:72px; height:72px; object-fit:contain; }
    .meta { margin-left:auto; text-align:right; font-size:12px; color:var(--muted); }
    .doc-title { margin:12px 0 8px; font-size:20px; font-weight:700; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:12px; }
    .box { border:1px solid var(--border); padding:8px; border-radius:6px; }
    table { width:100%; border-collapse:collapse; margin-top:12px; font-size:12px; }
    th, td { border:1px solid var(--border); padding:8px; }
    th { background:#f7f7f7; text-align:left; }
    .right { text-align:right; }
    .totals { width:50%; margin-left:auto; }
    .totals td { border:none; }
    .totals .label { color:var(--muted); }
    .totals .value { text-align:right; font-weight:600; }
    .grand { font-size:14px; border-top:2px solid var(--border); padding-top:6px; }
    .footer { margin-top:16px; font-size:11px; color:var(--muted); }
    .badge { padding:2px 6px; border:1px solid var(--border); border-radius:4px; font-size:11px; }
    @media print { body { padding:0; } .no-print { display:none !important; } }
  </style>`;
}

function money(n?: number, currency: string = '₵') {
  const v = Number(n || 0);
  return `${currency}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function header(org: PrintOrgInfo, title: string, docNumber?: string, docDate?: string) {
  return `
  <div class="header">
    ${org.logoUrl ? `<img class="logo" src="${org.logoUrl}" />` : ''}
    <div>
      <h2>${org.name || ''}</h2>
      <div style="font-size:12px;color:#555;">
        ${[org.address, org.phone, org.email, org.taxId ? `TIN: ${org.taxId}` : ''].filter(Boolean).join(' • ')}
      </div>
    </div>
    <div class="meta">
      ${docNumber ? `<div><span class="badge">No.</span> ${docNumber}</div>` : ''}
      ${docDate ? `<div>${new Date(docDate).toLocaleDateString()}</div>` : ''}
    </div>
  </div>
  <div class="doc-title">${title}</div>`;
}

function guestBlock(guest: PrintGuestInfo) {
  return `
  <div class="grid">
    <div class="box">
      <div style="font-weight:600; margin-bottom:6px;">Guest / Client</div>
      <div>${guest.name || ''}</div>
      ${guest.company ? `<div>${guest.company}</div>` : ''}
    </div>
    <div class="box">
      <div style="font-weight:600; margin-bottom:6px;">Stay Details</div>
      <div>Room: ${guest.roomNumber || ''} • ${guest.roomType || ''}</div>
      <div>Arrival: ${guest.arrivalDate || ''} • Departure: ${guest.departureDate || ''} • Nights: ${guest.nights ?? ''}</div>
    </div>
  </div>`;
}

function itemsTable(items: PrintLineItem[], currency: string) {
  const rows = items.map((it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${it.description}${it.date ? ` <span style="color:#777;">(${new Date(it.date).toLocaleDateString()})</span>` : ''}</td>
      <td class="right">${it.qty ?? ''}</td>
      <td>${it.unit || ''}</td>
      <td class="right">${it.unitPrice != null ? money(it.unitPrice, currency) : ''}</td>
      <td class="right">${money(it.amount, currency)}</td>
    </tr>
  `).join('');
  return `
  <table>
    <thead>
      <tr><th>#</th><th>Description</th><th class="right">Qty</th><th>Unit</th><th class="right">Rate</th><th class="right">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function totalsTable(t: PrintTotals, currency: string) {
  const lines: Array<[string, number | undefined, string?]> = [];
  lines.push(['Sub Total', t.subTotal]);
  if (t.discount) lines.push(['Discount', t.discount * -1]);
  if (t.advance) lines.push(['Advance', t.advance * -1]);
  if (t.taxes) {
    const { vat, nhil, levy, covid, gefl, gtal } = t.taxes;
    if (gefl) lines.push(['GEFL (2.5%)', gefl]);
    if (nhil) lines.push(['NHIL (2.5%)', nhil]);
    if (covid) lines.push(['COVID Levy (legacy)', covid]);
    if (levy) lines.push(['Tourism Levy (1%)', levy]);
    if (vat) lines.push(['VAT', vat]);
    if (gtal) lines.push(['GTAL (1%) of (0)', gtal]);
  }
  const taxesTotal = (t.taxes ? Object.values(t.taxes).reduce((s, v) => s + (v || 0), 0) : 0);
  const grand = t.grandTotal != null ? t.grandTotal : (t.subTotal - (t.discount || 0) - (t.advance || 0) + taxesTotal);
  const payments = t.payments || 0;
  const balance = t.balance != null ? t.balance : (grand - payments);
  const rows = lines.map(([label, val]) => `<tr><td class="label">${label}</td><td class="value">${money(val, currency)}</td></tr>`).join('');
  return `
  <table class="totals">
    <tbody>
      ${rows}
      <tr><td class="label grand">Grand Total</td><td class="value grand">${money(grand, currency)}</td></tr>
      <tr><td class="label">Payments</td><td class="value">${money(payments, currency)}</td></tr>
      <tr><td class="label">Balance</td><td class="value">${money(balance, currency)}</td></tr>
    </tbody>
  </table>`;
}

function baseDoc(p: PrintData, title: string) {
  const currency = p.currency || '₵';
  return `
  <!doctype html><html><head><meta charset="utf-8" />
  <title>${title}</title>
  ${cssBase()}
  </head><body>
    ${header(p.org, title, p.docNumber, p.docDate)}
    ${guestBlock(p.guest)}
    ${itemsTable(p.items, currency)}
    ${totalsTable(p.totals, currency)}
    ${p.footerNotes && p.footerNotes.length ? `<div class="footer">${p.footerNotes.map(n => `<div>${n}</div>`).join('')}</div>` : ''}
    <script>window.print()</script>
  </body></html>`;
}

// Variant helpers
function variantCompact(p: PrintData, title: string) {
  return baseDoc(p, title);
}
function variantGrid(p: PrintData, title: string) {
  // Same content; grid-like look already via table
  return baseDoc(p, title);
}
function variantDetailed(p: PrintData, title: string) {
  return baseDoc(p, title);
}
function variantRestaurant(p: PrintData, title: string) {
  return baseDoc(p, title);
}
function variantConference(p: PrintData, title: string) {
  return baseDoc(p, title);
}

// Premium hotel invoice layout with signatures block and notes
function variantTopClassInvoice(p: PrintData) {
  const currency = p.currency || '₵';
  const html = `
  <!doctype html><html><head><meta charset="utf-8" />
  <title>Invoice</title>
  ${cssBase()}
  <style>
    .brandbar { display:flex; align-items:center; gap:16px; margin-top:8px; }
    .watermark { position:fixed; inset:0; pointer-events:none; opacity:.03; font-size:96px; font-weight:800; display:flex; align-items:center; justify-content:center; }
    .signatures { display:grid; grid-template-columns: 1fr 1fr; gap:24px; margin-top:24px; }
    .sigbox { border-top:1px solid var(--border); padding-top:6px; text-align:center; font-size:12px; }
    .badges { display:flex; gap:6px; margin-top:6px; }
  </style>
  </head><body>
    <div class="watermark">INVOICE</div>
    ${header(p.org, 'Tax Invoice', p.docNumber, p.docDate)}
    <div class="brandbar">
      <div class="badges">
        <span class="badge">Ghana VAT/NHIL</span>
        <span class="badge">Tourism Levy</span>
      </div>
    </div>
    ${guestBlock(p.guest)}
    ${itemsTable(p.items, currency)}
    ${totalsTable(p.totals, currency)}
    ${p.footerNotes && p.footerNotes.length ? `<div class="footer">${p.footerNotes.map(n => `<div>${n}</div>`).join('')}</div>` : ''}
    <div class="signatures">
      <div class="sigbox">Guest Signature</div>
      <div class="sigbox">Cashier Signature</div>
    </div>
    <script>window.print()</script>
  </body></html>`;
  return html;
}

export const printTemplates: Record<PrintType, Record<string, (p: PrintData) => string>> = {
  receipt: {
    'simple-receipt': (p) => variantCompact(p, 'Receipt'),
    'checkout-bill-ghana': (p) => variantDetailed(p, 'Check Out Bill'),
    'restaurant-receipt': (p) => variantRestaurant(p, 'Restaurant Receipt'),
    'accommodation-receipt': (p) => variantDetailed(p, 'Accommodation Receipt'),
    'conference-receipt': (p) => variantConference(p, 'Conference Receipt')
  },
  invoice: {
    'corporate-invoice': (p) => variantDetailed(p, 'Invoice'),
    'final-bill': (p) => variantGrid(p, 'Final Bill for Accommodation & Meals'),
    'conference-invoice-grid': (p) => variantConference(p, 'Conference Invoice'),
    'restaurant-invoice': (p) => variantRestaurant(p, 'Restaurant Invoice'),
    'minimal-invoice': (p) => variantCompact(p, 'Invoice'),
    'ghana-top-class-invoice': (p) => variantTopClassInvoice(p)
  },
  proforma: {
    'conference-proforma-grid': (p) => variantConference(p, 'Proforma Invoice - Conference'),
    'accommodation-proforma': (p) => variantDetailed(p, 'Proforma Invoice - Accommodation'),
    'event-proforma': (p) => variantGrid(p, 'Proforma Invoice - Event'),
    'restaurant-proforma': (p) => variantRestaurant(p, 'Restaurant Proforma'),
    'quote-simple': (p) => variantCompact(p, 'Quotation')
  }
};

export function listTemplates(type: PrintType): { key: string; name: string }[] {
  return Object.keys(printTemplates[type]).map(k => ({ key: k, name: k.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));
}


