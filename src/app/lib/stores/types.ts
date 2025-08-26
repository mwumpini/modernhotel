'use client';

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'discontinued';
export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'received' | 'partially-received' | 'cancelled';
export type StockMovementType = 'purchase' | 'issue' | 'transfer' | 'adjustment' | 'return' | 'waste';

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  unit: string; // kg, liters, pieces, etc.
  costPrice: number;
  sellingPrice?: number;
  minStockLevel: number;
  maxStockLevel: number;
  currentStock: number;
  status: StockStatus;
  supplierId?: string;
  barcode?: string;
  location?: string;
  expiryDate?: string;
  lastUpdated: string;
  reorderPoint: number;
  leadTime: number; // days
  taxRate: number; // VAT/NHIL percentage
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  vatNumber?: string;
  paymentTerms: number; // days
  creditLimit: number;
  currentBalance: number;
  status: 'active' | 'inactive' | 'suspended';
  rating: number; // 1-5
  notes?: string;
  lastOrderDate?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDelivery: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  taxAmount?: number;
  items: PurchaseOrderItem[];
  notes?: string;
  createdBy: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  receivedAt?: string;
  receivedBy?: string;
}

export interface PurchaseOrderItem {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  receivedQuantity: number;
  notes?: string;
}

export interface StockMovement {
  id: string;
  movementType: StockMovementType;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  fromLocation?: string;
  toLocation?: string;
  reference: string; // PO number, issue slip, etc.
  date: string;
  notes?: string;
  createdBy: string;
  department?: string; // F&B, Housekeeping, etc.
  costCenter?: string;
}

export interface StockCount {
  id: string;
  countNumber: string;
  countDate: string;
  status: 'draft' | 'in-progress' | 'completed' | 'approved';
  items: StockCountItem[];
  totalVariance: number;
  totalValue: number;
  notes?: string;
  conductedBy: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface StockCountItem {
  id: string;
  itemId: string;
  itemName: string;
  expectedQuantity: number;
  actualQuantity: number;
  variance: number;
  varianceValue: number;
  notes?: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
  isActive: boolean;
}

export interface CostCenter {
  id: string;
  name: string;
  code: string;
  description?: string;
  department: string;
  budget: number;
  currentSpend: number;
  isActive: boolean;
}

export interface InventoryAlert {
  id: string;
  itemId: string;
  itemName: string;
  alertType: 'low-stock' | 'expiry' | 'overstock' | 'price-change';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}
