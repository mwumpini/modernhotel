'use client';

import { create } from 'zustand';
import type { Attendance, LeaveRequest } from './models';

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
  approveLeave: (id: string, approver: string) => void;
  rejectLeave: (id: string, approver: string, reason?: string) => void;

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
    return newReq;
  },

  approveLeave: (id, approver) => {
    console.log('[HR][Leave] approve', { id, approver });
    set((state) => ({
      leaveRequests: state.leaveRequests.map((r) => r.id === id ? { ...r, status: 'approved', approvedBy: approver, approvedAt: new Date(), updatedAt: new Date() } : r)
    }));
  },

  rejectLeave: (id, approver, reason) => {
    console.log('[HR][Leave] reject', { id, approver, reason });
    set((state) => ({
      leaveRequests: state.leaveRequests.map((r) => r.id === id ? { ...r, status: 'rejected', approvedBy: approver, approvedAt: new Date(), rejectionReason: reason, updatedAt: new Date() } : r)
    }));
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
}));


