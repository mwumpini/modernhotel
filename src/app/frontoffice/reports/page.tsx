'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import FrontOfficeBackButton from '../../components/FrontOfficeBackButton';
import FrontOfficeReportsAnalysis from '../../components/FrontOfficeReportsAnalysis';

export default function FrontOfficeReportsPage() {
  return (
    <PageLayout>
      <div className="px-3 pt-2 pb-0">
        <FrontOfficeBackButton />
      </div>
      <FrontOfficeReportsAnalysis />
    </PageLayout>
  );
}
