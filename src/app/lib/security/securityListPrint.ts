import type { PrintOrgInfo } from '../print/templates';

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ));
}

/** A filtered security list: hotel letterhead, the date range, and the rows on screen. */
export function securityListPrintHtml(input: {
  org: PrintOrgInfo;
  title: string;
  rangeLabel: string;
  columns: string[];
  rows: string[][];
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
  const head = input.columns.map((col) => `<th>${esc(col)}</th>`).join('');
  const body = input.rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')
    || `<tr><td colspan="${input.columns.length}">Nothing in this date range.</td></tr>`;

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(input.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 22px 28px; color: #111; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; }
  .head { display: flex; gap: 16px; align-items: flex-start; }
  .logo { width: 92px; height: auto; object-fit: contain; }
  .logo-name { width: 92px; font-weight: 800; font-size: 14px; }
  .contacts { flex: 1; text-align: center; line-height: 1.35; }
  .org-name { font-weight: 800; font-size: 14px; }
  h1 { margin: 16px 0 4px; text-align: center; font-size: 14px; text-decoration: underline; letter-spacing: 0.02em; }
  .range { text-align: center; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 4px 6px; vertical-align: middle; }
  th { text-align: center; font-weight: 700; }
</style></head><body>
<div class="head">${logo}<div class="contacts">${contacts}</div></div>
<h1>${esc(input.title)}</h1>
<div class="range">${esc(input.rangeLabel)} · ${input.rows.length} ${input.rows.length === 1 ? 'row' : 'rows'}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}
