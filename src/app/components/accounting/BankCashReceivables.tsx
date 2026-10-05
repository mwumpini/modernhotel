'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import HeadingInfo from '../HeadingInfo';
import {
  Card, CardBody, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Tabs, Tab, Spinner, Alert, Pagination,
  Autocomplete, AutocompleteItem, Checkbox, Tooltip,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import {
  defaultGlCodeForKind,
  isPettyCashAccount,
  listBankGlAccounts,
} from '@/app/lib/accounting/bankCoaLink';
import BankReconciliation from './BankReconciliation';
import type { BankTransaction } from '@/app/lib/accounting/models';
import { BANK_MANUAL_SOURCE } from '@/app/lib/accounting/bankTransactionLedger';
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';
import { downloadCSV, openPrintPreview, generatePdfHtml } from '@/app/lib/accounting/helpers/exportHelpers';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { DeskKpiStrip, deskBookTabsClassNames, deskBookTabPanelClassName, useAccountingDeskPeriod } from './DeskKpiStrip';
import { isInPeriod } from '@/app/lib/dashboard/useDashboardPeriod';

// formatAccountingCurrency always shows a magnitude (and the ₵ symbol), so the sign is
// reattached in front of it here (balances/net cash flow can be negative).
const formatAmount = (value: number | undefined | null) => {
  const n = value ?? 0;
  return (n < 0 ? '-' : '') + formatAccountingCurrency(n);
};

type AccountSortKey = 'account' | 'bank' | 'gl' | 'currency' | 'opening' | 'balance' | 'status';
type TxnSortKey = 'date' | 'account' | 'reference' | 'description' | 'type' | 'amount' | 'status';
type ViewKind = 'account' | 'transaction' | null;
type BankAccountForm = {
  id?: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  currency?: string;
  openingBalance?: number;
  openingBalanceType?: 'go_live' | 'period';
  currentBalance?: number;
  glAccountCode?: string;
  accountKind?: 'bank' | 'petty_cash';
  createDedicatedGl?: boolean;
  isActive?: boolean;
};

type BankTransactionForm = {
  id?: string;
  bankAccountId?: string;
  transferToAccountId?: string;
  type?: BankTransaction['type'];
  amount?: number;
  reference?: string;
  description?: string;
  transactionDate?: string;
  status?: 'Pending' | 'Cleared';
  postToGl?: boolean;
};

function isManualBankTxn(
  txn: BankTransaction,
  journalEntries: { id: string; sourceModule?: string }[]
): boolean {
  if (txn.type === 'Transfer' || txn.linkedTransactionId) return true;
  if (!txn.journalEntryId) return true;
  const je = journalEntries.find((j) => j.id === txn.journalEntryId);
  return !je || je.sourceModule === BANK_MANUAL_SOURCE;
}

function txnDirectionLabel(txn: BankTransaction): 'in' | 'out' {
  if (txn.type === 'Transfer') {
    if (txn.id.endsWith('-IN')) return 'in';
    if (txn.id.endsWith('-OUT')) return 'out';
  }
  if (txn.type === 'Deposit' || txn.type === 'Interest') return 'in';
  return 'out';
}

function PostToGlInfo({ type }: { type?: BankTransaction['type'] }) {
  return (
    <Tooltip
      placement="left"
      classNames={{ content: 'max-w-sm p-3' }}
      content={
        <div className="space-y-2 text-sm leading-snug">
          <p>
            <span className="font-semibold">The official books</span> are your Chart of Accounts —
            what financial reports and audits use.
          </p>
          <p>
            <span className="font-semibold">When checked:</span> saving also posts a journal so the
            books match this bank movement — not only the cashbook.
          </p>
          <p>
            <span className="font-semibold">When unchecked:</span> only the bank register balance
            changes. Use this if the books were already updated elsewhere (e.g. a receipt or payment
            from Accounts Receivable / Payable).
          </p>
          {type === 'Transfer' ? (
            <p>
              <span className="font-semibold">Transfer:</span> money moves between two of your accounts;
              hotel-wide cash total stays the same.
            </p>
          ) : type === 'Deposit' ? (
            <p><span className="font-semibold">Deposit:</span> money in — bank up, other income up.</p>
          ) : type === 'Withdrawal' ? (
            <p><span className="font-semibold">Withdrawal:</span> money out — expense up, bank down.</p>
          ) : type === 'Charge' ? (
            <p><span className="font-semibold">Bank charge:</span> fee expense, bank down.</p>
          ) : type === 'Interest' ? (
            <p><span className="font-semibold">Interest:</span> bank up, interest income up.</p>
          ) : null}
          <p className="text-default-500 text-xs">
            Matching your bank statement is on the Match statement tab — separate from posting to the books.
          </p>
        </div>
      }
    >
      <button
        type="button"
        aria-label="What does Post to books mean?"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-default-300 text-xs font-semibold text-default-600 hover:bg-default-100"
      >
        i
      </button>
    </Tooltip>
  );
}

export default function BankCashManagementPage() {
  const {
    bankAccounts,
    bankTransactions,
    payments,
    chartOfAccounts,
    isLoading,
    error,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
    restoreMissingDemoBankAccounts,
    createManualBankTransaction,
    deleteManualBankTransaction,
    markBankTransactionCleared,
    ensureBankGlAccount,
    initializeAccounting,
    journalEntries,
  } = useAccountingStore();
  const [selectedTab, setSelectedTab] = useState("bank-accounts");
  const [searchTerm, setSearchTerm] = useState('');
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reconAccountId, setReconAccountId] = useState<string | undefined>();
  const [accountSortKey, setAccountSortKey] = useState<AccountSortKey>('account');
  const [accountSortDir, setAccountSortDir] = useState<'asc' | 'desc'>('asc');
  const [txnSortKey, setTxnSortKey] = useState<TxnSortKey>('date');
  const [txnSortDir, setTxnSortDir] = useState<'asc' | 'desc'>('desc');
  const accountCols = useResizableColumns<AccountSortKey>({
    account: 152, bank: 120, gl: 148, currency: 80, opening: 100, balance: 110, status: 88,
  });
  const txnCols = useResizableColumns<TxnSortKey>({
    date: 92, account: 140, reference: 120, description: 168, type: 96, amount: 108, status: 100,
  });
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [modalMode, setModalMode] = useState<'account' | 'transaction'>('account');
  const [editingItem, setEditingItem] = useState<BankAccountForm | null>(null);
  const [txnForm, setTxnForm] = useState<BankTransactionForm | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewKind, setViewKind] = useState<ViewKind>(null);
  const [viewItem, setViewItem] = useState<any>(null);
  const isViewOpen = viewKind != null && viewItem != null;

  const bankGlOptions = useMemo(
    () => listBankGlAccounts(chartOfAccounts),
    [chartOfAccounts]
  );

  const openNewBankAccount = useCallback(() => {
    setModalMode('account');
    setIsEditMode(false);
    setErrors({});
    setEditingItem({
      accountKind: 'bank',
      createDedicatedGl: true,
      glAccountCode: defaultGlCodeForKind('bank'),
      currency: 'GHS',
      openingBalanceType: 'period',
    });
    onOpen();
  }, [onOpen]);

  const openEditBankAccount = useCallback((acc: typeof bankAccounts[0]) => {
    setModalMode('account');
    setIsEditMode(true);
    setErrors({});
    setEditingItem({
      ...acc,
      accountKind: isPettyCashAccount(acc.accountName, acc.bankName) ? 'petty_cash' : 'bank',
      createDedicatedGl: false,
    });
    onOpen();
  }, [onOpen]);

  const openNewTransaction = useCallback(() => {
    setModalMode('transaction');
    setIsEditMode(false);
    setErrors({});
    setTxnForm({
      type: 'Deposit',
      amount: 0,
      bankAccountId: bankAccounts[0]?.id,
      transactionDate: new Date().toISOString().slice(0, 10),
      status: 'Cleared',
      postToGl: true,
      reference: '',
      description: '',
    });
    onOpen();
  }, [bankAccounts, onOpen]);

  const openEditTransaction = useCallback((txn: BankTransaction) => {
    if (!isManualBankTxn(txn, journalEntries)) return;
    const isInLeg = txn.type === 'Transfer' && txn.id.endsWith('-IN');
    setModalMode('transaction');
    setIsEditMode(true);
    setErrors({});
    setTxnForm({
      id: txn.id,
      bankAccountId: isInLeg ? txn.transferToAccountId : txn.bankAccountId,
      transferToAccountId: isInLeg ? txn.bankAccountId : txn.transferToAccountId,
      type: txn.type,
      amount: Math.abs(txn.amount ?? 0),
      reference: txn.reference,
      description: txn.description,
      transactionDate: txn.transactionDate.slice(0, 10),
      status: txn.status === 'Reconciled' ? 'Cleared' : txn.status,
      postToGl: true,
    });
    onOpen();
  }, [journalEntries, onOpen]);

  const closeView = () => {
    setViewKind(null);
    setViewItem(null);
  };

  const openAccountView = (acc: (typeof bankAccounts)[0]) => {
    setViewKind('account');
    setViewItem(acc);
  };

  const openTransactionView = (txn: BankTransaction) => {
    setViewKind('transaction');
    setViewItem(txn);
  };

  const closeModal = useCallback(() => {
    onClose();
    setEditingItem(null);
    setTxnForm(null);
    setErrors({});
  }, [onClose]);

  const validateAccountForm = (item: BankAccountForm): boolean => {
    const e: Record<string, string> = {};
    if (!item.accountName || item.accountName.trim().length < 2) e.accountName = 'Account name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateTxnForm = (form: BankTransactionForm): boolean => {
    const e: Record<string, string> = {};
    if (!form.reference || !form.reference.trim()) e.reference = 'Reference is required';
    if (!(Number(form.amount) > 0)) e.amount = 'Amount must be greater than 0';
    if (form.type === 'Transfer') {
      if (!form.bankAccountId || !form.transferToAccountId) {
        e.transferToAccountId = 'Select both a from and to account';
      } else if (form.bankAccountId === form.transferToAccountId) {
        e.transferToAccountId = 'From and to accounts must be different';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const patchBankForm = useCallback((patch: Partial<BankAccountForm>) => {
    setEditingItem((prev) => {
      const next = { ...(prev || {}), ...patch };
      if (patch.accountKind) {
        next.glAccountCode = defaultGlCodeForKind(patch.accountKind);
        next.createDedicatedGl = patch.accountKind === 'bank' && !isEditMode;
      }
      if (patch.accountName !== undefined || patch.bankName !== undefined) {
        const kind = isPettyCashAccount(next.accountName, next.bankName) ? 'petty_cash' : 'bank';
        if (!isEditMode && kind === 'petty_cash') {
          next.accountKind = 'petty_cash';
          next.glAccountCode = defaultGlCodeForKind('petty_cash');
          next.createDedicatedGl = false;
        }
      }
      return next;
    });
  }, [isEditMode]);

  // Seed demo data on first load; restore sample banks if they were deleted
  useEffect(() => {
    const run = async () => {
      if (!bankAccounts.length && !bankTransactions.length) {
        try {
          await initializeAccounting();
        } catch {}
      }
      restoreMissingDemoBankAccounts();
    };
    void run();
  }, [bankAccounts.length, bankTransactions.length, initializeAccounting, restoreMissingDemoBankAccounts]);

  useEffect(() => {
    try {
      const sub = localStorage.getItem('accounting.banking.subtab');
      const acct = localStorage.getItem('bankRecon.accountId');
      if (sub) {
        setSelectedTab(sub);
        localStorage.removeItem('accounting.banking.subtab');
      }
      if (acct) {
        setReconAccountId(acct);
        localStorage.removeItem('bankRecon.accountId');
      }
    } catch {}
  }, []);

  // Calculate totals
  const { period: kpiPeriod, todayISO: kpiToday } = useAccountingDeskPeriod();

  const totalBankBalance = useMemo(() => {
    return bankAccounts.reduce((sum, account) => sum + (account.currentBalance ?? 0), 0);
  }, [bankAccounts]);

  // Net movement follows Customize KPI period; balances stay current.
  const totalCashFlow = useMemo(() => {
    const inPeriod = bankTransactions.filter((t) => isInPeriod(t.transactionDate || t.createdAt, kpiPeriod, kpiToday));
    const inflow = inPeriod
      .filter((t) => t.type === 'Deposit' || t.type === 'Interest')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const outflow = inPeriod
      .filter((t) => t.type === 'Withdrawal' || t.type === 'Charge')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    return inflow - outflow;
  }, [bankTransactions, kpiPeriod, kpiToday]);

  const totalCash = useMemo(() => {
    return bankAccounts
      .filter((account) => account.accountName.toLowerCase().includes('cash'))
      .reduce((sum, account) => sum + (account.currentBalance ?? 0), 0);
  }, [bankAccounts]);

  const filteredBankAccounts = useMemo(() => {
    const filtered = !accountSearchTerm
      ? bankAccounts
      : bankAccounts.filter((acc) => {
          const q = accountSearchTerm.toLowerCase();
          return (
            acc.accountName.toLowerCase().includes(q) ||
            (acc.bankName || '').toLowerCase().includes(q) ||
            (acc.accountNumber || '').toLowerCase().includes(q)
          );
        });
    const value = (acc: (typeof bankAccounts)[0]): string | number => {
      switch (accountSortKey) {
        case 'account': return acc.accountName.toLowerCase();
        case 'bank': return (acc.bankName || '').toLowerCase();
        case 'gl': return (acc.glAccountCode || '').toLowerCase();
        case 'currency': return (acc.currency || '').toLowerCase();
        case 'opening': return acc.openingBalance ?? 0;
        case 'balance': return acc.currentBalance ?? 0;
        case 'status': return acc.isActive ? 1 : 0;
        default: return '';
      }
    };
    const sorted = [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return accountSortDir === 'asc' ? sorted : sorted.reverse();
  }, [bankAccounts, accountSearchTerm, accountSortKey, accountSortDir]);

  const filteredTransactions = useMemo(() => {
    const filtered = bankTransactions.filter(txn => {
      if (filterStatus !== 'all' && txn.status !== filterStatus) return false;
      if (filterType !== 'all' && txn.type !== filterType) return false;
      if (dateRange.start && dateRange.end) {
        const d = new Date(txn.transactionDate).toISOString().slice(0,10);
        if (d < dateRange.start || d > dateRange.end) return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !txn.reference.toLowerCase().includes(q) &&
          !txn.description.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
    const accountName = (id: string) =>
      (bankAccounts.find((b) => b.id === id)?.accountName || id).toLowerCase();
    const value = (txn: BankTransaction): string | number => {
      switch (txnSortKey) {
        case 'date': return new Date(txn.transactionDate).getTime();
        case 'account': return accountName(txn.bankAccountId);
        case 'reference': return (txn.reference || '').toLowerCase();
        case 'description': return (txn.description || '').toLowerCase();
        case 'type': return txn.type;
        case 'amount': {
          const signed = txnDirectionLabel(txn) === 'in' ? Math.abs(txn.amount ?? 0) : -Math.abs(txn.amount ?? 0);
          return signed;
        }
        case 'status': return txn.status;
        default: return '';
      }
    };
    const sorted = [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return txnSortDir === 'asc' ? sorted : sorted.reverse();
  }, [bankTransactions, filterStatus, filterType, dateRange, searchTerm, txnSortKey, txnSortDir, bankAccounts]);

  const {
    page: accountsPage,
    setPage: setAccountsPage,
    pages: accountsPages,
    paged: accountsToShow,
  } = useDeskPagination(filteredBankAccounts, [accountSearchTerm, accountSortKey, accountSortDir]);

  const {
    page: transactionsPage,
    setPage: setTransactionsPage,
    pages: transactionsPages,
    paged: transactionsToShow,
  } = useDeskPagination(filteredTransactions, [filterStatus, filterType, dateRange, searchTerm, txnSortKey, txnSortDir]);

  const onAccountSort = (key: AccountSortKey) => {
    if (accountSortKey === key) setAccountSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setAccountSortKey(key);
      setAccountSortDir(key === 'balance' || key === 'opening' ? 'desc' : 'asc');
    }
  };

  const onTxnSort = (key: TxnSortKey) => {
    if (txnSortKey === key) setTxnSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setTxnSortKey(key);
      setTxnSortDir(key === 'date' || key === 'amount' ? 'desc' : 'asc');
    }
  };

  const accountColumn = (key: AccountSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={accountCols.style(key)}>
      <SortLabel active={accountSortKey === key} dir={accountSortDir} align={align} onPress={() => onAccountSort(key)}>{label}</SortLabel>
      {accountCols.sizer(key, label)}
    </TableColumn>
  );

  const txnColumn = (key: TxnSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={txnCols.style(key)}>
      <SortLabel active={txnSortKey === key} dir={txnSortDir} align={align} onPress={() => onTxnSort(key)}>{label}</SortLabel>
      {txnCols.sizer(key, label)}
    </TableColumn>
  );

  // Export Bank Accounts to CSV
  const exportBankAccountsCSV = useCallback(() => {
    const columns = [
      { key: 'accountName', label: 'Account' },
      { key: 'accountNumber', label: 'Account #' },
      { key: 'bankName', label: 'Bank' },
      { key: 'glAccountCode', label: 'GL Account' },
      { key: 'currency', label: 'Currency' },
      { key: 'openingBalance', label: 'Opening Balance' },
      { key: 'currentBalance', label: 'Balance' },
      { key: 'isActive', label: 'Status' },
    ];
    const data = filteredBankAccounts.map((acc) => ({ ...acc, isActive: acc.isActive ? 'Active' : 'Inactive' }));
    downloadCSV(data, 'bank_accounts', columns);
  }, [filteredBankAccounts]);

  // Print Bank Accounts Table as PDF
  const printBankAccountsTablePDF = useCallback(() => {
    const rows = filteredBankAccounts.map((acc) => `<tr>
      <td>${acc.accountName}</td>
      <td>${acc.bankName || '-'}</td>
      <td>${acc.glAccountCode} — ${chartOfAccounts.find((c) => c.code === acc.glAccountCode)?.name || '—'}</td>
      <td>${acc.currency}</td>
      <td class="amount">${formatAmount(acc.openingBalance)}</td>
      <td class="amount">${formatAmount(acc.currentBalance)}</td>
      <td><span class="badge ${acc.isActive ? 'badge-success' : 'badge-danger'}">${acc.isActive ? 'Active' : 'Inactive'}</span></td>
    </tr>`).join('');
    const totalBalance = filteredBankAccounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0);
    const html = generatePdfHtml('Bank & Cash Accounts Report', `
      <div class="header">
        <h1>🏦 Bank &amp; Cash Accounts Report</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
      </div>
      <div class="meta">
        <div class="meta-item"><div class="meta-label">Total Accounts</div><div class="meta-value">${filteredBankAccounts.length}</div></div>
        <div class="meta-item"><div class="meta-label">Total Balance</div><div class="meta-value">${formatAmount(totalBalance)}</div></div>
      </div>
      <table>
        <thead><tr><th>Account</th><th>Bank</th><th>GL Account</th><th>Currency</th><th>Opening</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `, 'Bank & Cash Management');
    openPrintPreview(html);
  }, [filteredBankAccounts, chartOfAccounts]);

  // Export Bank Transactions to CSV
  const exportBankTransactionsCSV = useCallback(() => {
    const columns = [
      { key: 'transactionDate', label: 'Date' },
      { key: 'account', label: 'Account' },
      { key: 'reference', label: 'Reference' },
      { key: 'description', label: 'Description' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status' },
    ];
    const data = filteredTransactions.map((txn) => ({
      ...txn,
      transactionDate: new Date(txn.transactionDate).toLocaleDateString(),
      account: bankAccounts.find((b) => b.id === txn.bankAccountId)?.accountName || txn.bankAccountId,
      amount: txnDirectionLabel(txn) === 'in' ? txn.amount : -Math.abs(txn.amount ?? 0),
    }));
    downloadCSV(data, 'bank_transactions', columns);
  }, [filteredTransactions, bankAccounts]);

  // Print Bank Transactions Table as PDF
  const printBankTransactionsTablePDF = useCallback(() => {
    const rows = filteredTransactions.map((txn) => {
      const dir = txnDirectionLabel(txn);
      const account = bankAccounts.find((b) => b.id === txn.bankAccountId)?.accountName || txn.bankAccountId;
      return `<tr>
        <td>${new Date(txn.transactionDate).toLocaleDateString()}</td>
        <td>${account}</td>
        <td>${txn.reference}</td>
        <td>${txn.description}</td>
        <td>${txn.type}</td>
        <td class="amount">${dir === 'in' ? '+' : '−'}${formatAmount(Math.abs(txn.amount ?? 0))}</td>
        <td><span class="badge ${txn.status === 'Reconciled' ? 'badge-success' : txn.status === 'Cleared' ? 'badge-info' : 'badge-warning'}">${txn.status}</span></td>
      </tr>`;
    }).join('');
    const totalIn = filteredTransactions.filter((t) => txnDirectionLabel(t) === 'in').reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const totalOut = filteredTransactions.filter((t) => txnDirectionLabel(t) === 'out').reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
    const html = generatePdfHtml('Bank Transactions Report', `
      <div class="header">
        <h1>🔁 Bank Transactions Report</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
      </div>
      <div class="meta">
        <div class="meta-item"><div class="meta-label">Total Transactions</div><div class="meta-value">${filteredTransactions.length}</div></div>
        <div class="meta-item"><div class="meta-label">Total In</div><div class="meta-value">${formatAmount(totalIn)}</div></div>
        <div class="meta-item"><div class="meta-label">Total Out</div><div class="meta-value">${formatAmount(totalOut)}</div></div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Account</th><th>Reference</th><th>Description</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `, 'Bank & Cash Management');
    openPrintPreview(html);
  }, [filteredTransactions, bankAccounts]);

  if (isLoading && bankAccounts.length === 0 && bankTransactions.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4">
      <div className="mb-2 flex items-center gap-1.5">
        <h1 className="text-lg md:text-xl font-bold text-gray-800">Bank & Cash</h1>
        <HeadingInfo label="About bank and cash">
          Your bank and cash registers, money in and out, and matching the bank statement.
        </HeadingInfo>
      </div>

      {/* Summary Cards */}
      <DeskKpiStrip
        className="mb-3"
        items={[
          { id: 'bank.totalBalance', label: 'In the bank', value: formatAmount(totalBankBalance), tone: 'text-green-700' },
          { id: 'bank.totalCash', label: 'Cash on hand', value: formatAmount(totalCash), tone: 'text-blue-700' },
          { id: 'bank.netCashFlow', label: 'Net movement', value: formatAmount(totalCashFlow), tone: 'text-emerald-700' },
        ]}
      />

      {/* Error Alert */}
      {error && (
        <Alert color="danger" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Card className="shadow-sm">
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
          >
            <Tab key="bank-accounts" title={`Accounts (${filteredBankAccounts.length})`}>
              <div className={deskBookTabPanelClassName}>
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 shrink-0 mr-auto">Bank & cash accounts</h3>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="flat" size="sm" className="shrink-0">📥 Export</Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem key="csv" onPress={exportBankAccountsCSV}>CSV spreadsheet</DropdownItem>
                        <DropdownItem key="pdf" onPress={printBankAccountsTablePDF}>📑 Print PDF</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                    <Button color="primary" size="sm" className="shrink-0" onPress={openNewBankAccount}>
                      Add account
                    </Button>
                </div>

                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-3">
                  <Input aria-label="Search accounts" placeholder="Search account or bank" value={accountSearchTerm} onValueChange={setAccountSearchTerm} className="w-56 shrink-0" size="sm" />
                </div>

                <div ref={accountCols.frameRef} style={accountCols.frameStyle}>
                  <Table aria-label="Bank Accounts" removeWrapper classNames={deskResizableTableClassNames()}>
                    <TableHeader>
                      {accountColumn('account', 'Account')}
                      {accountColumn('bank', 'Bank')}
                      {accountColumn('gl', 'Books account')}
                      {accountColumn('currency', 'Currency')}
                      {accountColumn('opening', 'Opening', 'right')}
                      {accountColumn('balance', 'Balance', 'right')}
                      {accountColumn('status', 'Status')}
                    </TableHeader>
                    <TableBody emptyContent="No bank accounts found.">
                      {accountsToShow.map((acc) => (
                        <TableRow key={acc.id} className={rowClassNames(viewItem?.id === acc.id && viewKind === 'account')} onClick={() => openAccountView(acc)}>
                          <TableCell>
                            <div className="font-medium truncate text-blue-600 hover:underline" title={acc.accountName}>{acc.accountName}</div>
                            <div className="text-xs text-gray-500 truncate">{acc.accountNumber}</div>
                          </TableCell>
                          <TableCell><span className="block truncate" title={acc.bankName}>{acc.bankName}</span></TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{acc.glAccountCode}</span>
                            <div className="text-xs text-gray-500 truncate">
                              {chartOfAccounts.find((c) => c.code === acc.glAccountCode)?.name || '—'}
                            </div>
                          </TableCell>
                          <TableCell><span className="font-mono text-sm">{acc.currency}</span></TableCell>
                          <TableCell className="text-right tabular-nums">{formatAmount(acc.openingBalance)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatAmount(acc.currentBalance)}</TableCell>
                          <TableCell>
                            <Chip color={acc.isActive ? 'success' : 'danger'} variant="flat" size="sm">{acc.isActive ? 'Active' : 'Inactive'}</Chip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex justify-end">
                  <Pagination
                    total={accountsPages}
                    page={accountsPage}
                    onChange={setAccountsPage}
                    showControls
                    size="sm"
                  />
                </div>
              </div>
            </Tab>

            <Tab key="transactions" title={`Transactions (${filteredTransactions.length})`}>
              <div className={deskBookTabPanelClassName}>
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 shrink-0 mr-auto">Money in and out</h3>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="flat" size="sm" className="shrink-0">📥 Export</Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem key="csv" onPress={exportBankTransactionsCSV}>CSV spreadsheet</DropdownItem>
                        <DropdownItem key="pdf" onPress={printBankTransactionsTablePDF}>📑 Print PDF</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                    <Button color="primary" size="sm" className="shrink-0" onPress={openNewTransaction}>
                      Add transaction
                    </Button>
                </div>

                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-3">
                  <Input aria-label="Search transactions" placeholder="Search transactions" value={searchTerm} onValueChange={setSearchTerm} className="w-48 shrink-0" size="sm" />
                  <Select aria-label="Status" className="w-36 shrink-0" size="sm" selectedKeys={[filterStatus]} disallowEmptySelection onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as string)}>
                    <SelectItem key="all">All statuses</SelectItem>
                    <SelectItem key="Pending">Pending</SelectItem>
                    <SelectItem key="Cleared">Cleared</SelectItem>
                    <SelectItem key="Reconciled">Reconciled</SelectItem>
                  </Select>
                  <Select aria-label="Type" className="w-36 shrink-0" size="sm" selectedKeys={[filterType]} disallowEmptySelection onSelectionChange={(keys) => setFilterType(Array.from(keys)[0] as string)}>
                    <SelectItem key="all">All types</SelectItem>
                    <SelectItem key="Deposit">Deposit</SelectItem>
                    <SelectItem key="Withdrawal">Withdrawal</SelectItem>
                    <SelectItem key="Transfer">Transfer</SelectItem>
                    <SelectItem key="Charge">Charge</SelectItem>
                    <SelectItem key="Interest">Interest</SelectItem>
                  </Select>
                  <Input type="date" aria-label="From date" className="w-36 shrink-0" size="sm" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
                  <Input type="date" aria-label="To date" className="w-36 shrink-0" size="sm" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
                </div>

                <div ref={txnCols.frameRef} style={txnCols.frameStyle}>
                  <Table aria-label="Bank Transactions" removeWrapper classNames={deskResizableTableClassNames()}>
                    <TableHeader>
                      {txnColumn('date', 'Date')}
                      {txnColumn('account', 'Account')}
                      {txnColumn('reference', 'Reference')}
                      {txnColumn('description', 'Description')}
                      {txnColumn('type', 'Type')}
                      {txnColumn('amount', 'Amount', 'right')}
                      {txnColumn('status', 'Status')}
                    </TableHeader>
                    <TableBody emptyContent="No transactions found.">
                      {transactionsToShow.map((txn) => {
                        const dir = txnDirectionLabel(txn);
                        const counterparty =
                          txn.type === 'Transfer' && txn.transferToAccountId
                            ? bankAccounts.find((b) => b.id === txn.transferToAccountId)?.accountName
                            : undefined;
                        return (
                        <TableRow key={txn.id} className={rowClassNames(viewItem?.id === txn.id && viewKind === 'transaction')} onClick={() => openTransactionView(txn)}>
                          <TableCell>{new Date(txn.transactionDate).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="truncate text-blue-600 hover:underline">{bankAccounts.find(b => b.id === txn.bankAccountId)?.accountName || txn.bankAccountId}</div>
                            {counterparty && (
                              <div className="text-xs text-gray-500 truncate">
                                {dir === 'out' ? `→ ${counterparty}` : `← ${counterparty}`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm truncate">{txn.reference}</TableCell>
                          <TableCell><span className="block truncate" title={txn.description}>{txn.description}</span></TableCell>
                          <TableCell>
                            <Chip variant="flat" size="sm">{txn.type}</Chip>
                          </TableCell>
                          <TableCell className={`text-right font-medium tabular-nums ${dir === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                            {dir === 'in' ? '+' : '−'}{formatAmount(txn.amount)}
                          </TableCell>
                          <TableCell>
                            <Chip color={txn.status === 'Reconciled' ? 'success' : txn.status === 'Cleared' ? 'primary' : 'warning'} variant="flat" size="sm">{txn.status}</Chip>
                          </TableCell>
                        </TableRow>
                      );})}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex justify-end">
                  <Pagination
                    total={transactionsPages}
                    page={transactionsPage}
                    onChange={setTransactionsPage}
                    showControls
                    size="sm"
                  />
                </div>
              </div>
            </Tab>

            <Tab key="reconciliation" title="Match statement">
              <div className={deskBookTabPanelClassName}>
                <BankReconciliation embedded initialAccountId={reconAccountId || bankAccounts[0]?.id} />
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Add/Edit Modals */}
      <Modal isOpen={isOpen} onClose={closeModal} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            {modalMode === 'account'
              ? (isEditMode ? 'Edit Bank Account' : 'Add Bank Account')
              : (isEditMode ? 'Edit Transaction' : 'Add Transaction')}
          </ModalHeader>
          <ModalBody>
            {modalMode === 'account' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Account type"
                  selectedKeys={[editingItem?.accountKind || 'bank']}
                  onSelectionChange={(keys) => patchBankForm({ accountKind: Array.from(keys)[0] as 'bank' | 'petty_cash' })}
                >
                  <SelectItem key="bank">Bank account</SelectItem>
                  <SelectItem key="petty_cash">Petty cash / cash drawer</SelectItem>
                </Select>
                <div>
                  <Input label="Account Name" isRequired value={editingItem?.accountName || ''} onChange={(e) => patchBankForm({ accountName: e.target.value })} />
                  {errors.accountName && <div className="text-red-600 text-xs mt-1">{errors.accountName}</div>}
                </div>
                <Input label="Account Number" value={editingItem?.accountNumber || ''} onChange={(e) => patchBankForm({ accountNumber: e.target.value })} />
                <Input label="Bank Name" value={editingItem?.bankName || ''} onChange={(e) => patchBankForm({ bankName: e.target.value })} />
                <Select label="Currency" selectedKeys={[editingItem?.currency || 'GHS']} onSelectionChange={(keys) => patchBankForm({ currency: Array.from(keys)[0] as string })}>
                  <SelectItem key="GHS">GHS</SelectItem>
                  <SelectItem key="USD">USD</SelectItem>
                </Select>
                <Autocomplete
                  label="Books account (Chart of Accounts)"
                  selectedKey={editingItem?.glAccountCode || undefined}
                  onSelectionChange={(key) => patchBankForm({
                    glAccountCode: key ? String(key) : undefined,
                    createDedicatedGl: false,
                  })}
                  placeholder="Select cash/bank books account"
                  isDisabled={editingItem?.accountKind === 'petty_cash' || (!!editingItem?.createDedicatedGl && !isEditMode)}
                  description={
                    editingItem?.accountKind === 'petty_cash'
                      ? 'Petty cash maps to account 1110 — Cash in Hand'
                      : editingItem?.createDedicatedGl && !isEditMode
                        ? 'A dedicated books account will be created under 1120 on save'
                        : 'Link this register to a cash/bank books account for posting and statement matching'
                  }
                >
                  {bankGlOptions.map((acc) => (
                    <AutocompleteItem key={acc.code} textValue={`${acc.code} ${acc.name}`}>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{acc.code}</span>
                        <span className="text-xs text-gray-600">{acc.name}</span>
                      </div>
                    </AutocompleteItem>
                  ))}
                </Autocomplete>
                {editingItem?.accountKind === 'bank' && (
                  <div className="col-span-2">
                    <Checkbox
                      isSelected={editingItem?.createDedicatedGl ?? false}
                      onValueChange={(checked) => patchBankForm({
                        createDedicatedGl: checked,
                        glAccountCode: checked ? defaultGlCodeForKind('bank') : editingItem?.glAccountCode,
                      })}
                      isDisabled={isEditMode}
                    >
                      Create dedicated books account under Bank Accounts (1120)
                    </Checkbox>
                  </div>
                )}
                <Select
                  label="Opening balance type"
                  selectedKeys={[editingItem?.openingBalanceType || 'period']}
                  onSelectionChange={(keys) =>
                    patchBankForm({ openingBalanceType: Array.from(keys)[0] as 'go_live' | 'period' })
                  }
                >
                  <SelectItem key="period" textValue="Period / year opening">
                    Period / year opening (register & statement match only)
                  </SelectItem>
                  <SelectItem key="go_live" textValue="Go-live import">
                    Go-live import (posts to books: bank / retained earnings)
                  </SelectItem>
                </Select>
                <Input
                  type="number"
                  label="Opening Balance"
                  value={String(editingItem?.openingBalance ?? 0)}
                  onChange={(e) => patchBankForm({ openingBalance: parseFloat(e.target.value) || 0 })}
                  description={
                    editingItem?.openingBalanceType === 'go_live'
                      ? 'One-time migration: posts bank debit and retained earnings credit (3200)'
                      : 'Starting balance for this period — updates the cashbook only; books update from transactions'
                  }
                />
                {isEditMode && (
                  <Input
                    type="number"
                    isReadOnly
                    label="Current Balance (₵)"
                    value={String(editingItem?.currentBalance ?? 0)}
                    description="Automatically maintained from Opening Balance + transactions — record a transaction to change it"
                  />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Type"
                  selectedKeys={[txnForm?.type || 'Deposit']}
                  isDisabled={isEditMode}
                  onSelectionChange={(keys) => setTxnForm({
                    ...(txnForm || {}),
                    type: Array.from(keys)[0] as BankTransaction['type'],
                    transferToAccountId: undefined,
                  })}
                  className="col-span-2"
                >
                  <SelectItem key="Deposit">Deposit</SelectItem>
                  <SelectItem key="Withdrawal">Withdrawal</SelectItem>
                  <SelectItem key="Transfer">Transfer between accounts</SelectItem>
                  <SelectItem key="Charge">Bank charge</SelectItem>
                  <SelectItem key="Interest">Interest</SelectItem>
                </Select>
                {txnForm?.type === 'Transfer' ? (
                  <>
                    <Select
                      label="From account"
                      selectedKeys={txnForm?.bankAccountId ? [txnForm.bankAccountId] : []}
                      onSelectionChange={(keys) => setTxnForm({ ...(txnForm || {}), bankAccountId: Array.from(keys)[0] as string })}
                    >
                      {bankAccounts.map((acc) => (<SelectItem key={acc.id}>{acc.accountName}</SelectItem>))}
                    </Select>
                    <div>
                      <Select
                        label="To account"
                        selectedKeys={txnForm?.transferToAccountId ? [txnForm.transferToAccountId] : []}
                        onSelectionChange={(keys) => setTxnForm({ ...(txnForm || {}), transferToAccountId: Array.from(keys)[0] as string })}
                      >
                        {bankAccounts
                          .filter((acc) => acc.id !== txnForm?.bankAccountId)
                          .map((acc) => (<SelectItem key={acc.id}>{acc.accountName}</SelectItem>))}
                      </Select>
                      {errors.transferToAccountId && <div className="text-red-600 text-xs mt-1">{errors.transferToAccountId}</div>}
                    </div>
                  </>
                ) : (
                  <Select
                    label="Account"
                    selectedKeys={txnForm?.bankAccountId ? [txnForm.bankAccountId] : []}
                    onSelectionChange={(keys) => setTxnForm({ ...(txnForm || {}), bankAccountId: Array.from(keys)[0] as string })}
                    className="col-span-2"
                  >
                    {bankAccounts.map((acc) => (<SelectItem key={acc.id}>{acc.accountName}</SelectItem>))}
                  </Select>
                )}
                <div>
                  <Input label="Reference" isRequired value={txnForm?.reference || ''} onChange={(e) => setTxnForm({ ...(txnForm || {}), reference: e.target.value })} />
                  {errors.reference && <div className="text-red-600 text-xs mt-1">{errors.reference}</div>}
                </div>
                <Input label="Description" value={txnForm?.description || ''} onChange={(e) => setTxnForm({ ...(txnForm || {}), description: e.target.value })} />
                <div>
                  <Input
                    type="number"
                    label="Amount"
                    isRequired
                    min={0}
                    value={String(txnForm?.amount ?? 0)}
                    onChange={(e) => setTxnForm({ ...(txnForm || {}), amount: parseFloat(e.target.value) || 0 })}
                  />
                  {errors.amount && <div className="text-red-600 text-xs mt-1">{errors.amount}</div>}
                </div>
                <Input
                  type="date"
                  label="Date"
                  value={txnForm?.transactionDate?.slice(0, 10) || new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setTxnForm({ ...(txnForm || {}), transactionDate: new Date(e.target.value).toISOString() })}
                />
                <Select
                  label="Status"
                  selectedKeys={[txnForm?.status || 'Cleared']}
                  onSelectionChange={(keys) => setTxnForm({ ...(txnForm || {}), status: Array.from(keys)[0] as 'Pending' | 'Cleared' })}
                >
                  <SelectItem key="Cleared">Cleared</SelectItem>
                  <SelectItem key="Pending">Pending</SelectItem>
                </Select>
                <div className="flex items-center gap-2 pb-1">
                  <Checkbox
                    isSelected={txnForm?.postToGl !== false}
                    onValueChange={(checked) => setTxnForm({ ...(txnForm || {}), postToGl: checked })}
                  >
                    Post to books
                  </Checkbox>
                  <PostToGlInfo type={txnForm?.type} />
                </div>
                <p className="col-span-2 text-xs text-gray-500">
                  Hover or tap <span className="font-semibold">i</span> next to Post to books for a full explanation.
                  Use the Match statement tab to match bank statements.
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={closeModal}>Cancel</Button>
            <Button color="primary" onPress={() => {
              if (modalMode === 'account') {
                const item = editingItem || {};
                if (!validateAccountForm(item)) return;
                const accountKind = item.accountKind || (isPettyCashAccount(item.accountName, item.bankName) ? 'petty_cash' : 'bank');
                const glAccountCode = ensureBankGlAccount({
                  accountName: item.accountName || 'Bank Account',
                  bankName: item.bankName,
                  accountKind,
                  createDedicatedGl: item.createDedicatedGl ?? (accountKind === 'bank' && !isEditMode),
                  preferredCode: item.createDedicatedGl && !isEditMode ? undefined : item.glAccountCode,
                });

                if (isEditMode && item.id) {
                  updateBankAccount(item.id, {
                    accountName: item.accountName,
                    accountNumber: item.accountNumber,
                    bankName: item.bankName,
                    currency: item.currency,
                    openingBalance: item.openingBalance,
                    openingBalanceType: item.openingBalanceType || 'period',
                    currentBalance: item.currentBalance,
                    glAccountCode,
                    isActive: item.isActive,
                    updatedAt: new Date().toISOString(),
                  });
                } else {
                  addBankAccount({
                    accountName: item.accountName || '',
                    accountNumber: item.accountNumber || '',
                    bankName: item.bankName || '',
                    currency: item.currency || 'GHS',
                    id: `BA-${Date.now()}`,
                    glAccountCode,
                    openingBalanceType: item.openingBalanceType || 'period',
                    openingBalance: item.openingBalance ?? 0,
                    currentBalance: item.currentBalance ?? item.openingBalance ?? 0,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }
                closeModal();
                return;
              }

              const form = txnForm || {};
              if (!validateTxnForm(form)) return;
              const payload = {
                bankAccountId: form.bankAccountId || bankAccounts[0]?.id || '',
                transferToAccountId: form.transferToAccountId,
                type: form.type || 'Deposit' as BankTransaction['type'],
                amount: form.amount ?? 0,
                reference: form.reference?.trim() || '',
                description: form.description?.trim() || '',
                transactionDate: form.transactionDate || new Date().toISOString(),
                status: form.status || 'Cleared' as const,
                postToGl: form.postToGl !== false,
              };

              // Create the replacement BEFORE touching the original being edited. Deleting
              // first (the old order) meant a failed create — wrong account, a transfer
              // rejected for matching from/to, a since-reconciled account — silently erased
              // the original transaction with nothing to show for it. Creating first means a
              // failed save leaves the original untouched; the only remaining failure mode is
              // a visible duplicate (safe/fixable) instead of silent data loss.
              const result = createManualBankTransaction(payload);
              if (!result.ok) return;

              if (isEditMode && form.id) {
                deleteManualBankTransaction(form.id);
              }
              closeModal();
            }}>{isEditMode ? 'Update' : 'Create'}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Click-to-view detail */}
      <Modal
        isOpen={isViewOpen}
        onOpenChange={(open) => { if (!open) closeView(); }}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => {
            if (!viewItem || !viewKind) return null;

            if (viewKind === 'account') {
              const glName = chartOfAccounts.find((c) => c.code === viewItem.glAccountCode)?.name || '—';
              return (
                <>
                  <ModalHeader className="border-b bg-white px-6 py-4">
                    <div className="flex justify-between items-start w-full pr-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-gray-900">BANK ACCOUNT</h3>
                          <Chip size="sm" variant="flat" color={viewItem.isActive ? 'success' : 'danger'}>
                            {viewItem.isActive ? 'Active' : 'Inactive'}
                          </Chip>
                        </div>
                        <p className="text-lg text-gray-800">{viewItem.accountName}</p>
                        <p className="text-sm font-mono text-gray-500">{viewItem.accountNumber || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums">{formatAmount(viewItem.currentBalance)}</p>
                        <p className="text-xs text-gray-500">Current balance</p>
                      </div>
                    </div>
                  </ModalHeader>
                  <ModalBody className="p-6 bg-white">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-sm">
                      <div className="space-y-1">
                        <div><span className="text-gray-500">Bank:</span> <span className="font-medium">{viewItem.bankName || '—'}</span></div>
                        <div><span className="text-gray-500">Currency:</span> <span className="font-mono">{viewItem.currency || '—'}</span></div>
                        <div><span className="text-gray-500">GL:</span> <span className="font-mono">{viewItem.glAccountCode}</span> <span className="text-gray-500">({glName})</span></div>
                      </div>
                      <div className="space-y-1">
                        <div><span className="text-gray-500">Opening:</span> <span className="tabular-nums font-medium">{formatAmount(viewItem.openingBalance)}</span></div>
                        <div><span className="text-gray-500">Balance:</span> <span className="tabular-nums font-semibold">{formatAmount(viewItem.currentBalance)}</span></div>
                      </div>
                    </div>
                  </ModalBody>
                  <ModalFooter className="border-t bg-white">
                    <Button variant="flat" onPress={onClose}>Close</Button>
                    <Button variant="flat" color="primary" onPress={() => { closeView(); setReconAccountId(viewItem.id); setSelectedTab('reconciliation'); }}>Reconcile</Button>
                    {viewItem.isActive ? (
                      <Button
                        color="warning"
                        variant="flat"
                        onPress={async () => {
                          const { confirmChoice } = await import('../DangerConfirm');
                          if (!(await confirmChoice(`Deactivate ${viewItem.accountName}?`, 'It will be hidden from payment pickers but history is kept.', 'Deactivate'))) return;
                          updateBankAccount(viewItem.id, { isActive: false, updatedAt: new Date().toISOString() });
                          closeView();
                        }}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        color="success"
                        variant="flat"
                        onPress={() => {
                          updateBankAccount(viewItem.id, { isActive: true, updatedAt: new Date().toISOString() });
                          closeView();
                        }}
                      >
                        Reactivate
                      </Button>
                    )}
                    <Button
                      color="danger"
                      variant="flat"
                      onPress={async () => {
                        const txnCount = bankTransactions.filter((t) => t.bankAccountId === viewItem.id).length;
                        const payCount = payments.filter((p) => p.bankAccountId === viewItem.id && p.status !== 'Void').length;
                        const hasBalance = Math.abs(Number(viewItem.currentBalance || 0)) > 0.009;
                        if (txnCount > 0 || payCount > 0 || hasBalance) {
                          window.alert(
                            `Cannot delete "${viewItem.accountName}" while it has history or a balance. Use Deactivate instead.`,
                          );
                          return;
                        }
                        const { confirmDelete } = await import('../DangerConfirm');
                        if (!(await confirmDelete(viewItem.accountName, 'This bank account will be permanently removed. This cannot be undone.'))) return;
                        const result = deleteBankAccount(viewItem.id);
                        if (!result.ok) {
                          window.alert(result.reason);
                          return;
                        }
                        closeView();
                      }}
                    >
                      Delete
                    </Button>
                    <Button color="primary" onPress={() => { closeView(); openEditBankAccount(viewItem); }}>Edit</Button>
                  </ModalFooter>
                </>
              );
            }

            const dir = txnDirectionLabel(viewItem);
            const accountName = bankAccounts.find((b) => b.id === viewItem.bankAccountId)?.accountName || viewItem.bankAccountId;
            const manual = isManualBankTxn(viewItem, journalEntries);
            return (
              <>
                <ModalHeader className="border-b bg-white px-6 py-4">
                  <div className="flex justify-between items-start w-full pr-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-gray-900">BANK TRANSACTION</h3>
                        <Chip size="sm" variant="flat" color={viewItem.status === 'Reconciled' ? 'success' : viewItem.status === 'Cleared' ? 'primary' : 'warning'}>
                          {viewItem.status}
                        </Chip>
                      </div>
                      <p className="text-lg font-mono text-gray-700">{viewItem.reference || viewItem.id}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold tabular-nums ${dir === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                        {dir === 'in' ? '+' : '−'}{formatAmount(viewItem.amount)}
                      </p>
                      <p className="text-sm text-gray-500">{viewItem.type}</p>
                    </div>
                  </div>
                </ModalHeader>
                <ModalBody className="p-6 bg-white">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-sm">
                    <div className="space-y-1">
                      <div><span className="text-gray-500">Account:</span> <span className="font-medium">{accountName}</span></div>
                      <div><span className="text-gray-500">Date:</span> <span>{new Date(viewItem.transactionDate).toLocaleDateString()}</span></div>
                      <div><span className="text-gray-500">Type:</span> <span>{viewItem.type}</span></div>
                    </div>
                    <div className="space-y-1">
                      <div><span className="text-gray-500">Description:</span> <span>{viewItem.description || '—'}</span></div>
                      {viewItem.transferToAccountId && (
                        <div><span className="text-gray-500">Transfer:</span> <span>{bankAccounts.find((b) => b.id === viewItem.transferToAccountId)?.accountName || viewItem.transferToAccountId}</span></div>
                      )}
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter className="border-t bg-white">
                  <Button variant="flat" onPress={onClose}>Close</Button>
                  {viewItem.status === 'Pending' && (
                    <Button color="primary" variant="flat" onPress={() => { markBankTransactionCleared(viewItem.id); closeView(); }}>Mark cleared</Button>
                  )}
                  {manual && viewItem.status !== 'Reconciled' && (
                    <>
                      <Button
                        color="danger"
                        variant="flat"
                        onPress={async () => {
                          const { confirmDelete } = await import('../DangerConfirm');
                          if (!(await confirmDelete(viewItem.reference || 'this transaction', 'This bank transaction will be permanently removed. This cannot be undone.'))) return;
                          deleteManualBankTransaction(viewItem.id);
                          closeView();
                        }}
                      >
                        Delete
                      </Button>
                      <Button color="primary" onPress={() => { closeView(); openEditTransaction(viewItem); }}>Edit</Button>
                    </>
                  )}
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}
