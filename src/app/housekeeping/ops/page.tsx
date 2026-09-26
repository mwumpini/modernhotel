'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import HousekeepingBackButton from '../../components/HousekeepingBackButton';
import HousekeepingMainDashboard from '../../components/HousekeepingMainDashboard';

export default function HousekeepingOpsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <HousekeepingBackButton />
      </div>
      <HousekeepingMainDashboard fullPage />
    </PageLayout>
  );
}
