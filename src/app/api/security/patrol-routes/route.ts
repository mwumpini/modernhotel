import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requireAnyPermission, requirePermission } from '@/app/lib/api/auth-guard'
import { listPatrolRoutes, upsertPatrolRoute } from '@/app/lib/security/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

// GET - list reusable patrol route names
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const routes = await listPatrolRoutes(ctx.tenantId)
    return NextResponse.json({ routes })
  } catch (error) {
    console.error('[security/patrol-routes][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - create or update a patrol route. Also grantable via
// 'security.manage-patrols' since starting a patrol can auto-save a
// freshly-typed route name — that's part of running a patrol, not separately
// curating the master list.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAnyPermission(request, ['security.manage-routes', 'security.manage-patrols'])
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const route = await upsertPatrolRoute(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_PATROL_ROUTE_SAVED', 'SecurityPatrolRoute', body.id, undefined, { name: route.name }, request)
    return NextResponse.json({ route })
  } catch (error) {
    console.error('[security/patrol-routes][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - update (e.g. deactivate) — deliberate curation, not gated by the patrol fallback
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'security.manage-routes')
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const route = await upsertPatrolRoute(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_PATROL_ROUTE_UPDATED', 'SecurityPatrolRoute', body.id, undefined, { isActive: route.isActive }, request)
    return NextResponse.json({ route })
  } catch (error) {
    console.error('[security/patrol-routes][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
