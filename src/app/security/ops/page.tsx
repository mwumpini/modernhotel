'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import SecurityBackButton from '../../components/SecurityBackButton';
import SecurityMainDashboard from '../../components/SecurityMainDashboard';

export default function SecurityOpsPage() {
  return (
    <PageLayout>
      <div className="px-3 pt-2 pb-0">
        <SecurityBackButton />
      </div>
      <SecurityMainDashboard fullPage />
    </PageLayout>
  );
}
