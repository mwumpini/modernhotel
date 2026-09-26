'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import HRBackButton from '../../components/HRBackButton';
import HRReportsAnalysis from '../../components/HRReportsAnalysis';

export default function HRReportsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <HRBackButton />
      </div>
      <HRReportsAnalysis />
    </PageLayout>
  );
}
