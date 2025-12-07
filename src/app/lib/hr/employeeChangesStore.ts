'use client';

import { create } from 'zustand';

export type EmployeeChangeType =
  | 'promotion'
  | 'transfer'
  | 'salary_change'
  | 'status_change'
  | 'department_change'
  | 'position_change'
  | 'profile_update';

export interface EmployeeChange {
  id: string;
  employeeId: string;
  employeeName?: string;
  type: EmployeeChangeType;
  field?: string;
  previousValue?: string | number | null;
  newValue?: string | number | null;
  changedBy?: string;
  notes?: string;
  timestamp: Date;
}

interface EmployeeChangesState {
  changes: EmployeeChange[];

  logChange: (change: Omit<EmployeeChange, 'id'>) => EmployeeChange;
  getRecentChanges: (days?: number) => EmployeeChange[];
  getChangesByEmployee: (employeeId: string) => EmployeeChange[];
  clearChanges: () => void;
}

export const useEmployeeChangesStore = create<EmployeeChangesState>((set, get) => ({
  changes: [],

  logChange: (change) => {
    const entry: EmployeeChange = { ...change, id: `chg_${Date.now()}` };
    console.log('[HR][ChangeLog] logChange', entry);
    set((state) => ({ changes: [entry, ...state.changes] }));
    return entry;
  },

  getRecentChanges: (days = 30) => {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    return get().changes.filter((c) => c.timestamp.getTime() >= since);
  },

  getChangesByEmployee: (employeeId) => get().changes.filter((c) => c.employeeId === employeeId),

  clearChanges: () => set({ changes: [] })
}));


