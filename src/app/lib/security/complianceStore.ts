import { create } from 'zustand';
import { ComplianceRequirement } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';

function hkHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface ComplianceStore {
  requirements: ComplianceRequirement[];

  hydrateFromApi: () => Promise<void>;
  addRequirement: (req: Omit<ComplianceRequirement, 'id' | 'createdAt' | 'updatedAt'>) => ComplianceRequirement;
  markCompleted: (id: string, nextDueDate: Date) => void;
}

function syncRequirementToApi(req: ComplianceRequirement) {
  if (typeof window === 'undefined') return;
  fetch('/api/security/compliance', {
    method: 'POST',
    headers: hkHeaders(),
    body: JSON.stringify(req),
  }).catch((e) => console.warn('Security: Failed to sync compliance requirement:', e));
}

export const useComplianceStore = create<ComplianceStore>((set) => ({
  requirements: [],

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/security/compliance', { headers: hkHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      set({
        requirements: (data.requirements || []).map((r: any) => ({
          ...r,
          lastCompletedAt: r.lastCompletedAt ? new Date(r.lastCompletedAt) : undefined,
          nextDueDate: new Date(r.nextDueDate),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        })),
      });
    } catch (e) {
      console.warn('Security: complianceStore hydrateFromApi failed:', e);
    }
  },

  addRequirement: (req) => {
    const now = new Date();
    const newReq: ComplianceRequirement = {
      ...req,
      id: `cmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ requirements: [...state.requirements, newReq].sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime()) }));
    syncRequirementToApi(newReq);
    return newReq;
  },

  markCompleted: (id, nextDueDate) => {
    let updated: ComplianceRequirement | undefined;
    set((state) => ({
      requirements: state.requirements.map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, lastCompletedAt: new Date(), nextDueDate, updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncRequirementToApi(updated);
  },
}));
