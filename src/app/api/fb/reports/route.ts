import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

/**
 * Real F&B sales report slices from DB orders + accounting receipts
 * (replaces hardcoded 40/45/10/5 payment mix in reportingStore).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const dayStart = new Date(`${date}T00:00:00.000Z`)
    const dayEnd = new Date(`${date}T23:59:59.999Z`)

    const orders = await prisma.fBOrder.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ['billed', 'refunded', 'served', 'ready', 'preparing', 'pending'] },
        OR: [
          { billedAt: { gte: dayStart, lte: dayEnd } },
          { createdAt: { gte: dayStart, lte: dayEnd } },
        ],
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })

    const billed = orders.filter((o) => o.status === 'billed')
    const totalSales = billed.reduce((s, o) => s + Number(o.total || 0), 0)

    const payments = await prisma.accountingPayment.findMany({
      where: {
        tenantId: ctx.tenantId,
        type: 'Receipt',
        status: { not: 'Void' },
        date: { gte: dayStart, lte: dayEnd },
      },
    })

    const fbPayments = payments.filter((p) => {
      const d = (p.details && typeof p.details === 'object' ? p.details : {}) as Record<string, any>
      const src = String(d.sourceModule || '')
      return src === 'restaurant' || src === 'bar' || src === 'room_service'
    })

    const paymentBreakdown = { cash: 0, card: 0, mobile: 0, roomCharge: 0, other: 0 }
    for (const p of fbPayments) {
      const amt = Number(p.amount || 0)
      switch (p.paymentMethod) {
        case 'Cash':
          paymentBreakdown.cash += amt
          break
        case 'Card':
          paymentBreakdown.card += amt
          break
        case 'Mobile Money':
          paymentBreakdown.mobile += amt
          break
        default:
          paymentBreakdown.other += amt
          break
      }
    }

    // Room charges = billed orders with folio that aren't in walk-in receipts
    const roomChargeSales = billed
      .filter((o) => o.folioId)
      .reduce((s, o) => s + Number(o.total || 0), 0)
    paymentBreakdown.roomCharge = roomChargeSales

    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const o of billed) {
      for (const it of o.items) {
        const key = it.name
        const prev = itemMap.get(key) || { name: it.name, quantity: 0, revenue: 0 }
        prev.quantity += Number(it.quantity || 0)
        prev.revenue += Number(it.amount || 0)
        itemMap.set(key, prev)
      }
    }
    const topSellingItems = Array.from(itemMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    const byVenue: Record<string, number> = {}
    for (const o of billed) {
      byVenue[o.venue] = (byVenue[o.venue] || 0) + Number(o.total || 0)
    }

    return NextResponse.json({
      date,
      totalSales,
      totalOrders: billed.length,
      averageOrderValue: billed.length ? totalSales / billed.length : 0,
      paymentBreakdown,
      topSellingItems,
      byVenue,
      openOrders: orders.filter((o) => !['billed', 'refunded', 'cancelled'].includes(o.status)).length,
    })
  } catch (error) {
    console.error('[fb/reports][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
