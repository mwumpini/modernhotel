import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { updatePayment } from '@/app/lib/accounting/repository'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const body = await request.json()
    const payment = await updatePayment(ctx.tenantId, id, body)
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'PAYMENT_UPDATED', 'Payment', id, undefined, { status: payment.status, amount: payment.amount }, request)
    return NextResponse.json({ payment })
  } catch (error) {
    console.error('[accounting/payments/:id][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
