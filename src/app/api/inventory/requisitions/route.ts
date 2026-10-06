import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth, requirePermission } from '@/app/lib/api/auth-guard';
import {
  listRequisitions,
  getRequisitionById,
  upsertRequisition,
  deleteRequisition,
  type RequisitionItemInput,
} from '@/app/lib/inventory/repository';
import { getApprovalRequirement } from '@/app/lib/api/approvalThresholds';
import { rejectIfBackdated } from '@/app/lib/frontoffice/postingDateGuard';

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
    preferredSupplierId: item.preferredSupplierId,
    preferredSupplierName: item.preferredSupplierName,
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
    const requisitions = await listRequisitions(tenantId, {
      status: searchParams.get('status') || undefined,
      department: searchParams.get('department') || undefined,
    });
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

    const blocked = await rejectIfBackdated(tenantId, body.requestedDate, { model: 'requisition', id: body.id });
    if (blocked) return blocked;

    const requisition = await upsertRequisition({
      id: body.id,
      tenantId,
      requisitionNumber: body.requisitionNumber,
      requestedBy: body.requestedBy,
      requestedDate: body.requestedDate,
      status: body.status,
      department: body.department,
      assignedToId: body.assignedToId,
      assignedToName: body.assignedToName,
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
//
// Permission gating: a plain edit of a still-pending requisition needs nothing
// beyond auth (any staffer can fix their own draft before Stores decides). Two
// things need more:
//   - Actually changing status (approve/reject/mark ready/convert-to-po) is a
//     Stores decision — 'inventory.approve-requisition'.
//   - Editing/deleting a requisition Stores has already acted on (not 'pending'
//     any more) without changing its status — e.g. correcting quantities on an
//     approved one — is 'inventory.edit-processed-requisition'.
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    if (!body.items) return NextResponse.json({ error: 'items is required for an update' }, { status: 400 });

    const existing = await getRequisitionById(tenantId, body.id);
    if (!existing) return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });

    const blocked = await rejectIfBackdated(tenantId, body.requestedDate, { model: 'requisition', id: body.id });
    if (blocked) return blocked;

    if (body.status && body.status !== existing.status) {
      const permCheck = await requirePermission(req, 'inventory.approve-requisition');
      if (!permCheck.ok) return permCheck.response;

      // Approving a requisition whose total value is at/above the tenant's
      // configured purchase-order-approval threshold needs director sign-off —
      // same "downgrade rather than reject" pattern as journal entries and
      // payments: the request still succeeds, just parked at
      // 'pending-director-approval' instead of 'approved', until someone with
      // inventory.approve-high-value-requisition runs the same action again.
      if (body.status === 'approved') {
        const totalValue = existing.items.reduce((sum, item) => sum + Number(item.totalCost), 0);
        const { needsApproval } = await getApprovalRequirement(tenantId, 'purchaseOrder', totalValue);
        if (needsApproval) {
          const approvePerm = await requirePermission(req, 'inventory.approve-high-value-requisition');
          if (!approvePerm.ok) {
            body.status = 'pending-director-approval';
            body.approvedBy = undefined;
            body.approvedAt = undefined;
          }
        }
      }
    } else if (existing.status !== 'pending') {
      const permCheck = await requirePermission(req, 'inventory.edit-processed-requisition');
      if (!permCheck.ok) return permCheck.response;
    }

    const requisition = await upsertRequisition({
      id: body.id,
      tenantId,
      requisitionNumber: body.requisitionNumber,
      requestedBy: body.requestedBy,
      requestedDate: body.requestedDate,
      status: body.status,
      department: body.department,
      assignedToId: body.assignedToId,
      assignedToName: body.assignedToName,
      approvedBy: body.approvedBy,
      approvedAt: body.approvedAt,
      readyBy: body.readyBy,
      readyAt: body.readyAt,
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

    const existing = await getRequisitionById(tenantId, id);
    if (!existing) return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    if (existing.status !== 'pending') {
      const permCheck = await requirePermission(req, 'inventory.edit-processed-requisition');
      if (!permCheck.ok) return permCheck.response;
    }

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
