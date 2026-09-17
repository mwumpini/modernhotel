/**
 * Shapes report data (either a row array, or a single summary object with
 * primitive/nested-object/array fields — see FrontOfficeReportsAnalysis.tsx's
 * renderReportTable/ReportSummarySection for the on-screen equivalent) into
 * one or more flat column/row sections, then serializes those to real CSV
 * or Excel-openable HTML. Both export formats share this shaping so a
 * report's CSV and Excel output always match what's on screen.
 */

export type ExportSection = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function cell(value: unknown): string | number {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value;
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
      rows: primitives.map(([key, value]) => [labelize(key), cell(value)]),
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
        rows: rows.map((row) => columns.map((c) => cell(row[c]))),
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
      rows: data.map((row: Record<string, unknown>) => columns.map((c) => cell(row[c]))),
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

export function sectionsToCSV(sections: ExportSection[], org?: ReportOrgInfo): string {
  const blocks = sections.map((section) => {
    const lines: string[] = [];
    if (sections.length > 1) lines.push(escapeCsvCell(section.title));
    if (section.columns.length > 0) lines.push(section.columns.map(escapeCsvCell).join(','));
    for (const row of section.rows) lines.push(row.map(escapeCsvCell).join(','));
    return lines.join('\n');
  });
  return [...orgCsvLines(org), blocks.join('\n\n')].join('\n');
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
export function sectionsToExcelHtml(title: string, sections: ExportSection[], org?: ReportOrgInfo): string {
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
        ${tables}
      </body>
    </html>
  `;
}

/** A real PDF — same jsPDF + jspdf-autotable pair (and dynamic import, to
 * avoid pulling them into the SSR bundle) already used for the Rooms table's
 * Download PDF in RoomConfigurationDashboard.tsx, applied to arbitrary
 * report sections instead of one fixed table. */
export async function sectionsToPdfBlob(title: string, sections: ExportSection[], org?: ReportOrgInfo): Promise<Blob> {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  // Portrait's ~180mm usable width falls apart past ~7-8 columns at a
  // readable font size — autoTable squeezes every column down until header
  // words wrap mid-word (e.g. "Number" -> "Numbe"/"r"). Wide reports like
  // Arrivals (13 columns) get landscape's ~270mm instead.
  const maxColumns = sections.reduce((max, s) => Math.max(max, s.columns.length), 0);
  const wide = maxColumns > 7;
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
