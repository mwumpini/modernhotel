'use client';

import React, { Suspense } from 'react';

function EventRatesDemoContent() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎯 Event & Conference Rate Management
          </h1>
          <p className="text-xl text-gray-600">
            Test and configure your event pricing system
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center py-8">
            <p className="text-gray-600">Event Rate Management temporarily disabled for build optimization.</p>
            <p className="text-sm text-gray-500 mt-2">This page will be restored after resolving store initialization issues.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventRatesDemoPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EventRatesDemoContent />
    </Suspense>
  );
}
