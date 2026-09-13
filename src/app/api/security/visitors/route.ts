import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listVisitors, upsertVisitor } from '@/app/lib/security/repository'

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
    const visitors = await listVisitors(ctx.tenantId)
    return NextResponse.json({ visitors })
  } catch (error) {
    console.error('[security/visitors][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.name || !body.purpose) return NextResponse.json({ error: 'name and purpose are required' }, { status: 400 })
    const visitor = await upsertVisitor(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_VISITOR_SAVED', 'SecurityVisitor', body.id, undefined, { name: visitor.name, status: visitor.status }, request)
    return NextResponse.json({ visitor })
  } catch (error) {
    console.error('[security/visitors][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const visitor = await upsertVisitor(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_VISITOR_UPDATED', 'SecurityVisitor', body.id, undefined, { status: visitor.status }, request)
    return NextResponse.json({ visitor })
  } catch (error) {
    console.error('[security/visitors][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
