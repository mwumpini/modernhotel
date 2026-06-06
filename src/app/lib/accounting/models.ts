// Accounting Models for Ghana/Africa Hotel Management System

// Chart of Accounts Structure
export interface ChartOfAccounts {
  id: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  category: string;
  subcategory?: string;
  description?: string;
  isActive: boolean;
  parentAccount?: string;
  level: number; // 1 = Main account, 2 = Sub-account, 3 = Detail account
  currency: string; // GHS, USD, EUR, etc.
  createdAt: string;
  updatedAt: string;
}

// Journal Entry
export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  reference: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  currency: string;
  exchangeRate?: number;
  status: 'Draft' | 'Posted' | 'Void';
  postedBy?: string;
  postedAt?: string;
  createdAt: string;
  updatedAt: string;
  lines: JournalEntryLine[];
  /** Originating module (e.g. pl_period_close, front_office_checkout). */
  sourceModule?: string;
  sourceTransactionId?: string;
}

// Journal Entry Line
export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountCode: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
  exchangeRate?: number;
  taxCode?: string;
  taxAmount?: number;
  department?: string;
  project?: string;
  costCenter?: string;
  reference?: string;
}

// General Ledger Account Balance
export interface GLBalance {
  id: string;
  accountCode: string;
  period: string; // YYYY-MM format
  openingBalance: number;
  currentDebit: number;
  currentCredit: number;
  closingBalance: number;
  currency: string;
  lastUpdated: string;
}

// Tax Configuration
export interface TaxConfig {
  id: string;
  code: string;
  name: string;
  rate: number;
  type: 'VAT' | 'NHIL' | 'GETFund' | 'COVID19' | 'Tourism' | 'Withholding' | 'Other';
  glAccountCode: string;
  isRecoverable: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  countryCode: string;
  /**
   * Lower value = applied first on tax-exclusive amount (pre-VAT levies). VAT is applied last on (exclusive + pre-VAT).
   */
  purchaseStackOrder?: number;
  /** Include in automatic purchase (input) tax posting. Default: true except withholding. */
  applyOnPurchases?: boolean;
  /** Include in automatic sales (output) tax posting. Default: true except withholding. */
  applyOnSales?: boolean;
}

// Financial Period
export interface FinancialPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
  isCurrent: boolean;
  year: number;
  period: number; // 1-12 for months
  createdAt: string;
  closedAt?: string;
  closedBy?: string;
}

// Bank Account
export interface BankAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  branch?: string;
  swiftCode?: string;
  iban?: string;
  currency: string;
  glAccountCode: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Bank Transaction
export interface BankTransaction {
  id: string;
  bankAccountId: string;
  transactionDate: string;
  reference: string;
  description: string;
  amount: number;
  type: 'Deposit' | 'Withdrawal' | 'Transfer' | 'Charge' | 'Interest';
  currency: string;
  balance: number;
  status: 'Pending' | 'Cleared' | 'Reconciled';
  reconciledAt?: string;
  reconciledBy?: string;
  journalEntryId?: string;
  createdAt: string;
}

// Customer/Supplier Account
export interface BusinessPartner {
  id: string;
  code: string;
  name: string;
  type: 'Customer' | 'Supplier' | 'Both';
  taxNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  creditLimit?: number;
  paymentTerms?: number; // days
  glAccountCode: string;
  currency: string;
  balance: number;
  isActive: boolean;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
  // Optional bank details for payments
  bankName?: string;
  bankAccountNumber?: string;
  bankSwift?: string;
  bankIban?: string;
}

// Invoice
export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'Sales' | 'Purchase';
  date: string;
  dueDate: string;
  businessPartnerId: string;
  reference?: string;
  description: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  exchangeRate?: number;
  status: 'Draft' | 'Posted' | 'Paid' | 'Void';
  paidAmount: number;
  paidDate?: string;
  journalEntryId?: string;
  createdAt: string;
  updatedAt: string;
  lines: InvoiceLine[];
  // Extended AP/AR metadata
  poNumber?: string;
  receiptNumber?: string;
  department?: string;
  projectCode?: string;
  location?: string;
  preparedBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  authorizedBy?: string;
  paymentApprovedBy?: string;
  attachments?: string[];
  discountAmount?: number;
  shippingCharges?: number;
  otherCharges?: number;
  amountDue?: number;
  paymentMethod?: string;
  paymentTerms?: string;
  discountTerms?: string;
  paymentReference?: string;
  workflowStatus?: 'New' | 'In Review' | 'Approved' | 'Rejected' | 'Paid';
  rejectionReason?: string;
  countryCode?: string;
  /** Originating module (e.g. integration_extended_expense, front_office_checkout). */
  sourceModule?: string;
  taxBreakdown?: {
    vat?: number;
    nhil?: number;
    getfund?: number;
    covid?: number;
    tourism?: number;
    withholding?: number;
    other?: number;
    taxableAmount?: number;
    nonTaxableAmount?: number;
    reverseCharge?: boolean;
    withholdingCertNo?: string;
  };
  // Tax scheme selection
  taxScheme?: 'GH_STANDARD' | 'FLAT' | 'NONE';
  flatRatePercent?: number;
  // WHT Tracking - for invoices where customer withholds tax
  whtExpected?: number; // Expected WHT amount (5% of subtotal)
  whtVatExpected?: number; // Expected WHT-VAT amount (7% of VAT)
  whtReceived?: number; // WHT certificate amount received
  whtVatReceived?: number; // WHT-VAT certificate amount received
  whtCertificateIds?: string[]; // IDs of linked WHT certificates
  whtStatus?: 'N/A' | 'Pending' | 'Partial' | 'Complete'; // WHT certificate status
  /** Automated GL / AR sub-ledger classification (NHIA, insurers, etc.) */
  salesLedgerPreset?: 'nhia_claim' | 'insurance_receivable' | 'standard';
}

// Invoice Line
export interface InvoiceLine {
  id: string;
  invoiceId: string;
  itemCode?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxCode?: string;
  taxAmount: number;
  glAccountCode: string;
  costCenter?: string;
  project?: string;
  uom?: string; // Unit of measure
  taxRate?: number; // percent
}

// Payment
export interface Payment {
  id: string;
  paymentNumber: string;
  date: string;
  type: 'Receipt' | 'Payment';
  businessPartnerId: string;
  invoiceId?: string;
  reference?: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  paymentMethod: 'Cash' | 'Bank' | 'Check' | 'Card' | 'Mobile Money' | 'WHT Certificate';
  bankAccountId?: string;
  checkNumber?: string;
  status: 'Draft' | 'Posted' | 'Void';
  journalEntryId?: string;
  /** Originating module (manual_ar_ap, restaurant, integration_extended_*, etc.) */
  sourceModule?: string;
  // WHT Certificate fields (for payments with withheld tax)
  isWHTCertificate?: boolean;
  whtCertificateId?: string; // Link to WHTCertificate record
  whtAmount?: number; // Amount of WHT (5% of subtotal)
  whtVatAmount?: number; // Amount of WHT-VAT (7% of VAT)
  // Receipt acknowledgement & files
  receivedBy?: string;
  receiverContact?: string;
  receiverIdType?: string;
  receiverIdNumber?: string;
  receivedDate?: string;
  receiverSignature?: string;
  attachments?: string[];
  pdfUrl?: string;
  pdfFileName?: string;
  pdfGeneratedAt?: string;
  pdfGeneratedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// WHT Certificate - Proof of withholding tax payment from GRA
export interface WHTCertificate {
  id: string;
  certificateNumber: string; // GRA certificate number
  date: string; // Date certificate was issued
  receivedDate: string; // Date company received the certificate
  withholdingAgentName: string; // Name of customer/payer who withheld
  withholdingAgentTIN: string; // Tax Identification Number of withholding agent
  taxPeriod: string; // e.g., "January 2026", "Q1 2026"
  invoiceId?: string; // Linked invoice
  invoiceNumber?: string;
  // Amounts
  grossAmount: number; // Original invoice amount
  whtRate: number; // Typically 5%
  whtAmount: number; // WHT withheld
  whtVatRate?: number; // Typically 7%
  whtVatAmount?: number; // WHT-VAT withheld
  totalWithheld: number; // whtAmount + whtVatAmount
  // Status
  status: 'Pending' | 'Received' | 'Verified' | 'Filed' | 'Used';
  // GL Entries
  journalEntryId?: string;
  // Tax credit tracking
  taxCreditAccountCode?: string; // GL code for WHT receivable/credit
  taxCreditUsedAmount?: number; // Amount already used as tax credit
  taxCreditBalance?: number; // Remaining credit balance
  // Metadata
  verifiedBy?: string;
  verifiedDate?: string;
  notes?: string;
  attachments?: string[]; // Scanned certificate files
  createdAt: string;
  updatedAt: string;
}

// Payment Voucher
export interface PaymentVoucher {
  id: string;
  voucherNumber: string;
  date: Date;
  payTo: string; // Payee name/details
  payToId?: string; // Business Partner ID if applicable
  contact?: string; // Payee contact person or internal contact
  lines: PaymentVoucherLine[];
  totalDebit: number;
  totalCredit: number;
  bankAccountId?: string;
  bankAccountName?: string;
  chequeNumber?: string;
  description?: string;
  reference?: string;
  status: 'Draft' | 'Prepared' | 'Approved' | 'Recorded' | 'Posted' | 'Cancelled';
  currency: string;
  // Authorization
  preparedBy?: string;
  preparedSignature?: string;
  preparedDate?: Date;
  approvedBy?: string;
  approvedSignature?: string;
  approvedDate?: Date;
  recordedBy?: string;
  recordedSignature?: string;
  recordedDate?: Date;
  // Receipt acknowledgement
  receivedBy?: string; // Person who received the payment (payee rep)
  receiverContact?: string; // Phone/email/notes
  receiverIdType?: string; // e.g., Ghana Card, Passport
  receiverIdNumber?: string;
  receivedDate?: Date;
  receiverSignature?: string; // base64 image data
  // Files
  attachments?: string[]; // arbitrary filenames
  pdfUrl?: string; // link or data URL to generated voucher PDF
  pdfFileName?: string;
  pdfGeneratedAt?: Date;
  pdfGeneratedBy?: string;
  // Journal Entry linkage
  journalEntryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Payment Voucher Line
export interface PaymentVoucherLine {
  id: string;
  accountCode: string;
  accountName?: string;
  details: string;
  debit: number;
  credit: number;
  costCenter?: string;
  project?: string;
  reference?: string;
}

// Fixed Asset
export interface FixedAsset {
  id: string;
  assetNumber: string;
  name: string;
  description?: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  currency: string;
  exchangeRate?: number;
  usefulLife: number; // years
  salvageValue: number;
  depreciationMethod: 'Straight Line' | 'Declining Balance' | 'Units of Production';
  depreciationRate: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  /** Ghana tax pool for capital allowance (wear & tear). */
  capitalAllowancePool?: import('./capitalAllowance').CapitalAllowancePool;
  /** Cumulative tax capital allowance claimed (does not affect book NBV). */
  accumulatedCapitalAllowance?: number;
  location?: string;
  department?: string;
  status: 'Active' | 'Disposed' | 'Under Maintenance';
  glAccountCode: string;
  capitalizationJournalEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Tax capital allowance claim register (no book JE — feeds tax computation). */
export interface CapitalAllowanceClaim {
  id: string;
  assetId: string;
  taxYear: number;
  period: string; // YYYY-MM
  pool: import('./capitalAllowance').CapitalAllowancePool;
  allowanceAmount: number;
  writtenDownValueAfter: number;
  createdAt: string;
}

// Depreciation Schedule
export interface DepreciationSchedule {
  id: string;
  assetId: string;
  period: string; // YYYY-MM
  depreciationAmount: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  isPosted: boolean;
  journalEntryId?: string;
  createdAt: string;
}

// Cost Center - Tracks expenses by department
export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: 'department' | 'operation' | 'project' | 'support';
  department: 'front_office' | 'housekeeping' | 'food_beverage' | 'kitchen' | 'maintenance' | 'sales_marketing' | 'accounting' | 'hr' | 'security' | 'general' | 'other';
  parentCenter?: string;
  manager?: string;
  budget?: number;
  actualExpenses: number; // Track actual expenses
  variance?: number; // budget - actual
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Revenue Center - Tracks revenue by source
export interface RevenueCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: 'rooms' | 'food_beverage' | 'services' | 'conferences' | 'spa' | 'gift_shop' | 'other';
  department: 'front_office' | 'restaurant' | 'bar' | 'room_service' | 'conference' | 'spa' | 'retail' | 'other';
  glAccountCode: string; // Revenue account code
  parentCenter?: string;
  manager?: string;
  budget?: number; // Revenue budget/target
  actualRevenue: number; // Track actual revenue
  variance?: number; // actual - budget
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Project
export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  budget: number;
  currency: string;
  status: 'Active' | 'Completed' | 'On Hold' | 'Cancelled';
  manager?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Financial Report
export interface FinancialReport {
  id: string;
  name: string;
  type: 'Balance Sheet' | 'Income Statement' | 'Cash Flow' | 'Trial Balance' | 'Custom';
  period: string;
  currency: string;
  data: any; // Report-specific data structure
  generatedAt: string;
  generatedBy: string;
}

// Audit Trail
export interface AuditTrail {
  id: string;
  tableName: string;
  recordId: string;
  action: 'Create' | 'Update' | 'Delete' | 'Post' | 'Void';
  oldValues?: any;
  newValues?: any;
  userId: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

// Ghana-Specific Tax Codes
/** Default rates + **leaf** GL codes (must match `GHANA_CHART_OF_ACCOUNTS` tax payables). */
export const GHANA_TAX_CODES = {
  VAT: { code: 'VAT', name: 'Value Added Tax', rate: 15.0, glCode: '2110' },
  NHIL: { code: 'NHIL', name: 'National Health Insurance Levy', rate: 2.5, glCode: '2120' },
  GETFUND: { code: 'GETFUND', name: 'Ghana Education Trust Fund', rate: 2.5, glCode: '2130' },
  /** @deprecated Abolished; retained for historical invoices only */
  COVID19: { code: 'COVID19', name: 'COVID-19 Recovery Levy (legacy)', rate: 0, glCode: '2140' },
  TOURISM: { code: 'TOURISM', name: 'Tourism Development Levy', rate: 1.0, glCode: '2150' },
  WITHHOLDING: { code: 'WITHHOLDING', name: 'Withholding Tax', rate: 5.0, glCode: '2160' }
};

// Standard Chart of Accounts for Ghana Hotels
export const GHANA_CHART_OF_ACCOUNTS = [
  // Assets (1000-1999)
  { code: '1000', name: 'Current Assets', type: 'Asset', category: 'Current Assets', level: 1 },
  { code: '1100', name: 'Cash and Cash Equivalents', type: 'Asset', category: 'Current Assets', level: 2 },
  { code: '1110', name: 'Cash in Hand', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1120', name: 'Bank Accounts', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1200', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets', level: 2 },
  { code: '1210', name: 'Guest Accounts Receivable', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1220', name: 'Other Receivables', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1225', name: 'NHIA / NHIS Receivable', type: 'Asset', category: 'Current Assets', level: 3, description: 'Claims due from National Health Insurance' },
  { code: '1226', name: 'Insurance Company Receivable', type: 'Asset', category: 'Current Assets', level: 3, description: 'Guest or corporate insurer recoveries' },
  { code: '1230', name: 'WHT Receivable', type: 'Asset', category: 'Current Assets', level: 3, description: 'Withholding tax credits from GRA certificates' },
  { code: '1240', name: 'WHT-VAT Receivable', type: 'Asset', category: 'Current Assets', level: 3, description: 'Withholding VAT credits from GRA certificates' },
  { code: '1300', name: 'Inventory', type: 'Asset', category: 'Current Assets', level: 2 },
  { code: '1310', name: 'Food and Beverage Inventory', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1320', name: 'Housekeeping Supplies', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1330', name: 'Operating Supplies', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1400', name: 'Prepaid Expenses', type: 'Asset', category: 'Current Assets', level: 2 },
  { code: '1500', name: 'Fixed Assets', type: 'Asset', category: 'Fixed Assets', level: 1 },
  { code: '1510', name: 'Property and Equipment', type: 'Asset', category: 'Fixed Assets', level: 2 },
  { code: '1520', name: 'Accumulated Depreciation', type: 'Asset', category: 'Fixed Assets', level: 2 },

  // Liabilities (2000-2999)
  { code: '2000', name: 'Current Liabilities', type: 'Liability', category: 'Current Liabilities', level: 1 },
  { code: '2100', name: 'Tax Payables', type: 'Liability', category: 'Current Liabilities', level: 2 },
  { code: '2110', name: 'VAT Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2120', name: 'NHIL Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2130', name: 'GETFund Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2140', name: 'COVID-19 Levy Payable (legacy)', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2150', name: 'Tourism Levy Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2160', name: 'Withholding Tax Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2200', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities', level: 2 },
  { code: '2210', name: 'PAYE Payable', type: 'Liability', category: 'Current Liabilities', level: 3, description: 'Employee income tax withheld' },
  { code: '2220', name: 'SSNIT & Tier-1 Contributions Payable', type: 'Liability', category: 'Current Liabilities', level: 3, description: 'Social security remittances due' },
  { code: '2300', name: 'Accrued Expenses', type: 'Liability', category: 'Current Liabilities', level: 2 },
  { code: '2400', name: 'Deferred Revenue', type: 'Liability', category: 'Current Liabilities', level: 2 },

  // Equity (3000-3999)
  { code: '3000', name: 'Owner\'s Equity', type: 'Equity', category: 'Equity', level: 1 },
  { code: '3100', name: 'Share Capital', type: 'Equity', category: 'Equity', level: 2 },
  { code: '3200', name: 'Retained Earnings', type: 'Equity', category: 'Equity', level: 2 },
  { code: '3300', name: 'Current Year Earnings', type: 'Equity', category: 'Equity', level: 2 },

  // Revenue (4000-4999)
  { code: '4000', name: 'Operating Revenue', type: 'Revenue', category: 'Revenue', level: 1 },
  { code: '4100', name: 'Room Revenue', type: 'Revenue', category: 'Revenue', level: 2 },
  { code: '4200', name: 'Food and Beverage Revenue', type: 'Revenue', category: 'Revenue', level: 2 },
  { code: '4300', name: 'Other Revenue', type: 'Revenue', category: 'Revenue', level: 2 },
  { code: '4400', name: 'Service Charges', type: 'Revenue', category: 'Revenue', level: 2 },

  // Expenses (5000-5999)
  { code: '5000', name: 'Operating Expenses', type: 'Expense', category: 'Expenses', level: 1 },
  { code: '5100', name: 'Cost of Goods Sold', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5110', name: 'Food and Beverage Cost', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5200', name: 'Payroll Expenses', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5210', name: 'Salaries and Wages', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5220', name: 'Employee Benefits', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5215', name: 'Directors Remuneration', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5221', name: 'Social Security Fund (13%)', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5300', name: 'Utilities', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5310', name: 'Electricity, Water and Gas', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5315', name: 'Generator Fuel and Repairs', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5400', name: 'Maintenance and Repairs', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5410', name: 'Repairs - Equipment', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5415', name: 'Repairs and Renovation - Building', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5420', name: 'Vehicle Running Expenses', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5500', name: 'Marketing and Advertising', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5510', name: 'Advertisement', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5600', name: 'Administrative Expenses', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5610', name: 'Security Expenses', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5615', name: 'Insurance', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5620', name: 'Travelling and Transport', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5625', name: 'Postage and Telephone', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5630', name: 'Subscriptions', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5635', name: 'Newspaper and Periodicals', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5640', name: 'Medical Expenses', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5645', name: 'Printing and Stationery', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5650', name: 'Staff Uniform', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5655', name: 'Accommodation Outsourcing', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5660', name: 'Donation', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5665', name: 'Hiring Charges', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5670', name: 'Cleaning and Sanitation', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5675', name: 'Audit Fees', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5700', name: 'Depreciation Expense', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5710', name: 'Depreciation - Property & Equipment', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5800', name: 'Tax Expenses', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5810', name: 'Property Rate', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5815', name: 'Registration and Council Levy', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5820', name: 'Assembly Rates & Levies', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5825', name: 'Ghana Tourist Authority Levy', type: 'Expense', category: 'Expenses', level: 3 }
];
