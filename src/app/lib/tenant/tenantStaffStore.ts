'use client';

/**
 * A small synchronous cache of the tenant's active staff (id/name/role), the same list FBPOS's
 * waiter picker uses (see /api/tenant). Report generators are synchronous — they read
 * already-loaded data, the same way they read frontOfficeStore/ordersStore — so this exists to give
 * a real name for a waiterId instead of leaving the raw id on screen.
 */

import { create } from 'zustand';
import { getClientTenantSubdomain } from '../api/clientTenant';

export interface TenantStaffMember {
  id: string;
  name: string;
  role: string;
}

interface TenantStaffStore {
  staff: TenantStaffMember[];
  hydrated: boolean;
  hydrateFromApi: () => Promise<void>;
}

export const useTenantStaffStore = create<TenantStaffStore>((set) => ({
  staff: [],
  hydrated: false,
  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/tenant', { headers: { 'x-tenant-subdomain': getClientTenantSubdomain() }, cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      set({ staff: Array.isArray(data.staff) ? data.staff : [], hydrated: true });
    } catch (e) {
      console.warn('[TenantStaff] hydrateFromApi failed:', e);
    }
  },
}));
