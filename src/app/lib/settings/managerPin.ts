'use client';

import { getClientTenantSubdomain } from '../api/clientTenant';

/** The POS manager PIN lives on the server, hashed; the browser only asks it. */
const headers = () => ({ 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() || '' });

export async function verifyManagerPin(entered: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/settings/manager-pin', { method: 'POST', headers: headers(), body: JSON.stringify({ pin: entered }) });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok && body.ok === true, error: body.error };
  } catch {
    return { ok: false, error: 'Could not reach the server to check the PIN.' };
  }
}

export async function saveManagerPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/settings/manager-pin', { method: 'PUT', headers: headers(), body: JSON.stringify({ pin }) });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, error: body.error };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

export async function managerPinIsSet(): Promise<boolean | null> {
  try {
    const res = await fetch('/api/settings/manager-pin', { headers: headers(), cache: 'no-store' });
    if (!res.ok) return null;
    return Boolean((await res.json()).isSet);
  } catch {
    return null;
  }
}
