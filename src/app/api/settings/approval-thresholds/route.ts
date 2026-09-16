import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

/**
 * Tenant-configurable director/GM approval thresholds — see
 * src/app/lib/api/approvalThresholds.ts, which reads these exact field names
 * out of SystemSettings.financialSettings to decide whether posting a journal
 * entry/payment or approving a requisition needs director sign-off.
 */
const FIELDS = [
  'requireApprovalForExpenses',
  'expenseApprovalThreshold',
  'requireApprovalForPurchaseOrders',
  'purchaseOrderApprovalThreshold',
  'requireApprovalForPayments',
  'paymentApprovalThreshold',
  'requireApprovalForOvertime',
  'overtimeApprovalThreshold',
] as const

const DEFAULTS: Record<(typeof FIELDS)[number], boolean | number> = {
  requireApprovalForExpenses: true,
  expenseApprovalThreshold: 1000,
  requireApprovalForPurchaseOrders: true,
  purchaseOrderApprovalThreshold: 1000,
  requireApprovalForPayments: true,
  paymentApprovalThreshold: 1000,
  requireApprovalForOvertime: true,
  overtimeApprovalThreshold: 8,
}

export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const settings = await prisma.systemSettings.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { financialSettings: true },
    })
    const fs = (settings?.financialSettings as Record<string, any>) || {}
    const result: Record<string, boolean | number> = {}
    for (const key of FIELDS) result[key] = key in fs ? fs[key] : DEFAULTS[key]
    return NextResponse.json(result)
  } catch (error) {
    console.error('[settings/approval-thresholds][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const perm = await requirePermission(request, 'settings.manage-approval-thresholds')
    if (!perm.ok) return perm.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    const patch: Record<string, boolean | number> = {}
    for (const key of FIELDS) {
      const val = body[key]
      if (key.startsWith('require') ? typeof val === 'boolean' : typeof val === 'number') {
        patch[key] = val
      }
    }

    const existing = await prisma.systemSettings.findUnique({ where: { tenantId: ctx.tenantId } })
    const existingFinancialSettings = (existing?.financialSettings as Record<string, any>) || {}
    const mergedFinancialSettings = { ...existingFinancialSettings, ...patch }

    await prisma.systemSettings.upsert({
      where: { tenantId: ctx.tenantId },
      update: { financialSettings: mergedFinancialSettings },
      create: {
        tenantId: ctx.tenantId,
        generalSettings: {},
        hotelSettings: {},
        roomSettings: {},
        financialSettings: mergedFinancialSettings,
        clientSettings: {},
        saasSettings: {},
      },
    })

    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'APPROVAL_THRESHOLDS_UPDATED', 'SystemSettings', ctx.tenantId, undefined, patch, request)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[settings/approval-thresholds][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
