'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import SecurityBackButton from '../../components/SecurityBackButton';
import SecurityMainDashboard from '../../components/SecurityMainDashboard';

export default function SecurityOpsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <SecurityBackButton />
      </div>
      <SecurityMainDashboard fullPage />
    </PageLayout>
  );
}
