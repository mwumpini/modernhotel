/**
 * Due-date helpers for compliance filing schedules.
 * Rules come from seed-reports.json `dueRule`; legacy rules use `dueDay` only.
 */

export type DueRule =
  | { type: 'dayOfFollowingMonth'; day: number }
  | { type: 'lastWorkingDayOfNextMonth' }
  | { type: 'daysAfterPeriodEnd'; days: number }
  | { type: 'fixedCalendarDates'; dates: string[] }
  | { type: 'quarterEndOfAccountingYear' }
  | { type: 'monthsAfterYearEnd'; months: number };

export type FilingScheduleInput = {
  frequency: string;
  dueDay?: number;
  dueRule?: DueRule;
};

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function lastWorkingDayOfMonth(year: number, month: number): Date {
  const d = new Date(year, month + 1, 0);
  while (isWeekend(d)) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function nextFixedCalendarDate(dates: string[], from: Date): Date {
  const year = from.getFullYear();
  const candidates: Date[] = [];
  for (const y of [year, year + 1]) {
    for (const md of dates) {
      const [m, day] = md.split('-').map(Number);
      candidates.push(new Date(y, m - 1, day));
    }
  }
  const future = candidates.filter((c) => c.getTime() > from.getTime()).sort((a, b) => a.getTime() - b.getTime());
  return future[0] ?? candidates[candidates.length - 1];
}

function nextQuarterEnd(from: Date): Date {
  const quarterEnds = [2, 5, 8, 11];
  for (const endMonth of quarterEnds) {
    const candidate = new Date(from.getFullYear(), endMonth + 1, 0);
    if (candidate > from) return candidate;
  }
  return new Date(from.getFullYear() + 1, 2, 31);
}

export function getNextDueDateForSchedule(input: FilingScheduleInput, from: Date = new Date()): Date {
  const rule = input.dueRule;
  const freq = input.frequency;

  if (rule?.type === 'lastWorkingDayOfNextMonth') {
    const nextMonth = from.getMonth() + 1;
    const year = nextMonth > 11 ? from.getFullYear() + 1 : from.getFullYear();
    const month = nextMonth % 12;
    return lastWorkingDayOfMonth(year, month);
  }

  if (rule?.type === 'dayOfFollowingMonth') {
    const day = rule.day;
    const next = new Date(from.getFullYear(), from.getMonth() + 1, day);
    if (next <= from) next.setMonth(next.getMonth() + 1);
    return next;
  }

  if (rule?.type === 'daysAfterPeriodEnd') {
    const periodEnd = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    const due = new Date(periodEnd);
    due.setDate(due.getDate() + rule.days);
    if (due <= from) {
      const nextEnd = new Date(from.getFullYear(), from.getMonth() + 2, 0);
      const nextDue = new Date(nextEnd);
      nextDue.setDate(nextDue.getDate() + rule.days);
      return nextDue;
    }
    return due;
  }

  if (rule?.type === 'fixedCalendarDates') {
    return nextFixedCalendarDate(rule.dates, from);
  }

  if (rule?.type === 'quarterEndOfAccountingYear') {
    return nextQuarterEnd(from);
  }

  if (rule?.type === 'monthsAfterYearEnd') {
    const yearEnd = new Date(from.getFullYear(), 11, 31);
    let due = new Date(yearEnd);
    due.setMonth(due.getMonth() + rule.months);
    if (due <= from) {
      due = new Date(from.getFullYear() + 1, 11, 31);
      due.setMonth(due.getMonth() + rule.months);
    }
    return due;
  }

  const dueDay = input.dueDay ?? 15;
  const nextDue = new Date(from);
  switch (freq) {
    case 'Monthly':
      nextDue.setDate(dueDay);
      if (nextDue <= from) nextDue.setMonth(nextDue.getMonth() + 1);
      break;
    case 'Quarterly': {
      const quarter = Math.floor(from.getMonth() / 3);
      nextDue.setMonth(quarter * 3 + 2, dueDay);
      if (nextDue <= from) nextDue.setMonth(nextDue.getMonth() + 3);
      break;
    }
    case 'Annually':
      nextDue.setMonth(11, dueDay);
      if (nextDue <= from) nextDue.setFullYear(nextDue.getFullYear() + 1);
      break;
    default:
      nextDue.setDate(dueDay);
      if (nextDue <= from) nextDue.setMonth(nextDue.getMonth() + 1);
  }
  return nextDue;
}

export function getDaysUntilDueForSchedule(input: FilingScheduleInput, from: Date = new Date()): number {
  const next = getNextDueDateForSchedule(input, from);
  return Math.ceil((next.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDueDateForSchedule(input: FilingScheduleInput, from: Date = new Date()): string {
  return getNextDueDateForSchedule(input, from).toLocaleDateString();
}

export function dueDateLabel(input: FilingScheduleInput): string {
  const rule = input.dueRule;
  if (rule?.type === 'lastWorkingDayOfNextMonth') return 'Last working day of next month';
  if (rule?.type === 'dayOfFollowingMonth') return `${rule.day}th of following month`;
  if (rule?.type === 'daysAfterPeriodEnd') return `${rule.days} days after period end`;
  if (rule?.type === 'fixedCalendarDates') return `Quarter dates: ${rule.dates.join(', ')}`;
  if (rule?.type === 'quarterEndOfAccountingYear') return 'End of each accounting quarter';
  if (rule?.type === 'monthsAfterYearEnd') return `${rule.months} months after year end`;
  if (input.dueDay) return `Day ${input.dueDay} (${input.frequency})`;
  return input.frequency;
}
