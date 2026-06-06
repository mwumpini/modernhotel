import type {
  PpeAsset,
  PpeCategory,
  FsSummarySection4,
  GraRollforward,
  DisposalRow,
  PresentationGroup,
  GraClass,
  AssetComputation,
} from './types';
import { computeAsset, assetTotalCost, reportDateFromInput } from './calculations';
import { PRESENTATION_GROUPS, GRA_CLASSES } from './categories';

function emptyFsGroup() {
  return {
    costOpening: 0,
    additions: 0,
    costClosing: 0,
    depOpening: 0,
    chargeForYear: 0,
    depClosing: 0,
    nbv: 0,
  };
}

export function computeAllAssets(
  assets: PpeAsset[],
  categories: PpeCategory[],
  reportDate: Date
): Array<{ asset: PpeAsset; category: PpeCategory; computed: AssetComputation }> {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  return assets
    .map((asset) => {
      const category = catMap.get(asset.categoryId);
      if (!category) return null;
      return { asset, category, computed: computeAsset(asset, category, reportDate) };
    })
    .filter(Boolean) as Array<{ asset: PpeAsset; category: PpeCategory; computed: AssetComputation }>;
}

export function fsSummarySection4(
  assets: PpeAsset[],
  categories: PpeCategory[],
  reportDate: Date
): FsSummarySection4 {
  const rows = computeAllAssets(assets, categories, reportDate);
  const reportYear = reportDate.getFullYear();
  const result = {} as FsSummarySection4;

  for (const grp of PRESENTATION_GROUPS) {
    const grpRows = rows.filter((r) => r.computed.presentationGroup === grp);
    const capitalised = grpRows.filter((r) => r.asset.capExp === 'Capitalise');

    result[grp] = {
      costOpening: capitalised
        .filter((r) => new Date(r.asset.purchaseDate).getFullYear() < reportYear)
        .reduce((s, r) => s + r.computed.totalCost, 0),
      additions: capitalised
        .filter((r) => new Date(r.asset.purchaseDate).getFullYear() === reportYear)
        .reduce((s, r) => s + r.computed.totalCost, 0),
      costClosing: capitalised.reduce((s, r) => s + r.computed.totalCost, 0),
      depOpening: capitalised
        .filter((r) => new Date(r.asset.purchaseDate).getFullYear() < reportYear)
        .reduce((s, r) => s + r.computed.priorYrAccumDep, 0),
      chargeForYear: capitalised.reduce((s, r) => s + r.computed.annualDepCharge, 0),
      depClosing: capitalised.reduce((s, r) => s + r.computed.accumDep, 0),
      nbv: capitalised.reduce((s, r) => s + r.computed.nbv, 0),
    };
  }

  result.TOTAL = PRESENTATION_GROUPS.reduce(
    (acc, grp) => ({
      costOpening: acc.costOpening + result[grp].costOpening,
      additions: acc.additions + result[grp].additions,
      costClosing: acc.costClosing + result[grp].costClosing,
      depOpening: acc.depOpening + result[grp].depOpening,
      chargeForYear: acc.chargeForYear + result[grp].chargeForYear,
      depClosing: acc.depClosing + result[grp].depClosing,
      nbv: acc.nbv + result[grp].nbv,
    }),
    emptyFsGroup()
  );

  return result;
}

export function graRollforward(
  assets: PpeAsset[],
  categories: PpeCategory[],
  reportDate: Date
): GraRollforward {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const reportYear = reportDate.getFullYear();
  const result = {} as GraRollforward;

  for (const cls of GRA_CLASSES) {
    const clsAssets = assets.filter((a) => {
      const cat = catMap.get(a.categoryId);
      return cat?.graClass === cls && a.capExp === 'Capitalise';
    });
    const computed = clsAssets
      .map((a) => {
        const cat = catMap.get(a.categoryId)!;
        return computeAsset(a, cat, reportDate);
      });

    result[cls as GraClass] = {
      openingWDV: Math.round(computed.reduce((s, c) => s + c.graOpeningWdv, 0)),
      additions: clsAssets
        .filter((a) => new Date(a.purchaseDate).getFullYear() === reportYear)
        .reduce((s, a) => s + assetTotalCost(a), 0),
      caClaimed: Math.round(computed.reduce((s, c) => s + c.graCaThisYear, 0)),
      closingWDV: Math.round(computed.reduce((s, c) => s + c.graWdvCurrent, 0)),
    };
  }

  result.TOTAL = GRA_CLASSES.reduce(
    (acc, cls) => ({
      openingWDV: acc.openingWDV + result[cls].openingWDV,
      additions: acc.additions + result[cls].additions,
      caClaimed: acc.caClaimed + result[cls].caClaimed,
      closingWDV: acc.closingWDV + result[cls].closingWDV,
    }),
    { openingWDV: 0, additions: 0, caClaimed: 0, closingWDV: 0 }
  );

  return result;
}

export function disposalsList(
  assets: PpeAsset[],
  categories: PpeCategory[],
  reportDate: Date
): DisposalRow[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const reportYear = reportDate.getFullYear();

  return assets
    .filter(
      (a) =>
        a.capExp === 'Disposed' &&
        a.disposalDate &&
        new Date(a.disposalDate).getFullYear() === reportYear
    )
    .map((a) => {
      const cat = catMap.get(a.categoryId)!;
      const computed = computeAsset(a, cat, reportDate);
      return {
        disposalDate: a.disposalDate!,
        assetName: a.assetName,
        assetCode: a.assetCode,
        cost: computed.totalCost,
        accumDep: computed.accumDep,
        nbvAtDisposal: computed.nbv,
        proceeds: a.disposalProceeds ?? 0,
        gainLoss: computed.gainLossDisposal,
      };
    });
}

export { reportDateFromInput };

export const FS_ROW_LABELS: { key: keyof FsSummarySection4[PresentationGroup]; label: string }[] = [
  { key: 'costOpening', label: 'Cost — opening' },
  { key: 'additions', label: 'Additions' },
  { key: 'costClosing', label: 'Cost — closing' },
  { key: 'depOpening', label: 'Depreciation — opening' },
  { key: 'chargeForYear', label: 'Charge for the year' },
  { key: 'depClosing', label: 'Depreciation — closing' },
  { key: 'nbv', label: 'Net book value' },
];

export const GRA_ROW_LABELS: { key: keyof GraRollforward[GraClass]; label: string }[] = [
  { key: 'openingWDV', label: 'Opening WDV' },
  { key: 'additions', label: 'Additions' },
  { key: 'caClaimed', label: 'Capital allowance claimed' },
  { key: 'closingWDV', label: 'Closing WDV' },
];
