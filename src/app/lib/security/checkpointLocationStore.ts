import { create } from 'zustand';
import { CheckpointLocation } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';

function hkHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface CheckpointLocationStore {
  locations: CheckpointLocation[];

  hydrateFromApi: () => Promise<void>;
  addLocation: (name: string) => CheckpointLocation;
  setLocationActive: (id: string, isActive: boolean) => void;
}

function syncLocationToApi(location: CheckpointLocation, method: 'POST' | 'PATCH') {
  if (typeof window === 'undefined') return;
  fetch('/api/security/checkpoint-locations', {
    method,
    headers: hkHeaders(),
    body: JSON.stringify(location),
  }).catch((e) => console.warn('Security: Failed to sync checkpoint location:', e));
}

export const useCheckpointLocationStore = create<CheckpointLocationStore>((set) => ({
  locations: [],

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/security/checkpoint-locations', { headers: hkHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      set({
        locations: (data.locations || []).map((l: any) => ({
          ...l,
          createdAt: new Date(l.createdAt),
          updatedAt: new Date(l.updatedAt),
        })),
      });
    } catch (e) {
      console.warn('Security: checkpointLocationStore hydrateFromApi failed:', e);
    }
  },

  addLocation: (name) => {
    const now = new Date();
    const newLocation: CheckpointLocation = {
      id: `cpl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ locations: [...state.locations, newLocation].sort((a, b) => a.name.localeCompare(b.name)) }));
    syncLocationToApi(newLocation, 'POST');
    return newLocation;
  },

  setLocationActive: (id, isActive) => {
    let updated: CheckpointLocation | undefined;
    set((state) => ({
      locations: state.locations.map((l) => {
        if (l.id !== id) return l;
        updated = { ...l, isActive, updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncLocationToApi(updated, 'PATCH');
  },
}));
