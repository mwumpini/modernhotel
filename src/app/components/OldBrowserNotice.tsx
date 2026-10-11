'use client';

import React from 'react';

const DISMISS_KEY = 'oldBrowserNotice.dismissedAt';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A small bar for browsers too old to show the system fully (e.g. Chrome/Edge 109,
 * the last on Windows 7/8). Up-to-date browsers never see it. Dismissed for a week.
 */
export default function OldBrowserNotice() {
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - dismissed < SNOOZE_MS) return;
    } catch {
      /* storage blocked: still show */
    }
    // Modern colours (oklch) arrived in Chrome/Edge 111, Safari 15.4 and Firefox 113.
    const modern = typeof CSS !== 'undefined' && CSS.supports?.('color', 'oklch(50% 0.1 180)');
    if (modern) return;
    const oldWindows = /Windows NT 6\.[0-3]/.test(navigator.userAgent); // Windows 7, 8, 8.1
    setMessage(
      oldWindows
        ? 'Your browser no longer gets updates on this version of Windows, so AGM Sync may not look or work right. Please use Mozilla Firefox, or move to Windows 10 or later.'
        : 'Your browser is out of date, so AGM Sync may not look or work right. Please update Chrome, Edge, Firefox or Safari.',
    );
  }, []);

  if (!message) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setMessage(null);
  };

  // Plain hex colours on purpose: this bar must look right on the very browsers it warns.
  return (
    <div
      role="alert"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        background: '#fff7e0', borderTop: '1px solid #e8b400', color: '#3d2f00',
        fontSize: 14, lineHeight: 1.4,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={dismiss}
        style={{
          border: '1px solid #b38900', background: '#ffffff', color: '#3d2f00',
          borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13,
        }}
      >
        OK
      </button>
    </div>
  );
}
