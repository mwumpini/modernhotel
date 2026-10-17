import { create } from 'zustand';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';
import { normalizePaySetup, type PayrollPaySetup } from './salaryBanks';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

interface PaySetupState {
  setup: PayrollPaySetup | null;
  /** True once this hotel has saved its own bank list and signer. */
  saved: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  save: (setup: PayrollPaySetup) => Promise<PayrollPaySetup>;
}

export const usePaySetupStore = create<PaySetupState>((set, get) => ({
  setup: null,
  saved: false,
  loaded: false,
  load: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/hr/pay-setup', { headers: hrTenantHeaders(), cache: 'no-store' });
      if (!res.ok) {
        set({ loaded: true });
        return;
      }
      const data = await res.json();
      if (!data?.setup) {
        set({ setup: null, saved: false, loaded: true });
        return;
      }
      set({ setup: normalizePaySetup(data.setup), saved: true, loaded: true });
    } catch (error) {
      console.warn('[HR] Failed to load pay setup:', error);
      set({ loaded: true });
    }
  },
  save: async (setup) => {
    const normalized = normalizePaySetup(setup);
    const previous = { setup: get().setup, saved: get().saved };
    set({ setup: normalized, saved: true, loaded: true });
    try {
      const res = await fetch('/api/hr/pay-setup', {
        method: 'POST',
        headers: hrTenantHeaders(),
        body: JSON.stringify({ setup: normalized }),
      });
      if (!res.ok) throw new Error('save failed');
      const data = await res.json();
      const saved = normalizePaySetup(data?.setup ?? normalized);
      set({ setup: saved, saved: true, loaded: true });
      return saved;
    } catch (error) {
      set(previous);
      throw error;
    }
  },
}));
