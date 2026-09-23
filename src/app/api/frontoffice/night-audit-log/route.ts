import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listNightAuditLogs, createNightAuditLog } from '@/app/lib/frontoffice/nightAuditLogRepository'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const startDate = request.nextUrl.searchParams.get('startDate') || undefined
    const endDate = request.nextUrl.searchParams.get('endDate') || undefined
    const logs = await listNightAuditLogs(ctx.tenantId, { startDate, endDate })
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[frontoffice/night-audit-log][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Optional: record a client-side note about a night-audit attempt.
// The real close (room charges, no-shows, day totals) is POST /api/frontoffice/night-audit/run.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    const businessDate = String(body.businessDate || '')
    if (!businessDate) return NextResponse.json({ error: 'businessDate is required' }, { status: 400 })

    const user = (auth.session as any).user
    const runBy: string = user?.name || user?.email || 'Front Desk'

    const log = await createNightAuditLog(ctx.tenantId, {
      businessDate,
      source: 'manual',
      status: body.status === 'failed' ? 'failed' : 'completed',
      roomChargesPosted: Number(body.roomChargesPosted) || 0,
      noShowsMarked: Number(body.noShowsMarked) || 0,
      errors: Array.isArray(body.errors) ? body.errors.map(String) : undefined,
      runBy,
    })
    return NextResponse.json({ log })
  } catch (error) {
    console.error('[frontoffice/night-audit-log][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
