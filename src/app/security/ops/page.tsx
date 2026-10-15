'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import SecurityBackButton from '../../components/SecurityBackButton';
import SecurityMainDashboard from '../../components/SecurityMainDashboard';

export default function SecurityOpsPage() {
  return (
    <PageLayout>
      <SecurityMainDashboard fullPage backButton={<SecurityBackButton iconOnly />} />
    </PageLayout>
  );
}
