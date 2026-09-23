import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { serializeFbOrder } from '@/app/lib/fb/serializeOrder'
import { appendGuestFolioCharge, resolveCheckedInReservationId } from '@/app/lib/frontoffice/folioServer'

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
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
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
    const nextStatus = body.status ?? existing.status
    const updated = await prisma.fBOrder.update({
      where: { id },
      data: {
        status: nextStatus,
        notes: body.notes ?? existing.notes,
        serverName: body.serverName ?? existing.serverName,
        tableNumber: body.tableNumber ?? existing.tableNumber,
        assignedToId: body.assignedToId ?? existing.assignedToId,
        assignedToName: body.assignedToName ?? existing.assignedToName,
        ...(nextStatus === 'preparing' && !existing.preparingAt ? { preparingAt: now } : {}),
        ...(body.status === 'served' ? { servedAt: now } : {}),
      },
      include: { items: true },
    })

    // ── When cancelled: record who cancelled it and why ────────────────────
    if (body.status === 'cancelled' && existing.status !== 'cancelled') {
      await createAuditLog(
        ctx.tenantId, sessionUserId ?? null,
        'FB_ORDER_CANCELLED', 'FBOrder', id,
        { status: existing.status },
        { status: 'cancelled', orderNumber: existing.orderNumber, reason: body.cancelReason ?? null },
        request
      )
    }

    // ── When billed: post charge to guest folio ────────────────────────────
    // Guard on existing.status so a retried PATCH doesn't re-push the charge.
    if (body.status === 'billed' && existing.status !== 'billed') {
      const reservationId = await resolveCheckedInReservationId({
        tenantId: ctx.tenantId,
        reservationId: existing.reservationId,
        guestId: existing.guestId,
        roomNumber: existing.roomNumber,
      })

      if (reservationId) {
        const nowIso = now.toISOString()
        const taxLines = (existing.taxLines as any[]) || []
        const newCharge = {
          id: `FB-${existing.orderNumber}`,
          date: nowIso,
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

        const { folioId } = await appendGuestFolioCharge({
          tenantId: ctx.tenantId,
          reservationId,
          charge: newCharge,
        })

        await prisma.fBOrder.update({
          where: { id },
          data: { folioId, billedAt: now, reservationId },
        })

        await createAuditLog(
          ctx.tenantId, sessionUserId ?? null,
          'FB_ORDER_BILLED_TO_FOLIO', 'FBOrder', id,
          undefined,
          { folioId, amount: Number(existing.total), orderNumber: existing.orderNumber, reservationId },
          request
        )
      }
    }

    return NextResponse.json({ order: serializeFbOrder(updated) })
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
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
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

    return NextResponse.json({ order: serializeFbOrder(order) })
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
