import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import {
  listCashierShifts,
  findOpenShiftForCashier,
  openCashierShift,
  type CashierOutlet,
} from '@/app/lib/frontoffice/cashierShiftRepository'

function parseOutlet(raw: unknown): CashierOutlet {
  return raw === 'restaurant' ? 'restaurant' : 'frontoffice'
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const outlet = parseOutlet(request.nextUrl.searchParams.get('outlet'))
    const shifts = await listCashierShifts(ctx.tenantId, outlet)
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
    const body = await request.json()
    const outlet = parseOutlet(body.outlet)
    const cashierName: string =
      user?.name || user?.email || (outlet === 'restaurant' ? 'Restaurant Cashier' : 'Front Desk')
    if (!cashierUserId) return NextResponse.json({ error: 'No session user id' }, { status: 400 })

    // One open till per cashier per outlet — FO and F&B can each have a till.
    const existingOpen = await findOpenShiftForCashier(ctx.tenantId, cashierUserId, outlet)
    if (existingOpen) {
      return NextResponse.json(
        { error: 'You already have an open shift. Close it before opening a new one.', shift: existingOpen },
        { status: 409 },
      )
    }

    const openingFloat = Number(body.openingFloat)
    if (!Number.isFinite(openingFloat) || openingFloat < 0) {
      return NextResponse.json({ error: 'openingFloat must be zero or a positive number' }, { status: 400 })
    }

    const businessDateRaw = String(body.businessDate || '').trim()
    const businessDate = /^\d{4}-\d{2}-\d{2}$/.test(businessDateRaw)
      ? businessDateRaw
      : new Date().toISOString().slice(0, 10)

    const shift = await openCashierShift(
      ctx.tenantId,
      cashierUserId,
      cashierName,
      openingFloat,
      body.notes || undefined,
      outlet,
      businessDate,
    )
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(
      ctx.tenantId,
      sessionUserId ?? null,
      'CASHIER_SHIFT_OPENED',
      'CashierShift',
      shift.id,
      undefined,
      { openingFloat, outlet, businessDate },
      request,
    )
    return NextResponse.json({ shift })
  } catch (error) {
    console.error('[frontoffice/cashier-shifts][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
