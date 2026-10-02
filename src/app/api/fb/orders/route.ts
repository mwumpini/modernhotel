import { NextRequest, NextResponse } from 'next/server'
import { ReadyBoardError } from '@/app/lib/fb/readyBoard'
import { drawReadyBoard } from '@/app/lib/fb/readyBoardServer'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { resolveTaxConfigs, type PrismaTaxRow } from '@/app/lib/tax/resolveConfigs'
import { computeStackedTaxLines } from '@/app/lib/accounting/taxFromConfig'
import { resolveItemRouteFromPayload, serializeFbOrder } from '@/app/lib/fb/serializeOrder'
import { venueGlAccount } from '@/app/lib/fb/venueGl'
import { resolveCheckedInReservationId } from '@/app/lib/frontoffice/folioServer'

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100 }

function isDuplicateOrderNumber(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

/** The till keeps its own counter. If that counter is behind orders already saved, use the next free number instead of failing the send. */
async function nextFreeOrderNumber(tenantId: string, preferred?: string): Promise<string> {
  const taken = async (value: string) => {
    const hit = await prisma.fBOrder.findFirst({
      where: { tenantId, orderNumber: value },
      select: { id: true },
    })
    return !!hit
  }

  if (preferred && !(await taken(preferred))) return preferred

  const year = new Date().getFullYear()
  const seed = preferred && /\d+$/.test(preferred) ? preferred : `FB-${year}-0000`
  const match = /^(.*?)(\d+)$/.exec(seed)
  if (!match) {
    let n = (await prisma.fBOrder.count({ where: { tenantId } })) + 1
    for (let i = 0; i < 20; i++) {
      const candidate = `FB-${year}-${String(n).padStart(4, '0')}`
      if (!(await taken(candidate))) return candidate
      n += 1
    }
    return `FB-${year}-${Date.now().toString().slice(-6)}`
  }

  const head = match[1]
  const width = match[2].length
  let n = Number.parseInt(match[2], 10)
  for (let i = 0; i < 40; i++) {
    n += 1
    const candidate = `${head}${String(n).padStart(width, '0')}`
    if (!(await taken(candidate))) return candidate
  }
  return `FB-${year}-${Date.now().toString().slice(-6)}`
}

// GET /api/fb/orders — list orders, optionally filter by status/venue
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) {
      return NextResponse.json(
        {
          error: 'Tenant not found',
          subdomain,
          hint: subdomain === 'demo'
            ? 'Run `npm run db:seed` then restart the dev server. Or clear browser localStorage key tenant.subdomain.'
            : `No tenant with subdomain "${subdomain}". Use demo, or run db:seed.`,
        },
        { status: 404 }
      );
    }

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

    const menuIds = Array.from(
      new Set(
        orders.flatMap(o => o.items.map(i => i.menuItemId).filter(Boolean) as string[])
      )
    )
    const menuRouteById = new Map<string, string>()
    if (menuIds.length > 0) {
      const menuItems = await prisma.fBMenuItem.findMany({
        where: { tenantId: ctx.tenantId, id: { in: menuIds } },
        select: { id: true, route: true },
      })
      menuItems.forEach(m => menuRouteById.set(m.id, m.route))
    }

    const orderNumbers = orders.map((order) => order.orderNumber).filter(Boolean)
    const paymentByOrder = new Map<string, string>()
    if (orderNumbers.length > 0) {
      const payments = await prisma.accountingPayment.findMany({
        where: {
          tenantId: ctx.tenantId,
          type: 'Receipt',
          status: { not: 'Void' },
          reference: { in: orderNumbers },
        },
        select: { reference: true, paymentMethod: true },
      })
      payments.forEach((payment) => {
        if (payment.reference && payment.paymentMethod) paymentByOrder.set(payment.reference, payment.paymentMethod)
      })
    }

    return NextResponse.json({
      orders: orders.map((order) => ({
        ...serializeFbOrder(order, menuRouteById),
        paymentMethod: paymentByOrder.get(order.orderNumber)
          || (order.folioId && order.status === 'billed' ? 'Room Charge' : null),
      })),
    })
  } catch (error) {
    console.error('[fb/orders][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/fb/orders — create a new F&B order with correct Ghana tax calculation
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) {
      return NextResponse.json(
        {
          error: 'Tenant not found',
          subdomain,
          hint: subdomain === 'demo'
            ? 'Run `npm run db:seed` then restart the dev server. Or clear browser localStorage key tenant.subdomain.'
            : `No tenant with subdomain "${subdomain}". Use demo, or run db:seed.`,
        },
        { status: 404 }
      );
    }

    const body = await request.json()
    if (!body.venue) return NextResponse.json({ error: 'venue is required' }, { status: 400 })
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Order must have at least one item' }, { status: 400 })
    }

    // ── Order numbering ───────────────────────────────────────────────────────
    // Prefer the client-generated number (drawn from Settings → Document Numbering,
    // Food & Beverage → Order) so the series' prefix/format there is authoritative.
    // A stale till counter must not reject the order: take the next free number.
    let orderNumber = await nextFreeOrderNumber(ctx.tenantId, body.orderNumber as string | undefined)

    // ── Subtotal ──────────────────────────────────────────────────────────────
    const subtotal = round2(
      body.items.reduce((s: number, i: any) => s + round2((i.unitPrice ?? 0) * (i.quantity ?? 1)), 0)
    )
    const discountAmount = round2(Math.min(Math.max(body.discountAmount ?? 0, 0), subtotal))
    const serviceCharge = round2(Math.max(body.serviceCharge ?? 0, 0))
    const taxableAmount = round2(subtotal - discountAmount + serviceCharge)

    // ── Stacked tax (compliance JSON → tenant Prisma → Ghana template) ────────
    let prismaTaxes: PrismaTaxRow[] | undefined;
    try {
      const dbTaxes = await prisma.tax.findMany({ where: { tenantId: ctx.tenantId, isActive: true } })
      if (dbTaxes.length > 0) {
        prismaTaxes = dbTaxes.map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          rate: t.rate,
          type: t.type,
          isActive: t.isActive,
        }))
      }
    } catch { /* compliance JSON fallback */ }

    const taxConfigs = resolveTaxConfigs({ countryCode: 'GH', prismaTaxes })

    const { lines: taxLines, totalTax } = computeStackedTaxLines(taxableAmount, taxConfigs, 'sales')
    const taxAmount = round2(totalTax)
    const total = round2(taxableAmount + taxAmount)

    // ── Determine GL code per item based on venue ─────────────────────────────
    const revenueGL = venueGlAccount(body.venue)

    const reservationId = await resolveCheckedInReservationId({
      tenantId: ctx.tenantId,
      reservationId: body.reservationId,
      guestId: body.guestId,
      roomNumber: body.roomNumber,
    })

    const createOrder = (number: string) => prisma.$transaction(async (tx) => {
      if (body.quickService) {
        await drawReadyBoard(tx, ctx.tenantId, body.items)
      }
      return tx.fBOrder.create({
      data: {
        tenantId: ctx.tenantId,
        orderNumber: number,
        venue: body.venue,
        tableNumber: body.tableNumber,
        roomNumber: body.roomNumber,
        guestId: body.guestId,
        guestName: body.guestName,
        reservationId: reservationId ?? body.reservationId,
        serverName: body.serverName,
        notes: body.notes,
        covers: body.covers ?? 1,
        subtotal,
        discountAmount,
        serviceCharge,
        taxAmount,
        total,
        taxLines: taxLines as any,
        // Allow 'served' for express/quick-pay orders created by the POS cashier
        status: (body.status === 'served' ? 'served' : 'pending'),
        items: {
          create: body.items.map((item: any) => ({
            tenantId: ctx.tenantId,
            menuItemId: item.menuItemId ?? item.id,
            name: item.name,
            category: item.category,
            route: resolveItemRouteFromPayload(item),
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            amount: round2((item.unitPrice ?? 0) * (item.quantity ?? 1)),
            taxAmount: 0, // tax tracked at order level
            notes: item.notes,
            glAccountCode: revenueGL,
          })),
        },
      },
      include: { items: true },
    })
    })

    let order
    try {
      order = await createOrder(orderNumber)
    } catch (error) {
      if (!isDuplicateOrderNumber(error)) throw error
      orderNumber = await nextFreeOrderNumber(ctx.tenantId, orderNumber)
      order = await createOrder(orderNumber)
    }

    await createAuditLog(
      ctx.tenantId, sessionUserId ?? null,
      'FB_ORDER_CREATED', 'FBOrder', order.id,
      undefined,
      { orderNumber, venue: order.venue, subtotal, discountAmount, taxAmount, total },
      request
    )

    // Occupy table when an order is placed to the floor
    if (body.tableNumber) {
      try {
        const { syncRestaurantTableStatus } = await import('@/app/lib/fb/fbSaleAccountingServer')
        await syncRestaurantTableStatus({
          tenantId: ctx.tenantId,
          tableNumber: body.tableNumber,
          status: 'occupied',
        })
      } catch { /* table may not exist yet */ }
    }

    return NextResponse.json({
      order: serializeFbOrder(order),
      taxBreakdown: taxLines,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ReadyBoardError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[fb/orders][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
