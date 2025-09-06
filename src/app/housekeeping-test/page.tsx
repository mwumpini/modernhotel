'use client';

import React, { Suspense } from 'react';
import PageLayout from '../components/PageLayout';
import HousekeepingMainDashboard from '../components/HousekeepingMainDashboard';

export default function HousekeepingTestPage() {
  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">🧪 Housekeeping System Test</h1>
            <p className="text-gray-600">Testing all housekeeping components and functionality</p>
          </div>

          {/* Test Instructions */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Test Instructions:</h3>
            <ul className="text-blue-700 space-y-1 text-sm">
              <li>• Navigate between different tabs to test all components</li>
              <li>• Try creating tasks, maintenance requests, and room inspections</li>
              <li>• Test room status updates and staff assignments</li>
              <li>• Verify that URL updates correctly when switching tabs</li>
              <li>• Check that all forms and modals work properly</li>
            </ul>
          </div>

          {/* Main Housekeeping Dashboard */}
          <Suspense fallback={<div>Loading housekeeping dashboard...</div>}>
            <HousekeepingMainDashboard />
          </Suspense>
        </div>
      </div>
    </PageLayout>
  );
}
