import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { syncReservationFolioToLedger } from '@/app/lib/accounting/folioLedgerServer'

/**
 * POST /api/frontoffice/folio-ledger — bring a stay's books in line with its folio.
 * With `checkout: true` it also closes the stay: cash rounding, then whatever the guest
 * still owes moves from the guest ledger (1215) to receivables (1210). Safe to repeat.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const reservationId = String(body.reservationId || '')
    if (!reservationId) return NextResponse.json({ error: 'reservationId is required' }, { status: 400 })
    const rounding = Number(body.roundingAdjustment)

    const user = (auth.session as any).user
    const result = await syncReservationFolioToLedger(ctx.tenantId, reservationId, {
      postedBy: user?.name || user?.email || undefined,
      ...(body.checkout ? { checkout: { roundingAdjustment: Number.isFinite(rounding) ? rounding : 0 } } : {}),
    })
    if (result.skipped === 'not-found') return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    return NextResponse.json({ result })
  } catch (error) {
    console.error('[frontoffice/folio-ledger][POST] error', error)
    return NextResponse.json({ error: 'Could not post the stay to the books' }, { status: 500 })
  }
}
