/**
 * Property clock helpers — use hotel timezone (Settings → tenant metadata), not browser locale.
 */

export const DEFAULT_PROPERTY_TIMEZONE = 'Africa/Accra';

export type PropertyClock = {
  date: string;
  hour: number;
  minute: number;
  timeZone: string;
};

/** Wall-clock parts in a given IANA timezone. */
export function getZonedClockParts(now: Date, timeZone: string): PropertyClock {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '0';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    timeZone,
  };
}

/** Format for scheduler logs, e.g. 2025-12-31 1:00am */
export function formatPropertyClockStamp(now: Date, timeZone: string): string {
  const { date, hour, minute } = getZonedClockParts(now, timeZone);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 || 12;
  return `${date} ${h12}:${minute.toString().padStart(2, '0')}${ampm}`;
}
