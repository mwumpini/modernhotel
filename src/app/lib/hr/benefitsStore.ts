'use client';

import { create } from 'zustand';
import type { BenefitsPackage, EmployeeBenefits } from './models';

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
}

export const useBenefitsStore = create<BenefitsState>((set, get) => ({
  packages: [
    {
      id: 'bp_1',
      name: 'Health Basic',
      description: 'Primary health coverage',
      type: 'health',
      coverage: 'OPD + Emergency',
      cost: 300,
      employeeContribution: 100,
      employerContribution: 200,
      isActive: true,
      effectiveDate: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ],
  enrollments: [],

  addPackage: (pkg) => {
    const newPkg: BenefitsPackage = {
      ...pkg,
      id: `bp_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('[HR][Benefits] addPackage', { name: pkg.name, type: pkg.type });
    set((state) => ({ packages: [...state.packages, newPkg] }));
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
    return updated;
  },

  deletePackage: (id) => {
    console.log('[HR][Benefits] deletePackage', { id });
    set((state) => ({ packages: state.packages.filter((p) => p.id !== id) }));
  },

  enrollEmployee: (enrollment) => {
    const newEn: EmployeeBenefits = {
      ...enrollment,
      id: `en_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('[HR][Benefits] enrollEmployee', { employeeId: enrollment.employeeId, benefitsPackageId: enrollment.benefitsPackageId });
    set((state) => ({ enrollments: [newEn, ...state.enrollments] }));
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
    return updated;
  },

  cancelEnrollment: (id) => {
    console.log('[HR][Benefits] cancelEnrollment', { id });
    set((state) => ({ enrollments: state.enrollments.filter((e) => e.id !== id) }));
  },

  getEnrollmentsByEmployee: (employeeId) => get().enrollments.filter((e) => e.employeeId === employeeId),
  getActiveEnrollments: () => get().enrollments.filter((e) => e.status === 'active'),
  getSummary: () => {
    const activePackages = get().packages.filter((p) => p.isActive).length;
    const activeEnrollments = get().getActiveEnrollments().length;
    const monthlyCost = get().enrollments.reduce((sum, e) => sum + (e.employeeContribution + e.employerContribution), 0);
    return { activePackages, activeEnrollments, monthlyCost };
  }
}));


