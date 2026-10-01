/**
 * Shapes report data (either a row array, or a single summary object with
 * primitive/nested-object/array fields — see FrontOfficeReportsAnalysis.tsx's
 * renderReportTable/ReportSummarySection for the on-screen equivalent) into
 * one or more flat column/row sections, then serializes those to real CSV
 * or Excel-openable HTML. Both export formats share this shaping so a
 * report's CSV and Excel output always match what's on screen.
 */

import { openHtmlPrintWindow } from '../print/engine';

export type ExportSection = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

/** Report fields that hold a share of 0-100 (occupancy, discount %, approval rate...). Matched by
 * name because plenty of other "...Rate" fields (averageDailyRate, originalRate) are money. */
export function isPercentKey(key: string): boolean {
  return key === 'percentage' || key.endsWith('Percentage') || key === 'occupancyRate' || key === 'approvalRate';
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/** Whole-number fields (a count of things, not an amount of money) — most numeric report
 * fields ARE money, so this is a small explicit exception list rather than trying to guess
 * "looks like money" from the value itself (a ₵35 sale and a quantity of 35 are both just
 * the number 35 — only the field name tells them apart). */
const COUNT_KEYS = new Set([
  'quantity', 'qty', 'hour', 'covers', 'orders', 'totalOrders', 'totalCustomers', 'activeCustomers',
  'totalVoids', 'pendingOrders', 'visitCount', 'loyaltyPoints', 'totalSuppliers', 'activeSuppliers',
  'prepTimeMinutes', 'orderCount', 'transactions', 'voids', 'itemCount', 'onHand',
  // Front Office report fields — nights/stays/guests/rooms are counted, never money.
  'rank', 'adults', 'children', 'guests', 'guestCount', 'nights', 'nightsInPeriod', 'nightsOccupied',
  'roomNights', 'stays', 'daysInPeriod', 'leadTimeDays', 'availableRooms', 'totalRooms', 'totalNights',
  'totalComplimentaryRooms', 'totalGuestsInHouse', 'transactionCount',
]);
export function isCountKey(key: string): boolean {
  return COUNT_KEYS.has(key);
}

function cell(value: unknown, key?: string): string | number {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return key && isPercentKey(key) ? formatPercent(value) : value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${v}`).join(', ');
  return String(value);
}

function objectSections(data: Record<string, unknown>, titlePrefix = ''): ExportSection[] {
  const entries = Object.entries(data);
  const primitives = entries.filter(([, v]) => v === null || typeof v !== 'object');
  const objects = entries.filter(([, v]) => v !== null && typeof v === 'object' && !Array.isArray(v));
  const arrays = entries.filter(([, v]) => Array.isArray(v));

  const sections: ExportSection[] = [];

  if (primitives.length > 0) {
    sections.push({
      title: titlePrefix || 'Summary',
      columns: ['Field', 'Value'],
      rows: primitives.map(([key, value]) => [labelize(key), cell(value, key)]),
    });
  }

  for (const [key, value] of objects) {
    sections.push(...objectSections(value as Record<string, unknown>, labelize(key)));
  }

  for (const [key, value] of arrays) {
    const arr = value as unknown[];
    const title = labelize(key);
    if (arr.length === 0) {
      sections.push({ title, columns: ['Field', 'Value'], rows: [] });
      continue;
    }
    if (typeof arr[0] === 'object' && arr[0] !== null) {
      const rows = arr as Record<string, unknown>[];
      const columns = Object.keys(rows[0]);
      sections.push({
        title,
        columns: columns.map(labelize),
        rows: rows.map((row) => columns.map((c) => cell(row[c], c))),
      });
    } else {
      sections.push({ title, columns: ['Value'], rows: (arr as unknown[]).map((v) => [cell(v)]) });
    }
  }

  return sections;
}

export function reportDataToSections(data: unknown): ExportSection[] {
  if (Array.isArray(data)) {
    if (data.length === 0) return [{ title: 'Report', columns: [], rows: [] }];
    const columns = Object.keys(data[0]);
    return [{
      title: 'Report',
      columns: columns.map(labelize),
      rows: data.map((row: Record<string, unknown>) => columns.map((c) => cell(row[c], c))),
    }];
  }
  return objectSections((data as Record<string, unknown>) || {});
}

/** Same company info every other printed document (invoices, receipts) already
 * carries — see buildOrgProfile.ts — so a report doesn't leave the building
 * with no indication of which hotel it came from. */
export type ReportOrgInfo = { name: string; address?: string; phone?: string; email?: string };

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function orgCsvLines(org?: ReportOrgInfo): string[] {
  if (!org) return [];
  const contact = [org.address, org.phone, org.email].filter(Boolean).join(' | ');
  return [escapeCsvCell(org.name), ...(contact ? [escapeCsvCell(contact)] : []), ''];
}

export function sectionsToCSV(sections: ExportSection[], org?: ReportOrgInfo, generatedLabel?: string): string {
  const blocks = sections.map((section) => {
    const lines: string[] = [];
    if (sections.length > 1) lines.push(escapeCsvCell(section.title));
    if (section.columns.length > 0) lines.push(section.columns.map(escapeCsvCell).join(','));
    for (const row of section.rows) lines.push(row.map(escapeCsvCell).join(','));
    return lines.join('\n');
  });
  const generatedLine = generatedLabel ? [escapeCsvCell(generatedLabel), ''] : [];
  return [...orgCsvLines(org), ...generatedLine, blocks.join('\n\n')].join('\n');
}

function escapeHtml(value: string | number): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function orgHtmlHeader(org?: ReportOrgInfo): string {
  if (!org) return '';
  const contact = [org.address, org.phone, org.email].filter(Boolean).join(' · ');
  return `
    <h1 style="margin-bottom:0;">${escapeHtml(org.name)}</h1>
    ${contact ? `<p style="margin-top:2px;color:#555;">${escapeHtml(contact)}</p>` : ''}
  `;
}

/** Excel opens a well-formed HTML table saved with a .xls extension just
 * fine — the standard dependency-free way to produce an Excel-openable
 * file from the browser without a real xlsx library. */
export function sectionsToExcelHtml(title: string, sections: ExportSection[], org?: ReportOrgInfo, generatedLabel?: string): string {
  const tables = sections.map((section) => `
    ${sections.length > 1 ? `<h3>${escapeHtml(section.title)}</h3>` : ''}
    <table border="1">
      ${section.columns.length > 0 ? `<tr>${section.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>` : ''}
      ${section.rows.map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}
    </table>
  `).join('<br/>');

  return `
    <html>
      <head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head>
      <body>
        ${orgHtmlHeader(org)}
        <h2>${escapeHtml(title)}</h2>
        ${generatedLabel ? `<p style="color:#555;font-size:12px;">${escapeHtml(generatedLabel)}</p>` : ''}
        ${tables}
      </body>
    </html>
  `;
}

/** A real PDF — same jsPDF + jspdf-autotable pair (and dynamic import, to
 * avoid pulling them into the SSR bundle) already used for the Rooms table's
 * Download PDF in RoomConfigurationDashboard.tsx, applied to arbitrary
 * report sections instead of one fixed table. */
export async function sectionsToPdfBlob(title: string, sections: ExportSection[], org?: ReportOrgInfo, generatedLabel?: string, landscape = false): Promise<Blob> {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  // Portrait's ~180mm usable width falls apart past ~7-8 columns at a
  // readable font size — autoTable squeezes every column down until header
  // words wrap mid-word (e.g. "Number" -> "Numbe"/"r"). Wide reports like
  // Arrivals (13 columns) get landscape's ~270mm instead.
  const maxColumns = sections.reduce((max, s) => Math.max(max, s.columns.length), 0);
  const wide = landscape || maxColumns > 7;
  const doc: any = new jsPDF(wide ? { orientation: 'landscape' } : undefined);
  let y = 15;

  if (org) {
    doc.setFontSize(14);
    doc.text(org.name, 14, y);
    y += 6;
    const contact = [org.address, org.phone, org.email].filter(Boolean).join('  |  ');
    if (contact) {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(contact, 14, y);
      doc.setTextColor(0);
      y += 8;
    } else {
      y += 2;
    }
  }

  doc.setFontSize(12);
  doc.text(title, 14, y);
  y += 6;

  if (generatedLabel) {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(generatedLabel, 14, y);
    doc.setTextColor(0);
    y += 6;
  }

  for (const section of sections) {
    if (sections.length > 1) {
      doc.setFontSize(10);
      doc.text(section.title, 14, y);
      y += 4;
    }
    if (section.columns.length === 0) continue;
    (autoTable as any)(doc, {
      head: [section.columns],
      body: section.rows,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  return doc.output('blob');
}

export type ExportFormat = 'excel' | 'pdf' | 'print';

/** The same sections as a page laid out for paper, opened straight in the print dialog. */
export function sectionsToPrintHtml(title: string, sections: ExportSection[], org?: ReportOrgInfo, generatedLabel?: string, landscape = true): string {
  const tables = sections.map((section) => `
    ${sections.length > 1 ? `<h3>${escapeHtml(section.title)}</h3>` : ''}
    <table>
      ${section.columns.length > 0 ? `<thead><tr>${section.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>` : ''}
      <tbody>
        ${section.rows.length > 0
          ? section.rows.map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${Math.max(1, section.columns.length)}" style="text-align:center;color:#888;">No records</td></tr>`}
      </tbody>
    </table>`).join('');
  return `<html><head><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11px; }
  h1 { font-size: 17px; margin: 0; }
  h2 { font-size: 14px; margin: 10px 0 2px; }
  h3 { font-size: 12px; margin: 12px 0 4px; }
  .meta { color: #555; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
</style></head><body>
  ${orgHtmlHeader(org)}
  <h2>${escapeHtml(title)}</h2>
  ${generatedLabel ? `<div class="meta">${escapeHtml(generatedLabel)}</div>` : ''}
  ${tables}
</body></html>`;
}

/** Builds the requested file from `sections` and saves it through the browser.
 * `filename` has no extension — it's added from the format (.xls / .pdf). */
export async function downloadSections(args: {
  format: ExportFormat;
  filename: string;
  title: string;
  sections: ExportSection[];
  org?: ReportOrgInfo;
  generatedLabel?: string;
  landscape?: boolean;
}): Promise<void> {
  const { format, filename, title, sections, org, generatedLabel, landscape } = args;
  if (format === 'print') {
    openHtmlPrintWindow(sectionsToPrintHtml(title, sections, org, generatedLabel, landscape));
    return;
  }
  const blob = format === 'excel'
    ? new Blob([sectionsToExcelHtml(title, sections, org, generatedLabel)], { type: 'application/vnd.ms-excel' })
    : await sectionsToPdfBlob(title, sections, org, generatedLabel, landscape);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${format === 'excel' ? 'xls' : 'pdf'}`;
  a.click();
  URL.revokeObjectURL(url);
}
