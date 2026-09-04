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
