import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { upsertReconcilingItem, deleteReconcilingItem } from '@/app/lib/accounting/repository'

// POST /api/accounting/bank-reconciliation/items — create or update one reconciling item
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.id || !body.reconciliationId || !body.itemType || body.amount === undefined) {
      return NextResponse.json({ error: 'id, reconciliationId, itemType, and amount are required' }, { status: 400 })
    }

    const item = await upsertReconcilingItem(ctx.tenantId, {
      id: body.id,
      reconciliationId: body.reconciliationId,
      itemType: body.itemType,
      description: body.description || '',
      reference: body.reference,
      transactionDate: body.transactionDate,
      amount: Number(body.amount),
      isCleared: !!body.isCleared,
      clearedDate: body.clearedDate,
      journalEntryId: body.journalEntryId,
      offsetGlCode: body.offsetGlCode,
      carriedFromItemId: body.carriedFromItemId,
    })
    return NextResponse.json({ item })
  } catch (error) {
    console.error('[bank-reconciliation/items][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/accounting/bank-reconciliation/items?id=... — remove one reconciling item
export async function DELETE(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })

    const ok = await deleteReconcilingItem(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[bank-reconciliation/items][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
