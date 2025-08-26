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
  FixedAsset,
  DepreciationSchedule,
  CostCenter,
  Project,
  FinancialReport,
  AuditTrail,
  GHANA_CHART_OF_ACCOUNTS,
  GHANA_TAX_CODES
} from './models';

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
  
  // Invoices
  invoices: Invoice[];
  
  // Payments
  payments: Payment[];
  
  // Fixed Assets
  fixedAssets: FixedAsset[];
  depreciationSchedules: DepreciationSchedule[];
  
  // Cost Centers & Projects
  costCenters: CostCenter[];
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
  businessPartners: [],
  invoices: [],
  payments: [],
  fixedAssets: [],
  depreciationSchedules: [],
  costCenters: [],
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
  
  addBusinessPartner: (partner) => set((state) => ({
    businessPartners: [...state.businessPartners, partner]
  })),
  
  updateBusinessPartner: (id, updates) => set((state) => ({
    businessPartners: state.businessPartners.map(partner =>
      partner.id === id ? { ...partner, ...updates } : partner
    )
  })),
  
  deleteBusinessPartner: (id) => set((state) => ({
    businessPartners: state.businessPartners.filter(partner => partner.id !== id)
  })),

  // Invoices Actions
  setInvoices: (invoices) => set({ invoices: invoices }),
  
  addInvoice: (invoice) => set((state) => ({
    invoices: [...state.invoices, invoice]
  })),
  
  updateInvoice: (id, updates) => set((state) => ({
    invoices: state.invoices.map(invoice =>
      invoice.id === id ? { ...invoice, ...updates } : invoice
    )
  })),
  
  deleteInvoice: (id) => set((state) => ({
    invoices: state.invoices.filter(invoice => invoice.id !== id)
  })),
  
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
  
  addPayment: (payment) => set((state) => ({
    payments: [...state.payments, payment]
  })),
  
  updatePayment: (id, updates) => set((state) => ({
    payments: state.payments.map(payment =>
      payment.id === id ? { ...payment, ...updates } : payment
    )
  })),
  
  deletePayment: (id) => set((state) => ({
    payments: state.payments.filter(payment => payment.id !== id)
  })),
  
  postPayment: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      set((state) => ({
        payments: state.payments.map(payment =>
          payment.id === id ? { ...payment, status: 'Posted' } : payment
        )
      }));
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Calculate depreciation logic here
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
    // Mock implementation for trial balance
    return [
      {
        accountCode: '1000',
        accountName: 'Cash and Cash Equivalents',
        type: 'Asset',
        debitBalance: 150000.00,
        creditBalance: 0.00
      },
      {
        accountCode: '1100',
        accountName: 'Accounts Receivable',
        type: 'Asset',
        debitBalance: 75000.00,
        creditBalance: 0.00
      },
      {
        accountCode: '2000',
        accountName: 'Accounts Payable',
        type: 'Liability',
        debitBalance: 0.00,
        creditBalance: 120000.00
      },
      {
        accountCode: '3000',
        accountName: 'Retained Earnings',
        type: 'Equity',
        debitBalance: 0.00,
        creditBalance: 105000.00
      },
      {
        accountCode: '4000',
        accountName: 'Revenue',
        type: 'Revenue',
        debitBalance: 0.00,
        creditBalance: 150000.00
      },
      {
        accountCode: '5000',
        accountName: 'Expenses',
        type: 'Expense',
        debitBalance: 120000.00,
        creditBalance: 0.00
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
      const accounts: ChartOfAccounts[] = GHANA_CHART_OF_ACCOUNTS.map((account, index) => ({
        id: (index + 1).toString(),
        code: account.code,
        name: account.name,
        type: account.type,
        category: account.category,
        level: account.level,
        currency: 'GHS',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
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
              accountCode: '1100',
              accountName: 'Accounts Receivable',
              description: 'Guest receivable',
              debit: 1500.00,
              credit: 0.00
            },
            {
              id: '2',
              accountCode: '4000',
              accountName: 'Revenue',
              description: 'Room revenue',
              debit: 0.00,
              credit: 1500.00
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
               glAccountCode: '4100'
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
      
      set({
        chartOfAccounts: accounts,
        taxConfigs,
        financialPeriods: [currentPeriod],
        currentFinancialPeriod: currentPeriod,
        currentPeriod: currentDate.toISOString().slice(0, 7),
        journalEntries: sampleJournalEntries,
        invoices: sampleInvoices,
        payments: samplePayments
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to initialize accounting' });
    } finally {
      set({ isLoading: false });
    }
  }
}));
