export type CapExpStatus = 'Capitalise' | 'Expense' | 'Disposed';
export type GraMethod = 'RB' | 'SL';
export type IasMethod = 'SL' | 'RB';

export type PresentationGroup =
  | 'Land'
  | 'Building'
  | 'Motor Vehicle & Machinery'
  | 'Furniture & Fixtures'
  | 'Computer & Accessories'
  | 'Kitchen Equipment & Utensils'
  | 'Intangible Assets';

export type GraClass = 'Class 1' | 'Class 2' | 'Class 3' | 'Class 4';

export interface PpeCategory {
  id: string;
  name: string;
  graClass: GraClass;
  graRate: number;
  graMethod: GraMethod;
  iasMethod: IasMethod;
  /** Used for RB IAS; informational for SL */
  iasRate: number;
  usefulLifeYrs: number;
  residualPct: number;
  presentationGroup: PresentationGroup;
  organisationId?: string;
}

export interface PpeAsset {
  id: string;
  purchaseDate: string; // ISO date YYYY-MM-DD
  assetCode: string;
  assetName: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  capExp: CapExpStatus;
  disposalDate?: string | null;
  disposalProceeds?: number | null;
  organisationId?: string;
  /** Link to GL capitalization journal when posted */
  capitalizationJournalEntryId?: string;
  /** Cumulative IAS book dep posted to GL 1520 for this asset */
  ledgerAccumDepPosted?: number;
  lastDepreciationJournalEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RemainingLife {
  years: number;
  months: number;
  display: string;
}

export interface AssetComputation {
  assetId: string;
  reportYear: number;
  totalCost: number;
  residualValue: number;
  depreciableAmount: number;
  accumDep: number;
  nbv: number;
  annualDepCharge: number;
  priorYrAccumDep: number;
  graWdvCurrent: number;
  graWdvPrior: number;
  graOpeningWdv: number;
  graCaThisYear: number;
  gainLossDisposal: number | null;
  remainingLife: RemainingLife | null;
  presentationGroup: PresentationGroup;
  graClass: GraClass;
}

export interface FsGroupSummary {
  costOpening: number;
  additions: number;
  costClosing: number;
  depOpening: number;
  chargeForYear: number;
  depClosing: number;
  nbv: number;
}

export type FsSummarySection4 = Record<PresentationGroup | 'TOTAL', FsGroupSummary>;

export interface GraClassRollforward {
  openingWDV: number;
  additions: number;
  caClaimed: number;
  closingWDV: number;
}

export type GraRollforward = Record<GraClass | 'TOTAL', GraClassRollforward>;

export interface DisposalRow {
  disposalDate: string;
  assetName: string;
  assetCode: string;
  cost: number;
  accumDep: number;
  nbvAtDisposal: number;
  proceeds: number;
  gainLoss: number | null;
}
