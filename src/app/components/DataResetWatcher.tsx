'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';

/**
 * After "Clear test data" (Settings → Sample Data), forget this browser's local copies of cleared
 * records, once, then reload. Without this, screens that copy their local list to an empty server
 * (the fixed-asset register, for one) could put old test records back.
 * Settings, preferences and numbering are left alone.
 */
const LOCAL_DATA_KEYS = (tenant: string) => [
  'ppe.register.v1',
  `bank.recon.v1.${tenant}`,
  `kitchen.ops.log.${tenant}`,
  'fo.guests',
  'fo.nightAudit',
];

export default function DataResetWatcher() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    fetch('/api/settings/data-reset', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const resetAt = typeof data?.resetAt === 'string' ? data.resetAt : null;
        if (cancelled || !resetAt) return;
        const tenant = getClientTenantSubdomain() || 'default';
        const seenKey = `data.resetSeen.${tenant}`;
        let seen: string | null = null;
        try { seen = localStorage.getItem(seenKey); } catch { return; }
        if (seen && seen >= resetAt) return;
        let hadLocalData = false;
        try {
          for (const storage of [localStorage, sessionStorage]) {
            for (const key of LOCAL_DATA_KEYS(tenant)) {
              if (storage.getItem(key) !== null) hadLocalData = true;
              storage.removeItem(key);
            }
          }
          localStorage.setItem(seenKey, resetAt);
        } catch { return; }
        // Screens already loaded their copy into memory; reload so they start from the server.
        if (hadLocalData) window.location.reload();
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [status]);

  return null;
}
