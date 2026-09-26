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

/** Leave types whose entitlement is working days (Mon–Fri). Sick and maternity are calendar days. */
const WORKING_DAY_LEAVE = new Set(['annual', 'personal', 'paternity', 'bereavement']);

/** Gregorian Easter Sunday, YYYY-MM-DD. */
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function firstFridayOfDecember(year: number) {
  let day = `${year}-12-01`;
  for (let i = 0; i < 7; i++) {
    if (new Date(`${day}T00:00:00Z`).getUTCDay() === 5) return day;
    day = addDays(day, 1);
  }
  return day;
}

/** Public Holidays Act as amended in 2025: weekend holidays move to Monday,
 * Tuesday–Thursday holidays move to Friday. Only the observed day is a day off. */
function observedDay(day: string) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  if (dow === 6) return addDays(day, 2);
  if (dow === 0) return addDays(day, 1);
  if (dow === 2) return addDays(day, 3);
  if (dow === 3) return addDays(day, 2);
  if (dow === 4) return addDays(day, 1);
  return day;
}

const holidayCache = new Map<number, Set<string>>();

/** Observed Ghana public holidays for a year. Eid-ul-Fitr, Shaqq Day and Eid-ul-Adha
 * are set by the Chief Imam during the year, so they are not guessed here. */
export function publicHolidays(year: number) {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const named = [
    `${year}-01-01`,
    `${year}-01-07`,
    `${year}-03-06`,
    addDays(easter, -2),
    addDays(easter, 1),
    `${year}-05-01`,
    `${year}-07-01`,
    `${year}-09-21`,
    firstFridayOfDecember(year),
    `${year}-12-25`,
    `${year}-12-26`,
  ];
  const observed = new Set(named.map(observedDay));
  holidayCache.set(year, observed);
  return observed;
}

export function isPublicHoliday(day: string) {
  const year = Number(day.slice(0, 4));
  if (!Number.isFinite(year)) return false;
  return publicHolidays(year).has(day);
}

/** Inclusive day count between two YYYY-MM-DD dates. Working-day types skip weekends and public holidays. */
export function countLeaveDays(start: string, end: string, leaveType: string) {
  if (!start || !end || end < start) return 0;
  const workingOnly = WORKING_DAY_LEAVE.has(leaveType);
  let days = 0;
  for (let d = start, i = 0; d <= end && i < 400; d = addDays(d, 1), i++) {
    if (!workingOnly) {
      days += 1;
      continue;
    }
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6 || isPublicHoliday(d)) continue;
    days += 1;
  }
  return days;
}
