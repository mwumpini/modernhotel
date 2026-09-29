'use client';

/**
 * A small synchronous cache of the Guest Services catalog and its request queue, so the reporting
 * store (which is entirely synchronous — every generateXReport() reads already-loaded data, the same
 * way it reads frontOfficeStore/housekeepingStore) has something to read for the Guest Service
 * Requests report. FrontofficeClientsServices.tsx keeps its own copy for the live screen; this is a
 * shared one for anything (reports, the executive dashboard) that just needs to read the data.
 */

import { create } from 'zustand';
import { getClientTenantSubdomain } from '../api/clientTenant';

export interface GuestServiceCatalogItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  status: 'available' | 'unavailable' | 'maintenance';
  provider: string;
}

export interface GuestServiceRequestRecord {
  id: string;
  serviceId: string;
  guestId?: string;
  reservationId?: string;
  clientName: string;
  roomNumber: string;
  requestDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  notes: string;
}

interface GuestServicesStore {
  services: GuestServiceCatalogItem[];
  requests: GuestServiceRequestRecord[];
  hydrated: boolean;
  hydrateFromApi: () => Promise<void>;
}

function headers(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

export const useGuestServicesStore = create<GuestServicesStore>((set) => ({
  services: [],
  requests: [],
  hydrated: false,
  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const [servicesRes, requestsRes] = await Promise.all([
        fetch('/api/guest-services/services', { headers: headers(), cache: 'no-store' }),
        fetch('/api/guest-services/requests', { headers: headers(), cache: 'no-store' }),
      ]);
      const services = servicesRes.ok ? (await servicesRes.json()).services || [] : [];
      const requests = requestsRes.ok ? (await requestsRes.json()).requests || [] : [];
      set({ services, requests, hydrated: true });
    } catch (e) {
      console.warn('[GuestServices] hydrateFromApi failed:', e);
    }
  },
}));
