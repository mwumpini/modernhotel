import { NextRequest, NextResponse } from 'next/server';
import { PurchaseOrder, PurchaseOrderLine } from '@/app/lib/models';

// Mock database (replace with real DB calls)
let purchaseOrdersDB: PurchaseOrder[] = [
  {
    id: '1',
    orderNumber: 'PO-2024-001',
    supplierId: '1',
    supplierName: 'Ghana Foods Ltd',
    orderDate: new Date().toISOString(),
    expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Draft',
    currency: 'GHS',
    exchangeRate: 1,
    subtotal: 500.00,
    taxAmount: 75.00,
    totalAmount: 575.00,
    notes: 'Urgent delivery required',
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lines: [
      {
        id: '1',
        itemId: '1',
        itemCode: 'F&B-001',
        itemName: 'Rice (5kg)',
        quantity: 20,
        unitPrice: 25.00,
        totalAmount: 500.00,
        receivedQuantity: 0,
        remainingQuantity: 20
      }
    ]
  }
];

// GET - Fetch all purchase orders or filter by status/supplier
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let orders = [...purchaseOrdersDB];

    // Filter by status
    if (status) {
      orders = orders.filter(order => order.status === status);
    }

    // Filter by supplier
    if (supplierId) {
      orders = orders.filter(order => order.supplierId === supplierId);
    }

    // Filter by date range
    if (startDate) {
      orders = orders.filter(order => order.orderDate >= startDate);
    }

    if (endDate) {
      orders = orders.filter(order => order.orderDate <= endDate);
    }

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new purchase order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.supplierId || !body.supplierName || !body.lines || body.lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: supplierId, supplierName, lines' },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotal = body.lines.reduce((sum: number, line: PurchaseOrderLine) => 
      sum + (line.quantity * line.unitPrice), 0
    );
    const taxAmount = subtotal * 0.15; // 15% VAT for Ghana
    const totalAmount = subtotal + taxAmount;

    // Create new purchase order
    const newOrder: PurchaseOrder = {
      id: (purchaseOrdersDB.length + 1).toString(),
      orderNumber: `PO-${new Date().getFullYear()}-${String(purchaseOrdersDB.length + 1).padStart(3, '0')}`,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      orderDate: body.orderDate || new Date().toISOString(),
      expectedDeliveryDate: body.expectedDeliveryDate,
      status: body.status || 'Draft',
      currency: body.currency || 'GHS',
      exchangeRate: body.exchangeRate || 1,
      subtotal,
      taxAmount,
      totalAmount,
      notes: body.notes || '',
      createdBy: body.createdBy || 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: body.lines.map((line: any, index: number) => ({
        id: (index + 1).toString(),
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        totalAmount: line.quantity * line.unitPrice,
        receivedQuantity: 0,
        remainingQuantity: line.quantity
      }))
    };

    purchaseOrdersDB.push(newOrder);
    return NextResponse.json(newOrder, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update existing purchase order
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const orderIndex = purchaseOrdersDB.findIndex(order => order.id === body.id);
    if (orderIndex === -1) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Don't allow updates to posted orders
    const currentOrder = purchaseOrdersDB[orderIndex];
    if (currentOrder.status === 'Posted') {
      return NextResponse.json(
        { error: 'Cannot update posted purchase order' },
        { status: 400 }
      );
    }

    // Recalculate totals if lines changed
    let subtotal = currentOrder.subtotal;
    let taxAmount = currentOrder.taxAmount;
    let totalAmount = currentOrder.totalAmount;

    if (body.lines) {
      subtotal = body.lines.reduce((sum: number, line: PurchaseOrderLine) => 
        sum + (line.quantity * line.unitPrice), 0
      );
      taxAmount = subtotal * 0.15; // 15% VAT for Ghana
      totalAmount = subtotal + taxAmount;
    }

    // Update order
    const updatedOrder = {
      ...currentOrder,
      ...body,
      subtotal,
      taxAmount,
      totalAmount,
      updatedAt: new Date().toISOString()
    };

    purchaseOrdersDB[orderIndex] = updatedOrder;
    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete purchase order
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    const orderIndex = purchaseOrdersDB.findIndex(order => order.id === id);
    if (orderIndex === -1) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    const order = purchaseOrdersDB[orderIndex];
    if (order.status !== 'Draft') {
      return NextResponse.json(
        { error: 'Can only delete draft purchase orders' },
        { status: 400 }
      );
    }

    purchaseOrdersDB.splice(orderIndex, 1);
    return NextResponse.json({ message: 'Purchase order deleted successfully' });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
