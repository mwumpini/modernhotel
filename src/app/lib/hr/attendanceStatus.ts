import type { Shift } from './leaveAttendanceStore';

/** Minutes after a shift's start time before a clock-in counts as late. */
export const LATE_GRACE_MINUTES = 10;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** The earliest shift the employee is rostered for on `day` (YYYY-MM-DD). */
export function shiftOn(shifts: Shift[], employeeId: string, day: string): Shift | undefined {
  return shifts
    .filter((s) => s.employeeId === employeeId && s.date === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
}

/** True once `nowMinutes` is past the shift start plus the grace period. */
export function pastGrace(shift: Shift, nowMinutes: number) {
  return nowMinutes > toMinutes(shift.startTime) + LATE_GRACE_MINUTES;
}

/** A clock-in is late when it lands after the rostered start plus the grace period.
 * Staff with no rostered shift that day can't be late. */
export function isLate(checkIn: Date | string | undefined, shift: Shift | undefined) {
  if (!checkIn || !shift) return false;
  return pastGrace(shift, minutesOfDay(new Date(checkIn)));
}
