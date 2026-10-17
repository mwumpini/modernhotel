import { describe, expect, it } from 'vitest';
import { basicAfterLeave, monthPayDays, payableDayKeys } from '@/app/lib/payroll/leavePay';

const span = (employeeId: string, start: string, end: string, status = 'approved', leaveType = 'unpaid') => ({
  employeeId,
  status: status as 'approved',
  leaveType: leaveType as 'unpaid',
  startDate: new Date(`${start}T00:00:00Z`),
  endDate: new Date(`${end}T00:00:00Z`),
});

describe('leave on the payslip', () => {
  it('counts weekdays in October 2026 and skips the weekend inside an unpaid leave', () => {
    expect(payableDayKeys(2026, 10)).toHaveLength(22);
    const days = monthPayDays([span('akosua', '2026-10-23', '2026-10-27')], 'akosua', 2026, 10);
    expect(days).toEqual({ payableDays: 22, leaveDays: 3, workedDays: 19 });
    expect(basicAfterLeave(2200, days)).toBe(1900);
  });

  it('keeps full pay for annual, sick and maternity leave (paid under the Labour Act)', () => {
    const requests = ['annual', 'sick', 'maternity'].map((type) => span('ama', '2026-10-05', '2026-10-09', 'approved', type));
    const days = monthPayDays(requests, 'ama', 2026, 10);
    expect(days.leaveDays).toBe(0);
    expect(basicAfterLeave(1500, days)).toBe(1500);
  });

  it('ignores pending leave and a weekend that is not a work day', () => {
    const requests = [
      span('efua', '2026-10-05', '2026-10-09', 'pending'),
      span('kofi', '2026-10-17', '2026-10-18'),
    ];
    expect(monthPayDays(requests, 'efua', 2026, 10).leaveDays).toBe(0);
    expect(monthPayDays(requests, 'kofi', 2026, 10).leaveDays).toBe(0);
  });

  it('pays no basic for a month that is entirely unpaid leave', () => {
    const days = monthPayDays([span('ama', '2026-10-01', '2026-10-31')], 'ama', 2026, 10);
    expect(days.workedDays).toBe(0);
    expect(basicAfterLeave(1500, days)).toBe(0);
  });
});
