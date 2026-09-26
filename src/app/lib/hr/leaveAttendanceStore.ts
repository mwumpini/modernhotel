'use client';

import { create } from 'zustand';
import type { Attendance, LeaveRequest } from './models';
import { useEmployeeStore } from './employeeStore';
import { getClientTenantSubdomain } from '../api/clientTenant';
import { normalizeTenantSubdomain } from '../api/tenantSubdomain';
import { newId } from './newId';
import { useSettingsStore } from '../settings/store';

function hrTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}
function syncLeaveRequestToApi(leave: LeaveRequest) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/leave-requests', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(leave) })
    .catch((e) => console.warn('[HR] Failed to sync leave request to server:', e));
}
// Returns the server's persisted record so callers that need to know the real
// outcome — e.g. whether an overtime approval attempt actually took (it's
// silently downgraded server-side if it needed director sign-off the caller
// doesn't have — see /api/hr/attendance) — can reconcile local state against
// it instead of assuming the optimistic value stuck.
function syncAttendanceToApi(rec: Attendance): Promise<Attendance | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return fetch('/api/hr/attendance', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(rec) })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => data?.attendance ?? null)
    .catch((e) => { console.warn('[HR] Failed to sync attendance to server:', e); return null; });
}
function syncShiftToApi(shift: Shift) {
  if (typeof window === 'undefined') return;
  fetch('/api/hr/shifts', { method: 'POST', headers: hrTenantHeaders(), body: JSON.stringify(shift) })
    .catch((e) => console.warn('[HR] Failed to sync shift to server:', e));
}
function deleteShiftFromApi(id: string) {
  if (typeof window === 'undefined') return;
  fetch(`/api/hr/shifts?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: hrTenantHeaders() })
    .catch((e) => console.warn('[HR] Failed to delete shift on server:', e));
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

  // Overtime
  updateOvertimeHours: (id: string, hours: number) => void;
  approveOvertime: (id: string, approver: string) => Promise<{ approved: boolean }>;
  logManualOvertime: (employeeId: string, date: Date, startTime: Date, endTime: Date, notes?: string) => Attendance;
  getApprovedOvertimeHours: (employeeId: string, periodStart: Date, periodEnd: Date) => number;

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
      id: newId('lr_'),
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
          new Date(r.startDate).getUTCFullYear() === year,
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
    const year = new Date(req.startDate).getUTCFullYear();
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
      id: useSettingsStore.getState().getNextModuleNumber('hr', 'timesheet'),
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
    syncAttendanceToApi(rec);
    return rec;
  },

  clockOut: (employeeId, when = new Date()) => {
    const out = when.getTime();
    const openId = get().attendances.find((a) => a.employeeId === employeeId && !a.checkOutTime)?.id;
    let result: Attendance | null = null;
    set((state) => ({
      attendances: state.attendances.map((a) => {
        if (a.id !== openId) return a;
        const inTs = (a.checkInTime ? new Date(a.checkInTime) : new Date()).getTime();
        const hours = Math.max(0, (out - inTs) / (1000 * 60 * 60));
        const overtime = Math.max(0, hours - 8);
        result = { ...a, checkOutTime: new Date(out), totalHours: hours, overtimeHours: overtime, updatedAt: new Date() } as Attendance;
        return result;
      })
    }));
    console.log('[HR][Time] clockOut', { employeeId, when });
    if (result) syncAttendanceToApi(result);
    return result;
  },

  updateOvertimeHours: (id, hours) => {
    let updated: Attendance | undefined;
    set((state) => ({
      attendances: state.attendances.map((a) => {
        if (a.id !== id) return a;
        // Editing a still-pending amount only — an approved figure is a record of what was
        // actually paid, not something to quietly rewrite after the fact.
        if (a.approvedAt) return a;
        updated = { ...a, overtimeHours: Math.max(0, hours), updatedAt: new Date() };
        return updated;
      })
    }));
    if (updated) syncAttendanceToApi(updated);
  },

  approveOvertime: async (id, approver) => {
    const target = get().attendances.find((a) => a.id === id);
    if (!target) return { approved: false };
    const optimistic: Attendance = { ...target, approvedBy: approver, approvedAt: new Date(), updatedAt: new Date() };
    // The server is authoritative here — an over-threshold request needing
    // director sign-off gets silently downgraded (approvedAt/approvedBy
    // stripped) if this caller lacks hr.approve-overtime, so the local state
    // must reflect what actually got persisted, not the optimistic attempt.
    const persisted = await syncAttendanceToApi(optimistic);
    // The API round-trips dates as JSON strings — rehydrate before merging into
    // store state, matching hydrateFromApi's own date-field conversion below.
    const result = persisted
      ? { ...persisted, date: new Date(persisted.date), checkInTime: persisted.checkInTime ? new Date(persisted.checkInTime) : undefined, checkOutTime: persisted.checkOutTime ? new Date(persisted.checkOutTime) : undefined, approvedAt: persisted.approvedAt ? new Date(persisted.approvedAt) : undefined, createdAt: new Date(persisted.createdAt), updatedAt: new Date(persisted.updatedAt) }
      : target;
    set((state) => ({
      attendances: state.attendances.map((a) => (a.id === id ? result : a)),
    }));
    return { approved: !!result.approvedAt };
  },

  logManualOvertime: (employeeId, date, startTime, endTime, notes) => {
    // Real start/end times, not a self-reported hour count — auditable against a
    // dispute the same way a clock-in/out record is, rather than taking a bare
    // number on trust. Overnight shifts (end past midnight) roll to the next day.
    const end = endTime.getTime() > startTime.getTime() ? endTime : new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
    const hours = Math.max(0, (end.getTime() - startTime.getTime()) / (1000 * 60 * 60));
    const rec: Attendance = {
      id: useSettingsStore.getState().getNextModuleNumber('hr', 'timesheet'),
      employeeId,
      date,
      checkInTime: startTime,
      checkOutTime: end,
      totalHours: hours,
      overtimeHours: hours,
      breakTime: 0,
      status: 'present',
      shift: 'flexible',
      location: '',
      // Manual entries exist precisely for staff the clock-in system never sees, so there's
      // no computed totalHours/overtimeHours split to trust — flagged in notes for the
      // approver rather than silently presented the same as a clock-derived record.
      notes: notes ? `[Manual OT] ${notes}` : '[Manual OT entry]',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Attendance;
    set((state) => ({ attendances: [rec, ...state.attendances] }));
    syncAttendanceToApi(rec);
    return rec;
  },

  getApprovedOvertimeHours: (employeeId, periodStart, periodEnd) => {
    const start = periodStart.getTime();
    const end = periodEnd.getTime();
    return get()
      .attendances.filter((a) => {
        if (a.employeeId !== employeeId || !a.approvedAt) return false;
        const t = new Date(a.date).getTime();
        return t >= start && t <= end;
      })
      .reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
  },

  scheduleShift: (shift) => {
    const s: Shift = { ...shift, id: newId('sh_') };
    console.log('[HR][Shift] schedule', s);
    set((state) => ({ shifts: [s, ...state.shifts] }));
    syncShiftToApi(s);
    return s;
  },

  updateShift: (id, updates) => {
    console.log('[HR][Shift] update', { id, updates });
    let updated: Shift | undefined;
    set((state) => ({
      shifts: state.shifts.map((s) => {
        if (s.id !== id) return s;
        updated = { ...s, ...updates };
        return updated;
      })
    }));
    if (updated) syncShiftToApi(updated);
  },

  deleteShift: (id) => {
    console.log('[HR][Shift] delete', { id });
    set((state) => ({ shifts: state.shifts.filter((s) => s.id !== id) }));
    deleteShiftFromApi(id);
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
    const headers = hrTenantHeaders();
    try {
      const res = await fetch('/api/hr/leave-requests', { headers, cache: 'no-store' });
      if (res.ok) {
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
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate leave requests from server:', e);
    }
    try {
      const res = await fetch('/api/hr/attendance', { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.attendances)) {
          const dateFields = ['date', 'checkInTime', 'checkOutTime', 'approvedAt', 'createdAt', 'updatedAt'];
          const toDates = (row: any) => {
            const out = { ...row };
            for (const f of dateFields) if (out[f]) out[f] = new Date(out[f]);
            return out;
          };
          set({ attendances: data.attendances.map(toDates) });
        }
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate attendance from server:', e);
    }
    try {
      const res = await fetch('/api/hr/shifts', { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.shifts)) {
          set({ shifts: data.shifts });
        }
      }
    } catch (e) {
      console.warn('[HR] Failed to hydrate shifts from server:', e);
    }
  },
}));


