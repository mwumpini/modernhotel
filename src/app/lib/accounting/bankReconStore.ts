'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BankReconciliation, ReconcilingItem, ReconStatus } from './bankRecon/types';
import {
  computeReconciliation,
  depositsInTransitCarryForward,
  outstandingChequesCarryForward,
  priorPeriodEnd,
  bookSideItemsNeedingJournal,
} from './bankRecon/calculations';
import { validateReconciliation, validateItem } from './bankRecon/validation';
import {
  getGlCashbookBalance,
  postBookSideItemsToLedger,
} from './bankRecon/ledgerSync';
import { useAccountingStore } from './store';

const STORAGE_KEY = 'bank.recon.v1';

interface BankReconState {
  reconciliations: BankReconciliation[];
  items: ReconcilingItem[];
  error: string | null;

  getReconciliation: (bankAccountId: string, periodEndDate: string) => BankReconciliation | undefined;
  getItems: (reconciliationId: string) => ReconcilingItem[];
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
  completeReconciliation: (reconciliationId: string) => boolean;
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

        const priorEnd = priorPeriodEnd(periodEndDate);
        const priorRecon = get().getReconciliation(bankAccountId, priorEnd);
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
        set((state) => ({
          reconciliations: state.reconciliations.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
          error: null,
        }));
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
        const result = postBookSideItemsToLedger(items, glCode, recon.periodEndDate, reconciliationId);

        if (result.mappings.length) {
          const map = new Map(result.mappings.map((m) => [m.itemId, m.journalEntryId]));
          set((state) => ({
            items: state.items.map((i) =>
              map.has(i.id) ? { ...i, journalEntryId: map.get(i.id) } : i
            ),
          }));
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
        set((state) => ({
          reconciliations: state.reconciliations.map((r) =>
            r.id === reconciliationId
              ? {
                  ...r,
                  status: 'Completed' as ReconStatus,
                  preparedAt: now,
                  updatedAt: now,
                  cashbookBalance: freshRecon.cashbookBalance,
                }
              : r
          ),
          error: null,
        }));
        return true;
      },

      approveReconciliation: (reconciliationId) => {
        const recon = get().reconciliations.find((r) => r.id === reconciliationId);
        if (!recon || recon.status !== 'Completed') {
          set({ error: 'Only completed reconciliations can be approved' });
          return false;
        }
        const now = new Date().toISOString();
        set((state) => ({
          reconciliations: state.reconciliations.map((r) =>
            r.id === reconciliationId
              ? { ...r, status: 'Approved' as ReconStatus, approvedAt: now, updatedAt: now }
              : r
          ),
          error: null,
        }));
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
      partialize: (state) => ({
        reconciliations: state.reconciliations,
        items: state.items,
      }),
    }
  )
);
