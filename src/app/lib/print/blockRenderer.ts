import type { PrintData, PrintLineItem } from './templates';
import { money } from './templates';
import type { BlockConfig, BlockTemplate, BlockType, TemplateStyle } from './blocks';
import { amountInWords } from './amountInWords';
import { computeTotalsBreakdown } from './taxBreakdown';

const ROMAN_LOWER = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];
function roman(n: number): string {
  return ROMAN_LOWER[n - 1] || String(n);
}

/** A label ... value line with a dotted leader between them, used by both the
 *  itemized-list line-items display and the numbered-list totals display. */
function leaderLine(label: string, value: string, opts?: { highlight?: boolean; bold?: boolean }): string {
  const bg = opts?.highlight ? ' background:#fff3b0; padding:4px 6px;' : '';
  const weight = opts?.bold || opts?.highlight ? ' font-weight:700;' : '';
  return `<div style="display:flex; align-items:baseline; gap:6px; margin:4px 0;${bg}${weight}">
    <span>${label}</span>
    <span style="flex:1; border-bottom:1px dotted #999; margin-bottom:3px;"></span>
    <span>${value}</span>
  </div>`;
}

/** Compact bullet list used for item/row "inclusions" (e.g. a Conference Package's
 *  "Pen, Pad & Folder", "Use of Projector", …). */
function renderBullets(bullets?: string[]): string {
  if (!bullets || !bullets.length) return '';
  return `<ul style="margin:2px 0 4px; padding-left:18px; font-size:0.92em; color:var(--muted);">
    ${bullets.map(b => `<li>${b}</li>`).join('')}
  </ul>`;
}

function fontStack(f: TemplateStyle['fontFamily']): string {
  switch (f) {
    case 'serif': return 'Georgia, "Times New Roman", serif';
    case 'mono': return '"Courier New", monospace';
    default: return 'Arial, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", sans-serif';
  }
}

function marginPx(m: TemplateStyle['pageMargin']): string {
  switch (m) {
    case 'compact': return '12px';
    case 'spacious': return '36px';
    default: return '24px';
  }
}

function logoSizePx(s: TemplateStyle['logoSize']): string {
  switch (s) {
    case 'sm': return '48px';
    case 'lg': return '96px';
    default: return '72px';
  }
}

function bodyFontSizePx(s: TemplateStyle['bodyFontSize']): string {
  switch (s) {
    case 'sm': return '11px';
    case 'lg': return '15px';
    default: return '13px';
  }
}

function borderWidthPx(w: TemplateStyle['borderWidth']): string {
  return w === 'thick' ? '2px' : '1px';
}

function headerFlexDirection(pos: TemplateStyle['logoPosition']): string {
  if (pos === 'right') return 'row-reverse';
  if (pos === 'center') return 'column';
  return 'row';
}

function styleBlock(style: TemplateStyle): string {
  const bw = borderWidthPx(style.borderWidth);
  const narrow = style.pageWidth === 'narrow';
  return `
  <style>
    :root { --fg:${style.textColor}; --muted:#555; --border:${style.borderColor}; --brand:${style.primaryColor}; --bw:${bw}; --radius:${style.corners === 'square' ? '0' : '6px'}; }
    * { box-sizing:border-box; }
    html, body { height:100%; }
    body { font-family: ${fontStack(style.fontFamily)}; font-size:${bodyFontSizePx(style.bodyFontSize)}; color:var(--fg); margin:0; padding:${marginPx(style.pageMargin)}; min-height:100%; display:flex; flex-direction:column; ${narrow ? 'max-width:320px; margin-left:auto; margin-right:auto;' : ''} }
    body > * { flex-shrink:0; }
    h1,h2,h3,h4 { margin:0; }
    .header { display:flex; flex-direction:${narrow ? 'column' : headerFlexDirection(style.logoPosition)}; align-items:center; ${style.logoPosition === 'center' || narrow ? 'text-align:center;' : ''} gap:16px; border-bottom:calc(var(--bw) + 1px) solid var(--brand); padding-bottom:12px; }
    .logo { width:${logoSizePx(style.logoSize)}; height:${logoSizePx(style.logoSize)}; object-fit:contain; }
    .meta { ${style.logoPosition === 'center' || narrow ? '' : 'margin-left:auto;'} text-align:${narrow ? 'center' : 'right'}; font-size:0.9em; color:var(--muted); }
    .doc-title { margin:12px 0 8px; font-size:1.55em; font-weight:700; color:var(--brand); }
    .grid { display:grid; grid-template-columns: ${narrow ? '1fr' : '1fr 1fr'}; gap:12px; }
    .box { border:var(--bw) solid var(--border); padding:8px; border-radius:var(--radius); }
    table { width:100%; border-collapse:separate; border-spacing:0; border:var(--bw) solid var(--border); margin-top:12px; ${narrow ? 'font-size:0.9em;' : ''} }
    th, td { border:none; padding:${narrow ? '4px' : '8px'}; }
    th + th, td + td { border-left:var(--bw) solid var(--border); }
    tr + tr th, tr + tr td { border-top:var(--bw) solid var(--border); }
    th { background:#f7f7f7; text-align:left; }
    /* One shared line per edge. A separate outer border sat outside the gray
       header and read as a second box around that row alone. */
    table.data-grid { border-collapse:collapse; border:none; }
    table.data-grid th, table.data-grid td { border:var(--bw) solid var(--border); }
    .bill-grid { width:${narrow ? '100%' : 'max-content'}; min-width:${narrow ? '0' : '50%'}; max-width:100%; margin-left:auto; border:var(--bw) solid var(--border); box-sizing:border-box; }
    .bill-grid table { width:100%; margin:0; border:none; }
    .bill-grid .lbl { white-space:${narrow ? 'normal' : 'nowrap'}; }
    .bill-grid .amt { white-space:nowrap; min-width:${narrow ? '0' : '11em'}; }
    .right { text-align:right; }
    .totals { width:${narrow ? '100%' : '50%'}; margin-left:auto; margin-top:0; border:none; }
    .totals td { border:none; padding:2px 8px; line-height:1.25; }
    .totals .label { color:var(--muted); text-align:left; }
    .totals .value { text-align:right; font-weight:600; }
    .grand { font-size:1.1em; border-top:calc(var(--bw) + 1px) solid var(--border); padding-top:6px; }
    .footer { margin-top:16px; font-size:0.85em; color:var(--muted); }
    .badge { padding:2px 6px; border:var(--bw) solid var(--border); border-radius:${style.corners === 'square' ? '0' : '4px'}; font-size:0.85em; }
    .watermark { position:fixed; inset:0; pointer-events:none; opacity:.05; font-size:96px; font-weight:800; display:flex; align-items:center; justify-content:center; color:var(--brand); }
    .sign-row { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; flex-direction:${narrow ? 'column' : 'row'}; gap:${narrow ? '14px' : '32px'}; width:100%; margin-top:12px; }
    .sign-slot { flex:${narrow ? '1 1 auto' : '1 1 140px'}; max-width:${narrow ? 'none' : '240px'}; ${narrow ? 'width:100%;' : ''} }
    .sign-line { border-bottom:1px solid var(--border); height:28px; }
    .custom-text { margin:12px 0; }
    .avoid-break { page-break-inside:avoid; break-inside:avoid; }
    @page { size: ${narrow ? '80mm auto' : 'A4'}; margin: ${narrow ? '3mm' : '12mm'}; }
    @media print {
      html, body { height:auto; }
      body { padding:0; min-height:${narrow ? '0' : '260mm'}; }
      .no-print { display:none !important; }
    }
  </style>`;
}

function boxBorderStyle(border?: BlockConfig['border']): string {
  if (border === 'none') return ' style="border:none; padding:0;"';
  if (border === 'thick') return ' style="border-width:2px;"';
  return '';
}

function renderLogo(_block: BlockConfig, data: PrintData): string {
  return data.org.logoUrl ? `<img class="logo" src="${data.org.logoUrl}" />` : '';
}

function renderCompanyInfo(_block: BlockConfig, data: PrintData): string {
  const { org } = data;
  return `
  <div>
    <h2>${org.name || ''}</h2>
    <div style="font-size:12px;color:#555;">
      ${[org.address, org.phone, org.email, org.taxId ? `TIN: ${org.taxId}` : ''].filter(Boolean).join(' • ')}
    </div>
  </div>`;
}

function renderDocMeta(block: BlockConfig, data: PrintData): string {
  return `
  <div class="meta">
    ${data.docNumber ? `<div><span class="badge">${block.docNumberLabel || 'No.'}</span> ${data.docNumber}</div>` : ''}
    ${data.docDate ? `<div>${new Date(data.docDate).toLocaleDateString()}</div>` : ''}
  </div>`;
}

function renderRecipientInfo(block: BlockConfig, data: PrintData): string {
  const { guest } = data;

  if (block.recipientDisplay === 'letter') {
    // Cover-letter style: plain stacked lines, no box, ending in a salutation —
    // matches how some hotels open a proforma as an addressed letter. Skip the
    // company line when it's just the same value as the attention name (e.g. an
    // Events & Conferences group booking made in the org's own name).
    const showCompanyLine = !!guest.company && guest.company !== guest.name;
    return `
    <div style="margin:12px 0;">
      ${showCompanyLine ? `<div style="font-weight:600;">${guest.company}</div>` : ''}
      ${guest.address ? `<div style="white-space:pre-line;">${guest.address}</div>` : ''}
      ${block.heading ? `<div>${block.heading}${guest.name ? `: ${guest.name}` : ''}</div>` : (guest.name ? `<div>${guest.name}</div>` : '')}
      <div style="margin-top:12px;">Dear Sir/Madam,</div>
    </div>`;
  }

  const hasStayDetails = !!(guest.roomNumber || guest.roomType || guest.arrivalDate || guest.departureDate || guest.nights != null);
  const boxStyle = boxBorderStyle(block.border);
  // When a company is billing for a DIFFERENTLY named guest (e.g. a corporate-
  // sponsored individual stay), label both explicitly — "Billing Person: <company>"
  // / "Guest Name: <name>" — instead of stacking bare values under one heading.
  // A booking made directly in the company's own name (company === name, as for
  // Events & Conferences group bookings) has nothing to disambiguate, so it stays
  // as a single line.
  const hasDistinctBillingParty = !!guest.company && guest.company !== guest.name;
  const box1Body = hasDistinctBillingParty
    ? `<div>${guest.company}</div>${guest.name ? `<div>Guest Name: ${guest.name}</div>` : ''}`
    : `<div>${guest.name || guest.company || ''}</div>`;
  return `
  <div class="grid">
    <div class="box"${boxStyle}>
      <div style="font-weight:600; margin-bottom:6px;">${block.heading || (hasDistinctBillingParty ? 'Billing Person' : 'Guest / Client')}</div>
      ${box1Body}
    </div>
    ${hasStayDetails ? `
    <div class="box"${boxStyle}>
      <div style="font-weight:600; margin-bottom:6px;">Stay Details</div>
      <div>Room: ${guest.roomNumber || ''} • ${guest.roomType || ''}</div>
      <div>Arrival: ${guest.arrivalDate ? new Date(guest.arrivalDate).toLocaleDateString() : ''} • Departure: ${guest.departureDate ? new Date(guest.departureDate).toLocaleDateString() : ''} • Nights: ${guest.nights ?? ''}</div>
    </div>` : ''}
  </div>`;
}

function renderMatrixTable(_block: BlockConfig, data: PrintData, currency: string): string {
  const m = data.matrixTable;
  if (!m || !m.columns.length || !m.rows.length) return '';
  const colHeaders = m.columns.map(c => `<th class="right">${c.label}${c.sublabel ? `<br/><span style="font-weight:400;">${c.sublabel}</span>` : ''}</th>`).join('');
  const rows = m.rows.map(r => {
    const cells = m.columns.map(c => `<td class="right">${r.cells[c.key] || ''}</td>`).join('');
    return `<tr>
      <td>${r.label}${renderBullets(r.bullets)}</td>
      ${cells}
      <td class="right">${r.totalCount || ''}</td>
      <td class="right">${r.rate != null ? money(r.rate, currency) : ''}</td>
      <td class="right">${money(r.subtotal, currency)}</td>
    </tr>`;
  }).join('');
  return `
  <table class="data-grid">
    <thead>
      <tr>
        <th>#</th>
        ${colHeaders}
        <th class="right">${m.totalCountLabel || 'Total Count'}</th>
        <th class="right">${m.rateLabel || 'Rate'}</th>
        <th class="right">${m.subtotalLabel || 'Sub Total'}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** The mirror image of renderMatrixTable — dates as ROWS grouped under each
 *  line item (item # and description merged down the left via rowspan) rather
 *  than dates as columns. Matches how some hotels break out a multi-day
 *  lodging/meals/conference-package quote one day per row instead of a pivot. */
function renderScheduleTable(_block: BlockConfig, data: PrintData, currency: string): string {
  const s = data.scheduleTable;
  if (!s || !s.groups.length) return '';
  const rows = s.groups.map((g, gi) => {
    const span = g.entries.length;
    if (!span) return '';
    return g.entries.map((e, ei) => `<tr>
      ${ei === 0 ? `<td rowspan="${span}">${gi + 1}</td><td rowspan="${span}">${g.description}${renderBullets(g.bullets)}</td>` : ''}
      <td>${e.day}</td>
      <td>${e.date ? new Date(e.date).toLocaleDateString() : ''}</td>
      <td class="right">${e.qty ?? ''}</td>
      <td class="right">${e.unitPrice != null ? money(e.unitPrice, currency) : ''}</td>
      <td class="right">${money(e.total, currency)}</td>
    </tr>`).join('');
  }).join('');
  return `
  <table class="data-grid">
    <thead>
      <tr>
        <th>#</th><th>Description</th>
        <th>${s.dayLabel || 'Day'}</th>
        <th>${s.dateLabel || 'Date'}</th>
        <th class="right">${s.qtyLabel || 'Qty'}</th>
        <th class="right">${s.unitPriceLabel || 'Unit Price'}</th>
        <th class="right">${s.totalLabel || 'Total Price'}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderLineItemsTable(block: BlockConfig, data: PrintData, currency: string): string {
  if (data.debitCreditLines && data.debitCreditLines.length) {
    const rows = data.debitCreditLines.map((l, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${l.accountName}${l.details ? ` <span style="color:#777;">(${l.details})</span>` : ''}</td>
        <td class="right">${l.debit ? money(l.debit, currency) : ''}</td>
        <td class="right">${l.credit ? money(l.credit, currency) : ''}</td>
      </tr>`).join('');
    return `
    <table class="data-grid">
      <thead><tr><th>#</th><th>Account</th><th class="right">Debit</th><th class="right">Credit</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  const items = data.items || [];
  const cols = block.columns || ['qty', 'unit', 'unitPrice', 'date'];
  const showQty = cols.includes('qty');
  const showUnit = cols.includes('unit');
  const showRate = cols.includes('unitPrice');

  if (block.lineItemsDisplay === 'simple') {
    const lines = items.map((it) => {
      const headingHtml = it.heading ? `<div style="font-weight:700; text-decoration:underline; margin-top:10px;">${it.heading}</div>` : '';
      const bulletsHtml = renderBullets(it.bullets);
      return `${headingHtml}${bulletsHtml}<div style="display:flex; justify-content:space-between; margin:6px 0;"><span>${it.description}</span><span>${money(it.amount, currency)}</span></div>`;
    }).join('');
    const roomy = block.border && block.border !== 'none' ? ' style="min-height:120px;"' : '';
    return `<div${roomy}>${lines}</div>`;
  }

  if (block.lineItemsDisplay === 'list') {
    return items.map((it) => {
      const headingHtml = it.heading ? `<div style="font-weight:700; text-decoration:underline; margin-top:10px;">${it.heading}</div>` : '';
      const bulletsHtml = renderBullets(it.bullets);
      const bits = [it.description];
      if (showQty && it.qty != null) bits.push(`${it.qty}${showUnit && it.unit ? ` ${it.unit}` : ''}`);
      if (showRate && it.unitPrice != null) bits.push(`@ ${money(it.unitPrice, currency)}`);
      if (cols.includes('date') && it.date) bits.push(new Date(it.date).toLocaleDateString());
      return headingHtml + bulletsHtml + leaderLine(bits.join(' — '), money(it.amount, currency));
    }).join('');
  }

  const rows = items.map((it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>
        ${it.heading ? `<div style="font-weight:700;">${it.heading}</div>` : ''}
        ${renderBullets(it.bullets)}
        ${it.description}${cols.includes('date') && it.date ? ` <span style="color:#777;">(${new Date(it.date).toLocaleDateString()})</span>` : ''}
      </td>
      ${showQty ? `<td class="right">${it.qty ?? ''}</td>` : ''}
      ${showUnit ? `<td>${it.unit || ''}</td>` : ''}
      ${showRate ? `<td class="right">${it.unitPrice != null ? money(it.unitPrice, currency) : ''}</td>` : ''}
      <td class="right">${money(it.amount, currency)}</td>
    </tr>`).join('');
  return `
  <table class="data-grid">
    <thead>
      <tr>
        <th>#</th><th>Description</th>
        ${showQty ? '<th class="right">Qty</th>' : ''}
        ${showUnit ? '<th>Unit</th>' : ''}
        ${showRate ? '<th class="right">Rate</th>' : ''}
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// --- Payslip-only blocks ---

function renderEmployeeDetails(block: BlockConfig, data: PrintData): string {
  const e = data.employee;
  if (!e) return '';
  const boxStyle = boxBorderStyle(block.border);
  const left: Array<[string, string]> = [
    ['Date of Joining', e.dateOfJoining ? new Date(e.dateOfJoining).toLocaleDateString() : ''],
    ['Pay Period', e.payPeriod || ''],
    ['Worked Days', e.workedDays != null ? String(e.workedDays) : ''],
  ];
  const right: Array<[string, string]> = [
    ['Employee Name', e.name || ''],
    ['Designation', e.position || ''],
    ['Department', e.department || ''],
  ];
  const col = (rows: Array<[string, string]>) => rows.map(([label, val]) => `<div>${label} : ${val}</div>`).join('');
  return `
  <div class="box"${boxStyle}>
    ${block.heading ? `<div style="font-weight:600; margin-bottom:6px;">${block.heading}</div>` : ''}
    <div style="display:flex; gap:24px;">
      <div style="flex:1;">${e.employeeNumber ? `<div>Employee No. : ${e.employeeNumber}</div>` : ''}${col(left)}</div>
      <div style="flex:1;">${col(right)}</div>
    </div>
  </div>`;
}

function payslipTable(block: BlockConfig, items: PrintLineItem[] | undefined, currency: string, totalLabel: string): string {
  const total = (items || []).reduce((s, it) => s + (it.amount || 0), 0);
  const sectionHeading = block.heading || (totalLabel === 'Total Earnings' ? 'Earnings' : 'Deductions');

  if (block.payslipItemsDisplay === 'list') {
    const lines = (items || []).map(it => leaderLine(it.description, money(it.amount, currency))).join('');
    return `
    <div>
      <div style="font-weight:700; text-decoration:underline;">${sectionHeading}</div>
      ${lines}
      ${leaderLine(totalLabel, money(total, currency), { bold: true })}
    </div>`;
  }

  const rows = (items || []).map(it => `
    <tr><td>${it.description}</td><td class="right">${money(it.amount, currency)}</td></tr>`).join('');
  return `
  <table class="data-grid">
    <thead><tr><th>${sectionHeading}</th><th class="right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td style="font-weight:700;">${totalLabel}</td><td class="right" style="font-weight:700;">${money(total, currency)}</td></tr></tfoot>
  </table>`;
}

function renderPayslipEarningsTable(block: BlockConfig, data: PrintData, currency: string): string {
  return payslipTable(block, data.earningsItems, currency, 'Total Earnings');
}

function renderPayslipDeductionsTable(block: BlockConfig, data: PrintData, currency: string): string {
  return payslipTable(block, data.deductionsItems, currency, 'Total Deductions');
}

function renderPayslipSummary(block: BlockConfig, data: PrintData, currency: string): string {
  const totalEarnings = (data.earningsItems || []).reduce((s, it) => s + (it.amount || 0), 0);
  const totalDeductions = (data.deductionsItems || []).reduce((s, it) => s + (it.amount || 0), 0);
  const netPay = totalEarnings - totalDeductions;
  const wordsHtml = block.showAmountInWords
    ? `<div style="margin-top:8px; font-style:italic;">${amountInWords(netPay)}</div>` : '';
  return `${boxedGridTable([
    { label: 'Total Earnings', value: money(totalEarnings, currency), bold: false },
    { label: 'Total Deductions', value: money(totalDeductions, currency), bold: false },
    { label: block.heading || 'Net Pay', value: money(netPay, currency), bold: true },
  ])}${wordsHtml}`;
}

/**
 * Right-hand bill grid. The box border lives on a wrapper, not the table: a
 * table's right edge is drawn outside its width, so a bold amount such as
 * ₵100,000.00 was covering that vertical line. The amount column keeps enough
 * room for a figure that wide, and the bold stays on subtotal and net total.
 */
function boxedGridTable(rows: Array<{ label: string; value: string; bold: boolean }>): string {
  if (!rows.length) return '';
  const edge = 'var(--bw) solid var(--border)';
  const body = rows.map((row, i) => {
    const weight = row.bold ? 'font-weight:700;' : '';
    const bottom = i === rows.length - 1 ? '' : `border-bottom:${edge};`;
    const labelCell = `border:none;${bottom}border-right:${edge};${weight}padding:4px 10px;text-align:left;text-transform:uppercase;`;
    const valueCell = `border:none;${bottom}${weight}padding:4px 12px;text-align:right;`;
    return `<tr><td class="lbl" style="${labelCell}">${row.label}</td><td class="amt" style="${valueCell}">${row.value}</td></tr>`;
  }).join('');
  return `<div class="bill-grid"><table style="border-collapse:separate;border-spacing:0;"><tbody>${body}</tbody></table></div>`;
}

/** Right-hand bill grid. `box` draws a border on every row, only the first, or only the last. */
function gridTotals(rows: Array<[string, string]>, box: 'all' | 'first' | 'last' | 'none', bold: 'all' | 'first' | 'last' | 'none'): string {
  if (!rows.length) return '';
  const boxedRows = rows.map(([label, value], i) => ({
    label,
    value,
    bold: bold === 'all' || (bold === 'first' && i === 0) || (bold === 'last' && i === rows.length - 1),
    boxed: box === 'all' || (box === 'first' && i === 0) || (box === 'last' && i === rows.length - 1),
  }));
  if (boxedRows.every(row => row.boxed)) return boxedGridTable(boxedRows);
  const body = boxedRows.map(row => {
    const border = row.boxed ? 'border:1px solid var(--border);' : 'border:none;';
    const weight = row.bold ? 'font-weight:700;' : '';
    return `<tr><td style="${border}${weight}padding:3px 8px; text-align:left; text-transform:uppercase;">${row.label}</td><td style="${border}${weight}padding:3px 8px; text-align:right;">${row.value}</td></tr>`;
  }).join('');
  return `<table style="width:50%; margin-left:auto; border-collapse:separate; border-spacing:0; margin-top:0;"><tbody>${body}</tbody></table>`;
}

function totalsTable(rows: Array<[string, number | undefined]>, currency: string): string {
  if (!rows.length) return '';
  return `<table class="totals"><tbody>${rows.map(([label, val]) => `<tr><td class="label">${label}</td><td class="value">${money(val, currency)}</td></tr>`).join('')}</tbody></table>`;
}

function renderTotalsSummary(block: BlockConfig, data: PrintData, currency: string): string {
  if (data.debitCreditLines && data.debitCreditLines.length) {
    const totalDebit = data.debitCreditLines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = data.debitCreditLines.reduce((s, l) => s + (l.credit || 0), 0);
    const wordsHtml = block.showAmountInWords
      ? `<div style="margin-top:8px; font-style:italic;">${amountInWords(totalDebit)}</div>` : '';
    return `${boxedGridTable([
      { label: 'Total Debit', value: money(totalDebit, currency), bold: true },
      { label: 'Total Credit', value: money(totalCredit, currency), bold: true },
    ])}${wordsHtml}`;
  }

  const numbered = block.totalsDisplay === 'numbered-list';
  const { preTaxLines, taxLines, taxesTotal, grand, payments, balance, hasBalanceInfo } = computeTotalsBreakdown(data);
  const lines: Array<[string, number | undefined]> = [
    [numbered ? 'Tax Exclusive Value' : preTaxLines[0][0], preTaxLines[0][1]],
    ...preTaxLines.slice(1),
    ...taxLines,
  ];
  const wordsHtml = block.showAmountInWords
    ? `<div style="margin-top:8px; font-style:italic;">${amountInWords(grand)}</div>` : '';

  // 3 lines only — subtotal, every tax collapsed into one combined line, grand
  // total — instead of breaking each tax out separately. Matches how some
  // hotels summarize the tax breakdown at a glance rather than itemizing it.
  if (block.totalsDisplay === 'compact-taxes') {
    return `${boxedGridTable([
      { label: preTaxLines[0][0], value: money(preTaxLines[0][1], currency), bold: true },
      ...preTaxLines.slice(1).map(([label, val]) => ({ label, value: money(val, currency), bold: false })),
      { label: taxLines.length ? `Sales Taxes Incl. (${taxLines.map(([label]) => label.replace(/\s*\([^)]*\)/, '')).join(', ')})` : 'Sales Taxes', value: money(taxesTotal, currency), bold: false },
      { label: 'Total Taxes Inclusive', value: money(grand, currency), bold: true },
    ])}${wordsHtml}`;
  }

  if (block.totalsDisplay === 'numbered-list') {
    const numberedLines = lines.map(([label, val], i) => leaderLine(`(${roman(i + 1)}) ${label}`, money(val, currency))).join('');
    const grandLabel = `Total Tax Inclusive Value (${lines.map((_, i) => roman(i + 1)).join('+')})`;
    const grandLine = leaderLine(`(${roman(lines.length + 1)}) ${grandLabel}`, money(grand, currency), { highlight: true });
    const paymentsLine = payments > 0 ? leaderLine('Payments', money(payments, currency)) : '';
    const balanceLine = hasBalanceInfo ? leaderLine('Balance', money(balance, currency), { bold: true }) : '';
    return `<div>${numberedLines}${grandLine}${paymentsLine}${balanceLine}</div>${wordsHtml}`;
  }

  return `${boxedGridTable([
    ...lines.map(([label, val], i) => ({ label, value: money(val, currency), bold: i === 0 })),
    { label: 'Grand Total', value: money(grand, currency), bold: true },
    { label: 'Payments', value: money(payments, currency), bold: false },
    { label: 'Balance', value: money(balance, currency), bold: true },
  ])}${wordsHtml}`;
}

// --- Granular blocks — each is one standalone line pulled from the same data
// doc-meta/company-info/recipient-info/totals-summary already read. ---

function renderDocTitle(block: BlockConfig, data: PrintData): string {
  const title = block.heading || data.title;
  return title ? `<div class="doc-title">${title}</div>` : '';
}

function renderDocNumber(block: BlockConfig, data: PrintData): string {
  if (!data.docNumber) return '';
  const label = block.docNumberLabel != null ? block.docNumberLabel : 'No.';
  // A bordered number already has its frame. A badge inside that frame is a second box.
  const labelHtml = !label ? '' : block.border ? `${label} ` : `<span class="badge">${label}</span> `;
  return `<div>${labelHtml}${data.docNumber}</div>`;
}

// heading, when set, prefixes the date as a plain label — e.g. "Date: 7 Jul 2026"
// — instead of the bare date (used by letter-style templates; the Checkout Bill
// preset leaves it unset and gets today's existing bare-date behavior).
function renderDocDate(block: BlockConfig, data: PrintData): string {
  return data.docDate ? `<div>${block.heading ? `${block.heading} ` : ''}${new Date(data.docDate).toLocaleDateString()}</div>` : '';
}

function renderCompanyName(_block: BlockConfig, data: PrintData): string {
  return data.org.name ? `<h2>${data.org.name}</h2>` : '';
}

function renderCompanyAddress(_block: BlockConfig, data: PrintData): string {
  return data.org.address ? `<div style="font-size:12px;color:#555;">${data.org.address}</div>` : '';
}

function renderCompanyContact(_block: BlockConfig, data: PrintData): string {
  const { org } = data;
  const parts = [org.phone, org.email, org.taxId ? `TIN: ${org.taxId}` : ''].filter(Boolean);
  return parts.length ? `<div style="font-size:12px;color:#555;">${parts.join(' • ')}</div>` : '';
}

function renderGuestDetails(block: BlockConfig, data: PrintData): string {
  const { guest } = data;
  if (block.guestDetailsDisplay === 'lines') {
    const billingLabel = block.heading || 'Billing Person';
    const billing = guest.company && guest.company !== guest.name ? guest.company : '';
    return `<div>
      <div>${billingLabel}: ${billing}</div>
      <div>GuestName: ${guest.name || ''}</div>
      <div style="white-space:pre-line;">Address: ${guest.address || ''}</div>
    </div>`;
  }
  const boxStyle = boxBorderStyle(block.border);
  // See renderRecipientInfo for why company === name skips the "Billing Person" split.
  const hasDistinctBillingParty = !!guest.company && guest.company !== guest.name;
  const body = hasDistinctBillingParty
    ? `<div>${guest.company}</div>${guest.name ? `<div>Guest Name: ${guest.name}</div>` : ''}`
    : `<div>${guest.name || guest.company || ''}</div>`;
  const address = guest.address ? `<div style="white-space:pre-line; margin-top:4px;">${guest.address}</div>` : '';
  // An explicit '' (as opposed to unset) suppresses the heading line — for a
  // minimal style that addresses the recipient directly with no label at all.
  const headingText = block.heading !== undefined ? block.heading : (hasDistinctBillingParty ? 'Billing Person' : 'Guest / Client');
  return `
  <div class="box"${boxStyle}>
    ${headingText ? `<div style="font-weight:600; margin-bottom:6px;">${headingText}</div>` : ''}
    ${body}
    ${address}
  </div>`;
}

function renderStayDetails(block: BlockConfig, data: PrintData, currency: string): string {
  const { guest } = data;
  const hasStayDetails = !!(guest.roomNumber || guest.roomType || guest.arrivalDate || guest.departureDate || guest.nights != null);
  if (!hasStayDetails) return '';
  const boxStyle = boxBorderStyle(block.border);

  if (block.stayDetailsDisplay === 'grid') {
    const left: Array<[string, string]> = [
      ['Room No', guest.roomNumber || ''],
      ['Room Type', guest.roomType || ''],
      ['No of Night(s) Stayed', guest.nights != null ? String(guest.nights) : ''],
    ];
    const right: Array<[string, string]> = [
      ['Room Rate', guest.roomRate != null ? money(guest.roomRate, currency) : ''],
      ['Arrival Date', guest.arrivalDate ? new Date(guest.arrivalDate).toLocaleDateString() : ''],
      ['Departure Date', guest.departureDate ? new Date(guest.departureDate).toLocaleDateString() : ''],
    ];
    const col = (rows: Array<[string, string]>) => rows.map(([label, val]) => `<div>${label} : ${val}</div>`).join('');
    return `
    <div class="box"${boxStyle}>
      ${block.heading ? `<div style="font-weight:600; margin-bottom:6px;">${block.heading}</div>` : ''}
      <div style="display:flex; gap:24px;">
        <div style="flex:1;">${col(left)}</div>
        <div style="flex:1;">${col(right)}</div>
      </div>
    </div>`;
  }

  return `
  <div class="box"${boxStyle}>
    <div style="font-weight:600; margin-bottom:6px;">${block.heading || 'Stay Details'}</div>
    <div>Room: ${guest.roomNumber || ''} • ${guest.roomType || ''}</div>
    <div>Arrival: ${guest.arrivalDate ? new Date(guest.arrivalDate).toLocaleDateString() : ''} • Departure: ${guest.departureDate ? new Date(guest.departureDate).toLocaleDateString() : ''} • Nights: ${guest.nights ?? ''}</div>
  </div>`;
}

function renderTotalsSubtotal(block: BlockConfig, data: PrintData, currency: string): string {
  const lines = computeTotalsBreakdown(data).preTaxLines;
  if (block.totalsDisplay === 'grid') {
    return gridTotals(lines.map(([label, val]) => [label, money(val, currency)]), 'first', 'first');
  }
  return totalsTable(lines, currency);
}

function renderTotalsTaxes(block: BlockConfig, data: PrintData, currency: string): string {
  const lines = computeTotalsBreakdown(data).taxLines;
  if (block.totalsDisplay === 'grid') {
    return gridTotals(lines.map(([label, val]) => [label, money(val, currency)]), 'all', 'none');
  }
  return totalsTable(lines, currency);
}

function renderTotalsPayments(block: BlockConfig, data: PrintData, currency: string): string {
  const { payments } = computeTotalsBreakdown(data);
  if (!payments) return '';
  if (block.totalsDisplay === 'grid') {
    return gridTotals([[block.heading || 'Payments', money(payments, currency)]], 'none', 'none');
  }
  return `<table class="totals"><tbody><tr><td class="label">${block.heading || 'Payments'}</td><td class="value">${money(payments, currency)}</td></tr></tbody></table>`;
}

function renderTotalsBalance(block: BlockConfig, data: PrintData, currency: string): string {
  const { balance, hasBalanceInfo } = computeTotalsBreakdown(data);
  if (!hasBalanceInfo) return '';
  if (block.totalsDisplay === 'grid') {
    return gridTotals([[block.heading || 'Balance', money(balance, currency)]], 'all', 'all');
  }
  return `<table class="totals"><tbody><tr><td class="label grand">${block.heading || 'Balance'}</td><td class="value grand">${money(balance, currency)}</td></tr></tbody></table>`;
}

function renderTotalsGrandTotal(block: BlockConfig, data: PrintData, currency: string): string {
  const { grand } = computeTotalsBreakdown(data);
  const wordsHtml = block.showAmountInWords
    ? `<div style="margin-top:8px; font-style:italic;${block.align === 'center' ? ' text-align:center;' : ''}">${amountInWords(grand)}</div>` : '';
  if (block.totalsDisplay === 'grid') {
    return `${gridTotals([[block.heading || 'Grand Total', money(grand, currency)]], 'all', 'all')}${wordsHtml}`;
  }
  return `<table class="totals"><tbody><tr><td class="label grand">${block.heading || 'Grand Total'}</td><td class="value grand">${money(grand, currency)}</td></tr></tbody></table>${wordsHtml}`;
}

function renderNotesText(block: BlockConfig, data: PrintData): string {
  const lines = (data.footerNotes && data.footerNotes.length) ? data.footerNotes : (block.text ? [block.text] : []);
  if (!lines.length) return '';
  // white-space:pre-line preserves line breaks typed into the block's own static
  // text textarea (footerNotes entries are already one-line-per-array-item, so
  // this only matters for the block.text fallback) without needing to split HTML.
  return `<div class="footer" style="white-space:pre-line;">${lines.map(n => `<div>${n}</div>`).join('')}</div>`;
}

function partySignatureEntries(block: BlockConfig, data: PrintData): Array<{ label: string; name?: string; role?: string }> | null {
  const parties = block.signatureParties;
  if (!parties || parties === 'custom') return null;
  const guestName = data.guest?.name || undefined;
  const staff = { label: block.staffSignLabel || 'Staff', name: data.userName };
  const guest = block.guestSignature === 'name'
    ? { label: block.guestSignLabel || guestName || 'Guest', name: block.guestSignLabel ? guestName : undefined }
    : { label: block.guestSignLabel || 'Guest', name: guestName };
  const customer = { label: 'Customer', name: guestName };
  const attendant = { label: 'Attendant', name: data.attendantName };
  const user = { label: 'User', name: data.userName };
  if (parties === 'guest') return [guest];
  if (parties === 'staff') return [staff];
  if (parties === 'staff-guest') return [guest, staff];
  if (parties === 'customer-attendant') return [customer, attendant];
  if (parties === 'user') return [user];
  return [customer, attendant, user];
}

function signatureEntries(block: BlockConfig, data: PrintData): Array<{ label: string; name?: string; role?: string; signedDate?: string }> {
  const parties = partySignatureEntries(block, data);
  if (parties) return parties;
  if (data.signatures && data.signatures.length) {
    return data.signatures.map(s => ({ label: s.label, name: s.name, role: s.role, signedDate: s.signedDate }));
  }
  if (block.signatures && block.signatures.length) return block.signatures;
  return [{ label: 'Signature' }, { label: 'Signature' }];
}

function renderSignatureBlock(block: BlockConfig, data: PrintData): string {
  const entries = signatureEntries(block, data);
  return `<div class="sign-row">${entries.map((e, i) => `
      <div class="sign-slot">
        <div>${e.label}:</div>
        <div class="sign-line"></div>
        ${e.name ? `<div style="margin-top:2px;">${e.name}</div>` : ''}
        ${e.role ? `<div style="font-size:12px; color:#555;">${e.role}</div>` : ''}
        ${e.signedDate ? `<div style="font-size:12px; color:#555;">${new Date(e.signedDate).toLocaleDateString()}</div>` : ''}
        ${i === 0 && block.signatureNote ? `<div style="margin-top:10px;">${block.signatureNote}</div>` : ''}
      </div>`).join('')}</div>`;
}

function renderBankDetails(block: BlockConfig, data: PrintData): string {
  const b = data.bankDetails;
  if (!b) return '';
  const rows = [
    b.bankName ? `Bank: ${b.bankName}` : '',
    b.accountName ? `Account Name: ${b.accountName}` : '',
    b.accountNumber ? `Account No.: ${b.accountNumber}` : '',
    b.branch ? `Branch: ${b.branch}` : '',
    b.mobileMoneyNumber ? `Mobile Money: ${b.mobileMoneyNumber}` : '',
  ].filter(Boolean);
  if (!rows.length) return '';
  const boxStyle = boxBorderStyle(block.border);
  const mergedStyle = boxStyle ? boxStyle.replace('style="', 'style="margin-top:12px; ') : ' style="margin-top:12px;"';
  return `
  <div class="box"${mergedStyle}>
    <div style="font-weight:600; margin-bottom:6px;">${block.heading || 'Payment Details'}</div>
    ${rows.map(r => `<div>${r}</div>`).join('')}
  </div>`;
}

function interpolate(text: string, data: PrintData): string {
  const dict: Record<string, string> = {
    'org.name': data.org.name || '',
    'docNumber': data.docNumber || '',
    'docDate': data.docDate ? new Date(data.docDate).toLocaleDateString() : '',
    'guest.name': data.guest.name || '',
    'totals.grandTotal': data.totals.grandTotal != null ? money(data.totals.grandTotal, data.currency) : '',
    'paymentTerms': data.paymentTerms || '',
  };
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => (key in dict ? dict[key] : ''));
}

function renderCustomText(block: BlockConfig, data: PrintData): string {
  if (!block.text) return '';
  return `<div class="custom-text" style="white-space:pre-line;">${interpolate(block.text, data)}</div>`;
}

function renderTermsConditions(block: BlockConfig): string {
  const sections = block.termsSections;
  if (!sections || !sections.length) return '';
  return `
  <div style="margin-top:16px; border-top:1px solid var(--border); padding-top:10px; font-size:0.9em;">
    ${sections.map(s => `
      <div style="margin-top:8px;">
        <div style="font-weight:700; text-decoration:underline;">${s.heading}</div>
        <div style="color:var(--muted);">${s.body}</div>
      </div>`).join('')}
  </div>`;
}

/**
 * Structural block — lays its children out as a row or column with a gap,
 * each child weighted by `flexWeight` (row only). Each child goes through the
 * exact same renderBlock+wrapBlock pipeline as any top-level block, including
 * `container` itself — that's what gives arbitrary nesting depth for free.
 */
function billGridParts(block: BlockConfig, data: PrintData, currency: string): { rows: Array<{ label: string; value: string; bold: boolean }>; words: string } | null {
  if (block.totalsDisplay !== 'grid') return null;
  const breakdown = computeTotalsBreakdown(data);
  if (block.type === 'totals-subtotal') {
    return {
      rows: breakdown.preTaxLines.map(([label, val], i) => ({ label, value: money(val, currency), bold: i === 0 })),
      words: '',
    };
  }
  if (block.type === 'totals-taxes') {
    return {
      rows: breakdown.taxLines.map(([label, val]) => ({ label, value: money(val, currency), bold: false })),
      words: '',
    };
  }
  if (block.type === 'totals-payments') {
    if (!breakdown.payments) return { rows: [], words: '' };
    return { rows: [{ label: block.heading || 'Payments', value: money(breakdown.payments, currency), bold: false }], words: '' };
  }
  if (block.type === 'totals-balance') {
    if (!breakdown.hasBalanceInfo) return { rows: [], words: '' };
    return { rows: [{ label: block.heading || 'Balance', value: money(breakdown.balance, currency), bold: true }], words: '' };
  }
  if (block.type === 'totals-grandtotal') {
    const words = block.showAmountInWords
      ? `<div style="margin-top:8px; font-style:italic;${block.align === 'center' ? ' text-align:center;' : ''}">${amountInWords(breakdown.grand)}</div>`
      : '';
    return { rows: [{ label: block.heading || 'Grand Total', value: money(breakdown.grand, currency), bold: true }], words };
  }
  return null;
}

function renderJoinedTable(children: BlockConfig[], data: PrintData, currency: string): string | null {
  const parts = children.map(child => billGridParts(child, data, currency));
  if (parts.some(part => part === null)) return null;
  const rows = parts.flatMap(part => part!.rows);
  const words = parts.map(part => part!.words).join('');
  if (!rows.length) return words;
  return `${boxedGridTable(rows)}${words}`;
}

function renderContainer(block: BlockConfig, data: PrintData, currency: string): string {
  const children = (block.children || []).filter(c => c.visible).sort((a, b) => a.order - b.order);
  if (!children.length) return '';
  if (block.joinTable) {
    const joined = renderJoinedTable(children, data, currency);
    if (joined) return joined;
  }
  const direction = block.direction || 'row';
  const gap = gapPx(block.gap) ?? '16px';
  const cells = children
    .map(child => {
      const html = wrapBlock(renderBlock(child, data, currency), child);
      if (!html) return '';
      const weight = direction === 'row' ? (child.flexWeight ?? 1) : undefined;
      const flexCss = weight === 0 ? '0 0 auto' : `${weight}`;
      return weight !== undefined ? `<div style="flex:${flexCss}; min-width:0;">${html}</div>` : `<div>${html}</div>`;
    })
    .filter(Boolean);
  if (!cells.length) return '';
  const alignItems = direction === 'row' ? 'center' : 'stretch';
  return `<div style="display:flex; flex-direction:${direction}; gap:${gap}; align-items:${alignItems};">${cells.join('')}</div>`;
}

function renderBlock(block: BlockConfig, data: PrintData, currency: string): string {
  switch (block.type) {
    case 'container': return renderContainer(block, data, currency);
    case 'logo': return renderLogo(block, data);
    case 'company-info': return renderCompanyInfo(block, data);
    case 'doc-meta': return renderDocMeta(block, data);
    case 'recipient-info': return renderRecipientInfo(block, data);
    case 'doc-title': return renderDocTitle(block, data);
    case 'doc-number': return renderDocNumber(block, data);
    case 'doc-date': return renderDocDate(block, data);
    case 'company-name': return renderCompanyName(block, data);
    case 'company-address': return renderCompanyAddress(block, data);
    case 'company-contact': return renderCompanyContact(block, data);
    case 'guest-details': return renderGuestDetails(block, data);
    case 'stay-details': return renderStayDetails(block, data, currency);
    case 'totals-subtotal': return renderTotalsSubtotal(block, data, currency);
    case 'totals-taxes': return renderTotalsTaxes(block, data, currency);
    case 'totals-payments': return renderTotalsPayments(block, data, currency);
    case 'totals-balance': return renderTotalsBalance(block, data, currency);
    case 'totals-grandtotal': return renderTotalsGrandTotal(block, data, currency);
    case 'line-items-table': return renderLineItemsTable(block, data, currency);
    case 'matrix-table': return renderMatrixTable(block, data, currency);
    case 'schedule-table': return renderScheduleTable(block, data, currency);
    case 'totals-summary': return renderTotalsSummary(block, data, currency);
    case 'notes-text': return renderNotesText(block, data);
    case 'signature-block': return renderSignatureBlock(block, data);
    case 'bank-details': return renderBankDetails(block, data);
    case 'custom-text': return renderCustomText(block, data);
    case 'terms-conditions': return renderTermsConditions(block);
    case 'employee-details': return renderEmployeeDetails(block, data);
    case 'payslip-earnings-table': return renderPayslipEarningsTable(block, data, currency);
    case 'payslip-deductions-table': return renderPayslipDeductionsTable(block, data, currency);
    case 'payslip-summary': return renderPayslipSummary(block, data, currency);
    default: return '';
  }
}

// Legacy-only special row: 'company-info'/'doc-meta' (the old bundled blocks) still
// render in their own flex row for backward compatibility with already-saved
// templates. 'logo' is deliberately NOT here — it flows as a normal body block so
// it can be grouped side-by-side with the granular blocks (Company Name, Document
// Title, …) via columnSpan:'half', same as anything else.
const HEADER_BLOCK_TYPES: BlockType[] = ['company-info', 'doc-meta'];

// These block types render their own internal bordered box (via boxBorderStyle),
// so the generic per-block border wrapper below skips them to avoid a double box.
// They still get underline/alignment from the generic wrapper like anything else.
export const SELF_BORDERED_TYPES: BlockType[] = ['recipient-info', 'bank-details', 'guest-details', 'stay-details', 'employee-details'];

// Multi-row/structural blocks that should never split across a printed page —
// a signature box or a totals section cut in half mid-print reads as broken.
const NO_BREAK_TYPES: BlockType[] = [
  'line-items-table', 'matrix-table', 'schedule-table', 'signature-block', 'terms-conditions',
  'recipient-info', 'guest-details', 'stay-details', 'bank-details',
  'totals-summary', 'totals-subtotal', 'totals-taxes', 'totals-payments', 'totals-balance', 'totals-grandtotal',
  'employee-details', 'payslip-earnings-table', 'payslip-deductions-table', 'payslip-summary',
];

/** Shared None/Small/Medium/Large -> px scale for both Spacing Above (vertical)
 *  and Indent (horizontal) — 'none' collapses the gap to 0, unset leaves the
 *  browser/CSS default alone. */
function gapPx(s?: 'none' | 'small' | 'medium' | 'large'): string | undefined {
  switch (s) {
    case 'none': return '0';
    case 'small': return '16px';
    case 'medium': return '32px';
    case 'large': return '48px';
    default: return undefined;
  }
}

/** Wraps one rendered body block with its alignment/underline/border/spacing/
 *  indent, skipping empty output so an empty wrapper div never shows up (e.g.
 *  bank-details with no data supplied). This is the "format a single line like
 *  in Word" control — every body block gets it, not just the couple of types
 *  that used to. */
function wrapBlock(html: string, block: BlockConfig): string {
  if (!html) return '';
  const styles: string[] = [];
  if (block.align && block.align !== 'left') styles.push(`text-align:${block.align}`);
  if (block.underline) styles.push('text-decoration:underline');
  if (block.border && block.border !== 'none' && !SELF_BORDERED_TYPES.includes(block.type)) {
    const bw = block.border === 'thick' ? '2px' : '1px';
    styles.push(`border:${bw} solid var(--border)`, 'padding:8px', 'border-radius:var(--radius, 6px)');
  }
  if (block.dividerBelow) styles.push('border-bottom:1px solid var(--border)', 'padding-bottom:12px');
  if (block.background) {
    styles.push(`background:${block.background}`, 'padding:16px', 'border-radius:6px');
    if (block.backgroundTextColor) styles.push(`color:${block.backgroundTextColor}`);
  }
  if (block.spacing === 'bottom') styles.push('margin-top:auto');
  else {
    const mt = gapPx(block.spacing);
    if (mt !== undefined) styles.push(`margin-top:${mt}`);
  }
  const ml = gapPx(block.indent);
  if (ml !== undefined) styles.push(`margin-left:${ml}`);
  const nudgeX = Math.round(block.offsetX || 0) * 16;
  const nudgeY = Math.round(block.offsetY || 0) * 16;
  if (nudgeX || nudgeY) styles.push(`transform:translate(${nudgeX}px,${nudgeY}px)`);
  if (block.style?.fontSize === 'sm') styles.push('font-size:0.85em');
  if (block.style?.fontSize === 'lg') styles.push('font-size:1.25em');
  if (block.style?.bold) styles.push('font-weight:700');
  const cls = NO_BREAK_TYPES.includes(block.type) ? ' class="avoid-break"' : '';
  return (styles.length || cls) ? `<div${cls} style="${styles.join('; ')};">${html}</div>` : html;
}

/** Lays out visible body blocks top-to-bottom. Any *run* of consecutive
 *  `columnSpan:'half'` blocks — two, three, or more, e.g. Document Number +
 *  Document Date + a third block all marked "Half width" — shares one row,
 *  evenly split; a lone half block (no half neighbor next to it) just renders
 *  full-width, same as 'full'. */
function composeBodyHtml(blocks: BlockConfig[], data: PrintData, currency: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.columnSpan === 'half') {
      const run: BlockConfig[] = [b];
      let j = i + 1;
      while (j < blocks.length && blocks[j].columnSpan === 'half') {
        run.push(blocks[j]);
        j++;
      }
      if (run.length > 1) {
        const cells = run.map(rb => wrapBlock(renderBlock(rb, data, currency), rb));
        if (cells.some(Boolean)) {
          // Top-align, not center — two side-by-side blocks of different heights
          // (e.g. a Payslip's Earnings/Deductions tables with different row
          // counts) should start flush at the same top edge, not have the
          // shorter one pushed down to stay vertically centered against the taller one.
          out.push(`<div style="display:flex; gap:16px; align-items:flex-start;">${cells.map(c => `<div style="flex:1; min-width:0;">${c}</div>`).join('')}</div>`);
        }
        i = j;
        continue;
      }
      // Isolated half block (no adjacent half neighbor) — fall through to full-width below.
    }
    out.push(wrapBlock(renderBlock(b, data, currency), b));
    i++;
  }
  return out.join('');
}

/** Renders a user-configured (or built-in) block template against real print data
 *  into a full HTML document, in the same shape the legacy hand-written templates
 *  (templates.ts) produce — a drop-in replacement wherever those are used. */
export function renderBlockTemplate(template: BlockTemplate, data: PrintData): string {
  const currency = data.currency || '₵';
  const style = template.style;
  const visible = template.blocks.filter(b => b.visible).sort((a, b) => a.order - b.order);
  // 'logo' joins the legacy header row only when a legacy company-info/doc-meta
  // block is actually present (an already-saved old template) — otherwise it
  // flows as a normal body block so it can be grouped with the granular blocks.
  const hasLegacyHeaderBlock = visible.some(b => HEADER_BLOCK_TYPES.includes(b.type));
  const isHeaderBlock = (b: BlockConfig) => HEADER_BLOCK_TYPES.includes(b.type) || (hasLegacyHeaderBlock && b.type === 'logo');
  const headerBlocks = visible.filter(isHeaderBlock);
  const bodyBlocks = visible.filter(b => !isHeaderBlock(b));

  const headerHtml = headerBlocks.length
    ? `<div class="header">${headerBlocks.map(b => renderBlock(b, data, currency)).join('')}</div>`
    : '';
  // A standalone doc-title block (if the template has one) renders in its own
  // ordered position via composeBodyHtml below; otherwise fall back to the title
  // always appearing right after the header, exactly as every template did before
  // doc-title existed as a block.
  const hasTitleBlock = visible.some(b => b.type === 'doc-title');
  const titleHtml = (!hasTitleBlock && data.title) ? `<div class="doc-title">${data.title}</div>` : '';
  const bodyHtml = composeBodyHtml(bodyBlocks, data, currency);
  const watermarkHtml = style.showWatermark
    ? `<div class="watermark">${style.watermarkText || data.title || ''}</div>`
    : '';

  return `
  <!doctype html><html><head><meta charset="utf-8" />
  <title>${data.title || template.name}</title>
  ${styleBlock(style)}
  </head><body>
    ${watermarkHtml}
    ${headerHtml}
    ${titleHtml}
    ${bodyHtml}
    <script>window.print()</script>
  </body></html>`;
}
