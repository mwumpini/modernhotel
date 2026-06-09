import { useMemo } from 'react';
import { useComplianceStore } from '@/app/lib/compliance/store';

export function useCalculateTax() {
  const calculateTax = useComplianceStore((s) => s.calculateTax);

  return (subtotal: number, category?: string, context?: Record<string, any>) => {
    return calculateTax(subtotal, category, context);
  };
}

export function useTaxBreakdown() {
  const taxRules = useComplianceStore((s) => s.taxRules);
  const country = useComplianceStore((s) => s.country);

  return useMemo(
    () =>
      taxRules
        .filter((rule) => rule.countryCode === country)
        .map((rule) => ({
          id: rule.id,
          name: rule.name,
          rate: rule.rate,
          glCode: rule.glCode,
          appliesTo: rule.appliesTo || ['ALL'],
        })),
    [taxRules, country]
  );
}

export function useComplianceSummary() {
  const country = useComplianceStore((s) => s.country);
  const taxRules = useComplianceStore((s) => s.taxRules);
  const reportingRules = useComplianceStore((s) => s.reportingRules);
  const reports = useComplianceStore((s) => s.reports);

  return useMemo(() => {
    const rules = taxRules.filter((rule) => rule.countryCode === country);
    const countryReports = reports.filter((r) => r.countryCode === country);
    const schedules = reportingRules.filter((r) => r.countryCode === country && r.isActive !== false);

    const submittedReports = countryReports.filter(
      (r) => r.status === 'submitted' || r.status === 'approved'
    ).length;
    const pendingReports = countryReports.filter((r) => r.status === 'pending').length;

    let complianceScore = 100;
    if (schedules.length > 0 && countryReports.length > 0) {
      complianceScore =
        (submittedReports / countryReports.length) * 80 +
        (pendingReports > 0 ? (pendingReports / countryReports.length) * 20 : 0);
      complianceScore = Math.round(Math.min(100, Math.max(0, complianceScore)));
    }

    return {
      activeTaxRules: rules.length,
      pendingReports,
      submittedReports,
      complianceScore,
      totalReports: countryReports.length,
      activeReportingSchedules: schedules.length,
    };
  }, [country, taxRules, reportingRules, reports]);
}
