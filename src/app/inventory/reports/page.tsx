'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import InventoryReportsAnalysis from '../../components/InventoryReportsAnalysis';
import InventoryBackButton from '../../components/InventoryBackButton';

export default function InventoryReportsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <InventoryBackButton />
      </div>
      <InventoryReportsAnalysis />
    </PageLayout>
  );
}
