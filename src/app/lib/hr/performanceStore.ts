'use client';

import { create } from 'zustand';
import type { PerformanceReview } from './models';

interface PerformanceState {
  reviews: PerformanceReview[];

  addReview: (review: Omit<PerformanceReview, 'id' | 'createdAt' | 'updatedAt'>) => PerformanceReview;
  updateReview: (id: string, updates: Partial<PerformanceReview>) => PerformanceReview | null;
  deleteReview: (id: string) => void;

  getReview: (id: string) => PerformanceReview | undefined;
  getReviewsByEmployee: (employeeId: string) => PerformanceReview[];
  getActiveReviews: () => PerformanceReview[]; // not completed
  getPendingCount: () => number; // submitted/reviewed/acknowledged
}

export const usePerformanceStore = create<PerformanceState>((set, get) => ({
  reviews: [
    {
      id: 'pr_1',
      employeeId: '1',
      reviewPeriod: '2024-Q4',
      reviewDate: new Date('2024-12-20'),
      reviewerId: 'mgr_1',
      reviewerName: 'HR Manager',
      overallRating: 4.2,
      categories: {
        jobKnowledge: 4,
        qualityOfWork: 4,
        quantityOfWork: 4,
        teamwork: 5,
        communication: 4,
        initiative: 4,
        attendance: 5,
        reliability: 4
      },
      strengths: ['Team leadership', 'Guest relations'],
      areasForImprovement: ['Cross-department collaboration'],
      goals: ['Mentor two junior staff'],
      comments: 'Consistent performer with strong guest focus.',
      status: 'reviewed',
      nextReviewDate: new Date('2025-03-31'),
      createdAt: new Date('2024-12-01'),
      updatedAt: new Date('2024-12-20')
    }
  ],

  addReview: (review) => {
    const newReview: PerformanceReview = {
      ...review,
      id: `pr_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('[HR][Performance] addReview', { employeeId: review.employeeId, reviewPeriod: review.reviewPeriod });
    set((state) => ({ reviews: [...state.reviews, newReview] }));
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
    return updated;
  },

  deleteReview: (id) => {
    console.log('[HR][Performance] deleteReview', { id });
    set((state) => ({ reviews: state.reviews.filter((r) => r.id !== id) }));
  },

  getReview: (id) => get().reviews.find((r) => r.id === id),

  getReviewsByEmployee: (employeeId) => get().reviews.filter((r) => r.employeeId === employeeId),

  getActiveReviews: () => get().reviews.filter((r) => r.status !== 'completed'),

  getPendingCount: () => get().reviews.filter((r) => ['submitted', 'reviewed', 'acknowledged'].includes(r.status)).length
}));


