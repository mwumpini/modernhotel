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
    const status = searchParams.get('status')

    const requests = await prisma.maintenanceRequest.findMany({
      where: { tenantId: ctx.tenantId, ...(status ? { status } : {}) },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('[housekeeping/maintenance][GET] error', error)
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
    if (!body.description || !body.category) {
      return NextResponse.json({ error: 'description and category are required' }, { status: 400 })
    }

    const req = await prisma.maintenanceRequest.create({
      data: {
        tenantId: ctx.tenantId,
        roomId: body.roomId,
        roomNumber: body.roomNumber,
        location: body.location,
        category: body.category,
        priority: body.priority || 'normal',
        description: body.description,
        reportedBy: body.reportedBy,
        assignedTo: body.assignedTo,
        notes: body.notes,
        status: 'open',
      },
    })

    await createAuditLog(ctx.tenantId, null, 'MAINTENANCE_REQUEST_CREATED', 'MaintenanceRequest', req.id, undefined, { category: req.category, roomNumber: req.roomNumber }, request)
    return NextResponse.json({ request: req }, { status: 201 })
  } catch (error) {
    console.error('[housekeeping/maintenance][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await prisma.maintenanceRequest.findFirst({ where: { id: body.id, tenantId: ctx.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const updated = await prisma.maintenanceRequest.update({
      where: { id: body.id },
      data: {
        status: body.status ?? existing.status,
        assignedTo: body.assignedTo ?? existing.assignedTo,
        notes: body.notes ?? existing.notes,
        priority: body.priority ?? existing.priority,
        ...(body.status === 'completed' ? { resolvedAt: new Date() } : {}),
      },
    })

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error('[housekeeping/maintenance][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
