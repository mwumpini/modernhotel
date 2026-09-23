'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import FoodBeverageReportsAnalysis from '../../components/FoodBeverageReportsAnalysis';
import FoodBeverageBackButton from '../../components/FoodBeverageBackButton';

export default function FoodBeverageReportsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <FoodBeverageBackButton />
      </div>
      <FoodBeverageReportsAnalysis />
    </PageLayout>
  );
}
