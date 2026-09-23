'use client';

import React from 'react';
import { tickNightAuditScheduler } from '../lib/frontoffice/nightAuditScheduler';

/**
 * Runs at 1:00am local time when the app is open and night_audit_auto_run is enabled.
 * Console logs use prefix [NightAuditScheduler] — see nightAuditScheduler.ts.
 * To test: temporarily adjust isNightAuditScheduleWindow() in nightAudit.ts, then restore.
 */
export default function NightAuditScheduler() {
  React.useEffect(() => {
    const interval = window.setInterval(() => {
      try {
        void tickNightAuditScheduler(new Date());
      } catch (e) {
        console.warn('[NightAuditScheduler] tick failed', e);
      }
    }, 60_000);

    // Run once on mount in case the tab was opened during the window
    try {
      void tickNightAuditScheduler(new Date());
    } catch {}

    return () => window.clearInterval(interval);
  }, []);

  return null;
}
