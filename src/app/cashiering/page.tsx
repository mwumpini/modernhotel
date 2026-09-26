'use client';

import { useEffect } from 'react';

export default function CashieringPage() {
  useEffect(() => {
    try {
      localStorage.setItem('nav.section', 'frontdesk');
      localStorage.setItem('fo.tab', 'cashiering');
    } catch {
      /* ignore */
    }
    window.location.replace('/');
  }, []);

  return <div className="p-6 text-center">Opening Front Office...</div>;
}
