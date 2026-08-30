import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listPayments, createPayment } from '@/app/lib/accounting/repository'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const payments = await listPayments(ctx.tenantId)
    return NextResponse.json({ payments })
  } catch (error) {
    console.error('[accounting/payments][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.paymentNumber) return NextResponse.json({ error: 'paymentNumber is required' }, { status: 400 })

    const payment = await createPayment(ctx.tenantId, body)
    await createAuditLog(ctx.tenantId, null, 'PAYMENT_CREATED', 'Payment', payment.id, undefined, { paymentNumber: payment.paymentNumber, type: payment.type, amount: payment.amount }, request)
    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    console.error('[accounting/payments][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
