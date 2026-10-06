/**
 * Each company's accounting year repeats from the month and day saved as
 * financialYearStartDate. 1 January runs to 31 December. 1 April runs to 31 March.
 * A year is named by the calendar year in which it ends ("year ended 31 March 2027").
 */

export type FinancialYear = {
  start: Date;
  end: Date;
  /** Calendar year of `end`. */
  endingYear: number;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateOn(year: number, month: number, day: number): Date {
  const last = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, last));
}

export function addDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth(), 1);
  next.setMonth(next.getMonth() + months);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return next;
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Month and day the books open each year. Missing or invalid values use 1 January. */
export function financialYearAnchor(yearStartIso?: string | null): { month: number; day: number } {
  const match = String(yearStartIso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { month: 1, day: 1 };
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return { month: 1, day: 1 };
  return { month, day };
}

/** The financial year whose end falls in `endingYear`. */
export function financialYearEnding(endingYear: number, yearStartIso?: string | null): FinancialYear {
  const anchor = financialYearAnchor(yearStartIso);
  const closeOn = anchor.month === 1 && anchor.day === 1
    ? dateOn(endingYear + 1, 1, 1)
    : dateOn(endingYear, anchor.month, anchor.day);
  const end = addDays(closeOn, -1);
  const start = dateOn(closeOn.getFullYear() - 1, anchor.month, anchor.day);
  return { start, end, endingYear: end.getFullYear() };
}

/**
 * The year an accountant would close today.
 * On the last day of the year, that is the year now ending. On any earlier day, it is the year that already finished.
 */
export function yearReadyToClose(date: Date, yearStartIso?: string | null): FinancialYear {
  const open = financialYearContaining(date, yearStartIso);
  if (startOfDay(date).getTime() >= startOfDay(open.end).getTime()) return open;
  return financialYearEnding(open.endingYear - 1, yearStartIso);
}

/** The financial year that contains `date`. */
export function financialYearContaining(date: Date, yearStartIso?: string | null): FinancialYear {
  const anchor = financialYearAnchor(yearStartIso);
  const day = startOfDay(date);
  let start = dateOn(day.getFullYear(), anchor.month, anchor.day);
  if (start.getTime() > day.getTime()) {
    start = dateOn(day.getFullYear() - 1, anchor.month, anchor.day);
  }
  const next = dateOn(start.getFullYear() + 1, anchor.month, anchor.day);
  const end = addDays(next, -1);
  return { start, end, endingYear: end.getFullYear() };
}

export function quarterOfFinancialYear(
  endingYear: number,
  quarter: number,
  yearStartIso?: string | null,
): { start: Date; end: Date } {
  const q = Math.min(4, Math.max(1, quarter));
  const year = financialYearEnding(endingYear, yearStartIso);
  const start = addMonths(year.start, (q - 1) * 3);
  const end = addDays(addMonths(year.start, q * 3), -1);
  return { start, end };
}

export function financialQuarterIndex(date: Date, yearStartIso?: string | null): number {
  const year = financialYearContaining(date, yearStartIso);
  const day = startOfDay(date).getTime();
  for (let quarter = 1; quarter <= 4; quarter += 1) {
    const range = quarterOfFinancialYear(year.endingYear, quarter, yearStartIso);
    if (day >= startOfDay(range.start).getTime() && day <= startOfDay(range.end).getTime()) return quarter;
  }
  return 1;
}

export function formatDayMonth(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export function formatDayMonthYear(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "1 April to 31 March" */
export function financialYearCycleLabel(yearStartIso?: string | null): string {
  const year = financialYearEnding(2026, yearStartIso);
  return `${formatDayMonth(year.start)} to ${formatDayMonth(year.end)}`;
}

export function financialYearEndedLabel(end: Date): string {
  return `Year ended ${formatDayMonthYear(end)}`;
}
