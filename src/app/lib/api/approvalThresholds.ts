import { prisma } from '@/app/lib/database/client'

export type ApprovalCategory = 'expense' | 'purchaseOrder' | 'payment'

/**
 * Tenant-configurable director-approval thresholds (see
 * /api/settings/approval-thresholds and Settings > Approvals). Stored in the
 * same SystemSettings.financialSettings JSON blob that already held the
 * discount-approval fields — GHS 1,000 with approval required is the default
 * for every category until a tenant changes it themselves.
 */
const DEFAULTS: Record<ApprovalCategory, { required: boolean; threshold: number }> = {
  expense: { required: true, threshold: 1000 },
  purchaseOrder: { required: true, threshold: 1000 },
  payment: { required: true, threshold: 1000 },
}

const FIELD_NAMES: Record<ApprovalCategory, { requiredKey: string; thresholdKey: string }> = {
  expense: { requiredKey: 'requireApprovalForExpenses', thresholdKey: 'expenseApprovalThreshold' },
  purchaseOrder: { requiredKey: 'requireApprovalForPurchaseOrders', thresholdKey: 'purchaseOrderApprovalThreshold' },
  payment: { requiredKey: 'requireApprovalForPayments', thresholdKey: 'paymentApprovalThreshold' },
}

export const APPROVAL_PERMISSION: Record<ApprovalCategory, string> = {
  expense: 'accounting.approve-journal-entry',
  purchaseOrder: 'inventory.approve-high-value-requisition',
  payment: 'accounting.approve-payment',
}

/** Whether a transaction of `amount` in this category needs director sign-off for this tenant. */
export async function getApprovalRequirement(
  tenantId: string,
  category: ApprovalCategory,
  amount: number,
): Promise<{ needsApproval: boolean; threshold: number; required: boolean }> {
  const settings = await prisma.systemSettings.findUnique({ where: { tenantId }, select: { financialSettings: true } })
  const fs = (settings?.financialSettings as Record<string, any>) || {}
  const { requiredKey, thresholdKey } = FIELD_NAMES[category]
  const required = typeof fs[requiredKey] === 'boolean' ? fs[requiredKey] : DEFAULTS[category].required
  const threshold = typeof fs[thresholdKey] === 'number' ? fs[thresholdKey] : DEFAULTS[category].threshold
  return { needsApproval: required && amount >= threshold, threshold, required }
}
