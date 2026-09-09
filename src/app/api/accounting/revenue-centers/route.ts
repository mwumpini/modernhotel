import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { listRevenueCenters, upsertRevenueCenterRow, deleteRevenueCenterRow } from '@/app/lib/accounting/repository'

// GET /api/accounting/revenue-centers — the tenant's revenue centres
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const revenueCenters = await listRevenueCenters(ctx.tenantId)
    return NextResponse.json({ revenueCenters })
  } catch (error) {
    console.error('[revenue-centers][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/accounting/revenue-centers — create or update one revenue centre
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.id || !body.code || !body.name || !body.glAccountCode) {
      return NextResponse.json({ error: 'id, code, name, and glAccountCode are required' }, { status: 400 })
    }

    const revenueCenter = await upsertRevenueCenterRow(ctx.tenantId, {
      id: body.id,
      code: body.code,
      name: body.name,
      description: body.description,
      type: body.type || 'other',
      department: body.department || 'other',
      glAccountCode: body.glAccountCode,
      parentCenter: body.parentCenter,
      manager: body.manager,
      budget: Number(body.budget ?? 0),
      actualRevenue: Number(body.actualRevenue ?? 0),
      isActive: body.isActive ?? true,
    })
    return NextResponse.json({ revenueCenter })
  } catch (error) {
    console.error('[revenue-centers][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/accounting/revenue-centers?id=... — remove one revenue centre
export async function DELETE(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })

    const ok = await deleteRevenueCenterRow(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Revenue centre not found' }, { status: 404 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[revenue-centers][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
