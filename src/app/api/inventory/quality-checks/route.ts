import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import {
  listQualityChecks,
  upsertQualityCheck,
  type QualityCheckItemInput,
} from '@/app/lib/inventory/repository';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const subdomain = getTenantFromRequest(req);
  if (!subdomain) return null;
  const ctx = await getTenantContext(subdomain);
  return ctx?.tenantId ?? null;
}

function mapItems(body: any): QualityCheckItemInput[] {
  return (body.items || []).map((item: any) => ({
    grnItemId: item.grnItemId,
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    receivedQuantity: Number(item.receivedQuantity),
    checkedQuantity: Number(item.checkedQuantity),
    passedQuantity: Number(item.passedQuantity),
    failedQuantity: Number(item.failedQuantity),
    qualityStatus: item.qualityStatus,
    failureReason: item.failureReason,
    notes: item.notes,
  }));
}

// GET - Fetch quality checks, optionally filtered by GRN
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const checks = await listQualityChecks(tenantId, { grnId: searchParams.get('grnId') || undefined });
    return NextResponse.json({ checks });
  } catch (error) {
    console.error('Error fetching quality checks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new quality check
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.grnId || !body.supplierId || !body.checkedBy || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: grnId, supplierId, checkedBy, items' },
        { status: 400 }
      );
    }

    const check = await upsertQualityCheck({
      id: body.id,
      tenantId,
      checkNumber: body.checkNumber,
      grnId: body.grnId,
      grnNumber: body.grnNumber,
      poId: body.poId,
      poNumber: body.poNumber,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      checkedBy: body.checkedBy,
      checkedDate: body.checkedDate,
      overallStatus: body.overallStatus,
      notes: body.notes,
      items: mapItems(body),
    });

    return NextResponse.json({ check }, { status: 201 });
  } catch (error) {
    console.error('Error creating quality check:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an existing quality check (full replace of items)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    if (!body.items) return NextResponse.json({ error: 'items is required for an update' }, { status: 400 });

    const check = await upsertQualityCheck({
      id: body.id,
      tenantId,
      checkNumber: body.checkNumber,
      grnId: body.grnId,
      grnNumber: body.grnNumber,
      poId: body.poId,
      poNumber: body.poNumber,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      checkedBy: body.checkedBy,
      checkedDate: body.checkedDate,
      overallStatus: body.overallStatus,
      notes: body.notes,
      approvedBy: body.approvedBy,
      approvedAt: body.approvedAt,
      items: mapItems(body),
    });

    return NextResponse.json({ check });
  } catch (error) {
    console.error('Error updating quality check:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
