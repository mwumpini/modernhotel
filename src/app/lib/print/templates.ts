import { computeTotalsBreakdown } from './taxBreakdown';

export type PrintType =
  | 'receipt'
  | 'invoice'
  | 'proforma'
  | 'payment-voucher'
  // Events & Conferences — kept as their own document types (rather than reusing
  // 'invoice'/'proforma'/'receipt' with a data filter) so a template edited for
  // one never silently changes the other. See EventsConferencesMainDashboard's
  // accommodation/events split.
  | 'accommodation-proforma'
  | 'accommodation-invoice'
  | 'accommodation-receipt'
  | 'event-proforma'
  | 'event-invoice'
  | 'event-receipt'
  // Printed at check-in — guest/stay details + signature, no charges (nothing's
  // been billed yet). Kept as its own type rather than reusing 'accommodation-proforma'
  // so customizing one never silently changes the other (same reasoning as the
  // Events & Conferences split above).
  | 'registration-card';

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
  /** Recipient mailing address — shown by the letter-style recipient block
   *  (ATTN + "Dear Sir/Madam,") between the company name and attention line.
   *  Multi-line: each '\n' becomes its own line. */
  address?: string;
  roomNumber?: string;
  roomType?: string;
  roomRate?: number;
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
  /** Bold line shown above this item — groups a run of items under a category,
   *  e.g. "ACCOMMODATION 3rd – 7th April" or "CONFERENCE PACKAGE". */
  heading?: string;
  /** Short inclusions/features shown as a bullet list under the heading (or the
   *  description, if there's no heading) — e.g. "2 Coffee breaks", "Buffet Lunch". */
  bullets?: string[];
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

export interface PrintSignature {
  label: string;
  role?: string;
  name?: string;
  signedDate?: string;
}

export interface PrintBankDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branch?: string;
  mobileMoneyNumber?: string;
}

export interface PrintDebitCreditLine {
  accountName: string;
  details?: string;
  debit?: number;
  credit?: number;
}

export interface PrintMatrixColumn {
  /** Matches the keys used in each row's `cells`. */
  key: string;
  /** e.g. "Tue" */
  label: string;
  /** e.g. "8-Sep" */
  sublabel?: string;
}

export interface PrintMatrixRow {
  label: string;
  rate?: number;
  /** column key -> count for that day/column. */
  cells: Record<string, number>;
  totalCount: number;
  subtotal: number;
  /** Inclusions/features shown as a bullet list under the row label, e.g. a
   *  "Conference Package" row listing "Pen, Pad & Folder", "Use of Projector", … */
  bullets?: string[];
}

/** A calendar/pivot-style breakdown — categories (rows) x dates (columns), e.g. a
 *  conference quote's "Accommodation / Dinner / Lunch" per-day headcounts. An
 *  alternative to `items` for documents built from a day-by-day schedule; the two
 *  are not combined — a template uses one or the other for its line-items block. */
export interface PrintMatrixTable {
  columns: PrintMatrixColumn[];
  rows: PrintMatrixRow[];
  rateLabel?: string;
  totalCountLabel?: string;
  subtotalLabel?: string;
}

/** One day/entry within a schedule group's date breakdown — e.g. "Day 1, 13-Jul,
 *  79 pax, ₵630.00, ₵53,550.00" as a row under the "Conference Package" group. */
export interface PrintScheduleEntry {
  day: string;
  date?: string;
  qty?: number;
  unitPrice?: number;
  total: number;
}

/** One line item spanning several dates — e.g. "Lodging (breakfast included)"
 *  with a separate rate/total per night. Rendered with the item number and
 *  description merged (rowspan) down the left, one row per PrintScheduleEntry. */
export interface PrintScheduleGroup {
  description: string;
  bullets?: string[];
  entries: PrintScheduleEntry[];
}

/** Day-by-day breakdown with dates as ROWS grouped under each line item —
 *  the mirror image of PrintMatrixTable (dates as columns). An alternative
 *  to `items`/`matrixTable` for documents built this way, e.g. a workshop
 *  invoice itemizing lodging/meals/conference package per day. */
export interface PrintScheduleTable {
  groups: PrintScheduleGroup[];
  dayLabel?: string;
  dateLabel?: string;
  qtyLabel?: string;
  unitPriceLabel?: string;
  totalLabel?: string;
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
  paymentTerms?: string;
  bankDetails?: PrintBankDetails;
  signatures?: PrintSignature[];
  /** Payment Voucher lines — debit/credit rather than qty/price. When present, the
   *  line-items-table block renders these columns instead of `items`. */
  debitCreditLines?: PrintDebitCreditLine[];
  /** Day-by-day category matrix (see PrintMatrixTable) — when present, the
   *  matrix-table block renders this instead of a plain items list. */
  matrixTable?: PrintMatrixTable;
  /** Day-by-day schedule with dates as rows (see PrintScheduleTable) — when
   *  present, the schedule-table block renders this instead of a plain items list. */
  scheduleTable?: PrintScheduleTable;
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

export function money(n?: number, currency: string = '₵') {
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

function totalsTable(data: PrintData, currency: string) {
  const { preTaxLines, taxLines, grand, payments, balance } = computeTotalsBreakdown(data);
  const lines = [...preTaxLines, ...taxLines];
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
    ${totalsTable(p, currency)}
    ${p.footerNotes && p.footerNotes.length ? `<div class="footer">${p.footerNotes.map(n => `<div>${n}</div>`).join('')}</div>` : ''}
    <script>window.print()</script>
  </body></html>`;
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
    ${totalsTable(p, currency)}
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
    'simple-receipt': (p) => baseDoc(p, 'Receipt'),
    'checkout-bill-ghana': (p) => baseDoc(p, 'Check Out Bill'),
    'restaurant-receipt': (p) => baseDoc(p, 'Restaurant Receipt'),
    'accommodation-receipt': (p) => baseDoc(p, 'Accommodation Receipt'),
    'conference-receipt': (p) => baseDoc(p, 'Conference Receipt')
  },
  invoice: {
    'corporate-invoice': (p) => baseDoc(p, 'Invoice'),
    'final-bill': (p) => baseDoc(p, 'Final Bill for Accommodation & Meals'),
    'conference-invoice-grid': (p) => baseDoc(p, 'Conference Invoice'),
    'restaurant-invoice': (p) => baseDoc(p, 'Restaurant Invoice'),
    'minimal-invoice': (p) => baseDoc(p, 'Invoice'),
    'ghana-top-class-invoice': (p) => variantTopClassInvoice(p)
  },
  proforma: {
    'conference-proforma-grid': (p) => baseDoc(p, 'Proforma Invoice - Conference'),
    'accommodation-proforma': (p) => baseDoc(p, 'Proforma Invoice - Accommodation'),
    'event-proforma': (p) => baseDoc(p, 'Proforma Invoice - Event'),
    'restaurant-proforma': (p) => baseDoc(p, 'Restaurant Proforma'),
    'quote-simple': (p) => baseDoc(p, 'Quotation')
  },
  // No legacy hand-written layouts for Payment Vouchers or the Events & Conferences
  // document types below — served entirely by the block-based engine's built-in
  // presets (see print/blockDefaults.ts).
  'payment-voucher': {},
  'accommodation-proforma': {},
  'accommodation-invoice': {},
  'accommodation-receipt': {},
  'event-proforma': {},
  'event-invoice': {},
  'event-receipt': {},
  'registration-card': {}
};

export function listTemplates(type: PrintType): { key: string; name: string }[] {
  return Object.keys(printTemplates[type]).map(k => ({ key: k, name: k.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));
}


