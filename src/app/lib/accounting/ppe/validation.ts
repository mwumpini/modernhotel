import type { PpeAsset, CapExpStatus, PpeCategory } from './types';

export const VALID_CAP_EXP: CapExpStatus[] = ['Capitalise', 'Expense', 'Disposed'];

export function validateCategory(category: Partial<PpeCategory>): string[] {
  const errors: string[] = [];

  if (!category.name?.trim()) errors.push('Category name is required');
  if (!category.presentationGroup) errors.push('FS presentation group is required');
  if (!category.graClass) errors.push('GRA class is required');
  if (category.graRate == null || category.graRate < 0 || category.graRate > 1) {
    errors.push('GRA rate must be between 0% and 100%');
  }
  if (!category.graMethod) errors.push('GRA method is required');
  if (!category.iasMethod) errors.push('IAS method is required');
  if (category.iasMethod === 'RB' && (category.iasRate == null || category.iasRate <= 0 || category.iasRate > 1)) {
    errors.push('IAS rate is required for declining balance (0–100%)');
  }
  if (category.usefulLifeYrs == null || category.usefulLifeYrs < 0) {
    errors.push('Useful life cannot be negative');
  }
  if (category.iasMethod === 'SL' && category.presentationGroup !== 'Land' && !category.usefulLifeYrs) {
    errors.push('Useful life (years) is required for straight-line IAS');
  }
  if (category.residualPct == null || category.residualPct < 0 || category.residualPct > 1) {
    errors.push('Residual value must be between 0% and 100%');
  }

  return errors;
}

export function validateAsset(asset: Partial<PpeAsset>): string[] {
  const errors: string[] = [];

  if (!asset.purchaseDate) errors.push('Purchase date is required');
  if (!asset.assetCode?.trim()) errors.push('Asset code is required');
  if (!asset.assetName?.trim()) errors.push('Asset name is required');
  if (!asset.categoryId) errors.push('Category is required');
  if (!asset.quantity || asset.quantity <= 0) errors.push('Quantity must be greater than 0');
  if (!asset.unitPrice || asset.unitPrice <= 0) errors.push('Unit price must be greater than 0');
  if (!asset.capExp || !VALID_CAP_EXP.includes(asset.capExp)) {
    errors.push('Cap/Exp must be Capitalise, Expense, or Disposed');
  }

  if (asset.capExp === 'Disposed') {
    if (!asset.disposalDate) errors.push('Disposal date is required when Cap/Exp = Disposed');
    if (asset.disposalDate && asset.purchaseDate && asset.disposalDate < asset.purchaseDate) {
      errors.push('Disposal date cannot be before purchase date');
    }
  }

  if (asset.capExp !== 'Disposed' && asset.disposalDate) {
    errors.push('Disposal date should only be set when Cap/Exp = Disposed');
  }

  return errors;
}
