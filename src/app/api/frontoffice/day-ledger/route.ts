import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { getFrontOfficeBusinessDate, reconstructTenantDay } from '@/app/lib/frontoffice/folioServer'

/** Reconstruct one business day's guest charges/payments from GuestFolio rows. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const currentBusinessDate = await getFrontOfficeBusinessDate(ctx.tenantId)
    const dateParam = request.nextUrl.searchParams.get('date')
    const businessDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : currentBusinessDate
    const ledger = await reconstructTenantDay(ctx.tenantId, businessDate)
    return NextResponse.json({ currentBusinessDate, ledger })
  } catch (error) {
    console.error('[frontoffice/day-ledger][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
