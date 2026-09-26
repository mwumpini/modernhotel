'use client';

import React, { Suspense } from 'react';
import PageLayout from '../../components/PageLayout';
import HousekeepingBackButton from '../../components/HousekeepingBackButton';
import HousekeepingMainDashboard from '../../components/HousekeepingMainDashboard';

export default function HousekeepingOpsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <HousekeepingBackButton />
      </div>
      {/* HousekeepingMainDashboard reads useSearchParams(), which Next.js requires
          a Suspense boundary around during static prerendering. */}
      <Suspense fallback={null}>
        <HousekeepingMainDashboard fullPage />
      </Suspense>
    </PageLayout>
  );
}
