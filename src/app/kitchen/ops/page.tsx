'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import KitchenBackButton from '../../components/KitchenBackButton';
import FoodBeverageKitchen from '../../components/FoodBeverageKitchen';

export default function KitchenOpsPage() {
  return (
    <PageLayout>
      <FoodBeverageKitchen fullPage backButton={<KitchenBackButton iconOnly />} />
    </PageLayout>
  );
}
