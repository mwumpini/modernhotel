'use client';

import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';

/** Standard tenant headers for all F&B API calls (POS, KDS, menu). */
export function fbTenantHeaders(extra?: Record<string, string>): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return {
    'x-tenant-subdomain': sub,
    'x-tenant-id': sub,
    ...extra,
  };
}

/** Map POS venue label to DB venue code. */
export function normalizePosVenue(venue: string): string {
  const v = venue.trim().toLowerCase().replace(/\s+/g, '_');
  if (v === 'restaurant') return 'restaurant';
  if (v === 'bar') return 'bar';
  if (v === 'room_service' || v === 'roomservice') return 'room_service';
  return v;
}

/** Open full-screen kitchen display (hard navigation — reliable vs client router.push). */
export function openKitchenDisplay() {
  if (typeof window !== 'undefined') {
    window.location.assign('/kitchen-display');
  }
}

/** Return to F&B dashboard on the Kitchen Operations overview tab. */
export function openKitchenOverview() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nav.section', 'food-beverage');
      localStorage.setItem('fb.tab', 'kitchen');
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  }
}

export type FbOrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled'
  | 'billed';

export interface FbOrderItemDto {
  id: string;
  name: string;
  category?: string | null;
  quantity: number;
  notes?: string | null;
  route?: string | null;
  menuItemId?: string | null;
}

export interface FbOrderDto {
  id: string;
  orderNumber: string;
  venue: string;
  tableNumber?: string | null;
  roomNumber?: string | null;
  guestId?: string | null;
  guestName?: string | null;
  covers?: number;
  status: FbOrderStatus | string;
  notes?: string | null;
  serverName?: string | null;
  createdAt: string;
  servedAt?: string | null;
  urgent?: boolean;
  priority?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  preparingAt?: string | null;
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  items: FbOrderItemDto[];
}

export async function fetchFbOrders(params?: {
  status?: string;
  venue?: string;
}): Promise<FbOrderDto[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.venue) qs.set('venue', params.venue);

  const res = await fetch(`/api/fb/orders?${qs}`, {
    headers: fbTenantHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Orders API HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.orders || [];
}

export async function fetchFbOrderById(orderId: string): Promise<FbOrderDto> {
  const res = await fetch(`/api/fb/orders/${orderId}`, {
    headers: fbTenantHeaders(),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Fetch order HTTP ${res.status}`);
  }
  return (data as { order: FbOrderDto }).order;
}

export async function createFbOrder(body: Record<string, unknown>): Promise<{ order: FbOrderDto }> {
  const res = await fetch('/api/fb/orders', {
    method: 'POST',
    headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; hint?: string; subdomain?: string };
    throw new Error(
      [err.error, err.hint].filter(Boolean).join(' — ') ||
        `Create order HTTP ${res.status}`
    );
  }
  return data as { order: FbOrderDto };
}

export async function patchFbOrder(
  orderId: string,
  body: Record<string, unknown>
): Promise<FbOrderDto> {
  const res = await fetch(`/api/fb/orders/${orderId}`, {
    method: 'PATCH',
    headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Update order HTTP ${res.status}`);
  }
  return (data as { order: FbOrderDto }).order;
}

export async function fetchKitchenStaff(): Promise<{ id: string; name: string }[]> {
  const res = await fetch('/api/tenant', { headers: fbTenantHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.staff || []).map((s: { id: string; name: string }) => ({
    id: s.id,
    name: s.name,
  }));
}

export async function patchFbOrderStatus(
  orderId: string,
  status: string,
  extra?: Record<string, unknown>
): Promise<FbOrderDto> {
  return patchFbOrder(orderId, { status, ...extra });
}
