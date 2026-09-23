'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import SecurityReportsAnalysis from '../../components/SecurityReportsAnalysis';
import SecurityBackButton from '../../components/SecurityBackButton';

export default function SecurityReportsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <SecurityBackButton />
      </div>
      <SecurityReportsAnalysis />
    </PageLayout>
  );
}
