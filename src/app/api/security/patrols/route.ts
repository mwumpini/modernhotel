import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listPatrolLogs, upsertPatrolLog } from '@/app/lib/security/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const patrols = await listPatrolLogs(ctx.tenantId)
    return NextResponse.json({ patrols })
  } catch (error) {
    console.error('[security/patrols][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.officerName || !body.route) return NextResponse.json({ error: 'officerName and route are required' }, { status: 400 })
    const patrol = await upsertPatrolLog(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'SECURITY_PATROL_SAVED', 'SecurityPatrolLog', body.id, undefined, { route: patrol.route, officerName: patrol.officerName }, request)
    return NextResponse.json({ patrol })
  } catch (error) {
    console.error('[security/patrols][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const patrol = await upsertPatrolLog(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'SECURITY_PATROL_UPDATED', 'SecurityPatrolLog', body.id, undefined, { status: patrol.status }, request)
    return NextResponse.json({ patrol })
  } catch (error) {
    console.error('[security/patrols][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
