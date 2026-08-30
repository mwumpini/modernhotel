/** Shared tenant subdomain normalization (safe for client + server). */
export function normalizeTenantSubdomain(subdomain: string): string {
  const s = subdomain.trim().toLowerCase();
  if (
    !s ||
    s === '127' ||
    s === 'localhost' ||
    s === 'default' ||
    s === '127.0.0.1' ||
    s === 'demo-tenant-001'
  ) {
    return 'demo';
  }
  return s;
}
