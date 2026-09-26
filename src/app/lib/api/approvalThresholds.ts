import { prisma } from '@/app/lib/database/client'
import { approvalDecision, type ApprovalCategory } from '@/app/lib/settings/approvalDecision'

export type { ApprovalCategory }

/**
 * Tenant-configurable director-approval thresholds (see
 * /api/settings/approval-thresholds and Settings > Approvals). Stored in the
 * same SystemSettings.financialSettings JSON blob that already held the
 * discount-approval fields — GHS 1,000 with approval required is the default
 * for every category until a tenant changes it themselves.
 */
export const APPROVAL_PERMISSION: Record<ApprovalCategory, string> = {
  expense: 'accounting.approve-journal-entry',
  purchaseOrder: 'inventory.approve-high-value-requisition',
  payment: 'accounting.approve-payment',
  overtime: 'hr.approve-overtime',
}

/** Whether a transaction of `amount` in this category needs director sign-off for this tenant. */
export async function getApprovalRequirement(
  tenantId: string,
  category: ApprovalCategory,
  amount: number,
): Promise<{ needsApproval: boolean; threshold: number; required: boolean }> {
  const settings = await prisma.systemSettings.findUnique({ where: { tenantId }, select: { financialSettings: true } })
  const fs = (settings?.financialSettings as Record<string, unknown>) || {}
  return approvalDecision(fs, category, amount)
}
