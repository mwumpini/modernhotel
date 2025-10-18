'use client';

import React from 'react';
import ExecutiveManagementDashboard from '../components/ExecutiveManagementDashboard';
import OfflineIndicator from '../components/OfflineIndicator';

export default function ManagementHome() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Lightweight management shell */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏛️</span>
            <span className="font-semibold text-ghana-black">Executive Management</span>
          </div>
          <OfflineIndicator />
        </div>
      </header>
      <main className="max-w-7xl mx-auto">
        <ExecutiveManagementDashboard />
      </main>
    </div>
  );
}


