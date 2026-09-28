import { SampleCtx, prisma, seedRows, bySampleId, sampleIds, dayOffset, round2 } from './common'
import { ensureDepartmentLocations, getDepartmentLocationId } from '../inventory/repository'

const UNITS: Array<[string, string]> = [['KG', 'Kilogram'], ['LTR', 'Litre'], ['PCS', 'Piece'], ['BAG', 'Bag'], ['CRATE', 'Crate'], ['CTN', 'Carton']]
const CATEGORIES: Array<[string, string]> = [['FOOD', 'Food & Produce'], ['BEV', 'Beverages'], ['HK', 'Housekeeping'], ['MNT', 'Maintenance']]

const SUPPLIERS = [
  { key: 'fresh', name: 'Accra Fresh Foods Ltd', contact: 'Yaa Asantewaa', phone: '+233 30 200 1001', email: 'orders@accrafresh.sample.hotel', city: 'Accra' },
  { key: 'bev', name: 'Ghana Beverages Distribution', contact: 'Kojo Bediako', phone: '+233 30 200 1002', email: 'sales@ghanabev.sample.hotel', city: 'Tema' },
  { key: 'linen', name: 'Kumasi Linen & Supplies', contact: 'Adjoa Pokuaa', phone: '+233 32 200 1003', email: 'info@kumasilinen.sample.hotel', city: 'Kumasi' },
  { key: 'clean', name: 'Tema Cleaning Supplies', contact: 'Selorm Agbenu', phone: '+233 30 200 1004', email: 'hello@temaclean.sample.hotel', city: 'Tema' },
]

// key, name, category, unit, supplier, cost, selling price (for resale), on hand, reorder level, minimum, maximum, perishable
type Item = [string, string, string, string, string, number, number | null, number, number, number, number, boolean]
const ITEMS: Item[] = [
  ['rice', 'Rice (25kg bag)', 'FOOD', 'BAG', 'fresh', 320, null, 18, 8, 5, 40, false],
  ['chicken', 'Chicken (whole)', 'FOOD', 'KG', 'fresh', 42, null, 55, 25, 15, 100, true],
  ['tomato', 'Tomatoes', 'FOOD', 'KG', 'fresh', 18, null, 30, 15, 10, 60, true],
  ['oil', 'Cooking Oil', 'FOOD', 'LTR', 'fresh', 38, null, 6, 12, 8, 60, false],
  ['plantain', 'Plantain', 'FOOD', 'KG', 'fresh', 12, null, 40, 20, 10, 80, true],
  ['fish', 'Fresh Tilapia', 'FOOD', 'KG', 'fresh', 55, null, 22, 12, 8, 50, true],
  ['flour', 'Flour (25kg bag)', 'FOOD', 'BAG', 'fresh', 280, null, 9, 4, 3, 20, false],
  ['star', 'Star Beer (crate of 24)', 'BEV', 'CRATE', 'bev', 190, 600, 4, 8, 5, 30, false],
  ['club', 'Club Beer (crate of 24)', 'BEV', 'CRATE', 'bev', 185, 600, 12, 8, 5, 30, false],
  ['water', 'Bottled Water 500ml (carton of 24)', 'BEV', 'CTN', 'bev', 45, 240, 25, 10, 6, 60, false],
  ['soda', 'Soft Drinks (crate of 24)', 'BEV', 'CRATE', 'bev', 95, 360, 14, 8, 5, 30, false],
  ['towel', 'Bath Towels', 'HK', 'PCS', 'linen', 65, null, 80, 40, 30, 150, false],
  ['sheet', 'Bed Sheets (queen)', 'HK', 'PCS', 'linen', 90, null, 60, 30, 20, 120, false],
  ['tissue', 'Toilet Rolls (carton of 48)', 'HK', 'CTN', 'clean', 110, null, 5, 10, 6, 40, false],
  ['detergent', 'Laundry Detergent', 'HK', 'KG', 'clean', 28, null, 35, 15, 10, 60, false],
  ['bulb', 'LED Light Bulbs', 'MNT', 'PCS', 'clean', 15, null, 60, 20, 10, 100, false],
]

// item key -> [department, quantity] moved out of the main store
const TRANSFERS: Array<[string, 'kitchen' | 'restaurant', number]> = [
  ['rice', 'kitchen', 4], ['chicken', 'kitchen', 15], ['tomato', 'kitchen', 8], ['oil', 'kitchen', 3], ['plantain', 'kitchen', 10],
  ['star', 'restaurant', 3], ['club', 'restaurant', 4], ['water', 'restaurant', 5], ['soda', 'restaurant', 4],
]

/** The row for a shared reference (unit / category) — the hotel's own if it already has one with this code, else a sample one. */
async function ensureRef(model: any, ctx: SampleCtx, code: string, name: string, extra: Record<string, any>): Promise<string> {
  const existing = await model.findFirst({ where: { tenantId: ctx.tenantId, code } })
  if (existing) return existing.id
  const id = `${ctx.p}${code.toLowerCase()}`
  await seedRows(model, [{ id, tenantId: ctx.tenantId, code, name, ...extra }])
  return id
}

export async function loadInventory(ctx: SampleCtx) {
  const { p, tenantId } = ctx
  const unitId = new Map<string, string>()
  for (const [code, name] of UNITS) unitId.set(code, await ensureRef(prisma.unitOfMeasure, ctx, code, name, { precision: code === 'KG' || code === 'LTR' ? 2 : 0 }))
  const categoryId = new Map<string, string>()
  for (const [code, name] of CATEGORIES) categoryId.set(code, await ensureRef(prisma.itemCategory, ctx, code, name, {}))

  await seedRows(prisma.supplier, SUPPLIERS.map((s, i) => ({
    id: `${p}sup_${s.key}`, tenantId, code: `SMP-SUP-${String(i + 1).padStart(2, '0')}`, name: s.name, contactPerson: s.contact, phone: s.phone, email: s.email,
    address: { street: 'Sample Street', city: s.city, country: 'Ghana' }, isActive: true,
  })))

  const itemId = (key: string) => `${p}item_${key}`
  await seedRows(prisma.inventoryItem, ITEMS.map(([key, name, category, unit, supplier, cost, price, onHand, reorder, min, max, perishable], i) => ({
    id: itemId(key), tenantId, code: `SMP-ITM-${String(i + 1).padStart(3, '0')}`, name, categoryId: categoryId.get(category), unitId: unitId.get(unit),
    supplierId: `${p}sup_${supplier}`, defaultCost: cost, sellingPrice: price, quantityOnHand: onHand, reorderLevel: reorder, minimumStock: min, maximumStock: max,
    location: 'Main Store', isPerishable: perishable, isActive: true,
  })))

  // Opening stock in the main store, then the moves out to the kitchen and restaurant.
  await ensureDepartmentLocations(tenantId)
  const location = { kitchen: await getDepartmentLocationId(tenantId, 'kitchen'), restaurant: await getDepartmentLocationId(tenantId, 'restaurant') }
  const transactions: Array<Record<string, any>> = ITEMS.map(([key, , , , , cost, , onHand]) => ({
    id: `${p}tx_open_${key}`, tenantId, itemId: itemId(key), type: 'receipt', quantity: onHand, unitCost: cost, referenceType: 'manual', notes: 'Opening stock (sample)', performedBy: 'Sample Storekeeper',
  }))
  for (const [key, department, quantity] of TRANSFERS) {
    const ref = `${p}xfer_${key}`
    transactions.push(
      { id: `${ref}_out`, tenantId, itemId: itemId(key), type: 'transfer_out', quantity: -quantity, referenceType: 'transfer', referenceId: ref, notes: `To ${department} (sample)`, performedBy: 'Sample Storekeeper' },
      { id: `${ref}_in`, tenantId, itemId: itemId(key), locationId: location[department], type: 'transfer_in', quantity, referenceType: 'transfer', referenceId: ref, notes: `To ${department} (sample)`, performedBy: 'Sample Storekeeper' },
    )
  }
  await seedRows(prisma.inventoryTransaction, transactions)

  // Purchase orders: one already delivered, one out with the supplier.
  const itemRow = (key: string) => ITEMS.find((x) => x[0] === key)!
  const orderLines = (lines: Array<[string, number]>, poId: string) => lines.map(([key, quantity], n) => {
    const [, name, , , , cost] = itemRow(key)
    return { id: `${poId}_l${n + 1}`, tenantId, purchaseOrderId: poId, itemId: itemId(key), itemCode: `SMP-ITM-${String(ITEMS.findIndex((x) => x[0] === key) + 1).padStart(3, '0')}`, itemName: name, quantity, unitCost: cost, totalCost: round2(quantity * cost) }
  })
  const po1 = `${p}po_1`, po2 = `${p}po_2`
  const lines1 = orderLines([['rice', 10], ['chicken', 30], ['tomato', 20]], po1).map((l) => ({ ...l, receivedQuantity: l.quantity }))
  const lines2 = orderLines([['star', 6], ['club', 4], ['soda', 5]], po2)
  const total = (lines: Array<{ totalCost: number }>) => round2(lines.reduce((s, l) => s + l.totalCost, 0))
  await seedRows(prisma.purchaseOrder, [
    { id: po1, tenantId, poNumber: 'SMP-PO-001', supplierId: `${p}sup_fresh`, supplierName: SUPPLIERS[0].name, orderDate: dayOffset(ctx, -10), expectedDeliveryDate: dayOffset(ctx, -7), actualDeliveryDate: dayOffset(ctx, -7), status: 'delivered', priority: 'medium', totalAmount: total(lines1), finalAmount: total(lines1), paymentTerms: 'Net 30', createdBy: 'Sample Storekeeper', approvedBy: 'Sample Manager', approvedAt: dayOffset(ctx, -10) },
    { id: po2, tenantId, poNumber: 'SMP-PO-002', supplierId: `${p}sup_bev`, supplierName: SUPPLIERS[1].name, orderDate: dayOffset(ctx, -2), expectedDeliveryDate: dayOffset(ctx, 3), status: 'sent', priority: 'high', totalAmount: total(lines2), finalAmount: total(lines2), paymentTerms: 'Net 14', createdBy: 'Sample Storekeeper', approvedBy: 'Sample Manager', approvedAt: dayOffset(ctx, -2) },
  ])
  await seedRows(prisma.purchaseOrderItem, [...lines1, ...lines2])

  // Requisitions: the kitchen is waiting on one, the bar's was approved.
  const req1 = `${p}req_1`, req2 = `${p}req_2`
  const reqLines = (lines: Array<[string, number]>, reqId: string) => lines.map(([key, quantity], n) => {
    const [, name, , , , cost] = itemRow(key)
    return { id: `${reqId}_l${n + 1}`, tenantId, requisitionId: reqId, itemId: itemId(key), itemCode: `SMP-ITM-${String(ITEMS.findIndex((x) => x[0] === key) + 1).padStart(3, '0')}`, itemName: name, quantity, estimatedPrice: cost, totalCost: round2(quantity * cost) }
  })
  await seedRows(prisma.requisition, [
    { id: req1, tenantId, requisitionNumber: 'SMP-REQ-001', requestedBy: 'Nana Yaa Asare', requestedDate: dayOffset(ctx, -1), status: 'pending', department: 'kitchen', notes: 'Weekend banquet prep' },
    { id: req2, tenantId, requisitionNumber: 'SMP-REQ-002', requestedBy: 'Kofi Adjei', requestedDate: dayOffset(ctx, -3), status: 'approved', department: 'restaurant', approvedBy: 'Sample Manager', approvedAt: dayOffset(ctx, -2), notes: 'Bar restock' },
  ])
  await seedRows(prisma.requisitionItem, [...reqLines([['rice', 5], ['oil', 6], ['fish', 10]], req1), ...reqLines([['star', 4], ['water', 6]], req2)])
}

/** Removes what loadInventory made, plus anything a tester attached to it; returns what couldn't be removed. */
export async function removeInventory(ctx: SampleCtx): Promise<string[]> {
  const kept: string[] = []
  const attempt = async (label: string, run: () => Promise<unknown>) => {
    try { await run() } catch { kept.push(label) }
  }
  const itemIds = await sampleIds(prisma.inventoryItem, ctx)
  const poIds = await sampleIds(prisma.purchaseOrder, ctx)
  const reqIds = await sampleIds(prisma.requisition, ctx)
  const t = ctx.tenantId

  await attempt('requisitions', async () => {
    await prisma.requisitionItem.deleteMany({ where: { tenantId: t, requisitionId: { in: reqIds } } })
    await prisma.requisition.deleteMany({ where: { tenantId: t, id: { in: reqIds } } })
  })
  // Paperwork a tester raised against the sample purchase orders goes with them.
  await attempt('supplier invoices', () => prisma.supplierInvoice.deleteMany({ where: { tenantId: t, poId: { in: poIds } } }))
  await attempt('goods received notes', async () => {
    const grnIds = (await prisma.goodsReceiptNote.findMany({ where: { tenantId: t, poId: { in: poIds } }, select: { id: true } })).map((g) => g.id)
    await prisma.qualityCheck.deleteMany({ where: { tenantId: t, grnId: { in: grnIds } } })
    await prisma.goodsReceiptNote.deleteMany({ where: { tenantId: t, id: { in: grnIds } } })
  })
  await attempt('purchase orders', async () => {
    await prisma.purchaseOrderItem.deleteMany({ where: { tenantId: t, purchaseOrderId: { in: poIds } } })
    await prisma.purchaseOrder.deleteMany({ where: { tenantId: t, id: { in: poIds } } })
  })
  await attempt('stock movements', () => prisma.inventoryTransaction.deleteMany({ where: { tenantId: t, itemId: { in: itemIds } } }))
  await attempt('stock items', () => prisma.inventoryItem.deleteMany({ where: { tenantId: t, id: { in: itemIds } } }))
  await attempt('suppliers', () => prisma.supplier.deleteMany({ where: bySampleId(ctx) }))
  await attempt('units of measure', () => prisma.unitOfMeasure.deleteMany({ where: bySampleId(ctx) }))
  await attempt('item categories', () => prisma.itemCategory.deleteMany({ where: bySampleId(ctx) }))
  return kept
}

export async function countInventory(ctx: SampleCtx) {
  return {
    stockItems: await prisma.inventoryItem.count({ where: bySampleId(ctx) }),
    suppliers: await prisma.supplier.count({ where: bySampleId(ctx) }),
  }
}
