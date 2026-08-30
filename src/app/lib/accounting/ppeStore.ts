'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PpeAsset, PpeCategory } from './ppe/types';
import { DEFAULT_PPE_CATEGORIES, SAMPLE_PPE_ASSETS } from './ppe/categories';
import { defaultReportDateStr, assetTotalCost } from './ppe/calculations';
import { validateAsset, validateCategory } from './ppe/validation';
import { DEFAULT_ORG_ID } from './ppe/categories';
import { syncPpeRegisterToLedger, capturePpeCostAdjustment } from './ppe/ledgerSync';

const STORAGE_KEY = 'ppe.register.v1';

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
  syncToLedger: () => import('./ppe/ledgerSync').PpeSyncResult;

  initializePpeRegister: () => void;
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
        if (existing.capitalizationJournalEntryId) {
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

        set((state) => ({
          assets: state.assets.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
          ),
          error: null,
        }));
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
        return true;
      },

      setCapitalizationJournalId: (assetId, journalEntryId) =>
        set((state) => ({
          assets: state.assets.map((a) =>
            a.id === assetId ? { ...a, capitalizationJournalEntryId: journalEntryId } : a
          ),
        })),

      setLedgerAccumDepPosted: (assetId, amount, journalEntryId) =>
        set((state) => ({
          assets: state.assets.map((a) =>
            a.id === assetId
              ? {
                  ...a,
                  ledgerAccumDepPosted: amount,
                  ...(journalEntryId ? { lastDepreciationJournalEntryId: journalEntryId } : {}),
                }
              : a
          ),
        })),

      syncToLedger: () => {
        const state = get();
        return syncPpeRegisterToLedger(state.assets, state.categories, state.reportDate, {
          setCapitalizationJournalId: (id, je) => get().setCapitalizationJournalId(id, je),
          setLedgerAccumDepPosted: (id, amt, je) => get().setLedgerAccumDepPosted(id, amt, je),
        });
      },

      initializePpeRegister: () => {
        const state = get();
        set({
          categories: mergeById(DEFAULT_PPE_CATEGORIES, state.categories),
          assets: mergeById(SAMPLE_PPE_ASSETS as PpeAsset[], state.assets),
        });
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
