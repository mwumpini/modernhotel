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
  typeId?: string;     // Link to TaxType
  rate: number;        // 2.5 for 2.5%
  glCode: string;      // Accounting code
  description?: string;
  appliesTo?: string[]; // Optional: product categories
  enabled?: boolean;    // Whether rule is active
  priority?: number;    // Lower runs first
  calculationBase?: 'subtotal' | 'subtotal_plus_applied' | 'per_person' | 'per_night' | 'per_person_night';
  method?: 'rate' | 'fixed' | 'tiered';
  fixedAmount?: number; // used when method is 'fixed'
  tiers?: Array<{
    upto?: number;      // apply up to this base threshold; undefined = remaining
    rate?: number;      // percent for this tier when method is 'tiered'
    fixed?: number;     // fixed amount for this tier when method is 'tiered'
  }>;
  stacking?: 'additive' | 'compound';
  rounding?: 'none' | 'nearest' | 'down' | 'up';
  roundTo?: number;     // e.g., 0.01
  effectiveFrom?: string; // ISO date
  effectiveTo?: string;   // ISO date
  isSeparate?: boolean; // whether to present as separate charge
  domain?: 'sales' | 'payroll' | 'corporate' | 'purchases' | 'custom'; // selects rule group
  operation?: 'internal' | 'external' | 'both'; // applicable to operation type
  effect?: 'add' | 'subtract' | 'exclude_total' | 'informational'; // how to affect payable total
  /**
   * When true, tax paid on purchases can be claimed back (input tax) — e.g. Ghana VAT.
   * When false, it is a cost on purchases (e.g. NHIL / GETFund / Tourism today).
   * Undefined → accounting sync uses Ghana defaults by tax type until the rule is edited.
   */
  isRecoverable?: boolean;
  // Dual-sided contribution support (e.g. SSNIT: employee pays `rate`, employer pays
  // `employerRate`, both on the same base). Undefined on every non-payroll rule today —
  // purely additive, doesn't change existing sales/purchases tax behavior.
  employerRate?: number;
  // Base clamping for statutory schemes with an insurable-earnings ceiling/floor (e.g.
  // SSNIT). Applied to the calculation base before `rate`/`employerRate`; only used when
  // method is 'rate'.
  ceiling?: number;
  floor?: number;
  tags?: string[];
  scope?: {
    roomTypes?: string[];
    guestTypes?: string[];
  };
  condition?: {
    field: string;
    op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
    value: any;
  };
}

// Tax Type definition (groups one or more rules under a named type)
export interface TaxType {
  id: string;
  countryCode: string; // country this type applies to
  name: string;        // e.g., 'Purchases VAT', 'Withholding - Services'
  description?: string;
  domain?: 'sales' | 'purchases' | 'payroll' | 'corporate' | 'custom';
  operation?: 'internal' | 'external' | 'both';
  tags?: string[];
}

// Country reporting requirements
export interface ReportingRule {
  id: string;
  countryCode: string;
  reportType:
    | 'VAT'
    | 'IncomeTax'
    | 'NHIL'
    | 'GETFund'
    | 'Tourism'
    | 'SSNIT'
    | 'PAYE'
    | 'WHT'
    | 'CIT'
    | 'GSL'
    | 'Sales Tax'
    | 'Hotel Tax';
  frequency: 'Monthly' | 'Quarterly' | 'Annually';
  fieldsRequired: string[];
  dueDay: number;
  dueRule?: {
    type: string;
    day?: number;
    days?: number;
    dates?: string[];
    months?: number;
  };
  description?: string;
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
