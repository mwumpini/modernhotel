'use client';

import { getClientTenantSubdomain } from '../api/clientTenant';

const STORAGE_KEY_PREFIX = 'kitchen.ops.log';
const MAX_RECORDS = 200;

// Tenant is resolved client-side on a shared origin (see clientTenant.ts), so the
// storage key must be namespaced per tenant — a flat key would leak one tenant's
// order/staff data into another tenant's view on a shared browser/terminal.
function storageKey(): string {
  return `${STORAGE_KEY_PREFIX}.${getClientTenantSubdomain()}`;
}

export type KitchenAction = 'assigned' | 'status' | 'prepared';

export interface KitchenOpRecord {
  id: string;
  at: string;
  orderId: string;
  table: string;
  waiterId?: string;
  itemId: string;
  itemName: string;
  action: KitchenAction;
  fromStatus?: 'pending' | 'preparing' | 'ready' | 'served';
  toStatus?: 'pending' | 'preparing' | 'ready' | 'served';
  assignedToId?: string;
  assignedToName?: string;
  preparedById?: string;
  preparedByName?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | 'normal';
  prepMinutes?: number;
  notes?: string;
}

class KitchenOpsStore {
  private records: KitchenOpRecord[] = [];
  private listeners: Array<() => void> = [];
  private hydrated = false;

  private hydrate() {
    if (this.hydrated || typeof window === 'undefined') return;
    this.hydrated = true;
    try {
      const raw = localStorage.getItem(storageKey());
      if (raw) this.records = JSON.parse(raw);
    } catch {
      this.records = [];
    }
  }

  private persist() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(this.records.slice(0, MAX_RECORDS)));
    } catch {
      /* ignore */
    }
  }

  add(partial: Omit<KitchenOpRecord, 'id' | 'at'> & Partial<Pick<KitchenOpRecord, 'at'>>) {
    this.hydrate();
    const at = partial.at || new Date().toISOString();
    const id = `KLOG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
    const rec: KitchenOpRecord = { id, at, ...partial } as KitchenOpRecord;
    this.records.unshift(rec);
    if (this.records.length > MAX_RECORDS) this.records.length = MAX_RECORDS;
    this.persist();
    this.listeners.forEach(l => l());
  }

  all() {
    this.hydrate();
    return [...this.records];
  }

  subscribe(listener: () => void) {
    this.hydrate();
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const kitchenOpsStore = new KitchenOpsStore();
