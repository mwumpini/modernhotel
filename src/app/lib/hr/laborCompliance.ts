import type { Employee, TrainingProgram, TrainingRecord } from './models';

export interface ComplianceChecklistItem {
  id: string;
  label: string;
  compliant: number;
  total: number;
}

export interface ComplianceResult {
  checklist: ComplianceChecklistItem[];
  score: number;
}

/**
 * Shared with HRMainDashboard.tsx's top-level Compliance Score KPI — one
 * implementation so the two views can never drift apart on what "compliant"
 * means.
 */
export function computeLaborCompliance(
  employees: Employee[],
  trainingPrograms: TrainingProgram[],
  trainingEnrollments: TrainingRecord[]
): ComplianceResult {
  const active = employees.filter((e) => e.status === 'active');

  const contracts = active.filter((e) => (e.documents || []).length > 0);
  const tin = active.filter((e) => !!(e as any).taxWithholding?.tin);
  const ssnit = active.filter((e) => e.ssnitEnrolled && !!(e as any).ssnitNumber);
  const ghanaCard = active.filter((e) => !!(e as any).ghanaCardNumber);

  const nonGhanaian = active.filter((e) => e.nationality && e.nationality !== 'Ghana');
  const workPermitsCurrent = nonGhanaian.filter((e) => {
    const expiry = (e as any).workPermitExpiryDate;
    return expiry && new Date(expiry).getTime() > Date.now();
  });

  const recentHires = active.filter((e) => {
    const hireDate = (e as any).hireDate;
    if (!hireDate) return false;
    const daysSinceHire = (Date.now() - new Date(hireDate).getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceHire >= 0 && daysSinceHire <= 180;
  });
  const probationTracked = recentHires.filter((e) => !!(e as any).probation);

  const mandatoryProgramIds = trainingPrograms.filter((p) => p.mandatory).map((p) => p.id);
  const mandatoryTrainingComplete = mandatoryProgramIds.length === 0
    ? active // nothing mandatory configured yet — trivially compliant, not a false negative
    : active.filter((e) =>
        mandatoryProgramIds.every((programId) =>
          trainingEnrollments.some((r) => r.employeeId === e.id && r.trainingProgramId === programId && r.status === 'completed')
        )
      );

  const checklist: ComplianceChecklistItem[] = [
    { id: 'contracts', label: 'Signed Employment Contracts on File', compliant: contracts.length, total: active.length },
    { id: 'tin', label: 'Tax Identification Number on File', compliant: tin.length, total: active.length },
    { id: 'ssnit', label: 'SSNIT Registration (number on file)', compliant: ssnit.length, total: active.length },
    { id: 'ghanaCard', label: 'Ghana Card on File', compliant: ghanaCard.length, total: active.length },
    { id: 'workPermits', label: 'Work Permits Current (non-Ghanaian staff)', compliant: workPermitsCurrent.length, total: nonGhanaian.length },
    { id: 'probation', label: 'Probations Tracked (hires within 180 days)', compliant: probationTracked.length, total: recentHires.length },
    { id: 'training', label: 'Mandatory Training Complete', compliant: mandatoryTrainingComplete.length, total: active.length },
  ];

  // A checklist item with 0 applicable employees (e.g. no non-Ghanaian staff) counts as
  // fully compliant rather than dragging the score down for a rule that doesn't apply.
  const score = checklist.length
    ? Math.round(
        checklist.reduce((sum, c) => sum + (c.total === 0 ? 1 : c.compliant / c.total), 0) / checklist.length * 100
      )
    : 0;

  return { checklist, score };
}
