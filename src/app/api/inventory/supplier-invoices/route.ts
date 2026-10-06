import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { rejectIfBackdated } from '@/app/lib/frontoffice/postingDateGuard';
import {
  listSupplierInvoices,
  upsertSupplierInvoice,
  type SupplierInvoiceItemInput,
} from '@/app/lib/inventory/repository';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const subdomain = getTenantFromRequest(req);
  if (!subdomain) return null;
  const ctx = await getTenantContext(subdomain);
  return ctx?.tenantId ?? null;
}

function mapItems(body: any): SupplierInvoiceItemInput[] {
  return (body.items || []).map((item: any) => ({
    poItemId: item.poItemId,
    grnItemId: item.grnItemId,
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    notes: item.notes,
  }));
}

// GET - Fetch supplier invoices, optionally filtered by PO/status
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const invoices = await listSupplierInvoices(tenantId, {
      poId: searchParams.get('poId') || undefined,
      status: searchParams.get('status') || undefined,
    });
    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Error fetching supplier invoices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new supplier invoice
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.supplierId || !body.poId || !body.dueDate || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: supplierId, poId, dueDate, items' },
        { status: 400 }
      );
    }

    const blocked = await rejectIfBackdated(tenantId, body.invoiceDate, { model: 'supplierInvoice', id: body.id });
    if (blocked) return blocked;

    const invoice = await upsertSupplierInvoice({
      id: body.id,
      tenantId,
      invoiceNumber: body.invoiceNumber,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      poId: body.poId,
      poNumber: body.poNumber,
      grnId: body.grnId,
      grnNumber: body.grnNumber,
      invoiceDate: body.invoiceDate,
      dueDate: body.dueDate,
      subtotal: body.subtotal,
      taxAmount: body.taxAmount,
      shippingAmount: body.shippingAmount,
      discountAmount: body.discountAmount,
      totalAmount: body.totalAmount,
      currency: body.currency,
      status: body.status,
      matchingStatus: body.matchingStatus,
      notes: body.notes,
      items: mapItems(body),
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an existing supplier invoice (full replace of items when provided)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 });

    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });

    const blocked = await rejectIfBackdated(tenantId, body.invoiceDate, { model: 'supplierInvoice', id: body.id });
    if (blocked) return blocked;

    const invoice = await upsertSupplierInvoice({
      id: body.id,
      tenantId,
      invoiceNumber: body.invoiceNumber,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      poId: body.poId,
      poNumber: body.poNumber,
      grnId: body.grnId,
      grnNumber: body.grnNumber,
      invoiceDate: body.invoiceDate,
      dueDate: body.dueDate,
      subtotal: body.subtotal,
      taxAmount: body.taxAmount,
      shippingAmount: body.shippingAmount,
      discountAmount: body.discountAmount,
      totalAmount: body.totalAmount,
      currency: body.currency,
      status: body.status,
      matchingStatus: body.matchingStatus,
      approvedBy: body.approvedBy,
      approvedAt: body.approvedAt,
      rejectedBy: body.rejectedBy,
      rejectedAt: body.rejectedAt,
      rejectionReason: body.rejectionReason,
      paidBy: body.paidBy,
      paidAt: body.paidAt,
      paymentMethod: body.paymentMethod,
      paymentReference: body.paymentReference,
      notes: body.notes,
      items: mapItems(body),
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Error updating supplier invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
