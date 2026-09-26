import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { issueDepartmentStock } from '@/app/lib/inventory/repository';

/**
 * POST /api/inventory/department-issue
 * Use stock that already sits in a department (after Stores marked a requisition Ready).
 * Body: { department, referenceType, referenceId, items: [{ itemId, quantity }], notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const subdomain = getTenantFromRequest(req);
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 });
    const ctx = await getTenantContext(subdomain);
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!body.department || !body.referenceId || items.length === 0) {
      return NextResponse.json({ error: 'department, referenceId and items are required' }, { status: 400 });
    }

    const result = await issueDepartmentStock({
      tenantId: ctx.tenantId,
      department: String(body.department),
      items: items.map((item: any) => ({ itemId: String(item.itemId || ''), quantity: Number(item.quantity) })),
      referenceType: body.referenceType || 'department-issue',
      referenceId: String(body.referenceId),
      notes: body.notes || undefined,
      performedBy: (auth.session as any)?.user?.name || undefined,
    });

    if (result.error === 'unknown_department') {
      return NextResponse.json({ error: 'Unknown department' }, { status: 400 });
    }
    if (result.error === 'no_location') {
      return NextResponse.json({ error: 'Department stock location is not set up' }, { status: 400 });
    }
    if (result.error === 'insufficient') {
      return NextResponse.json(
        { error: `Not enough ${result.itemName} on hand (${result.onHand} left)` },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[inventory/department-issue][POST] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
