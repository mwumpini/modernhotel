import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listRestaurantTables, upsertRestaurantTable, deleteRestaurantTable } from '@/app/lib/fb/tablesRepository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const tables = await listRestaurantTables(ctx.tenantId)
    return NextResponse.json({ tables })
  } catch (error) {
    console.error('[fb/tables][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const table = await upsertRestaurantTable(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'RESTAURANT_TABLE_SAVED', 'RestaurantTable', body.id, undefined, { number: table.number, status: table.status }, request)
    return NextResponse.json({ table })
  } catch (error) {
    console.error('[fb/tables][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })
    const ok = await deleteRestaurantTable(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'RESTAURANT_TABLE_DELETED', 'RestaurantTable', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[fb/tables][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
