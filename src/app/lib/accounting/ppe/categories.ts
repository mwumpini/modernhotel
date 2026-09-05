import type { PpeCategory, PresentationGroup } from './types';

export const PRESENTATION_GROUPS: PresentationGroup[] = [
  'Land',
  'Building',
  'Motor Vehicle & Machinery',
  'Furniture & Fixtures',
  'Computer & Accessories',
  'Kitchen Equipment & Utensils',
  'Intangible Assets',
];

export const GRA_CLASSES = ['Class 1', 'Class 2', 'Class 3', 'Class 4'] as const;

/** Asset-code prefix per FS presentation group — e.g. "FFE-001" for a Furniture & Fixtures
 *  asset. Used to auto-suggest a code when adding an asset; the field stays editable. */
export const PRESENTATION_GROUP_PREFIX: Record<PresentationGroup, string> = {
  'Land': 'LND',
  'Building': 'BLD',
  'Motor Vehicle & Machinery': 'MV',
  'Furniture & Fixtures': 'FFE',
  'Computer & Accessories': 'CE',
  'Kitchen Equipment & Utensils': 'KE',
  'Intangible Assets': 'IA',
};

export const DEFAULT_ORG_ID = 'default-org';

const cat = (
  id: string,
  name: string,
  partial: Omit<PpeCategory, 'id' | 'name' | 'organisationId'>
): PpeCategory => ({
  id,
  name,
  organisationId: DEFAULT_ORG_ID,
  ...partial,
});

/** Default hotel PPE categories — IAS 16 + GRA Act 896 aligned */
export const DEFAULT_PPE_CATEGORIES: PpeCategory[] = [
  cat('cat-land', 'Land', {
    codePrefix: 'LND',
    graClass: 'Class 4',
    graRate: 0,
    graMethod: 'SL',
    iasMethod: 'SL',
    iasRate: 0,
    usefulLifeYrs: 0,
    residualPct: 0,
    presentationGroup: 'Land',
  }),
  cat('cat-building', 'Building', {
    codePrefix: 'BLD',
    graClass: 'Class 4',
    graRate: 0.1,
    graMethod: 'SL',
    iasMethod: 'SL',
    iasRate: 0.05,
    usefulLifeYrs: 40,
    residualPct: 0.05,
    presentationGroup: 'Building',
  }),
  cat('cat-motor', 'Motor Vehicle', {
    codePrefix: 'MV',
    graClass: 'Class 2',
    graRate: 0.3,
    graMethod: 'RB',
    iasMethod: 'RB',
    iasRate: 0.25,
    usefulLifeYrs: 5,
    residualPct: 0.05,
    presentationGroup: 'Motor Vehicle & Machinery',
  }),
  cat('cat-plant', 'Plant & Machinery', {
    codePrefix: 'PM',
    graClass: 'Class 3',
    graRate: 0.2,
    graMethod: 'RB',
    iasMethod: 'RB',
    iasRate: 0.2,
    usefulLifeYrs: 10,
    residualPct: 0.05,
    presentationGroup: 'Motor Vehicle & Machinery',
  }),
  cat('cat-ffe', 'Furniture, Fixtures & Equipment', {
    codePrefix: 'FFE',
    graClass: 'Class 3',
    graRate: 0.2,
    graMethod: 'RB',
    iasMethod: 'SL',
    iasRate: 0.2,
    usefulLifeYrs: 7,
    residualPct: 0.05,
    presentationGroup: 'Furniture & Fixtures',
  }),
  cat('cat-computer', 'Computer & Accessories', {
    codePrefix: 'CE',
    graClass: 'Class 1',
    graRate: 0.4,
    graMethod: 'RB',
    iasMethod: 'RB',
    iasRate: 0.4,
    usefulLifeYrs: 4,
    residualPct: 0,
    presentationGroup: 'Computer & Accessories',
  }),
  cat('cat-kitchen', 'Kitchen Equipment & Utensils', {
    codePrefix: 'KE',
    graClass: 'Class 3',
    graRate: 0.2,
    graMethod: 'RB',
    iasMethod: 'SL',
    iasRate: 0.2,
    usefulLifeYrs: 8,
    residualPct: 0.05,
    presentationGroup: 'Kitchen Equipment & Utensils',
  }),
  cat('cat-intangible', 'Intangible Assets', {
    codePrefix: 'IA',
    graClass: 'Class 3',
    graRate: 0.2,
    graMethod: 'RB',
    iasMethod: 'SL',
    iasRate: 0.2,
    usefulLifeYrs: 5,
    residualPct: 0,
    presentationGroup: 'Intangible Assets',
  }),
];

export const SAMPLE_PPE_ASSETS = [
  {
    id: 'ppe-001',
    purchaseDate: '2023-03-15',
    assetCode: 'CA-001',
    assetName: 'Lobby furniture suite',
    categoryId: 'cat-ffe',
    quantity: 1,
    unitPrice: 85000,
    capExp: 'Capitalise' as const,
    organisationId: DEFAULT_ORG_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ppe-002',
    purchaseDate: '2024-01-10',
    assetCode: 'CA-002',
    assetName: 'Kitchen combi ovens (×2)',
    categoryId: 'cat-kitchen',
    quantity: 2,
    unitPrice: 45000,
    capExp: 'Capitalise' as const,
    organisationId: DEFAULT_ORG_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ppe-003',
    purchaseDate: '2024-08-20',
    assetCode: 'CA-003',
    assetName: 'Hotel POS terminals',
    categoryId: 'cat-computer',
    quantity: 4,
    unitPrice: 3500,
    capExp: 'Capitalise' as const,
    organisationId: DEFAULT_ORG_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
