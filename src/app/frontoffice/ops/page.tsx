'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import FrontOfficeBackButton from '../../components/FrontOfficeBackButton';
import FrontdeskDashboard from '../../components/FrontdeskDashboard';

export default function FrontOfficeOpsPage() {
  return (
    <PageLayout>
      <div className="px-3 pt-2 pb-0">
        <FrontOfficeBackButton />
      </div>
      <FrontdeskDashboard fullPage />
    </PageLayout>
  );
}
