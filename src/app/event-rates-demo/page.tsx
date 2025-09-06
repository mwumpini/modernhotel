'use client';

import React from 'react';
import EventRateManagement from '../components/EventRateManagement';

export default function EventRatesDemoPage() {
  console.log('EventRatesDemoPage rendering...');
  
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
          <EventRateManagement />
        </div>
      </div>
    </div>
  );
}
