/** Fixed supplies for a real clean. Attendants do not type these quantities. */

export type KitLine = { itemId: string; quantity: number };

export type RoomCleaningKit = {
  turnover: KitLine[];
  stayover: KitLine[];
};

export type CleaningKits = Record<string, RoomCleaningKit>;

export type CleaningIssueKind = 'checkout' | 'stayover' | 'supervisor' | 'none';

export function emptyRoomKit(): RoomCleaningKit {
  return { turnover: [], stayover: [] };
}

export function parseCleaningKits(raw: unknown): CleaningKits {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const kits: CleaningKits = {};
  for (const [roomTypeId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!roomTypeId || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as { turnover?: unknown; stayover?: unknown };
    kits[roomTypeId] = {
      turnover: parseKitLines(row.turnover),
      stayover: parseKitLines(row.stayover),
    };
  }
  return kits;
}

export function parseKitLines(raw: unknown): KitLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: KitLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const itemId = String((row as { itemId?: unknown }).itemId || '').trim();
    const quantity = Math.floor(Number((row as { quantity?: unknown }).quantity));
    if (!itemId || !Number.isFinite(quantity) || quantity <= 0 || quantity > 999) continue;
    lines.push({ itemId, quantity });
  }
  return lines;
}

export function decideCleaningIssue(input: {
  taskId: string;
  taskType: string;
  roomTypeId: string;
  openedBy: string;
  kits: CleaningKits;
  checkoutReservationId: string | null;
  inHouseReservationId: string | null;
  stayoverDate: string;
}): { kind: CleaningIssueKind; referenceId: string | null; lines: KitLine[] } {
  const kit = input.kits[input.roomTypeId] || emptyRoomKit();
  const turnover = kit.turnover;
  const stayover = kit.stayover;

  if (input.taskType === 'turnover' && input.checkoutReservationId) {
    return { kind: 'checkout', referenceId: `turnover:${input.checkoutReservationId}`, lines: turnover };
  }
  if ((input.taskType === 'daily' || input.taskType === 'turnover') && input.inHouseReservationId) {
    return {
      kind: 'stayover',
      referenceId: `stayover:${input.inHouseReservationId}:${input.stayoverDate}`,
      lines: stayover,
    };
  }
  if (input.openedBy === 'supervisor' && (input.taskType === 'daily' || input.taskType === 'turnover')) {
    return {
      kind: 'supervisor',
      referenceId: `supervisor:${input.taskId}`,
      lines: input.taskType === 'turnover' ? turnover : stayover,
    };
  }
  return { kind: 'none', referenceId: null, lines: [] };
}

export function cleaningIssueLabel(kind: CleaningIssueKind): string {
  switch (kind) {
    case 'checkout':
      return 'Checkout clean. The turnover kit comes off stock.';
    case 'stayover':
      return 'Guest is still in house. The stayover kit comes off stock.';
    case 'supervisor':
      return 'A supervisor opened this task. The room kit comes off stock.';
    default:
      return 'This clean does not take stock. Finishing it does not write supplies off.';
  }
}
