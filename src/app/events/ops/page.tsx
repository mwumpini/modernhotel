'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import EventsBackButton from '../../components/EventsBackButton';
import EventsConferencesMainDashboard from '../../components/EventsConferencesMainDashboard';

export default function EventsOpsPage() {
  return (
    <PageLayout>
      <div className="p-6 pb-0">
        <EventsBackButton />
      </div>
      <EventsConferencesMainDashboard fullPage />
    </PageLayout>
  );
}
