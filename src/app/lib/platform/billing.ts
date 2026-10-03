export const DEFAULT_MONTHLY_FEE = {
  cloud: 800,
  local: 300,
  sync: 500,
} as const;

export type BillHosting = keyof typeof DEFAULT_MONTHLY_FEE;

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** One calendar month later. A 31st lands on the last day of the next month. */
export function addMonthsISO(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), Math.min(day, lastDay)));
  return result.toISOString().slice(0, 10);
}

export type FeePayment = {
  paidOn: string;
  amount: number;
  paidUntil: string;
};

function metaBag(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
}

export function readPayments(metadata: unknown): FeePayment[] {
  const raw = metaBag(metadata).payments;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const paidOn = typeof row.paidOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.paidOn) ? row.paidOn : null;
    const paidUntil = typeof row.paidUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.paidUntil) ? row.paidUntil : null;
    const amount = typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : null;
    if (!paidOn || !paidUntil || amount == null) return [];
    return [{ paidOn, paidUntil, amount }];
  });
}

export type CompanyExpense = {
  id: string;
  paidOn: string;
  amount: number;
  kind: 'cloud' | 'infrastructure';
  detail: string;
};

export function readExpenses(metadata: unknown): CompanyExpense[] {
  const raw = metaBag(metadata).expenses;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' && row.id ? row.id : '';
    const paidOn = typeof row.paidOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.paidOn) ? row.paidOn : null;
    const amount = typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : null;
    const kind = row.kind === 'cloud' || row.kind === 'infrastructure' ? row.kind : null;
    const detail = typeof row.detail === 'string' ? row.detail.trim() : '';
    if (!id || !paidOn || amount == null || !kind || !detail) return [];
    return [{ id, paidOn, amount, kind, detail }];
  });
}

export function readBill(metadata: unknown): { monthlyFee: number | null; paidUntil: string | null } {
  const bag = metaBag(metadata);
  const fee = typeof bag.monthlyFee === 'number' && Number.isFinite(bag.monthlyFee) ? bag.monthlyFee : null;
  const paidUntil = typeof bag.paidUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bag.paidUntil) ? bag.paidUntil : null;
  return { monthlyFee: fee, paidUntil };
}

/** A hotel with no paid-until date is not billed, so existing hotels keep signing in. */
export function paymentDue(paidUntil: string | null, today = todayISO()): boolean {
  return paidUntil != null && paidUntil < today;
}

export function hotelSignInOpen(status: string, metadata: unknown, today = todayISO()): boolean {
  return status === 'active' && !paymentDue(readBill(metadata).paidUntil, today);
}

/** Extend a full month from the current paid-until date, or from today if that date has passed. */
export function nextPaidUntil(current: string | null, today = todayISO()): string {
  const base = current && current >= today ? current : today;
  return addMonthsISO(base, 1);
}

export function parseMonthlyFee(raw: unknown): number | null {
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  return Math.round(value);
}
