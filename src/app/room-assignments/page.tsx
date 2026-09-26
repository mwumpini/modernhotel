'use client';

import { useEffect } from 'react';

export default function RoomAssignmentsPage() {
  useEffect(() => {
    try {
      localStorage.setItem('nav.section', 'frontdesk');
      localStorage.setItem('fo.tab', 'rooms');
    } catch {
      /* ignore */
    }
    window.location.replace('/');
  }, []);

  return <div className="p-6 text-center">Opening Front Office...</div>;
}
