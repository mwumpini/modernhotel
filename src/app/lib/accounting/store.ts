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
  InvoiceLine,
  Payment,
  PaymentVoucher,
  PaymentVoucherLine,
  FixedAsset,
  DepreciationSchedule,
  CostCenter,
  RevenueCenter,
  Project,
  FinancialReport,
  AuditTrail,
  GHANA_CHART_OF_ACCOUNTS,
  GHANA_TAX_CODES
} from './models';
import type { Supplier } from '../inventory/models';

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
  
  // Fixed Assets
  fixedAssets: FixedAsset[];
  depreciationSchedules: DepreciationSchedule[];
  
  // Cost Centers & Projects
  costCenters: CostCenter[];
  revenueCenters: RevenueCenter[];
  projects: Project[];
  
  // Reports
  financialReports: FinancialReport[];
  
  // Audit Trail
  auditTrail: AuditTrail[];
  
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
  fixedAssets: [],
  depreciationSchedules: [],
  costCenters: [],
  revenueCenters: [],
  projects: [],
  financialReports: [],
  auditTrail: [],
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
  
  addJournalEntry: (entry) => set((state) => ({
    journalEntries: [...state.journalEntries, entry]
  })),
  
  updateJournalEntry: (id, updates) => set((state) => ({
    journalEntries: state.journalEntries.map(entry =>
      entry.id === id ? { ...entry, ...updates } : entry
    )
  })),
  
  deleteJournalEntry: (id) => set((state) => ({
    journalEntries: state.journalEntries.filter(entry => entry.id !== id)
  })),
  
  setCurrentJournalEntry: (entry) => set({ currentJournalEntry: entry }),
  
  postJournalEntry: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      set((state) => ({
        journalEntries: state.journalEntries.map(entry =>
          entry.id === id 
            ? { 
                ...entry, 
                status: 'Posted',
                postedAt: new Date().toISOString(),
                postedBy: 'current-user'
              }
            : entry
        )
      }));
      
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
  
  addInvoice: (invoice) => set((state) => {
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
    return {
      businessPartners: updatedPartners,
    invoices: [...state.invoices, invoice]
    };
  }),
  
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
    return {
      businessPartners: partners,
    invoices: state.invoices.filter(invoice => invoice.id !== id)
    };
  }),
  
  postInvoice: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      set((state) => ({
        invoices: state.invoices.map(invoice =>
          invoice.id === id ? { ...invoice, status: 'Posted' } : invoice
        )
      }));
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
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to void invoice' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Payments Actions
  setPayments: (payments) => set({ payments: payments }),
  
  addPayment: (payment) => set((state) => {
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
    return {
      businessPartners: updatedPartners,
    payments: [...state.payments, payment]
    };
  }),
  
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      const state = get();
      const payment = state.payments.find(p => p.id === id);
      if (!payment) throw new Error('Payment not found');

      const partner = state.businessPartners.find(bp => bp.id === payment.businessPartnerId);
      if (!partner) throw new Error('Business partner not found');

      // Determine cash/bank account code
      let cashOrBankGl = '1110'; // Cash in Hand default
      let bankCurrency = state.currentPeriod ? 'GHS' : 'GHS';
      if (payment.paymentMethod !== 'Cash' && payment.bankAccountId) {
        const bank = state.bankAccounts.find(b => b.id === payment.bankAccountId);
        if (bank) {
          cashOrBankGl = bank.glAccountCode;
          bankCurrency = bank.currency;
        }
      }

      // Build journal lines: Debit AP, Credit Cash/Bank for supplier payment
      const debitLine = {
        id: Date.now().toString() + Math.random(),
        journalEntryId: '',
        accountCode: partner.glAccountCode,
        description: payment.description || `Payment to ${partner.name}`,
        debit: payment.amount,
        credit: 0,
        currency: payment.currency || 'GHS',
        reference: payment.reference
      } as JournalEntryLine;

      const creditLine = {
        id: Date.now().toString() + Math.random(),
        journalEntryId: '',
        accountCode: cashOrBankGl,
        description: payment.description || `Payment to ${partner.name}`,
        debit: 0,
        credit: payment.amount,
        currency: payment.currency || bankCurrency,
        reference: payment.reference
      } as JournalEntryLine;

      const entryNumber = `JE-${new Date().getFullYear()}-${String(state.journalEntries.length + 1).padStart(4, '0')}`;
      const journalEntry: JournalEntry = {
        id: Date.now().toString(),
        entryNumber,
        date: payment.date,
        reference: payment.paymentNumber,
        description: `Supplier Payment ${payment.paymentNumber} - ${partner.name}`,
        totalDebit: payment.amount,
        totalCredit: payment.amount,
        currency: payment.currency,
        status: 'Posted',
        postedBy: 'current-user',
        postedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lines: [debitLine, creditLine]
      };

      // Update state: mark payment posted, link JE, add JE
      set((s) => ({
        payments: s.payments.map(pm => pm.id === id ? { ...pm, status: 'Posted', journalEntryId: journalEntry.id, updatedAt: new Date().toISOString() } : pm),
        journalEntries: [...s.journalEntries, journalEntry]
      }));

      // Update GL balances
      get().updateGLBalance(debitLine.accountCode, state.currentPeriod, { currentDebit: debitLine.debit, currentCredit: 0 });
      get().updateGLBalance(creditLine.accountCode, state.currentPeriod, { currentDebit: 0, currentCredit: creditLine.credit });

      // Bank transaction & balance if bank account provided
      if (payment.bankAccountId) {
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
            journalEntryId: journalEntry.id,
            createdAt: new Date().toISOString()
          });
        }
      }

      // Audit trail
      get().addAuditTrail({
        id: Date.now().toString(),
        tableName: 'Payment',
        recordId: id,
        action: 'Post',
        newValues: { status: 'Posted', journalEntryId: journalEntry.id },
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
        fixedAssets: prev.fixedAssets.map(a => a.id === asset.id ? { ...a, accumulatedDepreciation: newAccumulated, netBookValue: newNBV } : a)
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      set((state) => ({
        depreciationSchedules: state.depreciationSchedules.map(schedule =>
          schedule.id === scheduleId ? { ...schedule, isPosted: true } : schedule
        )
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to post depreciation' });
    } finally {
      set({ isLoading: false });
    }
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

  // Helper functions to track costs and revenue
  recordExpense: (costCenterCode, amount) => set((state) => {
    const center = state.costCenters.find(cc => cc.code === costCenterCode);
    if (center) {
      return {
        costCenters: state.costCenters.map(cc =>
          cc.id === center.id
            ? { ...cc, actualExpenses: cc.actualExpenses + amount, updatedAt: new Date().toISOString() }
            : cc
        )
      };
    }
    return state;
  }),

  recordRevenue: (revenueCenterCode, amount) => set((state) => {
    const center = state.revenueCenters.find(rc => rc.code === revenueCenterCode);
    if (center) {
      return {
        revenueCenters: state.revenueCenters.map(rc =>
          rc.id === center.id
            ? { ...rc, actualRevenue: rc.actualRevenue + amount, updatedAt: new Date().toISOString() }
            : rc
        )
      };
    }
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
    const targetPeriod = period || get().currentPeriod;
    // Mock implementation for trial balance
    return [
      {
        id: 'tb-1000',
        accountCode: '1000',
        period: targetPeriod,
        openingBalance: 0,
        currentDebit: 150000.00,
        currentCredit: 0.00,
        closingBalance: 150000.00,
        currency: 'GHS',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'tb-1100',
        accountCode: '1100',
        period: targetPeriod,
        openingBalance: 0,
        currentDebit: 75000.00,
        currentCredit: 0.00,
        closingBalance: 75000.00,
        currency: 'GHS',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'tb-2000',
        accountCode: '2000',
        period: targetPeriod,
        openingBalance: 0,
        currentDebit: 0.00,
        currentCredit: 120000.00,
        closingBalance: -120000.00,
        currency: 'GHS',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'tb-3000',
        accountCode: '3000',
        period: targetPeriod,
        openingBalance: 0,
        currentDebit: 0.00,
        currentCredit: 50000.00,
        closingBalance: -50000.00,
        currency: 'GHS',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'tb-4000',
        accountCode: '4000',
        period: targetPeriod,
        openingBalance: 0,
        currentDebit: 0.00,
        currentCredit: 250000.00,
        closingBalance: -250000.00,
        currency: 'GHS',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'tb-5000',
        accountCode: '5000',
        period: targetPeriod,
        openingBalance: 0,
        currentDebit: 120000.00,
        currentCredit: 0.00,
        closingBalance: 120000.00,
        currency: 'GHS',
        lastUpdated: new Date().toISOString()
      }
    ];
  },
  
  getIncomeStatement: (period) => {
    // Mock implementation for income statement
    return {
      totalRevenue: 150000.00,
      totalExpenses: 120000.00,
      netIncome: 30000.00,
      grossProfit: 45000.00,
      operatingExpenses: 75000.00
    };
  },
  
  getBalanceSheet: (period) => {
    // Mock implementation for balance sheet
    return {
      currentAssets: 250000.00,
      fixedAssets: 500000.00,
      totalAssets: 750000.00,
      currentLiabilities: 150000.00,
      longTermLiabilities: 200000.00,
      totalLiabilities: 350000.00,
      totalEquity: 400000.00,
      totalLiabilitiesAndEquity: 750000.00
    };
  },
  
  getCashFlow: (period) => {
    // Mock implementation for cash flow
    return {
      operatingCashFlow: 35000.00,
      investingCashFlow: -50000.00,
      financingCashFlow: 15000.00,
      netCashFlow: 0.00
    };
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
      
      // Initialize tax configurations
      const taxConfigs: TaxConfig[] = Object.values(GHANA_TAX_CODES).map((tax, index) => ({
        id: (index + 1).toString(),
        code: tax.code,
        name: tax.name,
        rate: tax.rate,
        type: tax.code as any,
        glAccountCode: tax.glCode,
        isRecoverable: true,
        isActive: true,
        effectiveFrom: new Date().toISOString(),
        countryCode: 'GH',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
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

             // Initialize sample invoices
       const sampleInvoices: Invoice[] = [
         {
           id: '1',
           invoiceNumber: 'INV-2024-001',
           type: 'Sales',
           date: new Date().toISOString(),
           dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
           businessPartnerId: '1',
           description: 'Room booking payment',
           subtotal: 1300.00,
           taxAmount: 195.00,
           total: 1495.00,
           currency: 'GHS',
           status: 'Paid',
           paidAmount: 1495.00,
           paidDate: new Date().toISOString(),
           createdAt: new Date().toISOString(),
           updatedAt: new Date().toISOString(),
           lines: [
             {
               id: '1',
               invoiceId: '1',
               description: 'Deluxe Room',
               quantity: 1,
               unitPrice: 1300.00,
               amount: 1300.00,
               taxAmount: 195.00,
              glAccountCode: '4100',
              taxCode: 'VAT'
             }
           ]
         }
       ];

             // Initialize sample payments
       const samplePayments: Payment[] = [
         {
           id: '1',
           paymentNumber: 'PAY-2024-001',
           date: new Date().toISOString(),
           type: 'Receipt',
           businessPartnerId: '1',
           invoiceId: '1',
           reference: 'MTN-123456',
           description: 'Mobile money payment',
           amount: 1495.00,
           currency: 'GHS',
           paymentMethod: 'Mobile Money',
           status: 'Posted',
           createdAt: new Date().toISOString(),
           updatedAt: new Date().toISOString()
         }
       ];

      // Initialize sample business partners
      const samplePartners: BusinessPartner[] = [
        {
          id: '1',
          code: 'CUST-001',
          name: 'Corporate Client',
          type: 'Customer',
          taxNumber: 'TIN-0001',
          address: 'Accra',
          phone: '+233 200 000 001',
          email: 'accounts@corp.com',
          contactPerson: 'Finance',
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
        {
          id: '2',
          code: 'SUP-001',
          name: 'Local Supplier',
          type: 'Supplier',
          taxNumber: 'TIN-1001',
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
          depreciationRate: 0,
          accumulatedDepreciation: 10000,
          netBookValue: 40000,
          status: 'Active',
          glAccountCode: '1500',
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
      
      set({
        chartOfAccounts: accounts,
        taxConfigs,
        financialPeriods: [currentPeriod],
        currentFinancialPeriod: currentPeriod,
        currentPeriod: currentDate.toISOString().slice(0, 7),
        journalEntries: sampleJournalEntries,
        invoices: sampleInvoices,
        payments: samplePayments,
        businessPartners: samplePartners,
        bankAccounts: sampleBankAccounts,
        bankTransactions: sampleBankTxns,
        fixedAssets: sampleAssets,
        depreciationSchedules: sampleDepSchedules,
        costCenters: sampleCostCenters,
        revenueCenters: sampleRevenueCenters,
        auditTrail: sampleAudit
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to initialize accounting' });
    } finally {
      set({ isLoading: false });
    }
  }
}));
