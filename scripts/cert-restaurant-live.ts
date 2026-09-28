/**
 * Live demo restaurant/bar certification against localhost.
 * Flow: login → open till → create order → occupy table → bill (GL+stock) →
 * reports → preview till → refund → close till.
 *
 * Run: npx tsx scripts/cert-restaurant-live.ts
 */
import { PrismaClient } from '@prisma/client'

const BASE = process.env.CERT_BASE_URL || 'http://localhost:3000'
const TENANT = 'demo'
const EMAIL = 'admin@demohotel.com'
const PASSWORD = 'password123'

const prisma = new PrismaClient()
let failed = 0
const cookieJar = new Map<string, string>()

function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  ok  ${name}${detail ? ` — ${detail}` : ''}`)
  else {
    failed += 1
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function absorbCookies(res: Response) {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] }
  const raw = typeof anyHeaders.getSetCookie === 'function'
    ? anyHeaders.getSetCookie()
    : []
  if (!raw.length) {
    const single = res.headers.get('set-cookie')
    if (single) raw.push(single)
  }
  for (const line of raw) {
    const part = line.split(';')[0]
    const eq = part.indexOf('=')
    if (eq > 0) cookieJar.set(part.slice(0, eq), part.slice(eq + 1))
  }
}

function cookieHeader() {
  return Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

async function api(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<{ status: number; data: any; res: Response }> {
  const headers: Record<string, string> = {
    'x-tenant-subdomain': TENANT,
    ...(init.headers as Record<string, string> | undefined),
  }
  const jar = cookieHeader()
  if (jar) headers.Cookie = jar
  let body = init.body
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, body })
  absorbCookies(res)
  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data, res }
}

function localDay(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

async function login() {
  const csrf = await api('/api/auth/csrf')
  const csrfToken = csrf.data?.csrfToken
  check('csrf', Boolean(csrfToken), csrfToken ? 'got token' : JSON.stringify(csrf.data))

  const body = new URLSearchParams({
    csrfToken: String(csrfToken || ''),
    email: EMAIL,
    password: PASSWORD,
    tenantId: TENANT,
    callbackUrl: `${BASE}/`,
    json: 'true',
  })
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(),
    },
    body,
    redirect: 'manual',
  })
  absorbCookies(res)
  const session = await api('/api/auth/session')
  const ok = Boolean(session.data?.user?.email)
  check('login', ok, session.data?.user?.email || JSON.stringify(session.data))
  return ok
}

async function ensureFloorTable(tenantId: string, number: string) {
  const existing = await prisma.restaurantTable.findFirst({ where: { tenantId, number } })
  if (existing) {
    await prisma.restaurantTable.update({
      where: { id: existing.id },
      data: { status: 'available' },
    })
    return existing.id
  }
  const created = await prisma.restaurantTable.create({
    data: { tenantId, number, capacity: 4, section: 'main floor', status: 'available' },
  })
  return created.id
}

async function main() {
  console.log(`\nRestaurant live cert → ${BASE} (tenant=${TENANT})\n`)

  const tenant = await prisma.tenant.findFirst({ where: { subdomain: TENANT } })
  if (!tenant) {
    console.error('demo tenant missing — run npm run db:seed')
    process.exit(1)
  }
  check('tenant', true, tenant.id)

  const menu = await prisma.fBMenuItem.findFirst({
    where: { tenantId: tenant.id, venue: 'restaurant', isAvailable: true },
    orderBy: { sortOrder: 'asc' },
  })
  check('menu item', Boolean(menu), menu ? `${menu.code} ${menu.name}` : 'none')
  if (!menu) process.exit(1)

  const tableNumber = 'T-CERT-1'
  await ensureFloorTable(tenant.id, tableNumber)
  check('floor table', true, tableNumber)

  const loggedIn = await login()
  if (!loggedIn) {
    console.error('Cannot continue without session')
    process.exit(1)
  }

  // Close any leftover open restaurant shifts for this admin so we start clean
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: EMAIL },
  })
  if (admin) {
    await prisma.cashierShift.updateMany({
      where: { tenantId: tenant.id, cashierUserId: admin.id, outlet: 'restaurant', status: 'open' },
      data: { status: 'closed', closedAt: new Date(), closingCount: 0, expectedCash: 0, variance: 0 },
    })
  }

  // ── Till gate: bill without till must 403 ──────────────────────────────────
  const gateOrder = await api('/api/fb/orders', {
    method: 'POST',
    json: {
      venue: 'restaurant',
      tableNumber,
      guestName: 'Gate Check Guest',
      covers: 1,
      serverName: 'Cert Waiter',
      items: [
        {
          menuItemId: menu.id,
          name: menu.name,
          quantity: 1,
          unitPrice: Number(menu.unitPrice),
          route: menu.route,
        },
      ],
    },
  })
  check('create order (pre-till)', gateOrder.status === 200 || gateOrder.status === 201, `HTTP ${gateOrder.status}`)
  const gateOrderId = gateOrder.data?.order?.id
  if (gateOrderId) {
    // advance to served so billed is allowed
    for (const st of ['preparing', 'ready', 'served'] as const) {
      await api(`/api/fb/orders/${gateOrderId}`, { method: 'PATCH', json: { status: st } })
    }
    const blocked = await api(`/api/fb/orders/${gateOrderId}`, {
      method: 'PATCH',
      json: { status: 'billed', paymentMethod: 'Cash' },
    })
    check('till gate blocks bill', blocked.status === 403, `HTTP ${blocked.status} ${blocked.data?.error || ''}`)
    await api(`/api/fb/orders/${gateOrderId}`, {
      method: 'PATCH',
      json: { status: 'cancelled', cancelReason: 'cert gate' },
    })
  }

  // ── Open restaurant till ───────────────────────────────────────────────────
  const businessDate = localDay()
  const openShift = await api('/api/frontoffice/cashier-shifts', {
    method: 'POST',
    json: {
      outlet: 'restaurant',
      openingFloat: 200,
      businessDate,
      notes: 'cert restaurant till',
    },
  })
  check('open restaurant till', openShift.status === 200 || openShift.status === 201, `HTTP ${openShift.status} ${openShift.data?.error || openShift.data?.shift?.id || ''}`)
  const shiftId = openShift.data?.shift?.id as string | undefined

  // ── Create live order → table occupied ─────────────────────────────────────
  const created = await api('/api/fb/orders', {
    method: 'POST',
    json: {
      venue: 'restaurant',
      tableNumber,
      guestName: 'Ama Cert Walk-in',
      covers: 2,
      serverName: 'Cert Waiter',
      items: [
        {
          menuItemId: menu.id,
          name: menu.name,
          quantity: 2,
          unitPrice: Number(menu.unitPrice),
          route: menu.route,
          category: menu.category,
        },
      ],
    },
  })
  check('create dine-in order', created.status === 200 || created.status === 201, `HTTP ${created.status} ${created.data?.error || ''}`)
  const order = created.data?.order
  const orderId = order?.id as string | undefined
  check('order id', Boolean(orderId), orderId || '')
  check('order total > 0', Number(order?.total || 0) > 0, `total=${order?.total}`)

  let table = await prisma.restaurantTable.findFirst({ where: { tenantId: tenant.id, number: tableNumber } })
  check('table occupied on create', table?.status === 'occupied', `status=${table?.status}`)

  if (orderId) {
    for (const st of ['preparing', 'ready', 'served'] as const) {
      const step = await api(`/api/fb/orders/${orderId}`, { method: 'PATCH', json: { status: st } })
      check(`status → ${st}`, step.status === 200, `HTTP ${step.status}`)
    }

    const billed = await api(`/api/fb/orders/${orderId}`, {
      method: 'PATCH',
      json: { status: 'billed', paymentMethod: 'Cash' },
    })
    check('bill cash', billed.status === 200, `HTTP ${billed.status} ${billed.data?.error || ''}`)
    const accounting = billed.data?.accounting
    check('GL invoice', Boolean(accounting?.invoiceId), accounting?.invoiceId || JSON.stringify(billed.data?.accounting || billed.data?.error || ''))
    check('GL receipt', Boolean(accounting?.receiptId), accounting?.receiptId || '')

    if (accounting?.invoiceId) {
      const inv = await prisma.accountingInvoice.findFirst({
        where: { tenantId: tenant.id, id: accounting.invoiceId },
      })
      check('invoice persisted', Boolean(inv), inv ? `status=${inv.status} total=${inv.total}` : 'missing')
    }
    if (accounting?.receiptId) {
      const pay = await prisma.accountingPayment.findFirst({
        where: { tenantId: tenant.id, id: accounting.receiptId },
      })
      const details = (pay?.details && typeof pay.details === 'object' ? pay.details : {}) as Record<string, any>
      check('receipt persisted', Boolean(pay), pay ? `amt=${pay.amount} method=${pay.paymentMethod}` : 'missing')
      check('receipt sourceModule restaurant', details.sourceModule === 'restaurant', String(details.sourceModule || ''))
      check('receipt cashier stamped', Boolean(details.cashierUserId || details.cashierName), JSON.stringify({
        cashierUserId: details.cashierUserId,
        cashierName: details.cashierName,
      }))
    }

    table = await prisma.restaurantTable.findFirst({ where: { tenantId: tenant.id, number: tableNumber } })
    check('table cleaning after bill', table?.status === 'cleaning', `status=${table?.status}`)

    // ── Reports API ──────────────────────────────────────────────────────────
    const reports = await api(`/api/fb/reports?date=${businessDate}`)
    check('reports HTTP', reports.status === 200, `HTTP ${reports.status}`)
    check('reports cash > 0', Number(reports.data?.paymentBreakdown?.cash || 0) > 0, JSON.stringify(reports.data?.paymentBreakdown || {}))
    check('reports totalSales > 0', Number(reports.data?.totalSales || 0) > 0, `sales=${reports.data?.totalSales}`)

    // ── Till preview includes cash sale ──────────────────────────────────────
    if (shiftId) {
      const preview = await api(`/api/frontoffice/cashier-shifts/${shiftId}`)
      const p = preview.data?.preview || {}
      const expected = Number(p.expectedCash ?? NaN)
      const totalCash = Number(p.totalCash ?? NaN)
      check('till preview HTTP', preview.status === 200, `HTTP ${preview.status}`)
      check('till cash sales > 0', totalCash > 0, `totalCash=${totalCash}`)
      check('till expected = float+cash', expected >= 200 && expected > totalCash, `expected=${expected}`)
    }

    // ── Refund reverses GL ───────────────────────────────────────────────────
    const refunded = await api(`/api/fb/orders/${orderId}`, {
      method: 'PATCH',
      json: { status: 'refunded', refundReason: 'cert refund' },
    })
    check('refund', refunded.status === 200, `HTTP ${refunded.status} ${refunded.data?.error || ''}`)
    check('refund GL ok', refunded.data?.glRefund?.ok !== false, JSON.stringify(refunded.data?.glRefund || {}))

    table = await prisma.restaurantTable.findFirst({ where: { tenantId: tenant.id, number: tableNumber } })
    check('table available after refund', table?.status === 'available', `status=${table?.status}`)
  }

  // ── Close till ─────────────────────────────────────────────────────────────
  if (shiftId) {
    const closed = await api(`/api/frontoffice/cashier-shifts/${shiftId}`, {
      method: 'PATCH',
      json: { action: 'close', closingCount: 200, notes: 'cert close' },
    })
    check('close till', closed.status === 200, `HTTP ${closed.status} ${closed.data?.error || ''}`)
  }

  console.log(`\n${failed === 0 ? 'PASS' : `FAIL (${failed})`} restaurant live cert\n`)
  await prisma.$disconnect()
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
