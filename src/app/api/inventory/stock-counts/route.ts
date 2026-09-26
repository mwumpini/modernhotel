import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import {
  listStockCounts,
  upsertStockCount,
  type StockCountItemInput,
} from '@/app/lib/inventory/repository';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const subdomain = getTenantFromRequest(req);
  if (!subdomain) return null;
  const ctx = await getTenantContext(subdomain);
  return ctx?.tenantId ?? null;
}

function mapItems(body: any): StockCountItemInput[] {
  return (body.items || []).map((item: any) => ({
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    expectedQuantity: Number(item.expectedQuantity),
    countedQuantity: Number(item.countedQuantity),
    variance: Number(item.variance),
    unitCost: Number(item.unitCost),
    varianceValue: Number(item.varianceValue),
    notes: item.notes,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const counts = await listStockCounts(tenantId, {
      status: searchParams.get('status') || undefined,
      location: searchParams.get('location') || undefined,
    });
    return NextResponse.json({ counts });
  } catch (error) {
    console.error('Error fetching stock counts:', error);
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
    if (!body.location || !body.createdBy || !body.items?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: location, createdBy, items' },
        { status: 400 }
      );
    }

    const count = await upsertStockCount({
      id: body.id,
      tenantId,
      countNumber: body.countNumber,
      countType: body.countType,
      location: body.location,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status,
      notes: body.notes,
      createdBy: body.createdBy,
      performedBy: body.performedBy,
      items: mapItems(body),
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error upserting stock count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
