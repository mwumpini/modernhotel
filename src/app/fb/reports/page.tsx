'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import FoodBeverageBackButton from '../../components/FoodBeverageBackButton';
import FoodBeverageReportsAnalysis from '../../components/FoodBeverageReportsAnalysis';

export default function FoodBeverageReportsPage() {
  return (
    <PageLayout>
      <div className="px-3 pt-2 pb-0">
        <FoodBeverageBackButton />
      </div>
      <FoodBeverageReportsAnalysis />
    </PageLayout>
  );
}
