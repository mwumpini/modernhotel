'use client';

import React from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useSettingsStore } from '../lib/settings/store';
import { idleTimedOut } from '../lib/settings/sessionIdle';

const ACTIVITY_KEY = 'session.lastActivity';

/** Signs the staff member out after Settings → Security "Session Timeout" minutes with no activity. */
export default function SessionIdleGuard() {
  const { status } = useSession();
  const timeout = useSettingsStore((s) => s.security.sessionTimeout);

  React.useEffect(() => {
    if (status !== 'authenticated') return;
    const minutes = Number(timeout);
    if (!Number.isFinite(minutes) || minutes < 1) return;

    const read = () => {
      const raw = Number(sessionStorage.getItem(ACTIVITY_KEY));
      return Number.isFinite(raw) && raw > 0 ? raw : Date.now();
    };
    const stamp = () => sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    if (!sessionStorage.getItem(ACTIVITY_KEY)) stamp();

    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      const last = read();
      if (idleTimedOut(last, Date.now(), minutes)) {
        signOut({ callbackUrl: '/' });
        return;
      }
      const wait = minutes * 60 * 1000 - (Date.now() - last);
      timer = window.setTimeout(arm, Math.max(1000, wait));
    };
    const bump = () => {
      stamp();
      arm();
    };
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((event) => window.addEventListener(event, bump, { passive: true }));
    arm();
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, bump));
    };
  }, [status, timeout]);

  return null;
}
