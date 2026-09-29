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
  CostCenter,
  RevenueCenter,
  Project,
  FinancialReport,
  AuditTrail,
  WHTCertificate,
} from './models';
import type { Supplier } from '../inventory/models';
import {
  computeTrialBalanceGLBalances,
  computeIncomeStatementFromJE,
  computeCashFlowForPeriod,
  defaultRollupCoa,
} from './jeDrivenReports';
import { bootstrapTaxConfigsForCountry, roundMoney2 } from './taxFromConfig';
import { getWhtCertificateRates } from './whtRates';
import {
  mergeWhtCertificateLists,
  patchForWhtCertificatePayment,
  paymentWithWhtCertificateData,
  whtCertificatesFromPayments,
} from './whtCertificateSync';
import {
  collectDescendantIds,
  createCoaAccount,
  getCoaSiblings,
  normalizeCoaList,
  validateCoaTreeAccount,
} from './coaTree';
import type { CoaAccountType } from './models';
import { buildChartOfAccountsFromTemplate, resolveAccountingCountryCode, getChartTemplate } from './chartOfAccountsTemplates';
import { buildOperationalAccountingSeed, EMPTY_TRANSACTION_SEED } from './operationalSeed';
import { computeCostCenterActual, computeRevenueCenterActual } from './costRevenueRollup';
import { isAccountingDemoMode } from './tenantAccountingConfig';
import { persistJournalEntry, persistJournalEntryStatus, fetchJournalEntries, fetchAccountingAuditTrail, persistInvoice, persistInvoicePatch, persistInvoiceDelete, fetchInvoices, persistPayment, persistPaymentPatch, fetchPayments, persistChartOfAccount, persistChartOfAccountsBulk, persistChartOfAccountDelete, fetchChartOfAccounts, persistBankAccount, persistBankAccountDelete, fetchBankAccounts, persistCostCenter, persistCostCenterDelete, fetchCostCenters, persistRevenueCenter, persistRevenueCenterDelete, fetchRevenueCenters, persistBusinessPartner, persistBusinessPartnerDelete, fetchBusinessPartners, persistBankTransaction, persistBankTransactionDelete, fetchBankTransactions } from './helpers/api';
import { useSettingsStore } from '../settings/store';
import {
  syncInvoiceToLedger,
  syncPaymentToLedger,
  buildWHTClearingJournalEntry,
  buildAPWHTPayableJournalEntry,
  applyJournalEntryToGlBalances,
} from './invoicePostingBridge';
import { findJournalEntryForInvoice, MANUAL_AR_AP_SOURCE } from './accountingProcessPolicy';
import { isManualArApSource, postJournalEntryReversal } from './journalReversal';
import { isPettyCashAccount, resolveBankGlAccountCode } from './bankCoaLink';
import { syncBankOpeningBalanceToLedger } from './bankOpeningBalance';
import { mirrorGlCashToCashbook } from './cashbookMirror';
import { GL_ACCOUNTS, PAYMENT_GL_MAP } from './glAccounts';
import {
  createManualBankTransaction,
  reverseManualBankTransaction,
  type ManualBankTransactionInput,
} from './bankTransactionLedger';

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
  addCoaChild: (parentId: string | null, params: { name: string; type: CoaAccountType; code?: string }) => void;
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
  ensureBankGlAccount: (params: {
    accountName: string;
    bankName?: string;
    accountKind: 'bank' | 'petty_cash';
    createDedicatedGl?: boolean;
    preferredCode?: string;
  }) => string;
  
  // Bank Transactions
  setBankTransactions: (transactions: BankTransaction[]) => void;
  addBankTransaction: (transaction: BankTransaction) => void;
  updateBankTransaction: (id: string, updates: Partial<BankTransaction>) => void;
  deleteBankTransaction: (id: string) => void;
  reconcileBankTransaction: (id: string) => Promise<void>;
  createManualBankTransaction: (
    input: import('./bankTransactionLedger').ManualBankTransactionInput
  ) => { ok: true; transactionIds: string[] } | { ok: false; error: string };
  deleteManualBankTransaction: (id: string) => boolean;
  markBankTransactionCleared: (id: string) => void;
  markBankTransactionsReconciledForPeriod: (bankAccountId: string, periodEndDate: string) => number;
  
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
    paymentMethod: Payment['paymentMethod'];
    bankAccountId?: string;
    certificateNumber?: string;
    withholdingAgentTIN?: string;
    revenueCenterCode?: string;
    staffName?: string;
    staffId?: string;
  }) => { receiptId: string; whtCertificateId?: string } | null;
  receiveWHTCertificate: (
    id: string,
    params: { certificateNumber: string; withholdingAgentTIN?: string; receivedDate?: string },
  ) => boolean;
  getWHTCertificatesByInvoice: (invoiceId: string) => WHTCertificate[];
  getWHTCertificatesByStatus: (status: WHTCertificate['status']) => WHTCertificate[];
  getPendingWHTCertificates: () => WHTCertificate[];
  /** Records a supplier payment where WHT was withheld on a service invoice: a cash payment
   * to the supplier plus a linked GL entry moving the withheld portion into WHT Payable
   * (owed to GRA), mirroring recordWHTPayment's AR-side settlement pattern in reverse. */
  recordSupplierWHTPayment: (params: {
    invoiceId: string;
    cashAmount: number;
    whtAmount: number;
    whtVatAmount?: number;
    paymentMethod: Payment['paymentMethod'];
    bankAccountId?: string;
    reference?: string;
    postedBy?: string;
  }) => { paymentId: string } | null;
  
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
  costCenters: [],
  revenueCenters: [],
  projects: [],
  financialReports: [],
  auditTrail: [],
  isLoading: false,
  error: null,

  // Chart of Accounts Actions
  setChartOfAccounts: (accounts) => set({ chartOfAccounts: accounts }),
  
  addChartOfAccount: (account) => set((state) => {
    const withMeta: ChartOfAccounts = {
      ...account,
      parentId: account.parentId ?? null,
      position: account.position ?? getCoaSiblings(account.parentId ?? null, state.chartOfAccounts).length,
      updatedAt: new Date().toISOString(),
    };
    const draft = normalizeCoaList([...state.chartOfAccounts, withMeta]);
    const errors = validateCoaTreeAccount(withMeta, draft);
    if (errors.length > 0) return { error: errors.join('. ') };
    return { chartOfAccounts: draft, error: null };
  }),

  addCoaChild: (parentId, params) => {
    const state = get();
    try {
      const siblings = getCoaSiblings(parentId, state.chartOfAccounts);
      const created = createCoaAccount({
        name: params.name,
        type: params.type,
        parentId,
        position: siblings.length,
        existing: state.chartOfAccounts,
        code: params.code,
      });
      const errors = validateCoaTreeAccount(created, [...state.chartOfAccounts, created]);
      if (errors.length > 0) {
        set({ error: errors.join('. ') });
        return;
      }
      set({
        chartOfAccounts: normalizeCoaList([...state.chartOfAccounts, created]),
        error: null,
      });
      const parentCode = parentId ? state.chartOfAccounts.find((a) => a.id === parentId)?.code ?? null : null;
      persistChartOfAccount(created, parentCode);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Could not add account' });
    }
  },

  updateChartOfAccount: (id, updates) => {
    const state = get();
    const existing = state.chartOfAccounts.find((account) => account.id === id);
    if (!existing) return;
    const merged: ChartOfAccounts = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    const draft = state.chartOfAccounts.map((account) => (account.id === id ? merged : account));
    const errors = validateCoaTreeAccount(merged, draft);
    if (errors.length > 0) {
      set({ error: errors.join('. ') });
      return;
    }
    set({ chartOfAccounts: normalizeCoaList(draft), error: null });
    const parentCode = merged.parentId ? draft.find((a) => a.id === merged.parentId)?.code ?? null : null;
    persistChartOfAccount(merged, parentCode);
  },

  deleteChartOfAccount: (id) => {
    const state = get();
    const target = state.chartOfAccounts.find((account) => account.id === id);
    if (!target) return;
    const removeIds = new Set([id, ...collectDescendantIds(id, state.chartOfAccounts)]);
    const removeCodes = new Set(
      state.chartOfAccounts.filter((account) => removeIds.has(account.id)).map((account) => account.code),
    );

    // Many modules (PPE capitalization/disposal, Bank Reconciliation, Tax remittance, ...)
    // hardcode specific GL codes from the seeded chart and assume they always exist —
    // deleting one before it's ever been posted to would sail through the posted-activity
    // check below and silently break those postings the first time they run. Only accounts
    // added on top of the seeded template (this screen's own "+ Add") are deletable.
    const protectedCodes = new Set(getChartTemplate().rows.map((r) => r.code));
    const removingProtected = [...removeCodes].some((code) => protectedCodes.has(code));
    if (removingProtected) {
      set({
        error: 'Cannot delete: this is part of the standard chart of accounts that other modules (PPE, Bank Reconciliation, Tax, ...) rely on by code, even before it has any activity. Only accounts you added yourself can be deleted.',
      });
      return;
    }

    const hasPostedActivity = state.journalEntries.some(
      (entry) => entry.status === 'Posted' && entry.lines.some((line) => removeCodes.has(line.accountCode)),
    );
    if (hasPostedActivity) {
      set({
        error: 'Cannot delete: this account (or one of its sub-accounts) has posted journal entries. Reassign or void those entries first.',
      });
      return;
    }
    set({
      chartOfAccounts: state.chartOfAccounts.filter((account) => !removeIds.has(account.id)),
      error: null,
    });
    removeIds.forEach((removedId) => persistChartOfAccountDelete(removedId));
  },
  
  setSelectedAccount: (account) => set({ selectedAccount: account }),

  // Journal Entries Actions
  setJournalEntries: (entries) => set({ journalEntries: entries }),
  
  addJournalEntry: (entry) => set((state) => {
    if (state.journalEntries.some((e) => e.id === entry.id)) {
      console.warn(`[Accounting] Journal entry ${entry.id} already exists — skipping duplicate post`);
      return state;
    }

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
    const already = get().journalEntries.find(e => e.id === id);
    if (already && already.status === 'Posted') {
      console.warn(`[Accounting] Journal entry ${id} is already Posted — skipping duplicate post`);
      return;
    }
    set({ isLoading: true, error: null });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Re-check after the artificial delay — a concurrent call may have posted this
      // entry (and applied its GL balances) while this call was "in flight".
      if (get().journalEntries.find(e => e.id === id)?.status === 'Posted') {
        console.warn(`[Accounting] Journal entry ${id} was posted by a concurrent call — skipping duplicate post`);
        set({ isLoading: false });
        return;
      }

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

      // The server is authoritative on whether this actually posted or was
      // parked for director approval (see approvalThresholds.ts) — GL balance
      // updates below must only run once that's confirmed, not on the
      // optimistic local 'Posted' set above. Awaiting here (rather than the
      // old fire-and-forget + onResult-callback correction) means an entry
      // the server downgrades to 'Pending Approval' never gets its GL
      // balances applied in the first place, instead of applying them and
      // only fixing the status label afterward.
      let serverEntry: { status: string } | null = null;
      try {
        serverEntry = await persistJournalEntryStatus(id, { status: 'Posted', postedAt, postedBy: 'current-user' });
      } catch (e) {
        console.warn(`[Accounting] Failed to persist journal entry ${id} post:`, e);
      }

      if (!serverEntry || serverEntry.status !== 'Posted') {
        set((state) => ({
          journalEntries: state.journalEntries.map(e =>
            e.id === id
              ? {
                  ...e,
                  status: (serverEntry?.status as any) ?? e.status,
                  postedAt: serverEntry ? undefined : e.postedAt,
                  postedBy: serverEntry ? undefined : e.postedBy,
                }
              : e
          ),
        }));
        if (!serverEntry) set({ error: 'Could not confirm the post with the server — please retry.' });
        return;
      }

      // Update GL balances — only reached once the server confirmed 'Posted'.
      const entry = get().journalEntries.find(e => e.id === id);
      if (entry) {
        entry.lines.forEach(line => {
          get().updateGLBalance(line.accountCode, get().currentPeriod, {
            currentDebit: line.debit,
            currentCredit: line.credit
          });
        });
        get().addAuditTrail({
          id: `AT-JEPOST-${Date.now()}`,
          tableName: 'JournalEntry',
          recordId: id,
          action: 'Post',
          newValues: { entryNumber: entry.entryNumber, totalDebit: entry.totalDebit, totalCredit: entry.totalCredit },
          userId: 'current-user',
          timestamp: postedAt,
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
      const original = get().journalEntries.find(e => e.id === id);
      const rev = postJournalEntryReversal(id, get(), {
        postedBy: 'current-user',
        reason: 'Manual journal void',
        persistEntry: persistJournalEntry,
        markOriginalVoid: (entryId) => {
          set((state) => ({
            journalEntries: state.journalEntries.map((entry) =>
              entry.id === entryId
                ? { ...entry, status: 'Void' as const, updatedAt: new Date().toISOString() }
                : entry,
            ),
          }));
          persistJournalEntryStatus(entryId, { status: 'Void' });
        },
      });
      if (!rev.ok) throw new Error(rev.error);
      get().addAuditTrail({
        id: `AT-JEVOID-${Date.now()}`,
        tableName: 'JournalEntry',
        recordId: id,
        action: 'Void',
        oldValues: original ? { entryNumber: original.entryNumber, status: original.status } : undefined,
        userId: 'current-user',
        timestamp: new Date().toISOString(),
      });
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
  
  addBankAccount: (account) => {
    const normalized: BankAccount = {
      ...account,
      openingBalance: account.openingBalance ?? 0,
      currentBalance: account.currentBalance ?? account.openingBalance ?? 0,
    };
    set((state) => ({
      bankAccounts: [...state.bankAccounts, normalized],
    }));
    persistBankAccount(normalized);
    syncBankOpeningBalanceToLedger(normalized, get());
  },

  updateBankAccount: (id, updates) => {
    set((state) => ({
      bankAccounts: state.bankAccounts.map((account) =>
        account.id === id ? { ...account, ...updates } : account
      ),
    }));
    const account = get().bankAccounts.find((a) => a.id === id);
    if (account) persistBankAccount(account);
    if (
      updates.openingBalance !== undefined ||
      updates.glAccountCode !== undefined ||
      updates.openingBalanceType !== undefined
    ) {
      if (account) syncBankOpeningBalanceToLedger(account, get());
    }
  },

  deleteBankAccount: (id) => {
    set((state) => ({
      bankAccounts: state.bankAccounts.filter(account => account.id !== id)
    }));
    persistBankAccountDelete(id);
  },

  ensureBankGlAccount: (params) => {
    const state = get();
    const accountKind =
      params.accountKind ??
      (isPettyCashAccount(params.accountName, params.bankName) ? 'petty_cash' : 'bank');
    return resolveBankGlAccountCode({
      chart: state.chartOfAccounts,
      accountName: params.accountName,
      bankName: params.bankName,
      accountKind,
      createDedicatedGl: params.createDedicatedGl ?? accountKind === 'bank',
      preferredCode: params.preferredCode,
      addCoaChild: (parentId, child) => get().addCoaChild(parentId, child),
      getChart: () => get().chartOfAccounts,
    });
  },

  // Bank Transactions Actions
  setBankTransactions: (transactions) => set({ bankTransactions: transactions }),
  
  addBankTransaction: (transaction) => {
    set((state) => ({
      bankTransactions: [...state.bankTransactions, transaction]
    }));
    persistBankTransaction(transaction);
  },

  updateBankTransaction: (id, updates) => {
    let updated: BankTransaction | undefined;
    set((state) => ({
      bankTransactions: state.bankTransactions.map(transaction => {
        if (transaction.id !== id) return transaction;
        updated = { ...transaction, ...updates };
        return updated;
      })
    }));
    if (updated) persistBankTransaction(updated);
  },

  deleteBankTransaction: (id) => {
    set((state) => ({
      bankTransactions: state.bankTransactions.filter(transaction => transaction.id !== id)
    }));
    persistBankTransactionDelete(id);
  },

  reconcileBankTransaction: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      let updated: BankTransaction | undefined;
      set((state) => ({
        bankTransactions: state.bankTransactions.map(transaction => {
          if (transaction.id !== id) return transaction;
          updated = {
            ...transaction,
            status: 'Reconciled',
            reconciledAt: new Date().toISOString(),
            reconciledBy: 'current-user'
          };
          return updated;
        })
      }));
      if (updated) persistBankTransaction(updated);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to reconcile transaction' });
    } finally {
      set({ isLoading: false });
    }
  },

  createManualBankTransaction: (input) => {
    const result = createManualBankTransaction(input, get());
    if (!result.ok) {
      set({ error: result.error });
      return result;
    }
    set({ error: null });
    return result;
  },

  deleteManualBankTransaction: (id) => {
    const state = get();
    const txn = state.bankTransactions.find((t) => t.id === id);
    if (!txn) {
      set({ error: 'Transaction not found' });
      return false;
    }
    if (txn.status === 'Reconciled') {
      set({ error: 'Cannot delete a reconciled transaction' });
      return false;
    }

    let primary = txn;
    if (txn.type === 'Transfer' && txn.linkedTransactionId) {
      const linked = state.bankTransactions.find((t) => t.id === txn.linkedTransactionId);
      if (linked && txn.transferToAccountId === linked.bankAccountId) {
        primary = txn;
      } else if (linked) {
        primary = linked;
      }
    }

    const reversed = reverseManualBankTransaction(primary, get());
    if (!reversed.ok) {
      set({ error: reversed.error });
      return false;
    }

    const removeIds = new Set<string>([primary.id]);
    if (primary.linkedTransactionId) removeIds.add(primary.linkedTransactionId);

    set((s) => ({
      bankTransactions: s.bankTransactions.filter((t) => !removeIds.has(t.id)),
      error: null,
    }));
    removeIds.forEach((removeId) => persistBankTransactionDelete(removeId));
    return true;
  },

  markBankTransactionCleared: (id) => {
    let updated: BankTransaction | undefined;
    set((state) => ({
      bankTransactions: state.bankTransactions.map((t) => {
        if (t.id !== id || t.status !== 'Pending') return t;
        updated = { ...t, status: 'Cleared' as const };
        return updated;
      }),
    }));
    if (updated) persistBankTransaction(updated);
  },

  markBankTransactionsReconciledForPeriod: (bankAccountId, periodEndDate) => {
    const end = new Date(periodEndDate);
    end.setHours(23, 59, 59, 999);
    const now = new Date().toISOString();
    // Only transactions already matched against the statement (Cleared) graduate to Reconciled
    // when a reconciliation is completed — a still-Pending transaction was never confirmed
    // against the bank statement and must not be silently stamped Reconciled.
    const ids = new Set(
      get()
        .bankTransactions.filter(
          (t) =>
            t.bankAccountId === bankAccountId &&
            t.status === 'Cleared' &&
            new Date(t.transactionDate) <= end
        )
        .map((t) => t.id)
    );
    if (!ids.size) return 0;
    const updatedTxns: BankTransaction[] = [];
    set((state) => ({
      bankTransactions: state.bankTransactions.map((t) => {
        if (!ids.has(t.id)) return t;
        const updated: BankTransaction = {
          ...t,
          status: 'Reconciled' as const,
          reconciledAt: now,
          reconciledBy: 'bank-reconciliation',
        };
        updatedTxns.push(updated);
        return updated;
      }),
    }));
    updatedTxns.forEach((t) => persistBankTransaction(t));
    return ids.size;
  },

  // Business Partners Actions
  setBusinessPartners: (partners) => set({ businessPartners: partners }),
  
  addBusinessPartner: (partner) => {
    set((state) => ({
    businessPartners: [...state.businessPartners, partner]
    }));
    persistBusinessPartner(partner);

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
      if (updatedPartner) persistBusinessPartner(updatedPartner);

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
    persistBusinessPartnerDelete(id);
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
    if (get().invoices.some((i) => i.id === invoice.id)) {
      console.warn(`[Accounting] Invoice ${invoice.id} already exists — skipping duplicate`);
      return;
    }

    const normalized = {
      ...invoice,
      dueDate: invoice.dueDate || invoice.date || new Date().toISOString(),
    };

    set((state) => {
      console.log(`[Accounting] 📄 Invoice Created:`, {
        invoiceNumber: normalized.invoiceNumber || normalized.id,
        type: normalized.type,
        customer: normalized.businessPartnerId,
        subtotal: `GHS ${(normalized.subtotal || 0).toLocaleString()}`,
        tax: `GHS ${(normalized.taxAmount || 0).toLocaleString()}`,
        total: `GHS ${(normalized.total || 0).toLocaleString()}`,
        status: normalized.status,
        dueDate: normalized.dueDate,
        source: (normalized as any).sourceModule || 'manual',
        timestamp: new Date().toISOString()
      });

      const updatedPartners = state.businessPartners.map(p => {
        if (p.id !== normalized.businessPartnerId) return p;
        if (normalized.isProforma) return p;
        if (normalized.type === 'Purchase' && (p.type === 'Supplier' || p.type === 'Both')) {
          return { ...p, balance: +(p.balance + normalized.total).toFixed(2) };
        }
        if (normalized.type === 'Sales' && (p.type === 'Customer' || p.type === 'Both')) {
          return { ...p, balance: +(p.balance + normalized.total).toFixed(2) };
        }
        return p;
      });
      persistInvoice(normalized);
      return {
        businessPartners: updatedPartners,
        invoices: [...state.invoices, normalized]
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
      const state = get();
      const invoice = state.invoices.find((i) => i.id === id);
      if (!invoice) throw new Error('Invoice not found');
      if (invoice.status === 'Void') return;

      const activePayments = state.payments.filter(
        (p) => p.invoiceId === id && p.status !== 'Void',
      );
      if (activePayments.length > 0) {
        throw new Error('Void all receipts and WHT payments on this invoice before voiding the invoice');
      }
      if ((invoice.paidAmount || 0) > 0.01) {
        throw new Error('Invoice still shows amounts paid — void linked receipts first');
      }

      if (isManualArApSource(invoice.sourceModule)) {
        const originalJe =
          (invoice.journalEntryId
            ? state.journalEntries.find((e) => e.id === invoice.journalEntryId)
            : undefined) || findJournalEntryForInvoice(invoice, state.journalEntries);
        if (originalJe?.status === 'Posted') {
          const rev = postJournalEntryReversal(originalJe.id, get(), {
            postedBy: 'current-user',
            reason: `Void invoice ${invoice.invoiceNumber}`,
            persistEntry: persistJournalEntry,
            markOriginalVoid: (entryId) => {
              set((s) => ({
                journalEntries: s.journalEntries.map((e) =>
                  e.id === entryId
                    ? { ...e, status: 'Void' as const, updatedAt: new Date().toISOString() }
                    : e,
                ),
              }));
              persistJournalEntryStatus(entryId, { status: 'Void' });
            },
          });
          if (!rev.ok) throw new Error(rev.error);
        }
      }

      const checkoutSales = state.journalEntries.find(
        (e) => e.id === `JE-FO-CHK-${invoice.id}` && e.status === 'Posted',
      );
      if (checkoutSales) {
        const voidedAt = new Date().toISOString();
        set((s) => ({
          journalEntries: s.journalEntries.map((e) =>
            e.id === checkoutSales.id ? { ...e, status: 'Void' as const, updatedAt: voidedAt } : e,
          ),
        }));
        persistJournalEntryStatus(checkoutSales.id, { status: 'Void' });
      }

      const now = new Date().toISOString();
      const openAmount = roundMoney2(invoice.total - (invoice.paidAmount || 0));

      set((s) => ({
        invoices: s.invoices.map((inv) =>
          inv.id === id ? { ...inv, status: 'Void' as const, updatedAt: now } : inv,
        ),
        businessPartners: s.businessPartners.map((p) => {
          if (p.id !== invoice.businessPartnerId || openAmount <= 0) return p;
          if (invoice.type === 'Sales' && (p.type === 'Customer' || p.type === 'Both')) {
            return { ...p, balance: roundMoney2(p.balance - openAmount) };
          }
          if (invoice.type === 'Purchase' && (p.type === 'Supplier' || p.type === 'Both')) {
            return { ...p, balance: roundMoney2(p.balance - openAmount) };
          }
          return p;
        }),
      }));

      persistInvoicePatch(id, { status: 'Void', updatedAt: now });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to void invoice' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Payments Actions
  setPayments: (payments) => set({ payments: payments }),
  
  addPayment: (payment) => {
    if (get().payments.some((p) => p.id === payment.id)) {
      console.warn(`[Accounting] Payment ${payment.id} already exists — skipping duplicate`);
      return;
    }

    let invoiceIdToPatch: string | undefined;
    let invoicePatch: Partial<Invoice> | undefined;

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

      // Update invoice.paidAmount when a payment targets a specific invoice
      let updatedInvoices = state.invoices;
      if (payment.invoiceId) {
        const now = new Date().toISOString();
        updatedInvoices = state.invoices.map(inv => {
          if (inv.id !== payment.invoiceId) return inv;
          const newPaid = +((inv.paidAmount || 0) + payment.amount).toFixed(2);
          const newStatus = newPaid >= inv.total ? 'Paid' : inv.status === 'Paid' ? 'Posted' : inv.status;
          invoiceIdToPatch = inv.id;
          invoicePatch = {
            paidAmount: newPaid,
            status: newStatus as Invoice['status'],
            paidDate: newStatus === 'Paid' ? now : inv.paidDate,
            updatedAt: now,
          };
          return {
            ...inv,
            paidAmount: newPaid,
            status: newStatus as any,
            paidDate: newStatus === 'Paid' ? now : inv.paidDate,
            updatedAt: now,
          };
        });
      }

      persistPayment(payment);
      return {
        businessPartners: updatedPartners,
        invoices: updatedInvoices,
        payments: [...state.payments, payment]
      };
    });

    if (invoiceIdToPatch && invoicePatch) {
      persistInvoicePatch(invoiceIdToPatch, invoicePatch);
    }

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

      // 'Pending Approval' is included here (not just 'Draft') so a director can
      // re-run the same "post" action on a payment the server previously parked
      // for approval — see approvalThresholds.ts, which this time will actually
      // grant it now that the caller has accounting.approve-payment.
      if (payment.status === 'Draft' || payment.status === 'Pending Approval') {
        set((s) => ({
          payments: s.payments.map(pm =>
            pm.id === id ? { ...pm, status: 'Posted' as const, updatedAt: new Date().toISOString() } : pm
          )
        }));

        // The server is authoritative on whether this actually posted or was
        // parked for director approval — the ledger sync and bank-balance
        // update below must only run once that's confirmed, not on the
        // optimistic local 'Posted' set above. Awaiting here (rather than the
        // old fire-and-forget + onResult-callback correction) means a payment
        // the server downgrades to 'Pending Approval' never gets a journal
        // entry created or its bank balance decremented in the first place.
        let serverPayment: { status: string } | null = null;
        try {
          serverPayment = await persistPaymentPatch(id, { status: 'Posted' });
        } catch (e) {
          console.warn(`[Accounting] Failed to persist payment ${id} post:`, e);
        }

        if (!serverPayment || serverPayment.status !== 'Posted') {
          set((s) => ({
            payments: s.payments.map(pm => pm.id === id ? { ...pm, status: (serverPayment?.status as any) ?? pm.status } : pm),
          }));
          if (!serverPayment) set({ error: 'Could not confirm the post with the server — please retry.' });
          return;
        }
      }

      const refreshed = get().payments.find(p => p.id === id)!;
      const result = syncPaymentToLedger(refreshed, partner, get());
      if (!result.ok && !('skipped' in result)) {
        throw new Error(result.error);
      }

      if (result.ok && !('skipped' in result) && payment.type === 'Receipt' && !payment.bankAccountId) {
        const methodGl = PAYMENT_GL_MAP[payment.paymentMethod] || GL_ACCOUNTS.CASH;
        mirrorGlCashToCashbook(() => get(), {
          glCode: methodGl,
          amount: payment.amount,
          direction: 'in',
          date: payment.date,
          reference: payment.reference || payment.paymentNumber,
          description: payment.description || `Receipt ${payment.paymentNumber}`,
          journalEntryId: result.entry.id,
        });
      }

      if (result.ok && !('skipped' in result) && payment.type === 'Receipt' && payment.bankAccountId) {
        const bank = get().bankAccounts.find(b => b.id === payment.bankAccountId);
        if (bank && !get().bankTransactions.some((t) => t.journalEntryId === result.entry.id && t.bankAccountId === bank.id)) {
          const newBalance = +(bank.currentBalance + payment.amount).toFixed(2);
          get().updateBankAccount(bank.id, { currentBalance: newBalance, updatedAt: new Date().toISOString() });
          get().addBankTransaction({
            id: `BT-${result.entry.id}`,
            bankAccountId: bank.id,
            transactionDate: payment.date,
            reference: payment.reference || payment.paymentNumber,
            description: payment.description || `Receipt ${payment.paymentNumber}`,
            amount: payment.amount,
            type: 'Deposit',
            currency: bank.currency,
            balance: newBalance,
            status: 'Cleared',
            journalEntryId: result.entry.id,
            createdAt: new Date().toISOString()
          });
        }
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
      const state = get();
      const payment = state.payments.find((p) => p.id === id);
      if (!payment) throw new Error('Payment not found');
      if (payment.status === 'Void') return;

      if (isManualArApSource(payment.sourceModule)) {
        const entryId = payment.journalEntryId;
        if (entryId) {
          const originalJe = state.journalEntries.find((e) => e.id === entryId);
          if (originalJe?.status === 'Posted') {
            const rev = postJournalEntryReversal(entryId, get(), {
              postedBy: 'current-user',
              reason: `Void ${payment.type.toLowerCase()} ${payment.paymentNumber}`,
              persistEntry: persistJournalEntry,
              markOriginalVoid: (jeId) => {
                set((s) => ({
                  journalEntries: s.journalEntries.map((e) =>
                    e.id === jeId
                      ? { ...e, status: 'Void' as const, updatedAt: new Date().toISOString() }
                      : e,
                  ),
                }));
                persistJournalEntryStatus(jeId, { status: 'Void' });
              },
            });
            if (!rev.ok) throw new Error(rev.error);
          }
        }
      }

      const now = new Date().toISOString();
      let invoiceIdToPatch: string | undefined;
      let invoicePatch: Partial<Invoice> | undefined;

      set((s) => {
        let invoices = s.invoices;
        let whtCertificates = s.whtCertificates;

        if (payment.invoiceId) {
          invoices = s.invoices.map((inv) => {
            if (inv.id !== payment.invoiceId) return inv;
            const newPaid = roundMoney2(Math.max(0, (inv.paidAmount || 0) - payment.amount));
            const newStatus =
              newPaid >= inv.total
                ? 'Paid'
                : newPaid > 0
                  ? inv.status === 'Void'
                    ? 'Void'
                    : 'Posted'
                  : inv.status === 'Paid'
                    ? 'Posted'
                    : inv.status;

            let whtReceived = inv.whtReceived || 0;
            let whtVatReceived = inv.whtVatReceived || 0;
            if (payment.isWHTCertificate) {
              whtReceived = roundMoney2(Math.max(0, whtReceived - (payment.whtAmount || 0)));
              whtVatReceived = roundMoney2(Math.max(0, whtVatReceived - (payment.whtVatAmount || 0)));
            }

            const pendingCert = s.whtCertificates.some(
              (c) =>
                c.invoiceId === inv.id &&
                c.status === 'Pending' &&
                c.id !== payment.whtCertificateId,
            );
            let whtStatus = inv.whtStatus;
            if (payment.isWHTCertificate) {
              if (whtReceived + whtVatReceived <= 0) whtStatus = 'N/A';
              else if (pendingCert) whtStatus = 'Pending';
              else whtStatus = 'Partial';
            }

            invoiceIdToPatch = inv.id;
            invoicePatch = {
              paidAmount: newPaid,
              status: newStatus as Invoice['status'],
              paidDate: newPaid >= inv.total ? inv.paidDate : undefined,
              whtReceived,
              whtVatReceived,
              whtStatus,
              updatedAt: now,
            };

            return {
              ...inv,
              paidAmount: newPaid,
              status: newStatus as Invoice['status'],
              paidDate: newPaid >= inv.total ? inv.paidDate : undefined,
              whtReceived,
              whtVatReceived,
              whtStatus,
              updatedAt: now,
            };
          });
        }

        if (payment.whtCertificateId) {
          whtCertificates = s.whtCertificates.map((c) =>
            c.id === payment.whtCertificateId
              ? { ...c, status: 'Void' as const, updatedAt: now, notes: c.notes || 'Voided with payment' }
              : c,
          );
        }

        const partners = s.businessPartners.map((p) => {
          if (p.id !== payment.businessPartnerId) return p;
          if (payment.type === 'Payment' && (p.type === 'Supplier' || p.type === 'Both')) {
            return { ...p, balance: roundMoney2(p.balance + payment.amount) };
          }
          if (payment.type === 'Receipt' && (p.type === 'Customer' || p.type === 'Both')) {
            return { ...p, balance: roundMoney2(p.balance + payment.amount) };
          }
          return p;
        });

        return {
          payments: s.payments.map((p) =>
            p.id === id ? { ...p, status: 'Void' as const, updatedAt: now } : p,
          ),
          invoices,
          businessPartners: partners,
          whtCertificates,
        };
      });

      if (invoiceIdToPatch && invoicePatch) {
        persistInvoicePatch(invoiceIdToPatch, invoicePatch);
      }

      const voidedCert = payment.whtCertificateId
        ? get().whtCertificates.find((c) => c.id === payment.whtCertificateId)
        : undefined;
      if (voidedCert) {
        persistPaymentPatch(id, {
          status: 'Void',
          ...patchForWhtCertificatePayment(voidedCert),
          updatedAt: now,
        });
      } else {
        persistPaymentPatch(id, { status: 'Void', updatedAt: now });
      }
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

  updateWHTCertificate: (id, updates) => {
    const now = new Date().toISOString();
    const state = get();
    const cert = state.whtCertificates.find((c) => c.id === id);
    if (!cert) return;
    const merged: WHTCertificate = { ...cert, ...updates, updatedAt: now };

    set((s) => ({
      whtCertificates: s.whtCertificates.map((c) => (c.id === id ? merged : c)),
    }));

    const linked = get().payments.find((p) => p.whtCertificateId === id);
    if (linked) {
      persistPaymentPatch(linked.id, patchForWhtCertificatePayment(merged));
    }
  },

  deleteWHTCertificate: (id) => set((state) => ({
    whtCertificates: state.whtCertificates.filter(cert => cert.id !== id)
  })),

  recordWHTPayment: (params) => {
    const { invoiceId, cashAmount, whtAmount, whtVatAmount = 0, paymentMethod, bankAccountId, certificateNumber, withholdingAgentTIN, revenueCenterCode, staffName, staffId } = params;
    const state = get();
    const invoice = state.invoices.find(i => i.id === invoiceId);

    if (!invoice) {
      const msg = `Invoice ${invoiceId} not found`;
      console.error(`[WHT Payment] ${msg}`);
      set({ error: msg });
      return null;
    }

    const now = new Date().toISOString();
    const totalWithheld = roundMoney2(whtAmount + whtVatAmount);
    const totalPayment = roundMoney2(cashAmount + totalWithheld);
    const balanceDue = roundMoney2(invoice.total - (invoice.paidAmount || 0));

    if (totalPayment <= 0) {
      const msg = 'No amounts to record';
      console.error(`[WHT Payment] ${msg}`);
      set({ error: msg });
      return null;
    }
    if (totalPayment > balanceDue + 0.01) {
      const msg = `Total (₵${totalPayment.toLocaleString()}) exceeds balance due (₵${balanceDue.toLocaleString()})`;
      console.error(`[WHT Payment] ${msg}`);
      set({ error: msg });
      return null;
    }

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
      bankAccountId,
      status: 'Posted',
      sourceModule: MANUAL_AR_AP_SOURCE,
      revenueCenterCode,
      createdAt: now,
      updatedAt: now,
    };

    // 2. Create WHT certificate entry if certificate details provided
    let whtCertificateId: string | undefined;
    let whtCert: WHTCertificate | undefined;
    const whtRates = getWhtCertificateRates(state.taxConfigs);
    if (certificateNumber || totalWithheld > 0) {
      whtCertificateId = `WHT-${Date.now()}`;
      whtCert = {
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
        // Rate is 0 (not the statutory rate) whenever its amount is 0 -- otherwise a certificate
        // for a payment flagged "tax only" would show a real WHT-VAT rate like 7% next to a
        // ₵0.00 amount, reading as "VAT withholding applied but happened to round to zero"
        // instead of "not withheld at all". whtVatRate already did this; whtRate didn't.
        whtRate: whtAmount > 0 ? whtRates.onSubtotalPct : 0,
        whtAmount: whtAmount,
        whtVatRate: whtVatAmount > 0 ? whtRates.onVatPct : 0,
        whtVatAmount: whtVatAmount,
        totalWithheld: totalWithheld,
        status: certificateNumber ? 'Received' : 'Pending',
        taxCreditAccountCode: '1230', // WHT Receivable account
        taxCreditUsedAmount: 0,
        taxCreditBalance: totalWithheld,
        createdAt: now,
        updatedAt: now,
      };

      set((st) => ({ whtCertificates: [...st.whtCertificates, whtCert!] }));
    }

    let whtPayment: Payment | undefined;
    if (totalWithheld > 0 && whtCert) {
      whtPayment = paymentWithWhtCertificateData(
        {
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
          whtAmount,
          whtVatAmount,
          status: 'Posted',
          sourceModule: 'manual_ar_ap_wht',
          createdAt: now,
          updatedAt: now,
        },
        whtCert,
      );
    }

    const newPaidAmount = roundMoney2((invoice.paidAmount || 0) + totalPayment);
    const newStatus = newPaidAmount >= invoice.total ? 'Paid' : invoice.status;
    const anyOtherPendingWhtCert = state.whtCertificates.some(
      (c) => c.invoiceId === invoice.id && c.status === 'Pending' && c.id !== whtCertificateId,
    );
    const certStillPending = (totalWithheld > 0 && !certificateNumber) || anyOtherPendingWhtCert;
    const whtStatus = (() => {
      if (totalWithheld <= 0 && !(invoice.whtReceived || invoice.whtVatReceived)) {
        return invoice.whtStatus || 'N/A';
      }
      if (newPaidAmount < invoice.total) return 'Partial' as const;
      return certStillPending ? 'Pending' as const : 'Complete' as const;
    })();

    set((st) => ({
      payments: [
        ...st.payments,
        ...(cashAmount > 0 ? [cashReceipt] : []),
        ...(whtPayment ? [whtPayment] : []),
      ],
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
          whtStatus,
          updatedAt: now,
        } : inv
      ),
      businessPartners: st.businessPartners.map(p =>
        p.id === invoice.businessPartnerId && (p.type === 'Customer' || p.type === 'Both')
          ? { ...p, balance: +(p.balance - totalPayment).toFixed(2) }
          : p
      ),
      error: null,
    }));

    if (cashAmount > 0) {
      persistPayment(cashReceipt);
    }
    if (whtPayment) {
      persistPayment(whtPayment);
    }

    persistInvoicePatch(invoiceId, {
      paidAmount: newPaidAmount,
      status: newStatus as Invoice['status'],
      paidDate: newStatus === 'Paid' ? now : invoice.paidDate,
      whtReceived: (invoice.whtReceived || 0) + whtAmount,
      whtVatReceived: (invoice.whtVatReceived || 0) + whtVatAmount,
      whtCertificateIds: whtCertificateId
        ? [...(invoice.whtCertificateIds || []), whtCertificateId]
        : invoice.whtCertificateIds,
      whtStatus,
      updatedAt: now,
    });

    const partner = get().businessPartners.find(p => p.id === invoice.businessPartnerId);
    const glStore = get();

    if (cashAmount > 0) {
      syncPaymentToLedger(cashReceipt, partner, glStore);
    }

    if (whtPayment && totalWithheld > 0) {
      const whtResult = buildWHTClearingJournalEntry(
        {
          paymentId: whtPayment.id,
          invoiceNumber: invoice.invoiceNumber,
          whtAmount,
          whtVatAmount,
          date: now,
          currency: whtPayment.currency || invoice.currency || 'GHS',
        },
        partner,
        { journalSeq: glStore.journalEntries.length, postedBy: staffName || 'system' },
      );
      if (whtResult.ok) {
        glStore.addJournalEntry(whtResult.entry);
        applyJournalEntryToGlBalances(whtResult.entry, glStore);
        get().updatePayment(whtPayment.id, { journalEntryId: whtResult.entry.id });
      }
    }

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

    return {
      receiptId: cashAmount > 0 ? cashReceipt.id : (whtPayment?.id ?? ''),
      whtCertificateId,
    };
  },

  recordSupplierWHTPayment: (params) => {
    const { invoiceId, paymentMethod, bankAccountId, reference, postedBy } = params;
    const state = get();
    const invoice = state.invoices.find((i) => i.id === invoiceId);
    if (!invoice) {
      console.error(`[AP WHT Payment] Invoice ${invoiceId} not found`);
      return null;
    }

    const cashAmount = roundMoney2(params.cashAmount || 0);
    const whtAmount = roundMoney2(params.whtAmount || 0);
    const whtVatAmount = roundMoney2(params.whtVatAmount || 0);
    const totalWithheld = roundMoney2(whtAmount + whtVatAmount);
    const totalSettled = roundMoney2(cashAmount + totalWithheld);
    const balanceDue = roundMoney2(invoice.total - (invoice.paidAmount || 0));

    if (totalSettled <= 0) {
      console.error('[AP WHT Payment] No amounts to record');
      return null;
    }
    if (totalSettled > balanceDue + 0.01) {
      console.error(`[AP WHT Payment] Total ${totalSettled} exceeds balance ${balanceDue}`);
      return null;
    }

    const now = new Date().toISOString();
    const paymentNumber = `AP-PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const cashPayment: Payment | null =
      cashAmount > 0
        ? {
            id: `PAY-${Date.now()}`,
            paymentNumber,
            date: now,
            type: 'Payment',
            businessPartnerId: invoice.businessPartnerId,
            invoiceId: invoice.id,
            reference: reference || invoice.invoiceNumber,
            description: `Payment (net of WHT) for ${invoice.invoiceNumber}`,
            amount: cashAmount,
            currency: invoice.currency || 'GHS',
            paymentMethod,
            bankAccountId,
            status: 'Posted',
            sourceModule: MANUAL_AR_AP_SOURCE,
            createdAt: now,
            updatedAt: now,
          }
        : null;

    const whtPayment: Payment | null =
      totalWithheld > 0
        ? {
            id: `PAYWHT-${Date.now()}`,
            paymentNumber: `WHT-${paymentNumber}`,
            date: now,
            type: 'Payment',
            businessPartnerId: invoice.businessPartnerId,
            invoiceId: invoice.id,
            reference: reference || invoice.invoiceNumber,
            description: `WHT/VAT withheld — to remit to GRA for ${invoice.invoiceNumber}`,
            amount: totalWithheld,
            currency: invoice.currency || 'GHS',
            paymentMethod: 'WHT Certificate',
            isWHTCertificate: true,
            whtAmount,
            whtVatAmount,
            status: 'Posted',
            sourceModule: MANUAL_AR_AP_SOURCE,
            createdAt: now,
            updatedAt: now,
          }
        : null;

    const newPaidAmount = roundMoney2((invoice.paidAmount || 0) + totalSettled);
    const newStatus = newPaidAmount >= invoice.total ? 'Paid' : invoice.status;

    set((st) => ({
      payments: [
        ...st.payments,
        ...(cashPayment ? [cashPayment] : []),
        ...(whtPayment ? [whtPayment] : []),
      ],
      invoices: st.invoices.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              paidAmount: newPaidAmount,
              status: newStatus as any,
              paidDate: newStatus === 'Paid' ? now : inv.paidDate,
              updatedAt: now,
            }
          : inv
      ),
      businessPartners: st.businessPartners.map((p) =>
        p.id === invoice.businessPartnerId && (p.type === 'Supplier' || p.type === 'Both')
          ? { ...p, balance: roundMoney2(p.balance - totalSettled) }
          : p
      ),
    }));

    if (cashPayment) persistPayment(cashPayment);
    if (whtPayment) persistPayment(whtPayment);
    persistInvoicePatch(invoiceId, {
      paidAmount: newPaidAmount,
      status: newStatus as Invoice['status'],
      paidDate: newStatus === 'Paid' ? now : invoice.paidDate,
      updatedAt: now,
    });

    const partner = get().businessPartners.find((p) => p.id === invoice.businessPartnerId);
    const glStore = get();

    if (cashPayment) {
      const cashResult = syncPaymentToLedger(cashPayment, partner, glStore);
      if (cashResult.ok && !('skipped' in cashResult) && cashPayment.bankAccountId) {
        const bank = get().bankAccounts.find((b) => b.id === cashPayment.bankAccountId);
        const journalEntryId = cashResult.entry.id;
        if (bank && !get().bankTransactions.some((t) => t.journalEntryId === journalEntryId && t.bankAccountId === bank.id)) {
          const newBalance = +((bank.currentBalance || 0) - cashPayment.amount).toFixed(2);
          const postedAt = new Date().toISOString();
          get().updateBankAccount(bank.id, { currentBalance: newBalance, updatedAt: postedAt });
          get().addBankTransaction({
            id: `BT-${journalEntryId}`,
            bankAccountId: bank.id,
            transactionDate: (cashPayment.date || postedAt).slice(0, 10),
            reference: cashPayment.reference || cashPayment.paymentNumber,
            description: cashPayment.description || `Supplier payment ${cashPayment.paymentNumber}`,
            amount: cashPayment.amount,
            type: 'Withdrawal',
            currency: bank.currency || 'GHS',
            balance: newBalance,
            status: 'Cleared',
            journalEntryId,
            createdAt: postedAt,
          });
        }
      }
    }

    if (whtPayment && totalWithheld > 0) {
      const whtResult = buildAPWHTPayableJournalEntry(
        {
          paymentId: whtPayment.id,
          invoiceNumber: invoice.invoiceNumber,
          whtAmount,
          whtVatAmount,
          date: now,
          currency: whtPayment.currency || invoice.currency || 'GHS',
        },
        partner,
        { journalSeq: glStore.journalEntries.length, postedBy: postedBy || 'system' },
      );
      if (whtResult.ok) {
        glStore.addJournalEntry(whtResult.entry);
        applyJournalEntryToGlBalances(whtResult.entry, glStore);
        get().updatePayment(whtPayment.id, { journalEntryId: whtResult.entry.id, status: 'Posted' });
      }
    }

    console.log('[Accounting] ✅ Supplier WHT payment recorded:', {
      invoiceNumber: invoice.invoiceNumber,
      cashPaid: cashAmount,
      whtWithheld: whtAmount,
      invoiceNewBalance: invoice.total - newPaidAmount,
    });

    return { paymentId: cashPayment?.id || whtPayment?.id || '' };
  },

  receiveWHTCertificate: (id, params) => {
    const state = get();
    const cert = state.whtCertificates.find((c) => c.id === id);
    const certNumber = params.certificateNumber?.trim();
    if (!cert || !certNumber) return false;

    const now = params.receivedDate || new Date().toISOString();
    const updatedCert: WHTCertificate = {
      ...cert,
      certificateNumber: certNumber,
      withholdingAgentTIN: params.withholdingAgentTIN?.trim() || cert.withholdingAgentTIN,
      receivedDate: now,
      status: cert.status === 'Pending' ? 'Received' : cert.status,
      updatedAt: now,
    };

    const anyOtherPendingWhtCert = state.whtCertificates.some(
      (c) => c.invoiceId === cert.invoiceId && c.status === 'Pending' && c.id !== id,
    );

    set((st) => ({
      whtCertificates: st.whtCertificates.map((c) => (c.id === id ? updatedCert : c)),
      payments: st.payments.map((p) =>
        p.whtCertificateId === id
          ? paymentWithWhtCertificateData(
              {
                ...p,
                reference: certNumber,
                description: `WHT/VAT withheld on ${cert.invoiceNumber} - Cert: ${certNumber}`,
                updatedAt: now,
              },
              updatedCert,
            )
          : p,
      ),
      invoices: st.invoices.map((inv) =>
        inv.id === cert.invoiceId && inv.whtStatus === 'Pending' && !anyOtherPendingWhtCert
          ? { ...inv, whtStatus: 'Complete' as const, updatedAt: now }
          : inv,
      ),
      auditTrail: [
        ...st.auditTrail,
        {
          id: `AT-WHT-RCV-${Date.now()}`,
          tableName: 'WHT_Certificate',
          recordId: id,
          action: 'Update',
          description: `GRA certificate received: ${certNumber}`,
          oldValues: { certificateNumber: cert.certificateNumber, status: cert.status } as any,
          newValues: { certificateNumber: certNumber, status: 'Received' } as any,
          userId: 'system',
          timestamp: now,
        },
      ],
    }));

    const linkedPayment = get().payments.find((p) => p.whtCertificateId === id);
    if (linkedPayment) {
      persistPaymentPatch(linkedPayment.id, patchForWhtCertificatePayment(updatedCert));
    }
    if (cert.invoiceId && !anyOtherPendingWhtCert) {
      persistInvoicePatch(cert.invoiceId, { whtStatus: 'Complete', updatedAt: now });
    }

    return true;
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
      const journalEntryId = Date.now().toString();
      const journalLines: JournalEntryLine[] = voucher.lines.map(line => ({
        id: Date.now().toString() + Math.random(),
        journalEntryId,
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
        id: journalEntryId,
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

      // Persist the journal entry through the normal posting path (not a raw state
      // splice) so it's actually saved to the backend, not just held in memory.
      get().addJournalEntry(journalEntry);

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

  // Cost Centers Actions
  setCostCenters: (centers) => set({ costCenters: centers }),
  
  addCostCenter: (center) => {
    if (get().costCenters.some((c) => c.code.trim().toLowerCase() === center.code.trim().toLowerCase())) {
      set({ error: `Cost centre code "${center.code}" is already in use.` });
      return;
    }
    set((state) => ({ costCenters: [...state.costCenters, center], error: null }));
    persistCostCenter(center);
  },

  updateCostCenter: (id, updates) => {
    if (updates.code) {
      const clash = get().costCenters.some(
        (c) => c.id !== id && c.code.trim().toLowerCase() === updates.code!.trim().toLowerCase()
      );
      if (clash) {
        set({ error: `Cost centre code "${updates.code}" is already in use.` });
        return;
      }
    }
    let merged: CostCenter | undefined;
    set((state) => {
      merged = state.costCenters.find((c) => c.id === id);
      if (merged) merged = { ...merged, ...updates };
      return {
        costCenters: state.costCenters.map(center =>
          center.id === id ? { ...center, ...updates } : center
        ),
        error: null,
      };
    });
    if (merged) persistCostCenter(merged);
  },

  deleteCostCenter: (id) => {
    const state = get();
    const center = state.costCenters.find((c) => c.id === id);
    const actual = center ? computeCostCenterActual(center, state.journalEntries) : 0;
    if (center && Math.abs(actual) > 0.01) {
      set({ error: `Cannot delete "${center.name}": it has ₵${actual.toLocaleString()} of recorded actual expenses. Reassign or clear those first.` });
      return;
    }
    set((s) => ({
      costCenters: s.costCenters.filter(c => c.id !== id),
      error: null,
    }));
    persistCostCenterDelete(id);
  },

  // Revenue Centers Actions
  setRevenueCenters: (centers) => set({ revenueCenters: centers }),

  addRevenueCenter: (center) => {
    if (get().revenueCenters.some((c) => c.code.trim().toLowerCase() === center.code.trim().toLowerCase())) {
      set({ error: `Revenue centre code "${center.code}" is already in use.` });
      return;
    }
    set((state) => ({ revenueCenters: [...state.revenueCenters, center], error: null }));
    persistRevenueCenter(center);
  },

  updateRevenueCenter: (id, updates) => {
    if (updates.code) {
      const clash = get().revenueCenters.some(
        (c) => c.id !== id && c.code.trim().toLowerCase() === updates.code!.trim().toLowerCase()
      );
      if (clash) {
        set({ error: `Revenue centre code "${updates.code}" is already in use.` });
        return;
      }
    }
    let merged: RevenueCenter | undefined;
    set((state) => {
      merged = state.revenueCenters.find((c) => c.id === id);
      if (merged) merged = { ...merged, ...updates };
      return {
        revenueCenters: state.revenueCenters.map(center =>
          center.id === id ? { ...center, ...updates } : center
        ),
        error: null,
      };
    });
    if (merged) persistRevenueCenter(merged);
  },

  deleteRevenueCenter: (id) => {
    const state = get();
    const center = state.revenueCenters.find((c) => c.id === id);
    const actual = center ? computeRevenueCenterActual(center, state.journalEntries) : 0;
    if (center && Math.abs(actual) > 0.01) {
      set({ error: `Cannot delete "${center.name}": it has ₵${actual.toLocaleString()} of recorded actual revenue. Reassign or clear those first.` });
      return;
    }
    set((s) => ({
      revenueCenters: s.revenueCenters.filter(c => c.id !== id),
      error: null,
    }));
    persistRevenueCenterDelete(id);
  },

  // Helper functions to track costs and revenue with detailed logging.
  // Only meaningful for centers without a glAccountCode — see computeCostCenterActual/
  // computeRevenueCenterActual's fallback in costRevenueRollup.ts; a center that has a
  // glAccountCode gets its actual from the GL rollup instead, so this counter is unused for it.
  recordExpense: (costCenterCode, amount) => {
    const state = get();
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

      const updated = { ...center, actualExpenses: newAmount, variance: budget - newAmount, updatedAt: new Date().toISOString() };
      set({
        costCenters: state.costCenters.map(cc => cc.id === center.id ? updated : cc)
      });
      persistCostCenter(updated);
      return;
    }
    console.warn(`[Accounting] ⚠️ Cost center not found: ${costCenterCode}`);
  },

  recordRevenue: (revenueCenterCode, amount) => {
    const state = get();
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
      
      const updated = { ...center, actualRevenue: newAmount, variance: newAmount - (center.budget || 0), updatedAt: new Date().toISOString() };
      set({
        revenueCenters: state.revenueCenters.map(rc => rc.id === center.id ? updated : rc)
      });
      persistRevenueCenter(updated);
      return;
    }
    console.warn(`[Accounting] ⚠️ Revenue center not found: ${revenueCenterCode}`);
  },

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
    const snapshot = get();
    const hasExistingData =
      snapshot.chartOfAccounts.length > 0 ||
      snapshot.bankAccounts.length > 0 ||
      snapshot.journalEntries.length > 0;
    if (!hasExistingData) {
      set({ isLoading: true, error: null });
    }
    try {
      const countryCode = resolveAccountingCountryCode();
      const accounts = buildChartOfAccountsFromTemplate(countryCode);
      const operational = buildOperationalAccountingSeed(countryCode);

      // Tax bootstrap per country; compliance tax-rule sync refines GL codes after init.
      const taxConfigs: TaxConfig[] = bootstrapTaxConfigsForCountry(countryCode);
      
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
      
      const transactionSeed = isAccountingDemoMode()
        ? (await import('./demoAccountingSeed')).buildDemoTransactionSeed()
        : EMPTY_TRANSACTION_SEED;

      const {
        journalEntries: sampleJournalEntries,
        invoices: sampleInvoices,
        payments: samplePayments,
        whtCertificates: sampleWHTCertificates,
        businessPartners: samplePartners,
        bankAccounts: sampleBankAccounts,
        bankTransactions: sampleBankTxns,
        auditTrail: sampleAudit,
      } = transactionSeed;

      const sampleCostCenters = operational.costCenters;
      const sampleRevenueCenters = operational.revenueCenters;
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

      // Codes added to the default chart after a tenant's first visit — resolveChartOfAccounts
      // otherwise never touches an existing tenant's COA again (by design, to preserve user
      // edits/deletions), so a brand-new default leaf would silently never reach them.
      // Backfill by code only; never overwrites a code the tenant already has (incl. if they
      // deliberately deleted it).
      const BACKFILL_COA_CODES = [
        '5680', // Miscellaneous Expenses — catch-all posting target
        '2205', // Trade Accounts Payable — the postable leaf under 2200 (was missing; postings had nowhere to go but the header)
      ];

      /** First visit: load prebuilt COA. After that: keep user edits (incl. deletions), backfilling only newly-added default codes. */
      const resolveChartOfAccounts = (seed: ChartOfAccounts[], existing: ChartOfAccounts[]) => {
        if (existing.length === 0 && seed.length > 0) return normalizeCoaList(seed);
        if (existing.length > 0) {
          const existingCodes = new Set(existing.map((a) => a.code));
          const backfill = seed.filter((a) => BACKFILL_COA_CODES.includes(a.code) && !existingCodes.has(a.code));
          return normalizeCoaList(backfill.length ? [...existing, ...backfill] : existing);
        }
        return normalizeCoaList(seed);
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
      const demoMode = isAccountingDemoMode();
      const mergeTx = <T extends { id: string }>(seed: T[], existing: T[]) =>
        demoMode ? mergeById(seed, existing) : existing;

      // persistInvoicePatch/persistPayment/persistJournalEntryStatus are fire-and-forget
      // (queued, not awaited by their callers — see helpers/api.ts), so a refresh fired right
      // after a local write (e.g. saveReceipt's handleRefresh) can race ahead of that write
      // landing on the server. Letting the server row win unconditionally then silently
      // reverts the just-applied local change (this is exactly how a receipt's invoice-paidAmount
      // bump was observed disappearing). Keep whichever copy — local or server — was touched
      // more recently instead of always trusting the server.
      const mergeServerRecordsByRecency = <T extends { id: string; updatedAt?: string }>(
        localRecords: T[],
        serverRecords: T[],
      ): T[] => {
        const byId = new Map(localRecords.map((r) => [r.id, r]));
        for (const server of serverRecords) {
          const local = byId.get(server.id);
          const serverTime = new Date(server.updatedAt || 0).getTime();
          const localTime = local ? new Date(local.updatedAt || 0).getTime() : -Infinity;
          if (!local || serverTime >= localTime) byId.set(server.id, server);
        }
        return Array.from(byId.values());
      };

      set({
        chartOfAccounts: resolveChartOfAccounts(accounts, prev.chartOfAccounts),
        taxConfigs: mergeTaxConfigs(taxConfigs, prev.taxConfigs),
        financialPeriods: mergedFinancialPeriods,
        currentFinancialPeriod: resolvedCurrentFinancial,
        currentPeriod: glMonthSlice,
        journalEntries: mergeTx(sampleJournalEntries, prev.journalEntries),
        invoices: mergeTx(sampleInvoices, prev.invoices),
        payments: mergeTx(samplePayments, prev.payments),
        whtCertificates: mergeTx(sampleWHTCertificates, prev.whtCertificates),
        businessPartners: mergeTx(samplePartners, prev.businessPartners),
        bankAccounts: mergeTx(sampleBankAccounts, prev.bankAccounts),
        bankTransactions: mergeTx(sampleBankTxns, prev.bankTransactions),
        costCenters: mergeCostCenters(sampleCostCenters, prev.costCenters),
        revenueCenters: mergeRevenueCenters(sampleRevenueCenters, prev.revenueCenters),
        auditTrail: demoMode ? mergeById(sampleAudit, prev.auditTrail) : prev.auditTrail,
      });

      // Hydrate persisted records from the database (server authoritative when tenant is set).
      // Demo transaction seed loads only when NEXT_PUBLIC_DEMO_MODE=true.
      const [serverJEs, serverInvoices, serverPayments, serverCoa, serverBankAccounts, serverCostCenters, serverRevenueCenters, serverPartners, serverBankTxns, serverAudit] = await Promise.all([
        fetchJournalEntries(),
        fetchInvoices(),
        fetchPayments(),
        fetchChartOfAccounts(),
        fetchBankAccounts(),
        fetchCostCenters(),
        fetchRevenueCenters(),
        fetchBusinessPartners(),
        fetchBankTransactions(),
        fetchAccountingAuditTrail(),
      ]);
      // Chart of accounts and bank accounts are only ever edited one action at a time through
      // their own screens (no concurrent-write race like invoices/payments can have), and the
      // client always re-seeds a fresh in-memory copy with a brand-new `updatedAt` on every
      // load — a recency merge would let that fresh reseed always "win" over a real rename
      // sitting on the server. Server wins outright whenever it has anything.
      if (serverCoa && serverCoa.length > 0) {
        set({ chartOfAccounts: normalizeCoaList(serverCoa) });
      } else {
        // First visit ever (for this tenant): nothing on the server yet — persist the seed
        // already shown above so it's there next time, and for any other device/tab.
        const seeded = get().chartOfAccounts;
        if (seeded.length > 0) persistChartOfAccountsBulk(seeded);
      }
      // Same server-wins-outright-or-seed rule as chart of accounts above. Bulk-persisting
      // the untouched seed on first-ever load (server empty) matters here specifically: without
      // it, editing just one seeded row (e.g. one bank account) would persist only that row, and
      // this same-length-check would then replace the in-memory list with that lone server row,
      // silently deleting every other still-unpersisted seed row on the next reload.
      if (serverBankAccounts && serverBankAccounts.length > 0) {
        set({ bankAccounts: serverBankAccounts });
      } else {
        const seeded = get().bankAccounts;
        seeded.forEach((a) => persistBankAccount(a));
      }
      if (serverCostCenters && serverCostCenters.length > 0) {
        set({ costCenters: serverCostCenters });
      } else {
        const seeded = get().costCenters;
        seeded.forEach((c) => persistCostCenter(c));
      }
      if (serverRevenueCenters && serverRevenueCenters.length > 0) {
        set({ revenueCenters: serverRevenueCenters });
      } else {
        const seeded = get().revenueCenters;
        seeded.forEach((c) => persistRevenueCenter(c));
      }
      // Same server-wins-outright-or-seed rule — business partners and bank ledger
      // transactions were previously in-memory only (only merged with the demo seed).
      if (serverPartners && serverPartners.length > 0) {
        set({ businessPartners: serverPartners });
      } else {
        const seeded = get().businessPartners;
        seeded.forEach((p) => persistBusinessPartner(p));
      }
      if (serverBankTxns && serverBankTxns.length > 0) {
        set({ bankTransactions: serverBankTxns });
      } else {
        const seeded = get().bankTransactions;
        seeded.forEach((t) => persistBankTransaction(t));
      }
      if (serverAudit && serverAudit.length > 0) {
        set({ auditTrail: serverAudit });
      }
      if (serverJEs && serverJEs.length > 0) {
        set((s) => ({ journalEntries: mergeServerRecordsByRecency(s.journalEntries, serverJEs) }));
      }
      if (serverInvoices && serverInvoices.length > 0) {
        set((s) => {
          const invoices = mergeServerRecordsByRecency(s.invoices, serverInvoices);
          // invoiceSettings.nextNumber only lives in this browser's localStorage —
          // raise it past every invoiceNumber the server already has, so a fresh or
          // reset browser can't hand out a number a previous session already used.
          try {
            useSettingsStore.getState().reconcileNumberFloor(
              'invoice',
              invoices.filter((i) => i.type === 'Sales').map((i) => i.invoiceNumber)
            );
          } catch {}
          return { invoices };
        });
      }
      if (serverPayments && serverPayments.length > 0) {
        set((s) => {
          const payments = mergeServerRecordsByRecency(s.payments, serverPayments);
          return {
            payments,
            whtCertificates: mergeWhtCertificateLists(
              s.whtCertificates,
              whtCertificatesFromPayments(payments),
            ),
          };
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to initialize accounting' });
    } finally {
      set({ isLoading: false });
    }
  }
}));
