'use client';

import { useEffect, useState } from 'react';
import { APP_NOTIFY_EVENT, type AppNotifyDetail } from '../lib/notifications/notify';

interface AppNotification extends AppNotifyDetail {
  id: string;
}

export default function NotificationToaster() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AppNotifyDetail>).detail;
      const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setNotifications((prev) => [...prev, { id, ...detail }]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, detail.type === 'error' ? 8000 : 4000);
    };
    window.addEventListener(APP_NOTIFY_EVENT, handler);
    return () => window.removeEventListener(APP_NOTIFY_EVENT, handler);
  }, []);

  const dismiss = (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id));

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 380,
        pointerEvents: 'none',
      }}
    >
      {notifications.map((n) => (
        <div
          key={n.id}
          role="alert"
          style={{
            pointerEvents: 'auto',
            background: n.type === 'error' ? '#fee2e2' : '#dcfce7',
            border: `1px solid ${n.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            color: n.type === 'error' ? '#991b1b' : '#166534',
            borderRadius: 8,
            padding: '10px 12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 14,
            lineHeight: 1.4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <div>
              {n.title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{n.title}</div>}
              <div>{n.message}</div>
            </div>
            <button
              onClick={() => dismiss(n.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
                opacity: 0.6,
              }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
