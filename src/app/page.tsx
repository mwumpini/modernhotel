'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSettingsStore } from './lib/settings/store';
import Navigation from './components/Navigation';

export default function Home() {
  const router = useRouter();
  const initialSetupCompleted = useSettingsStore(s => s.initialSetupCompleted);
  // Temporarily disable authentication to resolve NextAuth errors
  // TODO: Re-enable when NextAuth is properly configured

  // Role-based landing (client-safe, runs after mount)
  React.useEffect(() => {
    try {
      if (!initialSetupCompleted) {
        router.replace('/setup');
        return;
      }
    } catch {}
    try {
      const role = window.localStorage.getItem('app.role');
      // If role matches executive roles, ensure dashboard loads (we already render it by default)
      if (role && ['gm','general-manager','director','owner','admin','manager'].includes(role)) {
        // Optionally, could navigate to /management, but we already show Navigation with executive default
      }
    } catch {}
  }, [initialSetupCompleted, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onLogout={() => console.log('Logout clicked')} />
    </div>
  );
}
