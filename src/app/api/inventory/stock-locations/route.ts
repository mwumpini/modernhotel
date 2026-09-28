import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import {
  listStockLocations,
  upsertStockLocation,
  setStockLocationActive,
} from '@/app/lib/inventory/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === '1' || searchParams.get('activeOnly') === 'true'
    const department = searchParams.get('department') || undefined
    const locations = await listStockLocations(ctx.tenantId, { activeOnly, seed: true, department })
    return NextResponse.json({ locations })
  } catch (error) {
    console.error('[inventory/stock-locations][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.name && !body.code) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    try {
      const location = await upsertStockLocation(ctx.tenantId, body.id, {
        code: body.code,
        name: body.name,
        type: body.type,
        department: body.department === '' || body.department === undefined ? body.department ?? null : body.department,
        isActive: body.isActive,
      })
      await createAuditLog(
        ctx.tenantId,
        sessionUserId ?? null,
        'STOCK_LOCATION_SAVED',
        'StockLocation',
        body.id,
        undefined,
        { code: location.code, name: location.name, type: location.type },
        request,
      )
      return NextResponse.json({ location })
    } catch (err: any) {
      if (String(err?.message || '').includes('Unique constraint') || err?.code === 'P2002') {
        return NextResponse.json({ error: 'Location code already exists' }, { status: 409 })
      }
      if (String(err?.message || '').includes('required')) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      throw err
    }
  } catch (error) {
    console.error('[inventory/stock-locations][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })
    const location = await setStockLocationActive(ctx.tenantId, id, false)
    if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'STOCK_LOCATION_DEACTIVATED', 'StockLocation', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deactivated', location })
  } catch (error) {
    console.error('[inventory/stock-locations][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
