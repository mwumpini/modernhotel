import { create } from 'zustand';
import { SecurityIncident } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';

function hkHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface IncidentStore {
  incidents: SecurityIncident[];

  hydrateFromApi: () => Promise<void>;
  addIncident: (incident: Omit<SecurityIncident, 'id' | 'createdAt' | 'updatedAt'>) => SecurityIncident;
  assignIncident: (id: string, assignedTo: string) => void;
  resolveIncident: (id: string, resolution: string) => void;
  updateIncidentStatus: (id: string, status: SecurityIncident['status']) => void;

  getIncidentAnalytics: (period: 'daily' | 'weekly' | 'monthly') => {
    totalIncidents: number;
    resolutionRate: number;
    incidentsByType: Record<string, number>;
    incidentsBySeverity: Record<string, number>;
  };
}

function periodStart(period: 'daily' | 'weekly' | 'monthly'): Date {
  const now = new Date();
  if (period === 'daily') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (period === 'weekly') { const d = new Date(now); d.setDate(now.getDate() - 7); return d; }
  const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

function syncIncidentToApi(incident: SecurityIncident) {
  if (typeof window === 'undefined') return;
  fetch('/api/security/incidents', {
    method: 'POST',
    headers: hkHeaders(),
    body: JSON.stringify(incident),
  }).catch((e) => console.warn('Security: Failed to sync incident:', e));
}

export const useIncidentStore = create<IncidentStore>((set, get) => ({
  incidents: [],

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/security/incidents', { headers: hkHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      set({
        incidents: (data.incidents || []).map((i: any) => ({
          ...i,
          reportedAt: new Date(i.reportedAt),
          assignedAt: i.assignedAt ? new Date(i.assignedAt) : undefined,
          resolvedAt: i.resolvedAt ? new Date(i.resolvedAt) : undefined,
          createdAt: new Date(i.createdAt),
          updatedAt: new Date(i.updatedAt),
        })),
      });
    } catch (e) {
      console.warn('Security: incidentStore hydrateFromApi failed:', e);
    }
  },

  addIncident: (incident) => {
    const newIncident: SecurityIncident = {
      ...incident,
      id: `sec_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((state) => ({ incidents: [newIncident, ...state.incidents] }));
    syncIncidentToApi(newIncident);
    return newIncident;
  },

  assignIncident: (id, assignedTo) => {
    let updated: SecurityIncident | undefined;
    set((state) => ({
      incidents: state.incidents.map((i) => {
        if (i.id !== id) return i;
        updated = { ...i, assignedTo, assignedAt: new Date(), status: 'investigating', updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncIncidentToApi(updated);
  },

  resolveIncident: (id, resolution) => {
    let updated: SecurityIncident | undefined;
    set((state) => ({
      incidents: state.incidents.map((i) => {
        if (i.id !== id) return i;
        updated = { ...i, resolution, resolvedAt: new Date(), status: 'resolved', updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncIncidentToApi(updated);
  },

  updateIncidentStatus: (id, status) => {
    let updated: SecurityIncident | undefined;
    set((state) => ({
      incidents: state.incidents.map((i) => {
        if (i.id !== id) return i;
        updated = { ...i, status, updatedAt: new Date() };
        return updated;
      }),
    }));
    if (updated) syncIncidentToApi(updated);
  },

  getIncidentAnalytics: (period) => {
    const start = periodStart(period);
    const filtered = get().incidents.filter((i) => i.reportedAt >= start);
    const incidentsByType: Record<string, number> = {};
    const incidentsBySeverity: Record<string, number> = {};
    let resolvedCount = 0;
    filtered.forEach((i) => {
      incidentsByType[i.type] = (incidentsByType[i.type] || 0) + 1;
      incidentsBySeverity[i.severity] = (incidentsBySeverity[i.severity] || 0) + 1;
      if (i.status === 'resolved' || i.status === 'closed') resolvedCount++;
    });
    return {
      totalIncidents: filtered.length,
      resolutionRate: filtered.length > 0 ? (resolvedCount / filtered.length) * 100 : 0,
      incidentsByType,
      incidentsBySeverity,
    };
  },
}));
