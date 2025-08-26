import { useComplianceStore } from '@/app/lib/compliance/store';

export function useCalculateTax() {
  const { calculateTax } = useComplianceStore();

  return (subtotal: number, category?: string) => {
    return calculateTax(subtotal, category);
  };
}

// Additional hook for getting tax breakdown
export function useTaxBreakdown() {
  const { getActiveRules } = useComplianceStore();

  return () => {
    const rules = getActiveRules();
    return rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      rate: rule.rate,
      glCode: rule.glCode,
      appliesTo: rule.appliesTo || ['ALL']
    }));
  };
}

// Hook for getting compliance summary
export function useComplianceSummary() {
  const { getActiveRules, getActiveReports, getComplianceScore } = useComplianceStore();

  return () => {
    const rules = getActiveRules();
    const reports = getActiveReports();
    const score = getComplianceScore();

    return {
      activeTaxRules: rules.length,
      pendingReports: reports.filter(r => r.status === 'pending').length,
      submittedReports: reports.filter(r => r.status === 'submitted' || r.status === 'approved').length,
      complianceScore: score,
      totalReports: reports.length
    };
  };
}
