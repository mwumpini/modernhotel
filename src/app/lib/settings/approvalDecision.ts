export type ApprovalCategory = 'expense' | 'purchaseOrder' | 'payment' | 'overtime';

const DEFAULTS: Record<ApprovalCategory, { required: boolean; threshold: number }> = {
  expense: { required: true, threshold: 1000 },
  purchaseOrder: { required: true, threshold: 1000 },
  payment: { required: true, threshold: 1000 },
  overtime: { required: true, threshold: 8 },
};

const FIELD_NAMES: Record<ApprovalCategory, { requiredKey: string; thresholdKey: string }> = {
  expense: { requiredKey: 'requireApprovalForExpenses', thresholdKey: 'expenseApprovalThreshold' },
  purchaseOrder: { requiredKey: 'requireApprovalForPurchaseOrders', thresholdKey: 'purchaseOrderApprovalThreshold' },
  payment: { requiredKey: 'requireApprovalForPayments', thresholdKey: 'paymentApprovalThreshold' },
  overtime: { requiredKey: 'requireApprovalForOvertime', thresholdKey: 'overtimeApprovalThreshold' },
};

/**
 * Same rule the approval-thresholds API stores and every posting check reads:
 * approval is required only when the category is switched on and the amount
 * is at or above the tenant's threshold.
 */
export function approvalDecision(
  fs: Record<string, unknown> | null | undefined,
  category: ApprovalCategory,
  amount: number,
): { needsApproval: boolean; threshold: number; required: boolean } {
  const bag = fs || {};
  const { requiredKey, thresholdKey } = FIELD_NAMES[category];
  const required = typeof bag[requiredKey] === 'boolean' ? (bag[requiredKey] as boolean) : DEFAULTS[category].required;
  const threshold = typeof bag[thresholdKey] === 'number' ? (bag[thresholdKey] as number) : DEFAULTS[category].threshold;
  return { needsApproval: required && amount >= threshold, threshold, required };
}
