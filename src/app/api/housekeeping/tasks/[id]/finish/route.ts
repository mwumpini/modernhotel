import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { prisma } from '@/app/lib/database/client';
import { issueKitForTask, previewCleaningIssue } from '@/app/lib/housekeeping/issueCleaningKit';
import { cleanerOwnsTask, roleIsHousekeepingDesk } from '@/app/lib/housekeeping/attendantAccess';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { id } = await params;
    const task = await prisma.housekeepingTask.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    const preview = await previewCleaningIssue(ctx.tenantId, task);
    return NextResponse.json(preview);
  } catch (error) {
    console.error('[housekeeping/tasks/finish][GET] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** Finish a clean. The room kit is issued by the server. Extras are only requested. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const user = (auth.session as { user?: { id?: string; name?: string; role?: string; tenantId?: string } }).user;
    const task = await prisma.housekeepingTask.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    const desk = await roleIsHousekeepingDesk(ctx.tenantId, user?.role);
    if (!desk && !(await cleanerOwnsTask(ctx.tenantId, user?.name, task))) {
      return NextResponse.json({ error: 'This room is not assigned to you' }, { status: 403 });
    }
    const result = await issueKitForTask({
      tenantId: ctx.tenantId,
      taskId: id,
      performedBy: user?.name,
      extras: Array.isArray(body.extras) ? body.extras : [],
    });

    if (result.error === 'not_found') return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (result.error === 'closed') return NextResponse.json({ error: 'This task is closed' }, { status: 409 });
    if (result.error === 'already_issued') {
      return NextResponse.json({ error: 'Supplies were already taken for this clean' }, { status: 409 });
    }
    if (result.error) return NextResponse.json({ error: 'Could not update inventory' }, { status: 400 });

    await createAuditLog(
      ctx.tenantId,
      user?.id ?? null,
      'HOUSEKEEPING_KIT_ISSUED',
      'HousekeepingTask',
      id,
      undefined,
      { kind: result.kind, issued: result.issued, warnings: result.warnings },
      request,
    );
    return NextResponse.json({
      ok: true,
      label: result.label,
      issued: result.issued,
      warnings: result.warnings,
      extraPending: Array.isArray(body.extras) && body.extras.some((row: { quantity?: number }) => Number(row?.quantity) > 0),
    });
  } catch (error) {
    console.error('[housekeeping/tasks/finish][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
