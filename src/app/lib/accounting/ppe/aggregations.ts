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
import { computeAsset, assetTotalCost, graDisposalRelease, reportDateFromInput } from './calculations';
import { PRESENTATION_GROUPS, GRA_CLASSES } from './categories';

function emptyFsGroup() {
  return {
    costOpening: 0,
    additions: 0,
    costDisposals: 0,
    costClosing: 0,
    depOpening: 0,
    chargeForYear: 0,
    depDisposals: 0,
    depClosing: 0,
    nbv: 0,
  };
}

function ymd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Still owned at the report date, including a disposal dated after that day. */
function heldAt(asset: PpeAsset, reportDate: Date): boolean {
  if (asset.capExp === 'Capitalise') return true;
  if (asset.capExp !== 'Disposed' || !asset.disposalDate) return false;
  return asset.disposalDate.slice(0, 10) > ymd(reportDate);
}

/** Sold during the report year, on or before the report date. */
function disposedThisYear(asset: PpeAsset, reportDate: Date): boolean {
  if (asset.capExp !== 'Disposed' || !asset.disposalDate) return false;
  const day = asset.disposalDate.slice(0, 10);
  return day <= ymd(reportDate) && new Date(day).getFullYear() === reportDate.getFullYear();
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
    const held = grpRows.filter((r) => heldAt(r.asset, reportDate));
    const disposed = grpRows.filter((r) => disposedThisYear(r.asset, reportDate));
    const movement = [...held, ...disposed];
    const boughtBefore = (r: (typeof movement)[number]) => new Date(r.asset.purchaseDate).getFullYear() < reportYear;
    const boughtThisYear = (r: (typeof movement)[number]) => new Date(r.asset.purchaseDate).getFullYear() === reportYear;

    result[grp] = {
      costOpening: movement.filter(boughtBefore).reduce((s, r) => s + r.computed.totalCost, 0),
      additions: movement.filter(boughtThisYear).reduce((s, r) => s + r.computed.totalCost, 0),
      costDisposals: -disposed.reduce((s, r) => s + r.computed.totalCost, 0),
      costClosing: held.reduce((s, r) => s + r.computed.totalCost, 0),
      depOpening: movement.filter(boughtBefore).reduce((s, r) => s + r.computed.priorYrAccumDep, 0),
      chargeForYear: movement.reduce((s, r) => s + r.computed.annualDepCharge, 0),
      depDisposals: -disposed.reduce((s, r) => s + r.computed.accumDep, 0),
      depClosing: held.reduce((s, r) => s + r.computed.accumDep, 0),
      nbv: held.reduce((s, r) => s + r.computed.nbv, 0),
    };
  }

  result.TOTAL = PRESENTATION_GROUPS.reduce(
    (acc, grp) => ({
      costOpening: acc.costOpening + result[grp].costOpening,
      additions: acc.additions + result[grp].additions,
      costDisposals: acc.costDisposals + result[grp].costDisposals,
      costClosing: acc.costClosing + result[grp].costClosing,
      depOpening: acc.depOpening + result[grp].depOpening,
      chargeForYear: acc.chargeForYear + result[grp].chargeForYear,
      depDisposals: acc.depDisposals + result[grp].depDisposals,
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
    const clsAssets = assets.filter((a) => catMap.get(a.categoryId)?.graClass === cls);
    const held = clsAssets.filter((a) => heldAt(a, reportDate));
    const disposed = clsAssets.filter((a) => disposedThisYear(a, reportDate));
    const computed = held.map((a) => computeAsset(a, catMap.get(a.categoryId)!, reportDate));
    const released = disposed.reduce((s, a) => s + graDisposalRelease(a, catMap.get(a.categoryId)!, reportDate), 0);
    const disposedAdditions = disposed
      .filter((a) => new Date(a.purchaseDate).getFullYear() === reportYear)
      .reduce((s, a) => s + assetTotalCost(a), 0);

    result[cls as GraClass] = {
      openingWDV: Math.round(computed.reduce((s, c) => s + c.graOpeningWdv, 0) + (released - disposedAdditions)),
      additions: held
        .filter((a) => new Date(a.purchaseDate).getFullYear() === reportYear)
        .reduce((s, a) => s + assetTotalCost(a), 0) + disposedAdditions,
      caClaimed: Math.round(computed.reduce((s, c) => s + c.graCaThisYear, 0)),
      disposals: -Math.round(released),
      closingWDV: Math.round(computed.reduce((s, c) => s + c.graWdvCurrent, 0)),
    };
  }

  result.TOTAL = GRA_CLASSES.reduce(
    (acc, cls) => ({
      openingWDV: acc.openingWDV + result[cls].openingWDV,
      additions: acc.additions + result[cls].additions,
      caClaimed: acc.caClaimed + result[cls].caClaimed,
      disposals: acc.disposals + result[cls].disposals,
      closingWDV: acc.closingWDV + result[cls].closingWDV,
    }),
    { openingWDV: 0, additions: 0, caClaimed: 0, disposals: 0, closingWDV: 0 }
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
        disposedThisYear(a, reportDate)
    )
    .map((a) => {
      const cat = catMap.get(a.categoryId)!;
      const computed = computeAsset(a, cat, reportDate);
      return {
        disposalDate: a.disposalDate!,
        assetName: a.assetName,
        assetCode: a.assetCode,
        categoryId: a.categoryId,
        categoryName: cat?.name ?? '',
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
  { key: 'costDisposals', label: 'Cost — disposals' },
  { key: 'costClosing', label: 'Cost — closing' },
  { key: 'depOpening', label: 'Depreciation — opening' },
  { key: 'chargeForYear', label: 'Charge for the year' },
  { key: 'depDisposals', label: 'Depreciation — disposals' },
  { key: 'depClosing', label: 'Depreciation — closing' },
  { key: 'nbv', label: 'Net book value' },
];

export const GRA_ROW_LABELS: { key: keyof GraRollforward[GraClass]; label: string }[] = [
  { key: 'openingWDV', label: 'Opening WDV' },
  { key: 'additions', label: 'Additions' },
  { key: 'caClaimed', label: 'Capital allowance claimed' },
  { key: 'disposals', label: 'Disposals' },
  { key: 'closingWDV', label: 'Closing WDV' },
];
