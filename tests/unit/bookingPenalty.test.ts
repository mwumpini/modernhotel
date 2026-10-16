import { describe, expect, it } from 'vitest';
import { computeBookingPenalty, type BookingPolicy } from '@/app/lib/frontoffice/bookingPenalty';

// Two nights at ₵1,000 + 21% tax = ₵1,210 a night.
const nights = [{ base: 1000, total: 1210 }, { base: 1000, total: 1210 }];
const taxOn = (net: number) => Math.round(net * 0.21 * 100) / 100;
const run = (policy: BookingPolicy, kind: 'cancel' | 'no-show', deposit: number, hoursBeforeArrival = 0) =>
  computeBookingPenalty({ kind, policy, nights, deposit, hoursBeforeArrival, taxOn });

describe('Cancellation and no-show fees follow the business’s own rules', () => {
  it('no policy switched on: nothing is kept, the whole deposit is refund due', () => {
    const p = run({}, 'no-show', 500);
    expect(p.fee.gross).toBe(0);
    expect(p.refundDue).toBe(500);
  });

  it('cancelled inside the free window: nothing kept', () => {
    const p = run({ cancellationPolicyEnabled: true, freeCancellationHours: 48, lateCancellationFeeType: 'first_night' }, 'cancel', 800, 72);
    expect(p.fee.gross).toBe(0);
    expect(p.refundDue).toBe(800);
  });

  it('late cancellation, first night, deposit bigger than the fee: keep one night, refund the rest', () => {
    const p = run({ cancellationPolicyEnabled: true, freeCancellationHours: 48, lateCancellationFeeType: 'first_night' }, 'cancel', 1500, 10);
    expect(p.fee).toEqual({ net: 1000, tax: 210, gross: 1210 });
    expect(p.fromDeposit.gross).toBe(1210);
    expect(p.billed.gross).toBe(0);
    expect(p.refundDue).toBe(290);
  });

  it('no-show fee bigger than the deposit: the rest is billed, unless the business only takes it from the deposit', () => {
    const policy: BookingPolicy = { noShowPolicyEnabled: true, noShowChargeType: 'first_night' };
    const billed = run(policy, 'no-show', 500);
    expect(billed.fromDeposit.gross).toBe(500);
    expect(billed.billed.gross).toBe(710);
    expect(billed.fromDeposit.net + billed.billed.net).toBe(1000);
    expect(billed.refundDue).toBe(0);

    const capped = run({ ...policy, bookingFeesDepositOnly: true }, 'no-show', 500);
    expect(capped.fromDeposit.gross).toBe(500);
    expect(capped.billed.gross).toBe(0);
  });

  it('% of the stay and fixed fee', () => {
    expect(run({ noShowPolicyEnabled: true, noShowChargeType: 'percent_reservation', noShowChargeValue: 50 }, 'no-show', 0).fee).toEqual({ net: 1000, tax: 210, gross: 1210 });
    expect(run({ noShowPolicyEnabled: true, noShowChargeType: 'flat', noShowChargeValue: 200 }, 'no-show', 0).fee).toEqual({ net: 200, tax: 42, gross: 242 });
  });

  it('keep the whole deposit: the deposit is the fee, taxes inside it', () => {
    const p = run({ noShowPolicyEnabled: true, noShowChargeType: 'keep_deposit' }, 'no-show', 605);
    expect(p.fee).toEqual({ net: 500, tax: 105, gross: 605 });
    expect(p.refundDue).toBe(0);
    expect(p.billed.gross).toBe(0);
  });

  it('a business can choose fees without tax', () => {
    const p = run({ noShowPolicyEnabled: true, noShowChargeType: 'flat', noShowChargeValue: 200, bookingFeesTaxable: false }, 'no-show', 1000);
    expect(p.fee).toEqual({ net: 200, tax: 0, gross: 200 });
    expect(p.refundDue).toBe(800);
  });
});
