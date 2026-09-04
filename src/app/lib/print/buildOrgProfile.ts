import type { SystemSettings } from '../settings/store';
import type { PrintOrgInfo } from './templates';

/**
 * Single source of truth for the "org" block on every printed document — reads the
 * live company profile (Setup wizard / Settings) instead of the stale one-time
 * `countryCompliance[...].businessInfo` snapshot copied during initial setup, which
 * never picks up later edits (including the logo, which that snapshot never carried
 * at all).
 */
export function buildOrgProfile(settings: SystemSettings): PrintOrgInfo {
  const c = settings.companySettings;
  return {
    name: c?.tradingName || c?.legalName || settings.systemName || 'Hotel',
    address: c ? [c.address?.line1, c.address?.city, c.address?.country].filter(Boolean).join(', ') : undefined,
    phone: c?.contact?.phone,
    email: c?.contact?.email,
    taxId: c?.taxId,
    logoUrl: c?.logoUrl,
  };
}
