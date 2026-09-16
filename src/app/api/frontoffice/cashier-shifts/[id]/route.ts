import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { closeCashierShift } from '@/app/lib/frontoffice/cashierShiftRepository'

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
    const closingCount = Number(body.closingCount)
    if (!Number.isFinite(closingCount) || closingCount < 0) {
      return NextResponse.json({ error: 'closingCount must be zero or a positive number' }, { status: 400 })
    }

    const shift = await closeCashierShift(ctx.tenantId, id, closingCount, body.notes)
    if (!shift) return NextResponse.json({ error: 'Shift not found, or already closed' }, { status: 404 })

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'CASHIER_SHIFT_CLOSED', 'CashierShift', shift.id, undefined, { closingCount, expectedCash: shift.expectedCash, variance: shift.variance }, request)
    return NextResponse.json({ shift })
  } catch (error) {
    console.error('[frontoffice/cashier-shifts/:id][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
