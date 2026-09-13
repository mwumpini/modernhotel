import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { listShifts, upsertShift } from '@/app/lib/security/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

// GET - list duty shifts (check-in/check-out attendance)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const shifts = await listShifts(ctx.tenantId)
    return NextResponse.json({ shifts })
  } catch (error) {
    console.error('[security/shifts][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - check in (create a new shift)
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'security.manage-shifts')
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.personKey || !body.personName) return NextResponse.json({ error: 'personKey and personName are required' }, { status: 400 })
    const shift = await upsertShift(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_SHIFT_CHECKED_IN', 'SecurityShift', body.id, undefined, { personName: shift.personName }, request)
    return NextResponse.json({ shift })
  } catch (error) {
    console.error('[security/shifts][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - check out / update
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'security.manage-shifts')
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const shift = await upsertShift(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_SHIFT_UPDATED', 'SecurityShift', body.id, undefined, { status: shift.status }, request)
    return NextResponse.json({ shift })
  } catch (error) {
    console.error('[security/shifts][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
