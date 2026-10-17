import type { PrintData, PrintMatrixRow } from './templates';
import { formatHotelDate } from '../settings/hotelDates';

/**
 * Workshop venue proforma from the GES March sheet: logo and contacts,
 * the date beside a boxed document number, the client, a day-by-day
 * facilities table, the numbered Ghana tax lines, and the accounts sign-off.
 */
export function renderWorkshopBillDocument(data: PrintData, boxLabel: string): string {
  const org = data.org;
  const guestName = (data.guest?.company && data.guest.company !== data.guest.name
    ? data.guest.company
    : data.guest?.name || data.guest?.company || '').trim();
  const location = (data.guest?.address || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line !== guestName);
  const logo = org.logoUrl
    ? `<img class="logo" src="${esc(org.logoUrl)}" alt="" />`
    : `<div class="logo-name">${esc(org.name || '')}</div>`;
  const contacts = [
    org.name ? `<div class="org-name">${esc(org.name)}</div>` : '',
    ...[org.address, org.phone ? `Tel. ${org.phone}` : '', org.email ? `Email: ${org.email}` : '', org.taxId ? `TIN: ${org.taxId}` : '']
      .filter(Boolean)
      .map(line => `<div>${esc(line!)}</div>`),
  ].join('');
  const table = facilitiesTable(data);
  const signed = (data.signatures || []).find(line => line.name);
  const signatureImage = (data.signatures || []).find(line => line.imageUrl)?.imageUrl;
  const signer = signed || (data.userName ? { name: data.userName, role: (data.signatures || []).find(line => line.role)?.role, label: '' } : undefined);
  const eventLines = (data.event?.summary || '').split('\n').map(line => line.trim()).filter(Boolean);

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(data.title || boxLabel)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 22px 28px; color: #111; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; }
  .head { display: flex; gap: 16px; align-items: flex-start; }
  .logo { width: 92px; height: auto; object-fit: contain; }
  .logo-name { width: 92px; font-weight: 800; font-size: 14px; line-height: 1.15; }
  .contacts { flex: 1; text-align: center; line-height: 1.35; }
  .contacts .org-name { font-weight: 800; font-size: 14px; }
  .meta { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 16px; }
  .invbox { border: 1px solid #111; display: flex; min-width: 180px; }
  .invbox span { padding: 4px 10px; font-weight: 700; }
  .invbox .word { border-right: 1px solid #111; }
  .client { margin-top: 14px; font-weight: 800; font-size: 14px; }
  .client .where { margin-top: 2px; font-weight: 400; font-size: 12px; line-height: 1.35; }
  h1 { margin: 12px 0 10px; text-align: center; font-size: 14px; text-decoration: underline; letter-spacing: 0.02em; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  col.day { width: 58px; }
  col.count { width: 108px; }
  col.rate { width: 100px; }
  col.sub { width: 112px; }
  th, td { border: 1px solid #111; padding: 4px 6px; vertical-align: middle; }
  th { text-align: center; font-weight: 700; background: #fff; }
  td.amt, th.amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.count, th.count { text-align: center; font-variant-numeric: tabular-nums; }
  td.mid { text-align: center; }
  .tax td.lead { border: none; }
  .tax td.label { text-align: right; font-weight: 600; }
  .tax td.amt { font-weight: 700; }
  .tax td.amt.plain { font-weight: 400; }
  ul { margin: 2px 0 0; padding-left: 16px; }
  .thanks { margin-top: 18px; }
  .sign { margin-top: 10px; }
  .sign-img { display: block; height: 78px; width: auto; max-width: 200px; object-fit: contain; object-position: left center; }
  .who { margin-top: 2px; font-weight: 700; }
  .role { font-weight: 400; }
  .event { margin-top: 12px; white-space: pre-line; }
</style></head><body>
<div class="head">
  ${logo}
  <div class="contacts">${contacts}</div>
</div>
<div class="meta">
  <div>${data.docDate ? esc(formatHotelDate(data.docDate)) : ''}</div>
  <div class="invbox"><span class="word">${esc(boxLabel)}</span><span>${esc(data.docNumber || '')}</span></div>
</div>
<div class="client"><div>${esc(guestName)}</div>${location.length ? `<div class="where">${location.map(line => esc(line)).join('<br>')}</div>` : ''}</div>
<h1>${esc((data.title || boxLabel).toUpperCase())}</h1>
${table}
<div class="thanks">Thank you for choosing ${esc(org.name || 'us')}</div>
${signatureImage || signer?.name ? `<div class="sign">${signatureImage ? `<img class="sign-img" src="${esc(signatureImage)}" alt="" />` : ''}${signer?.name ? `<div class="who">${esc(signer.name)}${signer.role ? `<div class="role">(${esc(signer.role)})</div>` : ''}</div>` : ''}</div>` : ''}
${eventLines.length ? `<div class="event">${eventLines.map(line => esc(line)).join('<br>')}</div>` : ''}
</body></html>`;
}

function facilitiesTable(data: PrintData): string {
  const currency = data.currency || 'GHS';
  const matrix = data.matrixTable;
  const columns = matrix?.columns || [];
  const rows = matrix?.rows?.length ? matrix.rows : rowsFromItems(data);
  const dayHead = columns.map(col => `<th>${esc(col.label)}</th>`).join('');
  const dateHead = columns.map(col => `<th>${esc(col.sublabel || '')}</th>`).join('');
  const head = columns.length
    ? `<tr><th rowspan="2">DATES &amp; FACILITIES</th>${dayHead}<th rowspan="2" class="count">TOTAL COUNT</th><th rowspan="2" class="amt">RATE ${esc(currency)}</th><th rowspan="2" class="amt">SUB TOTAL ${esc(currency)}</th></tr><tr>${dateHead}</tr>`
    : `<tr><th>DATES &amp; FACILITIES</th><th class="count">TOTAL COUNT</th><th class="amt">RATE ${esc(currency)}</th><th class="amt">SUB TOTAL ${esc(currency)}</th></tr>`;
  const body = rows.map(row => {
    const cells = columns.map(col => {
      const value = row.cells[col.key];
      return `<td class="mid">${value != null && value !== 0 ? esc(String(value)) : ''}</td>`;
    }).join('');
    const bullets = (row.bullets || []).map(item => `<li>${esc(item)}</li>`).join('');
    return `<tr>
      <td><div>${esc(row.label)}</div>${bullets ? `<ul>${bullets}</ul>` : ''}</td>
      ${cells}
      <td class="count">${row.totalCount ? esc(String(row.totalCount)) : ''}</td>
      <td class="amt">${row.rate != null ? esc(num(row.rate)) : ''}</td>
      <td class="amt">${esc(num(row.subtotal))}</td>
    </tr>`;
  }).join('');
  const lead = 1 + columns.length;
  const taxes = taxRows(data).map(line => `<tr class="tax">
      <td class="lead" colspan="${lead}"></td>
      <td class="label" colspan="2">${esc(line.label)}</td>
      <td class="amt${line.plain ? ' plain' : ''}">${esc(num(line.amount))}</td>
    </tr>`).join('');
  const cols = `<colgroup><col />${columns.map(() => '<col class="day" />').join('')}<col class="count" /><col class="rate" /><col class="sub" /></colgroup>`;
  return `<table>
    ${cols}
    <thead>${head}</thead>
    <tbody>${body}${taxes}</tbody>
  </table>`;
}

function rowsFromItems(data: PrintData): PrintMatrixRow[] {
  return (data.items || []).filter(item => item.amount || item.description).map(item => ({
    label: item.heading || item.description,
    bullets: item.bullets,
    cells: {},
    totalCount: item.qty || 0,
    rate: item.unitPrice,
    subtotal: item.amount,
  }));
}

function taxRows(data: PrintData): Array<{ label: string; amount: number; plain?: boolean }> {
  const stated = Number(data.totals.subTotal || 0);
  const fromRows = (data.matrixTable?.rows || []).reduce((sum, row) => sum + (row.subtotal || 0), 0)
    || (data.items || []).reduce((sum, item) => sum + (item.amount || 0), 0);
  const sub = fromRows > 0 ? fromRows : stated;
  const scale = stated > 0 && fromRows > 0 && Math.abs(fromRows - stated) > 0.5 ? fromRows / stated : 1;
  const taxes = data.totals.taxes || {};
  let gefl = round2(Number(taxes.gefl || 0) * scale);
  let nhil = round2(Number(taxes.nhil || 0) * scale);
  if (!gefl && nhil && sub > 0 && Math.abs(nhil / sub - 0.05) < 0.004) {
    gefl = round2(sub * 0.025);
    nhil = round2(nhil - gefl);
  }
  const vat = round2(Number(taxes.vat || 0) * scale);
  const levy = round2(Number(taxes.gtal || taxes.levy || 0) * scale);
  const covid = round2(Number(taxes.covid || 0) * scale);
  const parts: Array<{ label: string; amount: number; plain?: boolean }> = [];
  const roman = ['ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'];
  let index = 0;
  const push = (label: string, amount: number, plain = false) => {
    if (!amount) return;
    parts.push({ label: `(${roman[index]}) ${label}`, amount, plain });
    index += 1;
  };
  push(named('GEFL', gefl, sub), gefl, true);
  push(gefl ? named('NHIL', nhil, sub) : named('NHIL/GETFund', nhil, sub), nhil, true);
  push(named('VAT', vat, sub), vat, true);
  push(named('COVID-19 Levy', covid, sub), covid);
  push(levy && sub && Math.abs(levy / sub - 0.01) < 0.002 ? 'GTAL (1% of (i))' : named('Tourism Levy', levy, sub), levy, true);
  const listed = gefl + nhil + vat + levy + covid;
  const grand = scale === 1 && data.totals.grandTotal != null ? Number(data.totals.grandTotal) : round2(sub + listed);
  const lines = [
    { label: '(i) Tax Exclusive Value', amount: sub },
    ...parts,
    { label: `(${roman[index]}) Total Tax Inclusive Value`, amount: grand },
  ];
  if ((data.totals.payments || 0) > 0) {
    lines.push({ label: 'Amount paid', amount: Number(data.totals.payments) });
    if (data.totals.balance != null) lines.push({ label: 'Balance', amount: Number(data.totals.balance) });
  }
  return lines;
}

function named(label: string, amount: number, base: number): string {
  if (!amount || !base) return label;
  const pct = round2((amount / base) * 100);
  const text = Number.isInteger(pct) ? String(pct) : String(pct);
  return `${label} (${text}%)`;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(n: number): string {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ));
}
