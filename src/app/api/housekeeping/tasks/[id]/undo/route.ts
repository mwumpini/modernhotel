import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { prisma } from '@/app/lib/database/client';
import { undoFinishedTask } from '@/app/lib/housekeeping/issueCleaningKit';
import { cleanerOwnsTask, roleIsHousekeepingDesk } from '@/app/lib/housekeeping/attendantAccess';

type RouteParams = { params: Promise<{ id: string }> };

/** Reopen a clean within 10 minutes. Stock is left where it is. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { id } = await params;
    const user = (auth.session as { user?: { id?: string; name?: string; role?: string } }).user;
    const task = await prisma.housekeepingTask.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    const desk = await roleIsHousekeepingDesk(ctx.tenantId, user?.role);
    if (!desk && !(await cleanerOwnsTask(ctx.tenantId, user?.name, task))) {
      return NextResponse.json({ error: 'This room is not assigned to you' }, { status: 403 });
    }

    const result = await undoFinishedTask({ tenantId: ctx.tenantId, taskId: id });
    if (result.error === 'not_found') return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (result.error === 'not_finished') return NextResponse.json({ error: 'This room is not finished' }, { status: 409 });
    if (result.error === 'too_late') {
      return NextResponse.json({ error: 'The 10 minutes to undo this room have passed' }, { status: 409 });
    }

    await createAuditLog(
      ctx.tenantId,
      user?.id ?? null,
      'HOUSEKEEPING_TASK_UNDONE',
      'HousekeepingTask',
      id,
      { status: 'completed' },
      { status: 'in-progress' },
      request,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[housekeeping/tasks/undo][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
