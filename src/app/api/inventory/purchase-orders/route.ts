import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { rejectIfBackdated } from '@/app/lib/frontoffice/postingDateGuard';
import {
  listPurchaseOrders,
  upsertPurchaseOrder,
  deletePurchaseOrder,
  type PurchaseOrderItemInput,
} from '@/app/lib/inventory/repository';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const subdomain = getTenantFromRequest(req);
  if (!subdomain) return null;
  const ctx = await getTenantContext(subdomain);
  return ctx?.tenantId ?? null;
}

// GET - Fetch purchase orders, optionally filtered by status/supplier/date range
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const orders = await listPurchaseOrders(tenantId, {
      status: searchParams.get('status') || undefined,
      supplierId: searchParams.get('supplierId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new purchase order
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.supplierId || !body.supplierName || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: supplierId, supplierName, items' },
        { status: 400 }
      );
    }

    const blocked = await rejectIfBackdated(tenantId, body.orderDate, { model: 'purchaseOrder', id: body.id });
    if (blocked) return blocked;

    const items: PurchaseOrderItemInput[] = body.items.map((item: any) => ({
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      receivedQuantity: Number(item.receivedQuantity ?? 0),
      notes: item.notes,
    }));

    const order = await upsertPurchaseOrder({
      id: body.id,
      tenantId,
      poNumber: body.poNumber,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      orderDate: body.orderDate,
      expectedDeliveryDate: body.expectedDeliveryDate,
      status: body.status,
      priority: body.priority,
      shippingAmount: body.shippingAmount,
      discountAmount: body.discountAmount,
      currency: body.currency,
      paymentTerms: body.paymentTerms,
      notes: body.notes,
      createdBy: body.createdBy,
      taxTypeId: body.taxTypeId,
      customTaxRate: body.customTaxRate,
      items,
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an existing purchase order (full replace of items)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const items: PurchaseOrderItemInput[] | undefined = body.items?.map((item: any) => ({
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      receivedQuantity: Number(item.receivedQuantity ?? 0),
      notes: item.notes,
    }));

    if (!items) {
      return NextResponse.json({ error: 'items is required for an update' }, { status: 400 });
    }

    const order = await upsertPurchaseOrder({
      id: body.id,
      tenantId,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      expectedDeliveryDate: body.expectedDeliveryDate,
      actualDeliveryDate: body.actualDeliveryDate,
      status: body.status,
      priority: body.priority,
      shippingAmount: body.shippingAmount,
      discountAmount: body.discountAmount,
      currency: body.currency,
      paymentTerms: body.paymentTerms,
      notes: body.notes,
      approvedBy: body.approvedBy,
      approvedAt: body.approvedAt,
      taxTypeId: body.taxTypeId,
      customTaxRate: body.customTaxRate,
      items,
    });

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a purchase order
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const result = await deletePurchaseOrder(tenantId, id);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Purchase order deleted successfully' });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
