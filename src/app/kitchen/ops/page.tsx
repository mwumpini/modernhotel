'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import KitchenBackButton from '../../components/KitchenBackButton';
import FoodBeverageKitchen from '../../components/FoodBeverageKitchen';

export default function KitchenOpsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <KitchenBackButton />
      </div>
      <FoodBeverageKitchen fullPage />
    </PageLayout>
  );
}
