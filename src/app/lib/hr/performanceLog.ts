import { addDays, dayKey, todayKey } from './leaveDates';

export type LogCategory = 'guest_service' | 'punctuality' | 'teamwork' | 'hygiene_safety' | 'cash_handling' | 'conduct' | 'initiative' | 'other';

export const LOG_CATEGORIES: Record<LogCategory, string> = {
  guest_service: 'Guest service',
  punctuality: 'Punctuality & attendance',
  teamwork: 'Teamwork',
  hygiene_safety: 'Hygiene & safety',
  cash_handling: 'Cash handling',
  conduct: 'Conduct',
  initiative: 'Initiative',
  other: 'Other',
};
export const categoryLabel = (c: string) => LOG_CATEGORIES[c as LogCategory] || c;

/** -5..-1 for concerns, 1..5 for commendations. There is deliberately no 0. */
export const SCORES = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];
export const SCORE_GUIDE = '±1 minor · ±3 notable · ±5 exceptional or serious';
export const fmtScore = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export interface PerformanceLogEntry {
  id: string;
  employeeId: string;
  /** When it happened. */
  date: Date;
  score: number;
  category: LogCategory | string;
  note: string;
  attachments: string[];
  recordedById?: string;
  recordedByName?: string;
  employeeResponse?: string;
  respondedAt?: Date;
  status: 'active' | 'voided';
  voidedReason?: string;
  voidedBy?: string;
  voidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogSummary {
  /** Sum of scores. Only meaningful over a window, never as a lifetime total. */
  net: number;
  positives: number;
  negatives: number;
  count: number;
}

/** Counts only active (non-voided) entries dated within [fromKey, toKey] (YYYY-MM-DD, inclusive). */
export function summarize(entries: PerformanceLogEntry[], fromKey?: string, toKey?: string): LogSummary {
  const inRange = entries.filter((e) => e.status === 'active' && (!fromKey || dayKey(e.date) >= fromKey) && (!toKey || dayKey(e.date) <= toKey));
  return {
    net: inRange.reduce((s, e) => s + e.score, 0),
    positives: inRange.filter((e) => e.score > 0).length,
    negatives: inRange.filter((e) => e.score < 0).length,
    count: inRange.length,
  };
}

export const lastDaysFrom = (days: number, now = new Date()) => addDays(todayKey(now), -(days - 1));

/** A review period like "2026-Q3" as a date range; anything else falls back to the 90 days
 * before `fallbackEnd`. */
export function reviewPeriodRange(period: string, fallbackEnd: string): { from: string; to: string } {
  const m = /^(\d{4})-Q([1-4])$/i.exec(period.trim());
  if (m) {
    const y = Number(m[1]);
    const q = Number(m[2]);
    const from = `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
    const end = new Date(Date.UTC(y, q * 3, 0));
    return { from, to: end.toISOString().slice(0, 10) };
  }
  return { from: addDays(fallbackEnd, -89), to: fallbackEnd };
}
