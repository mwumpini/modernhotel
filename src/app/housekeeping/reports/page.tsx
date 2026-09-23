'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import HousekeepingReportsAnalysis from '../../components/HousekeepingReportsAnalysis';
import HousekeepingBackButton from '../../components/HousekeepingBackButton';

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
