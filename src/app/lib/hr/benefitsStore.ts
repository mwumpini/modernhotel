'use client';

import { create } from 'zustand';
import type { BenefitsPackage, EmployeeBenefits } from './models';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';
import { newId } from './newId';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}
function syncPackageToApi(pkg: BenefitsPackage) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/benefits-packages', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(pkg) })
    .catch((e) => console.warn('[HR] Failed to sync benefits package to server:', e));
}
function deletePackageFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/hr/benefits-packages?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() })
    .catch((e) => console.warn('[HR] Failed to delete benefits package on server:', e));
}
function syncEnrollmentToApi(enrollment: EmployeeBenefits) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/benefits-enrollments', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(enrollment) })
    .catch((e) => console.warn('[HR] Failed to sync benefits enrollment to server:', e));
}
function deleteEnrollmentFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/hr/benefits-enrollments?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() })
    .catch((e) => console.warn('[HR] Failed to delete benefits enrollment on server:', e));
}

interface BenefitsState {
  packages: BenefitsPackage[];
  enrollments: EmployeeBenefits[];

  addPackage: (pkg: Omit<BenefitsPackage, 'id' | 'createdAt' | 'updatedAt'>) => BenefitsPackage;
  updatePackage: (id: string, updates: Partial<BenefitsPackage>) => BenefitsPackage | null;
  deletePackage: (id: string) => void;

  enrollEmployee: (enrollment: Omit<EmployeeBenefits, 'id' | 'createdAt' | 'updatedAt'>) => EmployeeBenefits;
  updateEnrollment: (id: string, updates: Partial<EmployeeBenefits>) => EmployeeBenefits | null;
  cancelEnrollment: (id: string) => void;

  getEnrollmentsByEmployee: (employeeId: string) => EmployeeBenefits[];
  getActiveEnrollments: () => EmployeeBenefits[];
  getSummary: () => { activePackages: number; activeEnrollments: number; monthlyCost: number };

  // Persistence — pulls real data from the database, replacing the in-memory seed.
  hydrateFromApi: () => Promise<void>;
}

export const useBenefitsStore = create<BenefitsState>((set, get) => ({
  // Empty initial state — hydrateFromApi() below replaces this with real data on mount.
  // Never seed with a fake demo package: a slow/failed fetch must show an honest empty
  // state, not a benefits plan that doesn't actually exist for this tenant.
  packages: [],
  enrollments: [],

  addPackage: (pkg) => {
    const newPkg: BenefitsPackage = {
      ...pkg,
      id: newId('bp_'),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('[HR][Benefits] addPackage', { name: pkg.name, type: pkg.type });
    set((state) => ({ packages: [...state.packages, newPkg] }));
    syncPackageToApi(newPkg);
    return newPkg;
  },

  updatePackage: (id, updates) => {
    console.log('[HR][Benefits] updatePackage', { id, updates });
    let updated: BenefitsPackage | null = null;
    set((state) => ({
      packages: state.packages.map((p) => {
        if (p.id !== id) return p;
        updated = { ...p, ...updates, updatedAt: new Date() } as BenefitsPackage;
        return updated;
      })
    }));
    if (updated) syncPackageToApi(updated);
    return updated;
  },

  deletePackage: (id) => {
    console.log('[HR][Benefits] deletePackage', { id });
    set((state) => ({ packages: state.packages.filter((p) => p.id !== id) }));
    deletePackageFromApi(id);
  },

  enrollEmployee: (enrollment) => {
    const newEn: EmployeeBenefits = {
      ...enrollment,
      id: newId('en_'),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('[HR][Benefits] enrollEmployee', { employeeId: enrollment.employeeId, benefitsPackageId: enrollment.benefitsPackageId });
    set((state) => ({ enrollments: [newEn, ...state.enrollments] }));
    syncEnrollmentToApi(newEn);
    return newEn;
  },

  updateEnrollment: (id, updates) => {
    console.log('[HR][Benefits] updateEnrollment', { id, updates });
    let updated: EmployeeBenefits | null = null;
    set((state) => ({
      enrollments: state.enrollments.map((e) => {
        if (e.id !== id) return e;
        updated = { ...e, ...updates, updatedAt: new Date() } as EmployeeBenefits;
        return updated;
      })
    }));
    if (updated) syncEnrollmentToApi(updated);
    return updated;
  },

  cancelEnrollment: (id) => {
    console.log('[HR][Benefits] cancelEnrollment', { id });
    set((state) => ({ enrollments: state.enrollments.filter((e) => e.id !== id) }));
    deleteEnrollmentFromApi(id);
  },

  getEnrollmentsByEmployee: (employeeId) => get().enrollments.filter((e) => e.employeeId === employeeId),
  getActiveEnrollments: () => get().enrollments.filter((e) => e.status === 'active'),
  getSummary: () => {
    const activePackages = get().packages.filter((p) => p.isActive).length;
    const activeEnrollments = get().getActiveEnrollments().length;
    const monthlyCost = get().enrollments.reduce((sum, e) => sum + (e.employeeContribution + e.employerContribution), 0);
    return { activePackages, activeEnrollments, monthlyCost };
  },

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    const headers = hrTenantHeaders();
    const dateFields = ['effectiveDate', 'expiryDate', 'enrollmentDate', 'endDate', 'createdAt', 'updatedAt'];
    const toDates = (row: any) => {
      const out = { ...row };
      for (const f of dateFields) if (out[f]) out[f] = new Date(out[f]);
      return out;
    };
    try {
      const res = await fetch('/api/hr/benefits-packages', { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.packages)) set({ packages: data.packages.map(toDates) });
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate benefits packages from server:', e);
    }
    try {
      const res = await fetch('/api/hr/benefits-enrollments', { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.enrollments)) set({ enrollments: data.enrollments.map(toDates) });
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate benefits enrollments from server:', e);
    }
  },
}));
