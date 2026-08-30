'use client';

import { normalizeTenantSubdomain } from './tenantSubdomain';

const STORAGE_KEY = 'tenant.subdomain';

/** Persist tenant subdomain after login (used by all API clients). */
export function setClientTenantSubdomain(subdomain: string) {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeTenantSubdomain(subdomain));
  } catch {
    /* ignore */
  }
}

function tenantFromSettings(): string | null {
  try {
    const raw = localStorage.getItem('system.settings');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { tenant?: { subdomain?: string } };
    return parsed?.tenant?.subdomain ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the current tenant subdomain on the client.
 * Priority: env → localStorage → setup settings → hostname → demo.
 */
export function getClientTenantSubdomain(): string {
  if (typeof window === 'undefined') return 'demo';

  const envTenant = process.env.NEXT_PUBLIC_TENANT_SUBDOMAIN;
  if (envTenant) return normalizeTenantSubdomain(envTenant);

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeTenantSubdomain(stored);
  } catch {
    /* ignore */
  }

  const fromSettings = tenantFromSettings();
  if (fromSettings) return normalizeTenantSubdomain(fromSettings);

  const host = window.location.hostname.toLowerCase();

  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    return 'demo';
  }
  if (host.endsWith('.localhost')) {
    const sub = host.replace('.localhost', '');
    if (sub && sub !== 'www') return normalizeTenantSubdomain(sub);
    return 'demo';
  }

  const parts = host.split('.');
  if (parts.length > 2 && parts[0] !== 'www') {
    return normalizeTenantSubdomain(parts[0]);
  }

  return 'demo';
}
