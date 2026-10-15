'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import AccountingBackButton from '../../components/AccountingBackButton';
import AccountingMainDashboard from '../../components/AccountingMainDashboard';

export default function AccountingOpsPage() {
  return (
    <PageLayout>
      <AccountingMainDashboard fullPage backButton={<AccountingBackButton iconOnly />} />
    </PageLayout>
  );
}
