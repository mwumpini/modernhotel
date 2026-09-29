'use client';

import React, { useEffect, useState } from 'react';
import { Switch } from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';

type PosPolicy = { waiterSwitch: boolean; showMenuImages: boolean };

const ROWS: Array<{ key: keyof PosPolicy; title: string; help: React.ReactNode }> = [
  {
    key: 'waiterSwitch',
    title: 'POS: waiters switch in with a PIN',
    help: (
      <>
        For a POS computer shared by several waiters. Each order asks &ldquo;Who&rsquo;s ordering?&rdquo;: staff tap their name and type
        their PIN, and the terminal locks again after the order is sent. Off: orders are recorded under whoever is signed in.
        Set each person&rsquo;s PIN under Users → Edit.
      </>
    ),
  },
  {
    key: 'showMenuImages',
    title: 'POS: show menu photos',
    help: <>Menu cards on the POS show the item&rsquo;s photo, where one was added in Menu &amp; Inventory. Off: every card shows a simple food or drink icon.</>,
  },
];

/** Settings → Security: hotel-wide POS switches (saved on the server, so every terminal follows them). */
export default function PosWaiterSwitchSetting({ isDisabled }: { isDisabled?: boolean }) {
  const [policy, setPolicy] = useState<PosPolicy | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings/pos', { headers: { 'x-tenant-subdomain': getClientTenantSubdomain() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPolicy({ waiterSwitch: !!d?.policy?.waiterSwitch, showMenuImages: !!d?.policy?.showMenuImages }))
      .catch(() => setPolicy({ waiterSwitch: false, showMenuImages: false }));
  }, []);

  const save = async (key: keyof PosPolicy, value: boolean) => {
    const previous = policy;
    setPolicy((p) => (p ? { ...p, [key]: value } : p));
    setError('');
    try {
      const res = await fetch('/api/settings/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setPolicy(previous);
      setError('Could not save. Check your permission and try again.');
    }
  };

  return (
    <>
      {ROWS.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div>
            <h4 className="text-sm font-medium">{row.title}</h4>
            <p className="text-xs text-gray-600">{row.help}</p>
          </div>
          <Switch
            size="sm"
            aria-label={row.title}
            isSelected={!!policy?.[row.key]}
            isDisabled={isDisabled || policy === null}
            onValueChange={(v) => save(row.key, v)}
          />
        </div>
      ))}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </>
  );
}
