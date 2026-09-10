import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import {
  listGoodsReceiptNotes,
  upsertGoodsReceiptNote,
  type GRNItemInput,
} from '@/app/lib/inventory/repository';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const subdomain = getTenantFromRequest(req);
  if (!subdomain) return null;
  const ctx = await getTenantContext(subdomain);
  return ctx?.tenantId ?? null;
}

function mapItems(body: any): GRNItemInput[] {
  return (body.items || []).map((item: any) => ({
    poItemId: item.poItemId,
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    orderedQuantity: Number(item.orderedQuantity),
    receivedQuantity: Number(item.receivedQuantity),
    acceptedQuantity: Number(item.acceptedQuantity),
    rejectedQuantity: Number(item.rejectedQuantity),
    unitCost: Number(item.unitCost),
  }));
}

// GET - Fetch goods receipt notes, optionally filtered by PO/status
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const grns = await listGoodsReceiptNotes(tenantId, {
      poId: searchParams.get('poId') || undefined,
      status: searchParams.get('status') || undefined,
    });
    return NextResponse.json({ grns });
  } catch (error) {
    console.error('Error fetching goods receipt notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new goods receipt note
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.poId || !body.supplierId || !body.receivedBy || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: poId, supplierId, receivedBy, items' },
        { status: 400 }
      );
    }

    const grn = await upsertGoodsReceiptNote({
      id: body.id,
      tenantId,
      grnNumber: body.grnNumber,
      poId: body.poId,
      poNumber: body.poNumber,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      receiptDate: body.receiptDate,
      receivedBy: body.receivedBy,
      status: body.status,
      notes: body.notes,
      items: mapItems(body),
    });

    return NextResponse.json({ grn }, { status: 201 });
  } catch (error) {
    console.error('Error creating goods receipt note:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an existing goods receipt note (full replace of items)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    if (!body.items) return NextResponse.json({ error: 'items is required for an update' }, { status: 400 });

    const grn = await upsertGoodsReceiptNote({
      id: body.id,
      tenantId,
      grnNumber: body.grnNumber,
      poId: body.poId,
      poNumber: body.poNumber,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      receiptDate: body.receiptDate,
      receivedBy: body.receivedBy,
      status: body.status,
      qualityCheckedBy: body.qualityCheckedBy,
      qualityCheckedAt: body.qualityCheckedAt,
      qualityStatus: body.qualityStatus,
      qualityNotes: body.qualityNotes,
      approvedBy: body.approvedBy,
      approvedAt: body.approvedAt,
      notes: body.notes,
      items: mapItems(body),
    });

    return NextResponse.json({ grn });
  } catch (error) {
    console.error('Error updating goods receipt note:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
