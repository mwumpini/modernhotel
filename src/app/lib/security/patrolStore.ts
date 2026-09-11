import { create } from 'zustand';
import { PatrolLog, PatrolCheckpoint } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';

function hkHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface PatrolStore {
  patrols: PatrolLog[];

  hydrateFromApi: () => Promise<void>;
  startPatrol: (patrol: { officerId?: string; officerName: string; route: string; checkpoints: Omit<PatrolCheckpoint, 'id' | 'status' | 'actualTime'>[]; notes?: string }) => PatrolLog;
  endPatrol: (id: string) => void;
  completeCheckpoint: (patrolId: string, checkpointId: string, notes?: string) => void;
  missCheckpoint: (patrolId: string, checkpointId: string, reason: string) => void;

  getPatrolAnalytics: (period: 'daily' | 'weekly' | 'monthly') => {
    totalPatrols: number;
    completedPatrols: number;
    complianceRate: number;
  };
}

function periodStart(period: 'daily' | 'weekly' | 'monthly'): Date {
  const now = new Date();
  if (period === 'daily') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (period === 'weekly') { const d = new Date(now); d.setDate(now.getDate() - 7); return d; }
  const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

function syncPatrolToApi(patrol: PatrolLog) {
  if (typeof window === 'undefined') return;
  fetch('/api/security/patrols', {
    method: 'POST',
    headers: hkHeaders(),
    body: JSON.stringify(patrol),
  }).catch((e) => console.warn('Security: Failed to sync patrol:', e));
}

export const usePatrolStore = create<PatrolStore>((set, get) => ({
  patrols: [],

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/security/patrols', { headers: hkHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      set({
        patrols: (data.patrols || []).map((p: any) => ({
          ...p,
          startTime: new Date(p.startTime),
          endTime: p.endTime ? new Date(p.endTime) : undefined,
          checkpoints: (p.checkpoints || []).map((c: any) => ({
            ...c,
            scheduledTime: new Date(c.scheduledTime),
            actualTime: c.actualTime ? new Date(c.actualTime) : undefined,
          })),
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        })),
      });
    } catch (e) {
      console.warn('Security: patrolStore hydrateFromApi failed:', e);
    }
  },

  startPatrol: (patrol) => {
    const now = new Date();
    const newPatrol: PatrolLog = {
      id: `pat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      patrolNumber: `PAT-${now.getFullYear()}-${Date.now().toString().slice(-6)}`,
      officerId: patrol.officerId,
      officerName: patrol.officerName,
      route: patrol.route,
      startTime: now,
      status: 'active',
      checkpoints: patrol.checkpoints.map((c, idx) => ({
        ...c,
        id: `cp${idx}_${Date.now().toString(36)}`,
        status: 'pending',
      })),
      notes: patrol.notes,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ patrols: [newPatrol, ...state.patrols] }));
    syncPatrolToApi(newPatrol);
    return newPatrol;
  },

  endPatrol: (id) => {
    let updated: PatrolLog | undefined;
    set((state) => ({
      patrols: state.patrols.map((p) => {
        if (p.id !== id) return p;
        updated = { ...p, endTime: new Date(), status: 'completed', updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncPatrolToApi(updated);
  },

  completeCheckpoint: (patrolId, checkpointId, notes) => {
    let updated: PatrolLog | undefined;
    set((state) => ({
      patrols: state.patrols.map((p) => {
        if (p.id !== patrolId) return p;
        updated = {
          ...p,
          checkpoints: p.checkpoints.map((c) =>
            c.id === checkpointId ? { ...c, status: 'completed', actualTime: new Date(), notes: notes || c.notes } : c
          ),
          updatedAt: new Date(),
        };
        return updated;
      }),
    }));
    if (updated) syncPatrolToApi(updated);
  },

  missCheckpoint: (patrolId, checkpointId, reason) => {
    let updated: PatrolLog | undefined;
    set((state) => ({
      patrols: state.patrols.map((p) => {
        if (p.id !== patrolId) return p;
        updated = {
          ...p,
          checkpoints: p.checkpoints.map((c) =>
            c.id === checkpointId ? { ...c, status: 'missed', notes: `Missed: ${reason}` } : c
          ),
          updatedAt: new Date(),
        };
        return updated;
      }),
    }));
    if (updated) syncPatrolToApi(updated);
  },

  getPatrolAnalytics: (period) => {
    const start = periodStart(period);
    const filtered = get().patrols.filter((p) => p.startTime >= start);
    const completedPatrols = filtered.filter((p) => p.status === 'completed').length;
    let checkpointsCompleted = 0;
    let checkpointsTotal = 0;
    filtered.forEach((p) => {
      checkpointsTotal += p.checkpoints.length;
      checkpointsCompleted += p.checkpoints.filter((c) => c.status === 'completed').length;
    });
    return {
      totalPatrols: filtered.length,
      completedPatrols,
      complianceRate: checkpointsTotal > 0 ? (checkpointsCompleted / checkpointsTotal) * 100 : 0,
    };
  },
}));
