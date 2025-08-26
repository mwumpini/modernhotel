'use client';

import React from 'react';
import PageLayout from '../components/PageLayout';
import RoomAssignmentsManager from '../components/RoomAssignmentsManager';

export default function RoomAssignmentsPage() {
  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">🛏️ Room Assignments</h1>
            <p className="text-gray-600">View and manage room assignments for guests</p>
          </div>

          {/* Room Assignments Manager Component */}
          <RoomAssignmentsManager />
        </div>
      </div>
    </PageLayout>
  );
}
