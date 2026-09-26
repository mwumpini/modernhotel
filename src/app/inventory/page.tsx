'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PageLayout from '../components/PageLayout';
import InventoryBackButton from '../components/InventoryBackButton';
import InventorySupplyChainDashboard from '../components/InventorySupplyChainDashboard';

/**
 * Full-page Stock & Supply — same ops as the embedded Stores tab, without
 * the module KPI strip / staff / reports chrome. Use Expand from Inventory
 * when you need the table room.
 */
function InventoryOpsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || undefined;

  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <InventoryBackButton />
      </div>
      <InventorySupplyChainDashboard initialTab={tab} />
    </PageLayout>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-slate-500">Loading inventory…</div>}>
      <InventoryOpsContent />
    </Suspense>
  );
}
