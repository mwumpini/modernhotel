'use client';

import React from 'react';
import PageLayout from '../components/PageLayout';
import HousekeepingMainDashboard from '../components/HousekeepingMainDashboard';

export default function HousekeepingPage() {
  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">🏠 Housekeeping & Maintenance</h1>
            <p className="text-gray-600">Comprehensive room management, task assignment, and quality control system</p>
          </div>

          {/* Main Housekeeping Dashboard */}
          <HousekeepingMainDashboard />
        </div>
      </div>
    </PageLayout>
  );
}
