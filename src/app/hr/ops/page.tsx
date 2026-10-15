'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import HRBackButton from '../../components/HRBackButton';
import HRMainDashboard from '../../components/HRMainDashboard';

export default function HROpsPage() {
  return (
    <PageLayout>
      <HRMainDashboard fullPage backButton={<HRBackButton iconOnly />} />
    </PageLayout>
  );
}
