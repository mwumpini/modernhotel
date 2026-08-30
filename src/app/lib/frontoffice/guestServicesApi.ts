'use client';

import { getClientTenantSubdomain } from '../api/clientTenant';

function headers() {
  const t = getClientTenantSubdomain();
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': t };
}

export async function fetchGuestServices() {
  const res = await fetch('/api/guest-services/services', { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.services || [];
}

export async function saveGuestService(service: Record<string, any>) {
  const res = await fetch('/api/guest-services/services', { method: 'POST', headers: headers(), body: JSON.stringify(service) });
  if (!res.ok) throw new Error('Failed to save service');
  return (await res.json()).service;
}

export async function fetchServiceRequests() {
  const res = await fetch('/api/guest-services/requests', { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.requests || [];
}

export async function saveServiceRequest(request: Record<string, any>) {
  const res = await fetch('/api/guest-services/requests', { method: 'POST', headers: headers(), body: JSON.stringify(request) });
  if (!res.ok) throw new Error('Failed to save request');
  return (await res.json()).request;
}
