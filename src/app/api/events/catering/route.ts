import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listCateringItems, upsertCateringItem, deleteCateringItem } from '@/app/lib/frontoffice/eventsRepository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const items = await listCateringItems(ctx.tenantId)
    return NextResponse.json({ items })
  } catch (error) {
    console.error('[events/catering][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const item = await upsertCateringItem(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'CATERING_ITEM_SAVED', 'CateringItem', body.id, undefined, { name: item.name }, request)
    return NextResponse.json({ item })
  } catch (error) {
    console.error('[events/catering][POST] error', error)
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
    const ok = await deleteCateringItem(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'CATERING_ITEM_DELETED', 'CateringItem', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[events/catering][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
