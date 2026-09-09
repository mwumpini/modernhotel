import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { listCostCenters, upsertCostCenterRow, deleteCostCenterRow } from '@/app/lib/accounting/repository'

// GET /api/accounting/cost-centers — the tenant's cost centres
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const costCenters = await listCostCenters(ctx.tenantId)
    return NextResponse.json({ costCenters })
  } catch (error) {
    console.error('[cost-centers][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/accounting/cost-centers — create or update one cost centre
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.id || !body.code || !body.name) {
      return NextResponse.json({ error: 'id, code, and name are required' }, { status: 400 })
    }

    const costCenter = await upsertCostCenterRow(ctx.tenantId, {
      id: body.id,
      code: body.code,
      name: body.name,
      description: body.description,
      type: body.type || 'department',
      department: body.department || 'other',
      glAccountCode: body.glAccountCode,
      parentCenter: body.parentCenter,
      manager: body.manager,
      budget: Number(body.budget ?? 0),
      actualExpenses: Number(body.actualExpenses ?? 0),
      isActive: body.isActive ?? true,
    })
    return NextResponse.json({ costCenter })
  } catch (error) {
    console.error('[cost-centers][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/accounting/cost-centers?id=... — remove one cost centre
export async function DELETE(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })

    const ok = await deleteCostCenterRow(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Cost centre not found' }, { status: 404 })
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[cost-centers][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
