'use client';

import React, { useEffect, useState } from 'react';
import { Switch } from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';

/** Settings → Security: whether POS terminals ask "Who's ordering?" (name + PIN) before each order. */
export default function PosWaiterSwitchSetting({ isDisabled }: { isDisabled?: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings/pos', { headers: { 'x-tenant-subdomain': getClientTenantSubdomain() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setOn(!!d?.policy?.waiterSwitch))
      .catch(() => setOn(false));
  }, []);

  const save = async (value: boolean) => {
    const previous = on;
    setOn(value);
    setError('');
    try {
      const res = await fetch('/api/settings/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() },
        body: JSON.stringify({ waiterSwitch: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setOn(previous);
      setError('Could not save. Check your permission and try again.');
    }
  };

  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium">POS: waiters switch in with a PIN</h4>
          <p className="text-xs text-gray-600">
            For a POS computer shared by several waiters. Each order asks &ldquo;Who&rsquo;s ordering?&rdquo;: staff tap their name and type
            their PIN, and the terminal locks again after the order is sent. Off: orders are recorded under whoever is signed in.
            Set each person&rsquo;s PIN under Users → Edit.
          </p>
        </div>
        <Switch size="sm" aria-label="POS: waiters switch in with a PIN" isSelected={!!on} isDisabled={isDisabled || on === null} onValueChange={save} />
      </div>
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
