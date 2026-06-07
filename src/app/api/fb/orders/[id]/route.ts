import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'

// PATCH /api/fb/orders/[id] — update status; when status='billed' posts charge to guest folio
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

    const updated = await prisma.fBOrder.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        notes: body.notes ?? existing.notes,
        ...(body.status === 'served' ? { billedAt: new Date() } : {}),
      },
      include: { items: true },
    })

    // When an order is served for a guest in-house, post charge to their folio
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

        const newCharge = {
          id: `FB-${existing.orderNumber}`,
          date: new Date().toISOString(),
          description: `F&B — ${existing.venue} Order ${existing.orderNumber}`,
          amount: Number(existing.subtotal),
          tax: Number(existing.taxAmount),
          category: 'F&B',
          reference: existing.orderNumber,
          glAccountCode: '4200',
        }

        charges.push(newCharge)
        const totalCharges = charges.reduce((s: number, c: any) => s + c.amount + (c.tax || 0), 0)
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

        // Mark order as billed
        await prisma.fBOrder.update({
          where: { id },
          data: { folioId: folio.id, status: 'billed', billedAt: new Date() },
        })

        await createAuditLog(ctx.tenantId, null, 'FB_ORDER_BILLED_TO_FOLIO', 'FBOrder', id, undefined, {
          folioId: folio.id,
          amount: Number(existing.total),
          orderNumber: existing.orderNumber,
        }, request)
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
