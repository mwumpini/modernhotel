import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requirePermission } from '@/app/lib/api/auth-guard'
import { catchUpTenantNightAudit } from '@/app/lib/frontoffice/nightAuditServer'

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'frontdesk.night-audit')
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const user = (auth.session as any).user
    const runBy: string = user?.name || user?.email || 'Front Desk'

    const result = await catchUpTenantNightAudit({
      tenantId: ctx.tenantId,
      source: 'manual',
      runBy,
    })
    return NextResponse.json({ result })
  } catch (error) {
    console.error('[frontoffice/night-audit/run][POST] error', error)
    return NextResponse.json({ error: 'Night audit failed', details: String(error) }, { status: 500 })
  }
}
