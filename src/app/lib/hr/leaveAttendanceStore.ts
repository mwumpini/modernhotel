'use client';

import { create } from 'zustand';
import type { Attendance, LeaveRequest } from './models';
import { useEmployeeStore } from './employeeStore';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}
function syncLeaveRequestToApi(leave: LeaveRequest) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/leave-requests', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(leave) })
    .catch((e) => console.warn('[HR] Failed to sync leave request to server:', e));
}

/** Annual leave-day entitlement per type, used when an employee has no override
 * in Employee.leaveEntitlements. Annual is Ghana's Labour Act 2003 minimum (15
 * working days) rounded up to a common 21-day policy; others are reasonable defaults. */
export const DEFAULT_LEAVE_ENTITLEMENTS: Record<LeaveRequest['leaveType'], number> = {
  annual: 21,
  sick: 10,
  personal: 5,
  maternity: 84,
  paternity: 7,
  bereavement: 5,
  other: 0,
};

export interface LeaveBalance {
  entitlement: number;
  used: number;
  remaining: number;
}

export interface Shift {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location?: string;
  notes?: string;
}

interface LeaveAttendanceState {
  leaveRequests: LeaveRequest[];
  attendances: Attendance[];
  shifts: Shift[];

  // Leave
  requestLeave: (req: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'requestedAt'> & { status?: LeaveRequest['status'] }) => LeaveRequest;
  approveLeave: (id: string, approver: string) => { success: boolean; error?: string };
  rejectLeave: (id: string, approver: string, reason?: string) => void;
  getLeaveBalance: (employeeId: string, leaveType: LeaveRequest['leaveType'], year: number) => LeaveBalance;
  hydrateFromApi: () => Promise<void>;

  // Time tracking
  clockIn: (employeeId: string, date?: Date, when?: Date, notes?: string) => Attendance;
  clockOut: (employeeId: string, when?: Date) => Attendance | null;

  // Shifts
  scheduleShift: (shift: Omit<Shift, 'id'>) => Shift;
  updateShift: (id: string, updates: Partial<Shift>) => void;
  deleteShift: (id: string) => void;

  // Queries / counts
  getPendingLeaveCount: () => number;
  getActiveEmployeesOnClock: () => number;
  getUpcomingShiftCount: () => number;
  getOpenOvertimeCount: () => number;
}

export const useLeaveAttendanceStore = create<LeaveAttendanceState>((set, get) => ({
  leaveRequests: [],
  attendances: [],
  shifts: [],

  requestLeave: (req) => {
    const newReq: LeaveRequest = {
      ...req,
      id: `lr_${Date.now()}`,
      status: req.status || 'pending',
      requestedBy: req.requestedBy || req.employeeId,
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LeaveRequest;
    console.log('[HR][Leave] request', { employeeId: newReq.employeeId, type: newReq.leaveType });
    set((state) => ({ leaveRequests: [newReq, ...state.leaveRequests] }));
    syncLeaveRequestToApi(newReq);
    return newReq;
  },

  getLeaveBalance: (employeeId, leaveType, year) => {
    const employee = useEmployeeStore.getState().employees.find((e: any) => e.id === employeeId);
    const entitlement = employee?.leaveEntitlements?.[leaveType] ?? DEFAULT_LEAVE_ENTITLEMENTS[leaveType];
    const used = get()
      .leaveRequests.filter(
        (r) =>
          r.employeeId === employeeId &&
          r.leaveType === leaveType &&
          r.status === 'approved' &&
          new Date(r.startDate).getFullYear() === year,
      )
      .reduce((sum, r) => sum + (r.totalDays || 0), 0);
    return { entitlement, used, remaining: Math.max(0, entitlement - used) };
  },

  approveLeave: (id, approver) => {
    const req = get().leaveRequests.find((r) => r.id === id);
    if (!req) return { success: false, error: 'Leave request not found' };
    if (req.status !== 'pending') {
      return { success: false, error: `Cannot approve a request that is already ${req.status}` };
    }

    // 'other'-type leave has no default entitlement to check against (0 by default,
    // meaning unlimited/untracked unless the employee has an explicit override) — only
    // enforce a balance check for types with a real entitlement.
    const year = new Date(req.startDate).getFullYear();
    const balance = get().getLeaveBalance(req.employeeId, req.leaveType, year);
    if (balance.entitlement > 0 && req.totalDays > balance.remaining) {
      return {
        success: false,
        error: `Insufficient ${req.leaveType} leave balance: requesting ${req.totalDays} day(s), only ${balance.remaining} remaining (entitlement ${balance.entitlement}, already used ${balance.used} this year).`,
      };
    }

    console.log('[HR][Leave] approve', { id, approver });
    let updated: LeaveRequest | undefined;
    set((state) => ({
      leaveRequests: state.leaveRequests.map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, status: 'approved', approvedBy: approver, approvedAt: new Date(), updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncLeaveRequestToApi(updated);
    return { success: true };
  },

  rejectLeave: (id, approver, reason) => {
    console.log('[HR][Leave] reject', { id, approver, reason });
    let updated: LeaveRequest | undefined;
    set((state) => ({
      leaveRequests: state.leaveRequests.map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, status: 'rejected', approvedBy: approver, approvedAt: new Date(), rejectionReason: reason, updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncLeaveRequestToApi(updated);
  },

  clockIn: (employeeId, date = new Date(), when = new Date(), notes) => {
    const rec: Attendance = {
      id: `att_${Date.now()}`,
      employeeId,
      date,
      checkInTime: when,
      totalHours: 0,
      overtimeHours: 0,
      breakTime: 0,
      status: 'present',
      shift: 'flexible',
      location: '',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Attendance;
    console.log('[HR][Time] clockIn', { employeeId, when });
    set((state) => ({ attendances: [rec, ...state.attendances] }));
    return rec;
  },

  clockOut: (employeeId, when = new Date()) => {
    const out = when.getTime();
    let result: Attendance | null = null;
    set((state) => ({
      attendances: state.attendances.map((a) => {
        if (a.employeeId === employeeId && !a.checkOutTime && new Date(a.date).toDateString() === new Date().toDateString()) {
          const inTs = (a.checkInTime ? new Date(a.checkInTime) : new Date()).getTime();
          const hours = Math.max(0, (out - inTs) / (1000 * 60 * 60));
          const overtime = Math.max(0, hours - 8);
          result = { ...a, checkOutTime: new Date(out), totalHours: hours, overtimeHours: overtime, updatedAt: new Date() } as Attendance;
          return result;
        }
        return a;
      })
    }));
    console.log('[HR][Time] clockOut', { employeeId, when });
    return result;
  },

  scheduleShift: (shift) => {
    const s: Shift = { ...shift, id: `sh_${Date.now()}` };
    console.log('[HR][Shift] schedule', s);
    set((state) => ({ shifts: [s, ...state.shifts] }));
    return s;
  },

  updateShift: (id, updates) => {
    console.log('[HR][Shift] update', { id, updates });
    set((state) => ({ shifts: state.shifts.map((s) => (s.id === id ? { ...s, ...updates } : s)) }));
  },

  deleteShift: (id) => {
    console.log('[HR][Shift] delete', { id });
    set((state) => ({ shifts: state.shifts.filter((s) => s.id !== id) }));
  },

  getPendingLeaveCount: () => get().leaveRequests.filter((r) => r.status === 'pending').length,
  getActiveEmployeesOnClock: () => get().attendances.filter((a) => a.checkInTime && !a.checkOutTime).length,
  getUpcomingShiftCount: () => {
    const today = new Date();
    return get().shifts.filter((s) => new Date(s.date) >= today).length;
  },
  getOpenOvertimeCount: () => get().attendances.filter((a) => (a.overtimeHours || 0) > 0).length,

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/hr/leave-requests', { headers: hrTenantHeaders(), cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.leaveRequests)) {
        const dateFields = ['startDate', 'endDate', 'requestedAt', 'approvedAt', 'createdAt', 'updatedAt'];
        const toDates = (row: any) => {
          const out = { ...row };
          for (const f of dateFields) if (out[f]) out[f] = new Date(out[f]);
          return out;
        };
        set({ leaveRequests: data.leaveRequests.map(toDates) });
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate leave requests from server:', e);
    }
  },
}));


