import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requireAnyPermission, requirePermission } from '@/app/lib/api/auth-guard'
import { listCheckpointLocations, upsertCheckpointLocation } from '@/app/lib/security/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

// GET - list reusable checkpoint locations for building a patrol route
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const locations = await listCheckpointLocations(ctx.tenantId)
    return NextResponse.json({ locations })
  } catch (error) {
    console.error('[security/checkpoint-locations][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - create or update a checkpoint location. Also grantable via
// 'security.manage-patrols' since starting a patrol can auto-save a
// freshly-typed checkpoint name — that's part of running a patrol, not
// separately curating the master list.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAnyPermission(request, ['security.manage-checkpoints', 'security.manage-patrols'])
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const location = await upsertCheckpointLocation(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_CHECKPOINT_LOCATION_SAVED', 'SecurityCheckpointLocation', body.id, undefined, { name: location.name }, request)
    return NextResponse.json({ location })
  } catch (error) {
    console.error('[security/checkpoint-locations][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - update (e.g. deactivate) — deliberate curation, not gated by the patrol fallback
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'security.manage-checkpoints')
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const location = await upsertCheckpointLocation(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_CHECKPOINT_LOCATION_UPDATED', 'SecurityCheckpointLocation', body.id, undefined, { isActive: location.isActive }, request)
    return NextResponse.json({ location })
  } catch (error) {
    console.error('[security/checkpoint-locations][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
