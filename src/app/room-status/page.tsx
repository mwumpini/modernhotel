'use client';

import React from 'react';
import PageLayout from '../components/PageLayout';
import RoomStatusMaintenanceTracker from '../components/RoomStatusMaintenanceTracker';
import FrontOfficeBackButton from '../components/FrontOfficeBackButton';

export default function RoomStatusPage() {
  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <FrontOfficeBackButton />
            <h1 className="text-3xl font-bold text-gray-900">🔧 Room Status & Maintenance</h1>
            <p className="text-gray-600">Track room status and maintenance requests</p>
          </div>

          {/* Room Status & Maintenance Tracker Component */}
          <RoomStatusMaintenanceTracker />
        </div>
      </div>
    </PageLayout>
  );
}
