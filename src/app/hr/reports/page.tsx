'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import PageLayout from '../../components/PageLayout';
import HRBackButton from '../../components/HRBackButton';

const HRReportsAnalysis = dynamic(() => import('../../components/HRReportsAnalysis'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6">
      <p className="text-gray-500">Preparing report…</p>
    </div>
  ),
});

export default function HRReportsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <HRBackButton />
      </div>
      <HRReportsAnalysis />
    </PageLayout>
  );
}
