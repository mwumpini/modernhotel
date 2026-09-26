'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import HRBackButton from '../../components/HRBackButton';
import HRMainDashboard from '../../components/HRMainDashboard';

export default function HROpsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <HRBackButton />
      </div>
      <HRMainDashboard fullPage />
    </PageLayout>
  );
}
