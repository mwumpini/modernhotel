import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { resolveTaxConfigs, type PrismaTaxRow } from '@/app/lib/tax/resolveConfigs'
import { computeStackedTaxLines } from '@/app/lib/accounting/taxFromConfig'
import { resolveItemRouteFromPayload, serializeFbOrder } from '@/app/lib/fb/serializeOrder'

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100 }

/** Map venue to correct GL revenue account */
function venueGL(venue: string): string {
  switch (venue) {
    case 'restaurant': return '4210'
    case 'bar':
    case 'pool_bar':   return '4220'
    case 'room_service': return '4230'
    default:           return '4200'
  }
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

    return NextResponse.json({
      orders: orders.map(o => serializeFbOrder(o, menuRouteById)),
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
    const orderCount = await prisma.fBOrder.count({ where: { tenantId: ctx.tenantId } })
    const orderNumber = `FB-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`

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
    const revenueGL = venueGL(body.venue)

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

    await createAuditLog(
      ctx.tenantId, null,
      'FB_ORDER_CREATED', 'FBOrder', order.id,
      undefined,
      { orderNumber, venue: order.venue, subtotal, taxAmount, total },
      request
    )

    return NextResponse.json({
      order: serializeFbOrder(order),
      taxBreakdown: taxLines,
    }, { status: 201 })
  } catch (error) {
    console.error('[fb/orders][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
