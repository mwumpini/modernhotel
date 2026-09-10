import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listSuppliers, upsertSupplier } from '@/app/lib/inventory/repository'
import { prisma } from '@/app/lib/database/client'

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
    const suppliers = await listSuppliers(ctx.tenantId)
    return NextResponse.json({ suppliers })
  } catch (error) {
    console.error('[inventory/suppliers][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const supplier = await upsertSupplier(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'SUPPLIER_SAVED', 'Supplier', body.id, undefined, { name: supplier.name }, request)
    return NextResponse.json({ supplier })
  } catch (error) {
    console.error('[inventory/suppliers][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })
    const existing = await prisma.supplier.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    // Soft delete (isActive=false) — suppliers may be referenced by expense vouchers/purchase orders.
    await prisma.supplier.update({ where: { id }, data: { isActive: false } })
    await createAuditLog(ctx.tenantId, null, 'SUPPLIER_DEACTIVATED', 'Supplier', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deactivated' })
  } catch (error) {
    console.error('[inventory/suppliers][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
