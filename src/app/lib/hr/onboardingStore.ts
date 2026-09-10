'use client';

import { create } from 'zustand';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

export interface OnboardingTask {
  key: string;
  label: string;
  completed: boolean;
  completedAt?: string;
}

export interface OnboardingChecklist {
  id: string;
  employeeId: string;
  tasks: OnboardingTask[];
  startedAt: Date;
  completedAt?: Date;
}

// A reasonable default checklist for a Ghana hotel new hire. Deliberately overlaps with
// the labour-compliance checks in laborCompliance.ts (contract, TIN, SSNIT) -- onboarding
// is how those facts actually get established on the employee record in the first place.
export const DEFAULT_ONBOARDING_TASKS: Array<{ key: string; label: string }> = [
  { key: 'contract', label: 'Signed employment contract collected' },
  { key: 'id_documents', label: 'ID documents collected (Ghana Card / passport)' },
  { key: 'ssnit_tin', label: 'SSNIT number and TIN recorded' },
  { key: 'bank_details', label: 'Bank account details on file' },
  { key: 'equipment', label: 'Uniform / equipment issued' },
  { key: 'system_access', label: 'System access granted (login, email)' },
  { key: 'orientation', label: 'Orientation / induction completed' },
];

function syncChecklistToApi(checklist: OnboardingChecklist) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/onboarding', {
    method: 'POST',
    headers: hrTenantHeaders(),
    body: JSON.stringify({
      employeeId: checklist.employeeId,
      tasks: checklist.tasks,
      completedAt: checklist.completedAt,
    }),
  }).catch((e) => console.warn('[HR] Failed to sync onboarding checklist to server:', e));
}

interface OnboardingState {
  // Keyed by employeeId -- an employee has at most one checklist.
  checklists: Record<string, OnboardingChecklist>;

  startOnboarding: (employeeId: string) => OnboardingChecklist;
  toggleTask: (employeeId: string, taskKey: string) => void;
  getChecklist: (employeeId: string) => OnboardingChecklist | undefined;

  hydrateFromApi: () => Promise<void>;
}

function buildChecklist(employeeId: string, id: string): OnboardingChecklist {
  return {
    id,
    employeeId,
    tasks: DEFAULT_ONBOARDING_TASKS.map((t) => ({ ...t, completed: false })),
    startedAt: new Date(),
  };
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  checklists: {},

  startOnboarding: (employeeId) => {
    const existing = get().checklists[employeeId];
    if (existing) return existing;
    const checklist = buildChecklist(employeeId, `onb_${Date.now()}`);
    console.log('[HR][Onboarding] start', { employeeId });
    set((state) => ({ checklists: { ...state.checklists, [employeeId]: checklist } }));
    syncChecklistToApi(checklist);
    return checklist;
  },

  toggleTask: (employeeId, taskKey) => {
    const current = get().checklists[employeeId];
    if (!current) return;
    const now = new Date().toISOString();
    const tasks = current.tasks.map((t) =>
      t.key === taskKey ? { ...t, completed: !t.completed, completedAt: !t.completed ? now : undefined } : t
    );
    const allDone = tasks.every((t) => t.completed);
    const updated: OnboardingChecklist = {
      ...current,
      tasks,
      completedAt: allDone ? (current.completedAt || new Date()) : undefined,
    };
    console.log('[HR][Onboarding] toggleTask', { employeeId, taskKey });
    set((state) => ({ checklists: { ...state.checklists, [employeeId]: updated } }));
    syncChecklistToApi(updated);
  },

  getChecklist: (employeeId) => get().checklists[employeeId],

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/hr/onboarding', { headers: hrTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.checklists)) {
        const byEmployee: Record<string, OnboardingChecklist> = {};
        for (const row of data.checklists) {
          byEmployee[row.employeeId] = {
            id: row.id,
            employeeId: row.employeeId,
            tasks: row.tasks || [],
            startedAt: new Date(row.startedAt),
            completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
          };
        }
        set({ checklists: byEmployee });
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate onboarding checklists from server:', e);
    }
  },
}));
