import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id: reservationId } = await params
    if (!reservationId) {
      return NextResponse.json({ error: 'Reservation ID is required' }, { status: 400 })
    }

    const logs = await prisma.auditLog.findMany({
      where: { tenantId: ctx.tenantId, entity: 'Reservation', entityId: reservationId },
      orderBy: { createdAt: 'desc' },
    })

    const proformaLogs = logs.filter(log => log.action.toLowerCase().includes('proforma'))

    return NextResponse.json({
      success: true,
      reservationId,
      totalLogs: logs.length,
      proformaLogs: proformaLogs.length,
      logs: proformaLogs,
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    const { entity, entityId, action } = body

    const where: any = { tenantId: ctx.tenantId }
    if (entity) where.entity = entity
    if (entityId) where.entityId = entityId
    if (action) where.action = action

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, totalLogs: logs.length, logs })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
