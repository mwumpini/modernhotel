import type { PpeAsset, PpeCategory, AssetComputation, RemainingLife } from './types';

function parseDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function monthsElapsed(purchaseDate: string | Date, targetDate: Date): number {
  const pd = parseDate(purchaseDate);
  return Math.max(
    0,
    (targetDate.getFullYear() - pd.getFullYear()) * 12 + (targetDate.getMonth() - pd.getMonth()) + 1
  );
}

export function monthsElapsedPriorYear(purchaseDate: string | Date, reportDate: Date): number {
  const priorYearEnd = new Date(reportDate.getFullYear() - 1, 11, 31);
  return monthsElapsed(purchaseDate, priorYearEnd);
}

/** GRA half-year convention — Act 896 s.14 */
export function halfYearAdj(purchaseDate: string | Date): number {
  const pd = parseDate(purchaseDate);
  return pd.getMonth() + 1 <= 6 ? 1.0 : 0.5;
}

export function graYearsElapsed(purchaseDate: string | Date, reportDate: Date): number {
  const pd = parseDate(purchaseDate);
  return Math.max(0, reportDate.getFullYear() - pd.getFullYear() + halfYearAdj(purchaseDate));
}

export function graYearsElapsedPrior(purchaseDate: string | Date, reportDate: Date): number {
  const pd = parseDate(purchaseDate);
  return Math.max(0, reportDate.getFullYear() - 1 - pd.getFullYear() + halfYearAdj(purchaseDate));
}

export function assetTotalCost(asset: PpeAsset): number {
  return +(asset.quantity * asset.unitPrice).toFixed(2);
}

export function depreciableAmount(cost: number, residualPct: number): number {
  return cost * (1 - residualPct);
}

export function slAccumDep(
  cost: number,
  residualPct: number,
  usefulLifeYears: number,
  months: number
): number {
  if (usefulLifeYears <= 0) return 0;
  const depreciable = depreciableAmount(cost, residualPct);
  const annualCharge = depreciable / usefulLifeYears;
  return Math.min(annualCharge * (months / 12), depreciable);
}

export function rbAccumDep(cost: number, residualPct: number, rate: number, months: number): number {
  const depreciable = depreciableAmount(cost, residualPct);
  return Math.min(cost * (1 - Math.pow(1 - rate, months / 12)), depreciable);
}

export function accumDep(asset: PpeAsset, category: PpeCategory, reportDate: Date): number {
  if (asset.capExp === 'Expense') return 0;
  if (asset.capExp !== 'Capitalise' && !asset.disposalDate) return 0;

  const targetDate = asset.disposalDate ? parseDate(asset.disposalDate) : reportDate;
  const months = monthsElapsed(asset.purchaseDate, targetDate);
  const cost = assetTotalCost(asset);

  if (category.presentationGroup === 'Land') return 0;

  if (category.iasMethod === 'SL') {
    return slAccumDep(cost, category.residualPct, category.usefulLifeYrs, months);
  }
  return rbAccumDep(cost, category.residualPct, category.iasRate, months);
}

export function priorYearAccumDep(asset: PpeAsset, category: PpeCategory, reportDate: Date): number {
  if (asset.capExp !== 'Capitalise') return 0;
  if (category.presentationGroup === 'Land') return 0;

  const months = monthsElapsedPriorYear(asset.purchaseDate, reportDate);
  const cost = assetTotalCost(asset);

  if (category.iasMethod === 'SL') {
    return slAccumDep(cost, category.residualPct, category.usefulLifeYrs, months);
  }
  return rbAccumDep(cost, category.residualPct, category.iasRate, months);
}

export function nbv(asset: PpeAsset, category: PpeCategory, reportDate: Date): number {
  if (asset.capExp === 'Expense') return 0;
  const cost = assetTotalCost(asset);
  return +(cost - accumDep(asset, category, reportDate)).toFixed(2);
}

export function annualDepCharge(asset: PpeAsset, category: PpeCategory, reportDate: Date): number {
  if (asset.capExp !== 'Capitalise') return 0;
  if (asset.disposalDate) return 0;
  if (category.presentationGroup === 'Land') return 0;

  // Charge for the year = closing accumulated depreciation − opening (prior year-end)
  // accumulated depreciation. This is what makes depOpening + chargeForYear = depClosing hold
  // by construction, and it automatically pro-rates for an asset bought mid-year (priorAccum
  // is 0 for a same-year addition, so the charge is just however many months it's actually
  // been owned) instead of always charging a full year's rate regardless of purchase date.
  const priorAccum = priorYearAccumDep(asset, category, reportDate);
  const currentAccum = accumDep(asset, category, reportDate);
  return Math.max(0, currentAccum - priorAccum);
}

export function gainLossOnDisposal(
  asset: PpeAsset,
  category: PpeCategory,
  reportDate: Date
): number | null {
  if (!asset.disposalDate || asset.disposalProceeds == null) return null;
  const cost = assetTotalCost(asset);
  const accumAtDisposal = accumDep(asset, category, reportDate);
  const nbvAtDisposal = cost - accumAtDisposal;
  return +(asset.disposalProceeds - nbvAtDisposal).toFixed(2);
}

export function remainingLife(
  asset: PpeAsset,
  category: PpeCategory,
  reportDate: Date
): RemainingLife | null {
  if (asset.capExp !== 'Capitalise') return null;
  if (asset.disposalDate) return { years: 0, months: 0, display: 'Disposed' };
  if (category.presentationGroup === 'Land') return { years: 99, months: 0, display: 'Not depreciated' };

  const totalMonths = category.usefulLifeYrs * 12;
  const pd = parseDate(asset.purchaseDate);
  const elapsed =
    (reportDate.getFullYear() - pd.getFullYear()) * 12 +
    (reportDate.getMonth() - pd.getMonth()) +
    1;
  const remaining = Math.max(0, totalMonths - elapsed);

  return {
    years: Math.floor(remaining / 12),
    months: remaining % 12,
    display: `${Math.floor(remaining / 12)} Yrs ${remaining % 12} Mths`,
  };
}

export function graWDV(asset: PpeAsset, category: PpeCategory, reportDate: Date): number {
  if (asset.capExp !== 'Capitalise') return 0;
  const cost = assetTotalCost(asset);
  const yrs = graYearsElapsed(asset.purchaseDate, reportDate);

  if (category.graMethod === 'RB') {
    return cost * Math.pow(1 - category.graRate, yrs);
  }
  return Math.max(0, cost * (1 - category.graRate * yrs));
}

export function graWDVPrior(asset: PpeAsset, category: PpeCategory, reportDate: Date): number {
  if (asset.capExp !== 'Capitalise') return 0;
  const cost = assetTotalCost(asset);
  const yrs = graYearsElapsedPrior(asset.purchaseDate, reportDate);

  if (category.graMethod === 'RB') {
    return cost * Math.pow(1 - category.graRate, yrs);
  }
  return Math.max(0, cost * (1 - category.graRate * yrs));
}

export function graOpeningWDV(asset: PpeAsset, category: PpeCategory, reportDate: Date): number {
  const purchaseYear = parseDate(asset.purchaseDate).getFullYear();
  if (purchaseYear >= reportDate.getFullYear()) return 0;
  return graWDVPrior(asset, category, reportDate);
}

export function graCapitalAllowance(
  asset: PpeAsset,
  category: PpeCategory,
  reportDate: Date
): number {
  if (asset.capExp !== 'Capitalise') return 0;
  if (asset.disposalDate) return 0;

  // Capital allowance for the year = opening WDV − closing WDV, for both RB and SL. This is
  // what makes openingWDV + additions − CA = closingWDV reconcile exactly (graWDV/graWDVPrior
  // already apply the half-year convention via graYearsElapsed/graYearsElapsedPrior), instead
  // of applying a full year's rate to the full cost regardless of a same-year, half-year
  // acquisition — which previously left the GRA rollforward not adding up for any current-year
  // addition bought in the second half of the year.
  const wdvPrior = graWDVPrior(asset, category, reportDate);
  const wdvCurrent = graWDV(asset, category, reportDate);
  return Math.max(0, Math.round(wdvPrior - wdvCurrent));
}

/** Single source of truth for one asset at report date */
export function computeAsset(
  asset: PpeAsset,
  category: PpeCategory,
  reportDate: Date
): AssetComputation {
  const cost = assetTotalCost(asset);
  const ad = accumDep(asset, category, reportDate);
  const priorAd = priorYearAccumDep(asset, category, reportDate);

  return {
    assetId: asset.id,
    reportYear: reportDate.getFullYear(),
    totalCost: cost,
    residualValue: +(cost * category.residualPct).toFixed(2),
    depreciableAmount: depreciableAmount(cost, category.residualPct),
    accumDep: +ad.toFixed(2),
    nbv: +(cost - ad).toFixed(2),
    annualDepCharge: +annualDepCharge(asset, category, reportDate).toFixed(2),
    priorYrAccumDep: +priorAd.toFixed(2),
    graWdvCurrent: Math.round(graWDV(asset, category, reportDate) * 100) / 100,
    graWdvPrior: Math.round(graWDVPrior(asset, category, reportDate) * 100) / 100,
    graOpeningWdv: Math.round(graOpeningWDV(asset, category, reportDate) * 100) / 100,
    graCaThisYear: graCapitalAllowance(asset, category, reportDate),
    gainLossDisposal: gainLossOnDisposal(asset, category, reportDate),
    remainingLife: remainingLife(asset, category, reportDate),
    presentationGroup: category.presentationGroup,
    graClass: category.graClass,
  };
}

export function reportDateFromInput(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 31);
}

export function defaultReportDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-12-31`;
}
