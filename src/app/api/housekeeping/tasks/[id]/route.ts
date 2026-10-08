import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'
import { Prisma } from '@prisma/client'
import { cleanerOwnsTask, roleIsHousekeepingDesk } from '@/app/lib/housekeeping/attendantAccess'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.housekeepingTask.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const user = (auth.session as { user?: { name?: string; role?: string } }).user
    const desk = await roleIsHousekeepingDesk(ctx.tenantId, user?.role)
    if (!desk) {
      if (!(await cleanerOwnsTask(ctx.tenantId, user?.name, existing))) {
        return NextResponse.json({ error: 'This room is not assigned to you' }, { status: 403 })
      }
      const nextStatus = body.status != null ? String(body.status) : ''
      if (nextStatus === 'completed' || nextStatus === 'verified' || nextStatus === 'cancelled' || nextStatus === 'void') {
        return NextResponse.json({ error: 'Press Done on the room to finish it' }, { status: 403 })
      }
    }

    const now = new Date()
    const previousDetails = existing.details && typeof existing.details === 'object' && !Array.isArray(existing.details)
      ? (existing.details as Record<string, unknown>)
      : {}
    let details = body.details ?? existing.details
    if (body.details && typeof body.details === 'object' && !Array.isArray(body.details)) {
      details = {
        ...(body.details as Record<string, unknown>),
        openedBy: previousDetails.openedBy,
        suppliesIssued: previousDetails.suppliesIssued,
        suppliesUsed: previousDetails.suppliesUsed,
        extraRequest: previousDetails.extraRequest,
        kitReferenceId: previousDetails.kitReferenceId,
        kitReturned: previousDetails.kitReturned,
        extraReturned: previousDetails.extraReturned,
        ticketNumber: previousDetails.ticketNumber || (body.details as { ticketNumber?: unknown })?.ticketNumber,
      }
    }
    const task = await prisma.housekeepingTask.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        assignedTo: body.assignedTo ?? existing.assignedTo,
        assignedName: body.assignedName ?? existing.assignedName,
        notes: body.notes ?? existing.notes,
        priority: body.priority ?? existing.priority,
        details: details as Prisma.InputJsonValue,
        ...((body.status === 'in_progress' || body.status === 'in-progress') && !existing.startedAt ? { startedAt: now } : {}),
        ...(body.status === 'completed' && !existing.completedAt ? { completedAt: now } : {}),
      },
    })

    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(ctx.tenantId, sessionUserId ?? null, 'HOUSEKEEPING_TASK_UPDATED', 'HousekeepingTask', id, { status: existing.status }, { status: task.status }, request)
    return NextResponse.json({ task })
  } catch (error) {
    console.error('[housekeeping/tasks/[id]][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
