'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BankReconciliation, ReconcilingItem, ReconStatus } from './bankRecon/types';
import {
  computeReconciliation,
  depositsInTransitCarryForward,
  outstandingChequesCarryForward,
  findPriorReconciliation,
  bookSideItemsNeedingJournal,
} from './bankRecon/calculations';
import { validateReconciliation, validateItem } from './bankRecon/validation';
import {
  getGlCashbookBalance,
  postBookSideItemsToLedger,
} from './bankRecon/ledgerSync';
import { useAccountingStore } from './store';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';

const STORAGE_KEY = 'bank.recon.v1';

function reconTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

// Best-effort background persistence — localStorage stays the fast local cache the
// UI reads/writes synchronously (kept via zustand's `persist` below), but every
// mutation now also durably syncs tenant-scoped to the database instead of only
// living in one browser's storage with no server-side record at all.
function syncReconciliationToApi(recon: BankReconciliation) {
  if (typeof window === 'undefined') return;
  fetch('/api/accounting/bank-reconciliation', {
    method: 'POST',
    headers: reconTenantHeaders(),
    body: JSON.stringify(recon),
  }).catch((e) => console.warn('[BankRecon] Failed to sync reconciliation to server:', e));
}

function syncItemToApi(item: ReconcilingItem) {
  if (typeof window === 'undefined') return;
  fetch('/api/accounting/bank-reconciliation/items', {
    method: 'POST',
    headers: reconTenantHeaders(),
    body: JSON.stringify(item),
  }).catch((e) => console.warn('[BankRecon] Failed to sync reconciling item to server:', e));
}

function deleteItemFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/accounting/bank-reconciliation/items?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: reconTenantHeaders(),
  }).catch((e) => console.warn('[BankRecon] Failed to delete reconciling item on server:', e));
}

interface BankReconState {
  reconciliations: BankReconciliation[];
  items: ReconcilingItem[];
  error: string | null;

  getReconciliation: (bankAccountId: string, periodEndDate: string) => BankReconciliation | undefined;
  getItems: (reconciliationId: string) => ReconcilingItem[];
  hydrateFromApi: () => Promise<void>;
  openReconciliation: (bankAccountId: string, periodEndDate: string) => BankReconciliation;
  updateReconciliation: (
    id: string,
    updates: Partial<Pick<BankReconciliation, 'statementBalance' | 'cashbookBalance' | 'periodEndDate'>>
  ) => boolean;
  syncCashbookFromLedger: (reconciliationId: string) => number | null;
  addItem: (input: Omit<ReconcilingItem, 'id' | 'createdAt'>) => ReconcilingItem | null;
  updateItem: (id: string, updates: Partial<ReconcilingItem>) => boolean;
  deleteItem: (id: string) => boolean;
  markChequeCleared: (id: string, clearedDate: string) => boolean;
  postBookSideToLedger: (reconciliationId: string) => import('./bankRecon/ledgerSync').PostBookSideResult;
  completeReconciliation: (reconciliationId: string) => number | false;
  approveReconciliation: (reconciliationId: string) => boolean;
  computeFor: (reconciliationId: string) => ReturnType<typeof computeReconciliation> | null;
  clearError: () => void;
}

function isEditable(recon: BankReconciliation): boolean {
  return recon.status === 'Draft';
}

export const useBankReconStore = create<BankReconState>()(
  persist(
    (set, get) => ({
      reconciliations: [],
      items: [],
      error: null,

      getReconciliation: (bankAccountId, periodEndDate) =>
        get().reconciliations.find(
          (r) => r.bankAccountId === bankAccountId && r.periodEndDate === periodEndDate
        ),

      getItems: (reconciliationId) =>
        get().items.filter((i) => i.reconciliationId === reconciliationId),

      // Pull the tenant's real persisted reconciliations from the database, replacing
      // whatever this browser's localStorage cache had (which — before backend sync
      // existed — could hold a different tenant's data on a shared terminal). Safe to
      // call repeatedly; the server is always treated as source of truth.
      hydrateFromApi: async () => {
        if (typeof window === 'undefined') return;
        try {
          const res = await fetch('/api/accounting/bank-reconciliation', {
            headers: reconTenantHeaders(),
            cache: 'no-store',
          });
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data.reconciliations)) {
            set({ reconciliations: data.reconciliations, items: data.items || [] });
          }
        } catch (e) {
          console.warn('[BankRecon] Failed to hydrate from server:', e);
        }
      },

      openReconciliation: (bankAccountId, periodEndDate) => {
        const existing = get().getReconciliation(bankAccountId, periodEndDate);
        if (existing) return existing;

        const accounting = useAccountingStore.getState();
        const bank = accounting.bankAccounts.find((b) => b.id === bankAccountId);
        const glCode = bank?.glAccountCode || '1120';
        const cashbookBalance = getGlCashbookBalance(
          accounting.journalEntries,
          accounting.chartOfAccounts,
          glCode,
          periodEndDate
        );

        const priorRecon = findPriorReconciliation(get().reconciliations, bankAccountId, periodEndDate);
        const carryItems: ReconcilingItem[] = [];
        const now = new Date().toISOString();
        const reconId = `brecon-${Date.now()}`;

        if (priorRecon) {
          const priorItems = get().getItems(priorRecon.id);
          const carried = [
            ...outstandingChequesCarryForward(priorItems),
            ...depositsInTransitCarryForward(priorItems),
          ];
          for (const c of carried) {
            carryItems.push({
              ...c,
              id: `bri-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              reconciliationId: reconId,
              isCleared: false,
              clearedDate: undefined,
              journalEntryId: undefined,
              createdAt: now,
            });
          }
        }

        const recon: BankReconciliation = {
          id: reconId,
          bankAccountId,
          periodEndDate,
          statementBalance: 0,
          cashbookBalance,
          status: 'Draft',
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          reconciliations: [...state.reconciliations, recon],
          items: [...state.items, ...carryItems],
          error: null,
        }));

        syncReconciliationToApi(recon);
        carryItems.forEach(syncItemToApi);

        return recon;
      },

      updateReconciliation: (id, updates) => {
        const recon = get().reconciliations.find((r) => r.id === id);
        if (!recon) {
          set({ error: 'Reconciliation not found' });
          return false;
        }
        if (!isEditable(recon)) {
          set({ error: 'Only draft reconciliations can be edited' });
          return false;
        }
        let updated: BankReconciliation | undefined;
        set((state) => ({
          reconciliations: state.reconciliations.map((r) => {
            if (r.id !== id) return r;
            updated = { ...r, ...updates, updatedAt: new Date().toISOString() };
            return updated;
          }),
          error: null,
        }));
        if (updated) syncReconciliationToApi(updated);
        return true;
      },

      syncCashbookFromLedger: (reconciliationId) => {
        const recon = get().reconciliations.find((r) => r.id === reconciliationId);
        if (!recon || !isEditable(recon)) return null;

        const accounting = useAccountingStore.getState();
        const bank = accounting.bankAccounts.find((b) => b.id === recon.bankAccountId);
        const glCode = bank?.glAccountCode || '1120';
        const balance = getGlCashbookBalance(
          accounting.journalEntries,
          accounting.chartOfAccounts,
          glCode,
          recon.periodEndDate
        );

        get().updateReconciliation(reconciliationId, { cashbookBalance: balance });
        return balance;
      },

      addItem: (input) => {
        const recon = get().reconciliations.find((r) => r.id === input.reconciliationId);
        if (!recon) {
          set({ error: 'Reconciliation not found' });
          return null;
        }
        if (!isEditable(recon)) {
          set({ error: 'Only draft reconciliations can be edited' });
          return null;
        }
        const errors = validateItem(input);
        if (errors.length) {
          set({ error: errors.join('; ') });
          return null;
        }
        const item: ReconcilingItem = {
          ...input,
          id: `bri-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ items: [...state.items, item], error: null }));
        syncItemToApi(item);
        return item;
      },

      updateItem: (id, updates) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) {
          set({ error: 'Item not found' });
          return false;
        }
        const recon = get().reconciliations.find((r) => r.id === item.reconciliationId);
        if (recon && !isEditable(recon)) {
          set({ error: 'Only draft reconciliations can be edited' });
          return false;
        }
        const merged = { ...item, ...updates };
        const errors = validateItem(merged);
        if (errors.length) {
          set({ error: errors.join('; ') });
          return false;
        }
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? merged : i)),
          error: null,
        }));
        syncItemToApi(merged);
        return true;
      },

      deleteItem: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return false;
        const recon = get().reconciliations.find((r) => r.id === item.reconciliationId);
        if (recon && !isEditable(recon)) {
          set({ error: 'Only draft reconciliations can be edited' });
          return false;
        }
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
          error: null,
        }));
        deleteItemFromApi(id);
        return true;
      },

      markChequeCleared: (id, clearedDate) =>
        get().updateItem(id, { isCleared: true, clearedDate }),

      postBookSideToLedger: (reconciliationId) => {
        const recon = get().reconciliations.find((r) => r.id === reconciliationId);
        if (!recon || !isEditable(recon)) {
          return { ok: false, posted: 0, errors: ['Reconciliation not found or not editable'], mappings: [] };
        }
        const accounting = useAccountingStore.getState();
        const bank = accounting.bankAccounts.find((b) => b.id === recon.bankAccountId);
        const glCode = bank?.glAccountCode || '1120';
        const items = get().getItems(reconciliationId);
        const result = postBookSideItemsToLedger(items, glCode, recon.periodEndDate, reconciliationId, recon.bankAccountId);

        if (result.mappings.length) {
          const map = new Map(result.mappings.map((m) => [m.itemId, m.journalEntryId]));
          let touched: ReconcilingItem[] = [];
          set((state) => ({
            items: state.items.map((i) => {
              if (!map.has(i.id)) return i;
              const next = { ...i, journalEntryId: map.get(i.id) };
              touched.push(next);
              return next;
            }),
          }));
          touched.forEach(syncItemToApi);
          get().syncCashbookFromLedger(reconciliationId);
        }

        return result;
      },

      completeReconciliation: (reconciliationId) => {
        const recon = get().reconciliations.find((r) => r.id === reconciliationId);
        if (!recon || !isEditable(recon)) {
          set({ error: 'Cannot complete — not found or not in draft' });
          return false;
        }
        get().syncCashbookFromLedger(reconciliationId);
        const freshRecon = get().reconciliations.find((r) => r.id === reconciliationId)!;
        const items = get().getItems(reconciliationId);
        const pendingPosts = bookSideItemsNeedingJournal(items);
        if (pendingPosts.length) {
          set({
            error: `${pendingPosts.length} book-side item(s) still need posting to GL before completing`,
          });
          return false;
        }
        const computed = computeReconciliation(freshRecon, items);
        const errors = validateReconciliation(freshRecon, items);
        if (errors.length) {
          set({ error: errors.join('; ') });
          return false;
        }
        if (!computed.isBalanced) {
          set({ error: `Cannot complete — difference of ₵${Math.abs(computed.difference).toFixed(2)} remains` });
          return false;
        }
        const now = new Date().toISOString();
        let completed: BankReconciliation | undefined;
        set((state) => ({
          reconciliations: state.reconciliations.map((r) => {
            if (r.id !== reconciliationId) return r;
            completed = {
              ...r,
              status: 'Completed' as ReconStatus,
              preparedAt: now,
              updatedAt: now,
              cashbookBalance: freshRecon.cashbookBalance,
            };
            return completed;
          }),
          error: null,
        }));
        if (completed) syncReconciliationToApi(completed);
        return useAccountingStore
          .getState()
          .markBankTransactionsReconciledForPeriod(recon.bankAccountId, recon.periodEndDate);
      },

      approveReconciliation: (reconciliationId) => {
        const recon = get().reconciliations.find((r) => r.id === reconciliationId);
        if (!recon || recon.status !== 'Completed') {
          set({ error: 'Only completed reconciliations can be approved' });
          return false;
        }
        const now = new Date().toISOString();
        let approved: BankReconciliation | undefined;
        set((state) => ({
          reconciliations: state.reconciliations.map((r) => {
            if (r.id !== reconciliationId) return r;
            approved = { ...r, status: 'Approved' as ReconStatus, approvedAt: now, updatedAt: now };
            return approved;
          }),
          error: null,
        }));
        if (approved) syncReconciliationToApi(approved);
        return true;
      },

      computeFor: (reconciliationId) => {
        const recon = get().reconciliations.find((r) => r.id === reconciliationId);
        if (!recon) return null;
        return computeReconciliation(recon, get().getItems(reconciliationId));
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: STORAGE_KEY,
      // Tenant is resolved client-side on a shared origin (see clientTenant.ts) — a flat
      // storage key would let one tenant's reconciliation data leak into another's view
      // on a shared browser/terminal. This is now only a local cache anyway (hydrateFromApi
      // pulls the tenant-scoped source of truth from the server), but namespace it too.
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(`${name}.${normalizeTenantSubdomain(getClientTenantSubdomain())}`),
        setItem: (name, value) => localStorage.setItem(`${name}.${normalizeTenantSubdomain(getClientTenantSubdomain())}`, value),
        removeItem: (name) => localStorage.removeItem(`${name}.${normalizeTenantSubdomain(getClientTenantSubdomain())}`),
      })),
      partialize: (state) => ({
        reconciliations: state.reconciliations,
        items: state.items,
      }),
    }
  )
);
