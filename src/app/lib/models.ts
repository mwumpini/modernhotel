// Inventory types
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  reorderPoint: number;
  supplierName: string;
  lastOrderDate?: Date;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ItemCategory {
  id: string;
  name: string;
  description?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  orderDate: Date;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  totalAmount: number;
  lines: PurchaseOrderLine[];
}

export interface PurchaseOrderLine {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// Country tax rule definition
export interface TaxRule {
  id: string;
  countryCode: string; // 'GH', 'ZW', 'US'
  name: string;        // 'NHIL', 'VAT'
  rate: number;        // 2.5 for 2.5%
  glCode: string;      // Accounting code
  appliesTo?: string[] // Optional: product categories
}

// Country reporting requirements
export interface ReportingRule {
  id: string;
  countryCode: string;
  reportType: 'VAT' | 'IncomeTax' | 'NHIL' | 'Tourism' | 'SSNIT' | 'PAYE' | 'Sales Tax' | 'Hotel Tax';
  frequency: 'Monthly' | 'Quarterly' | 'Annually';
  fieldsRequired: string[];
  dueDay: number; // Day of month/quarter/year when due
  isActive: boolean;
  lastUpdated: string;
}

// Compliance transaction record
export interface ComplianceTransaction {
  id: string;
  countryCode: string;
  transactionType: 'sale' | 'purchase' | 'refund';
  amount: number;
  taxAmount: number;
  taxRules: string[]; // Tax rule IDs applied
  timestamp: string;
  reference: string;
  glCode: string;
}

// Compliance report submission
export interface ComplianceReport {
  id: string;
  countryCode: string;
  reportType: string;
  period: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  amount: number;
  currency: string;
  submittedDate?: string;
  notes?: string;
  attachments?: string[];
}
