import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'

// POST /api/inventory/stock-adjustment
// Handles: issue (deduct), receipt (add), adjustment, write-off
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    const { itemId, type, quantity, reference, notes, locationId } = body

    if (!itemId || !type || quantity == null) {
      return NextResponse.json({ error: 'itemId, type and quantity are required' }, { status: 400 })
    }

    const validTypes = ['issue', 'receipt', 'adjustment', 'write_off', 'transfer']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, tenantId: ctx.tenantId } })
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const currentQty = Number(item.quantityOnHand ?? 0)
    const delta = type === 'issue' || type === 'write_off' ? -Math.abs(quantity) : Math.abs(quantity)
    const newQty = currentQty + delta

    if (newQty < 0) {
      return NextResponse.json({
        error: `Insufficient stock. Current: ${currentQty}, requested: ${Math.abs(quantity)}`,
        currentQuantity: currentQty,
      }, { status: 400 })
    }

    const updatedItem = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { quantityOnHand: newQty },
    })

    await createAuditLog(
      ctx.tenantId, null,
      `INVENTORY_${type.toUpperCase()}`,
      'InventoryItem', itemId,
      { quantityOnHand: currentQty },
      { quantityOnHand: newQty, delta, reference, notes },
      request
    )

    return NextResponse.json({
      success: true,
      item: updatedItem,
      previousQuantity: currentQty,
      newQuantity: newQty,
      delta,
    })
  } catch (error) {
    console.error('[inventory/stock-adjustment][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// GET /api/inventory/stock-adjustment — get low-stock alerts
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    // Items where quantity on hand <= reorder level
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: { tenantId: ctx.tenantId },
      include: { category: true, unit: true },
      orderBy: { quantityOnHand: 'asc' },
    })

    const alerts = lowStockItems.filter(item =>
      Number(item.quantityOnHand ?? 0) <= Number(item.reorderLevel ?? 0)
    )

    return NextResponse.json({ alerts, total: alerts.length })
  } catch (error) {
    console.error('[inventory/stock-adjustment][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
