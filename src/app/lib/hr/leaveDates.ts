import type { LeaveRequest } from './models';

/** YYYY-MM-DD of a stored date. Leave/shift dates are saved as UTC midnight of the chosen day,
 * so read them back in UTC — local-time parts would shift the day in timezones behind UTC. */
export const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** Today's calendar date in the user's own timezone, as YYYY-MM-DD. */
export function todayKey(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The leave request (if any) that has this employee off on `day` (YYYY-MM-DD). */
export function leaveOn(
  requests: LeaveRequest[],
  employeeId: string,
  day: string,
  statuses: LeaveRequest['status'][] = ['approved'],
): LeaveRequest | undefined {
  return requests.find(
    (r) => r.employeeId === employeeId && statuses.includes(r.status) && dayKey(r.startDate) <= day && day <= dayKey(r.endDate),
  );
}

/** Monday of the week containing `day`, as YYYY-MM-DD. */
export function weekStart(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
