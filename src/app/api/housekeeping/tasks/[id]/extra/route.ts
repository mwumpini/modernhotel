import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant';
import { requirePermission } from '@/app/lib/api/auth-guard';
import { reviewExtraRequest } from '@/app/lib/housekeeping/issueCleaningKit';

type RouteParams = { params: Promise<{ id: string }> };

/** A supervisor approves or rejects supplies requested above the room kit. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(request, 'housekeeping.manage-supplies');
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(request);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : '';
    if (!action) return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });

    const user = (auth.session as { user?: { id?: string; name?: string } }).user;
    const result = await reviewExtraRequest({
      tenantId: ctx.tenantId,
      taskId: id,
      action,
      performedBy: user?.name,
    });
    if (result.error === 'not_found') return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (result.error === 'no_request') return NextResponse.json({ error: 'No extra request is waiting' }, { status: 409 });
    if (result.error === 'insufficient') {
      return NextResponse.json(
        { error: `Not enough ${result.itemName} on hand (${result.onHand} left)` },
        { status: 409 },
      );
    }
    if (result.error) return NextResponse.json({ error: 'Could not update inventory' }, { status: 400 });

    await createAuditLog(
      ctx.tenantId,
      user?.id ?? null,
      action === 'approve' ? 'HOUSEKEEPING_EXTRA_APPROVED' : 'HOUSEKEEPING_EXTRA_REJECTED',
      'HousekeepingTask',
      id,
      undefined,
      { action },
      request,
    );
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    console.error('[housekeeping/tasks/extra][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
