'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PpeAsset, PpeCategory } from './ppe/types';
import { DEFAULT_PPE_CATEGORIES, SAMPLE_PPE_ASSETS } from './ppe/categories';
import { defaultReportDateStr, assetTotalCost } from './ppe/calculations';
import { validateAsset, validateCategory } from './ppe/validation';
import { DEFAULT_ORG_ID } from './ppe/categories';
import { syncPpeRegisterToLedger, capturePpeCostAdjustment, postPpeDisposalIfNeeded } from './ppe/ledgerSync';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';

const STORAGE_KEY = 'ppe.register.v1';

function ppeTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

// Best-effort background persistence -- localStorage (via zustand's `persist` below)
// stays the fast local cache the UI reads/writes synchronously, but every mutation now
// also durably syncs tenant-scoped to the database. Previously this register (fixed
// assets + depreciation, financial-statement-relevant data) lived ONLY in one browser's
// localStorage with no server-side record at all.
function syncCategoryToApi(category: PpeCategory) {
  if (typeof window === 'undefined') return;
  fetch('/api/accounting/ppe-categories', { method: 'POST', headers: ppeTenantHeaders(), body: JSON.stringify(category) })
    .catch((e) => console.warn('[PPE] Failed to sync category to server:', e));
}
function deleteCategoryFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/accounting/ppe-categories?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: ppeTenantHeaders() })
    .catch((e) => console.warn('[PPE] Failed to delete category on server:', e));
}
function syncAssetToApi(asset: PpeAsset) {
  if (typeof window === 'undefined') return;
  fetch('/api/accounting/ppe-assets', { method: 'POST', headers: ppeTenantHeaders(), body: JSON.stringify(asset) })
    .catch((e) => console.warn('[PPE] Failed to sync asset to server:', e));
}
function deleteAssetFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/accounting/ppe-assets?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: ppeTenantHeaders() })
    .catch((e) => console.warn('[PPE] Failed to delete asset on server:', e));
}

interface PpeRegisterState {
  categories: PpeCategory[];
  assets: PpeAsset[];
  reportDate: string;
  error: string | null;

  setReportDate: (date: string) => void;
  setCategories: (categories: PpeCategory[]) => void;
  upsertCategory: (category: PpeCategory) => boolean;
  deleteCategory: (id: string) => boolean;

  addAsset: (input: Omit<PpeAsset, 'id' | 'createdAt' | 'updatedAt'>) => PpeAsset | null;
  updateAsset: (id: string, updates: Partial<PpeAsset>) => boolean;
  deleteAsset: (id: string) => boolean;
  setCapitalizationJournalId: (assetId: string, journalEntryId: string) => void;
  setLedgerAccumDepPosted: (assetId: string, amount: number, journalEntryId?: string) => void;
  setDisposalJournalId: (assetId: string, journalEntryId: string) => void;
  syncToLedger: () => import('./ppe/ledgerSync').PpeSyncResult;

  initializePpeRegister: () => void;
  hydrateFromApi: () => Promise<void>;
  clearError: () => void;
}

function mergeById<T extends { id: string }>(seed: T[], existing: T[]): T[] {
  const m = new Map<string, T>();
  for (const item of seed) m.set(item.id, item);
  for (const item of existing) m.set(item.id, item);
  return Array.from(m.values());
}

export const usePpeRegisterStore = create<PpeRegisterState>()(
  persist(
    (set, get) => ({
      categories: DEFAULT_PPE_CATEGORIES,
      assets: [],
      reportDate: defaultReportDateStr(),
      error: null,

      setReportDate: (date) => set({ reportDate: date }),

      setCategories: (categories) => set({ categories }),

      upsertCategory: (category) => {
        const errors = validateCategory(category);
        if (errors.length) {
          set({ error: errors.join('; ') });
          return false;
        }
        set((state) => ({
          categories: state.categories.some((c) => c.id === category.id)
            ? state.categories.map((c) => (c.id === category.id ? category : c))
            : [...state.categories, category],
          error: null,
        }));
        syncCategoryToApi(category);
        return true;
      },

      deleteCategory: (id) => {
        const state = get();
        if (state.assets.some((a) => a.categoryId === id)) {
          set({ error: 'Cannot delete — one or more assets use this category' });
          return false;
        }
        if (state.categories.length <= 1) {
          set({ error: 'At least one category must remain' });
          return false;
        }
        set({
          categories: state.categories.filter((c) => c.id !== id),
          error: null,
        });
        deleteCategoryFromApi(id);
        return true;
      },

      addAsset: (input) => {
        const errors = validateAsset(input);
        if (errors.length) {
          set({ error: errors.join('; ') });
          return null;
        }
        const now = new Date().toISOString();
        const asset: PpeAsset = {
          ...input,
          id: `ppe-${Date.now()}`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ assets: [...state.assets, asset], error: null }));
        syncAssetToApi(asset);
        return asset;
      },

      updateAsset: (id, updates) => {
        const existing = get().assets.find((a) => a.id === id);
        if (!existing) {
          set({ error: 'Asset not found' });
          return false;
        }
        const merged = { ...existing, ...updates };
        const errors = validateAsset(merged);
        if (errors.length) {
          set({ error: errors.join('; ') });
          return false;
        }

        // Already capitalized and this edit changes the cost (quantity/unitPrice) — post a
        // correcting journal entry for the delta so the GL cost account catches up to the
        // register's new cost instead of silently drifting from it. The original
        // capitalization JE is left untouched (never rewrite posted history).
        if (existing.capExp !== 'Disposed' && existing.capitalizationJournalEntryId) {
          const oldCost = assetTotalCost(existing);
          const newCost = assetTotalCost(merged);
          const delta = +(newCost - oldCost).toFixed(2);
          if (Math.abs(delta) >= 0.01) {
            capturePpeCostAdjustment({
              ppeAssetId: id,
              assetCode: existing.assetCode,
              name: existing.assetName,
              date: new Date().toISOString(),
              delta,
            });
          }
        }

        // Newly marked Disposed (and not already posted) — write off cost/accum dep and book
        // the gain/loss immediately, same moment the cost-adjustment above fires for a plain
        // cost edit. syncToLedger below is only the retry path for anything this misses.
        let disposalResult: ReturnType<typeof postPpeDisposalIfNeeded> = null;
        if (merged.capExp === 'Disposed' && !existing.disposalJournalEntryId) {
          const category = get().categories.find((c) => c.id === merged.categoryId);
          if (category) {
            disposalResult = postPpeDisposalIfNeeded(merged, category, {
              setLedgerAccumDepPosted: (assetId, amount, je) => get().setLedgerAccumDepPosted(assetId, amount, je),
              setDisposalJournalId: (assetId, je) => get().setDisposalJournalId(assetId, je),
            });
          }
        }

        let saved: PpeAsset | undefined;
        set((state) => ({
          assets: state.assets.map((a) => {
            if (a.id !== id) return a;
            saved = { ...a, ...updates, updatedAt: new Date().toISOString() };
            return saved;
          }),
          error: disposalResult && !disposalResult.ok ? disposalResult.error || null : null,
        }));
        if (saved) syncAssetToApi(saved);
        return true;
      },

      deleteAsset: (id) => {
        const existing = get().assets.find((a) => a.id === id);
        if (!existing) return false;
        if (existing.capitalizationJournalEntryId) {
          set({
            error: `Cannot delete "${existing.assetName}": it has been capitalized to the GL. Dispose the asset instead, or void the capitalization journal entry first.`,
          });
          return false;
        }
        set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
          error: null,
        }));
        deleteAssetFromApi(id);
        return true;
      },

      setCapitalizationJournalId: (assetId, journalEntryId) => {
        let saved: PpeAsset | undefined;
        set((state) => ({
          assets: state.assets.map((a) => {
            if (a.id !== assetId) return a;
            saved = { ...a, capitalizationJournalEntryId: journalEntryId };
            return saved;
          }),
        }));
        if (saved) syncAssetToApi(saved);
      },

      setLedgerAccumDepPosted: (assetId, amount, journalEntryId) => {
        let saved: PpeAsset | undefined;
        set((state) => ({
          assets: state.assets.map((a) => {
            if (a.id !== assetId) return a;
            saved = {
              ...a,
              ledgerAccumDepPosted: amount,
              ...(journalEntryId ? { lastDepreciationJournalEntryId: journalEntryId } : {}),
            };
            return saved;
          }),
        }));
        if (saved) syncAssetToApi(saved);
      },

      setDisposalJournalId: (assetId, journalEntryId) => {
        let saved: PpeAsset | undefined;
        set((state) => ({
          assets: state.assets.map((a) => {
            if (a.id !== assetId) return a;
            saved = { ...a, disposalJournalEntryId: journalEntryId };
            return saved;
          }),
        }));
        if (saved) syncAssetToApi(saved);
      },

      syncToLedger: () => {
        const state = get();
        return syncPpeRegisterToLedger(state.assets, state.categories, state.reportDate, {
          setCapitalizationJournalId: (id, je) => get().setCapitalizationJournalId(id, je),
          setLedgerAccumDepPosted: (id, amt, je) => get().setLedgerAccumDepPosted(id, amt, je),
          setDisposalJournalId: (id, je) => get().setDisposalJournalId(id, je),
        });
      },

      initializePpeRegister: () => {
        const state = get();
        set({
          categories: mergeById(DEFAULT_PPE_CATEGORIES, state.categories),
          assets: mergeById(SAMPLE_PPE_ASSETS as PpeAsset[], state.assets),
        });
      },

      // Pull the tenant's real persisted register from the database. Server wins
      // outright once it has anything (categories/assets are edited one at a time
      // through this screen, same reasoning as chart-of-accounts/bank-accounts);
      // on a brand-new tenant (server empty), bulk-persist the local seed so it's
      // there next time and for any other device/tab.
      hydrateFromApi: async () => {
        if (typeof window === 'undefined') return;
        const headers = ppeTenantHeaders();
        try {
          const res = await fetch('/api/accounting/ppe-categories', { headers, cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.categories) && data.categories.length > 0) {
              set({ categories: data.categories });
            } else {
              get().categories.forEach((c) => syncCategoryToApi(c));
            }
          }
        } catch (e) {
          console.warn('[PPE] Failed to hydrate categories from server:', e);
        }
        try {
          const res = await fetch('/api/accounting/ppe-assets', { headers, cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.assets) && data.assets.length > 0) {
              set({ assets: data.assets });
            } else {
              get().assets.forEach((a) => syncAssetToApi(a));
            }
          }
        } catch (e) {
          console.warn('[PPE] Failed to hydrate assets from server:', e);
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        categories: state.categories,
        assets: state.assets,
        reportDate: state.reportDate,
      }),
    }
  )
);
