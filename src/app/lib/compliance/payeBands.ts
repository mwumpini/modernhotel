/** Ghana resident PAYE bands (monthly slice widths, as stored on the gh-paye rule's tiers). */
type Tier = { upto?: number; rate: number };

/** Act 1111 schedule, used 1 Jan 2024 – 31 Aug 2026. */
const ACT_1111_TIERS: Tier[] = [
  { upto: 490, rate: 0 }, { upto: 110, rate: 5 }, { upto: 130, rate: 10 }, { upto: 3166.67, rate: 17.5 },
  { upto: 16000, rate: 25 }, { upto: 30520, rate: 30 }, { rate: 35 },
];

/** Act 1178 schedule, GRA implementation date 1 Sep 2026. */
export const ACT_1178_TIERS: Tier[] = [
  { upto: 588, rate: 0 }, { upto: 80, rate: 5 }, { upto: 100, rate: 10 }, { upto: 2900, rate: 17.5 },
  { upto: 16000, rate: 25 }, { upto: 30332, rate: 30 }, { rate: 35 },
];

export const ACT_1178_DESCRIPTION =
  "Progressive monthly PAYE on taxable income — Act 1178 resident bands, effective 1 Sep 2026 (first GHS 588 at 0%, 35% above GHS 50,000). Each tier is the width of that slice; edit the tiers if GRA revises the bands. The last tier (rate 35, no 'upto') is open-ended.";

/** New bands for a gh-paye rule still on the exact Act 1111 defaults; null if it was edited or is already current. */
export function act1178PayePatch(rule: Record<string, any>): Record<string, any> | null {
  if (rule.id !== 'gh-paye' || !Array.isArray(rule.tiers)) return null;
  const tiers = rule.tiers as Tier[];
  const isOld =
    tiers.length === ACT_1111_TIERS.length &&
    tiers.every((t, i) => Number(t.rate) === ACT_1111_TIERS[i].rate && (t.upto == null ? null : Number(t.upto)) === (ACT_1111_TIERS[i].upto ?? null));
  return isOld ? { tiers: ACT_1178_TIERS, description: ACT_1178_DESCRIPTION } : null;
}
