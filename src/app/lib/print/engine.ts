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

  // A real navigation (Blob URL) rather than document.write into an
  // about:blank popup — document.write's completion doesn't guarantee the
  // browser has actually painted the content yet, so calling window.print()
  // right after it (as this used to) could race a still-blank, unpainted
  // window and leave it looking empty. Navigating to a URL makes `onload`
  // fire only once the document has genuinely loaded.
  const blob = new Blob([stripInlinePrintScript(html)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const w = window.open(url, '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!w) {
    URL.revokeObjectURL(url);
    alert('Unable to open print preview. Please allow pop-ups and try again.');
    return false;
  }
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
    // The print dialog blocks synchronously, so the window has definitely
    // finished reading the blob by the time we get here.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  w.onload = triggerPrint;
  // Fallback in case onload never fires (some browsers/extensions suppress it
  // for popups) — don't leave the window sitting there with no print prompt.
  setTimeout(() => { if (!printed) triggerPrint(); }, 1000);

  return true;
}

export function openPrintPreview(type: PrintType, templateKey: string, data: PrintData): boolean {
  const html = renderPrint(type, templateKey, data);
  return openHtmlPrintWindow(html);
}


