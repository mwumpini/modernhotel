import { getClientTenantSubdomain } from '../../lib/api/clientTenant';

export function inventoryHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}
