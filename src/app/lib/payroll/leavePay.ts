import { useLeaveAttendanceStore } from '../hr/leaveAttendanceStore';
import { addDays, isPublicHoliday, leaveOn } from '../hr/leaveDates';
import type { LeaveRequest } from '../hr/models';

export interface MonthPayDays {
  /** Weekdays in the month, excluding Ghana public holidays. */
  payableDays: number;
  /** Payable days covered by approved unpaid leave. */
  leaveDays: number;
  /** Payable days left after that leave. */
  workedDays: number;
}

type LeaveSpan = Pick<LeaveRequest, 'employeeId' | 'status' | 'startDate' | 'endDate' | 'leaveType'>;

/** Monday–Friday dates in a calendar month, skipping observed public holidays. Month is 1–12. */
export function payableDayKeys(year: number, month: number): string[] {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  const days: string[] = [];
  for (let d = start, i = 0; d <= end && i < 40; d = addDays(d, 1), i++) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6 || isPublicHoliday(d)) continue;
    days.push(d);
  }
  return days;
}

/** Approved unpaid leave only: annual, sick, maternity and the other types are paid (Labour Act). Pending requests do not reduce the month. A day covered by two requests counts once. */
export function monthPayDays(requests: LeaveSpan[], employeeId: string, year: number, month: number): MonthPayDays {
  const payable = payableDayKeys(year, month);
  const unpaid = requests.filter((r) => r.leaveType === 'unpaid');
  const leaveDays = payable.filter((day) => leaveOn(unpaid as LeaveRequest[], employeeId, day)).length;
  return {
    payableDays: payable.length,
    leaveDays,
    workedDays: Math.max(0, payable.length - leaveDays),
  };
}

/** Contractual monthly basic, paid for the days still worked. Overtime keeps the full-salary hourly rate. */
export function basicAfterLeave(contractualBasic: number, days: MonthPayDays) {
  const basic = Number(contractualBasic || 0);
  if (days.payableDays <= 0 || days.leaveDays <= 0) return Math.round(basic * 100) / 100;
  return Math.round((basic * days.workedDays / days.payableDays) * 100) / 100;
}

export function payDaysForEmployee(employeeId: string, year: number, month: number) {
  return monthPayDays(useLeaveAttendanceStore.getState().leaveRequests, employeeId, year, month);
}

export function readPayDays(notes?: string): MonthPayDays | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    const payableDays = Number(parsed?.payableDays);
    const workedDays = Number(parsed?.workedDays);
    const leaveDays = Number(parsed?.leaveDays);
    if (!Number.isFinite(payableDays) || !Number.isFinite(workedDays)) return null;
    return { payableDays, leaveDays: Number.isFinite(leaveDays) ? leaveDays : 0, workedDays };
  } catch {
    return null;
  }
}
