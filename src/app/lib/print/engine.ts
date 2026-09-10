import { printTemplates, listTemplates, type PrintType, type PrintData } from './templates';
import { renderBlockTemplate } from './blockRenderer';
import { getBuiltInTemplate, listBuiltInTemplates } from './blockDefaults';
import type { BlockTemplate } from './blocks';
import { useSettingsStore } from '../settings/store';

/**
 * Every template a document type can be printed with — Document Templates
 * Builder built-ins and tenant-custom templates first (the one-stop-shop
 * managed in Settings → Templates), then the legacy hand-written variants
 * for backward compatibility with templates already in use.
 */
export function listAllTemplates(type: PrintType, customTemplates: BlockTemplate[] = []): Array<{ key: string; name: string }> {
  const custom = customTemplates
    .filter(t => t.docType === type)
    .map(t => ({ key: t.id, name: t.name }));
  const builtIns = listBuiltInTemplates(type).map(t => ({ key: t.id, name: `${t.name} (Template Builder)` }));
  const legacy = listTemplates(type);
  return [...custom, ...builtIns, ...legacy];
}

export function renderPrint(type: PrintType, templateKey: string, data: PrintData): string {
  // Block templates (built-in presets or tenant-custom, see print/blocks.ts and
  // settings/store.ts's docBuilder slice) take priority. Falls through to the legacy
  // hand-written templates registry below for any key that isn't a block template —
  // every existing call site's default `settings.printing.<type>` value.
  const block = useSettingsStore.getState().getDocBuilderTemplate(templateKey) || getBuiltInTemplate(templateKey);
  if (block && block.docType === type) return renderBlockTemplate(block, data);

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

  // A hidden same-page iframe rather than window.open('_blank') — no new
  // window/tab is ever created, so a browser's popup blocker (or a user who
  // hasn't granted this site popup permission) can never silently swallow it.
  // That used to mean the print dialog — the user's only way to see or save
  // the document — just never appeared, with nothing but a console warning
  // to explain why "Generate"/"Print" looked like it did nothing.
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    alert('Unable to open print preview. Please try again.');
    return false;
  }

  const cleanup = () => setTimeout(() => iframe.remove(), 60000);

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Print failed', err);
    }
    cleanup();
  };

  // document.write's completion doesn't guarantee the browser has actually
  // painted the content yet, so trigger print from the iframe's own load
  // event (fires once the written document has genuinely loaded) rather than
  // racing a call right after write().
  iframe.onload = triggerPrint;
  doc.open();
  doc.write(stripInlinePrintScript(html));
  doc.close();
  // Fallback in case onload never fires for some reason — don't leave the
  // iframe sitting there with no print prompt.
  setTimeout(() => { if (!printed) triggerPrint(); }, 1000);

  return true;
}

export function openPrintPreview(type: PrintType, templateKey: string, data: PrintData): boolean {
  const html = renderPrint(type, templateKey, data);
  return openHtmlPrintWindow(html);
}


