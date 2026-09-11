import { create } from 'zustand';
import { Visitor } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';

function hkHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface VisitorStore {
  visitors: Visitor[];

  hydrateFromApi: () => Promise<void>;
  addVisitor: (visitor: Omit<Visitor, 'id' | 'visitorNumber' | 'createdAt' | 'updatedAt' | 'status' | 'checkInTime'>) => Visitor;
  checkOutVisitor: (id: string) => void;

  getVisitorAnalytics: (period: 'daily' | 'weekly' | 'monthly') => {
    totalVisitors: number;
    checkedIn: number;
    escorted: number;
  };
}

function periodStart(period: 'daily' | 'weekly' | 'monthly'): Date {
  const now = new Date();
  if (period === 'daily') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (period === 'weekly') { const d = new Date(now); d.setDate(now.getDate() - 7); return d; }
  const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

function syncVisitorToApi(visitor: Visitor) {
  if (typeof window === 'undefined') return;
  fetch('/api/security/visitors', {
    method: 'POST',
    headers: hkHeaders(),
    body: JSON.stringify(visitor),
  }).catch((e) => console.warn('Security: Failed to sync visitor:', e));
}

export const useVisitorStore = create<VisitorStore>((set, get) => ({
  visitors: [],

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/security/visitors', { headers: hkHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      set({
        visitors: (data.visitors || []).map((v: any) => ({
          ...v,
          checkInTime: new Date(v.checkInTime),
          checkOutTime: v.checkOutTime ? new Date(v.checkOutTime) : undefined,
          createdAt: new Date(v.createdAt),
          updatedAt: new Date(v.updatedAt),
        })),
      });
    } catch (e) {
      console.warn('Security: visitorStore hydrateFromApi failed:', e);
    }
  },

  addVisitor: (visitor) => {
    const now = new Date();
    const newVisitor: Visitor = {
      ...visitor,
      id: `vis_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      visitorNumber: `VIS-${now.getFullYear()}-${Date.now().toString().slice(-6)}`,
      checkInTime: now,
      status: 'checked_in',
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ visitors: [newVisitor, ...state.visitors] }));
    syncVisitorToApi(newVisitor);
    return newVisitor;
  },

  checkOutVisitor: (id) => {
    let updated: Visitor | undefined;
    set((state) => ({
      visitors: state.visitors.map((v) => {
        if (v.id !== id) return v;
        updated = { ...v, status: 'checked_out', checkOutTime: new Date(), updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncVisitorToApi(updated);
  },

  getVisitorAnalytics: (period) => {
    const start = periodStart(period);
    const filtered = get().visitors.filter((v) => v.checkInTime >= start);
    return {
      totalVisitors: filtered.length,
      checkedIn: filtered.filter((v) => v.status === 'checked_in').length,
      escorted: filtered.filter((v) => v.escortRequired).length,
    };
  },
}));
