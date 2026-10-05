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
  // Event folios, invoices and receipts are kept only in this browser.
  `events.billingDocs.${tenant}`,
  // Actions queued while offline would send cleared records back.
  'ghanaHotel_offlineData',
  'hr.addEmployee.draft',
  'payroll.advicePeriodId',
  'exec.ackAlerts',
];

/** Bump when LOCAL_DATA_KEYS grows, so browsers that already handled a clear run the fuller cleanup once. */
const CLEANUP_VERSION = 2;

/** When this page was opened. Anything it holds in memory is from then or later. */
const PAGE_OPENED_AT = new Date().toISOString();

export default function DataResetWatcher() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    // A tab left open during a clear still holds the old records in memory (Accounting keeps
    // invoices the server no longer has), so check again whenever the tab comes back into view.
    const check = () => fetch('/api/settings/data-reset', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const resetAt = typeof data?.resetAt === 'string' ? data.resetAt : null;
        if (cancelled || !resetAt) return;
        const tenant = getClientTenantSubdomain() || 'default';
        const seenKey = `data.resetSeen.v${CLEANUP_VERSION}.${tenant}`;
        let seen: string | null = null;
        try { seen = localStorage.getItem(seenKey); } catch { return; }
        // Reload at most once per clear, so a computer clock behind the server's can't loop.
        const reloadOnce = () => {
          const doneKey = `data.resetReloaded.${tenant}`;
          try {
            if (sessionStorage.getItem(doneKey) === resetAt) return;
            sessionStorage.setItem(doneKey, resetAt);
          } catch { return; }
          window.location.reload();
        };
        if (seen && seen >= resetAt) {
          if (resetAt > PAGE_OPENED_AT) reloadOnce();
          return;
        }
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
        if (hadLocalData || resetAt > PAGE_OPENED_AT) reloadOnce();
      })
      .catch(() => {});
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [status]);

  return null;
}
