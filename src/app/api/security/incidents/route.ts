import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listIncidents, upsertIncident } from '@/app/lib/security/repository'

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
    const incidents = await listIncidents(ctx.tenantId)
    return NextResponse.json({ incidents })
  } catch (error) {
    console.error('[security/incidents][GET] error', error)
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
    if (!body.location || !body.description) return NextResponse.json({ error: 'location and description are required' }, { status: 400 })
    const incident = await upsertIncident(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_INCIDENT_SAVED', 'SecurityIncident', body.id, undefined, { location: incident.location, severity: incident.severity }, request)
    return NextResponse.json({ incident })
  } catch (error) {
    console.error('[security/incidents][POST] error', error)
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
    const incident = await upsertIncident(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'SECURITY_INCIDENT_UPDATED', 'SecurityIncident', body.id, undefined, { status: incident.status }, request)
    return NextResponse.json({ incident })
  } catch (error) {
    console.error('[security/incidents][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
