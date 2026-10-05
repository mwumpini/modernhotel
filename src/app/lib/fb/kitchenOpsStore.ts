'use client';

import { getClientTenantSubdomain } from '../api/clientTenant';
import { loadRecords, saveRecord } from '../api/tenantRecords';

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
  /** Display name of the waiter / server (not a staff cuid). */
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
  /** Elapsed cook time in minutes (preparing → ready/served). */
  prepMinutes?: number;
  /** When the order was first placed / sent to kitchen. */
  orderedAt?: string;
  /** When kitchen started cooking (status → preparing). */
  cookingStartedAt?: string;
  notes?: string;
}

class KitchenOpsStore {
  private records: KitchenOpRecord[] = [];
  private listeners: Array<() => void> = [];
  private hydrated = false;

  // The log is kept on the server (TenantRecord 'kitchen.op') so every screen sees it.
  private hydrate() {
    if (this.hydrated || typeof window === 'undefined') return;
    this.hydrated = true;
    try { localStorage.removeItem(storageKey()); } catch { /* old browser-only copy */ }
    void loadRecords<KitchenOpRecord>('kitchen.op').then((server) => {
      if (!server) return;
      const byId = new Map(server.map((r) => [r.id, r]));
      for (const r of this.records) byId.set(r.id, r);
      this.records = Array.from(byId.values()).sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_RECORDS);
      this.listeners.forEach((l) => l());
    });
  }

  add(partial: Omit<KitchenOpRecord, 'id' | 'at'> & Partial<Pick<KitchenOpRecord, 'at'>>) {
    this.hydrate();
    const at = partial.at || new Date().toISOString();
    const id = `KLOG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
    const rec: KitchenOpRecord = { id, at, ...partial } as KitchenOpRecord;
    this.records.unshift(rec);
    if (this.records.length > MAX_RECORDS) this.records.length = MAX_RECORDS;
    void saveRecord('kitchen.op', rec.id, rec);
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
