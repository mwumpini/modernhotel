'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import AccountingBackButton from '../../components/AccountingBackButton';
import ReportsAnalysis from '../../components/accounting/ReportsAnalysis';

export default function AccountingReportsPage() {
  return (
    <PageLayout>
      <div className="px-3 pt-2 pb-0">
        <AccountingBackButton />
      </div>
      <ReportsAnalysis />
    </PageLayout>
  );
}
