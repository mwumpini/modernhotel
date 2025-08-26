'use client';

import React from 'react';
import PageLayout from '../../components/PageLayout';
import MobileGuestServices from '../../components/MobileGuestServices';

export default function MobileServicesPage() {
  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">📱 Mobile Guest Services</h1>
            <p className="text-gray-600">Mobile app guest services and digital experience management</p>
          </div>

          {/* Mobile Guest Services Component */}
          <MobileGuestServices />
        </div>
      </div>
    </PageLayout>
  );
}
