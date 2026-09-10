import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { recordStockTransaction, listStockTransactions, type StockTransactionType } from '@/app/lib/inventory/repository'

const VALID_TYPES: StockTransactionType[] = ['receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment', 'count']

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId') || undefined
    const type = searchParams.get('type') || undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined

    const transactions = await listStockTransactions(ctx.tenantId, { itemId, type, limit })
    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('[inventory/stock-transactions][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json({ error: `type must be one of ${VALID_TYPES.join(', ')}` }, { status: 400 })
    }
    const quantity = Number(body.quantity)
    if (!quantity) return NextResponse.json({ error: 'quantity (non-zero) is required' }, { status: 400 })

    const result = await recordStockTransaction({
      tenantId: ctx.tenantId,
      itemId: body.itemId,
      locationId: body.locationId || undefined,
      type: body.type,
      quantity,
      unitCost: body.unitCost != null ? Number(body.unitCost) : undefined,
      referenceType: body.referenceType || 'manual',
      referenceId: body.referenceId || undefined,
      notes: body.notes || undefined,
      performedBy: body.performedBy || undefined,
    })

    await createAuditLog(
      ctx.tenantId, null,
      'INVENTORY_STOCK_TRANSACTION', 'InventoryTransaction', result.transaction.id,
      undefined,
      { itemId: body.itemId, type: body.type, quantity },
      request
    )

    return NextResponse.json({ item: result.item, transaction: result.transaction }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'Item not found for this tenant') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[inventory/stock-transactions][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
