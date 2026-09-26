'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import FoodBeverageBackButton from '../../components/FoodBeverageBackButton';
import FoodBeverageMainDashboard from '../../components/FoodBeverageMainDashboard';

export default function FoodBeverageOpsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <FoodBeverageBackButton />
      </div>
      <FoodBeverageMainDashboard fullPage />
    </PageLayout>
  );
}
