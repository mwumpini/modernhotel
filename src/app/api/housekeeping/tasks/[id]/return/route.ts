import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant';
import { requirePermission } from '@/app/lib/api/auth-guard';
import { returnTaskStock } from '@/app/lib/housekeeping/issueCleaningKit';

type RouteParams = { params: Promise<{ id: string }> };

/** A supervisor returns the exact kit, or an extra they already approved. */
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
    const part = body.part === 'extra' ? 'extra' : body.part === 'kit' ? 'kit' : '';
    if (!part) return NextResponse.json({ error: 'part must be kit or extra' }, { status: 400 });

    const user = (auth.session as { user?: { id?: string; name?: string } }).user;
    const result = await returnTaskStock({
      tenantId: ctx.tenantId,
      taskId: id,
      part,
      performedBy: user?.name,
    });
    if (result.error === 'not_found') return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (result.error === 'already_returned') return NextResponse.json({ error: 'This was already returned' }, { status: 409 });
    if (result.error === 'nothing_taken') return NextResponse.json({ error: 'Nothing came off stock for this clean' }, { status: 409 });
    if (result.error === 'no_approved_extra') return NextResponse.json({ error: 'No approved extra to return' }, { status: 409 });
    if (result.error) return NextResponse.json({ error: 'Could not update inventory' }, { status: 400 });

    await createAuditLog(
      ctx.tenantId,
      user?.id ?? null,
      part === 'kit' ? 'HOUSEKEEPING_KIT_RETURNED' : 'HOUSEKEEPING_EXTRA_RETURNED',
      'HousekeepingTask',
      id,
      undefined,
      { part, returned: result.returned, cancelledRequest: result.cancelledRequest },
      request,
    );
    return NextResponse.json({ ok: true, returned: result.returned, cancelledRequest: result.cancelledRequest });
  } catch (error) {
    console.error('[housekeeping/tasks/return][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
