// Inventory & Stores Data Models

export interface StockItem {
  id: string;
  itemCode: string;
  name: string;
  description: string;
  category: 'food' | 'beverage' | 'cleaning' | 'maintenance' | 'office' | 'linens' | 'amenities' | 'electronics' | 'furniture' | 'other';
  subcategory: string;
  unit: string;
  unitCost: number;
  sellingPrice?: number;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  reorderPoint: number;
  supplierId?: string;
  supplierName?: string;
  location: string;
  binLocation?: string;
  expiryDate?: Date;
  batchNumber?: string;
  isActive: boolean;
  isPerishable: boolean;
  isSerialized: boolean;
  serialNumbers?: string[];
  barcode?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  taxId: string;
  paymentTerms: 'net30' | 'net60' | 'net90' | 'immediate';
  creditLimit: number;
  currentBalance: number;
  rating: number; // 1-5
  categories: string[];
  isActive: boolean;
  contractStartDate: Date;
  contractEndDate?: Date;
  performance: {
    onTimeDelivery: number;
    qualityRating: number;
    responseTime: number;
    totalOrders: number;
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: Date;
  expectedDeliveryDate: Date;
  actualDeliveryDate?: Date;
  status: 'draft' | 'sent' | 'confirmed' | 'in-transit' | 'delivered' | 'cancelled' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  totalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  paymentTerms: string;
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  items: PurchaseOrderItem[];
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQuantity: number;
  notes?: string;
}

export interface Requisition {
  id: string;
  requisitionNumber: string;
  requestedBy: string;
  requestedDate: Date;
  requestedItems: RequisitionItem[];
  status: 'pending' | 'approved' | 'rejected' | 'converted-to-po' | 'cancelled';
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  convertedToPOId?: string;
  convertedToPONumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequisitionItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  estimatedPrice: number;
  totalCost: number;
  notes?: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  movementType: 'in' | 'out' | 'adjustment' | 'transfer' | 'return' | 'damage' | 'expiry';
  quantity: number;
  unitCost: number;
  totalValue: number;
  fromLocation?: string;
  toLocation?: string;
  referenceType: 'purchase' | 'sale' | 'transfer' | 'adjustment' | 'return' | 'damage' | 'expiry';
  referenceId: string;
  referenceNumber: string;
  batchNumber?: string;
  expiryDate?: Date;
  reason?: string;
  performedBy: string;
  notes?: string;
  createdAt: Date;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromLocation: string;
  toLocation: string;
  transferDate: Date;
  expectedDeliveryDate: Date;
  actualDeliveryDate?: Date;
  status: 'pending' | 'in-transit' | 'delivered' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  totalItems: number;
  totalValue: number;
  items: StockTransferItem[];
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockTransferItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  transferredQuantity: number;
  notes?: string;
}

export interface InventoryAdjustment {
  id: string;
  adjustmentNumber: string;
  adjustmentType: 'count' | 'damage' | 'expiry' | 'theft' | 'correction' | 'other';
  reason: string;
  location: string;
  totalItems: number;
  totalValue: number;
  items: InventoryAdjustmentItem[];
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryAdjustmentItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  previousQuantity: number;
  newQuantity: number;
  difference: number;
  unitCost: number;
  totalValue: number;
  notes?: string;
}

export interface StockCount {
  id: string;
  countNumber: string;
  countType: 'full' | 'cycle' | 'spot' | 'random';
  location: string;
  startDate: Date;
  endDate?: Date;
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  totalItems: number;
  countedItems: number;
  varianceItems: number;
  totalValue: number;
  varianceValue: number;
  items: StockCountItem[];
  notes?: string;
  createdBy: string;
  performedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockCountItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  unitCost: number;
  varianceValue: number;
  notes?: string;
}

export interface InventoryAlert {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  alertType: 'low-stock' | 'overstock' | 'expiry' | 'reorder' | 'price-change' | 'quality-issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  currentValue: number;
  thresholdValue: number;
  isActive: boolean;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryReport {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom' | 'low-stock' | 'expiry' | 'movement' | 'value';
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  generatedAt: Date;
  summary: {
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    expiringItems: number;
    activeSuppliers: number;
    totalMovements: number;
    totalPurchases: number;
    totalTransfers: number;
  };
  details: {
    categoryBreakdown: Record<string, { count: number; value: number }>;
    locationBreakdown: Record<string, { count: number; value: number }>;
    supplierBreakdown: Record<string, { count: number; value: number }>;
    movementSummary: Record<string, number>;
    topItems: Array<{ itemCode: string; name: string; quantity: number; value: number }>;
  };
  recommendations: string[];
}

export interface InventoryAnalytics {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;
  totalInventoryValue: number;
  averageItemValue: number;
  stockTurnoverRate: number;
  daysInventoryOutstanding: number;
  lowStockPercentage: number;
  overstockPercentage: number;
  expiryRiskValue: number;
  categoryDistribution: Record<string, { count: number; value: number; percentage: number }>;
  locationEfficiency: Record<string, { utilization: number; value: number }>;
  supplierPerformance: Record<string, { rating: number; deliveryTime: number; qualityScore: number }>;
  trends: {
    period: string;
    value: number;
    change: number;
    percentageChange: number;
  }[];
}

export interface CostAnalysis {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  totalPurchaseCost: number;
  totalHoldingCost: number;
  totalOrderingCost: number;
  totalShortageCost: number;
  totalInventoryValue: number;
  costBreakdown: {
    category: string;
    purchaseCost: number;
    holdingCost: number;
    orderingCost: number;
    shortageCost: number;
    totalCost: number;
    percentage: number;
  }[];
  efficiencyMetrics: {
    inventoryTurnover: number;
    daysInventoryOutstanding: number;
    carryingCostPercentage: number;
    stockoutRate: number;
  };
}

// Goods Receipt Note (GRN)
export interface GoodsReceiptNote {
  id: string;
  grnNumber: string;
  poId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  receiptDate: Date;
  receivedBy: string;
  items: GRNItem[];
  totalItems: number;
  totalValue: number;
  status: 'pending' | 'quality-check' | 'approved' | 'rejected' | 'completed';
  qualityCheckedBy?: string;
  qualityCheckedAt?: Date;
  qualityStatus?: 'passed' | 'failed' | 'partial';
  qualityNotes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GRNItem {
  id: string;
  poItemId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unitCost: number;
  totalValue: number;
  batchNumber?: string;
  expiryDate?: Date;
  qualityStatus: 'pending' | 'passed' | 'failed';
  qualityNotes?: string;
  notes?: string;
}

// Supplier Invoice
export interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  poId: string;
  poNumber: string;
  grnId?: string;
  grnNumber?: string;
  invoiceDate: Date;
  dueDate: Date;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'matched' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  matchingStatus: {
    isQuantityMatched: boolean;
    isPriceMatched: boolean;
    isTermsMatched: boolean;
    discrepancies: string[];
    matchedBy?: string;
    matchedAt?: Date;
  };
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  paidBy?: string;
  paidAt?: Date;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  poItemId: string;
  grnItemId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

// Quality Check
export interface QualityCheck {
  id: string;
  checkNumber: string;
  grnId: string;
  grnNumber: string;
  poId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  checkedBy: string;
  checkedDate: Date;
  items: QualityCheckItem[];
  overallStatus: 'pending' | 'passed' | 'failed' | 'partial';
  passedItems: number;
  failedItems: number;
  totalItems: number;
  notes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QualityCheckItem {
  id: string;
  grnItemId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  receivedQuantity: number;
  checkedQuantity: number;
  passedQuantity: number;
  failedQuantity: number;
  qualityStatus: 'pending' | 'passed' | 'failed';
  failureReason?: string;
  notes?: string;
}
