import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { recordStockTransaction, upsertItemCategory, upsertUnitOfMeasure } from '@/app/lib/inventory/repository'

/**
 * The Inventory & Stores UI collects category/unit as free text (a fixed
 * category enum, a free-text unit string) rather than picking a real
 * ItemCategory/UnitOfMeasure row. Auto-provision one keyed by that text so
 * the UI doesn't need a rewrite to pick real FK rows, and repeat saves reuse
 * the same category/unit instead of creating duplicates.
 */
async function resolveCategoryId(tenantId: string, categoryId?: string, category?: string) {
  if (categoryId) return categoryId
  if (!category) return undefined
  const code = String(category).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  const name = category.charAt(0).toUpperCase() + category.slice(1)
  const row = await upsertItemCategory(tenantId, code, name)
  return row.id
}

async function resolveUnitId(tenantId: string, unitId?: string, unit?: string) {
  if (unitId) return unitId
  if (!unit) return undefined
  const code = String(unit).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  const row = await upsertUnitOfMeasure(tenantId, code, unit)
  return row.id
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
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
      include: { category: true, unit: true, supplier: true },
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
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const sessionUserId = (auth.session as any).user?.id
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.code || !body.name) {
      return NextResponse.json({ error: 'code and name are required' }, { status: 400 })
    }

    const categoryId = await resolveCategoryId(ctx.tenantId, body.categoryId, body.category)
    const unitId = await resolveUnitId(ctx.tenantId, body.unitId, body.unit)

    const item = await prisma.inventoryItem.create({
      data: {
        tenantId: ctx.tenantId,
        code: body.code,
        name: body.name,
        description: body.description,
        categoryId,
        unitId,
        isPerishable: body.isPerishable ?? false,
        isSerialized: body.isSerialized ?? false,
        barcode: body.barcode,
        defaultCost: body.defaultCost ?? body.unitCost ?? 0,
        sellingPrice: body.sellingPrice ?? 0,
        reorderLevel: body.reorderLevel ?? body.reorderPoint ?? 0,
        minimumStock: body.minimumStock ?? 0,
        maximumStock: body.maximumStock ?? 0,
        location: body.location || undefined,
        supplierId: body.supplierId || undefined,
      },
      include: { category: true, unit: true, supplier: true },
    })

    const initialQuantity = Number(body.initialQuantity ?? body.currentStock ?? 0)
    if (initialQuantity > 0) {
      await recordStockTransaction({
        tenantId: ctx.tenantId,
        itemId: item.id,
        type: 'receipt',
        quantity: initialQuantity,
        unitCost: item.defaultCost != null ? Number(item.defaultCost) : undefined,
        referenceType: 'manual',
        notes: 'Initial stock on item creation',
      })
    }

    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'INVENTORY_ITEM_CREATED', 'InventoryItem', item.id, undefined, { code: item.code, name: item.name }, request)
    const finalItem = initialQuantity > 0
      ? await prisma.inventoryItem.findUnique({ where: { id: item.id }, include: { category: true, unit: true, supplier: true } })
      : item
    return NextResponse.json({ item: finalItem }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Item code already exists' }, { status: 409 })
    }
    console.error('[inventory/items][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await prisma.inventoryItem.findFirst({ where: { id: body.id, tenantId: ctx.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const categoryId = body.category
      ? await resolveCategoryId(ctx.tenantId, body.categoryId, body.category)
      : (body.categoryId ?? existing.categoryId)
    const unitId = body.unit
      ? await resolveUnitId(ctx.tenantId, body.unitId, body.unit)
      : (body.unitId ?? existing.unitId)

    const item = await prisma.inventoryItem.update({
      where: { id: body.id },
      data: {
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        categoryId,
        unitId,
        defaultCost: body.defaultCost ?? body.unitCost ?? existing.defaultCost,
        sellingPrice: body.sellingPrice ?? existing.sellingPrice,
        reorderLevel: body.reorderLevel ?? body.reorderPoint ?? existing.reorderLevel,
        minimumStock: body.minimumStock ?? existing.minimumStock,
        maximumStock: body.maximumStock ?? existing.maximumStock,
        location: body.location ?? existing.location,
        supplierId: body.supplierId ?? existing.supplierId,
        isActive: body.isActive ?? existing.isActive,
        isPerishable: body.isPerishable ?? existing.isPerishable,
        isSerialized: body.isSerialized ?? existing.isSerialized,
        barcode: body.barcode ?? existing.barcode,
      },
      include: { category: true, unit: true, supplier: true },
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('[inventory/items][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await prisma.inventoryItem.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    // Soft-delete: items may be referenced by past purchase orders / transactions.
    await prisma.inventoryItem.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ message: 'Deactivated' })
  } catch (error) {
    console.error('[inventory/items][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
