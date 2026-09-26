/** Shift bands for “responsible for” room coverage. */
export type ResponsibilityShift = 'morning' | 'afternoon' | 'evening' | 'night';

export const RESPONSIBILITY_SHIFTS: { key: ResponsibilityShift; label: string; hint: string }[] = [
  { key: 'morning', label: 'Morning', hint: '≈ 06:00–14:00' },
  { key: 'afternoon', label: 'Afternoon', hint: '≈ 14:00–18:00' },
  { key: 'evening', label: 'Evening', hint: '≈ 18:00–22:00' },
  { key: 'night', label: 'Night', hint: '≈ 22:00–06:00' },
];

export interface RoomResponsibility {
  id: string;
  label?: string | null;
  staffId: string;
  staffName: string;
  shift: ResponsibilityShift | string;
  rooms: string[];
  isActive?: boolean;
  notes?: string | null;
}

/** Guess the current shift band from local time (for “who’s on now”). */
export function currentResponsibilityShift(d = new Date()): ResponsibilityShift {
  const h = d.getHours();
  if (h >= 6 && h < 14) return 'morning';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

/**
 * Parse free-text room lists: "1-10", "101,102,105-108", "101 102".
 * Non-numeric tokens are kept as-is (e.g. "PH1").
 */
export function parseRoomListInput(raw: string): string[] {
  const parts = String(raw || '')
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const range = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (range) {
      const a = parseInt(range[1], 10);
      const b = parseInt(range[2], 10);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (hi - lo > 200) continue; // guard against typos
      for (let n = lo; n <= hi; n++) out.push(String(n));
      continue;
    }
    out.push(part);
  }
  return Array.from(new Set(out));
}

export function formatRoomList(rooms: string[], max = 12): string {
  const sorted = [...rooms].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (sorted.length <= max) return sorted.join(', ');
  return `${sorted.slice(0, max).join(', ')} +${sorted.length - max} more`;
}

/** Find who is responsible for a room on a given shift (active records only). */
export function findResponsibleForRoom(
  records: RoomResponsibility[],
  roomNumber: string,
  shift: string
): RoomResponsibility | undefined {
  const room = String(roomNumber || '').trim();
  if (!room) return undefined;
  return records.find(
    (r) =>
      r.isActive !== false &&
      String(r.shift) === String(shift) &&
      (r.rooms || []).some((n) => String(n) === room)
  );
}

/** Rooms already claimed by another active record on the same shift. */
export function findShiftRoomConflicts(
  records: RoomResponsibility[],
  shift: string,
  rooms: string[],
  excludeId?: string
): { room: string; staffName: string; recordId: string }[] {
  const conflicts: { room: string; staffName: string; recordId: string }[] = [];
  const want = new Set(rooms.map(String));
  for (const r of records) {
    if (excludeId && r.id === excludeId) continue;
    if (r.isActive === false) continue;
    if (String(r.shift) !== String(shift)) continue;
    for (const room of r.rooms || []) {
      if (want.has(String(room))) {
        conflicts.push({ room: String(room), staffName: r.staffName, recordId: r.id });
      }
    }
  }
  return conflicts;
}
