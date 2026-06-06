'use client';

/**
 * Resolves the current tenant subdomain on the client.
 *
 * This is intentionally the single choke point for tenant resolution so the
 * strategy can change (env var -> hostname subdomain -> auth session) without
 * touching any call sites. Defaults to the seeded `demo` tenant.
 */
export function getClientTenantSubdomain(): string | null {
  if (typeof window === 'undefined') return null;

  const envTenant = process.env.NEXT_PUBLIC_TENANT_SUBDOMAIN;
  if (envTenant) return envTenant;

  const host = window.location.hostname;
  const parts = host.split('.');
  // e.g. acme.example.com -> "acme" (ignore www and bare/localhost hosts)
  if (parts.length > 2 && parts[0] !== 'www') return parts[0];

  return 'demo';
}
