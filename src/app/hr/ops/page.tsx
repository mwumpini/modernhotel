'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import HRBackButton from '../../components/HRBackButton';
import HRMainDashboard from '../../components/HRMainDashboard';

export default function HROpsPage() {
  return (
    <PageLayout>
      <div className="px-3 pt-2 pb-0">
        <HRBackButton />
      </div>
      <HRMainDashboard fullPage />
    </PageLayout>
  );
}
