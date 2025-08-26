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
