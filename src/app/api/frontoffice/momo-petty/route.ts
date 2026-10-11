import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { readMomoPetty, saveMomoPetty } from '@/app/lib/frontoffice/momoPettyPolicy'

async function tenantId(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return { response: auth.response }
  const subdomain = getTenantFromRequest(request)
  if (!subdomain) return { response: NextResponse.json({ error: 'Missing tenant header' }, { status: 400 }) }
  const ctx = await getTenantContext(subdomain)
  if (!ctx) return { response: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) }
  return { tenantId: ctx.tenantId }
}

export async function GET(request: NextRequest) {
  const ctx = await tenantId(request)
  if (!ctx.tenantId) return ctx.response
  return NextResponse.json({ enabled: await readMomoPetty(ctx.tenantId) })
}

export async function PUT(request: NextRequest) {
  const ctx = await tenantId(request)
  if (!ctx.tenantId) return ctx.response
  // Anyone signed in may read this; changing it is finance set-up.
  const perm = await requirePermission(request, 'settings.manage-company-finance')
  if (!perm.ok) return perm.response
  const body = await request.json().catch(() => ({}))
  const enabled = await saveMomoPetty(ctx.tenantId, body.enabled !== false)
  return NextResponse.json({ enabled })
}
