import { useSettingsStore } from './store';
import { DEFAULT_PROPERTY_TIMEZONE } from '../frontoffice/propertyTime';

/** Date layouts a hotel can choose in Company Profile. The key is what gets stored. */
export const DATE_FORMATS = [
  { key: 'DD/MM/YYYY', label: '15/10/2026' },
  { key: 'DD-MMM-YYYY', label: '15-Oct-2026' },
  { key: 'DD MMM YYYY', label: '15 Oct 2026' },
  { key: 'YYYY-MM-DD', label: '2026-10-15' },
  { key: 'MM/DD/YYYY', label: '10/15/2026' },
] as const;

export const TIME_FORMATS = [
  { key: 'HH:mm', label: '14:30 (24-hour)' },
  { key: 'hh:mm A', label: '2:30 PM (12-hour)' },
] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The hotel's own date layout, time layout, and timezone, as Company Profile saved them. */
export function hotelDateSettings(): { dateFormat: string; timeFormat: string; timezone: string } {
  try {
    const s = useSettingsStore.getState();
    const local = s.countryCompliance?.[s.defaultCountry || 'GH']?.localization;
    return {
      dateFormat: local?.dateFormat || 'DD/MM/YYYY',
      timeFormat: local?.timeFormat || 'HH:mm',
      timezone: s.tenant?.metadata?.timezone || DEFAULT_PROPERTY_TIMEZONE,
    };
  } catch {
    return { dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', timezone: DEFAULT_PROPERTY_TIMEZONE };
  }
}

/** Year, month and day of a moment as the hotel sees it. A plain YYYY-MM-DD stays that calendar day. */
function dayParts(value: string | number | Date, timezone: string): { y: number; m: number; d: number } | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return { y, m, d };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return { y: get('year'), m: get('month'), d: get('day') };
  } catch {
    return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
  }
}

/** A date written the way this hotel chose (Settings → Company Profile). Empty for a missing or bad date. */
export function formatHotelDate(value: string | number | Date | null | undefined, format?: string): string {
  if (value == null || value === '') return '';
  const { dateFormat, timezone } = hotelDateSettings();
  const p = dayParts(value, timezone);
  if (!p) return '';
  const dd = String(p.d).padStart(2, '0');
  const mm = String(p.m).padStart(2, '0');
  const mon = MONTHS[p.m - 1] || mm;
  switch (format || dateFormat) {
    case 'MM/DD/YYYY': return `${mm}/${dd}/${p.y}`;
    case 'YYYY-MM-DD': return `${p.y}-${mm}-${dd}`;
    case 'DD-MMM-YYYY': return `${dd}-${mon}-${p.y}`;
    case 'DD MMM YYYY': return `${dd} ${mon} ${p.y}`;
    default: return `${dd}/${mm}/${p.y}`;
  }
}

/** A time of day in the hotel's timezone and chosen 12- or 24-hour layout. */
export function formatHotelTime(value: string | number | Date | null | undefined, format?: string): string {
  if (value == null || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const { timeFormat, timezone } = hotelDateSettings();
  const hour12 = (format || timeFormat).includes('A');
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12 }).format(date).toUpperCase();
  } catch {
    return date.toTimeString().slice(0, 5);
  }
}
