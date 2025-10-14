import { printTemplates, type PrintType, type PrintData } from './templates';

export function renderPrint(type: PrintType, templateKey: string, data: PrintData): string {
  const typeRegistry = printTemplates[type] || {};
  const tmpl = typeRegistry[templateKey] || typeRegistry[Object.keys(typeRegistry)[0]];
  return tmpl ? tmpl(data) : '<html><body>No template</body></html>';
}

export function openPrintPreview(type: PrintType, templateKey: string, data: PrintData) {
  const html = renderPrint(type, templateKey, data);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}


