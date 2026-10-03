'use client';

import React, { useState } from 'react';
import { Button, Input } from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import { pinLengthError } from '../../lib/auth/posPin';
import { useSettingsStore } from '../../lib/settings/store';

/**
 * Sets or removes the short PIN a staff member types to switch in on a shared POS terminal.
 * Saved straight away (not with the rest of the Edit User form); the PIN is hashed on the server.
 */
export default function PosPinSection({ userId, userName }: { userId: string; userName: string }) {
  const pinRule = useSettingsStore((s) => s.security.pinPolicy);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const call = async (method: 'PUT' | 'DELETE') => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/pos-pin`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() },
        body: method === 'PUT' ? JSON.stringify({ pin }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: 'error', text: data.error || 'Could not save the PIN.' });
        return;
      }
      setPin('');
      setMessage({ tone: 'ok', text: method === 'PUT' ? `PIN saved. ${userName} can now switch in on the POS.` : 'PIN removed.' });
    } catch {
      setMessage({ tone: 'error', text: 'Could not reach the server. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const lengthHint = pinRule.minLength === pinRule.maxLength
    ? `${pinRule.minLength} digits`
    : `${pinRule.minLength} to ${pinRule.maxLength} digits`;
  const valid = pinLengthError(pin, pinRule) === null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-ghana-black">POS PIN</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {lengthHint}. On a shared POS terminal, staff tap their name and type this PIN to take an order — no need to sign the computer out.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Input
          size="sm"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          label="New PIN"
          value={pin}
          onValueChange={(v) => setPin(v.replace(/\D/g, '').slice(0, pinRule.maxLength))}
          className="w-40"
        />
        <Button size="sm" color="primary" isDisabled={!valid || busy} isLoading={busy} onPress={() => call('PUT')}>
          Save PIN
        </Button>
        <Button size="sm" variant="light" color="danger" isDisabled={busy} onPress={() => call('DELETE')}>
          Remove PIN
        </Button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${message.tone === 'ok' ? 'text-green-700' : 'text-red-600'}`} role="status">{message.text}</p>
      )}
    </div>
  );
}
