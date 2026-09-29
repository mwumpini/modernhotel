import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { checkPin, isValidPin } from '@/app/lib/auth/posPin'

/**
 * POST /api/fb/staff-pin  { staffId, pin }
 * A waiter switching in on the shared POS terminal. The terminal itself must be signed in;
 * this only confirms which staff member is taking the next order.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const staffId = typeof body.staffId === 'string' ? body.staffId : ''
    if (!staffId || !isValidPin(body.pin)) {
      return NextResponse.json({ ok: false, error: 'Wrong PIN.' }, { status: 401 })
    }

    const staff = await prisma.user.findFirst({
      where: { id: staffId, tenantId: ctx.tenantId, isActive: true },
      select: { id: true, name: true, preferences: true },
    })
    if (!staff) return NextResponse.json({ ok: false, error: 'Wrong PIN.' }, { status: 401 })

    const result = await checkPin(staff.preferences, body.pin)
    if (result.ok || result.reason !== 'no-pin') {
      await prisma.user.update({ where: { id: staff.id }, data: { preferences: result.prefs as object } })
    }
    const sessionUserId = (auth.session as { user?: { id?: string } }).user?.id ?? null

    if (result.ok) {
      await createAuditLog(ctx.tenantId, sessionUserId, 'POS_WAITER_SWITCH', 'User', staff.id, undefined, { name: staff.name }, request)
      return NextResponse.json({ ok: true, staff: { id: staff.id, name: staff.name } })
    }
    if (result.reason === 'no-pin') {
      return NextResponse.json({ ok: false, error: 'No PIN set for this person yet. A manager can set one in Settings → Users.' }, { status: 409 })
    }
    if (result.reason === 'locked') {
      await createAuditLog(ctx.tenantId, sessionUserId, 'POS_PIN_LOCKED', 'User', staff.id, undefined, { name: staff.name }, request)
      return NextResponse.json({ ok: false, error: `Too many wrong tries. Try again in ${result.retryAfterMinutes} minute(s).` }, { status: 423 })
    }
    return NextResponse.json({ ok: false, error: 'Wrong PIN.' }, { status: 401 })
  } catch (error) {
    console.error('[fb/staff-pin][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
