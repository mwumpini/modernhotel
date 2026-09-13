import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { listSecurityPersonnel, upsertSecurityPersonnel } from '@/app/lib/security/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

// GET - list outsourced/contracted security personnel (no real User account)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const personnel = await listSecurityPersonnel(ctx.tenantId)
    return NextResponse.json({ personnel })
  } catch (error) {
    console.error('[security/personnel][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - create or update a personnel record
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'security.manage-personnel')
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const person = await upsertSecurityPersonnel(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_PERSONNEL_SAVED', 'SecurityPersonnel', body.id, undefined, { name: person.name }, request)
    return NextResponse.json({ person })
  } catch (error) {
    console.error('[security/personnel][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - update (e.g. deactivate)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'security.manage-personnel')
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const person = await upsertSecurityPersonnel(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_PERSONNEL_UPDATED', 'SecurityPersonnel', body.id, undefined, { isActive: person.isActive }, request)
    return NextResponse.json({ person })
  } catch (error) {
    console.error('[security/personnel][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
