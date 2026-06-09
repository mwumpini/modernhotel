'use client';

/**
 * Live compliance metrics for the accounting overview (replaces hardcoded % KPIs).
 */

import type { ReportingRule } from '../models';

export type AccountingComplianceOverview = {
  countryCode: string;
  complianceScore: number;
  activeSchedules: number;
  pendingFilings: number;
  submittedFilings: number;
  totalFilings: number;
};

export function buildAccountingComplianceOverview(input: {
  countryCode: string;
  reportingRules: ReportingRule[];
  reports: Array<{ countryCode: string; status: string }>;
  complianceScore: number;
}): AccountingComplianceOverview {
  const { countryCode, reportingRules, reports, complianceScore } = input;
  const activeSchedules = reportingRules.filter(
    (r) => r.countryCode === countryCode && r.isActive !== false,
  ).length;
  const countryReports = reports.filter((r) => r.countryCode === countryCode);
  const pendingFilings = countryReports.filter((r) => r.status === 'pending').length;
  const submittedFilings = countryReports.filter(
    (r) => r.status === 'submitted' || r.status === 'approved',
  ).length;

  return {
    countryCode,
    complianceScore,
    activeSchedules,
    pendingFilings,
    submittedFilings,
    totalFilings: countryReports.length,
  };
}
