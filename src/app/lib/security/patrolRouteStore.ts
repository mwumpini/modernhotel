import { create } from 'zustand';
import { PatrolRoute } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';

function hkHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface PatrolRouteStore {
  routes: PatrolRoute[];

  hydrateFromApi: () => Promise<void>;
  addRoute: (name: string) => PatrolRoute;
  setRouteActive: (id: string, isActive: boolean) => void;
}

function syncRouteToApi(route: PatrolRoute, method: 'POST' | 'PATCH') {
  if (typeof window === 'undefined') return;
  fetch('/api/security/patrol-routes', {
    method,
    headers: hkHeaders(),
    body: JSON.stringify(route),
  }).catch((e) => console.warn('Security: Failed to sync patrol route:', e));
}

export const usePatrolRouteStore = create<PatrolRouteStore>((set) => ({
  routes: [],

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/security/patrol-routes', { headers: hkHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      set({
        routes: (data.routes || []).map((r: any) => ({
          ...r,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        })),
      });
    } catch (e) {
      console.warn('Security: patrolRouteStore hydrateFromApi failed:', e);
    }
  },

  addRoute: (name) => {
    const now = new Date();
    const newRoute: PatrolRoute = {
      id: `pr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ routes: [...state.routes, newRoute].sort((a, b) => a.name.localeCompare(b.name)) }));
    syncRouteToApi(newRoute, 'POST');
    return newRoute;
  },

  setRouteActive: (id, isActive) => {
    let updated: PatrolRoute | undefined;
    set((state) => ({
      routes: state.routes.map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, isActive, updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncRouteToApi(updated, 'PATCH');
  },
}));
