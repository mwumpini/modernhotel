/**
 * Allowance for doubtful debts (IFRS 9, simplified approach for trade receivables).
 * Pure: no store, no database.
 *
 * Each open receivable is put in an age band by days past its due date, and the business's
 * percentage for that band is the share not expected to be collected. The allowance account
 * (1290, a minus on receivables) is moved to that total by posting only the change. A debt
 * that is truly lost is written off against the allowance first; anything beyond it is
 * expensed. Money later received on a written-off debt is a recovery that reduces the expense.
 */

export const GL_DOUBTFUL_DEBTS = '1290';
export const GL_BAD_DEBT_EXPENSE = '5685';
export const GL_RECEIVABLES = '1210';

/** Days past due up to (and including) `upToDays`; `null` = everything older. */
export type BadDebtBand = { upToDays: number | null; percent: number };

export const DEFAULT_BAD_DEBT_BANDS: BadDebtBand[] = [
  { upToDays: 30, percent: 1 },
  { upToDays: 60, percent: 5 },
  { upToDays: 90, percent: 15 },
  { upToDays: 180, percent: 40 },
  { upToDays: null, percent: 100 },
];

export type OpenReceivable = { id: string; open: number; dueDate?: string | Date; date?: string | Date };

export type AllowanceBandLine = { label: string; balance: number; percent: number; allowance: number; count: number };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Bands in order, the last one open-ended; unusable rows are dropped. */
export function normaliseBands(bands: BadDebtBand[] | undefined): BadDebtBand[] {
  const rows = (Array.isArray(bands) && bands.length ? bands : DEFAULT_BAD_DEBT_BANDS)
    .map((b) => ({
      upToDays: b.upToDays == null || !Number.isFinite(Number(b.upToDays)) ? null : Math.max(0, Math.round(Number(b.upToDays))),
      percent: Math.max(0, Math.min(100, Number(b.percent) || 0)),
    }));
  const bounded = rows.filter((b) => b.upToDays != null).sort((a, b) => (a.upToDays as number) - (b.upToDays as number));
  const unique = bounded.filter((b, i) => i === 0 || b.upToDays !== bounded[i - 1].upToDays);
  const last = rows.find((b) => b.upToDays == null) || { upToDays: null, percent: 100 };
  return [...unique, last];
}

export function bandLabel(bands: BadDebtBand[], i: number): string {
  const prev = i === 0 ? null : bands[i - 1].upToDays;
  const up = bands[i].upToDays;
  if (up == null) return `Over ${prev ?? 0} days`;
  if (prev == null) return `Up to ${up} days`;
  return `${prev + 1}–${up} days`;
}

/** The allowance each band needs today. Debts not yet due count in the first band. */
export function computeRequiredAllowance(receivables: OpenReceivable[], bandsIn: BadDebtBand[] | undefined, asOf: Date = new Date()) {
  const bands = normaliseBands(bandsIn);
  const lines: AllowanceBandLine[] = bands.map((b, i) => ({ label: bandLabel(bands, i), balance: 0, percent: b.percent, allowance: 0, count: 0 }));
  for (const rcv of receivables) {
    const open = r2(Number(rcv.open) || 0);
    if (open <= 0.004) continue;
    const due = new Date((rcv.dueDate || rcv.date || asOf) as string);
    const daysPastDue = Math.max(0, Math.floor((asOf.getTime() - due.getTime()) / 86400000));
    const idx = bands.findIndex((b) => b.upToDays == null || daysPastDue <= b.upToDays);
    const line = lines[idx < 0 ? lines.length - 1 : idx];
    line.balance = r2(line.balance + open);
    line.count += 1;
  }
  for (const line of lines) line.allowance = r2(line.balance * (line.percent / 100));
  const required = r2(lines.reduce((s, l) => s + l.allowance, 0));
  const totalOpen = r2(lines.reduce((s, l) => s + l.balance, 0));
  return { lines, required, totalOpen };
}

export type LedgerLine = { accountCode: string; debit: number; credit: number; description: string };

/**
 * Move the allowance to what is required. `booked` is the allowance account's current credit
 * balance. Returns no lines when it is already right.
 */
export function planAllowanceAdjustment(required: number, booked: number): { change: number; lines: LedgerLine[] } {
  const change = r2(required - booked);
  if (Math.abs(change) < 0.005) return { change: 0, lines: [] };
  if (change > 0) {
    return {
      change,
      lines: [
        { accountCode: GL_BAD_DEBT_EXPENSE, debit: change, credit: 0, description: 'Increase in allowance for doubtful debts' },
        { accountCode: GL_DOUBTFUL_DEBTS, debit: 0, credit: change, description: 'Allowance for doubtful debts' },
      ],
    };
  }
  const release = -change;
  return {
    change,
    lines: [
      { accountCode: GL_DOUBTFUL_DEBTS, debit: release, credit: 0, description: 'Allowance for doubtful debts released' },
      { accountCode: GL_BAD_DEBT_EXPENSE, debit: 0, credit: release, description: 'Decrease in allowance for doubtful debts' },
    ],
  };
}

/** Write off a lost debt: the allowance absorbs it first, the rest is expensed. */
export function planWriteOff(amount: number, allowanceAvailable: number): LedgerLine[] {
  const total = r2(Math.max(0, amount));
  if (total <= 0.004) return [];
  const fromAllowance = r2(Math.min(total, Math.max(0, allowanceAvailable)));
  const expensed = r2(total - fromAllowance);
  return [
    ...(fromAllowance > 0 ? [{ accountCode: GL_DOUBTFUL_DEBTS, debit: fromAllowance, credit: 0, description: 'Written off against the allowance' }] : []),
    ...(expensed > 0 ? [{ accountCode: GL_BAD_DEBT_EXPENSE, debit: expensed, credit: 0, description: 'Bad debt written off' }] : []),
    { accountCode: GL_RECEIVABLES, debit: 0, credit: total, description: 'Receivable written off' },
  ];
}

/** Money received on a debt already written off: cash in, the bad-debt expense comes back down. */
export function planRecovery(amount: number, cashAccount: string): LedgerLine[] {
  const total = r2(Math.max(0, amount));
  if (total <= 0.004) return [];
  return [
    { accountCode: cashAccount, debit: total, credit: 0, description: 'Written-off debt recovered' },
    { accountCode: GL_BAD_DEBT_EXPENSE, debit: 0, credit: total, description: 'Bad debt recovered' },
  ];
}
