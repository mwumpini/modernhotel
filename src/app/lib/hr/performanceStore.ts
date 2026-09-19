'use client';

import { create } from 'zustand';
import type { PerformanceReview } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';
import { newId } from './newId';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}
function syncReviewToApi(review: PerformanceReview) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/performance-reviews', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(review) })
    .catch((e) => console.warn('[HR] Failed to sync performance review to server:', e));
}
function deleteReviewFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/hr/performance-reviews?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() })
    .catch((e) => console.warn('[HR] Failed to delete performance review on server:', e));
}

interface PerformanceState {
  reviews: PerformanceReview[];

  addReview: (review: Omit<PerformanceReview, 'id' | 'createdAt' | 'updatedAt'>) => PerformanceReview;
  updateReview: (id: string, updates: Partial<PerformanceReview>) => PerformanceReview | null;
  deleteReview: (id: string) => void;

  getReview: (id: string) => PerformanceReview | undefined;
  getReviewsByEmployee: (employeeId: string) => PerformanceReview[];
  getActiveReviews: () => PerformanceReview[]; // not completed
  getPendingCount: () => number; // submitted/reviewed/acknowledged

  // Persistence — pulls real data from the database, replacing the in-memory seed.
  hydrateFromApi: () => Promise<void>;
}

export const usePerformanceStore = create<PerformanceState>((set, get) => ({
  // Empty initial state — hydrateFromApi() below replaces this with real data on mount.
  // Never seed with a fake demo review: a slow/failed fetch must show an honest empty
  // state, not a review for an employee that was never actually reviewed.
  reviews: [],

  addReview: (review) => {
    const newReview: PerformanceReview = {
      ...review,
      id: newId('pr_'),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('[HR][Performance] addReview', { employeeId: review.employeeId, reviewPeriod: review.reviewPeriod });
    set((state) => ({ reviews: [...state.reviews, newReview] }));
    syncReviewToApi(newReview);
    return newReview;
  },

  updateReview: (id, updates) => {
    console.log('[HR][Performance] updateReview', { id, updates });
    let updated: PerformanceReview | null = null;
    set((state) => ({
      reviews: state.reviews.map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, ...updates, updatedAt: new Date() } as PerformanceReview;
        return updated;
      })
    }));
    if (updated) syncReviewToApi(updated);
    return updated;
  },

  deleteReview: (id) => {
    console.log('[HR][Performance] deleteReview', { id });
    set((state) => ({ reviews: state.reviews.filter((r) => r.id !== id) }));
    deleteReviewFromApi(id);
  },

  getReview: (id) => get().reviews.find((r) => r.id === id),

  getReviewsByEmployee: (employeeId) => get().reviews.filter((r) => r.employeeId === employeeId),

  getActiveReviews: () => get().reviews.filter((r) => r.status !== 'completed'),

  getPendingCount: () => get().reviews.filter((r) => ['submitted', 'reviewed', 'acknowledged'].includes(r.status)).length,

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/hr/performance-reviews', { headers: hrTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.reviews)) {
        const dateFields = ['reviewDate', 'nextReviewDate', 'createdAt', 'updatedAt'];
        const toDates = (row: any) => {
          const out = { ...row };
          for (const f of dateFields) if (out[f]) out[f] = new Date(out[f]);
          return out;
        };
        set({ reviews: data.reviews.map(toDates) });
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate performance reviews from server:', e);
    }
  },
}));
