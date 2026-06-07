import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'

export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || undefined
    const categoryId = searchParams.get('categoryId') || undefined

    const items = await prisma.inventoryItem.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(categoryId ? { categoryId } : {}),
        ...(q ? { OR: [{ code: { contains: q } }, { name: { contains: q } }] } : {}),
      },
      include: { category: true, unit: true },
      orderBy: { code: 'asc' },
      take: 200,
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[inventory/items][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.code || !body.name) {
      return NextResponse.json({ error: 'code and name are required' }, { status: 400 })
    }

    const item = await prisma.inventoryItem.create({
      data: {
        tenantId: ctx.tenantId,
        code: body.code,
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
        unitId: body.unitId,
        isPerishable: body.isPerishable ?? false,
        isSerialized: body.isSerialized ?? false,
        barcode: body.barcode,
        defaultCost: body.defaultCost ?? 0,
        sellingPrice: body.sellingPrice ?? 0,
        reorderLevel: body.reorderLevel ?? 0,
        quantityOnHand: body.quantityOnHand ?? 0,
      },
      include: { category: true, unit: true },
    })

    await createAuditLog(ctx.tenantId, null, 'INVENTORY_ITEM_CREATED', 'InventoryItem', item.id, undefined, { code: item.code, name: item.name }, request)
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('[inventory/items][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
