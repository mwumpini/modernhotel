'use client';

import { useEffect } from 'react';

export default function HousekeepingPage() {
  useEffect(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get('tab');
      localStorage.setItem('nav.section', 'housekeeping');
      if (tab) localStorage.setItem('hk.tab', tab);
    } catch {
      /* ignore */
    }
    window.location.replace('/');
  }, []);

  return <div className="p-6 text-center text-gray-500">Opening housekeeping…</div>;
}
