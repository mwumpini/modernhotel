'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import KitchenReportsAnalysis from '../../components/KitchenReportsAnalysis';
import KitchenBackButton from '../../components/KitchenBackButton';

export default function KitchenReportsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <KitchenBackButton />
      </div>
      <KitchenReportsAnalysis />
    </PageLayout>
  );
}
