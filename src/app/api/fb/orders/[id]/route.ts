import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { serializeFbOrder } from '@/app/lib/fb/serializeOrder'
import { issueStockForFbOrder, reverseStockForFbOrder } from '@/app/lib/fb/issueOrderStock'
import { venueGlAccount } from '@/app/lib/fb/venueGl'
import {
  appendGuestFolioCharge,
  resolveCheckedInReservationId,
  voidGuestFolioCharge,
} from '@/app/lib/frontoffice/folioServer'
import { findOpenShiftForCashier } from '@/app/lib/frontoffice/cashierShiftRepository'
import {
  postFbSaleAndCogsServer,
  refundFbSaleServer,
  syncRestaurantTableStatus,
} from '@/app/lib/fb/fbSaleAccountingServer'

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: ['billed', 'cancelled'],
  billed: ['refunded'],
  refunded: [],
  cancelled: [],
}

function canTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to)
}

function normalizePayMethod(raw: unknown): 'Cash' | 'Card' | 'Mobile Money' | 'Room Charge' | null {
  const s = String(raw || '')
  if (s === 'Cash' || s === 'Card' || s === 'Mobile Money' || s === 'Room Charge') return s
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUser = (auth.session as any).user
    const sessionUserId = sessionUser?.id as string | undefined
    const sessionUserName = (sessionUser?.name || sessionUser?.email || 'Cashier') as string
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

    if (body.status && body.status !== existing.status) {
      if (!canTransition(existing.status, body.status)) {
        return NextResponse.json({
          error: `Invalid status transition: '${existing.status}' → '${body.status}'. Allowed next steps: [${(VALID_TRANSITIONS[existing.status] ?? []).join(', ') || 'none'}]`,
          currentStatus: existing.status,
          allowedTransitions: VALID_TRANSITIONS[existing.status] ?? [],
        }, { status: 400 })
      }
    }

    let paymentMethod = normalizePayMethod(body.paymentMethod)
    const goingToBilled = body.status === 'billed' && existing.status !== 'billed'
    const looksLikeRoomCharge =
      paymentMethod === 'Room Charge' ||
      Boolean(existing.reservationId || existing.roomNumber || existing.guestId)

    // Walk-in bills must declare a tender; defaulting silently skipped the till gate.
    if (goingToBilled && !paymentMethod && !looksLikeRoomCharge) {
      paymentMethod = 'Cash'
    }

    // Till gate: cash/card/MoMo require an open restaurant shift for the cashier.
    if (goingToBilled && paymentMethod && paymentMethod !== 'Room Charge') {
      if (!sessionUserId) {
        return NextResponse.json({ error: 'No session user — cannot bill without a cashier.' }, { status: 400 })
      }
      const openShift = await findOpenShiftForCashier(ctx.tenantId, sessionUserId, 'restaurant')
      if (!openShift) {
        return NextResponse.json(
          { error: 'Open a Restaurant / Bar till before taking cash, card, or MoMo payments.' },
          { status: 403 },
        )
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

    const tableNumber = body.tableNumber ?? existing.tableNumber

    // Occupy table when order is live
    if (
      body.status &&
      ['pending', 'preparing', 'ready', 'served'].includes(body.status) &&
      !['billed', 'refunded', 'cancelled'].includes(body.status)
    ) {
      await syncRestaurantTableStatus({ tenantId: ctx.tenantId, tableNumber, status: 'occupied' }).catch(() => {})
    }

    if (body.status === 'cancelled' && existing.status !== 'cancelled') {
      await syncRestaurantTableStatus({ tenantId: ctx.tenantId, tableNumber, status: 'available' }).catch(() => {})
      await createAuditLog(
        ctx.tenantId, sessionUserId ?? null,
        'FB_ORDER_CANCELLED', 'FBOrder', id,
        { status: existing.status },
        { status: 'cancelled', orderNumber: existing.orderNumber, reason: body.cancelReason ?? null },
        request,
      )
    }

    let stockRestored = 0
    let glRefund: { ok: boolean; error?: string } | undefined
    if (body.status === 'refunded' && existing.status === 'billed') {
      try {
        const reversed = await reverseStockForFbOrder({
          tenantId: ctx.tenantId,
          orderId: id,
          orderNumber: existing.orderNumber,
          performedBy: sessionUserName || existing.serverName || undefined,
        })
        stockRestored = reversed.restored
      } catch (stockErr) {
        console.error('[fb/orders/[id]] stock reverse failed', stockErr)
      }

      if (existing.reservationId) {
        try {
          await voidGuestFolioCharge({
            tenantId: ctx.tenantId,
            reservationId: existing.reservationId,
            chargeId: `FB-${existing.orderNumber}`,
            reason: body.refundReason || 'F&B refund',
          })
        } catch (folioErr) {
          console.error('[fb/orders/[id]] folio void failed', folioErr)
        }
      }

      glRefund = await refundFbSaleServer({
        tenantId: ctx.tenantId,
        orderId: id,
        venue: existing.venue,
        orderNumber: existing.orderNumber,
        reason: body.refundReason || undefined,
      })

      await syncRestaurantTableStatus({ tenantId: ctx.tenantId, tableNumber, status: 'available' }).catch(() => {})

      await createAuditLog(
        ctx.tenantId, sessionUserId ?? null,
        'FB_ORDER_REFUNDED', 'FBOrder', id,
        { status: 'billed' },
        {
          status: 'refunded',
          orderNumber: existing.orderNumber,
          reason: body.refundReason ?? null,
          stockRestored,
          glOk: glRefund.ok,
          glError: glRefund.error ?? null,
        },
        request,
      )
    }

    let stockWarnings: { itemName: string; needed: number; onHand: number }[] = []
    let cogs: { amount: number; lines: { itemName: string; quantity: number; unitCost: number; amount: number }[] } | undefined
    let accounting: { invoiceId?: string; receiptId?: string; cogsJournalId?: string } | undefined

    if (goingToBilled) {
      const isRoomCharge = paymentMethod === 'Room Charge' || (!paymentMethod && Boolean(existing.reservationId || existing.roomNumber || existing.guestId))

      if (isRoomCharge || existing.reservationId || existing.roomNumber || existing.guestId) {
        const reservationId = await resolveCheckedInReservationId({
          tenantId: ctx.tenantId,
          reservationId: existing.reservationId,
          guestId: existing.guestId,
          roomNumber: existing.roomNumber,
        })

        if (reservationId && (isRoomCharge || paymentMethod === 'Room Charge' || !paymentMethod)) {
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
            glAccountCode: venueGlAccount(existing.venue),
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
            request,
          )
        }
      }

      try {
        const issued = await issueStockForFbOrder({
          tenantId: ctx.tenantId,
          orderId: id,
          orderNumber: existing.orderNumber,
          performedBy: sessionUserName || existing.serverName || undefined,
        })
        stockWarnings = issued.warnings || []
        if (issued.cogs?.amount > 0) {
          cogs = {
            amount: issued.cogs.amount,
            lines: issued.cogs.lines.map((l) => ({
              itemName: l.itemName,
              quantity: l.quantity,
              unitCost: l.unitCost,
              amount: l.amount,
            })),
          }
        }
        if (stockWarnings.length > 0) {
          await createAuditLog(
            ctx.tenantId, sessionUserId ?? null,
            'FB_ORDER_STOCK_SHORTFALL', 'FBOrder', id,
            undefined,
            { orderNumber: existing.orderNumber, warnings: stockWarnings },
            request,
          )
        }
      } catch (stockErr) {
        console.error('[fb/orders/[id]] stock issue failed', stockErr)
      }

      // Server GL: walk-in sale + COGS (Room Charge = COGS only)
      try {
        const tender = paymentMethod && paymentMethod !== 'Room Charge' ? paymentMethod : null
        accounting = await postFbSaleAndCogsServer({
          tenantId: ctx.tenantId,
          orderId: id,
          orderNumber: existing.orderNumber,
          venue: existing.venue,
          customerName: existing.guestName || 'Walk-in Guest',
          tableNumber,
          subtotal: Number(existing.subtotal),
          taxAmount: Number(existing.taxAmount),
          taxLines: (existing.taxLines as any[]) || [],
          total: Number(existing.total),
          paymentMethod: tender || 'Cash',
          cashierUserId: sessionUserId,
          cashierName: sessionUserName,
          staffId: body.staffId || undefined,
          staffName: existing.serverName || body.staffName || undefined,
          items: (existing.items || []).map((it) => ({
            description: it.name,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
          skipSale: !tender,
          cogsAmount: cogs?.amount || 0,
        })
      } catch (glErr) {
        console.error('[fb/orders/[id]] GL post failed', glErr)
      }

      await prisma.fBOrder.update({
        where: { id },
        data: { billedAt: existing.billedAt || now },
      })

      await syncRestaurantTableStatus({ tenantId: ctx.tenantId, tableNumber, status: 'cleaning' }).catch(() => {})

      await createAuditLog(
        ctx.tenantId, sessionUserId ?? null,
        'FB_ORDER_BILLED', 'FBOrder', id,
        { status: existing.status },
        {
          status: 'billed',
          orderNumber: existing.orderNumber,
          paymentMethod: paymentMethod || null,
          accounting: accounting || null,
        },
        request,
      )
    }

    // Free table when leaving active floor states via other paths
    if (body.status === 'billed' || body.status === 'refunded') {
      // cleaning already set on bill; available on refund
    }

    const refreshed = await prisma.fBOrder.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { items: true },
    })

    return NextResponse.json({
      order: serializeFbOrder(refreshed || updated),
      ...(stockWarnings.length > 0 ? { stockWarnings } : {}),
      ...(cogs ? { cogs } : {}),
      ...(accounting ? { accounting } : {}),
      ...(body.status === 'refunded' ? { stockRestored, glRefund } : {}),
    })
  } catch (error) {
    console.error('[fb/orders/[id]][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

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
