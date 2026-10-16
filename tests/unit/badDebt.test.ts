import { describe, expect, it } from 'vitest';
import {
  computeRequiredAllowance,
  normaliseBands,
  planAllowanceAdjustment,
  planRecovery,
  planWriteOff,
} from '@/app/lib/accounting/badDebt';

const asOf = new Date('2026-10-31T12:00:00Z');
const daysAgo = (n: number) => new Date(asOf.getTime() - n * 86400000).toISOString();
const balanced = (lines: { debit: number; credit: number }[]) =>
  Math.round(lines.reduce((s, l) => s + l.debit - l.credit, 0) * 100);

describe('Allowance for doubtful debts (IFRS 9, simplified)', () => {
  const receivables = [
    { id: 'not-due', open: 1000, dueDate: daysAgo(-10) },
    { id: 'd20', open: 1000, dueDate: daysAgo(20) },
    { id: 'd45', open: 1000, dueDate: daysAgo(45) },
    { id: 'd75', open: 1000, dueDate: daysAgo(75) },
    { id: 'd120', open: 1000, dueDate: daysAgo(120) },
    { id: 'd400', open: 1000, dueDate: daysAgo(400) },
    { id: 'paid', open: 0, dueDate: daysAgo(400) },
  ];

  it('puts each open debt in its age band with the default percentages', () => {
    const { lines, required, totalOpen } = computeRequiredAllowance(receivables, undefined, asOf);
    expect(lines.map((l) => [l.label, l.balance, l.allowance])).toEqual([
      ['Up to 30 days', 2000, 20],
      ['31–60 days', 1000, 50],
      ['61–90 days', 1000, 150],
      ['91–180 days', 1000, 400],
      ['Over 180 days', 1000, 1000],
    ]);
    expect(totalOpen).toBe(6000);
    expect(required).toBe(1620);
  });

  it('follows the business’s own bands', () => {
    const { required } = computeRequiredAllowance(receivables, [{ upToDays: 90, percent: 0 }, { upToDays: null, percent: 50 }], asOf);
    expect(required).toBe(1000);
    expect(normaliseBands([{ upToDays: 60, percent: 10 }, { upToDays: 30, percent: 2 }]).map((b) => b.upToDays)).toEqual([30, 60, null]);
  });

  it('posts only the change, up or down, and nothing when it is already right', () => {
    const up = planAllowanceAdjustment(1620, 1000);
    expect(up.change).toBe(620);
    expect(up.lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([['5685', 620, 0], ['1290', 0, 620]]);
    const down = planAllowanceAdjustment(800, 1000);
    expect(down.lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([['1290', 200, 0], ['5685', 0, 200]]);
    expect(planAllowanceAdjustment(1000, 1000).lines).toHaveLength(0);
    expect(balanced(up.lines)).toBe(0);
  });

  it('a write-off uses the allowance first and expenses the rest', () => {
    const covered = planWriteOff(500, 1620);
    expect(covered.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([['1290', 500, 0], ['1210', 0, 500]]);
    const short = planWriteOff(500, 200);
    expect(short.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([['1290', 200, 0], ['5685', 300, 0], ['1210', 0, 500]]);
    expect(balanced(short)).toBe(0);
  });

  it('money received after a write-off is a recovery', () => {
    const lines = planRecovery(300, '1120');
    expect(lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([['1120', 300, 0], ['5685', 0, 300]]);
  });
});
