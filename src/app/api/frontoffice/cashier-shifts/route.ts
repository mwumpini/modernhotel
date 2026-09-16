import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listCashierShifts, findOpenShiftForCashier, openCashierShift } from '@/app/lib/frontoffice/cashierShiftRepository'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const shifts = await listCashierShifts(ctx.tenantId)
    return NextResponse.json({ shifts })
  } catch (error) {
    console.error('[frontoffice/cashier-shifts][GET] error', error)
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

    const user = (auth.session as any).user
    const cashierUserId: string | undefined = user?.id
    const cashierName: string = user?.name || user?.email || 'Front Desk'
    if (!cashierUserId) return NextResponse.json({ error: 'No session user id' }, { status: 400 })

    // One open till per cashier at a time — opening a second one while the first
    // is still open would split their payments across two shifts and make
    // neither reconciliation meaningful.
    const existingOpen = await findOpenShiftForCashier(ctx.tenantId, cashierUserId)
    if (existingOpen) {
      return NextResponse.json({ error: 'You already have an open shift. Close it before opening a new one.', shift: existingOpen }, { status: 409 })
    }

    const body = await request.json()
    const openingFloat = Number(body.openingFloat)
    if (!Number.isFinite(openingFloat) || openingFloat < 0) {
      return NextResponse.json({ error: 'openingFloat must be zero or a positive number' }, { status: 400 })
    }

    const shift = await openCashierShift(ctx.tenantId, cashierUserId, cashierName, openingFloat, body.notes || undefined)
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'CASHIER_SHIFT_OPENED', 'CashierShift', shift.id, undefined, { openingFloat }, request)
    return NextResponse.json({ shift })
  } catch (error) {
    console.error('[frontoffice/cashier-shifts][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
