import { create } from 'zustand';
import { SecurityPersonnel } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';

function hkHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface PersonnelStore {
  personnel: SecurityPersonnel[];

  hydrateFromApi: () => Promise<void>;
  addPersonnel: (person: Omit<SecurityPersonnel, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>) => SecurityPersonnel;
  updatePersonnel: (id: string, updates: Partial<Omit<SecurityPersonnel, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  setPersonnelActive: (id: string, isActive: boolean) => void;
}

function syncPersonnelToApi(person: SecurityPersonnel, method: 'POST' | 'PATCH') {
  if (typeof window === 'undefined') return;
  fetch('/api/security/personnel', {
    method,
    headers: hkHeaders(),
    body: JSON.stringify(person),
  }).catch((e) => console.warn('Security: Failed to sync personnel:', e));
}

export const usePersonnelStore = create<PersonnelStore>((set) => ({
  personnel: [],

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/security/personnel', { headers: hkHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      set({
        personnel: (data.personnel || []).map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        })),
      });
    } catch (e) {
      console.warn('Security: personnelStore hydrateFromApi failed:', e);
    }
  },

  addPersonnel: (person) => {
    const now = new Date();
    const newPerson: SecurityPersonnel = {
      ...person,
      id: `sp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ personnel: [...state.personnel, newPerson].sort((a, b) => a.name.localeCompare(b.name)) }));
    syncPersonnelToApi(newPerson, 'POST');
    return newPerson;
  },

  updatePersonnel: (id, updates) => {
    let updated: SecurityPersonnel | undefined;
    set((state) => ({
      personnel: state.personnel.map((p) => {
        if (p.id !== id) return p;
        updated = { ...p, ...updates, updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncPersonnelToApi(updated, 'PATCH');
  },

  setPersonnelActive: (id, isActive) => {
    let updated: SecurityPersonnel | undefined;
    set((state) => ({
      personnel: state.personnel.map((p) => {
        if (p.id !== id) return p;
        updated = { ...p, isActive, updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncPersonnelToApi(updated, 'PATCH');
  },
}));
