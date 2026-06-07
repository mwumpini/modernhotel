import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'

// ── Order state machine ───────────────────────────────────────────────────────
// Valid forward transitions only. Cancellation allowed from any non-billed state.
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:    ['preparing', 'ready', 'cancelled'],
  preparing:  ['ready', 'cancelled'],
  ready:      ['served', 'cancelled'],
  served:     ['billed'],
  billed:     [], // terminal — no further changes
  cancelled:  [], // terminal
}

function canTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to)
}

// PATCH /api/fb/orders/[id] — update status with state machine enforcement
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.fBOrder.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { items: true },
    })
    if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // ── Validate status transition ─────────────────────────────────────────
    if (body.status && body.status !== existing.status) {
      if (!canTransition(existing.status, body.status)) {
        return NextResponse.json({
          error: `Invalid status transition: '${existing.status}' → '${body.status}'. Allowed next steps: [${(VALID_TRANSITIONS[existing.status] ?? []).join(', ') || 'none'}]`,
          currentStatus: existing.status,
          allowedTransitions: VALID_TRANSITIONS[existing.status] ?? [],
        }, { status: 400 })
      }
    }

    const now = new Date()
    const updated = await prisma.fBOrder.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        notes: body.notes ?? existing.notes,
        serverName: body.serverName ?? existing.serverName,
        ...(body.status === 'served' ? { servedAt: now } : {}),
      },
      include: { items: true },
    })

    // ── When billed: post charge to guest folio ────────────────────────────
    if (body.status === 'billed' && existing.guestId && existing.reservationId) {
      const folio = await prisma.guestFolio.findFirst({
        where: {
          tenantId: ctx.tenantId,
          reservationId: existing.reservationId,
          status: 'open',
        },
      })

      if (folio) {
        const charges = (folio.charges as any[]) || []
        const payments = (folio.payments as any[]) || []

        // Build folio charge with per-tax breakdown stored in reference
        const taxLines = (existing.taxLines as any[]) || []
        const newCharge = {
          id: `FB-${existing.orderNumber}`,
          date: now.toISOString(),
          description: `F&B — ${existing.venue.replace('_', ' ')} ${existing.orderNumber}`,
          amount: Number(existing.subtotal),
          tax: Number(existing.taxAmount),
          taxLines,
          discountAmount: Number(existing.discountAmount ?? 0),
          serviceCharge: Number(existing.serviceCharge ?? 0),
          category: 'F&B',
          venue: existing.venue,
          reference: existing.orderNumber,
          glAccountCode: venueGL(existing.venue),
          covers: existing.covers ?? 1,
        }

        charges.push(newCharge)
        const totalCharges = charges.reduce(
          (s: number, c: any) => s + (c.amount ?? 0) + (c.tax ?? 0) + (c.serviceCharge ?? 0), 0
        )
        const totalPayments = payments
          .filter((p: any) => p.status === 'completed')
          .reduce((s: number, p: any) => s + p.amount, 0)

        await prisma.guestFolio.update({
          where: { id: folio.id },
          data: {
            charges: charges as any,
            totalCharges,
            totalPayments,
            balance: totalCharges - totalPayments,
          },
        })

        await prisma.fBOrder.update({
          where: { id },
          data: { folioId: folio.id, billedAt: now },
        })

        await createAuditLog(
          ctx.tenantId, null,
          'FB_ORDER_BILLED_TO_FOLIO', 'FBOrder', id,
          undefined,
          { folioId: folio.id, amount: Number(existing.total), orderNumber: existing.orderNumber },
          request
        )
      }
    }

    return NextResponse.json({ order: updated })
  } catch (error) {
    console.error('[fb/orders/[id]][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// GET /api/fb/orders/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const order = await prisma.fBOrder.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { items: true },
    })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    return NextResponse.json({ order })
  } catch (error) {
    console.error('[fb/orders/[id]][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

function venueGL(venue: string): string {
  switch (venue) {
    case 'restaurant': return '4210'
    case 'bar':
    case 'pool_bar':   return '4220'
    case 'room_service': return '4230'
    default:           return '4200'
  }
}
