import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { updatePayment } from '@/app/lib/accounting/repository'
import { prisma } from '@/app/lib/database/client'
import { getApprovalRequirement } from '@/app/lib/api/approvalThresholds'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const body = await request.json()

    // Client always voids via persistPaymentPatch(id, {status:'Void', ...}) —
    // gate specifically on that transition rather than every edit.
    if (body.status === 'Void') {
      const perm = await requirePermission(request, 'accounting.void-transaction')
      if (!perm.ok) return perm.response
    }

    // Posting a payment at/above the tenant's configured payment-approval
    // threshold needs director sign-off — same "downgrade rather than
    // reject" approach as journal entries: the request still succeeds, just
    // as 'Pending Approval' instead of 'Posted', until someone with
    // accounting.approve-payment runs the same action again.
    if (body.status === 'Posted') {
      const existing = await prisma.accountingPayment.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { amount: true } })
      if (existing) {
        const { needsApproval } = await getApprovalRequirement(ctx.tenantId, 'payment', existing.amount)
        if (needsApproval) {
          const approvePerm = await requirePermission(request, 'accounting.approve-payment')
          if (!approvePerm.ok) body.status = 'Pending Approval'
        }
      }
    }

    const payment = await updatePayment(ctx.tenantId, id, body)
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    const action = body.status === 'Void' ? 'PAYMENT_VOIDED' : body.status === 'Pending Approval' ? 'PAYMENT_SUBMITTED_FOR_APPROVAL' : 'PAYMENT_UPDATED'
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, action, 'Payment', id, undefined, { status: payment.status, amount: payment.amount }, request)
    return NextResponse.json({ payment })
  } catch (error) {
    console.error('[accounting/payments/:id][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
