'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import KitchenReportsAnalysis from '../../components/KitchenReportsAnalysis';
import KitchenBackButton from '../../components/KitchenBackButton';

export default function KitchenReportsPage() {
  return (
    <PageLayout>
      <div className="px-3 pt-2 pb-0">
        <KitchenBackButton />
      </div>
      <KitchenReportsAnalysis />
    </PageLayout>
  );
}
