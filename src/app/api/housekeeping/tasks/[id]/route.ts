import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.housekeepingTask.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const now = new Date()
    const task = await prisma.housekeepingTask.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        assignedTo: body.assignedTo ?? existing.assignedTo,
        assignedName: body.assignedName ?? existing.assignedName,
        notes: body.notes ?? existing.notes,
        priority: body.priority ?? existing.priority,
        ...(body.status === 'in_progress' && !existing.startedAt ? { startedAt: now } : {}),
        ...(body.status === 'completed' && !existing.completedAt ? { completedAt: now } : {}),
      },
    })

    await createAuditLog(ctx.tenantId, null, 'HOUSEKEEPING_TASK_UPDATED', 'HousekeepingTask', id, { status: existing.status }, { status: task.status }, request)
    return NextResponse.json({ task })
  } catch (error) {
    console.error('[housekeeping/tasks/[id]][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
