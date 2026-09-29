'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import EventsReportsAnalysis from '../../components/EventsReportsAnalysis';
import EventsBackButton from '../../components/EventsBackButton';

export default function EventsReportsPage() {
  return (
    <PageLayout>
      <div className="px-3 pt-2 pb-0">
        <EventsBackButton />
      </div>
      <EventsReportsAnalysis />
    </PageLayout>
  );
}
