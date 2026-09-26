/**
 * Pure rules for the Operational Policies screen.
 * Checkout, night audit, reservations, and invoices call these so a saved
 * setting changes the stay, not only the form.
 */

export type EarlyCheckoutMode = 'none' | 'nightly_prorate' | 'percent_penalty';

export type OperationalPolicy = {
  defaultCreditTermsDays?: number;
  earlyCheckoutPolicyEnabled?: boolean;
  earlyCheckoutRefundType?: EarlyCheckoutMode;
  earlyCheckoutPenaltyPercent?: number;
  earlyCheckoutCutoffHour?: number;
  earlyCheckoutAdvancedEnabled?: boolean;
  earlyCheckoutNote?: string;
  standardCheckInHour?: number;
  standardCheckOutHour?: number;
  noShowCutoffHour?: number;
  depositPolicyEnabled?: boolean;
  depositType?: 'percent' | 'flat';
  depositValue?: number;
  requireDepositToConfirm?: boolean;
};

export type PolicyCharge = {
  description?: string;
  category?: string;
  date?: string;
  amount?: number;
};

const POLICY_KEYS = [
  'payLaterPolicy',
  'requireCorporateReference',
  'defaultCreditTermsDays',
  'lateCheckoutFeeEnabled',
  'lateCheckoutGraceMinutes',
  'lateCheckoutFeeType',
  'lateCheckoutFeeValue',
  'earlyCheckoutPolicyEnabled',
  'earlyCheckoutRefundType',
  'earlyCheckoutPenaltyPercent',
  'earlyCheckoutCutoffHour',
  'earlyCheckoutAdvancedEnabled',
  'earlyCheckoutNote',
  'standardCheckInHour',
  'standardCheckOutHour',
  'noShowPolicyEnabled',
  'noShowChargeType',
  'noShowChargeValue',
  'noShowCutoffHour',
  'postFirstNightAtCheckin',
  'nightAuditAutoRun',
  'cancellationPolicyEnabled',
  'freeCancellationHours',
  'lateCancellationFeeType',
  'lateCancellationFeeValue',
  'depositPolicyEnabled',
  'depositType',
  'depositValue',
  'requireDepositToConfirm',
] as const;

const ENUMS: Record<string, readonly string[]> = {
  payLaterPolicy: ['both', 'corporate', 'individual'],
  lateCheckoutFeeType: ['flat', 'percent_of_nightly'],
  earlyCheckoutRefundType: ['none', 'nightly_prorate', 'percent_penalty'],
  noShowChargeType: ['first_night', 'percent_reservation', 'flat'],
  lateCancellationFeeType: ['first_night', 'percent_reservation', 'flat'],
  depositType: ['percent', 'flat'],
};

const HOUR_KEYS = new Set([
  'earlyCheckoutCutoffHour',
  'standardCheckInHour',
  'standardCheckOutHour',
  'noShowCutoffHour',
]);

/** Fields already stored on room settings, safe to send and merge. Unknown values are dropped. */
export function pickOperationalPolicy(source: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!source) return {};
  const out: Record<string, unknown> = {};
  for (const key of POLICY_KEYS) {
    if (!(key in source) || source[key] == null || source[key] === '') continue;
    const value = source[key];
    const allowed = ENUMS[key];
    if (allowed) {
      if (typeof value === 'string' && allowed.includes(value)) out[key] = value;
      continue;
    }
    if (key === 'earlyCheckoutNote') {
      if (typeof value === 'string') out[key] = value.slice(0, 240);
      continue;
    }
    if (typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = HOUR_KEYS.has(key) ? Math.max(0, Math.min(23, Math.round(value))) : Math.max(0, value);
    }
  }
  return out;
}

export function hourStamp(hour: number | undefined, fallback: number): string {
  const raw = typeof hour === 'number' && Number.isFinite(hour) ? hour : fallback;
  const clamped = Math.max(0, Math.min(23, Math.round(raw)));
  return `${String(clamped).padStart(2, '0')}:00`;
}

/** "Net 45", "45", and "Immediate" become a day count. Anything else is ignored. */
export function parsePaymentTermsDays(terms?: string | null): number | null {
  if (!terms) return null;
  const text = terms.trim().toLowerCase();
  if (!text) return null;
  if (text === 'immediate' || text === 'due on receipt') return 0;
  const match = text.match(/(\d+)/);
  if (!match) return null;
  return Math.max(0, Number(match[1]));
}

/** Company terms win. Otherwise the operational default, then the invoice default. */
export function creditTermDays(
  policy: Pick<OperationalPolicy, 'defaultCreditTermsDays'> | undefined,
  companyTerms?: string | null,
  invoiceDefault = 30,
): number {
  const fromCompany = parsePaymentTermsDays(companyTerms);
  if (fromCompany != null) return fromCompany;
  const fallback = policy?.defaultCreditTermsDays;
  if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback >= 0) return fallback;
  return invoiceDefault;
}

export function requiredDeposit(stayTotal: number, policy: OperationalPolicy | undefined): number {
  if (!policy?.depositPolicyEnabled) return 0;
  const value = Math.max(0, Number(policy.depositValue) || 0);
  if ((policy.depositType || 'percent') === 'flat') return roundMoney(value);
  return roundMoney(Math.max(0, stayTotal) * (value / 100));
}

export function depositBlocksConfirm(paid: number, required: number, policy: OperationalPolicy | undefined): boolean {
  if (!policy?.depositPolicyEnabled || !policy.requireDepositToConfirm) return false;
  return paid + 0.005 < required;
}

export function localDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isRoomCharge(charge: PolicyCharge): boolean {
  const category = (charge.category || '').toLowerCase();
  if (category === 'room') return true;
  const description = (charge.description || '').toLowerCase();
  if (description.includes('service')) return false;
  return description.includes('room');
}

/**
 * Unused room nights come off the folio when early checkout is on.
 * Before the cutoff hour, today's room charge is unused too.
 * Advanced "no refund" keeps every night. A penalty percent is charged on the nights removed.
 */
export function planEarlyCheckout<T extends PolicyCharge>(
  charges: T[],
  policy: OperationalPolicy | undefined,
  now = new Date(),
): { keep: T[]; remove: T[]; penalty: number } {
  if (!policy?.earlyCheckoutPolicyEnabled) return { keep: charges, remove: [], penalty: 0 };
  const mode: EarlyCheckoutMode = policy.earlyCheckoutAdvancedEnabled
    ? (policy.earlyCheckoutRefundType || 'nightly_prorate')
    : 'nightly_prorate';
  if (mode === 'none') return { keep: charges, remove: [], penalty: 0 };

  const today = localDay(now);
  const cutoff = Number(policy.earlyCheckoutCutoffHour ?? 11);
  const beforeCutoff = now.getHours() < cutoff;
  const unused = (charge: T) => {
    if (!isRoomCharge(charge)) return false;
    const date = (charge.date || '').slice(0, 10);
    if (!date) return false;
    if (date > today) return true;
    return date === today && beforeCutoff;
  };
  const remove = charges.filter(unused);
  const keep = charges.filter((charge) => !unused(charge));
  const removedNet = remove.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);
  const penalty = mode === 'percent_penalty'
    ? roundMoney(Math.max(0, ((Number(policy.earlyCheckoutPenaltyPercent) || 0) / 100) * removedNet))
    : 0;
  return { keep, remove, penalty };
}

/** Cutoff is an hour on the arrival calendar day. Once that day has ended, the cutoff has passed. */
export function noShowCutoffReached(arrival: string, cutoffHour: number, now = new Date()): boolean {
  const arrivalDay = (arrival || '').slice(0, 10);
  if (!arrivalDay) return false;
  const today = localDay(now);
  if (arrivalDay < today) return true;
  if (arrivalDay > today) return false;
  const cutoff = Math.max(0, Math.min(23, Math.round(Number(cutoffHour) || 0)));
  return now.getHours() > cutoff || (now.getHours() === cutoff && now.getMinutes() >= 0);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
