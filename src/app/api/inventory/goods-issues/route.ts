import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import {
  listGoodsIssues,
  upsertGoodsIssue,
  type GoodsIssueItemInput,
} from '@/app/lib/inventory/repository';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const subdomain = getTenantFromRequest(req);
  if (!subdomain) return null;
  const ctx = await getTenantContext(subdomain);
  return ctx?.tenantId ?? null;
}

function mapItems(body: any): GoodsIssueItemInput[] {
  return (body.items || []).map((item: any) => ({
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    quantity: Number(item.quantity),
    unitCost: Number(item.unitCost),
    reason: item.reason,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const issues = await listGoodsIssues(tenantId, {
      status: searchParams.get('status') || undefined,
      department: searchParams.get('department') || undefined,
    });
    return NextResponse.json({ issues });
  } catch (error) {
    console.error('Error fetching goods issues:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.department || !body.issuedTo || !body.issuedBy || !body.items?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: department, issuedTo, issuedBy, items' },
        { status: 400 }
      );
    }

    const issue = await upsertGoodsIssue({
      id: body.id,
      tenantId,
      issueNumber: body.issueNumber,
      department: body.department,
      issuedTo: body.issuedTo,
      issueDate: body.issueDate,
      status: body.status,
      notes: body.notes,
      issuedBy: body.issuedBy,
      items: mapItems(body),
    });

    return NextResponse.json({ issue });
  } catch (error) {
    console.error('Error upserting goods issue:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
