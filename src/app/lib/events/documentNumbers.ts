export function padSeq(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

export function buildIdSequence(ids: Array<string | undefined | null>): Map<string, number> {
  const map = new Map<string, number>();
  ids.forEach((id) => {
    const key = String(id || '').trim();
    if (!key || map.has(key)) return;
    map.set(key, map.size + 1);
  });
  return map;
}

export function sequenceLabel(prefix: string, id: string | undefined | null, map: Map<string, number>): string {
  if (!id) return '—';
  const n = map.get(id);
  return n ? `${prefix}-${padSeq(n)}` : String(id);
}

export function nextSequenceLabel(prefix: string, map: Map<string, number>): string {
  return `${prefix}-${padSeq(map.size + 1)}`;
}

export function nextNumberFromLabels(prefix: string, labels: Array<string | undefined | null>): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let max = 0;
  labels.forEach((label) => {
    const match = String(label || '').trim().match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `${prefix}-${padSeq(max + 1)}`;
}

export function sortIdsByDate<T>(
  rows: T[],
  idOf: (row: T) => string,
  dateOf: (row: T) => string
): string[] {
  return [...rows]
    .sort((a, b) => {
      const byDate = String(dateOf(a) || '').localeCompare(String(dateOf(b) || ''));
      if (byDate !== 0) return byDate;
      return String(idOf(a) || '').localeCompare(String(idOf(b) || ''));
    })
    .map(idOf)
    .filter(Boolean);
}
