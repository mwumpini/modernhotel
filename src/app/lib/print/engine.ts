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

function signedInUserName(): string | undefined {
  const user = useSettingsStore.getState().currentUser;
  if (!user) return undefined;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || user.username || undefined;
}

function templateKind(type: PrintType, key: string | undefined): 'block' | 'legacy' | null {
  if (!key) return null;
  const settings = useSettingsStore.getState();
  const block = settings.getDocBuilderTemplate(key) || getBuiltInTemplate(key);
  if (block && block.docType === type) return 'block';
  if (printTemplates[type]?.[key]) return 'legacy';
  return null;
}

/** The key Set Active stored for this document type, when it still exists. */
function activeTemplateKey(type: PrintType): string {
  const printing = useSettingsStore.getState().printing as Record<string, string> | undefined;
  const active = printing?.[type];
  if (active && templateKind(type, active)) return active;
  return listBuiltInTemplates(type)[0]?.id || Object.keys(printTemplates[type] || {})[0] || '';
}

export function renderPrint(type: PrintType, templateKey: string, data: PrintData): string {
  // An explicit key wins when it is a real template for this document type.
  // Otherwise use the one Set Active stored, so a newly activated template
  // shows up on the next print even if a screen still has an old default.
  const settings = useSettingsStore.getState();
  const key = templateKind(type, templateKey) ? templateKey : activeTemplateKey(type);
  const block = settings.getDocBuilderTemplate(key) || getBuiltInTemplate(key);
  if (block && block.docType === type) {
    const withUser = data.userName ? data : { ...data, userName: signedInUserName() };
    return renderBlockTemplate(block, withUser);
  }

  const typeRegistry = printTemplates[type] || {};
  const tmpl = typeRegistry[key] || typeRegistry[Object.keys(typeRegistry)[0]];
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


