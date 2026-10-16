/**
 * What a cancelled or no-show booking costs the guest, by the business's own rules
 * (Settings → Operational Policies → Booking changes). Pure: no database, no settings store.
 *
 * Each business decides: no fee at all, the first night, a % of the stay, a fixed amount,
 * or keep the whole deposit; how many hours before arrival cancelling is still free;
 * whether taxes apply to the fee; and whether the fee may only come out of the deposit.
 * The fee is taken from the deposit first. What is left of the deposit is a refund due
 * (paid back by staff, never automatically); a fee larger than the deposit is billed to the
 * guest unless the business chose "only from the deposit".
 */

export type BookingFeeType = 'first_night' | 'percent_reservation' | 'flat' | 'keep_deposit';

export type BookingPolicy = {
  noShowPolicyEnabled?: boolean;
  noShowChargeType?: BookingFeeType;
  noShowChargeValue?: number;
  cancellationPolicyEnabled?: boolean;
  freeCancellationHours?: number;
  lateCancellationFeeType?: BookingFeeType;
  lateCancellationFeeValue?: number;
  /** Charge VAT/NHIL/GETFund/Tourism on these fees. Default yes. */
  bookingFeesTaxable?: boolean;
  /** Never bill more than the deposit already paid. Default no. */
  bookingFeesDepositOnly?: boolean;
};

export type RateNight = { date?: string; base: number; total?: number };

export type BookingPenalty = {
  /** Why nothing (or something) is charged, in words for staff. */
  reason: string;
  /** The full fee, before looking at the deposit. */
  fee: { net: number; tax: number; gross: number };
  /** Part of the fee taken from the deposit. */
  fromDeposit: { net: number; tax: number; gross: number };
  /** Part of the fee billed to the guest (0 when the fee may only come from the deposit). */
  billed: { net: number; tax: number; gross: number };
  /** What is left of the deposit, owed back to the guest. */
  refundDue: number;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ZERO = { net: 0, tax: 0, gross: 0 };

function share(fee: { net: number; tax: number; gross: number }, gross: number) {
  if (fee.gross <= 0 || gross <= 0) return { ...ZERO };
  const g = r2(Math.min(gross, fee.gross));
  const tax = r2(fee.tax * (g / fee.gross));
  return { net: r2(g - tax), tax, gross: g };
}

export function computeBookingPenalty(params: {
  kind: 'cancel' | 'no-show';
  policy: BookingPolicy;
  nights: RateNight[];
  deposit: number;
  /** Hours from the cancellation to the planned arrival (cancellations only). */
  hoursBeforeArrival?: number;
  taxExempt?: boolean;
  /** Tax on a net amount at the business's sales rates (e.g. 21% in Ghana). */
  taxOn: (net: number) => number;
}): BookingPenalty {
  const { kind, policy, nights } = params;
  const deposit = r2(Math.max(0, params.deposit));
  const none = (reason: string): BookingPenalty => ({ reason, fee: { ...ZERO }, fromDeposit: { ...ZERO }, billed: { ...ZERO }, refundDue: deposit });

  const enabled = kind === 'no-show' ? policy.noShowPolicyEnabled : policy.cancellationPolicyEnabled;
  if (!enabled) return none(kind === 'no-show' ? 'No no-show charge is set' : 'No cancellation fee is set');
  if (kind === 'cancel') {
    const free = Math.max(0, Number(policy.freeCancellationHours ?? 0));
    if ((params.hoursBeforeArrival ?? 0) >= free) return none(`Cancelled ${Math.floor(params.hoursBeforeArrival ?? 0)} hours before arrival (free up to ${free})`);
  }

  const type = (kind === 'no-show' ? policy.noShowChargeType : policy.lateCancellationFeeType) || 'first_night';
  const value = Math.max(0, Number((kind === 'no-show' ? policy.noShowChargeValue : policy.lateCancellationFeeValue) || 0));
  const taxable = policy.bookingFeesTaxable !== false && !params.taxExempt;

  const stayNet = nights.reduce((s, n) => s + (n.base || 0), 0);
  const stayGross = nights.reduce((s, n) => s + (typeof n.total === 'number' ? n.total : (n.base || 0)), 0);
  let net = 0;
  let tax = 0;
  let label = '';
  if (type === 'first_night') {
    net = nights[0]?.base ?? 0;
    tax = typeof nights[0]?.total === 'number' ? Math.max(0, nights[0].total - net) : params.taxOn(net);
    label = 'first night';
  } else if (type === 'percent_reservation') {
    const gross = (value / 100) * stayGross;
    net = stayGross > 0 ? stayNet * (gross / stayGross) : 0;
    tax = gross - net;
    label = `${value}% of the stay`;
  } else if (type === 'flat') {
    net = value;
    tax = params.taxOn(value);
    label = 'fixed fee';
  } else {
    // Keep the whole deposit: the deposit is the fee, taxes included if the fee is taxable.
    const per100 = params.taxOn(100);
    const gross = deposit;
    net = taxable && per100 > 0 ? gross / (1 + per100 / 100) : gross;
    tax = gross - net;
    label = 'whole deposit kept';
  }
  net = r2(Math.max(0, net));
  tax = taxable ? r2(Math.max(0, tax)) : 0;
  const fee = { net, tax, gross: r2(net + tax) };
  if (fee.gross <= 0) return none(`${kind === 'no-show' ? 'No-show' : 'Late cancellation'}: nothing to charge (${label})`);

  const fromDeposit = share(fee, deposit);
  const billedGross = policy.bookingFeesDepositOnly ? 0 : r2(fee.gross - fromDeposit.gross);
  const billed = billedGross > 0
    ? { net: r2(fee.net - fromDeposit.net), tax: r2(fee.tax - fromDeposit.tax), gross: billedGross }
    : { ...ZERO };
  return {
    reason: `${kind === 'no-show' ? 'No-show' : 'Late cancellation'} fee: ${label}`,
    fee,
    fromDeposit,
    billed,
    refundDue: r2(deposit - fromDeposit.gross),
  };
}
