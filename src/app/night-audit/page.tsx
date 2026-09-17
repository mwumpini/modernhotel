'use client';

import React from 'react';
import PageLayout from '../components/PageLayout';
import FrontofficeNightAudit from '../components/FrontofficeNightAudit';
import FrontOfficeBackButton from '../components/FrontOfficeBackButton';

export default function NightAuditPage() {
  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <FrontOfficeBackButton />
          <FrontofficeNightAudit />
        </div>
      </div>
    </PageLayout>
  );
}
