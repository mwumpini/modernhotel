import { create } from 'zustand';
import { SecurityShift } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';

function hkHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface ShiftStore {
  shifts: SecurityShift[];

  hydrateFromApi: () => Promise<void>;
  checkIn: (personKey: string, personName: string, notes?: string) => SecurityShift;
  checkOut: (id: string) => void;
}

function syncShiftToApi(shift: SecurityShift, method: 'POST' | 'PATCH') {
  if (typeof window === 'undefined') return;
  fetch('/api/security/shifts', {
    method,
    headers: hkHeaders(),
    body: JSON.stringify(shift),
  }).catch((e) => console.warn('Security: Failed to sync shift:', e));
}

export const useShiftStore = create<ShiftStore>((set) => ({
  shifts: [],

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/security/shifts', { headers: hkHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      set({
        shifts: (data.shifts || []).map((s: any) => ({
          ...s,
          checkInTime: new Date(s.checkInTime),
          checkOutTime: s.checkOutTime ? new Date(s.checkOutTime) : undefined,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })),
      });
    } catch (e) {
      console.warn('Security: shiftStore hydrateFromApi failed:', e);
    }
  },

  checkIn: (personKey, personName, notes) => {
    const now = new Date();
    const newShift: SecurityShift = {
      id: `shift_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      personKey,
      personName,
      checkInTime: now,
      status: 'on_duty',
      notes,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ shifts: [newShift, ...state.shifts] }));
    syncShiftToApi(newShift, 'POST');
    return newShift;
  },

  checkOut: (id) => {
    let updated: SecurityShift | undefined;
    set((state) => ({
      shifts: state.shifts.map((s) => {
        if (s.id !== id) return s;
        updated = { ...s, checkOutTime: new Date(), status: 'completed', updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncShiftToApi(updated, 'PATCH');
  },
}));
