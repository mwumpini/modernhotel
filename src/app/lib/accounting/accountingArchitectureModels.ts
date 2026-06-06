/**
 * Menish Hotel — extended accounting registers & integration payloads.
 * Aligns with proposed expense, inventory, payroll, fixed asset, adjustment, and tax modules.
 * Core documents (sales invoices, receipts) remain on Invoice / Payment in models.ts.
 */

export type SupplierExpenseType = 'food' | 'beverage' | 'utilities' | 'repairs' | 'other';
export type MenishCostCenterCode = 'rooms' | 'food' | 'admin' | 'events';
export type PurchaseOrderStatus = 'draft' | 'approved' | 'partial' | 'received' | 'cancelled';

/** Procurement request (no GL until convertPOToExpense / captureExpense). */
export interface PurchaseOrder {
  id: string;
  supplierId: string;
  orderNumber: string;
  orderDate: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  lines: Array<{ description: string; quantity: number; unitCost: number; itemCode?: string }>;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  costCenter?: MenishCostCenterCode;
  createdAt: string;
  updatedAt: string;
}

export type InventoryItemType = 'food' | 'beverage' | 'cleaning' | 'consumable';
export type InventoryTxnType = 'receipt' | 'usage' | 'adjustment' | 'count';

/** Stock movement posted through accounting (COGS / inventory asset). */
export interface InventoryAccountingTransaction {
  id: string;
  itemId: string;
  itemType: InventoryItemType;
  transactionType: InventoryTxnType;
  quantity: number;
  unitCost: number;
  totalValue: number;
  date: string;
  referenceId: string;
  journalEntryId: string;
  costCenter: string;
  createdAt: string;
}

export interface PayrollLedgerEntry {
  id: string;
  period: string;
  grossSalary: number;
  ssnitEmployer: number;
  ssnitEmployee: number;
  payeWithheld: number;
  staffWelfare?: number;
  netPay: number;
  paymentDate: string;
  journalEntryId: string;
  createdAt: string;
}

export interface SsnitRegisterEntry {
  id: string;
  payrollEntryId: string;
  period: string;
  employerAmount: number;
  employeeAmount: number;
  journalEntryId?: string;
  createdAt: string;
}

export interface PayeRegisterEntry {
  id: string;
  payrollEntryId: string;
  period: string;
  amount: number;
  journalEntryId?: string;
  createdAt: string;
}

export interface AccrualLedgerEntry {
  id: string;
  description: string;
  amount: number;
  expenseGlCode: string;
  period: string;
  accrualDate: string;
  journalEntryId: string;
  costCenter?: string;
  createdAt: string;
}

export interface PrepaymentLedgerEntry {
  id: string;
  description: string;
  amount: number;
  prepaidGlCode: string;
  period: string;
  paymentDate: string;
  journalEntryId: string;
  amortizationEndDate?: string;
  createdAt: string;
}

export interface TaxProvisionEntry {
  id: string;
  description: string;
  taxExpenseGl: string;
  taxPayableGl: string;
  amount: number;
  period: string;
  journalEntryId: string;
  createdAt: string;
}
