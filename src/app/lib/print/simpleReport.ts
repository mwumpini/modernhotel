import { openHtmlPrintWindow } from './engine';

/**
 * Fixed-layout internal report printing — mirrors the existing "Print"
 * pattern used for folio/service-charge slips (openHtmlPrintWindow) rather
 * than the full Document Templates invoice/receipt pipeline: this always
 * looks the same, just with a title/subtitle/timestamp, no tenant branding
 * or template selection needed for an internal ops report like a shift
 * schedule or an overtime log.
 */
export function printSimpleReport(title: string, subtitle: string, columns: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
    <html>
      <head>
        <title>${escape(title)}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 18px; margin: 0 0 4px; }
          p.subtitle { font-size: 13px; color: #555; margin: 0 0 4px; }
          p.timestamp { font-size: 11px; color: #888; margin: 0 0 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          th { background: #f2f2f2; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>${escape(title)}</h1>
        <p class="subtitle">${escape(subtitle)}</p>
        <p class="timestamp">Printed ${escape(new Date().toLocaleString())}</p>
        <table>
          <thead><tr>${columns.map((c) => `<th>${escape(c)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.length > 0
              ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')
              : `<tr><td colspan="${columns.length}" style="text-align:center;color:#888;">No records</td></tr>`}
          </tbody>
        </table>
      </body>
    </html>
  `;
  openHtmlPrintWindow(html);
}

/** Key/value “open form” print — same window pipeline as printSimpleReport, for click-to-open detail modals. */
export function printDetailSheet(
  title: string,
  fields: Array<{ label: string; value: string | number }>,
  subtitle = '',
) {
  const escape = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
    <html>
      <head>
        <title>${escape(title)}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 18px; margin: 0 0 4px; }
          p.subtitle { font-size: 13px; color: #555; margin: 0 0 4px; }
          p.timestamp { font-size: 11px; color: #888; margin: 0 0 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { background: #f2f2f2; width: 32%; font-weight: 600; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>${escape(title)}</h1>
        ${subtitle ? `<p class="subtitle">${escape(subtitle)}</p>` : ''}
        <p class="timestamp">Printed ${escape(new Date().toLocaleString())}</p>
        <table>
          <tbody>
            ${fields.map((f) => `<tr><th>${escape(f.label)}</th><td>${escape(f.value)}</td></tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
  openHtmlPrintWindow(html);
}
