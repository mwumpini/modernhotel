import { create } from 'zustand';
import { 
  ChartOfAccounts, 
  JournalEntry, 
  JournalEntryLine, 
  GLBalance, 
  TaxConfig, 
  FinancialPeriod,
  BankAccount,
  BankTransaction,
  BusinessPartner,
  Invoice,
  Payment,
  PaymentVoucher,
  PaymentVoucherLine,
  FixedAsset,
  DepreciationSchedule,
  CapitalAllowanceClaim,
  CostCenter,
  RevenueCenter,
  Project,
  FinancialReport,
  AuditTrail,
  WHTCertificate,
  GHANA_CHART_OF_ACCOUNTS
} from './models';
import { getTaxWrittenDownValue, resolveCapitalAllowancePool } from './capitalAllowance';
import type { Supplier } from '../inventory/models';
import type {
  PurchaseOrder,
  InventoryAccountingTransaction,
  PayrollLedgerEntry,
  SsnitRegisterEntry,
  PayeRegisterEntry,
  AccrualLedgerEntry,
  PrepaymentLedgerEntry,
  TaxProvisionEntry,
} from './accountingArchitectureModels';
import {
  computeTrialBalanceGLBalances,
  computeIncomeStatementFromJE,
  computeBalanceSheetFromJE,
  computeCashFlowForPeriod,
  defaultRollupCoa,
} from './jeDrivenReports';
import { taxConfigsFromGhanaTemplate } from './taxFromConfig';
import { persistJournalEntry, persistJournalEntryStatus, fetchJournalEntries, persistInvoice, persistInvoicePatch, persistInvoiceDelete, fetchInvoices, persistPayment, persistPaymentPatch, fetchPayments } from './helpers/api';
import { syncInvoiceToLedger, syncPaymentToLedger } from './invoicePostingBridge';

interface AccountingState {
  // Chart of Accounts
  chartOfAccounts: ChartOfAccounts[];
  selectedAccount: ChartOfAccounts | null;
  
  // Journal Entries
  journalEntries: JournalEntry[];
  currentJournalEntry: JournalEntry | null;
  
  // General Ledger
  glBalances: GLBalance[];
  currentPeriod: string;
  
  // Tax Configuration
  taxConfigs: TaxConfig[];
  
  // Financial Periods
  financialPeriods: FinancialPeriod[];
  currentFinancialPeriod: FinancialPeriod | null;
  
  // Bank Accounts
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  
  // Business Partners
  businessPartners: BusinessPartner[];
  _syncingToInventory: boolean; // Internal flag to prevent circular sync
  
  // Invoices
  invoices: Invoice[];
  
  // Payments
  payments: Payment[];
  paymentVouchers: PaymentVoucher[];
  
  // WHT Certificates
  whtCertificates: WHTCertificate[];
  
  // Fixed Assets
  fixedAssets: FixedAsset[];
  depreciationSchedules: DepreciationSchedule[];
  capitalAllowanceClaims: CapitalAllowanceClaim[];
  
  // Cost Centers & Projects
  costCenters: CostCenter[];
  revenueCenters: RevenueCenter[];
  projects: Project[];
  
  // Reports
  financialReports: FinancialReport[];
  
  // Audit Trail
  auditTrail: AuditTrail[];

  /** Menish / extended architecture registers (PO, inventory GL, payroll, adjustments, tax provisions) */
  purchaseOrders: PurchaseOrder[];
  inventoryAccountingTransactions: InventoryAccountingTransaction[];
  payrollLedgerEntries: PayrollLedgerEntry[];
  ssnitRegisterEntries: SsnitRegisterEntry[];
  payeRegisterEntries: PayeRegisterEntry[];
  accrualLedgerEntries: AccrualLedgerEntry[];
  prepaymentLedgerEntries: PrepaymentLedgerEntry[];
  taxRegisterEntries: TaxProvisionEntry[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions
  // Chart of Accounts
  setChartOfAccounts: (accounts: ChartOfAccounts[]) => void;
  addChartOfAccount: (account: ChartOfAccounts) => void;
  updateChartOfAccount: (id: string, updates: Partial<ChartOfAccounts>) => void;
  deleteChartOfAccount: (id: string) => void;
  setSelectedAccount: (account: ChartOfAccounts | null) => void;
  
  // Journal Entries
  setJournalEntries: (entries: JournalEntry[]) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;
  setCurrentJournalEntry: (entry: JournalEntry | null) => void;
  postJournalEntry: (id: string) => Promise<void>;
  voidJournalEntry: (id: string) => Promise<void>;
  
  // General Ledger
  setGLBalances: (balances: GLBalance[]) => void;
  updateGLBalance: (accountCode: string, period: string, updates: Partial<GLBalance>) => void;
  setCurrentPeriod: (period: string) => void;
  
  // Tax Configuration
  setTaxConfigs: (configs: TaxConfig[]) => void;
  addTaxConfig: (config: TaxConfig) => void;
  updateTaxConfig: (id: string, updates: Partial<TaxConfig>) => void;
  deleteTaxConfig: (id: string) => void;
  
  // Financial Periods
  setFinancialPeriods: (periods: FinancialPeriod[]) => void;
  setCurrentFinancialPeriod: (period: FinancialPeriod | null) => void;
  openFinancialPeriod: (id: string) => Promise<void>;
  closeFinancialPeriod: (id: string) => Promise<void>;
  
  // Bank Accounts
  setBankAccounts: (accounts: BankAccount[]) => void;
  addBankAccount: (account: BankAccount) => void;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  deleteBankAccount: (id: string) => void;
  
  // Bank Transactions
  setBankTransactions: (transactions: BankTransaction[]) => void;
  addBankTransaction: (transaction: BankTransaction) => void;
  updateBankTransaction: (id: string, updates: Partial<BankTransaction>) => void;
  deleteBankTransaction: (id: string) => void;
  reconcileBankTransaction: (id: string) => Promise<void>;
  
  // Business Partners
  setBusinessPartners: (partners: BusinessPartner[]) => void;
  addBusinessPartner: (partner: BusinessPartner) => void;
  updateBusinessPartner: (id: string, updates: Partial<BusinessPartner>) => void;
  deleteBusinessPartner: (id: string) => void;
  
  // Invoices
  setInvoices: (invoices: Invoice[]) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  postInvoice: (id: string) => Promise<void>;
  voidInvoice: (id: string) => Promise<void>;
  
  // Payments
  setPayments: (payments: Payment[]) => void;
  addPayment: (payment: Payment) => void;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  deletePayment: (id: string) => void;
  postPayment: (id: string) => Promise<void>;
  voidPayment: (id: string) => Promise<void>;
  setPaymentReceipt: (id: string, receipt: {
    receivedBy?: string;
    receiverContact?: string;
    receiverIdType?: string;
    receiverIdNumber?: string;
    receivedDate?: Date | string;
    receiverSignature?: string;
  }) => void;
  setPaymentPdf: (id: string, pdf: { url: string; fileName?: string; generatedBy?: string; generatedAt?: Date | string; }) => void;
  addPaymentAttachment: (id: string, fileName: string) => void;
  
  // WHT Certificates
  addWHTCertificate: (certificate: WHTCertificate) => void;
  updateWHTCertificate: (id: string, updates: Partial<WHTCertificate>) => void;
  deleteWHTCertificate: (id: string) => void;
  recordWHTPayment: (params: {
    invoiceId: string;
    cashAmount: number;
    whtAmount: number;
    whtVatAmount?: number;
    paymentMethod: 'Cash' | 'Bank' | 'Card' | 'Mobile Money';
    certificateNumber?: string;
    withholdingAgentTIN?: string;
    staffName?: string;
    staffId?: string;
  }) => { receiptId: string; whtCertificateId?: string } | null;
  getWHTCertificatesByInvoice: (invoiceId: string) => WHTCertificate[];
  getWHTCertificatesByStatus: (status: WHTCertificate['status']) => WHTCertificate[];
  getPendingWHTCertificates: () => WHTCertificate[];
  
  // Payment Vouchers
  generateNextVoucherNumber: () => string;
  createPaymentVoucher: (voucher: Omit<PaymentVoucher, 'id' | 'voucherNumber' | 'createdAt' | 'updatedAt' | 'totalDebit' | 'totalCredit'>) => PaymentVoucher;
  updatePaymentVoucher: (id: string, updates: Partial<PaymentVoucher>) => void;
  deletePaymentVoucher: (id: string) => void;
  getPaymentVoucher: (id: string) => PaymentVoucher | undefined;
  getPaymentVouchersByStatus: (status: PaymentVoucher['status']) => PaymentVoucher[];
  preparePaymentVoucher: (id: string, preparedBy: string) => void;
  approvePaymentVoucher: (id: string, approvedBy: string) => void;
  recordPaymentVoucher: (id: string, recordedBy: string) => void;
  postPaymentVoucher: (id: string) => Promise<void>;
  setPaymentVoucherReceipt: (id: string, receipt: {
    receivedBy?: string;
    receiverContact?: string;
    receiverIdType?: string;
    receiverIdNumber?: string;
    receivedDate?: Date | string;
    receiverSignature?: string;
  }) => void;
  setPaymentVoucherPdf: (id: string, pdf: { url: string; fileName?: string; generatedBy?: string; generatedAt?: Date | string; }) => void;
  addPaymentVoucherAttachment: (id: string, fileName: string) => void;
  
  // Fixed Assets
  setFixedAssets: (assets: FixedAsset[]) => void;
  addFixedAsset: (asset: FixedAsset) => void;
  updateFixedAsset: (id: string, updates: Partial<FixedAsset>) => void;
  deleteFixedAsset: (id: string) => void;
  
  // Depreciation
  setDepreciationSchedules: (schedules: DepreciationSchedule[]) => void;
  calculateDepreciation: (assetId: string, period: string) => Promise<void>;
  postDepreciation: (scheduleId: string) => Promise<void>;
  recordCapitalAllowanceClaim: (assetId: string, period: string, amount: number) => CapitalAllowanceClaim | null;
  
  // Cost Centers & Projects
  setCostCenters: (centers: CostCenter[]) => void;
  addCostCenter: (center: CostCenter) => void;
  updateCostCenter: (id: string, updates: Partial<CostCenter>) => void;
  deleteCostCenter: (id: string) => void;
  
  setRevenueCenters: (centers: RevenueCenter[]) => void;
  addRevenueCenter: (center: RevenueCenter) => void;
  updateRevenueCenter: (id: string, updates: Partial<RevenueCenter>) => void;
  deleteRevenueCenter: (id: string) => void;
  
  // Helper functions to track costs and revenue by center
  recordExpense: (costCenterCode: string, amount: number) => void;
  recordRevenue: (revenueCenterCode: string, amount: number) => void;
  
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  
  // Reports
  setFinancialReports: (reports: FinancialReport[]) => void;
  generateFinancialReport: (type: string, period: string) => Promise<FinancialReport>;
  
  // Audit Trail
  addAuditTrail: (trail: AuditTrail) => void;

  addPurchaseOrder: (po: PurchaseOrder) => void;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void;
  addInventoryAccountingTransaction: (t: InventoryAccountingTransaction) => void;
  addPayrollLedgerEntry: (p: PayrollLedgerEntry) => void;
  addSsnitRegisterEntry: (e: SsnitRegisterEntry) => void;
  addPayeRegisterEntry: (e: PayeRegisterEntry) => void;
  addAccrualLedgerEntry: (e: AccrualLedgerEntry) => void;
  addPrepaymentLedgerEntry: (e: PrepaymentLedgerEntry) => void;
  addTaxRegisterEntry: (e: TaxProvisionEntry) => void;
  
  // Utility Functions
  getAccountBalance: (accountCode: string, period?: string) => number;
  getAccountBalances: (period?: string) => GLBalance[];
  getTrialBalance: (period?: string) => GLBalance[];
  getIncomeStatement: (period: string) => any;
  getBalanceSheet: (period: string) => any;
  getCashFlow: (period: string) => any;
  
  // Tax Calculations
  calculateTax: (amount: number, taxCode: string) => number;
  getTaxConfig: (taxCode: string) => TaxConfig | undefined;
  
  // Loading States
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Initialize
  initializeAccounting: () => Promise<void>;
}

export const useAccountingStore = create<AccountingState>((set, get) => ({
  // Initial State
  chartOfAccounts: [],
  _syncingToInventory: false,
  selectedAccount: null,
  journalEntries: [],
  currentJournalEntry: null,
  glBalances: [],
  currentPeriod: new Date().toISOString().slice(0, 7), // YYYY-MM
  taxConfigs: [],
  financialPeriods: [],
  currentFinancialPeriod: null,
  bankAccounts: [],
  bankTransactions: [],
  businessPartners: (() => {
    try {
      const { useSupplierStore } = require('../inventory/supplierStore');
      const supplierStore = useSupplierStore.getState();
      const mapped = (supplierStore.suppliers || []).map((s: any) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        type: 'Supplier' as const,
        taxNumber: s.taxId,
        address: s.address,
        phone: s.phone,
        email: s.email,
        contactPerson: s.contactPerson,
        creditLimit: s.creditLimit ?? 0,
        paymentTerms: s.paymentTerms === 'immediate' ? 0 : s.paymentTerms === 'net30' ? 30 : s.paymentTerms === 'net60' ? 60 : s.paymentTerms === 'net90' ? 90 : 30,
        glAccountCode: '2200',
        currency: 'GHS',
        balance: s.currentBalance ?? 0,
        isActive: s.isActive ?? true,
        countryCode: (s.country?.toUpperCase()?.slice(0,2)) || 'GH',
        createdAt: (s.createdAt instanceof Date ? s.createdAt.toISOString() : (s.createdAt || new Date().toISOString())),
        updatedAt: (s.updatedAt instanceof Date ? s.updatedAt.toISOString() : (s.updatedAt || new Date().toISOString()))
      }));
      return mapped;
    } catch {
      return [] as any[];
    }
  })(),
  invoices: [],
  payments: [],
  paymentVouchers: [],
  whtCertificates: [],
  fixedAssets: [],
  depreciationSchedules: [],
  capitalAllowanceClaims: [],
  costCenters: [],
  revenueCenters: [],
  projects: [],
  financialReports: [],
  auditTrail: [],
  purchaseOrders: [],
  inventoryAccountingTransactions: [],
  payrollLedgerEntries: [],
  ssnitRegisterEntries: [],
  payeRegisterEntries: [],
  accrualLedgerEntries: [],
  prepaymentLedgerEntries: [],
  taxRegisterEntries: [],
  isLoading: false,
  error: null,

  // Chart of Accounts Actions
  setChartOfAccounts: (accounts) => set({ chartOfAccounts: accounts }),
  
  addChartOfAccount: (account) => set((state) => ({
    chartOfAccounts: [...state.chartOfAccounts, account]
  })),
  
  updateChartOfAccount: (id, updates) => set((state) => ({
    chartOfAccounts: state.chartOfAccounts.map(account =>
      account.id === id ? { ...account, ...updates } : account
    )
  })),
  
  deleteChartOfAccount: (id) => set((state) => ({
    chartOfAccounts: state.chartOfAccounts.filter(account => account.id !== id)
  })),
  
  setSelectedAccount: (account) => set({ selectedAccount: account }),

  // Journal Entries Actions
  setJournalEntries: (entries) => set({ journalEntries: entries }),
  
  addJournalEntry: (entry) => set((state) => {
    // Detailed logging for journal entry creation
    const lines = (entry.lines || []) as any[];
    const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    
    console.log(`[Accounting] 📒 Journal Entry Created:`, {
      entryNumber: entry.entryNumber || entry.id,
      description: entry.description,
      date: entry.date,
      status: entry.status,
      totalDebit: `GHS ${totalDebit.toLocaleString()}`,
      totalCredit: `GHS ${totalCredit.toLocaleString()}`,
      balanced: totalDebit === totalCredit ? '✓ Balanced' : '⚠️ UNBALANCED',
      lineCount: lines.length,
      source: (entry as any).sourceModule || 'manual',
      accounts: lines.map(l => `${l.accountCode}: Dr ${l.debit || 0} / Cr ${l.credit || 0}`).join(', '),
      timestamp: new Date().toISOString()
    });
    
    persistJournalEntry(entry);
    return {
    journalEntries: [...state.journalEntries, entry]
    };
  }),
  
  updateJournalEntry: (id, updates) => set((state) => {
    if (updates.status) {
      persistJournalEntryStatus(id, {
        status: updates.status,
        postedBy: updates.postedBy,
        postedAt: updates.postedAt,
      });
    }
    return {
    journalEntries: state.journalEntries.map(entry =>
      entry.id === id ? { ...entry, ...updates } : entry
    )
    };
  }),
  
  deleteJournalEntry: (id) => set((state) => ({
    journalEntries: state.journalEntries.filter(entry => entry.id !== id)
  })),
  
  setCurrentJournalEntry: (entry) => set({ currentJournalEntry: entry }),
  
  postJournalEntry: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const postedAt = new Date().toISOString();
      set((state) => ({
        journalEntries: state.journalEntries.map(entry =>
          entry.id === id 
            ? { 
                ...entry, 
                status: 'Posted',
                postedAt,
                postedBy: 'current-user'
              }
            : entry
        )
      }));
      persistJournalEntryStatus(id, { status: 'Posted', postedAt, postedBy: 'current-user' });
      
      // Update GL balances
      const entry = get().journalEntries.find(e => e.id === id);
      if (entry) {
        entry.lines.forEach(line => {
          get().updateGLBalance(line.accountCode, get().currentPeriod, {
            currentDebit: line.debit,
            currentCredit: line.credit
          });
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to post journal entry' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  voidJournalEntry: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      set((state) => ({
        journalEntries: state.journalEntries.map(entry =>
          entry.id === id ? { ...entry, status: 'Void' } : entry
        )
      }));
      persistJournalEntryStatus(id, { status: 'Void' });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to void journal entry' });
    } finally {
      set({ isLoading: false });
    }
  },

  // General Ledger Actions
  setGLBalances: (balances) => set({ glBalances: balances }),
  
  updateGLBalance: (accountCode, period, updates) => set((state) => ({
    glBalances: state.glBalances.map(balance =>
      balance.accountCode === accountCode && balance.period === period
        ? { ...balance, ...updates }
        : balance
    )
  })),
  
  setCurrentPeriod: (period) => set({ currentPeriod: period }),

  // Tax Configuration Actions
  setTaxConfigs: (configs) => set({ taxConfigs: configs }),
  
  addTaxConfig: (config) => set((state) => ({
    taxConfigs: [...state.taxConfigs, config]
  })),
  
  updateTaxConfig: (id, updates) => set((state) => ({
    taxConfigs: state.taxConfigs.map(config =>
      config.id === id ? { ...config, ...updates } : config
    )
  })),
  
  deleteTaxConfig: (id) => set((state) => ({
    taxConfigs: state.taxConfigs.filter(config => config.id !== id)
  })),

  // Financial Periods Actions
  setFinancialPeriods: (periods) => set({ financialPeriods: periods }),
  
  setCurrentFinancialPeriod: (period) => set({ currentFinancialPeriod: period }),
  
  openFinancialPeriod: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      set((state) => ({
        financialPeriods: state.financialPeriods.map(period =>
          period.id === id ? { ...period, isOpen: true } : period
        )
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open period' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  closeFinancialPeriod: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      set((state) => ({
        financialPeriods: state.financialPeriods.map(period =>
          period.id === id 
            ? { 
                ...period, 
                isOpen: false,
                closedAt: new Date().toISOString(),
                closedBy: 'current-user'
              }
            : period
        )
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to close period' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Bank Accounts Actions
  setBankAccounts: (accounts) => set({ bankAccounts: accounts }),
  
  addBankAccount: (account) => set((state) => ({
    bankAccounts: [...state.bankAccounts, account]
  })),
  
  updateBankAccount: (id, updates) => set((state) => ({
    bankAccounts: state.bankAccounts.map(account =>
      account.id === id ? { ...account, ...updates } : account
    )
  })),
  
  deleteBankAccount: (id) => set((state) => ({
    bankAccounts: state.bankAccounts.filter(account => account.id !== id)
  })),

  // Bank Transactions Actions
  setBankTransactions: (transactions) => set({ bankTransactions: transactions }),
  
  addBankTransaction: (transaction) => set((state) => ({
    bankTransactions: [...state.bankTransactions, transaction]
  })),
  
  updateBankTransaction: (id, updates) => set((state) => ({
    bankTransactions: state.bankTransactions.map(transaction =>
      transaction.id === id ? { ...transaction, ...updates } : transaction
    )
  })),
  
  deleteBankTransaction: (id) => set((state) => ({
    bankTransactions: state.bankTransactions.filter(transaction => transaction.id !== id)
  })),
  
  reconcileBankTransaction: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      set((state) => ({
        bankTransactions: state.bankTransactions.map(transaction =>
          transaction.id === id 
            ? { 
                ...transaction, 
                status: 'Reconciled',
                reconciledAt: new Date().toISOString(),
                reconciledBy: 'current-user'
              }
            : transaction
        )
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to reconcile transaction' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Business Partners Actions
  setBusinessPartners: (partners) => set({ businessPartners: partners }),
  
  addBusinessPartner: (partner) => {
    set((state) => ({
    businessPartners: [...state.businessPartners, partner]
    }));
    
    // Sync to inventory store if type is Supplier or Both (unless we're syncing from inventory)
    if ((partner.type === 'Supplier' || partner.type === 'Both') && !get()._syncingToInventory) {
      try {
        set({ _syncingToInventory: true });
        const { useSupplierStore } = require('../inventory/supplierStore');
        const supplierStore = useSupplierStore.getState();
        const existingSupplier = supplierStore.suppliers.find(
          (s: Supplier) => s.id === partner.id || s.code === partner.code
        );
        
        if (!existingSupplier) {
          // Convert BusinessPartner to Supplier
          const supplier = {
            id: partner.id,
            code: partner.code,
            name: partner.name,
            contactPerson: partner.contactPerson || '',
            email: partner.email || '',
            phone: partner.phone || '',
            address: partner.address || '',
            city: '', // Accounting doesn't track city separately
            country: partner.countryCode === 'GH' ? 'Ghana' : 
                    partner.countryCode === 'NG' ? 'Nigeria' :
                    partner.countryCode === 'ZA' ? 'South Africa' :
                    partner.countryCode === 'KE' ? 'Kenya' : partner.countryCode,
            postalCode: '', // Accounting doesn't track postal code
            taxId: partner.taxNumber || '',
            paymentTerms: partner.paymentTerms === 0 ? 'immediate' as const :
                          partner.paymentTerms === 30 ? 'net30' as const :
                          partner.paymentTerms === 60 ? 'net60' as const :
                          partner.paymentTerms === 90 ? 'net90' as const : 'net30' as const,
            creditLimit: partner.creditLimit || 0,
            currentBalance: partner.balance || 0,
            rating: 0, // Accounting doesn't track rating
            categories: [], // Accounting doesn't track categories
            isActive: partner.isActive,
            contractStartDate: new Date(partner.createdAt),
            createdAt: new Date(partner.createdAt),
            updatedAt: new Date(partner.updatedAt),
            performance: {
              onTimeDelivery: 0,
              qualityRating: 0,
              responseTime: 0,
              totalOrders: 0
            }
          };
          supplierStore.addSupplier(supplier, true); // Skip sync back to accounting
        }
      } catch (error) {
        console.error('Failed to sync business partner to inventory:', error);
      } finally {
        set({ _syncingToInventory: false });
      }
    }
  },
  
  updateBusinessPartner: (id, updates) => {
    set((state) => {
      const updatedPartners = state.businessPartners.map(partner =>
      partner.id === id ? { ...partner, ...updates } : partner
      );
      const updatedPartner = updatedPartners.find(p => p.id === id);
      
      // Sync to inventory store if type is Supplier or Both (unless we're syncing from inventory)
      if (updatedPartner && (updatedPartner.type === 'Supplier' || updatedPartner.type === 'Both') && !state._syncingToInventory) {
        try {
          set({ _syncingToInventory: true });
          const { useSupplierStore } = require('../inventory/supplierStore');
          const supplierStore = useSupplierStore.getState();
          const existingSupplier = supplierStore.suppliers.find(
            (s: Supplier) => s.id === id || s.code === updatedPartner.code
          );
          
          if (existingSupplier) {
            // Update existing supplier
            const supplierUpdates = {
              code: updatedPartner.code,
              name: updatedPartner.name,
              contactPerson: updatedPartner.contactPerson || existingSupplier.contactPerson,
              email: updatedPartner.email || existingSupplier.email,
              phone: updatedPartner.phone || existingSupplier.phone,
              address: updatedPartner.address || existingSupplier.address,
              taxId: updatedPartner.taxNumber || existingSupplier.taxId,
              paymentTerms: (updatedPartner.paymentTerms === 0 ? 'immediate' :
                            updatedPartner.paymentTerms === 30 ? 'net30' :
                            updatedPartner.paymentTerms === 60 ? 'net60' :
                            updatedPartner.paymentTerms === 90 ? 'net90' : 'net30') as 'immediate' | 'net30' | 'net60' | 'net90',
              creditLimit: updatedPartner.creditLimit ?? existingSupplier.creditLimit,
              currentBalance: updatedPartner.balance ?? existingSupplier.currentBalance,
              isActive: updatedPartner.isActive !== undefined ? updatedPartner.isActive : existingSupplier.isActive,
              updatedAt: new Date()
            };
            supplierStore.updateSupplier(existingSupplier.id, supplierUpdates, true); // Skip sync back to accounting
          } else {
            // Create new supplier if doesn't exist
            const supplier = {
              id: updatedPartner.id,
              code: updatedPartner.code,
              name: updatedPartner.name,
              contactPerson: updatedPartner.contactPerson || '',
              email: updatedPartner.email || '',
              phone: updatedPartner.phone || '',
              address: updatedPartner.address || '',
              city: '',
              country: updatedPartner.countryCode === 'GH' ? 'Ghana' : 
                      updatedPartner.countryCode === 'NG' ? 'Nigeria' :
                      updatedPartner.countryCode === 'ZA' ? 'South Africa' :
                      updatedPartner.countryCode === 'KE' ? 'Kenya' : updatedPartner.countryCode,
              postalCode: '',
              taxId: updatedPartner.taxNumber || '',
              paymentTerms: (updatedPartner.paymentTerms === 0 ? 'immediate' :
                            updatedPartner.paymentTerms === 30 ? 'net30' :
                            updatedPartner.paymentTerms === 60 ? 'net60' :
                            updatedPartner.paymentTerms === 90 ? 'net90' : 'net30') as 'immediate' | 'net30' | 'net60' | 'net90',
              creditLimit: updatedPartner.creditLimit || 0,
              currentBalance: updatedPartner.balance || 0,
              rating: 0,
              categories: [],
              isActive: updatedPartner.isActive,
              contractStartDate: new Date(updatedPartner.createdAt),
              createdAt: new Date(updatedPartner.createdAt),
              updatedAt: new Date(updatedPartner.updatedAt),
              performance: {
                onTimeDelivery: 0,
                qualityRating: 0,
                responseTime: 0,
                totalOrders: 0
              }
            };
            supplierStore.addSupplier(supplier, true); // Skip sync back to accounting
          }
        } catch (error) {
          console.error('Failed to sync business partner update to inventory:', error);
        } finally {
          set({ _syncingToInventory: false });
        }
      }
      
      return { businessPartners: updatedPartners };
    });
  },
  
  deleteBusinessPartner: (id) => {
    set((state) => {
      const partner = state.businessPartners.find(p => p.id === id);
      
      // Sync to inventory store - mark as inactive instead of deleting
      if (partner && (partner.type === 'Supplier' || partner.type === 'Both')) {
        try {
          const { useSupplierStore } = require('../inventory/supplierStore');
          const supplierStore = useSupplierStore.getState();
          const existingSupplier = supplierStore.suppliers.find(
            (s: Supplier) => s.id === id || s.code === partner.code
          );
          
          if (existingSupplier) {
            supplierStore.updateSupplier(existingSupplier.id, { 
              isActive: false,
              updatedAt: new Date()
            });
          }
        } catch (error) {
          console.error('Failed to sync business partner deletion to inventory:', error);
        }
      }
      
      return {
    businessPartners: state.businessPartners.filter(partner => partner.id !== id)
      };
    });
  },

  // Invoices Actions
  setInvoices: (invoices) => set({ invoices: invoices }),
  
  addInvoice: (invoice) => {
    set((state) => {
      console.log(`[Accounting] 📄 Invoice Created:`, {
        invoiceNumber: invoice.invoiceNumber || invoice.id,
        type: invoice.type,
        customer: invoice.businessPartnerId,
        subtotal: `GHS ${(invoice.subtotal || 0).toLocaleString()}`,
        tax: `GHS ${(invoice.taxAmount || 0).toLocaleString()}`,
        total: `GHS ${(invoice.total || 0).toLocaleString()}`,
        status: invoice.status,
        dueDate: invoice.dueDate,
        source: (invoice as any).sourceModule || 'manual',
        timestamp: new Date().toISOString()
      });

      const updatedPartners = state.businessPartners.map(p => {
        if (p.id !== invoice.businessPartnerId) return p;
        if (invoice.type === 'Purchase' && (p.type === 'Supplier' || p.type === 'Both')) {
          return { ...p, balance: +(p.balance + invoice.total).toFixed(2) };
        }
        if (invoice.type === 'Sales' && (p.type === 'Customer' || p.type === 'Both')) {
          return { ...p, balance: +(p.balance + invoice.total).toFixed(2) };
        }
        return p;
      });
      persistInvoice(invoice);
      return {
        businessPartners: updatedPartners,
        invoices: [...state.invoices, invoice]
      };
    });

    const state = get();
    const added = state.invoices.find(i => i.id === invoice.id);
    if (added) {
      const src = added.sourceModule;
      if (!src || src === 'manual' || src === 'manual_ar_ap') {
        const partner = state.businessPartners.find(p => p.id === added.businessPartnerId);
        syncInvoiceToLedger(added, partner, get());
      }
    }
  },
  
  updateInvoice: (id, updates) => set((state) => {
    const prev = state.invoices.find(i => i.id === id);
    let partners = state.businessPartners;
    if (prev) {
      const next = { ...prev, ...updates } as any;
      const delta = +(next.total - prev.total).toFixed(2);
      partners = partners.map(p => {
        if (p.id !== prev.businessPartnerId) return p;
        if (prev.type === 'Purchase' && (p.type === 'Supplier' || p.type === 'Both')) {
          return { ...p, balance: +(p.balance + delta).toFixed(2) };
        }
        if (prev.type === 'Sales' && (p.type === 'Customer' || p.type === 'Both')) {
          return { ...p, balance: +(p.balance + delta).toFixed(2) };
        }
        return p;
      });
    }
    persistInvoicePatch(id, updates);
    return {
      businessPartners: partners,
      invoices: state.invoices.map(invoice => invoice.id === id ? { ...invoice, ...updates } : invoice)
    };
  }),
  
  deleteInvoice: (id) => set((state) => {
    const inv = state.invoices.find(i => i.id === id);
    let partners = state.businessPartners;
    if (inv) {
      partners = partners.map(p => {
        if (p.id !== inv.businessPartnerId) return p;
        if (inv.type === 'Purchase' && (p.type === 'Supplier' || p.type === 'Both')) return { ...p, balance: +(p.balance - inv.total).toFixed(2) };
        if (inv.type === 'Sales' && (p.type === 'Customer' || p.type === 'Both')) return { ...p, balance: +(p.balance - inv.total).toFixed(2) };
        return p;
      });
    }
    persistInvoiceDelete(id);
    return {
      businessPartners: partners,
    invoices: state.invoices.filter(invoice => invoice.id !== id)
    };
  }),
  
  postInvoice: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const state = get();
      const invoice = state.invoices.find(i => i.id === id);
      if (!invoice) throw new Error('Invoice not found');

      if (invoice.status === 'Draft') {
        set((s) => ({
          invoices: s.invoices.map(inv =>
            inv.id === id ? { ...inv, status: 'Posted' as const, updatedAt: new Date().toISOString() } : inv
          )
        }));
        persistInvoicePatch(id, { status: 'Posted' });
      }

      const refreshed = get().invoices.find(i => i.id === id)!;
      const partner = get().businessPartners.find(p => p.id === refreshed.businessPartnerId);
      const result = syncInvoiceToLedger(refreshed, partner, get());
      if (!result.ok && !('skipped' in result)) {
        throw new Error(result.error);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to post invoice' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  voidInvoice: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      set((state) => ({
        invoices: state.invoices.map(invoice =>
          invoice.id === id ? { ...invoice, status: 'Void' } : invoice
        )
      }));
      persistInvoicePatch(id, { status: 'Void' });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to void invoice' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Payments Actions
  setPayments: (payments) => set({ payments: payments }),
  
  addPayment: (payment) => {
    set((state) => {
      const isReceipt = payment.type === 'Receipt';
      console.log(`[Accounting] ${isReceipt ? '🧾 Receipt' : '💳 Payment'} Created:`, {
        paymentNumber: payment.paymentNumber || payment.id,
        type: payment.type,
        party: payment.businessPartnerId,
        amount: `GHS ${(payment.amount || 0).toLocaleString()}`,
        method: payment.paymentMethod,
        invoiceId: payment.invoiceId || 'N/A',
        status: payment.status,
        source: (payment as any).sourceModule || 'manual',
        timestamp: new Date().toISOString()
      });

      const updatedPartners = state.businessPartners.map(p => {
        if (p.id !== payment.businessPartnerId) return p;
        if (payment.type === 'Payment' && (p.type === 'Supplier' || p.type === 'Both')) {
          return { ...p, balance: +(p.balance - payment.amount).toFixed(2) };
        }
        if (payment.type === 'Receipt' && (p.type === 'Customer' || p.type === 'Both')) {
          return { ...p, balance: +(p.balance - payment.amount).toFixed(2) };
        }
        return p;
      });
      persistPayment(payment);
      return {
        businessPartners: updatedPartners,
        payments: [...state.payments, payment]
      };
    });

    const state = get();
    const added = state.payments.find(p => p.id === payment.id);
    if (added && added.status === 'Posted') {
      const src = added.sourceModule;
      if (!src || src === 'manual' || src === 'manual_ar_ap') {
        const partner = state.businessPartners.find(p => p.id === added.businessPartnerId);
        syncPaymentToLedger(added, partner, get());
      }
    }
  },
  
  updatePayment: (id, updates) => set((state) => {
    const prev = state.payments.find(p => p.id === id);
    let partners = state.businessPartners;
    if (prev) {
      const next = { ...prev, ...updates } as any;
      partners = partners.map(bp => {
        if (bp.id !== prev.businessPartnerId) return bp;
        const delta = +(next.amount - prev.amount).toFixed(2);
        if (prev.type === 'Payment' && (bp.type === 'Supplier' || bp.type === 'Both')) {
          return { ...bp, balance: +(bp.balance - delta).toFixed(2) };
        }
        if (prev.type === 'Receipt' && (bp.type === 'Customer' || bp.type === 'Both')) {
          return { ...bp, balance: +(bp.balance - delta).toFixed(2) };
        }
        return bp;
      });
    }
    persistPaymentPatch(id, updates);
    return {
      businessPartners: partners,
      payments: state.payments.map(payment => payment.id === id ? { ...payment, ...updates } : payment)
    };
  }),
  
  deletePayment: (id) => set((state) => {
    const pay = state.payments.find(p => p.id === id);
    let partners = state.businessPartners;
    if (pay) {
      partners = partners.map(bp => {
        if (bp.id !== pay.businessPartnerId) return bp;
        if (pay.type === 'Payment' && (bp.type === 'Supplier' || bp.type === 'Both')) {
          return { ...bp, balance: +(bp.balance + pay.amount).toFixed(2) };
        }
        if (pay.type === 'Receipt' && (bp.type === 'Customer' || bp.type === 'Both')) {
          return { ...bp, balance: +(bp.balance + pay.amount).toFixed(2) };
        }
        return bp;
      });
    }
    return {
      businessPartners: partners,
    payments: state.payments.filter(payment => payment.id !== id)
    };
  }),
  
  postPayment: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const state = get();
      const payment = state.payments.find(p => p.id === id);
      if (!payment) throw new Error('Payment not found');

      const partner = state.businessPartners.find(bp => bp.id === payment.businessPartnerId);
      if (!partner) throw new Error('Business partner not found');

      if (payment.status === 'Draft') {
        set((s) => ({
          payments: s.payments.map(pm =>
            pm.id === id ? { ...pm, status: 'Posted' as const, updatedAt: new Date().toISOString() } : pm
          )
        }));
        persistPaymentPatch(id, { status: 'Posted' });
      }

      const refreshed = get().payments.find(p => p.id === id)!;
      const result = syncPaymentToLedger(refreshed, partner, get());
      if (!result.ok && !('skipped' in result)) {
        throw new Error(result.error);
      }

      if (result.ok && !('skipped' in result) && payment.type === 'Payment' && payment.bankAccountId) {
        const bank = get().bankAccounts.find(b => b.id === payment.bankAccountId);
        if (bank) {
          const newBalance = +(bank.currentBalance - payment.amount).toFixed(2);
          get().updateBankAccount(bank.id, { currentBalance: newBalance, updatedAt: new Date().toISOString() });
          get().addBankTransaction({
            id: Date.now().toString(),
            bankAccountId: bank.id,
            transactionDate: payment.date,
            reference: payment.reference || payment.paymentNumber,
            description: payment.description || `Supplier Payment ${payment.paymentNumber}`,
            amount: payment.amount,
            type: 'Withdrawal',
            currency: bank.currency,
            balance: newBalance,
            status: 'Cleared',
            journalEntryId: result.entry.id,
            createdAt: new Date().toISOString()
          });
        }
      }

      get().addAuditTrail({
        id: Date.now().toString(),
        tableName: 'Payment',
        recordId: id,
        action: 'Post',
        newValues: {
          status: 'Posted',
          journalEntryId: result.ok && !('skipped' in result) ? result.entry.id : payment.journalEntryId,
        },
        userId: 'current-user',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to post payment' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  voidPayment: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      set((state) => ({
        payments: state.payments.map(payment =>
          payment.id === id ? { ...payment, status: 'Void' } : payment
        )
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to void payment' });
    } finally {
      set({ isLoading: false });
    }
  },

  setPaymentReceipt: (id, receipt) => {
    const existing = get().payments.find(p => p.id === id);
    if (!existing) { set({ error: 'Payment not found' }); return; }
    set((state) => ({
      payments: state.payments.map(pm => pm.id === id ? {
        ...pm,
        receivedBy: receipt.receivedBy ?? pm.receivedBy,
        receiverContact: receipt.receiverContact ?? pm.receiverContact,
        receiverIdType: receipt.receiverIdType ?? pm.receiverIdType,
        receiverIdNumber: receipt.receiverIdNumber ?? pm.receiverIdNumber,
        receivedDate: receipt.receivedDate ? (receipt.receivedDate instanceof Date ? receipt.receivedDate.toISOString() : receipt.receivedDate) : pm.receivedDate,
        receiverSignature: receipt.receiverSignature ?? pm.receiverSignature,
        updatedAt: new Date().toISOString()
      } : pm)
    }));
  },

  setPaymentPdf: (id, pdf) => {
    const existing = get().payments.find(p => p.id === id);
    if (!existing) { set({ error: 'Payment not found' }); return; }
    set((state) => ({
      payments: state.payments.map(pm => pm.id === id ? {
        ...pm,
        pdfUrl: pdf.url,
        pdfFileName: pdf.fileName ?? pm.pdfFileName,
        pdfGeneratedBy: pdf.generatedBy ?? 'current-user',
        pdfGeneratedAt: pdf.generatedAt ? (pdf.generatedAt instanceof Date ? pdf.generatedAt.toISOString() : pdf.generatedAt) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } : pm)
    }));
  },

  addPaymentAttachment: (id, fileName) => {
    const existing = get().payments.find(p => p.id === id);
    if (!existing) { set({ error: 'Payment not found' }); return; }
    set((state) => ({
      payments: state.payments.map(pm => pm.id === id ? {
        ...pm,
        attachments: [...(pm.attachments || []), fileName],
        updatedAt: new Date().toISOString()
      } : pm)
    }));
  },

  // WHT Certificate Actions
  addWHTCertificate: (certificate) => set((state) => {
    console.log(`[Accounting] 📜 WHT Certificate Added:`, {
      certificateNumber: certificate.certificateNumber,
      withholdingAgent: certificate.withholdingAgentName,
      whtAmount: `GHS ${certificate.whtAmount.toLocaleString()}`,
      whtVatAmount: certificate.whtVatAmount ? `GHS ${certificate.whtVatAmount.toLocaleString()}` : 'N/A',
      totalWithheld: `GHS ${certificate.totalWithheld.toLocaleString()}`,
      status: certificate.status,
      timestamp: new Date().toISOString()
    });
    return { whtCertificates: [...state.whtCertificates, certificate] };
  }),

  updateWHTCertificate: (id, updates) => set((state) => ({
    whtCertificates: state.whtCertificates.map(cert => 
      cert.id === id ? { ...cert, ...updates, updatedAt: new Date().toISOString() } : cert
    )
  })),

  deleteWHTCertificate: (id) => set((state) => ({
    whtCertificates: state.whtCertificates.filter(cert => cert.id !== id)
  })),

  recordWHTPayment: (params) => {
    const { invoiceId, cashAmount, whtAmount, whtVatAmount = 0, paymentMethod, certificateNumber, withholdingAgentTIN, staffName, staffId } = params;
    const state = get();
    const invoice = state.invoices.find(i => i.id === invoiceId);
    
    if (!invoice) {
      console.error(`[WHT Payment] Invoice ${invoiceId} not found`);
      return null;
    }

    const now = new Date().toISOString();
    const totalWithheld = whtAmount + whtVatAmount;
    const totalPayment = cashAmount + totalWithheld;
    
    console.log(`[Accounting] 💰 WHT Payment Recording:`, {
      invoiceNumber: invoice.invoiceNumber,
      cashReceived: `GHS ${cashAmount.toLocaleString()}`,
      whtWithheld: `GHS ${whtAmount.toLocaleString()}`,
      whtVatWithheld: `GHS ${whtVatAmount.toLocaleString()}`,
      totalCleared: `GHS ${totalPayment.toLocaleString()}`
    });

    // 1. Create cash receipt for actual cash received
    const receiptNumber = `REC-${Date.now().toString().slice(-8)}`;
    const cashReceipt: Payment = {
      id: `PAY-${Date.now()}`,
      paymentNumber: receiptNumber,
      date: now,
      type: 'Receipt',
      businessPartnerId: invoice.businessPartnerId,
      invoiceId: invoice.id,
      reference: invoice.invoiceNumber,
      description: `Payment received (net of WHT) for ${invoice.invoiceNumber}`,
      amount: cashAmount,
      currency: invoice.currency || 'GHS',
      paymentMethod: paymentMethod,
      status: 'Posted',
      createdAt: now,
      updatedAt: now,
    };

    // 2. Create WHT certificate entry if certificate details provided
    let whtCertificateId: string | undefined;
    if (certificateNumber || totalWithheld > 0) {
      whtCertificateId = `WHT-${Date.now()}`;
      const whtCert: WHTCertificate = {
        id: whtCertificateId,
        certificateNumber: certificateNumber || `PENDING-${Date.now()}`,
        date: now,
        receivedDate: certificateNumber ? now : '', // Empty if pending
        withholdingAgentName: state.businessPartners.find(p => p.id === invoice.businessPartnerId)?.name || 'Unknown',
        withholdingAgentTIN: withholdingAgentTIN || '',
        taxPeriod: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        grossAmount: invoice.total,
        whtRate: 5,
        whtAmount: whtAmount,
        whtVatRate: whtVatAmount > 0 ? 7 : 0,
        whtVatAmount: whtVatAmount,
        totalWithheld: totalWithheld,
        status: certificateNumber ? 'Received' : 'Pending',
        taxCreditAccountCode: '1230', // WHT Receivable account
        taxCreditUsedAmount: 0,
        taxCreditBalance: totalWithheld,
        createdAt: now,
        updatedAt: now,
      };

      // Add WHT certificate
      set((st) => ({ whtCertificates: [...st.whtCertificates, whtCert] }));
    }

    // 3. Create WHT credit entry as a special payment (clears AR, creates asset)
    if (totalWithheld > 0) {
      const whtPayment: Payment = {
        id: `PAYWHT-${Date.now()}`,
        paymentNumber: `WHT-${receiptNumber}`,
        date: now,
        type: 'Receipt',
        businessPartnerId: invoice.businessPartnerId,
        invoiceId: invoice.id,
        reference: certificateNumber || `WHT-${invoice.invoiceNumber}`,
        description: `WHT/VAT withheld on ${invoice.invoiceNumber}${certificateNumber ? ` - Cert: ${certificateNumber}` : ' (pending certificate)'}`,
        amount: totalWithheld,
        currency: invoice.currency || 'GHS',
        paymentMethod: 'WHT Certificate',
        isWHTCertificate: true,
        whtCertificateId,
        whtAmount,
        whtVatAmount,
        status: 'Posted',
        createdAt: now,
        updatedAt: now,
      };

      // Add WHT payment
      set((st) => ({ payments: [...st.payments, whtPayment] }));

      // Create GL entry for WHT: Dr WHT Receivable, Cr AR
      const jeId = `JE-WHT-${Date.now()}`;
      const whtJE: JournalEntry = {
        id: jeId,
        entryNumber: `WHT-${Date.now().toString().slice(-6)}`,
        date: now,
        reference: certificateNumber || invoice.invoiceNumber,
        description: `WHT Credit for ${invoice.invoiceNumber}`,
        totalDebit: totalWithheld,
        totalCredit: totalWithheld,
        currency: 'GHS',
        status: 'Posted',
        postedBy: staffName || 'system',
        postedAt: now,
        createdAt: now,
        updatedAt: now,
        lines: [
          {
            id: `${jeId}-1`,
            journalEntryId: jeId,
            accountCode: '1230', // WHT Receivable
            description: `WHT Credit - ${whtAmount > 0 ? `WHT: ${whtAmount}` : ''}${whtVatAmount > 0 ? ` WHT-VAT: ${whtVatAmount}` : ''}`,
            debit: totalWithheld,
            credit: 0,
            currency: 'GHS',
          },
          {
            id: `${jeId}-2`,
            journalEntryId: jeId,
            accountCode: '1200', // Accounts Receivable
            description: `Clear AR for WHT on ${invoice.invoiceNumber}`,
            debit: 0,
            credit: totalWithheld,
            currency: 'GHS',
          },
        ],
      };
      set((st) => ({ journalEntries: [...st.journalEntries, whtJE] }));
    }

    // 4. Add cash receipt to payments
    set((st) => ({ payments: [...st.payments, cashReceipt] }));

    // 5. Update invoice paid amount and status
    const newPaidAmount = (invoice.paidAmount || 0) + totalPayment;
    const newStatus = newPaidAmount >= invoice.total ? 'Paid' : invoice.status;
    
    set((st) => ({
      invoices: st.invoices.map(inv => 
        inv.id === invoiceId ? {
          ...inv,
          paidAmount: newPaidAmount,
          status: newStatus as any,
          paidDate: newStatus === 'Paid' ? now : inv.paidDate,
          whtReceived: (inv.whtReceived || 0) + whtAmount,
          whtVatReceived: (inv.whtVatReceived || 0) + whtVatAmount,
          whtCertificateIds: whtCertificateId 
            ? [...(inv.whtCertificateIds || []), whtCertificateId]
            : inv.whtCertificateIds,
          whtStatus: newPaidAmount >= invoice.total ? 'Complete' : 'Partial',
          updatedAt: now,
        } : inv
      )
    }));

    // 6. Update business partner balance
    set((st) => ({
      businessPartners: st.businessPartners.map(p => 
        p.id === invoice.businessPartnerId && (p.type === 'Customer' || p.type === 'Both')
          ? { ...p, balance: +(p.balance - totalPayment).toFixed(2) }
          : p
      )
    }));

    // 7. Add audit trail
    set((st) => ({
      auditTrail: [...st.auditTrail, {
        id: `AT-WHT-${Date.now()}`,
        tableName: 'WHT_Payment',
        recordId: invoice.id,
        action: 'Create',
        description: `WHT payment recorded for ${invoice.invoiceNumber}`,
        oldValues: null as any,
        newValues: {
          invoiceId: invoice.id,
          cashAmount,
          whtAmount,
          whtVatAmount,
          totalCleared: totalPayment,
          certificateNumber: certificateNumber || 'pending',
          receiptId: cashReceipt.id,
          whtCertificateId,
        },
        userId: staffId || 'system',
        timestamp: now,
      }]
    }));

    console.log(`[Accounting] ✅ WHT Payment Complete:`, {
      receiptId: cashReceipt.id,
      whtCertificateId,
      invoiceNewBalance: invoice.total - newPaidAmount,
    });

    return { receiptId: cashReceipt.id, whtCertificateId };
  },

  getWHTCertificatesByInvoice: (invoiceId) => {
    return get().whtCertificates.filter(cert => cert.invoiceId === invoiceId);
  },

  getWHTCertificatesByStatus: (status) => {
    return get().whtCertificates.filter(cert => cert.status === status);
  },

  getPendingWHTCertificates: () => {
    return get().whtCertificates.filter(cert => cert.status === 'Pending');
  },

  // Payment Voucher Actions
  generateNextVoucherNumber: () => {
    const year = new Date().getFullYear();
    const existingVouchers = get().paymentVouchers.filter(v => {
      const voucherYear = v.voucherNumber.split('-')[1];
      return voucherYear === String(year);
    });
    const nextNumber = existingVouchers.length + 1;
    return `PV-${year}-${String(nextNumber).padStart(4, '0')}`;
  },

  createPaymentVoucher: (voucherData) => {
    const state = get();
    const voucherNumber = state.generateNextVoucherNumber();
    const accounts = state.chartOfAccounts;
    const now = new Date();

    // Normalize date
    const dateObj = voucherData.date instanceof Date ? voucherData.date : new Date(voucherData.date as any);

    // Normalize lines: drop zero lines, ensure ids, format amounts, attach accountName
    const normalizedLines: PaymentVoucherLine[] = (voucherData.lines || [])
      .filter((l) => (Number(l.debit || 0) !== 0) || (Number(l.credit || 0) !== 0))
      .map((l) => {
        const debit = +Number(l.debit || 0).toFixed(2);
        const credit = +Number(l.credit || 0).toFixed(2);
        const acct = accounts.find(a => a.code === l.accountCode);
        return {
          id: l.id || (Date.now().toString() + Math.random()),
          accountCode: l.accountCode,
          accountName: l.accountName || acct?.name,
          details: l.details || '',
          debit,
          credit,
          costCenter: l.costCenter,
          project: l.project,
          reference: l.reference
        };
      });

    // Basic line validations: non-negative and not both sides
    const bad = normalizedLines.find(l => l.debit < 0 || l.credit < 0 || (l.debit > 0 && l.credit > 0));
    if (bad) {
      set({ error: 'Each line must have non-negative amounts and only one side (debit or credit).' });
    }

    // Recompute totals
    const totalDebit = normalizedLines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = normalizedLines.reduce((sum, line) => sum + line.credit, 0);

    // Defaults
    const bank = voucherData.bankAccountId ? state.bankAccounts.find(b => b.id === voucherData.bankAccountId) : undefined;
    const partner = voucherData.payToId ? state.businessPartners.find(p => p.id === voucherData.payToId) : undefined;
    const currency = voucherData.currency || bank?.currency || 'GHS';
    const bankAccountName = voucherData.bankAccountName || bank?.accountName;
    const payTo = voucherData.payTo || partner?.name || '';
    const contact = voucherData.contact || partner?.contactPerson;
    const status = voucherData.status || 'Draft';
    
    const newVoucher: PaymentVoucher = {
      id: Date.now().toString(),
      voucherNumber,
      date: dateObj,
      payTo,
      payToId: voucherData.payToId,
      contact,
      lines: normalizedLines,
      totalDebit,
      totalCredit,
      bankAccountId: voucherData.bankAccountId,
      bankAccountName,
      chequeNumber: voucherData.chequeNumber,
      description: voucherData.description,
      reference: voucherData.reference,
      status,
      currency,
      // Receipt placeholders
      receivedBy: voucherData.receivedBy,
      receiverContact: voucherData.receiverContact,
      receiverIdType: voucherData.receiverIdType,
      receiverIdNumber: voucherData.receiverIdNumber,
      receivedDate: voucherData.receivedDate,
      receiverSignature: voucherData.receiverSignature,
      attachments: voucherData.attachments,
      pdfUrl: voucherData.pdfUrl,
      pdfFileName: voucherData.pdfFileName,
      pdfGeneratedAt: voucherData.pdfGeneratedAt,
      pdfGeneratedBy: voucherData.pdfGeneratedBy,
      preparedBy: voucherData.preparedBy,
      preparedSignature: voucherData.preparedSignature,
      preparedDate: voucherData.preparedDate,
      approvedBy: voucherData.approvedBy,
      approvedSignature: voucherData.approvedSignature,
      approvedDate: voucherData.approvedDate,
      recordedBy: voucherData.recordedBy,
      recordedSignature: voucherData.recordedSignature,
      recordedDate: voucherData.recordedDate,
      journalEntryId: undefined,
      createdAt: now,
      updatedAt: now
    };
    
    set(state => ({ paymentVouchers: [...state.paymentVouchers, newVoucher] }));

    // Audit trail (non-blocking)
    try {
      state.addAuditTrail({
        id: Date.now().toString(),
        tableName: 'PaymentVoucher',
        recordId: newVoucher.id,
        action: 'Create',
        newValues: { voucherNumber: newVoucher.voucherNumber, status: newVoucher.status },
        userId: 'current-user',
        timestamp: new Date().toISOString()
      });
    } catch {}

    return newVoucher;
  },

  setPaymentVoucherReceipt: (id, receipt) => {
    const v = get().getPaymentVoucher(id);
    if (!v) { set({ error: 'Payment voucher not found' }); return; }
    set(state => ({
      paymentVouchers: state.paymentVouchers.map(pv => pv.id === id ? {
        ...pv,
        receivedBy: receipt.receivedBy ?? pv.receivedBy,
        receiverContact: receipt.receiverContact ?? pv.receiverContact,
        receiverIdType: receipt.receiverIdType ?? pv.receiverIdType,
        receiverIdNumber: receipt.receiverIdNumber ?? pv.receiverIdNumber,
        receivedDate: receipt.receivedDate ? (receipt.receivedDate instanceof Date ? receipt.receivedDate : new Date(receipt.receivedDate)) : pv.receivedDate,
        receiverSignature: receipt.receiverSignature ?? pv.receiverSignature,
        updatedAt: new Date()
      } : pv)
    }));
  },

  setPaymentVoucherPdf: (id, pdf) => {
    const v = get().getPaymentVoucher(id);
    if (!v) { set({ error: 'Payment voucher not found' }); return; }
    set(state => ({
      paymentVouchers: state.paymentVouchers.map(pv => pv.id === id ? {
        ...pv,
        pdfUrl: pdf.url,
        pdfFileName: pdf.fileName ?? pv.pdfFileName,
        pdfGeneratedBy: pdf.generatedBy ?? 'current-user',
        pdfGeneratedAt: pdf.generatedAt ? (pdf.generatedAt instanceof Date ? pdf.generatedAt : new Date(pdf.generatedAt)) : new Date(),
        updatedAt: new Date()
      } : pv)
    }));
  },

  addPaymentVoucherAttachment: (id, fileName) => {
    const v = get().getPaymentVoucher(id);
    if (!v) { set({ error: 'Payment voucher not found' }); return; }
    set(state => ({
      paymentVouchers: state.paymentVouchers.map(pv => pv.id === id ? {
        ...pv,
        attachments: [...(pv.attachments || []), fileName],
        updatedAt: new Date()
      } : pv)
    }));
  },

  updatePaymentVoucher: (id, updates) => {
    set(state => ({
      paymentVouchers: state.paymentVouchers.map(v => {
        if (v.id === id) {
          const updated = { ...v, ...updates, updatedAt: new Date() };
          // Recalculate totals if lines changed
          if (updates.lines) {
            updated.totalDebit = updated.lines.reduce((sum: number, line: PaymentVoucherLine) => sum + line.debit, 0);
            updated.totalCredit = updated.lines.reduce((sum: number, line: PaymentVoucherLine) => sum + line.credit, 0);
          }
          return updated;
        }
        return v;
      })
    }));
  },

  deletePaymentVoucher: (id) => {
    set(state => ({
      paymentVouchers: state.paymentVouchers.filter(v => v.id !== id)
    }));
  },

  getPaymentVoucher: (id) => get().paymentVouchers.find(v => v.id === id),

  getPaymentVouchersByStatus: (status) => get().paymentVouchers.filter(v => v.status === status),

  preparePaymentVoucher: (id, preparedBy) => {
    const voucher = get().getPaymentVoucher(id);
    if (!voucher) { set({ error: 'Payment voucher not found' }); return; }
    if (voucher.status !== 'Draft') { set({ error: 'Voucher must be Draft to prepare' }); return; }
    if (Math.abs(voucher.totalDebit - voucher.totalCredit) > 0.01) { set({ error: 'Debit and Credit totals must match before prepare' }); return; }
    // Validate accounts exist
    const accounts = get().chartOfAccounts;
    const invalid = voucher.lines.find(l => !accounts.some(a => a.code === l.accountCode));
    if (invalid) { set({ error: `Invalid account code ${invalid.accountCode}` }); return; }
    set(state => ({
      paymentVouchers: state.paymentVouchers.map(v =>
        v.id === id
          ? {
              ...v,
              status: 'Prepared' as const,
              preparedBy,
              preparedDate: new Date(),
              updatedAt: new Date()
            }
          : v
      )
    }));
  },

  approvePaymentVoucher: (id, approvedBy) => {
    const voucher = get().getPaymentVoucher(id);
    if (!voucher) { set({ error: 'Payment voucher not found' }); return; }
    if (voucher.status !== 'Prepared') { set({ error: 'Voucher must be Prepared to approve' }); return; }
    set(state => ({
      paymentVouchers: state.paymentVouchers.map(v =>
        v.id === id
          ? {
              ...v,
              status: 'Approved' as const,
              approvedBy,
              approvedDate: new Date(),
              updatedAt: new Date()
            }
          : v
      )
    }));
  },

  recordPaymentVoucher: (id, recordedBy) => {
    const voucher = get().getPaymentVoucher(id);
    if (!voucher) { set({ error: 'Payment voucher not found' }); return; }
    if (voucher.status !== 'Approved') { set({ error: 'Voucher must be Approved to record' }); return; }
    set(state => ({
      paymentVouchers: state.paymentVouchers.map(v =>
        v.id === id
          ? {
              ...v,
              status: 'Recorded' as const,
              recordedBy,
              recordedDate: new Date(),
              updatedAt: new Date()
            }
          : v
      )
    }));
  },

  postPaymentVoucher: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const voucher = get().getPaymentVoucher(id);
      if (!voucher) {
        throw new Error('Payment voucher not found');
      }

      if (voucher.status !== 'Recorded') {
        throw new Error('Voucher must be Recorded to post');
      }

      // Validate debit = credit
      if (Math.abs(voucher.totalDebit - voucher.totalCredit) > 0.01) {
        throw new Error('Debit and Credit totals must match');
      }

      // Validate account codes
      const accounts = get().chartOfAccounts;
      const badLine = voucher.lines.find(l => !accounts.some(a => a.code === l.accountCode));
      if (badLine) {
        throw new Error(`Invalid account code ${badLine.accountCode}`);
      }

      // Create journal entry from payment voucher
      const entryNumber = `JE-${new Date().getFullYear()}-${String(get().journalEntries.length + 1).padStart(4, '0')}`;
      const journalLines: JournalEntryLine[] = voucher.lines.map(line => ({
        id: Date.now().toString() + Math.random(),
        journalEntryId: '',
        accountCode: line.accountCode,
        description: line.details,
        debit: line.debit,
        credit: line.credit,
        currency: voucher.currency,
        costCenter: line.costCenter,
        project: line.project,
        reference: line.reference
      }));

      const journalEntry: JournalEntry = {
        id: Date.now().toString(),
        entryNumber,
        date: voucher.date.toISOString().split('T')[0],
        reference: voucher.voucherNumber,
        description: `Payment Voucher ${voucher.voucherNumber} - ${voucher.payTo}`,
        totalDebit: voucher.totalDebit,
        totalCredit: voucher.totalCredit,
        currency: voucher.currency,
        status: 'Posted',
        postedBy: voucher.recordedBy || 'current-user',
        postedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lines: journalLines
      };

      // Update voucher status and link journal entry
      set(state => ({
        paymentVouchers: state.paymentVouchers.map(v =>
          v.id === id
            ? {
                ...v,
                status: 'Posted' as const,
                journalEntryId: journalEntry.id,
                updatedAt: new Date()
              }
            : v
        ),
        journalEntries: [...state.journalEntries, journalEntry]
      }));

      // Update GL balances
      journalLines.forEach(line => {
        get().updateGLBalance(line.accountCode, get().currentPeriod, {
          currentDebit: line.debit,
          currentCredit: line.credit
        });
      });

      // If linked bank account, update its balance and create a bank transaction
      if (voucher.bankAccountId) {
        const bank = get().bankAccounts.find(b => b.id === voucher.bankAccountId);
        if (bank) {
          const bankDelta = voucher.lines
            .filter(l => l.accountCode === bank.glAccountCode)
            .reduce((sum, l) => sum + (l.debit - l.credit), 0);
          const newBalance = +(bank.currentBalance + bankDelta).toFixed(2);
          get().updateBankAccount(bank.id, { currentBalance: newBalance, updatedAt: new Date().toISOString() });
          get().addBankTransaction({
            id: Date.now().toString(),
            bankAccountId: bank.id,
            transactionDate: voucher.date.toISOString().split('T')[0],
            reference: voucher.chequeNumber || voucher.voucherNumber,
            description: voucher.description || `Payment Voucher ${voucher.voucherNumber}`,
            amount: Math.abs(bankDelta),
            type: bankDelta >= 0 ? 'Deposit' : 'Withdrawal',
            currency: bank.currency,
            balance: newBalance,
            status: 'Cleared',
            journalEntryId: journalEntry.id,
            createdAt: new Date().toISOString()
          });
        }
      }

      // If linked to a business partner, adjust their balance based on AP/AR line movement
      if (voucher.payToId) {
        const partners = get().businessPartners;
        const bp = partners.find(p => p.id === voucher.payToId);
        if (bp) {
          const bpDelta = voucher.lines
            .filter(l => l.accountCode === bp.glAccountCode)
            .reduce((sum, l) => sum + (l.credit - l.debit), 0);
          if (Math.abs(bpDelta) > 0) {
            set({
              businessPartners: partners.map(p => p.id === bp.id ? { ...p, balance: +(p.balance + bpDelta).toFixed(2) } : p)
            });
          }
        }
      }

      // Audit trail
      get().addAuditTrail({
        id: Date.now().toString(),
        tableName: 'PaymentVoucher',
        recordId: id,
        action: 'Post',
        newValues: { status: 'Posted', journalEntryId: journalEntry.id },
        userId: 'current-user',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to post payment voucher' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Optional: cancel a voucher (only if not posted)
  cancelPaymentVoucher: (id: string) => {
    const v = get().getPaymentVoucher(id);
    if (!v) { set({ error: 'Payment voucher not found' }); return; }
    if (v.status === 'Posted') { set({ error: 'Cannot cancel a posted voucher' }); return; }
    set(state => ({
      paymentVouchers: state.paymentVouchers.map(pv => pv.id === id ? { ...pv, status: 'Cancelled', updatedAt: new Date() } : pv)
    }));
  },

  // Fixed Assets Actions
  setFixedAssets: (assets) => set({ fixedAssets: assets }),
  
  addFixedAsset: (asset) => set((state) => ({
    fixedAssets: [...state.fixedAssets, asset]
  })),
  
  updateFixedAsset: (id, updates) => set((state) => ({
    fixedAssets: state.fixedAssets.map(asset =>
      asset.id === id ? { ...asset, ...updates } : asset
    )
  })),
  
  deleteFixedAsset: (id) => set((state) => ({
    fixedAssets: state.fixedAssets.filter(asset => asset.id !== id)
  })),

  // Depreciation Actions
  setDepreciationSchedules: (schedules) => set({ depreciationSchedules: schedules }),
  
  calculateDepreciation: async (assetId, period) => {
    set({ isLoading: true, error: null });
    try {
      const state = get();
      const asset = state.fixedAssets.find(a => a.id === assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Prevent duplicate schedule for same period
      const existing = state.depreciationSchedules.find(s => s.assetId === assetId && s.period === period);
      if (existing) {
        return;
      }

      const monthsOfUsefulLife = Math.max(1, asset.usefulLife * 12);
      const depreciableBase = Math.max(0, asset.purchaseCost - asset.salvageValue);

      let depreciationAmount = 0;
      if (asset.depreciationMethod === 'Straight Line') {
        depreciationAmount = +(depreciableBase / monthsOfUsefulLife).toFixed(2);
      } else if (asset.depreciationMethod === 'Declining Balance') {
        const annualRate = asset.depreciationRate / 100;
        const monthlyRate = annualRate / 12;
        const currentNBV = Math.max(0, asset.netBookValue);
        depreciationAmount = +(currentNBV * monthlyRate).toFixed(2);
      } else {
        // Units of Production not supported here; fallback to straight line
        depreciationAmount = +(depreciableBase / monthsOfUsefulLife).toFixed(2);
      }

      const newAccumulated = +(Math.min(asset.purchaseCost - asset.salvageValue, asset.accumulatedDepreciation + depreciationAmount)).toFixed(2);
      const newNBV = +(Math.max(asset.salvageValue, asset.purchaseCost - newAccumulated)).toFixed(2);

      // Create schedule row
      const schedule = {
        id: Date.now().toString(),
        assetId: asset.id,
        period,
        depreciationAmount,
        accumulatedDepreciation: newAccumulated,
        netBookValue: newNBV,
        isPosted: false,
        createdAt: new Date().toISOString()
      } as any;

      set((prev) => ({
        depreciationSchedules: [...prev.depreciationSchedules, schedule],
      }));

      // Log audit
      get().addAuditTrail({
        id: `AT-${Date.now()}`,
        tableName: 'DepreciationSchedule',
        recordId: schedule.id,
        action: 'Create',
        newValues: schedule,
        userId: 'system',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to calculate depreciation' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  postDepreciation: async (scheduleId) => {
    set({ isLoading: true, error: null });
    try {
      const schedule = get().depreciationSchedules.find((s) => s.id === scheduleId);
      if (!schedule) throw new Error('Depreciation schedule not found');
      if (schedule.isPosted) throw new Error('Depreciation already posted');

      set((state) => ({
        depreciationSchedules: state.depreciationSchedules.filter((s) => s.id !== scheduleId),
      }));

      const { captureDepreciation } = await import('./integrationExtendedCaptures');
      const result = captureDepreciation({
        assetId: schedule.assetId,
        period: schedule.period,
        amount: schedule.depreciationAmount,
      });
      if (!result) throw new Error('Failed to post depreciation to the ledger');
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to post depreciation' });
    } finally {
      set({ isLoading: false });
    }
  },

  recordCapitalAllowanceClaim: (assetId, period, amount) => {
    const asset = get().fixedAssets.find((a) => a.id === assetId);
    if (!asset) {
      set({ error: 'Asset not found' });
      return null;
    }
    const wdv = getTaxWrittenDownValue(asset);
    const claimAmount = Math.min(Math.max(0, amount), wdv);
    if (claimAmount <= 0) {
      set({ error: 'No qualifying tax written-down value remaining' });
      return null;
    }
    const newAccum = +( (asset.accumulatedCapitalAllowance ?? 0) + claimAmount).toFixed(2);
    const claim: CapitalAllowanceClaim = {
      id: `CA-${Date.now()}`,
      assetId,
      taxYear: parseInt(period.slice(0, 4), 10),
      period,
      pool: resolveCapitalAllowancePool(asset.category, asset.capitalAllowancePool),
      allowanceAmount: claimAmount,
      writtenDownValueAfter: Math.max(0, +(asset.purchaseCost - newAccum).toFixed(2)),
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      capitalAllowanceClaims: [...state.capitalAllowanceClaims, claim],
      fixedAssets: state.fixedAssets.map((a) =>
        a.id === assetId
          ? { ...a, accumulatedCapitalAllowance: newAccum, updatedAt: new Date().toISOString() }
          : a
      ),
      error: null,
    }));
    get().addAuditTrail({
      id: `AT-CA-${Date.now()}`,
      tableName: 'CapitalAllowanceClaim',
      recordId: claim.id,
      action: 'Create',
      newValues: claim,
      userId: 'system',
      timestamp: new Date().toISOString(),
    });
    return claim;
  },

  // Cost Centers Actions
  setCostCenters: (centers) => set({ costCenters: centers }),
  
  addCostCenter: (center) => set((state) => ({
    costCenters: [...state.costCenters, center]
  })),
  
  updateCostCenter: (id, updates) => set((state) => ({
    costCenters: state.costCenters.map(center =>
      center.id === id ? { ...center, ...updates } : center
    )
  })),
  
  deleteCostCenter: (id) => set((state) => ({
    costCenters: state.costCenters.filter(center => center.id !== id)
  })),

  // Revenue Centers Actions
  setRevenueCenters: (centers) => set({ revenueCenters: centers }),
  
  addRevenueCenter: (center) => set((state) => ({
    revenueCenters: [...state.revenueCenters, center]
  })),
  
  updateRevenueCenter: (id, updates) => set((state) => ({
    revenueCenters: state.revenueCenters.map(center =>
      center.id === id ? { ...center, ...updates } : center
    )
  })),
  
  deleteRevenueCenter: (id) => set((state) => ({
    revenueCenters: state.revenueCenters.filter(center => center.id !== id)
  })),

  // Helper functions to track costs and revenue with detailed logging
  recordExpense: (costCenterCode, amount) => set((state) => {
    const center = state.costCenters.find(cc => cc.code === costCenterCode);
    if (center) {
      const previousAmount = center.actualExpenses || 0;
      const newAmount = previousAmount + amount;
      const budget = center.budget || 0;
      const variance = budget - newAmount;
      const utilizationPercent = budget > 0 ? ((newAmount / budget) * 100).toFixed(1) : 'N/A';
      
      console.log(`[Accounting] 📊 Expense Recorded:`, {
        costCenter: `${center.name} (${costCenterCode})`,
        amount: `GHS ${amount.toLocaleString()}`,
        previousTotal: `GHS ${previousAmount.toLocaleString()}`,
        newTotal: `GHS ${newAmount.toLocaleString()}`,
        budget: `GHS ${budget.toLocaleString()}`,
        variance: `GHS ${variance.toLocaleString()}`,
        utilization: `${utilizationPercent}%`,
        timestamp: new Date().toISOString()
      });
      
      return {
        costCenters: state.costCenters.map(cc =>
          cc.id === center.id
            ? { ...cc, actualExpenses: newAmount, variance: budget - newAmount, updatedAt: new Date().toISOString() }
            : cc
        )
      };
    }
    console.warn(`[Accounting] ⚠️ Cost center not found: ${costCenterCode}`);
    return state;
  }),

  recordRevenue: (revenueCenterCode, amount) => set((state) => {
    const center = state.revenueCenters.find(rc => rc.code === revenueCenterCode);
    if (center) {
      const previousAmount = center.actualRevenue || 0;
      const newAmount = previousAmount + amount;
      const target = center.budget || 0;
      const variance = newAmount - target;
      const achievementPercent = target > 0 ? ((newAmount / target) * 100).toFixed(1) : 'N/A';
      
      console.log(`[Accounting] 💰 Revenue Recorded:`, {
        revenueCenter: `${center.name} (${revenueCenterCode})`,
        amount: `GHS ${amount.toLocaleString()}`,
        previousTotal: `GHS ${previousAmount.toLocaleString()}`,
        newTotal: `GHS ${newAmount.toLocaleString()}`,
        target: `GHS ${target.toLocaleString()}`,
        variance: `GHS ${variance.toLocaleString()}`,
        achievement: `${achievementPercent}%`,
        timestamp: new Date().toISOString()
      });
      
      return {
        revenueCenters: state.revenueCenters.map(rc =>
          rc.id === center.id
            ? { ...rc, actualRevenue: newAmount, variance: newAmount - (rc.budget || 0), updatedAt: new Date().toISOString() }
            : rc
        )
      };
    }
    console.warn(`[Accounting] ⚠️ Revenue center not found: ${revenueCenterCode}`);
    return state;
  }),

  // Projects Actions
  setProjects: (projects) => set({ projects: projects }),
  
  addProject: (project) => set((state) => ({
    projects: [...state.projects, project]
  })),
  
  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map(project =>
      project.id === id ? { ...project, ...updates } : project
    )
  })),
  
  deleteProject: (id) => set((state) => ({
    projects: state.projects.filter(project => project.id !== id)
  })),

  // Reports Actions
  setFinancialReports: (reports) => set({ financialReports: reports }),
  
  generateFinancialReport: async (type, period) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const report: FinancialReport = {
        id: Date.now().toString(),
        name: `${type} Report`,
        type: type as any,
        period,
        currency: 'GHS',
        data: {},
        generatedAt: new Date().toISOString(),
        generatedBy: 'current-user'
      };
      set((state) => ({
        financialReports: [...state.financialReports, report]
      }));
      return report;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to generate report' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Audit Trail Actions
  addAuditTrail: (trail) => set((state) => ({
    auditTrail: [...state.auditTrail, trail]
  })),

  addPurchaseOrder: (po) => set((state) => ({
    purchaseOrders: [...state.purchaseOrders, po],
  })),
  updatePurchaseOrder: (id, updates) => set((state) => ({
    purchaseOrders: state.purchaseOrders.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p)),
  })),
  addInventoryAccountingTransaction: (t) => set((state) => ({
    inventoryAccountingTransactions: [...state.inventoryAccountingTransactions, t],
  })),
  addPayrollLedgerEntry: (p) => set((state) => ({
    payrollLedgerEntries: [...state.payrollLedgerEntries, p],
  })),
  addSsnitRegisterEntry: (e) => set((state) => ({
    ssnitRegisterEntries: [...state.ssnitRegisterEntries, e],
  })),
  addPayeRegisterEntry: (e) => set((state) => ({
    payeRegisterEntries: [...state.payeRegisterEntries, e],
  })),
  addAccrualLedgerEntry: (e) => set((state) => ({
    accrualLedgerEntries: [...state.accrualLedgerEntries, e],
  })),
  addPrepaymentLedgerEntry: (e) => set((state) => ({
    prepaymentLedgerEntries: [...state.prepaymentLedgerEntries, e],
  })),
  addTaxRegisterEntry: (e) => set((state) => ({
    taxRegisterEntries: [...state.taxRegisterEntries, e],
  })),

  // Utility Functions
  getAccountBalance: (accountCode, period) => {
    const balances = get().glBalances;
    const targetPeriod = period || get().currentPeriod;
    const balance = balances.find(b => b.accountCode === accountCode && b.period === targetPeriod);
    return balance ? balance.closingBalance : 0;
  },
  
  getAccountBalances: (period) => {
    const balances = get().glBalances;
    const targetPeriod = period || get().currentPeriod;
    return balances.filter(b => b.period === targetPeriod);
  },
  
  getTrialBalance: (period) => {
    const st = get();
    const targetPeriod = period || st.currentPeriod;
    const rollup = defaultRollupCoa();
    return computeTrialBalanceGLBalances(st.chartOfAccounts, st.journalEntries, rollup, targetPeriod);
  },

  getIncomeStatement: (period) => {
    const st = get();
    const p = period || st.currentPeriod;
    const rollup = defaultRollupCoa();
    return computeIncomeStatementFromJE(st.chartOfAccounts, st.journalEntries, rollup, p);
  },

  getBalanceSheet: (period) => {
    const st = get();
    const p = period || st.currentPeriod;
    const rollup = defaultRollupCoa();
    return computeBalanceSheetFromJE(st.chartOfAccounts, st.journalEntries, rollup, p);
  },

  getCashFlow: (period) => {
    const st = get();
    const p = period || st.currentPeriod;
    return computeCashFlowForPeriod(st.journalEntries, p);
  },
  
  calculateTax: (amount, taxCode) => {
    const taxConfig = get().getTaxConfig(taxCode);
    return taxConfig ? (amount * taxConfig.rate / 100) : 0;
  },
  
  getTaxConfig: (taxCode) => {
    return get().taxConfigs.find(config => config.code === taxCode);
  },

  // Loading States
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Initialize
  initializeAccounting: async () => {
    set({ isLoading: true, error: null });
    try {
      // Initialize with Ghana chart of accounts
      const accounts: ChartOfAccounts[] = GHANA_CHART_OF_ACCOUNTS.map((account, index) => {
        const accountType: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense' = 
          account.type === 'Asset' ? 'Asset' :
          account.type === 'Liability' ? 'Liability' :
          account.type === 'Equity' ? 'Equity' :
          account.type === 'Revenue' ? 'Revenue' :
          'Expense';
        
        return {
        id: (index + 1).toString(),
        code: account.code,
        name: account.name,
          type: accountType,
        category: account.category,
        level: account.level,
        currency: 'GHS',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
        };
      });
      
      // Initialize tax configurations (aligned with chart leaf accounts; drives sales + purchase posting)
      const taxConfigs: TaxConfig[] = taxConfigsFromGhanaTemplate();
      
      // Initialize current financial period
      const currentDate = new Date();
      const currentPeriod: FinancialPeriod = {
        id: '1',
        name: `${currentDate.getFullYear()} - ${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
        startDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString(),
        endDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString(),
        isOpen: true,
        isCurrent: true,
        year: currentDate.getFullYear(),
        period: currentDate.getMonth() + 1,
        createdAt: new Date().toISOString()
      };
      
      // Initialize sample journal entries
      const sampleJournalEntries: JournalEntry[] = [
        {
          id: '1',
          entryNumber: 'JE-2024-001',
          date: new Date().toISOString(),
          reference: 'INV-001',
          description: 'Sales invoice posting',
          totalDebit: 1500.00,
          totalCredit: 1500.00,
          currency: 'GHS',
          status: 'Posted',
          postedBy: 'admin',
          postedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lines: [
            {
              id: '1',
              journalEntryId: 'je-sample-1',
              accountCode: '1100',
              description: 'Guest receivable',
              debit: 1500.00,
              credit: 0.00,
              currency: 'GHS'
            },
            {
              id: '2',
              journalEntryId: 'je-sample-1',
              accountCode: '4000',
              description: 'Room revenue',
              debit: 0.00,
              credit: 1500.00,
              currency: 'GHS'
            }
          ]
        }
      ];

             // ============================================================
       // SAMPLE DATA - Complete Transaction Flows
       // ============================================================
       const now = new Date().toISOString();
       const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
       const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
       const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
       const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
       const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
       const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
       const dueIn30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
       const dueIn14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
       const dueIn7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
       const overdue5Days = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
       const overdue10Days = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
       
       const sampleInvoices: Invoice[] = [
         // ============================================================
         // CONFERENCE/EVENTS - Complete Flow Examples
         // ============================================================
         
         // FLOW 1: Event Proforma → Invoice → FULL PAYMENT ✓
         {
           id: 'PRO-EVT-001',
           invoiceNumber: 'PRO-EVT-2024-001',
           type: 'Sales',
           isProforma: true,
           date: twoWeeksAgo,
           dueDate: oneWeekAgo,
           businessPartnerId: 'CUST-001',
           reference: 'EVT-CORP-001',
           description: 'Corporate Training Workshop - Proforma',
           subtotal: 5000.00,
           taxAmount: 1050.00,
           total: 6050.00,
           currency: 'GHS',
           status: 'Converted',
           paidAmount: 0,
           createdAt: twoWeeksAgo,
           updatedAt: oneWeekAgo,
           sourceModule: 'conference',
           customerName: 'Accra Business School',
           customerEmail: 'events@abs.edu.gh',
           customerPhone: '+233 30 277 1234',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
           eventId: 'EVT-CORP-001',
           pax: 50,
           venue: 'Training Room A',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 125.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 125.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 800.00 },
           ],
           items: [
             { description: 'Training Room - Full Day', quantity: 1, unitPrice: 2000.00 },
             { description: 'Catering (50 pax)', quantity: 50, unitPrice: 60.00 },
           ],
           lines: []
         } as any,
         {
           id: 'INV-EVT-001',
           invoiceNumber: 'INV-EVT-2024-001',
           type: 'Sales',
           date: oneWeekAgo,
           dueDate: threeDaysAgo,
           businessPartnerId: 'CUST-001',
           reference: 'EVT-CORP-001',
           description: 'Corporate Training Workshop - PAID ✓',
           subtotal: 5000.00,
           taxAmount: 1050.00,
           total: 6050.00,
           currency: 'GHS',
           status: 'Paid',
           paidAmount: 6050.00,
           paidDate: fiveDaysAgo,
           createdAt: oneWeekAgo,
           updatedAt: fiveDaysAgo,
           sourceModule: 'conference',
           customerName: 'Accra Business School',
           customerEmail: 'events@abs.edu.gh',
           customerPhone: '+233 30 277 1234',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
           eventId: 'EVT-CORP-001',
           pax: 50,
           venue: 'Training Room A',
           proformaId: 'PRO-EVT-001',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 125.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 125.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 800.00 },
           ],
           items: [
             { description: 'Training Room - Full Day', quantity: 1, unitPrice: 2000.00 },
             { description: 'Catering (50 pax)', quantity: 50, unitPrice: 60.00 },
           ],
           lines: [
             { id: 'IL-EVT-001', invoiceId: 'INV-EVT-001', description: 'Training Package', quantity: 1, unitPrice: 5000.00, amount: 5000.00, taxAmount: 1050.00, glAccountCode: '4300' }
           ]
         } as any,
         
         // FLOW 2: Event Proforma → Invoice → PART PAYMENT (50%)
         {
           id: 'PRO-EVT-002',
           invoiceNumber: 'PRO-EVT-2024-002',
           type: 'Sales',
           isProforma: true,
           date: oneWeekAgo,
           dueDate: fiveDaysAgo,
           businessPartnerId: 'CUST-002',
           reference: 'EVT-WEDDING-002',
           description: 'Wedding Reception - Proforma',
           subtotal: 15000.00,
           taxAmount: 3150.00,
           total: 18150.00,
           currency: 'GHS',
           status: 'Converted',
           paidAmount: 0,
           createdAt: oneWeekAgo,
           updatedAt: fiveDaysAgo,
           sourceModule: 'conference',
           customerName: 'Mensah Family',
           customerEmail: 'kofi.mensah@email.com',
           customerPhone: '+233 24 555 1234',
           staffName: 'Abena Serwaa',
           staffId: 'EVT-002',
           staffRole: 'Events Manager',
           eventId: 'EVT-WEDDING-002',
           pax: 200,
           venue: 'Grand Ballroom',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 375.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 375.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 2400.00 },
           ],
           items: [
             { description: 'Grand Ballroom Venue', quantity: 1, unitPrice: 5000.00 },
             { description: 'Wedding Catering (200 pax)', quantity: 200, unitPrice: 50.00 },
           ],
           lines: []
         } as any,
         {
           id: 'INV-EVT-002',
           invoiceNumber: 'INV-EVT-2024-002',
           type: 'Sales',
           date: fiveDaysAgo,
           dueDate: dueIn7Days,
           businessPartnerId: 'CUST-002',
           reference: 'EVT-WEDDING-002',
           description: 'Wedding Reception - 50% DEPOSIT PAID',
           subtotal: 15000.00,
           taxAmount: 3150.00,
           total: 18150.00,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 9075.00,
           createdAt: fiveDaysAgo,
           updatedAt: threeDaysAgo,
           sourceModule: 'conference',
           customerName: 'Mensah Family',
           customerEmail: 'kofi.mensah@email.com',
           customerPhone: '+233 24 555 1234',
           staffName: 'Abena Serwaa',
           staffId: 'EVT-002',
           staffRole: 'Events Manager',
           eventId: 'EVT-WEDDING-002',
           pax: 200,
           venue: 'Grand Ballroom',
           proformaId: 'PRO-EVT-002',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 375.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 375.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 2400.00 },
           ],
           items: [
             { description: 'Grand Ballroom Venue', quantity: 1, unitPrice: 5000.00 },
             { description: 'Wedding Catering (200 pax)', quantity: 200, unitPrice: 50.00 },
           ],
           lines: [
             { id: 'IL-EVT-002', invoiceId: 'INV-EVT-002', description: 'Wedding Package', quantity: 1, unitPrice: 15000.00, amount: 15000.00, taxAmount: 3150.00, glAccountCode: '4300' }
           ]
         } as any,
         
         // FLOW 3: Event Proforma → Invoice → ZERO PAYMENT (Awaiting)
         {
           id: 'PRO-EVT-003',
           invoiceNumber: 'PRO-EVT-2024-003',
           type: 'Sales',
           isProforma: true,
           date: threeDaysAgo,
           dueDate: yesterday,
           businessPartnerId: 'CUST-003',
           reference: 'EVT-SEMINAR-003',
           description: 'Tech Seminar - Proforma',
           subtotal: 8000.00,
           taxAmount: 1680.00,
           total: 9680.00,
           currency: 'GHS',
           status: 'Converted',
           paidAmount: 0,
           createdAt: threeDaysAgo,
           updatedAt: yesterday,
           sourceModule: 'conference',
           customerName: 'Ghana Tech Hub',
           customerEmail: 'info@ghanatechhub.com',
           customerPhone: '+233 30 288 4567',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
           eventId: 'EVT-SEMINAR-003',
           pax: 80,
           venue: 'Conference Hall B',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 200.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 200.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 1280.00 },
           ],
           items: [
             { description: 'Conference Hall B', quantity: 1, unitPrice: 3000.00 },
             { description: 'AV Equipment', quantity: 1, unitPrice: 1000.00 },
             { description: 'Catering (80 pax)', quantity: 80, unitPrice: 50.00 },
           ],
           lines: []
         } as any,
         {
           id: 'INV-EVT-003',
           invoiceNumber: 'INV-EVT-2024-003',
           type: 'Sales',
           date: yesterday,
           dueDate: dueIn14Days,
           businessPartnerId: 'CUST-003',
           reference: 'EVT-SEMINAR-003',
           description: 'Tech Seminar - AWAITING PAYMENT',
           subtotal: 8000.00,
           taxAmount: 1680.00,
           total: 9680.00,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 0,
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'conference',
           customerName: 'Ghana Tech Hub',
           customerEmail: 'info@ghanatechhub.com',
           customerPhone: '+233 30 288 4567',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
           eventId: 'EVT-SEMINAR-003',
           pax: 80,
           venue: 'Conference Hall B',
           proformaId: 'PRO-EVT-003',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 200.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 200.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 1280.00 },
           ],
           items: [
             { description: 'Conference Hall B', quantity: 1, unitPrice: 3000.00 },
             { description: 'AV Equipment', quantity: 1, unitPrice: 1000.00 },
             { description: 'Catering (80 pax)', quantity: 80, unitPrice: 50.00 },
           ],
           lines: [
             { id: 'IL-EVT-003', invoiceId: 'INV-EVT-003', description: 'Seminar Package', quantity: 1, unitPrice: 8000.00, amount: 8000.00, taxAmount: 1680.00, glAccountCode: '4300' }
           ]
         } as any,
         
         // FLOW 4: Event Proforma → Invoice → OVERDUE ⚠️
         {
           id: 'PRO-EVT-004',
           invoiceNumber: 'PRO-EVT-2024-004',
           type: 'Sales',
           isProforma: true,
           date: twoWeeksAgo,
           dueDate: twoWeeksAgo,
           businessPartnerId: 'CUST-004',
           reference: 'EVT-PARTY-004',
           description: 'Birthday Party - Proforma',
           subtotal: 3500.00,
           taxAmount: 735.00,
           total: 4235.00,
           currency: 'GHS',
           status: 'Converted',
           paidAmount: 0,
           createdAt: twoWeeksAgo,
           updatedAt: oneWeekAgo,
           sourceModule: 'conference',
           customerName: 'Nana Ama Owusu',
           customerEmail: 'nana.owusu@gmail.com',
           customerPhone: '+233 24 999 8888',
           staffName: 'Abena Serwaa',
           staffId: 'EVT-002',
           staffRole: 'Events Manager',
           eventId: 'EVT-PARTY-004',
           pax: 40,
           venue: 'Garden Terrace',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 87.50 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 87.50 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 560.00 },
           ],
           items: [
             { description: 'Garden Terrace Venue', quantity: 1, unitPrice: 1500.00 },
             { description: 'Party Catering (40 pax)', quantity: 40, unitPrice: 50.00 },
           ],
           lines: []
         } as any,
         {
           id: 'INV-EVT-004',
           invoiceNumber: 'INV-EVT-2024-004',
           type: 'Sales',
           date: oneWeekAgo,
           dueDate: overdue5Days,
           businessPartnerId: 'CUST-004',
           reference: 'EVT-PARTY-004',
           description: 'Birthday Party - OVERDUE ⚠️',
           subtotal: 3500.00,
           taxAmount: 735.00,
           total: 4235.00,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 0,
           createdAt: oneWeekAgo,
           updatedAt: oneWeekAgo,
           sourceModule: 'conference',
           customerName: 'Nana Ama Owusu',
           customerEmail: 'nana.owusu@gmail.com',
           customerPhone: '+233 24 999 8888',
           staffName: 'Abena Serwaa',
           staffId: 'EVT-002',
           staffRole: 'Events Manager',
           eventId: 'EVT-PARTY-004',
           pax: 40,
           venue: 'Garden Terrace',
           proformaId: 'PRO-EVT-004',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 87.50 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 87.50 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 560.00 },
           ],
           items: [
             { description: 'Garden Terrace Venue', quantity: 1, unitPrice: 1500.00 },
             { description: 'Party Catering (40 pax)', quantity: 40, unitPrice: 50.00 },
           ],
           lines: [
             { id: 'IL-EVT-004', invoiceId: 'INV-EVT-004', description: 'Birthday Party', quantity: 1, unitPrice: 3500.00, amount: 3500.00, taxAmount: 735.00, glAccountCode: '4300' }
           ]
         } as any,
         
         // FLOW 5: Event Proforma (Pending - Not Yet Converted)
         {
           id: 'PRO-EVT-005',
           invoiceNumber: 'PRO-EVT-2024-005',
           type: 'Sales',
           isProforma: true,
           date: now,
           dueDate: dueIn7Days,
           businessPartnerId: 'CUST-005',
           reference: 'EVT-CONF-005',
           description: 'Annual General Meeting - PENDING PROFORMA',
           subtotal: 12000.00,
           taxAmount: 2520.00,
           total: 14520.00,
           currency: 'GHS',
           status: 'Draft',
           paidAmount: 0,
           createdAt: now,
           updatedAt: now,
           sourceModule: 'conference',
           customerName: 'Ghana Chamber of Commerce',
           customerEmail: 'events@ghanachamber.org',
           customerPhone: '+233 30 266 7890',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
           eventId: 'EVT-CONF-005',
           pax: 150,
           checkIn: dueIn14Days,
           checkOut: dueIn14Days,
           venue: 'Grand Ballroom',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 300.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 300.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 1920.00 },
           ],
           items: [
             { description: 'Grand Ballroom - Full Day', quantity: 1, unitPrice: 5000.00 },
             { description: 'Conference Catering (150 pax)', quantity: 150, unitPrice: 40.00 },
             { description: 'AV & Staging', quantity: 1, unitPrice: 1000.00 },
           ],
           lines: []
         } as any,
         
         // ============================================================
         // ACCOMMODATION (Front Office) - Flow Examples
         // ============================================================
         
         // Accommodation: Full Payment
         {
           id: 'INV-FO-001',
           invoiceNumber: 'INV-FO-2024-001',
           type: 'Sales',
           date: threeDaysAgo,
           dueDate: dueIn30Days,
           businessPartnerId: 'CUST-006',
           reference: 'RES-2024-001',
           description: 'Deluxe Room 301 - 3 Nights - PAID ✓',
           subtotal: 1200.00,
           taxAmount: 252.00,
           total: 1452.00,
           currency: 'GHS',
           status: 'Paid',
           paidAmount: 1452.00,
           paidDate: yesterday,
           createdAt: threeDaysAgo,
           updatedAt: yesterday,
           sourceModule: 'front_office',
           customerName: 'Kwame Asante',
           customerEmail: 'kwame.asante@email.com',
           customerPhone: '+233 24 123 4567',
           staffName: 'Mary Mensah',
           staffId: 'FO-001',
           staffRole: 'Front Desk Agent',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 30.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 30.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 192.00 },
           ],
           items: [
             { description: 'Deluxe Room', quantity: 3, unitPrice: 400.00 },
           ],
           lines: [
             { id: 'IL-FO-001', invoiceId: 'INV-FO-001', description: 'Deluxe Room - 3 Nights', quantity: 3, unitPrice: 400.00, amount: 1200.00, taxAmount: 252.00, glAccountCode: '4100' }
           ]
         } as any,
         
         // Accommodation: Partial Payment (Deposit)
         {
           id: 'INV-FO-002',
           invoiceNumber: 'INV-FO-2024-002',
           type: 'Sales',
           date: yesterday,
           dueDate: dueIn7Days,
           businessPartnerId: 'CUST-007',
           reference: 'RES-2024-015',
           description: 'Executive Suite 501 - 5 Nights - DEPOSIT PAID',
           subtotal: 3000.00,
           taxAmount: 630.00,
           total: 3630.00,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 1815.00,
           createdAt: yesterday,
           updatedAt: now,
           sourceModule: 'front_office',
           customerName: 'Dr. Ama Boateng',
           customerEmail: 'dr.boateng@hospital.gh',
           customerPhone: '+233 20 111 2222',
           staffName: 'Joseph Owusu',
           staffId: 'FO-002',
           staffRole: 'Front Desk Supervisor',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 75.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 75.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 480.00 },
           ],
           items: [
             { description: 'Executive Suite', quantity: 5, unitPrice: 600.00 },
           ],
           lines: [
             { id: 'IL-FO-002', invoiceId: 'INV-FO-002', description: 'Executive Suite - 5 Nights', quantity: 5, unitPrice: 600.00, amount: 3000.00, taxAmount: 630.00, glAccountCode: '4100' }
           ]
         } as any,
         
         // ============================================================
         // RESTAURANT - Flow Examples
         // ============================================================
         
         // Restaurant: Full Payment (Cash)
         {
           id: 'INV-REST-001',
           invoiceNumber: 'INV-REST-2024-001',
           type: 'Sales',
           date: yesterday,
           dueDate: yesterday,
           businessPartnerId: 'CUST-WALK',
           reference: 'TBL-08-001',
           description: 'Table 8 - Lunch - PAID (Cash) ✓',
           subtotal: 285.00,
           taxAmount: 59.85,
           total: 344.85,
           currency: 'GHS',
           status: 'Paid',
           paidAmount: 344.85,
           paidDate: yesterday,
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'restaurant',
           customerName: 'Walk-in Customer',
           staffName: 'Grace Adjei',
           staffId: 'FB-003',
           staffRole: 'Waiter',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 7.13 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 7.13 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 45.60 },
           ],
           items: [
             { description: 'Jollof Rice with Chicken', quantity: 2, unitPrice: 85.00 },
             { description: 'Grilled Tilapia', quantity: 1, unitPrice: 95.00 },
             { description: 'Fresh Juice', quantity: 1, unitPrice: 20.00 },
           ],
           lines: [
             { id: 'IL-REST-001', invoiceId: 'INV-REST-001', description: 'Food & Beverage', quantity: 1, unitPrice: 285.00, amount: 285.00, taxAmount: 59.85, glAccountCode: '4200' }
           ]
         } as any,
         
         // Restaurant: Full Payment (Card)
         {
           id: 'INV-REST-002',
           invoiceNumber: 'INV-REST-2024-002',
           type: 'Sales',
           date: now,
           dueDate: now,
           businessPartnerId: 'CUST-006',
           reference: 'TBL-12-001',
           description: 'Table 12 - Dinner - PAID (Card) ✓',
           subtotal: 450.00,
           taxAmount: 94.50,
           total: 544.50,
           currency: 'GHS',
           status: 'Paid',
           paidAmount: 544.50,
           paidDate: now,
           createdAt: now,
           updatedAt: now,
           sourceModule: 'restaurant',
           customerName: 'Kwame Asante',
           customerEmail: 'kwame.asante@email.com',
           staffName: 'Samuel Boateng',
           staffId: 'FB-005',
           staffRole: 'Waiter',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 11.25 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 11.25 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 72.00 },
           ],
           items: [
             { description: 'Seafood Platter', quantity: 2, unitPrice: 180.00 },
             { description: 'Red Wine (Bottle)', quantity: 1, unitPrice: 90.00 },
           ],
           lines: [
             { id: 'IL-REST-002', invoiceId: 'INV-REST-002', description: 'Dinner Service', quantity: 1, unitPrice: 450.00, amount: 450.00, taxAmount: 94.50, glAccountCode: '4200' }
           ]
         } as any,
         
         // ============================================================
         // ROOM SERVICE - Flow Examples
         // ============================================================
         
         // Room Service: Charged to Room (Posted to Folio)
         {
           id: 'INV-RS-001',
           invoiceNumber: 'INV-RS-2024-001',
           type: 'Sales',
           date: yesterday,
           dueDate: dueIn7Days,
           businessPartnerId: 'CUST-006',
           reference: 'RS-301-001',
           description: 'Room Service - Room 301 - CHARGED TO ROOM',
           subtotal: 120.00,
           taxAmount: 25.20,
           total: 145.20,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 0,
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'room_service',
           customerName: 'Kwame Asante (Room 301)',
           staffName: 'Kofi Mensah',
           staffId: 'FB-010',
           staffRole: 'Room Service Attendant',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 3.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 3.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 19.20 },
           ],
           items: [
             { description: 'Continental Breakfast', quantity: 2, unitPrice: 45.00 },
             { description: 'Fresh Orange Juice', quantity: 2, unitPrice: 15.00 },
           ],
           lines: [
             { id: 'IL-RS-001', invoiceId: 'INV-RS-001', description: 'Room Service', quantity: 1, unitPrice: 120.00, amount: 120.00, taxAmount: 25.20, glAccountCode: '4201' }
           ]
         } as any,
         
         // ============================================================
         // MANUAL ENTRY
         // ============================================================
         {
           id: 'INV-MAN-001',
           invoiceNumber: 'INV-MAN-2024-001',
           type: 'Sales',
           date: twoDaysAgo,
           dueDate: dueIn30Days,
           businessPartnerId: 'CUST-008',
           reference: 'MAN-2024-001',
           description: 'Miscellaneous Services - Manual Entry',
           subtotal: 500.00,
           taxAmount: 105.00,
           total: 605.00,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 605.00,
           paidDate: yesterday,
           createdAt: twoDaysAgo,
           updatedAt: yesterday,
           sourceModule: 'other',
           customerName: 'ABC Company Ltd',
           customerEmail: 'accounts@abccompany.gh',
           customerPhone: '+233 30 255 1234',
           staffName: 'Admin User',
           staffId: 'ADM-001',
           staffRole: 'Accountant',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 12.50 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 12.50 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 80.00 },
           ],
           items: [
             { description: 'Consulting Services', quantity: 1, unitPrice: 500.00 },
           ],
           lines: [
             { id: 'IL-MAN-001', invoiceId: 'INV-MAN-001', description: 'Miscellaneous', quantity: 1, unitPrice: 500.00, amount: 500.00, taxAmount: 105.00, glAccountCode: '4900' }
           ]
         } as any,
       ];

             // ============================================================
       // RECEIPTS - Linked to Invoices
       // ============================================================
       const samplePayments: Payment[] = [
         // Event 1: Full Payment
         {
           id: 'RCP-EVT-001',
           paymentNumber: 'RCP-EVT-2024-001',
           date: fiveDaysAgo,
           type: 'Receipt',
           businessPartnerId: 'CUST-001',
           invoiceId: 'INV-EVT-001',
           reference: 'EVT-CORP-001',
           description: 'Full Payment - Corporate Training',
           amount: 6050.00,
           currency: 'GHS',
           paymentMethod: 'Bank Transfer',
           status: 'Posted',
           createdAt: fiveDaysAgo,
           updatedAt: fiveDaysAgo,
           sourceModule: 'conference',
           customerName: 'Accra Business School',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
         } as any,
         
         // Event 2: 50% Deposit
         {
           id: 'RCP-EVT-002',
           paymentNumber: 'RCP-EVT-2024-002',
           date: threeDaysAgo,
           type: 'Receipt',
           businessPartnerId: 'CUST-002',
           invoiceId: 'INV-EVT-002',
           reference: 'EVT-WEDDING-002',
           description: '50% Deposit - Wedding Reception',
           amount: 9075.00,
           currency: 'GHS',
           paymentMethod: 'Mobile Money',
           status: 'Posted',
           createdAt: threeDaysAgo,
           updatedAt: threeDaysAgo,
           sourceModule: 'conference',
           customerName: 'Mensah Family',
           staffName: 'Abena Serwaa',
           staffId: 'EVT-002',
           staffRole: 'Events Manager',
         } as any,
         
         // Accommodation 1: Full Payment
         {
           id: 'RCP-FO-001',
           paymentNumber: 'RCP-FO-2024-001',
           date: yesterday,
           type: 'Receipt',
           businessPartnerId: 'CUST-006',
           invoiceId: 'INV-FO-001',
           reference: 'RES-2024-001',
           description: 'Full Payment - Room 301',
           amount: 1452.00,
           currency: 'GHS',
           paymentMethod: 'Card',
           status: 'Posted',
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'front_office',
           customerName: 'Kwame Asante',
           staffName: 'Mary Mensah',
           staffId: 'FO-001',
           staffRole: 'Front Desk Agent',
         } as any,
         
         // Accommodation 2: Deposit
         {
           id: 'RCP-FO-002',
           paymentNumber: 'RCP-FO-2024-002',
           date: now,
           type: 'Receipt',
           businessPartnerId: 'CUST-007',
           invoiceId: 'INV-FO-002',
           reference: 'RES-2024-015',
           description: '50% Deposit - Executive Suite',
           amount: 1815.00,
           currency: 'GHS',
           paymentMethod: 'Bank Transfer',
           status: 'Posted',
           createdAt: now,
           updatedAt: now,
           sourceModule: 'front_office',
           customerName: 'Dr. Ama Boateng',
           staffName: 'Joseph Owusu',
           staffId: 'FO-002',
           staffRole: 'Front Desk Supervisor',
         } as any,
         
         // Restaurant 1: Cash
         {
           id: 'RCP-REST-001',
           paymentNumber: 'RCP-REST-2024-001',
           date: yesterday,
           type: 'Receipt',
           businessPartnerId: 'CUST-WALK',
           invoiceId: 'INV-REST-001',
           reference: 'TBL-08-001',
           description: 'Cash Payment - Table 8',
           amount: 344.85,
           currency: 'GHS',
           paymentMethod: 'Cash',
           status: 'Posted',
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'restaurant',
           customerName: 'Walk-in Customer',
           staffName: 'Grace Adjei',
           staffId: 'FB-003',
           staffRole: 'Waiter',
         } as any,
         
         // Restaurant 2: Card
         {
           id: 'RCP-REST-002',
           paymentNumber: 'RCP-REST-2024-002',
           date: now,
           type: 'Receipt',
           businessPartnerId: 'CUST-006',
           invoiceId: 'INV-REST-002',
           reference: 'TBL-12-001',
           description: 'Card Payment - Table 12',
           amount: 544.50,
           currency: 'GHS',
           paymentMethod: 'Card',
           status: 'Posted',
           createdAt: now,
           updatedAt: now,
           sourceModule: 'restaurant',
           customerName: 'Kwame Asante',
           staffName: 'Samuel Boateng',
           staffId: 'FB-005',
           staffRole: 'Waiter',
         } as any,
         
         // Manual Entry Payment
         {
           id: 'RCP-MAN-001',
           paymentNumber: 'RCP-MAN-2024-001',
           date: yesterday,
           type: 'Receipt',
           businessPartnerId: 'CUST-008',
           invoiceId: 'INV-MAN-001',
           reference: 'MAN-2024-001',
           description: 'Manual Payment - ABC Company',
           amount: 605.00,
           currency: 'GHS',
           paymentMethod: 'Cheque',
           status: 'Posted',
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'other',
           customerName: 'ABC Company Ltd',
           staffName: 'Admin User',
           staffId: 'ADM-001',
           staffRole: 'Accountant',
         } as any,
       ];

      // Initialize sample business partners
      const samplePartners: BusinessPartner[] = [
        // Event Customers
        {
          id: 'CUST-001',
          code: 'CUST-001',
          name: 'Accra Business School',
          type: 'Customer',
          taxNumber: 'TIN-E001',
          address: 'Ring Road Central, Accra',
          phone: '+233 30 277 1234',
          email: 'events@abs.edu.gh',
          contactPerson: 'Events Department',
          creditLimit: 20000,
          paymentTerms: 14,
          glAccountCode: '1200',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-002',
          code: 'CUST-002',
          name: 'Mensah Family',
          type: 'Customer',
          taxNumber: '',
          address: 'Tema, Greater Accra',
          phone: '+233 24 555 1234',
          email: 'kofi.mensah@email.com',
          contactPerson: 'Kofi Mensah',
          creditLimit: 25000,
          paymentTerms: 14,
          glAccountCode: '1200',
          currency: 'GHS',
          balance: 9075.00,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-003',
          code: 'CUST-003',
          name: 'Ghana Tech Hub',
          type: 'Customer',
          taxNumber: 'TIN-E003',
          address: 'Osu, Accra',
          phone: '+233 30 288 4567',
          email: 'info@ghanatechhub.com',
          contactPerson: 'Operations',
          creditLimit: 15000,
          paymentTerms: 14,
          glAccountCode: '1200',
          currency: 'GHS',
          balance: 9680.00,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-004',
          code: 'CUST-004',
          name: 'Nana Ama Owusu',
          type: 'Customer',
          taxNumber: '',
          address: 'East Legon, Accra',
          phone: '+233 24 999 8888',
          email: 'nana.owusu@gmail.com',
          contactPerson: 'Nana Ama Owusu',
          creditLimit: 10000,
          paymentTerms: 7,
          glAccountCode: '1200',
          currency: 'GHS',
          balance: 4235.00,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-005',
          code: 'CUST-005',
          name: 'Ghana Chamber of Commerce',
          type: 'Customer',
          taxNumber: 'TIN-E005',
          address: 'Independence Avenue, Accra',
          phone: '+233 30 266 7890',
          email: 'events@ghanachamber.org',
          contactPerson: 'Events Committee',
          creditLimit: 50000,
          paymentTerms: 30,
          glAccountCode: '1200',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        // Front Office Customers
        {
          id: 'CUST-006',
          code: 'CUST-006',
          name: 'Kwame Asante',
          type: 'Customer',
          taxNumber: '',
          address: 'Osu, Accra',
          phone: '+233 24 123 4567',
          email: 'kwame.asante@email.com',
          contactPerson: 'Kwame Asante',
          creditLimit: 5000,
          paymentTerms: 7,
          glAccountCode: '1200',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-007',
          code: 'CUST-007',
          name: 'Dr. Ama Boateng',
          type: 'Customer',
          taxNumber: '',
          address: 'Cantonments, Accra',
          phone: '+233 20 111 2222',
          email: 'dr.boateng@hospital.gh',
          contactPerson: 'Dr. Ama Boateng',
          creditLimit: 10000,
          paymentTerms: 14,
          glAccountCode: '1200',
          currency: 'GHS',
          balance: 1815.00,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-008',
          code: 'CUST-008',
          name: 'ABC Company Ltd',
          type: 'Customer',
          taxNumber: 'TIN-C008',
          address: 'Industrial Area, Accra',
          phone: '+233 30 255 1234',
          email: 'accounts@abccompany.gh',
          contactPerson: 'Finance Department',
          creditLimit: 20000,
          paymentTerms: 30,
          glAccountCode: '1200',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-WALK',
          code: 'WALK-001',
          name: 'Walk-in Customer',
          type: 'Customer',
          taxNumber: '',
          address: '',
          phone: '',
          email: '',
          contactPerson: '',
          creditLimit: 0,
          paymentTerms: 0,
          glAccountCode: '1200',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'SUP-001',
          code: 'SUP-001',
          name: 'Local Supplier Ltd',
          type: 'Supplier',
          taxNumber: 'TIN-S1001',
          address: 'Kumasi',
          phone: '+233 200 000 010',
          email: 'sales@supplier.com',
          contactPerson: 'Sales',
          creditLimit: 0,
          paymentTerms: 14,
          glAccountCode: '2200',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Initialize sample bank accounts
      const sampleBankAccounts: BankAccount[] = [
        {
          id: '1',
          accountNumber: '001-0001',
          accountName: 'Cash in Hand',
          bankName: 'Petty Cash',
          currency: 'GHS',
          glAccountCode: '1110',
          openingBalance: 5000,
          currentBalance: 7500,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          accountNumber: '233-0002',
          accountName: 'Main Bank Account',
          bankName: 'GCB Bank',
          currency: 'GHS',
          glAccountCode: '1120',
          openingBalance: 20000,
          currentBalance: 19500,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Initialize sample bank transactions
      const sampleBankTxns: BankTransaction[] = [
        {
          id: 'BT-1',
          bankAccountId: '2',
          transactionDate: new Date().toISOString(),
          reference: 'DEP-1001',
          description: 'Guest receipts deposit',
          amount: 5000,
          type: 'Deposit',
          currency: 'GHS',
          balance: 24500,
          status: 'Cleared',
          createdAt: new Date().toISOString()
        },
        {
          id: 'BT-2',
          bankAccountId: '2',
          transactionDate: new Date().toISOString(),
          reference: 'WDR-1002',
          description: 'Supplier payment',
          amount: -4500,
          type: 'Withdrawal',
          currency: 'GHS',
          balance: 20000,
          status: 'Reconciled',
          reconciledAt: new Date().toISOString(),
          reconciledBy: 'admin',
          createdAt: new Date().toISOString()
        }
      ];

      // Initialize sample fixed assets
      const sampleAssets: FixedAsset[] = [
        {
          id: 'FA-1',
          assetNumber: 'FA-0001',
          name: 'Hotel Furniture',
          description: 'Lobby and room furniture',
          category: 'Furniture & Fixtures',
          purchaseDate: new Date(new Date().getFullYear(), 0, 15).toISOString(),
          purchaseCost: 50000,
          currency: 'GHS',
          usefulLife: 5,
          salvageValue: 5000,
          depreciationMethod: 'Straight Line',
          depreciationRate: 20,
          accumulatedDepreciation: 10000,
          netBookValue: 40000,
          capitalAllowancePool: 'furniture',
          accumulatedCapitalAllowance: 8000,
          status: 'Active',
          glAccountCode: '1510',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Initialize sample depreciation schedule
      const sampleDepSchedules: DepreciationSchedule[] = [
        {
          id: 'DS-1',
          assetId: 'FA-1',
          period: new Date().toISOString().slice(0,7),
          depreciationAmount: 750,
          accumulatedDepreciation: 10750,
          netBookValue: 39250,
          isPosted: false,
          createdAt: new Date().toISOString()
        }
      ];

       // Initialize sample cost centers
      const sampleCostCenters: CostCenter[] = [
        {
          id: 'CC-001',
          code: 'FO',
          name: 'Front Office',
          description: 'Front desk operations and guest services',
          type: 'department',
          department: 'front_office',
          budget: 50000,
          actualExpenses: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CC-002',
          code: 'HK',
          name: 'Housekeeping',
          description: 'Housekeeping operations',
          type: 'department',
          department: 'housekeeping',
          budget: 45000,
          actualExpenses: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CC-003',
          code: 'FB',
          name: 'Food & Beverage',
          description: 'Restaurant and bar operations',
          type: 'department',
          department: 'food_beverage',
          budget: 80000,
          actualExpenses: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CC-004',
          code: 'KT',
          name: 'Kitchen',
          description: 'Kitchen operations and food preparation',
          type: 'department',
          department: 'kitchen',
          budget: 70000,
          actualExpenses: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CC-005',
          code: 'MT',
          name: 'Maintenance',
          description: 'Engineering and maintenance',
          type: 'department',
          department: 'maintenance',
          budget: 30000,
          actualExpenses: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CC-006',
          code: 'AC',
          name: 'Accounting',
          description: 'Finance and accounting department',
          type: 'support',
          department: 'accounting',
          budget: 35000,
          actualExpenses: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Initialize sample revenue centers
      const sampleRevenueCenters: RevenueCenter[] = [
        {
          id: 'RC-001',
          code: 'RM',
          name: 'Room Revenue',
          description: 'Accommodation revenue from all room types',
          type: 'rooms',
          department: 'front_office',
          glAccountCode: '4100',
          budget: 500000,
          actualRevenue: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'RC-002',
          code: 'REST',
          name: 'Restaurant Revenue',
          description: 'Restaurant food and dining revenue',
          type: 'food_beverage',
          department: 'restaurant',
          glAccountCode: '4200',
          budget: 200000,
          actualRevenue: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'RC-003',
          code: 'BAR',
          name: 'Bar Revenue',
          description: 'Beverage and bar revenue',
          type: 'food_beverage',
          department: 'bar',
          glAccountCode: '4200',
          budget: 150000,
          actualRevenue: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'RC-004',
          code: 'RS',
          name: 'Room Service',
          description: 'Room service revenue',
          type: 'services',
          department: 'room_service',
          glAccountCode: '4200',
          budget: 80000,
          actualRevenue: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'RC-005',
          code: 'CF',
          name: 'Conference Revenue',
          description: 'Conference and meeting room revenue',
          type: 'conferences',
          department: 'conference',
          glAccountCode: '4300',
          budget: 120000,
          actualRevenue: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'RC-006',
          code: 'SC',
          name: 'Service Charges',
          description: 'Service charges and gratuities',
          type: 'services',
          department: 'other',
          glAccountCode: '4400',
          budget: 100000,
          actualRevenue: 0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Initialize sample audit trail
      const sampleAudit: AuditTrail[] = [
        { id: 'AT-1', tableName: 'JournalEntry', recordId: '1', action: 'Post', userId: 'admin', timestamp: new Date().toISOString() },
        { id: 'AT-2', tableName: 'Invoice', recordId: '1', action: 'Create', userId: 'admin', timestamp: new Date().toISOString() },
        { id: 'AT-3', tableName: 'Payment', recordId: '1', action: 'Post', userId: 'admin', timestamp: new Date().toISOString() }
       ];

      // Initialize sample WHT certificates (Withholding Tax Credits)
      const sampleWHTCertificates: WHTCertificate[] = [
        // WHT Certificate 1: Corporate customer with full certificate received
        {
          id: 'WHT-001',
          certificateNumber: 'GRA-WHT-2024-001234',
          date: yesterday,
          receivedDate: now,
          withholdingAgentName: 'Ghana Ports & Harbours Authority',
          withholdingAgentTIN: 'C0003456789',
          taxPeriod: 'January 2026',
          invoiceId: 'INV-EVT-001',
          invoiceNumber: 'INV-EVT-2024-001',
          grossAmount: 6050.00,
          whtRate: 5,
          whtAmount: 250.00,  // 5% of 5000 subtotal
          whtVatRate: 7,
          whtVatAmount: 73.50,  // 7% of 1050 VAT
          totalWithheld: 323.50,
          status: 'Verified',
          taxCreditAccountCode: '1230',
          taxCreditUsedAmount: 0,
          taxCreditBalance: 323.50,
          verifiedBy: 'Kofi Asante',
          verifiedDate: now,
          createdAt: yesterday,
          updatedAt: now,
        },
        // WHT Certificate 2: Government ministry - pending certificate
        {
          id: 'WHT-002',
          certificateNumber: 'PENDING-20240108-002',
          date: now,
          receivedDate: '',
          withholdingAgentName: 'Ministry of Tourism',
          withholdingAgentTIN: 'G0001234567',
          taxPeriod: 'January 2026',
          invoiceId: 'INV-EVT-003',
          invoiceNumber: 'INV-EVT-2024-003',
          grossAmount: 24200.00,
          whtRate: 5,
          whtAmount: 1000.00,  // 5% of 20000 subtotal
          whtVatRate: 7,
          whtVatAmount: 294.00,  // 7% of 4200 VAT
          totalWithheld: 1294.00,
          status: 'Pending',
          taxCreditAccountCode: '1230',
          taxCreditUsedAmount: 0,
          taxCreditBalance: 1294.00,
          notes: 'Awaiting certificate from GRA - follow up in 2 weeks',
          createdAt: now,
          updatedAt: now,
        },
        // WHT Certificate 3: University - received but not verified
        {
          id: 'WHT-003',
          certificateNumber: 'GRA-WHT-2024-002567',
          date: oneWeekAgo,
          receivedDate: yesterday,
          withholdingAgentName: 'University of Ghana',
          withholdingAgentTIN: 'E0007891234',
          taxPeriod: 'December 2025',
          invoiceId: 'INV-CONF-001',
          invoiceNumber: 'INV-CONF-2024-001',
          grossAmount: 12100.00,
          whtRate: 5,
          whtAmount: 500.00,
          whtVatRate: 7,
          whtVatAmount: 147.00,
          totalWithheld: 647.00,
          status: 'Received',
          taxCreditAccountCode: '1230',
          taxCreditUsedAmount: 0,
          taxCreditBalance: 647.00,
          createdAt: oneWeekAgo,
          updatedAt: yesterday,
        }
       ];

      const prev = get();
      const mergeById = <T extends { id: string }>(seed: T[], existing: T[]): T[] => {
        const m = new Map<string, T>();
        for (const item of seed) m.set(item.id, item);
        for (const item of existing) m.set(item.id, item);
        return Array.from(m.values());
      };
      const mergeRevenueCenters = (seed: typeof sampleRevenueCenters, existing: typeof sampleRevenueCenters) => {
        const m = new Map<string, (typeof sampleRevenueCenters)[0]>();
        for (const rc of seed) m.set(rc.code, rc);
        for (const rc of existing) m.set(rc.code, rc);
        return Array.from(m.values());
      };

      const mergeCostCenters = (seed: typeof sampleCostCenters, existing: typeof sampleCostCenters) => {
        const m = new Map<string, (typeof sampleCostCenters)[0]>();
        for (const cc of seed) m.set(cc.code, cc);
        for (const cc of existing) m.set(cc.code, cc);
        return Array.from(m.values());
      };

      const mergeChartByCode = (seed: ChartOfAccounts[], existing: ChartOfAccounts[]) => {
        const m = new Map<string, ChartOfAccounts>();
        for (const a of seed) m.set(a.code, a);
        for (const a of existing) m.set(a.code, a);
        return Array.from(m.values());
      };

      const mergeTaxConfigs = (seed: TaxConfig[], existing: TaxConfig[]) => {
        const m = new Map<string, TaxConfig>();
        for (const t of seed) m.set(t.code, t);
        for (const t of existing) m.set(t.code, t);
        return Array.from(m.values());
      };

      const mergedFinancialPeriods = mergeById([currentPeriod], prev.financialPeriods);

      const prevFin = prev.currentFinancialPeriod;
      let resolvedCurrentFinancial: FinancialPeriod;
      if (prevFin?.id) {
        const match = mergedFinancialPeriods.find((p) => p.id === prevFin.id);
        resolvedCurrentFinancial =
          match || mergedFinancialPeriods.find((p) => p.isCurrent) || currentPeriod;
      } else {
        resolvedCurrentFinancial =
          mergedFinancialPeriods.find((p) => p.isCurrent) || currentPeriod;
      }

      const glMonthSlice = `${resolvedCurrentFinancial.year}-${String(resolvedCurrentFinancial.period).padStart(2, '0')}`;

      set({
        chartOfAccounts: mergeChartByCode(accounts, prev.chartOfAccounts),
        taxConfigs: mergeTaxConfigs(taxConfigs, prev.taxConfigs),
        financialPeriods: mergedFinancialPeriods,
        currentFinancialPeriod: resolvedCurrentFinancial,
        currentPeriod: glMonthSlice,
        journalEntries: mergeById(sampleJournalEntries, prev.journalEntries),
        invoices: mergeById(sampleInvoices, prev.invoices),
        payments: mergeById(samplePayments, prev.payments),
        whtCertificates: mergeById(sampleWHTCertificates, prev.whtCertificates),
        businessPartners: mergeById(samplePartners, prev.businessPartners),
        bankAccounts: mergeById(sampleBankAccounts, prev.bankAccounts),
        bankTransactions: mergeById(sampleBankTxns, prev.bankTransactions),
        fixedAssets: mergeById(sampleAssets, prev.fixedAssets),
        depreciationSchedules: mergeById(sampleDepSchedules, prev.depreciationSchedules),
        costCenters: mergeCostCenters(sampleCostCenters, prev.costCenters),
        revenueCenters: mergeRevenueCenters(sampleRevenueCenters, prev.revenueCenters),
        auditTrail: mergeById(sampleAudit, prev.auditTrail)
      });

      // Hydrate persisted records from the database (server authoritative).
      // Seed records are demo-only and remain when the DB has none for that id.
      const [serverJEs, serverInvoices, serverPayments] = await Promise.all([
        fetchJournalEntries(),
        fetchInvoices(),
        fetchPayments(),
      ]);
      if (serverJEs && serverJEs.length > 0) {
        set((s) => {
          const byId = new Map(s.journalEntries.map(e => [e.id, e]));
          serverJEs.forEach(e => byId.set(e.id, e));
          return { journalEntries: Array.from(byId.values()) };
        });
      }
      if (serverInvoices && serverInvoices.length > 0) {
        set((s) => {
          const byId = new Map(s.invoices.map(i => [i.id, i]));
          serverInvoices.forEach(i => byId.set(i.id, i));
          return { invoices: Array.from(byId.values()) };
        });
      }
      if (serverPayments && serverPayments.length > 0) {
        set((s) => {
          const byId = new Map(s.payments.map(p => [p.id, p]));
          serverPayments.forEach(p => byId.set(p.id, p));
          return { payments: Array.from(byId.values()) };
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to initialize accounting' });
    } finally {
      set({ isLoading: false });
    }
  }
}));
