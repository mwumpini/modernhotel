'use client';

import React from 'react';
import PageLayout from '../components/PageLayout';
import FrontOfficeReportsAnalysis from '../components/FrontOfficeReportsAnalysis';
import FrontOfficeBackButton from '../components/FrontOfficeBackButton';

export default function ReportsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <FrontOfficeBackButton />
      </div>
      <FrontOfficeReportsAnalysis />
    </PageLayout>
  );
}
