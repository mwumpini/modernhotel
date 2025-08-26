import { NextRequest, NextResponse } from 'next/server';
import { InventoryItem, ItemCategory } from '@/app/lib/models';

// Mock database (replace with real DB calls)
let inventoryItemsDB: InventoryItem[] = [
  {
    id: '1',
    itemCode: 'F&B-001',
    name: 'Rice (5kg)',
    description: 'Premium long grain rice',
    categoryId: '1',
    category: {
      id: '1',
      code: 'F&B',
      name: 'Food & Beverages',
      glAccountCode: '1310',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    unitOfMeasure: 'KG',
    purchaseUnit: 'KG',
    salesUnit: 'KG',
    conversionFactor: 1,
    standardCost: 25.00,
    averageCost: 25.00,
    lastPurchaseCost: 25.00,
    currency: 'GHS',
    sellingPrice: 30.00,
    minPrice: 25.00,
    maxPrice: 35.00,
    reorderPoint: 10,
    reorderQuantity: 20,
    maxStock: 100,
    minStock: 5,
    currentStock: 15,
    committedStock: 2,
    availableStock: 13,
    inventoryAccountCode: '1310',
    costOfGoodsAccountCode: '5110',
    salesAccountCode: '4200',
    purchaseAccountCode: '5100',
    taxCode: 'VAT',
    isTaxable: true,
    status: 'Active',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    itemCode: 'HK-001',
    name: 'Bath Towels',
    description: 'Premium cotton bath towels',
    categoryId: '2',
    category: {
      id: '2',
      code: 'HK',
      name: 'Housekeeping',
      glAccountCode: '1320',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    unitOfMeasure: 'PCS',
    purchaseUnit: 'PCS',
    salesUnit: 'PCS',
    conversionFactor: 1,
    standardCost: 15.00,
    averageCost: 15.00,
    lastPurchaseCost: 15.00,
    currency: 'GHS',
    sellingPrice: 0,
    minPrice: 0,
    maxPrice: 0,
    reorderPoint: 20,
    reorderQuantity: 50,
    maxStock: 200,
    minStock: 10,
    currentStock: 25,
    committedStock: 0,
    availableStock: 25,
    inventoryAccountCode: '1320',
    costOfGoodsAccountCode: '5110',
    salesAccountCode: '4200',
    purchaseAccountCode: '5100',
    isTaxable: false,
    status: 'Active',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// GET - Fetch all inventory items or filter by category
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    let items = [...inventoryItemsDB];

    // Filter by category
    if (categoryId) {
      items = items.filter(item => item.categoryId === categoryId);
    }

    // Filter by status
    if (status) {
      items = items.filter(item => item.status === status);
    }

    // Search by name, code, or description
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        item.itemCode.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new inventory item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.itemCode || !body.name || !body.categoryId) {
      return NextResponse.json(
        { error: 'Missing required fields: itemCode, name, categoryId' },
        { status: 400 }
      );
    }

    // Check for duplicate item code
    const existingItem = inventoryItemsDB.find(item => item.itemCode === body.itemCode);
    if (existingItem) {
      return NextResponse.json(
        { error: 'Item code already exists' },
        { status: 400 }
      );
    }

    // Create new item
    const newItem: InventoryItem = {
      id: (inventoryItemsDB.length + 1).toString(),
      itemCode: body.itemCode,
      name: body.name,
      description: body.description || '',
      categoryId: body.categoryId,
      category: body.category,
      unitOfMeasure: body.unitOfMeasure || 'PCS',
      purchaseUnit: body.purchaseUnit || body.unitOfMeasure || 'PCS',
      salesUnit: body.salesUnit || body.unitOfMeasure || 'PCS',
      conversionFactor: body.conversionFactor || 1,
      standardCost: body.standardCost || 0,
      averageCost: body.averageCost || 0,
      lastPurchaseCost: body.lastPurchaseCost || 0,
      currency: body.currency || 'GHS',
      sellingPrice: body.sellingPrice || 0,
      minPrice: body.minPrice || 0,
      maxPrice: body.maxPrice || 0,
      reorderPoint: body.reorderPoint || 0,
      reorderQuantity: body.reorderQuantity || 0,
      maxStock: body.maxStock || 0,
      minStock: body.minStock || 0,
      currentStock: body.currentStock || 0,
      committedStock: body.committedStock || 0,
      availableStock: body.availableStock || 0,
      inventoryAccountCode: body.inventoryAccountCode || '1310',
      costOfGoodsAccountCode: body.costOfGoodsAccountCode || '5110',
      salesAccountCode: body.salesAccountCode || '4200',
      purchaseAccountCode: body.purchaseAccountCode || '5100',
      taxCode: body.taxCode,
      isTaxable: body.isTaxable || false,
      status: body.status || 'Active',
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    inventoryItemsDB.push(newItem);
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update existing inventory item
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const itemIndex = inventoryItemsDB.findIndex(item => item.id === body.id);
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Check for duplicate item code (excluding current item)
    if (body.itemCode) {
      const existingItem = inventoryItemsDB.find(
        item => item.itemCode === body.itemCode && item.id !== body.id
      );
      if (existingItem) {
        return NextResponse.json(
          { error: 'Item code already exists' },
          { status: 400 }
        );
      }
    }

    // Update item
    const updatedItem = {
      ...inventoryItemsDB[itemIndex],
      ...body,
      updatedAt: new Date().toISOString()
    };

    inventoryItemsDB[itemIndex] = updatedItem;
    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete inventory item
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

    const itemIndex = inventoryItemsDB.findIndex(item => item.id === id);
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Check if item has stock
    const item = inventoryItemsDB[itemIndex];
    if (item.currentStock > 0) {
      return NextResponse.json(
        { error: 'Cannot delete item with existing stock' },
        { status: 400 }
      );
    }

    inventoryItemsDB.splice(itemIndex, 1);
    return NextResponse.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
