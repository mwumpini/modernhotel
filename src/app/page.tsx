'use client';

import React from 'react';
import Navigation from './components/Navigation';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onLogout={() => console.log('Logout clicked')} />
    </div>
  );
}
