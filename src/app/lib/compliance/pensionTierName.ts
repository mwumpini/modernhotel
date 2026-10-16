/**
 * Ghana pension rules keep their tier on the display name.
 * A new hotel starts as "SSNIT (Tier 1)", "Tier 2", and "Tier 3".
 * A rename replaces the words in front; "(Tier N)" is put back on save.
 * The bare label "Tier N" is the name when nothing has been typed in front.
 */

const MARKERS = {
  TIER1: 'Tier 1',
  TIER2: 'Tier 2',
  TIER3_RELIEF_CAP: 'Tier 3',
} as const;

const ID_MARKERS: Record<string, string> = {
  'gh-ssnit-tier1': MARKERS.TIER1,
  'gh-ssnit-tier2': MARKERS.TIER2,
  'gh-tier3-relief-cap': MARKERS.TIER3_RELIEF_CAP,
};

export function pensionTierMarker(appliesTo?: string[] | null, id?: string): string | null {
  const tags = appliesTo || [];
  if (tags.includes('TIER1')) return MARKERS.TIER1;
  if (tags.includes('TIER2')) return MARKERS.TIER2;
  if (tags.includes('TIER3_RELIEF_CAP')) return MARKERS.TIER3_RELIEF_CAP;
  if (id && ID_MARKERS[id]) return ID_MARKERS[id];
  return null;
}

/** The part the hotel typed, without a trailing "(Tier N)". Empty when the name is just the tier. */
export function pensionTierCustomName(name: string, marker: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.toLowerCase() === marker.toLowerCase()) return '';
  const flexible = marker.replace(/\s+/g, '\\s*');
  return trimmed.replace(new RegExp(`\\s*\\(${flexible}\\)\\s*$`, 'i'), '').trim();
}

/** "Enterprise Trustees" → "Enterprise Trustees (Tier 2)". "Tier 2" stays "Tier 2". */
export function withPensionTierMarker(name: string, marker: string): string {
  const custom = pensionTierCustomName(name, marker);
  if (!custom) return marker;
  return `${custom} (${marker})`;
}

type PensionRule = {
  id?: string;
  name?: string;
  appliesTo?: string[];
  ssnitDefaultApplied?: boolean;
};

/**
 * One-time: an untouched Tier 1 ("Tier 1") becomes "SSNIT (Tier 1)".
 * Always: a custom name gets "(Tier N)" if it is missing.
 * Once ssnitDefaultApplied is set, clearing the name back to "Tier 1" is left as "Tier 1".
 */
export function pensionTierNamePatch(rule: PensionRule): { name?: string; ssnitDefaultApplied?: boolean } | null {
  const id = String(rule.id || '');
  const marker = pensionTierMarker(rule.appliesTo, id);
  if (!marker) return null;

  let name = String(rule.name || '').trim();
  const patch: { name?: string; ssnitDefaultApplied?: boolean } = {};

  if (id === 'gh-ssnit-tier1' && !rule.ssnitDefaultApplied) {
    patch.ssnitDefaultApplied = true;
    if (name === 'Tier 1' || name === '') name = 'SSNIT (Tier 1)';
  }
  if (id === 'gh-tier3-relief-cap' && name === 'Tier 3 Relief Cap') name = 'Tier 3';

  const next = withPensionTierMarker(name, marker);
  if (next !== String(rule.name || '').trim()) patch.name = next;
  if (!patch.name && !patch.ssnitDefaultApplied) return null;
  return patch;
}
