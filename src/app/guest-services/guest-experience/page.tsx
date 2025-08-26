'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import GuestExperienceManager from '../../components/GuestExperienceManager';

export default function GuestExperiencePage() {
  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">👥 Guest Experience Manager</h1>
            <p className="text-gray-600">Manage guest satisfaction, services, and experience enhancement</p>
          </div>

          {/* Guest Experience Manager Component */}
          <GuestExperienceManager />
        </div>
      </div>
    </PageLayout>
  );
}
