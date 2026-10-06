import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { rejectIfBackdated } from '@/app/lib/frontoffice/postingDateGuard';
import {
  listStockTransfers,
  upsertStockTransfer,
  type StockTransferItemInput,
} from '@/app/lib/inventory/repository';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const subdomain = getTenantFromRequest(req);
  if (!subdomain) return null;
  const ctx = await getTenantContext(subdomain);
  return ctx?.tenantId ?? null;
}

function mapItems(body: any): StockTransferItemInput[] {
  return (body.items || []).map((item: any) => ({
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    quantity: Number(item.quantity),
    unitCost: Number(item.unitCost),
    transferredQuantity: Number(item.transferredQuantity || 0),
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
    const transfers = await listStockTransfers(tenantId, {
      status: searchParams.get('status') || undefined,
    });
    return NextResponse.json({ transfers });
  } catch (error) {
    console.error('Error fetching stock transfers:', error);
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
    if (!body.fromLocation || !body.toLocation || !body.createdBy || !body.items?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: fromLocation, toLocation, createdBy, items' },
        { status: 400 }
      );
    }

    const blocked = await rejectIfBackdated(tenantId, body.transferDate, { model: 'stockTransfer', id: body.id });
    if (blocked) return blocked;

    const transfer = await upsertStockTransfer({
      id: body.id,
      tenantId,
      transferNumber: body.transferNumber,
      fromLocation: body.fromLocation,
      toLocation: body.toLocation,
      transferDate: body.transferDate,
      expectedDeliveryDate: body.expectedDeliveryDate,
      actualDeliveryDate: body.actualDeliveryDate,
      status: body.status,
      priority: body.priority,
      notes: body.notes,
      createdBy: body.createdBy,
      approvedBy: body.approvedBy,
      approvedAt: body.approvedAt,
      items: mapItems(body),
    });

    return NextResponse.json({ transfer });
  } catch (error) {
    console.error('Error upserting stock transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
