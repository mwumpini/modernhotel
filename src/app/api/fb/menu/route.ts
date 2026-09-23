import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

// GET /api/fb/menu — list menu items, filterable by venue/category
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const venue = searchParams.get('venue') || undefined
    const category = searchParams.get('category') || undefined
    const available = searchParams.get('available')

    const includeUsage = searchParams.get('includeUsage') === 'true'

    const items = await prisma.fBMenuItem.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(venue && venue !== 'all' ? { OR: [{ venue }, { venue: 'all' }] } : {}),
        ...(category ? { category } : {}),
        ...(available === 'true' ? { isAvailable: true } : {}),
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })

    if (!includeUsage) return NextResponse.json({ items })

    const counts = items.length
      ? await prisma.fBOrderItem.groupBy({
          by: ['menuItemId'],
          where: { tenantId: ctx.tenantId, menuItemId: { in: items.map((i) => i.id) } },
          _count: { _all: true },
        })
      : []
    const usedById = new Map(counts.filter((c) => c.menuItemId).map((c) => [c.menuItemId as string, c._count._all]))
    return NextResponse.json({
      items: items.map((item) => ({ ...item, usedCount: usedById.get(item.id) || 0 })),
    })
  } catch (error) {
    console.error('[fb/menu][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/fb/menu — create a new menu item
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
    if (!body.code || !body.name || !body.category || !body.venue || body.unitPrice == null) {
      return NextResponse.json({ error: 'code, name, category, venue and unitPrice are required' }, { status: 400 })
    }

    // Assign correct GL account code based on venue
    const glAccountCode = venueToGLCode(body.venue)

    const item = await prisma.fBMenuItem.create({
      data: {
        tenantId: ctx.tenantId,
        code: body.code,
        name: body.name,
        description: body.description,
        category: body.category,
        venue: body.venue,
        route: body.route || (body.category === 'beverage' ? 'bar' : 'kitchen'),
        unitPrice: body.unitPrice,
        costPrice: body.costPrice ?? 0,
        glAccountCode,
        isAvailable: body.isAvailable !== false,
        allergens: body.allergens,
        prepMinutes: body.prepMinutes ?? 10,
        sortOrder: body.sortOrder ?? 0,
      },
    })

    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'FB_MENU_ITEM_CREATED', 'FBMenuItem', item.id, undefined, { code: item.code, name: item.name, venue: item.venue }, request)
    return NextResponse.json({ item }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Menu item code already exists' }, { status: 409 })
    }
    console.error('[fb/menu][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH /api/fb/menu — update a menu item
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

    const existing = await prisma.fBMenuItem.findFirst({ where: { id: body.id, tenantId: ctx.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })

    const item = await prisma.fBMenuItem.update({
      where: { id: body.id },
      data: {
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        category: body.category ?? existing.category,
        venue: body.venue ?? existing.venue,
        route: body.route ?? existing.route,
        unitPrice: body.unitPrice ?? existing.unitPrice,
        costPrice: body.costPrice ?? existing.costPrice,
        glAccountCode: body.venue ? venueToGLCode(body.venue) : existing.glAccountCode,
        isAvailable: body.isAvailable ?? existing.isAvailable,
        allergens: body.allergens ?? existing.allergens,
        prepMinutes: body.prepMinutes ?? existing.prepMinutes,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      },
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('[fb/menu][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/fb/menu?id=xxx — deactivate (soft delete)
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

    const existing = await prisma.fBMenuItem.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })

    const used = await prisma.fBOrderItem.count({ where: { tenantId: ctx.tenantId, menuItemId: id } })
    if (used > 0) {
      await prisma.fBMenuItem.update({ where: { id }, data: { isAvailable: false } })
      return NextResponse.json({ success: true, deactivated: true, used })
    }

    await prisma.fBMenuItem.delete({ where: { id } })
    return NextResponse.json({ success: true, deleted: true })
  } catch (error) {
    console.error('[fb/menu][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Maps venue to the correct GL revenue account
function venueToGLCode(venue: string): string {
  switch (venue) {
    case 'restaurant': return '4210'
    case 'bar':        return '4220'
    case 'room_service': return '4230'
    case 'pool_bar':   return '4220'
    default:           return '4200'
  }
}
