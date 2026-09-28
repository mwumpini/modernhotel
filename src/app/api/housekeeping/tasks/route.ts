import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const assignedTo = searchParams.get('assignedTo')
    const roomId = searchParams.get('roomId')

    const tasks = await prisma.housekeepingTask.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(status ? { status } : {}),
        ...(assignedTo ? { assignedTo } : {}),
        ...(roomId ? { roomId } : {}),
      },
      orderBy: [{ priority: 'desc' }, { scheduledFor: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('[housekeeping/tasks][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (!body.taskType) return NextResponse.json({ error: 'taskType is required' }, { status: 400 })

    const roomNumber = body.roomNumber != null ? String(body.roomNumber).trim() : ''
    const taskType = String(body.taskType)
    const isMaintenance = taskType === 'maintenance'
    const openStatuses = ['pending', 'in-progress', 'in_progress']

    // Idempotent create by client id (assign-after-create race)
    if (body.id) {
      const byId = await prisma.housekeepingTask.findFirst({
        where: { id: String(body.id), tenantId: ctx.tenantId },
      })
      if (byId) return NextResponse.json({ task: byId, deduped: true }, { status: 200 })
    }

    // Block duplicate open cleaning tasks for the same room/area
    if (!isMaintenance && roomNumber) {
      const openExisting = await prisma.housekeepingTask.findFirst({
        where: {
          tenantId: ctx.tenantId,
          roomNumber,
          status: { in: openStatuses },
          NOT: { taskType: 'maintenance' },
        },
        orderBy: [{ createdAt: 'asc' }],
      })
      if (openExisting) {
        return NextResponse.json({ task: openExisting, deduped: true }, { status: 200 })
      }
    }

    const task = await prisma.housekeepingTask.create({
      data: {
        ...(body.id ? { id: body.id } : {}),
        tenantId: ctx.tenantId,
        roomId: body.roomId,
        roomNumber: roomNumber || body.roomNumber,
        taskType,
        status: body.status || 'pending',
        priority: body.priority || 'normal',
        assignedTo: body.assignedTo,
        assignedName: body.assignedName,
        notes: body.notes,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
        details: body.details ?? undefined,
      },
    })

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HOUSEKEEPING_TASK_CREATED', 'HousekeepingTask', task.id, undefined, { taskType: task.taskType, roomNumber: task.roomNumber }, request)
    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('[housekeeping/tasks][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
