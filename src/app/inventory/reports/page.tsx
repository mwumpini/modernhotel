'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import InventoryReportsAnalysis from '../../components/InventoryReportsAnalysis';
import InventoryBackButton from '../../components/InventoryBackButton';

export default function InventoryReportsPage() {
  return (
    <PageLayout>
      <div className="px-3 pt-2 pb-0">
        <InventoryBackButton />
      </div>
      <InventoryReportsAnalysis />
    </PageLayout>
  );
}
