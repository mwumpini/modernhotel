'use client';

import { getClientTenantSubdomain } from '../api/clientTenant';

function headers() {
  const t = getClientTenantSubdomain();
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': t };
}

export async function fetchConferenceHalls() {
  const res = await fetch('/api/events/halls', { headers: headers() });
  if (!res.ok) return [];
  return (await res.json()).halls || [];
}

export async function saveConferenceHall(hall: Record<string, any>) {
  const res = await fetch('/api/events/halls', { method: 'POST', headers: headers(), body: JSON.stringify(hall) });
  if (!res.ok) throw new Error('Failed to save hall');
  return (await res.json()).hall;
}

export async function fetchCateringItems() {
  const res = await fetch('/api/events/catering', { headers: headers() });
  if (!res.ok) return [];
  return (await res.json()).items || [];
}

export async function saveCateringItem(item: Record<string, any>) {
  const res = await fetch('/api/events/catering', { method: 'POST', headers: headers(), body: JSON.stringify(item) });
  if (!res.ok) throw new Error('Failed to save catering item');
  return (await res.json()).item;
}

export async function fetchEventBookings() {
  const res = await fetch('/api/events/bookings', { headers: headers() });
  if (!res.ok) return [];
  return (await res.json()).bookings || [];
}

export async function saveEventBooking(booking: Record<string, any>) {
  const res = await fetch('/api/events/bookings', { method: 'POST', headers: headers(), body: JSON.stringify(booking) });
  if (!res.ok) throw new Error('Failed to save event booking');
  return (await res.json()).booking;
}
