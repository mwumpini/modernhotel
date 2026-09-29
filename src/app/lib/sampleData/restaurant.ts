import { SampleCtx, prisma, seedRows, bySampleId, atTime, dayString, round2 } from './common'
import { Entry, postEntries, posTaxLines, salesTax, cashAccountFor, hasChartOfAccounts } from './ledger'

// A starter menu, added only when the hotel has no menu of its own yet.
// key, name, category, venue, route, price, cost, GL
const MENU: Array<[string, string, string, string, string, number, number, string]> = [
  ['jollof', 'Jollof Rice & Chicken', 'food', 'restaurant', 'kitchen', 85, 28, '4210'],
  ['banku', 'Banku & Tilapia', 'food', 'restaurant', 'kitchen', 95, 32, '4210'],
  ['waakye', 'Waakye with Stew', 'food', 'restaurant', 'kitchen', 65, 20, '4210'],
  ['fufu', 'Fufu & Light Soup', 'food', 'restaurant', 'kitchen', 75, 22, '4210'],
  ['kelewele', 'Kelewele', 'snack', 'restaurant', 'kitchen', 30, 8, '4210'],
  ['club', 'Club Sandwich', 'food', 'restaurant', 'kitchen', 70, 22, '4210'],
  ['bfast', 'Continental Breakfast', 'food', 'restaurant', 'kitchen', 95, 30, '4210'],
  ['cake', 'Chocolate Cake', 'dessert', 'restaurant', 'kitchen', 40, 12, '4210'],
  ['star', 'Star Beer (Bottle)', 'beverage', 'bar', 'bar', 25, 10, '4210'],
  ['club_beer', 'Club Beer (Bottle)', 'beverage', 'bar', 'bar', 25, 10, '4210'],
  ['gin', 'Gin & Tonic', 'beverage', 'bar', 'bar', 40, 12, '4210'],
  ['wine', 'Red Wine (Glass)', 'beverage', 'bar', 'bar', 55, 20, '4210'],
  ['juice', 'Fresh Fruit Juice', 'beverage', 'bar', 'bar', 30, 8, '4210'],
  ['soda', 'Soft Drink (Can)', 'beverage', 'bar', 'bar', 15, 5, '4210'],
  ['water', 'Water (500ml)', 'beverage', 'bar', 'bar', 10, 3, '4210'],
  ['coffee', 'Coffee', 'beverage', 'bar', 'bar', 25, 6, '4210'],
]

type Order = {
  key: string; venue: 'restaurant' | 'bar'; status: 'pending' | 'preparing' | 'ready' | 'served' | 'billed'
  table: string; covers: number; server: string; items: Array<[string, number]>
  /** minutes ago (live kitchen orders) or [day offset, hour, minute] for past bills */
  at: number | [number, number, number]
  paid?: string // payment method, for billed orders
  notes?: string
}
// Items are named by menu name so the orders work against the hotel's own menu too.
const ORDERS: Order[] = [
  { key: 'o1', venue: 'restaurant', status: 'pending', table: 'T2', covers: 2, server: 'Efua Quaye', items: [['Jollof Rice & Chicken', 1], ['Banku & Tilapia', 1], ['Star Beer (Bottle)', 2]], at: 4, notes: 'One jollof extra spicy' },
  { key: 'o2', venue: 'restaurant', status: 'preparing', table: 'T5', covers: 4, server: 'Efua Quaye', items: [['Fufu & Light Soup', 2], ['Waakye with Stew', 2], ['Fresh Fruit Juice', 4]], at: 12 },
  { key: 'o3', venue: 'restaurant', status: 'ready', table: 'T3', covers: 1, server: 'Efua Quaye', items: [['Club Sandwich', 1], ['Soft Drink (Can)', 1]], at: 21 },
  { key: 'o4', venue: 'bar', status: 'served', table: 'T8', covers: 3, server: 'Kofi Adjei', items: [['Gin & Tonic', 2], ['Red Wine (Glass)', 1], ['Kelewele', 2]], at: 35, notes: 'Open tab — settle before leaving' },
  { key: 'o5', venue: 'restaurant', status: 'billed', table: 'T1', covers: 2, server: 'Efua Quaye', items: [['Jollof Rice & Chicken', 2], ['Soft Drink (Can)', 2]], at: [-1, 12, 40], paid: 'Cash' },
  { key: 'o6', venue: 'restaurant', status: 'billed', table: 'T6', covers: 4, server: 'Efua Quaye', items: [['Banku & Tilapia', 2], ['Fufu & Light Soup', 2], ['Chocolate Cake', 2], ['Water (500ml)', 4]], at: [-1, 19, 50], paid: 'Mobile Money' },
  { key: 'o7', venue: 'bar', status: 'billed', table: 'T8', covers: 2, server: 'Kofi Adjei', items: [['Star Beer (Bottle)', 4], ['Club Beer (Bottle)', 2], ['Kelewele', 1]], at: [-1, 21, 15], paid: 'Cash' },
  { key: 'o8', venue: 'restaurant', status: 'billed', table: 'T4', covers: 2, server: 'Efua Quaye', items: [['Continental Breakfast', 2], ['Coffee', 2]], at: [0, 7, 45], paid: 'Card' },
]

export async function loadRestaurant(ctx: SampleCtx): Promise<string[]> {
  const { p, tenantId } = ctx
  const notes: string[] = []

  // ---- menu: the hotel's own, or a starter one ----
  if ((await prisma.fBMenuItem.count({ where: { tenantId } })) === 0) {
    await seedRows(prisma.fBMenuItem, MENU.map(([key, name, category, venue, route, price, cost, gl], i) => ({
      id: `${p}menu_${key}`, tenantId, code: `SMP-${key.toUpperCase()}`, name, category, venue, route, unitPrice: price, costPrice: cost, glAccountCode: gl, isAvailable: true, prepMinutes: route === 'bar' ? 3 : 15, sortOrder: i,
    })))
    notes.push('This hotel had no menu yet, so a starter menu of 16 dishes and drinks was added.')
  }
  const menu = await prisma.fBMenuItem.findMany({ where: { tenantId, isAvailable: true } })
  const find = (name: string) => menu.find((m) => m.name === name) || menu.find((m) => m.name.toLowerCase().startsWith(name.split(' ')[0].toLowerCase()))

  // ---- orders ----
  const now = Date.now()
  const orderRows: Array<Record<string, any>> = []
  const itemRows: Array<Record<string, any>> = []
  const billed: Array<{ order: Order; id: string; number: string; when: Date; net: number; cost: number }> = []
  ORDERS.forEach((o, i) => {
    const id = `${p}fb_${o.key}`
    const number = `SMP-FB-${String(i + 1).padStart(3, '0')}`
    const when = typeof o.at === 'number' ? new Date(now - o.at * 60_000) : atTime(ctx, o.at[0], o.at[1], o.at[2])
    let net = 0, cost = 0
    o.items.forEach(([name, quantity], n) => {
      const m = find(name)
      if (!m) return
      const unitPrice = Number(m.unitPrice)
      net += unitPrice * quantity
      cost += Number(m.costPrice) * quantity
      itemRows.push({ id: `${id}_i${n + 1}`, tenantId, orderId: id, menuItemId: m.id, name: m.name, category: m.category, route: m.route, quantity, unitPrice, amount: round2(unitPrice * quantity), glAccountCode: m.glAccountCode, createdAt: when })
    })
    net = round2(net)
    const tax = salesTax(net)
    const live = o.status !== 'billed'
    orderRows.push({
      id, tenantId, orderNumber: number, venue: o.venue, status: o.status, tableNumber: o.table, serverName: o.server, covers: o.covers, guestName: live ? null : 'Walk-in guest',
      subtotal: net, taxAmount: tax.total, total: round2(net + tax.total), taxLines: posTaxLines(net), notes: o.notes, priority: 'normal', createdAt: when,
      preparingAt: ['preparing', 'ready', 'served', 'billed'].includes(o.status) ? new Date(when.getTime() + 2 * 60_000) : null,
      servedAt: ['served', 'billed'].includes(o.status) ? new Date(when.getTime() + 20 * 60_000) : null,
      billedAt: o.status === 'billed' ? new Date(when.getTime() + 45 * 60_000) : null,
    })
    if (o.status === 'billed') billed.push({ order: o, id, number, when: new Date(when.getTime() + 45 * 60_000), net, cost: round2(cost) })
  })
  await seedRows(prisma.fBOrder, orderRows)
  await seedRows(prisma.fBOrderItem, itemRows)

  // ---- the paid bills in accounting: receivable, receipt, and cost of sales ----
  if (await hasChartOfAccounts(ctx)) {
    const invoices: Array<Record<string, any>> = []
    const payments: Array<Record<string, any>> = []
    const entries: Entry[] = []
    for (const b of billed) {
      const tax = salesTax(b.net)
      const gross = round2(b.net + tax.total)
      const cc = b.order.venue === 'bar' ? 'BAR' : 'REST'
      const method = b.order.paid!
      invoices.push({
        id: `${p}inv_${b.order.key}`, tenantId, invoiceNumber: `SMP-INV-${b.number.slice(-3)}`, type: 'Sales', date: b.when, reference: b.number,
        description: `${b.order.venue} sale — Table ${b.order.table} — ${b.number}`, subtotal: b.net, taxAmount: tax.total, total: gross, status: 'Paid', paidAmount: gross, paidDate: b.when,
        journalEntryId: `${p}je_fb_${b.order.key}`, sourceModule: 'restaurant', details: { customerName: 'Walk-in guest', staffName: b.order.server },
      })
      payments.push({
        id: `${p}rcp_${b.order.key}`, tenantId, paymentNumber: `SMP-RCP-${b.number.slice(-3)}`, date: b.when, type: 'Receipt', invoiceId: `${p}inv_${b.order.key}`, reference: b.number,
        description: `Payment for ${b.order.venue} order ${b.number}`, amount: gross, paymentMethod: method, status: 'Posted', journalEntryId: `${p}je_fbpay_${b.order.key}`,
        details: { sourceModule: 'restaurant', customerName: 'Walk-in guest', staffName: b.order.server },
      })
      entries.push(
        {
          id: `${p}je_fb_${b.order.key}`, entryNumber: `SMP-JE-FB-${b.number.slice(-3)}`, date: b.when, reference: b.number, description: `Auto-posted: F&B sale ${b.number}`, sourceModule: 'restaurant', sourceTransactionId: b.id,
          lines: [
            { account: '1210', description: `AR — ${b.number}`, debit: gross, costCenter: cc },
            { account: '4210', description: `Revenue — ${b.number}`, credit: b.net, costCenter: cc },
            ...tax.lines.map((l) => ({ account: l.accountCode, description: `${l.name} — ${b.number}`, credit: l.amount, costCenter: cc })),
          ],
        },
        {
          id: `${p}je_fbpay_${b.order.key}`, entryNumber: `SMP-JE-FBPAY-${b.number.slice(-3)}`, date: b.when, reference: b.number, description: `Auto-posted: Payment ${method} — ${b.number}`, sourceModule: 'restaurant', sourceTransactionId: `pay:${b.id}`,
          lines: [
            { account: cashAccountFor(method), description: `${method} — ${b.number}`, debit: gross, costCenter: cc },
            { account: '1210', description: `Clear AR — ${b.number}`, credit: gross, costCenter: cc },
          ],
        },
        ...(b.cost > 0 ? [{
          id: `${p}je_fbcogs_${b.order.key}`, entryNumber: `SMP-JE-COGS-${b.number.slice(-3)}`, date: b.when, reference: b.number, description: `Auto-posted: F&B COGS — ${b.number}`, sourceModule: 'restaurant', sourceTransactionId: `cogs:${b.id}`,
          lines: [
            { account: '5110', description: `COGS — ${b.number}`, debit: b.cost, costCenter: cc },
            { account: '1310', description: `Inventory issue — ${b.number}`, credit: b.cost, costCenter: cc },
          ],
        }] : []),
      )
    }
    await seedRows(prisma.accountingInvoice, invoices)
    await seedRows(prisma.accountingInvoiceLine, billed.map((b) => ({
      id: `${p}invl_${b.order.key}`, tenantId, invoiceId: `${p}inv_${b.order.key}`, description: `${b.order.venue === 'bar' ? 'Bar' : 'Restaurant'} sale ${b.number}`, quantity: 1, unitPrice: b.net, amount: b.net, taxAmount: salesTax(b.net).total, glAccountCode: '4210',
    })))
    await seedRows(prisma.accountingPayment, payments)
    const skipped = await postEntries(ctx, entries)
    if (skipped.length) notes.push(`Some restaurant postings were skipped: ${skipped.join(', ')}`)

    // Yesterday's restaurant till, closed and counted — cash takings match the cash bills above.
    const yesterday = billed.filter((b) => b.when < ctx.today)
    const totalBy = (re: RegExp) => round2(yesterday.filter((b) => re.test(b.order.paid!)).reduce((s, b) => s + b.net + salesTax(b.net).total, 0))
    const cash = totalBy(/cash/i)
    await seedRows(prisma.cashierShift, [{
      id: `${p}till_fb`, tenantId, outlet: 'restaurant', businessDate: dayString(ctx, -1), cashierUserId: 'sample-cashier', cashierName: 'Kofi Adjei (sample)',
      openingFloat: 300, openedAt: atTime(ctx, -1, 11, 0), closedAt: atTime(ctx, -1, 23, 10), expectedCash: round2(300 + cash), closingCount: round2(300 + cash - 5), variance: -5,
      totalCash: cash, totalCard: totalBy(/card/i), totalMobileMoney: totalBy(/mobile/i), totalOther: 0, status: 'closed', notes: 'GHS 5 short — noted on the handover sheet',
    }])
  }

  // ---- table bookings ----
  const tables = await prisma.restaurantTable.findMany({ where: { tenantId }, select: { id: true, number: true, capacity: true } })
  const table = (min: number) => tables.find((t) => t.capacity >= min)?.id
  await seedRows(prisma.tableReservation, [
    { id: `${p}tres_1`, tenantId, customerName: 'Mr. & Mrs. Amoako', phone: '+233 24 811 0001', tableId: table(2), reservationDate: ctx.today, time: '19:30', guests: 2, status: 'confirmed', specialRequests: 'Anniversary — quiet corner please' },
    { id: `${p}tres_2`, tenantId, customerName: 'Sample Mining Ltd team', phone: '+233 30 811 0002', tableId: table(8), reservationDate: ctx.today, time: '20:00', guests: 8, status: 'confirmed', specialRequests: 'Bill to company account' },
    { id: `${p}tres_3`, tenantId, customerName: 'Esi Badu', phone: '+233 20 811 0003', tableId: table(4), reservationDate: new Date(ctx.today.getTime() + 86_400_000), time: '13:00', guests: 4, status: 'pending' },
    { id: `${p}tres_4`, tenantId, customerName: 'Yaw Darko', phone: '+233 27 811 0004', tableId: table(2), reservationDate: new Date(ctx.today.getTime() - 86_400_000), time: '19:00', guests: 2, status: 'completed' },
  ])
  return notes
}

export async function removeRestaurant(ctx: SampleCtx) {
  const where = bySampleId(ctx)
  await prisma.tableReservation.deleteMany({ where })
  await prisma.cashierShift.deleteMany({ where })
  // (the bills' invoices, receipts and postings go with the accounting sample data)
  await prisma.fBOrder.deleteMany({ where }) // items go with their order
  await prisma.fBMenuItem.deleteMany({ where })
}

export async function countRestaurant(ctx: SampleCtx) {
  return { restaurantOrders: await prisma.fBOrder.count({ where: bySampleId(ctx) }) }
}
