'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import FrontOfficeBackButton from '../../components/FrontOfficeBackButton';
import FrontdeskDashboard from '../../components/FrontdeskDashboard';

export default function FrontOfficeOpsPage() {
  return (
    <PageLayout>
      <FrontdeskDashboard fullPage backButton={<FrontOfficeBackButton iconOnly />} />
    </PageLayout>
  );
}
