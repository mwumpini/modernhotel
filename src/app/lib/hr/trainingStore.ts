'use client';

import { create } from 'zustand';
import type { TrainingProgram, TrainingRecord } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';
import { newId } from './newId';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}
function syncProgramToApi(program: TrainingProgram) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/training-programs', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(program) })
    .catch((e) => console.warn('[HR] Failed to sync training program to server:', e));
}
function deleteProgramFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/hr/training-programs?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() })
    .catch((e) => console.warn('[HR] Failed to delete training program on server:', e));
}
function syncRecordToApi(record: TrainingRecord) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/training-records', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(record) })
    .catch((e) => console.warn('[HR] Failed to sync training record to server:', e));
}
function deleteRecordFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/hr/training-records?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() })
    .catch((e) => console.warn('[HR] Failed to delete training record on server:', e));
}

interface TrainingState {
  programs: TrainingProgram[];
  enrollments: TrainingRecord[];

  addProgram: (p: Omit<TrainingProgram, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: TrainingProgram['status'] }) => TrainingProgram;
  updateProgram: (id: string, updates: Partial<TrainingProgram>) => void;
  deleteProgram: (id: string) => void;

  enroll: (rec: Omit<TrainingRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: TrainingRecord['status'] }) => TrainingRecord;
  updateEnrollment: (id: string, updates: Partial<TrainingRecord>) => void;
  cancelEnrollment: (id: string) => void;

  /** Sum of TrainingRecord.cost for one employee (Phase 4: training cost on the profile view). */
  getTrainingCostByEmployee: (employeeId: string) => number;

  hydrateFromApi: () => Promise<void>;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  programs: [],
  enrollments: [],

  addProgram: (p) => {
    const prog: TrainingProgram = { ...p, id: newId('tp_'), status: p.status || 'scheduled', createdAt: new Date(), updatedAt: new Date() } as TrainingProgram;
    console.log('[HR][Training] addProgram', { title: prog.title });
    set((s) => ({ programs: [prog, ...s.programs] }));
    syncProgramToApi(prog);
    return prog;
  },
  updateProgram: (id, updates) => {
    let updated: TrainingProgram | undefined;
    set((s) => ({
      programs: s.programs.map(pr => {
        if (pr.id !== id) return pr;
        updated = { ...pr, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncProgramToApi(updated);
  },
  deleteProgram: (id) => {
    set((s) => ({ programs: s.programs.filter(p => p.id !== id) }));
    deleteProgramFromApi(id);
  },

  enroll: (r) => {
    const rec: TrainingRecord = { ...r, id: newId('tr_'), status: r.status || 'enrolled', createdAt: new Date(), updatedAt: new Date() } as TrainingRecord;
    console.log('[HR][Training] enroll', { employeeId: r.employeeId, program: r.trainingProgramId });
    set((s) => ({ enrollments: [rec, ...s.enrollments] }));
    syncRecordToApi(rec);
    return rec;
  },
  updateEnrollment: (id, updates) => {
    let updated: TrainingRecord | undefined;
    set((s) => ({
      enrollments: s.enrollments.map(e => {
        if (e.id !== id) return e;
        updated = { ...e, ...updates, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncRecordToApi(updated);
  },
  cancelEnrollment: (id) => {
    set((s) => ({ enrollments: s.enrollments.filter(e => e.id !== id) }));
    deleteRecordFromApi(id);
  },

  getTrainingCostByEmployee: (employeeId) =>
    get().enrollments.filter((e) => e.employeeId === employeeId).reduce((sum, e) => sum + (e.cost || 0), 0),

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const headers = hrTenantHeaders();
      const dateFields = ['startDate', 'endDate', 'enrollmentDate', 'completionDate', 'createdAt', 'updatedAt'];
      const toDates = (row: any) => {
        const out = { ...row };
        for (const f of dateFields) if (out[f]) out[f] = new Date(out[f]);
        return out;
      };
      const [progRes, recRes] = await Promise.all([
        fetch('/api/hr/training-programs', { headers, cache: 'no-store' }),
        fetch('/api/hr/training-records', { headers, cache: 'no-store' }),
      ]);
      if (progRes.ok) {
        const data = await progRes.json();
        if (Array.isArray(data.programs)) {
          set({ programs: data.programs.map(toDates) });
        }
      }
      if (recRes.ok) {
        const data = await recRes.json();
        if (Array.isArray(data.records)) {
          set({ enrollments: data.records.map(toDates) });
        }
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate training programs/records from server:', e);
    }
  },
}));
