import { printTemplates, type PrintType, type PrintData } from './templates';

export function renderPrint(type: PrintType, templateKey: string, data: PrintData): string {
  const typeRegistry = printTemplates[type] || {};
  const tmpl = typeRegistry[templateKey] || typeRegistry[Object.keys(typeRegistry)[0]];
  return tmpl ? tmpl(data) : '<html><body>No template</body></html>';
}

/** Strip inline print scripts — we trigger print explicitly after the document loads. */
function stripInlinePrintScript(html: string): string {
  return html.replace(/<script>\s*window\.print\(\)\s*<\/script>/gi, '');
}

export function openHtmlPrintWindow(html: string): boolean {
  if (typeof window === 'undefined') return false;

  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!w) {
    alert('Unable to open print preview. Please allow pop-ups and try again.');
    return false;
  }

  w.document.open();
  w.document.write(stripInlinePrintScript(html));
  w.document.close();
  w.focus();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      w.print();
    } catch (err) {
      console.error('Print failed', err);
    }
  };

  w.onload = triggerPrint;
  if (w.document.readyState === 'complete') {
    triggerPrint();
  } else {
    requestAnimationFrame(triggerPrint);
  }

  return true;
}

export function openPrintPreview(type: PrintType, templateKey: string, data: PrintData): boolean {
  const html = renderPrint(type, templateKey, data);
  return openHtmlPrintWindow(html);
}


