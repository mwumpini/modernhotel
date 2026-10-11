import { useSettingsStore } from '../settings/store';

/** Kitchen and bar ticket numbers, and the receipt number once paid, ride in the
 *  order notes so the existing order record can show them in POS, on the kitchen
 *  display, and on a reprinted receipt. */
export function parseTicketTag(notes?: string | null): { kot?: string; bot?: string; rct?: string; notes: string } {
  const text = notes || '';
  const match = text.match(/\n?\[\[([^\]]*)\]\]\s*$/);
  if (!match || match.index == null) return { notes: text.trim() };
  const body = match[1];
  const kot = body.match(/(?:^|;)KOT=([^;]+)/)?.[1];
  const bot = body.match(/(?:^|;)BOT=([^;]+)/)?.[1];
  const rct = body.match(/(?:^|;)RCT=([^;]+)/)?.[1];
  return { kot, bot, rct, notes: text.slice(0, match.index).trim() };
}

export function embedTicketTag(notes: string | undefined, kot?: string, bot?: string, rct?: string): string {
  const clean = parseTicketTag(notes).notes;
  const parts = [kot ? `KOT=${kot}` : '', bot ? `BOT=${bot}` : '', rct ? `RCT=${rct}` : ''].filter(Boolean);
  if (!parts.length) return clean;
  return clean ? `${clean}\n[[${parts.join(';')}]]` : `[[${parts.join(';')}]]`;
}

/** The order's notes with its receipt number added, keeping its KOT/BOT numbers. */
export function withReceiptTag(notes: string | null | undefined, rct: string): string {
  const tag = parseTicketTag(notes);
  return embedTicketTag(notes || undefined, tag.kot, tag.bot, rct);
}

/** Next number from Settings → Document Numbering → F&B → Receipt. */
export function issueReceiptNumber(): string {
  return useSettingsStore.getState().getNextModuleNumber('foodBeverage', 'receipt');
}

export function lineTicket(notes: string | undefined, route?: string | null, fallback?: string): string {
  const tag = parseTicketTag(notes);
  const ticket = route === 'bar' ? tag.bot : tag.kot;
  return ticket || fallback || '';
}

/** Order number plus a KOT and/or BOT, one of each only when that station has items. */
export function issueOrderIdentity(items: { route?: string | null }[], notes?: string) {
  const settings = useSettingsStore.getState();
  const kitchen = items.some((i) => (i.route || 'kitchen') !== 'bar');
  const bar = items.some((i) => i.route === 'bar');
  const kot = kitchen ? settings.getNextModuleNumber('foodBeverage', 'kitchenOrderTicket') : undefined;
  const bot = bar ? settings.getNextModuleNumber('foodBeverage', 'barOrderTicket') : undefined;
  const orderNumber = settings.getNextModuleNumber('foodBeverage', 'order');
  return { orderNumber, kot, bot, notes: embedTicketTag(notes, kot, bot) };
}
