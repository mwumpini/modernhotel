'use client';

import { getClientTenantSubdomain } from './clientTenant';
import type { RecordKind } from './recordKinds';

/** Browser side of /api/records/[kind]: per-hotel records kept on the server. */

const headers = () => ({ 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() || '' });

/** Every record of a kind, or null when the server could not be reached (keep what you have). */
export async function loadRecords<T>(kind: RecordKind): Promise<T[] | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(`/api/records/${kind}`, { headers: headers(), cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body.records) ? body.records.map((r: { data: T }) => r.data) : null;
  } catch {
    return null;
  }
}

export function saveRecord(kind: RecordKind, id: string, data: unknown): Promise<boolean> {
  return fetch(`/api/records/${kind}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ id, data }) })
    .then((res) => res.ok)
    .catch(() => false);
}

export function deleteRecord(kind: RecordKind, id: string): Promise<boolean> {
  return fetch(`/api/records/${kind}?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() })
    .then((res) => res.ok)
    .catch(() => false);
}

/**
 * Keeps a list on the server by sending only what changed: call prime() with what was loaded,
 * then push() with the current list after every change.
 */
export function createRecordSync<T extends { id: string }>(kind: RecordKind) {
  const sent = new Map<string, string>();
  return {
    prime(items: T[]) {
      sent.clear();
      for (const item of items) sent.set(item.id, JSON.stringify(item));
    },
    push(items: T[]) {
      const seen = new Set<string>();
      for (const item of items) {
        seen.add(item.id);
        const json = JSON.stringify(item);
        if (sent.get(item.id) === json) continue;
        sent.set(item.id, json);
        void saveRecord(kind, item.id, item).then((ok) => { if (!ok) sent.delete(item.id); });
      }
      for (const id of Array.from(sent.keys())) {
        if (seen.has(id)) continue;
        sent.delete(id);
        void deleteRecord(kind, id);
      }
    },
  };
}
