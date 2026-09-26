'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import AccountingBackButton from '../../components/AccountingBackButton';
import AccountingMainDashboard from '../../components/AccountingMainDashboard';

export default function AccountingOpsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <AccountingBackButton />
      </div>
      <AccountingMainDashboard fullPage />
    </PageLayout>
  );
}
