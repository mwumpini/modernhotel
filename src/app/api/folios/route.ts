import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard'
import { listFolios, upsertFolio } from '@/app/lib/frontoffice/repository'
import { prisma } from '@/app/lib/database/client'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const folios = await listFolios(ctx.tenantId)
    return NextResponse.json({ folios })
  } catch (error) {
    console.error('[folios][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Folios are upserted as a whole because the in-house subledger mutates often
// (charges, payments, transfers). A single PUT keyed by folio id keeps the row
// authoritative without juggling child-record diffs.
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'folio id is required' }, { status: 400 })
    if (!body.reservationId) return NextResponse.json({ error: 'reservationId is required' }, { status: 400 })

    // Voiding a charge (frontoffice/helpers/folio.ts's voidCharge) always pushes a
    // NEW line with both a 'VOID '-prefixed description and a negative amount —
    // requiring both signals together (not just one) so this doesn't also gate the
    // unrelated Discount/Complimentary "Process Adjustment" flow, which posts its
    // own negative-amount lines under a different description prefix.
    const existing = await prisma.guestFolio.findUnique({ where: { id: body.id } })
    const existingChargeIds = new Set(
      (Array.isArray((existing as any)?.charges) ? (existing as any).charges : []).map((c: any) => c?.id),
    )
    const incomingCharges: any[] = Array.isArray(body.charges) ? body.charges : []
    const isVoidCharge = incomingCharges.some(
      (c) => c && !existingChargeIds.has(c.id) && typeof c.description === 'string' && c.description.startsWith('VOID ') && Number(c.amount) < 0,
    )
    if (isVoidCharge) {
      const perm = await requirePermission(request, 'frontdesk.void-charge')
      if (!perm.ok) return perm.response
    }

    // Refund detection mirrors the void check above: refundPayment() (frontoffice/helpers/folio.ts)
    // either flips an existing payment's status to 'refunded' in place, or — for a partial
    // refund — pushes a brand-new payment row already carrying status 'refunded'.
    const existingPayments: any[] = Array.isArray((existing as any)?.payments) ? (existing as any).payments : []
    const existingPaymentStatus = new Map(existingPayments.map((p: any) => [p?.id, p?.status]))
    const incomingPayments: any[] = Array.isArray(body.payments) ? body.payments : []
    const isRefund = incomingPayments.some(
      (p) => p && p.status === 'refunded' && existingPaymentStatus.get(p.id) !== 'refunded',
    )
    if (isRefund) {
      const perm = await requirePermission(request, 'frontdesk.refund-payment')
      if (!perm.ok) return perm.response
    }

    // Discount/comp charges (reportingStore.ts's discount & complimentary-room reports
    // already rely on these same "Discount: "/"Complimentary: " prefixes) — same
    // negative-new-line shape as a void, just a different, non-void-specific reason.
    const discountCharge = incomingCharges.find(
      (c) => c && !existingChargeIds.has(c.id) && typeof c.description === 'string'
        && (c.description.startsWith('Discount: ') || c.description.startsWith('Complimentary: '))
        && Number(c.amount) < 0,
    )

    const { folio, changed } = await upsertFolio(ctx.tenantId, body)
    if (!changed) return NextResponse.json({ folio })
    const action = isVoidCharge ? 'FOLIO_CHARGE_VOIDED' : isRefund ? 'FOLIO_PAYMENT_REFUNDED' : discountCharge ? 'FOLIO_CHARGE_DISCOUNTED' : 'FOLIO_UPSERTED'
    const details: Record<string, any> = { reservationId: folio.reservationId, status: folio.status, balance: folio.balance }
    if (discountCharge) {
      details.discountDescription = discountCharge.description
      details.discountAmount = discountCharge.amount
    }
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, action, 'Folio', folio.id, undefined, details, request)
    return NextResponse.json({ folio })
  } catch (error) {
    console.error('[folios][PUT] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
