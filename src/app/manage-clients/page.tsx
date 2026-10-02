'use client';

import { useEffect } from 'react';

/** Old standalone client page. Clients live on the Front Office desk. */
export default function ManageClientsRedirect() {
  useEffect(() => {
    try {
      localStorage.setItem('nav.section', 'frontdesk');
      localStorage.setItem('fo.tab', 'clients');
    } catch {
      /* ignore */
    }
    window.location.replace('/');
  }, []);
  return <div className="p-6 text-center">Opening Front Office...</div>;
 }
