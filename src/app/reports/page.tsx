'use client';

import { useEffect } from 'react';

export default function ReportsPage() {
  useEffect(() => {
    try {
      localStorage.setItem('nav.section', 'frontdesk');
      localStorage.setItem('fo.tab', 'reports');
    } catch {
      /* ignore */
    }
    window.location.replace('/');
  }, []);

  return <div className="p-6 text-center">Opening Front Office...</div>;
}
