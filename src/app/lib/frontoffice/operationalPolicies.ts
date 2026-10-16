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
  'bookingFeesTaxable',
  'bookingFeesDepositOnly',
  'badDebtBands',
  'depositPolicyEnabled',
  'depositType',
  'depositValue',
  'requireDepositToConfirm',
  'allowBackdating',
] as const;

const ENUMS: Record<string, readonly string[]> = {
  payLaterPolicy: ['both', 'corporate', 'individual'],
  lateCheckoutFeeType: ['flat', 'percent_of_nightly'],
  earlyCheckoutRefundType: ['none', 'nightly_prorate', 'percent_penalty'],
  noShowChargeType: ['first_night', 'percent_reservation', 'flat', 'keep_deposit'],
  lateCancellationFeeType: ['first_night', 'percent_reservation', 'flat', 'keep_deposit'],
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
    if (key === 'badDebtBands') {
      // Age bands for the doubtful-debts allowance: up to 8 rows of { upToDays | null, percent 0–100 }.
      if (Array.isArray(value)) {
        out[key] = value.slice(0, 8)
          .filter((b) => b && typeof b === 'object')
          .map((b: any) => ({
            upToDays: b.upToDays == null || !Number.isFinite(Number(b.upToDays)) ? null : Math.max(0, Math.round(Number(b.upToDays))),
            percent: Math.max(0, Math.min(100, Number(b.percent) || 0)),
          }));
      }
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

/** A night of the booking as quoted (net rate, and gross incl. taxes when known). */
export type BookedNight = { date: string; base: number; total?: number };

/**
 * Early checkout, by the business's rule. A night is unused if it is after today, or today
 * when the guest leaves before the cutoff hour. Unused nights are read from the booking itself
 * (nights are only added to the folio as the night audit posts them, so future nights are
 * usually not on the folio yet):
 * - Prorate (default): unused nights already on the folio come off; nothing is added.
 * - No refund: the guest pays the whole booking — unused nights not yet on the folio are added.
 * - % penalty: unused nights come off and X% of their value is charged.
 * Without `bookedNights` it falls back to the room charges already on the folio.
 */
export function planEarlyCheckout<T extends PolicyCharge>(
  charges: T[],
  policy: OperationalPolicy | undefined,
  now = new Date(),
  bookedNights?: BookedNight[],
): { keep: T[]; remove: T[]; penalty: number; add: Array<{ date: string; amount: number; tax?: number }> } {
  if (!policy?.earlyCheckoutPolicyEnabled) return { keep: charges, remove: [], penalty: 0, add: [] };
  const mode: EarlyCheckoutMode = policy.earlyCheckoutAdvancedEnabled
    ? (policy.earlyCheckoutRefundType || 'nightly_prorate')
    : 'nightly_prorate';

  const today = localDay(now);
  const cutoff = Number(policy.earlyCheckoutCutoffHour ?? 11);
  const beforeCutoff = now.getHours() < cutoff;
  const unusedDate = (date: string) => !!date && (date > today || (date === today && beforeCutoff));
  const unused = (charge: T) => isRoomCharge(charge) && unusedDate((charge.date || '').slice(0, 10));
  const unusedBooked = (bookedNights || []).filter((n) => unusedDate((n.date || '').slice(0, 10)));

  if (mode === 'none') {
    // No refund: every booked night is paid. Add the ones the night audit has not posted.
    const onFolio = new Set(charges.filter(isRoomCharge).map((c) => (c.date || '').slice(0, 10)));
    const add = unusedBooked
      .filter((n) => !onFolio.has(n.date.slice(0, 10)) && n.base > 0)
      .map((n) => ({
        date: n.date.slice(0, 10),
        amount: roundMoney(n.base),
        ...(typeof n.total === 'number' ? { tax: roundMoney(Math.max(0, n.total - n.base)) } : {}),
      }));
    return { keep: charges, remove: [], penalty: 0, add };
  }

  const remove = charges.filter(unused);
  const keep = charges.filter((charge) => !unused(charge));
  const removedNet = remove.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);
  const unusedNet = bookedNights ? unusedBooked.reduce((sum, n) => sum + (Number(n.base) || 0), 0) : removedNet;
  const penalty = mode === 'percent_penalty'
    ? roundMoney(Math.max(0, ((Number(policy.earlyCheckoutPenaltyPercent) || 0) / 100) * unusedNet))
    : 0;
  return { keep, remove, penalty, add: [] };
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
