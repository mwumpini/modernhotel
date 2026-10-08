/**
 * Calendar-day rules for the Operational Policies "Allow backdating" switch.
 * Missing or false means a posting date cannot be earlier than today.
 */

import { localDay } from './operationalPolicies';

export const BACKDATE_MESSAGE =
  'Backdating is off. Use today, or ask a manager to allow backdating in Operational Policies.';

export function businessToday(now = new Date()): string {
  return localDay(now);
}

/** YYYY-MM-DD for a date-only string or a Date saved from one. Empty when it is not a date. */
export function calendarDay(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${value.getUTCFullYear()}-${month}-${day}`;
  }
  const match = String(value ?? '').trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

export function isPastBusinessDate(value: unknown, today = businessToday()): boolean {
  const day = calendarDay(value);
  if (!day) return false;
  return day < today;
}

export function postingDateError(
  value: unknown,
  allowBackdating: boolean,
  today = businessToday(),
): string | null {
  if (allowBackdating) return null;
  if (!isPastBusinessDate(value, today)) return null;
  return BACKDATE_MESSAGE;
}

export function postingDateMin(allowBackdating: boolean, today = businessToday()): string | undefined {
  return allowBackdating ? undefined : today;
}

/**
 * Postings typed in by a person: the Receivable, Payable and Journal forms mark them
 * "manual…". Every system posting (checkout, restaurant, night-audit catch-up, payroll,
 * reversals…) names its own module and is never locked.
 */
export function isManualPosting(sourceModule: unknown): boolean {
  return String(sourceModule ?? '').trim().startsWith('manual');
}
