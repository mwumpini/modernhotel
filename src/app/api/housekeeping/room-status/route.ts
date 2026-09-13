import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

// POST /api/housekeeping/room-status — log a room status change
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.roomNumber || !body.toStatus) {
      return NextResponse.json({ error: 'roomNumber and toStatus are required' }, { status: 400 })
    }

    const log = await prisma.roomStatusLog.create({
      data: {
        tenantId: ctx.tenantId,
        // No real Room table is in use anywhere in this app yet — every other module
        // (Front Office, Settings) identifies rooms by roomNumber alone, so roomId is
        // optional here rather than forcing a dormant FK that nothing else populates.
        roomId: body.roomId || undefined,
        roomNumber: body.roomNumber,
        fromStatus: body.fromStatus || 'unknown',
        toStatus: body.toStatus,
        changedBy: body.changedBy,
        reason: body.reason,
      },
    })

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'ROOM_STATUS_CHANGED', 'Room', body.roomId, { status: body.fromStatus }, { status: body.toStatus }, request)
    return NextResponse.json({ log }, { status: 201 })
  } catch (error) {
    console.error('[housekeeping/room-status][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// GET /api/housekeeping/room-status — get status history for a room
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')

    const logs = await prisma.roomStatusLog.findMany({
      where: { tenantId: ctx.tenantId, ...(roomId ? { roomId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[housekeeping/room-status][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
