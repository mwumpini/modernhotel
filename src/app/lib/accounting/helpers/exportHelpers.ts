'use client';

/**
 * Shared client-side export helpers for the Accounting UI: CSV download and
 * print/PDF-preview popups. Previously copy-pasted verbatim across several
 * accounting components.
 */

/** Downloads `data` as a CSV file named `${filename}_<today>.csv`. */
export function downloadCSV(
  data: any[],
  filename: string,
  columns: { key: string; label: string }[]
) {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      // Escape quotes and wrap in quotes if contains comma
      const str = String(val ?? '').replace(/"/g, '""');
      return str.includes(',') ? `"${str}"` : str;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Wraps report body markup in a standalone printable HTML document — header,
 * meta stat strip, styled table, optional footer. Shared by every accounting
 * list's "Print PDF" export (previously a copy-pasted local function per
 * component) so every printed report shares one visual language.
 */
export function generatePdfHtml(title: string, content: string, footer?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>${title}</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 40px; }
		.header { border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
		.header h1 { font-size: 28px; color: #1e40af; margin-bottom: 5px; }
		.header .subtitle { color: #6b7280; font-size: 14px; }
		.meta { display: flex; gap: 40px; margin-bottom: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px; }
		.meta-item { }
		.meta-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
		.meta-value { font-size: 16px; font-weight: 600; color: #111827; }
		table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
		th { background: #1e40af; color: white; padding: 12px 8px; text-align: left; font-size: 12px; text-transform: uppercase; }
		td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
		tr:nth-child(even) { background: #f9fafb; }
		.amount { text-align: right; font-family: monospace; }
		.total-row { background: #dbeafe !important; font-weight: bold; }
		.total-row td { border-top: 2px solid #3b82f6; }
		.footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
		.badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
		.badge-success { background: #dcfce7; color: #166534; }
		.badge-warning { background: #fef3c7; color: #92400e; }
		.badge-danger { background: #fee2e2; color: #991b1b; }
		.badge-info { background: #dbeafe; color: #1e40af; }
		.section { margin-bottom: 25px; }
		.section-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
		.detail-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
		.detail-item .label { font-size: 11px; color: #6b7280; }
		.detail-item .value { font-size: 14px; font-weight: 500; }
		@media print { body { padding: 20px; } }
	</style>
</head>
<body>
	${content}
	${footer ? `<div class="footer">${footer}</div>` : ''}
</body>
</html>`;
}

/**
 * Opens `html` in a new tab and triggers the print dialog once it loads.
 * If the popup is blocked (window.open returns null), alerts the user
 * instead of silently failing.
 */
export function openPrintPreview(html: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    if (typeof window !== 'undefined') {
      window.alert('Pop-up blocked. Please allow pop-ups for this site to print or preview this document.');
    }
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
