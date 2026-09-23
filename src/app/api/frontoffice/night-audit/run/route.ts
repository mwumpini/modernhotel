import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requirePermission } from '@/app/lib/api/auth-guard'
import { runTenantNightAudit } from '@/app/lib/frontoffice/nightAuditServer'
import { getFrontOfficeBusinessDate } from '@/app/lib/frontoffice/folioServer'

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'frontdesk.night-audit')
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const stored = await getFrontOfficeBusinessDate(ctx.tenantId)
    const businessDate = typeof body.businessDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.businessDate)
      ? body.businessDate
      : stored

    const user = (auth.session as any).user
    const runBy: string = user?.name || user?.email || 'Front Desk'

    const result = await runTenantNightAudit({
      tenantId: ctx.tenantId,
      source: 'manual',
      runBy,
      businessDate,
    })
    return NextResponse.json({ result })
  } catch (error) {
    console.error('[frontoffice/night-audit/run][POST] error', error)
    return NextResponse.json({ error: 'Night audit failed', details: String(error) }, { status: 500 })
  }
}
