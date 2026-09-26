'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import HousekeepingBackButton from '../../components/HousekeepingBackButton';
import HousekeepingReportsAnalysis from '../../components/HousekeepingReportsAnalysis';

export default function HousekeepingReportsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <HousekeepingBackButton />
      </div>
      <HousekeepingReportsAnalysis />
    </PageLayout>
  );
}
