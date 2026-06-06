import type { FixedAsset } from './models';

/** Ghana Income Tax Act — capital allowance pools (simplified hotel PPE mapping). */
export type CapitalAllowancePool =
  | 'building'
  | 'plant_machinery'
  | 'furniture'
  | 'vehicles'
  | 'it_equipment'
  | 'other';

export interface CapitalAllowancePoolDef {
  label: string;
  rate: number;
  method: 'straight' | 'reducing';
  description: string;
}

export const GHANA_CAPITAL_ALLOWANCE_POOLS: Record<CapitalAllowancePool, CapitalAllowancePoolDef> = {
  building: {
    label: 'Buildings & structures',
    rate: 0.05,
    method: 'straight',
    description: '5% straight-line on qualifying cost (hotels / commercial buildings)',
  },
  plant_machinery: {
    label: 'Plant & machinery',
    rate: 0.4,
    method: 'reducing',
    description: '40% reducing balance on written-down value (generators, kitchen plant, HVAC)',
  },
  furniture: {
    label: 'Furniture & fittings',
    rate: 0.2,
    method: 'reducing',
    description: '20% reducing balance (room furniture, lobby fittings)',
  },
  vehicles: {
    label: 'Motor vehicles',
    rate: 0.25,
    method: 'reducing',
    description: '25% reducing balance on WDV',
  },
  it_equipment: {
    label: 'IT & office equipment',
    rate: 0.4,
    method: 'reducing',
    description: '40% reducing balance (POS, computers, servers)',
  },
  other: {
    label: 'Other qualifying assets',
    rate: 0.1,
    method: 'straight',
    description: '10% straight-line default pool',
  },
};

export const PPE_ASSET_CATEGORIES = [
  'Buildings & Improvements',
  'Plant & Machinery',
  'Kitchen Equipment',
  'Furniture & Fixtures',
  'Motor Vehicles',
  'IT & Office Equipment',
  'Other PPE',
] as const;

export const ASSET_CATEGORY_TO_POOL: Record<string, CapitalAllowancePool> = {
  'Buildings & Improvements': 'building',
  'Plant & Machinery': 'plant_machinery',
  'Kitchen Equipment': 'plant_machinery',
  'Furniture & Fixtures': 'furniture',
  'Motor Vehicles': 'vehicles',
  'IT & Office Equipment': 'it_equipment',
  'Other PPE': 'other',
};

export function resolveCapitalAllowancePool(
  category: string,
  override?: CapitalAllowancePool
): CapitalAllowancePool {
  if (override) return override;
  return ASSET_CATEGORY_TO_POOL[category] || 'other';
}

export function getTaxWrittenDownValue(asset: FixedAsset): number {
  const claimed = asset.accumulatedCapitalAllowance ?? 0;
  return Math.max(0, +(asset.purchaseCost - claimed).toFixed(2));
}

/** Annual capital allowance for one asset (tax deduction, not a book JE). */
export function computeAnnualCapitalAllowance(asset: FixedAsset): number {
  const pool = resolveCapitalAllowancePool(asset.category, asset.capitalAllowancePool);
  const poolDef = GHANA_CAPITAL_ALLOWANCE_POOLS[pool];
  const wdv = getTaxWrittenDownValue(asset);
  if (wdv <= 0) return 0;

  if (poolDef.method === 'straight') {
    return +(asset.purchaseCost * poolDef.rate).toFixed(2);
  }
  return +(wdv * poolDef.rate).toFixed(2);
}

/** Monthly pro-rata allowance (for management schedules). */
export function computeMonthlyCapitalAllowance(asset: FixedAsset): number {
  return +(computeAnnualCapitalAllowance(asset) / 12).toFixed(2);
}

export interface CapitalAllowanceSummaryRow {
  assetId: string;
  assetNumber: string;
  name: string;
  category: string;
  pool: CapitalAllowancePool;
  poolLabel: string;
  qualifyingCost: number;
  taxWrittenDownValue: number;
  annualAllowance: number;
  accumulatedAllowance: number;
  bookAccumulatedDepreciation: number;
  bookNetBookValue: number;
  timingDifference: number;
}

export function buildCapitalAllowanceSummary(assets: FixedAsset[]): CapitalAllowanceSummaryRow[] {
  return assets
    .filter((a) => a.status === 'Active')
    .map((asset) => {
      const pool = resolveCapitalAllowancePool(asset.category, asset.capitalAllowancePool);
      const poolDef = GHANA_CAPITAL_ALLOWANCE_POOLS[pool];
      const annual = computeAnnualCapitalAllowance(asset);
      const bookDep = asset.accumulatedDepreciation ?? 0;
      return {
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        name: asset.name,
        category: asset.category,
        pool,
        poolLabel: poolDef.label,
        qualifyingCost: asset.purchaseCost,
        taxWrittenDownValue: getTaxWrittenDownValue(asset),
        annualAllowance: annual,
        accumulatedAllowance: asset.accumulatedCapitalAllowance ?? 0,
        bookAccumulatedDepreciation: bookDep,
        bookNetBookValue: asset.netBookValue,
        timingDifference: +(bookDep - (asset.accumulatedCapitalAllowance ?? 0)).toFixed(2),
      };
    });
}
