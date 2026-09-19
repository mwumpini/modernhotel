import type { Employee } from './models';

export type ExpiryKind = 'Contract' | 'Work permit' | 'Health certificate' | 'Probation';

export interface ExpiryAlert {
  employeeId: string;
  name: string;
  kind: ExpiryKind;
  /** YYYY-MM-DD */
  date: string;
  /** Negative when already past. */
  daysLeft: number;
}

/** How far ahead an upcoming expiry starts to show. Anything already past always shows. */
export const EXPIRY_WINDOW_DAYS = 60;

const CURRENT_STATUSES = new Set(['active', 'on_leave', 'suspended']);

/** Contract end, work permit, health (food-handler) certificate and probation end for
 * current staff, soonest first. Dates are stored as UTC midnight, so compare them against
 * today's calendar date in UTC terms to avoid an off-by-one in other timezones. */
export function getExpiryAlerts(employees: Employee[], windowDays = EXPIRY_WINDOW_DAYS, now = new Date()): ExpiryAlert[] {
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const alerts: ExpiryAlert[] = [];

  const add = (e: Employee, kind: ExpiryKind, raw: unknown) => {
    if (!raw) return;
    const d = new Date(raw as any);
    if (Number.isNaN(d.getTime())) return;
    const daysLeft = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - todayUtc) / 86400000);
    if (daysLeft > windowDays) return;
    alerts.push({ employeeId: e.id, name: `${e.firstName} ${e.lastName}`, kind, date: d.toISOString().slice(0, 10), daysLeft });
  };

  for (const e of employees) {
    if (!CURRENT_STATUSES.has(e.status)) continue;
    add(e, 'Contract', e.contractEndDate);
    add(e, 'Work permit', e.workPermitExpiryDate);
    add(e, 'Health certificate', e.healthCertificateExpiryDate);
    if (e.probation && (e.probation.status === 'active' || e.probation.status === 'extended')) {
      add(e, 'Probation', e.probation.endDate);
    }
  }
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}
