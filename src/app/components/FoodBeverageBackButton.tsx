'use client';

import { Button } from '@heroui/react';
import { openFoodBeverageOverview } from '../lib/api/appNavigation';

export default function FoodBeverageBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      variant="flat"
      className={`mb-3 -ml-2 text-ghana-green font-semibold ${className}`}
      onPress={openFoodBeverageOverview}
    >
      ← Back to Food & Beverage
    </Button>
  );
}
