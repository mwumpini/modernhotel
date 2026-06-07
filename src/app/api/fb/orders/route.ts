import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'

// GET /api/fb/orders — list orders, optionally filter by status/venue
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const venue = searchParams.get('venue')
    const guestId = searchParams.get('guestId')

    const orders = await prisma.fBOrder.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(status ? { status } : {}),
        ...(venue ? { venue } : {}),
        ...(guestId ? { guestId } : {}),
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('[fb/orders][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/fb/orders — create a new F&B order
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.venue) return NextResponse.json({ error: 'venue is required' }, { status: 400 })
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Order must have at least one item' }, { status: 400 })
    }

    const orderCount = await prisma.fBOrder.count({ where: { tenantId: ctx.tenantId } })
    const orderNumber = `FB-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`

    const subtotal = body.items.reduce((s: number, i: any) => s + (i.amount || i.unitPrice * i.quantity), 0)
    const taxAmount = body.taxAmount ?? subtotal * 0.21 // default Ghana composite tax ~21%
    const total = subtotal + taxAmount

    const order = await prisma.fBOrder.create({
      data: {
        tenantId: ctx.tenantId,
        orderNumber,
        venue: body.venue,
        tableNumber: body.tableNumber,
        roomNumber: body.roomNumber,
        guestId: body.guestId,
        reservationId: body.reservationId,
        serverName: body.serverName,
        notes: body.notes,
        subtotal,
        taxAmount,
        total,
        status: 'pending',
        items: {
          create: body.items.map((item: any) => ({
            tenantId: ctx.tenantId,
            menuItemId: item.menuItemId,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount || item.unitPrice * item.quantity,
            taxAmount: item.taxAmount ?? 0,
            notes: item.notes,
            glAccountCode: item.glAccountCode || '4200',
          })),
        },
      },
      include: { items: true },
    })

    await createAuditLog(ctx.tenantId, null, 'FB_ORDER_CREATED', 'FBOrder', order.id, undefined, { orderNumber, venue: order.venue, total }, request)
    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error('[fb/orders][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
