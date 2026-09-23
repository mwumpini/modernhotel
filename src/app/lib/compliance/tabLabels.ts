export const COMPLIANCE_TAB_KEYS = ['tax', 'payroll', 'reports'] as const;
export type ComplianceTabKey = (typeof COMPLIANCE_TAB_KEYS)[number];

export const DEFAULT_COMPLIANCE_TAB_LABELS: Record<ComplianceTabKey, string> = {
  tax: 'Tax rules',
  payroll: 'Payroll tax',
  reports: 'Reports & Filing',
};

function storageKey(country: string) {
  return `compliance.tabLabels.${country || 'GH'}`;
}

function normalizeLabel(value: unknown, fallback: string) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || fallback;
}

export function getComplianceTabLabels(country: string): Record<ComplianceTabKey, string> {
  try {
    const raw = localStorage.getItem(storageKey(country));
    if (!raw) return { ...DEFAULT_COMPLIANCE_TAB_LABELS };
    const parsed = JSON.parse(raw) as Partial<Record<ComplianceTabKey, string>>;
    return {
      tax: normalizeLabel(parsed.tax, DEFAULT_COMPLIANCE_TAB_LABELS.tax),
      payroll: normalizeLabel(parsed.payroll, DEFAULT_COMPLIANCE_TAB_LABELS.payroll),
      reports: normalizeLabel(parsed.reports, DEFAULT_COMPLIANCE_TAB_LABELS.reports),
    };
  } catch {
    return { ...DEFAULT_COMPLIANCE_TAB_LABELS };
  }
}

export function setComplianceTabLabels(
  country: string,
  labels: Partial<Record<ComplianceTabKey, string>>
): Record<ComplianceTabKey, string> {
  const next = {
    tax: normalizeLabel(labels.tax, DEFAULT_COMPLIANCE_TAB_LABELS.tax),
    payroll: normalizeLabel(labels.payroll, DEFAULT_COMPLIANCE_TAB_LABELS.payroll),
    reports: normalizeLabel(labels.reports, DEFAULT_COMPLIANCE_TAB_LABELS.reports),
  };
  try {
    localStorage.setItem(storageKey(country), JSON.stringify(next));
  } catch {}
  return next;
}
