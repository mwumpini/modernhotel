import { describe, expect, it } from 'vitest';
import { planEarlyCheckout, type BookedNight, type OperationalPolicy } from '@/app/lib/frontoffice/operationalPolicies';

// Booked Monday 12 → Saturday 17 October: 5 nights at ₵500 (₵605 with 21% tax).
const booked: BookedNight[] = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map((date) => ({ date, base: 500, total: 605 }));
// The night audit has posted Monday's and Tuesday's nights.
const folio = [
  { description: 'Room Charge — 2026-10-12', category: 'room', date: '2026-10-12', amount: 500 },
  { description: 'Room Charge — 2026-10-13', category: 'room', date: '2026-10-13', amount: 500 },
  { description: 'Minibar', category: 'F&B', date: '2026-10-13', amount: 40 },
];
// Leaves Wednesday morning, before the 11:00 cutoff.
const wednesdayMorning = new Date(2026, 9, 14, 8, 0, 0);
const wednesdayNoon = new Date(2026, 9, 14, 12, 30, 0);
const rule = (patch: Partial<OperationalPolicy>): OperationalPolicy => ({
  earlyCheckoutPolicyEnabled: true,
  earlyCheckoutCutoffHour: 11,
  earlyCheckoutAdvancedEnabled: true,
  ...patch,
});
const roomTotal = (plan: ReturnType<typeof planEarlyCheckout>) =>
  plan.keep.filter((c) => c.category === 'room').reduce((s, c) => s + (c.amount || 0), 0) + plan.add.reduce((s, n) => s + n.amount, 0) + plan.penalty;

describe('Early checkout: refund or penalty', () => {
  it('Prorate: the guest pays only the 2 nights stayed', () => {
    const plan = planEarlyCheckout(folio, rule({ earlyCheckoutRefundType: 'nightly_prorate' }), wednesdayMorning, booked);
    expect(plan.add).toHaveLength(0);
    expect(plan.penalty).toBe(0);
    expect(roomTotal(plan)).toBe(1000);
  });

  it('No refund: the 3 unused nights are added, so the guest pays all 5 (with their tax)', () => {
    const plan = planEarlyCheckout(folio, rule({ earlyCheckoutRefundType: 'none' }), wednesdayMorning, booked);
    expect(plan.add.map((n) => n.date)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
    expect(plan.add.every((n) => n.amount === 500 && n.tax === 105)).toBe(true);
    expect(roomTotal(plan)).toBe(2500);
  });

  it('% penalty: 2 nights plus 20% of the 3 unused nights (₵300)', () => {
    const plan = planEarlyCheckout(folio, rule({ earlyCheckoutRefundType: 'percent_penalty', earlyCheckoutPenaltyPercent: 20 }), wednesdayMorning, booked);
    expect(plan.penalty).toBe(300);
    expect(roomTotal(plan)).toBe(1300);
  });

  it('leaving after the cutoff counts Wednesday night as used', () => {
    const noRefund = planEarlyCheckout(folio, rule({ earlyCheckoutRefundType: 'none' }), wednesdayNoon, booked);
    expect(noRefund.add.map((n) => n.date)).toEqual(['2026-10-15', '2026-10-16']);
    const penalty = planEarlyCheckout(folio, rule({ earlyCheckoutRefundType: 'percent_penalty', earlyCheckoutPenaltyPercent: 20 }), wednesdayNoon, booked);
    expect(penalty.penalty).toBe(200);
  });

  it('a night already on the folio for an unused date comes off under Prorate, and is not added twice under No refund', () => {
    const prePosted = [...folio, { description: 'Room Charge — 2026-10-14', category: 'room', date: '2026-10-14', amount: 500 }];
    const prorate = planEarlyCheckout(prePosted, rule({ earlyCheckoutRefundType: 'nightly_prorate' }), wednesdayMorning, booked);
    expect(prorate.remove.map((c) => c.date)).toEqual(['2026-10-14']);
    expect(roomTotal(prorate)).toBe(1000);
    const noRefund = planEarlyCheckout(prePosted, rule({ earlyCheckoutRefundType: 'none' }), wednesdayMorning, booked);
    expect(noRefund.add.map((n) => n.date)).toEqual(['2026-10-15', '2026-10-16']);
    expect(roomTotal(noRefund)).toBe(2500);
  });

  it('without "Advanced", it always prorates; with the switch off, nothing changes', () => {
    const basic = planEarlyCheckout(folio, { earlyCheckoutPolicyEnabled: true, earlyCheckoutCutoffHour: 11, earlyCheckoutRefundType: 'none' }, wednesdayMorning, booked);
    expect(basic.add).toHaveLength(0);
    const off = planEarlyCheckout(folio, { earlyCheckoutPolicyEnabled: false, earlyCheckoutRefundType: 'none', earlyCheckoutAdvancedEnabled: true }, wednesdayMorning, booked);
    expect(off.add).toHaveLength(0);
    expect(off.remove).toHaveLength(0);
  });
});
