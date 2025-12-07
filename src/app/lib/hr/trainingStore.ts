'use client';

import { create } from 'zustand';
import type { TrainingProgram, TrainingRecord } from './models';

interface TrainingState {
  programs: TrainingProgram[];
  enrollments: TrainingRecord[];

  addProgram: (p: Omit<TrainingProgram, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: TrainingProgram['status'] }) => TrainingProgram;
  updateProgram: (id: string, updates: Partial<TrainingProgram>) => void;
  deleteProgram: (id: string) => void;

  enroll: (rec: Omit<TrainingRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: TrainingRecord['status'] }) => TrainingRecord;
  updateEnrollment: (id: string, updates: Partial<TrainingRecord>) => void;
  cancelEnrollment: (id: string) => void;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  programs: [],
  enrollments: [],

  addProgram: (p) => {
    const prog: TrainingProgram = { ...p, id: `tp_${Date.now()}`, status: p.status || 'scheduled', createdAt: new Date(), updatedAt: new Date() } as TrainingProgram;
    console.log('[HR][Training] addProgram', { title: prog.title });
    set((s) => ({ programs: [prog, ...s.programs] }));
    return prog;
  },
  updateProgram: (id, updates) => set((s) => ({ programs: s.programs.map(pr => pr.id === id ? { ...pr, ...updates, updatedAt: new Date() } : pr) })),
  deleteProgram: (id) => set((s) => ({ programs: s.programs.filter(p => p.id !== id) })),

  enroll: (r) => {
    const rec: TrainingRecord = { ...r, id: `tr_${Date.now()}`, status: r.status || 'enrolled', createdAt: new Date(), updatedAt: new Date() } as TrainingRecord;
    console.log('[HR][Training] enroll', { employeeId: r.employeeId, program: r.trainingProgramId });
    set((s) => ({ enrollments: [rec, ...s.enrollments] }));
    return rec;
  },
  updateEnrollment: (id, updates) => set((s) => ({ enrollments: s.enrollments.map(e => e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e) })),
  cancelEnrollment: (id) => set((s) => ({ enrollments: s.enrollments.filter(e => e.id !== id) })),
}));


