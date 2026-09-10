import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import {
  listRequisitions,
  upsertRequisition,
  deleteRequisition,
  type RequisitionItemInput,
} from '@/app/lib/inventory/repository';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const subdomain = getTenantFromRequest(req);
  if (!subdomain) return null;
  const ctx = await getTenantContext(subdomain);
  return ctx?.tenantId ?? null;
}

function mapItems(body: any): RequisitionItemInput[] {
  return (body.items || []).map((item: any) => ({
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    quantity: Number(item.quantity),
    estimatedPrice: Number(item.estimatedPrice),
    notes: item.notes,
  }));
}

// GET - Fetch requisitions, optionally filtered by status
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const requisitions = await listRequisitions(tenantId, { status: searchParams.get('status') || undefined });
    return NextResponse.json({ requisitions });
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new requisition
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.requestedBy || !body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: requestedBy, items' }, { status: 400 });
    }

    const requisition = await upsertRequisition({
      id: body.id,
      tenantId,
      requisitionNumber: body.requisitionNumber,
      requestedBy: body.requestedBy,
      requestedDate: body.requestedDate,
      status: body.status,
      notes: body.notes,
      items: mapItems(body),
    });

    return NextResponse.json({ requisition }, { status: 201 });
  } catch (error) {
    console.error('Error creating requisition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an existing requisition (full replace of items)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    if (!body.items) return NextResponse.json({ error: 'items is required for an update' }, { status: 400 });

    const requisition = await upsertRequisition({
      id: body.id,
      tenantId,
      requisitionNumber: body.requisitionNumber,
      requestedBy: body.requestedBy,
      requestedDate: body.requestedDate,
      status: body.status,
      approvedBy: body.approvedBy,
      approvedAt: body.approvedAt,
      rejectedBy: body.rejectedBy,
      rejectedAt: body.rejectedAt,
      rejectionReason: body.rejectionReason,
      convertedToPOId: body.convertedToPOId,
      convertedToPONumber: body.convertedToPONumber,
      notes: body.notes,
      items: mapItems(body),
    });

    return NextResponse.json({ requisition });
  } catch (error) {
    console.error('Error updating requisition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a requisition
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });

    const result = await deleteRequisition(tenantId, id);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Requisition deleted successfully' });
  } catch (error) {
    console.error('Error deleting requisition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
