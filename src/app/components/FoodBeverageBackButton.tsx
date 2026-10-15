'use client';

import { openFoodBeverageOverview } from '../lib/api/appNavigation';
import ModuleBackButton from './ModuleBackButton';

export default function FoodBeverageBackButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return <ModuleBackButton label="Food & Beverage" onPress={openFoodBeverageOverview} iconOnly={iconOnly} className={className} />;
}
