'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card, CardBody, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Tabs, Tab, Spinner, Alert, Progress, Pagination,
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

// formatAccountingCurrency always shows a magnitude (and the ₵ symbol), so the sign is
// reattached in front of it here (balances/net cash flow can be negative).
const formatAmount = (value: number | undefined | null) => {
  const n = value ?? 0;
  return (n < 0 ? '-' : '') + formatAccountingCurrency(n);
};

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
            <span className="font-semibold">General ledger (GL)</span> is the official accounting record
            in your Chart of Accounts. It drives trial balance, financial reports, and audit.
          </p>
          <p>
            <span className="font-semibold">When checked:</span> saving creates a journal entry so the
            books reflect this movement — not just the bank cashbook.
          </p>
          <p>
            <span className="font-semibold">When unchecked:</span> only the bank register balance
            changes. Use this if GL was already updated elsewhere (e.g. a receipt or payment posted
            from Accounts Receivable / Payable).
          </p>
          {type === 'Transfer' ? (
            <p>
              <span className="font-semibold">Transfer:</span> Dr destination bank / Cr source bank.
              Hotel-wide cash total stays the same — money moved between accounts.
            </p>
          ) : type === 'Deposit' ? (
            <p><span className="font-semibold">Deposit:</span> Dr bank / Cr revenue (other income).</p>
          ) : type === 'Withdrawal' ? (
            <p><span className="font-semibold">Withdrawal:</span> Dr expense / Cr bank.</p>
          ) : type === 'Charge' ? (
            <p><span className="font-semibold">Bank charge:</span> Dr bank charges expense / Cr bank.</p>
          ) : type === 'Interest' ? (
            <p><span className="font-semibold">Interest:</span> Dr bank / Cr interest income.</p>
          ) : null}
          <p className="text-default-500 text-xs">
            Statement matching is done on the Reconciliation tab — separate from posting to GL.
          </p>
        </div>
      }
    >
      <button
        type="button"
        aria-label="What does Post to GL mean?"
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
    chartOfAccounts,
    isLoading,
    error,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
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
  const [accountsPage, setAccountsPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const rowsPerPage = 10;
  const [reconAccountId, setReconAccountId] = useState<string | undefined>();
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [modalMode, setModalMode] = useState<'account' | 'transaction'>('account');
  const [editingItem, setEditingItem] = useState<BankAccountForm | null>(null);
  const [txnForm, setTxnForm] = useState<BankTransactionForm | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

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

  // Seed demo data on first load
  useEffect(() => {
    if (!bankAccounts.length && !bankTransactions.length) {
      initializeAccounting().catch(() => {});
    }
  }, [bankAccounts.length, bankTransactions.length, initializeAccounting]);

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
  const totalBankBalance = useMemo(() => {
    return bankAccounts.reduce((sum, account) => sum + (account.currentBalance ?? 0), 0);
  }, [bankAccounts]);

  const totalCashFlow = useMemo(() => {
    const inflow = bankTransactions
      .filter(t => t.type === 'Deposit' || t.type === 'Interest')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const outflow = bankTransactions
      .filter(t => t.type === 'Withdrawal' || t.type === 'Charge')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    return inflow - outflow;
  }, [bankTransactions]);

  const totalCash = useMemo(() => {
    return bankAccounts
      .filter(account => account.accountName.toLowerCase().includes('cash'))
      .reduce((sum, account) => sum + (account.currentBalance ?? 0), 0);
  }, [bankAccounts]);

  const filteredBankAccounts = useMemo(() => {
    if (!accountSearchTerm) return bankAccounts;
    const q = accountSearchTerm.toLowerCase();
    return bankAccounts.filter((acc) =>
      acc.accountName.toLowerCase().includes(q) ||
      (acc.bankName || '').toLowerCase().includes(q) ||
      (acc.accountNumber || '').toLowerCase().includes(q)
    );
  }, [bankAccounts, accountSearchTerm]);

  // Pagination logic for different tabs
  const accountsToShow = useMemo(() => {
    const start = (accountsPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredBankAccounts.slice(start, end);
  }, [filteredBankAccounts, accountsPage]);

  const filteredTransactions = useMemo(() => {
    return bankTransactions.filter(txn => {
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
  }, [bankTransactions, filterStatus, filterType, dateRange, searchTerm]);

  const transactionsToShow = useMemo(() => {
    const start = (transactionsPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredTransactions.slice(start, end);
  }, [filteredTransactions, transactionsPage]);

  const accountsPages = Math.ceil(filteredBankAccounts.length / rowsPerPage);
  const transactionsPages = Math.ceil(filteredTransactions.length / rowsPerPage);

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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">🏦 Bank & Cash Management</h1>
        <p className="text-gray-600 mt-2">
          Manage bank accounts, cash positions, and liquidity
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatAmount(totalBankBalance)}</div>
            <div className="text-sm text-gray-600">Total Bank Balance</div>
            <Progress value={100} size="sm" color="success" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">{formatAmount(totalCash)}</div>
            <div className="text-sm text-gray-600">Total Cash</div>
            <Progress value={100} size="sm" color="primary" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatAmount(totalCashFlow)}</div>
            <div className="text-sm text-gray-600">Net Cash Flow</div>
            <Progress value={75} size="sm" color="success" className="mt-2" />
          </CardBody>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert color="danger" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Card>
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
          >
            <Tab key="bank-accounts" title={`🏦 Bank Accounts (${filteredBankAccounts.length})`}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Bank & Cash Accounts</h3>
                  <div className="flex items-center gap-2">
                    <Chip color="primary" variant="flat">{filteredBankAccounts.length} accounts</Chip>
                    <Chip color="success" variant="flat">{formatAmount(filteredBankAccounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0))}</Chip>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="flat" size="sm">📥 Export</Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem key="csv" onPress={exportBankAccountsCSV}>📄 Download CSV</DropdownItem>
                        <DropdownItem key="pdf" onPress={printBankAccountsTablePDF}>📑 Print PDF</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                    <Button color="primary" size="sm" startContent={<span>➕</span>} onPress={openNewBankAccount}>
                      Add Account
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <Input label="Search" placeholder="Account name, bank, account #..." value={accountSearchTerm} onValueChange={setAccountSearchTerm} className="w-64" size="sm" />
                </div>

                <Table aria-label="Bank Accounts">
                  <TableHeader>
                    <TableColumn>ACCOUNT</TableColumn>
                    <TableColumn>BANK</TableColumn>
                    <TableColumn>GL ACCOUNT</TableColumn>
                    <TableColumn>CURRENCY</TableColumn>
                    <TableColumn className="text-right">OPENING</TableColumn>
                    <TableColumn className="text-right">BALANCE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No bank accounts found.">
                    {accountsToShow.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell>
                          <div className="font-medium">{acc.accountName}</div>
                          <div className="text-xs text-gray-500">{acc.accountNumber}</div>
                        </TableCell>
                        <TableCell>{acc.bankName}</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{acc.glAccountCode}</span>
                          <div className="text-xs text-gray-500">
                            {chartOfAccounts.find((c) => c.code === acc.glAccountCode)?.name || '—'}
                          </div>
                        </TableCell>
                        <TableCell><span className="font-mono text-sm">{acc.currency}</span></TableCell>
                        <TableCell className="text-right">{formatAmount(acc.openingBalance)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatAmount(acc.currentBalance)}</TableCell>
                        <TableCell>
                          <Chip color={acc.isActive ? 'success' : 'danger'} variant="flat" size="sm">{acc.isActive ? 'Active' : 'Inactive'}</Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="bordered" onPress={() => { setReconAccountId(acc.id); setSelectedTab('reconciliation'); }}>Reconcile</Button>
                            <Button size="sm" variant="bordered" onPress={() => openEditBankAccount(acc)}>✏️ Edit</Button>
                            <Button size="sm" color="danger" variant="bordered" onClick={() => deleteBankAccount(acc.id)}>🗑️ Delete</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {accountsPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination 
                      total={accountsPages} 
                      page={accountsPage} 
                      onChange={setAccountsPage}
                      showControls
                    />
                  </div>
                )}
              </div>
            </Tab>

            <Tab key="transactions" title={`🔁 Transactions (${filteredTransactions.length})`}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Bank Transactions</h3>
                  <div className="flex items-center gap-2">
                    <Chip color="primary" variant="flat">{filteredTransactions.length} transactions</Chip>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="flat" size="sm">📥 Export</Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem key="csv" onPress={exportBankTransactionsCSV}>📄 Download CSV</DropdownItem>
                        <DropdownItem key="pdf" onPress={printBankTransactionsTablePDF}>📑 Print PDF</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                    <Button color="primary" size="sm" startContent={<span>➕</span>} onPress={openNewTransaction}>
                      Add Transaction
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} startContent={<span className="text-gray-400">🔍</span>} />
                  <Select placeholder="Filter by Status" selectedKeys={[filterStatus]} onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as string)}>
                    <SelectItem key="all">All Statuses</SelectItem>
                    <SelectItem key="Pending">Pending</SelectItem>
                    <SelectItem key="Cleared">Cleared</SelectItem>
                    <SelectItem key="Reconciled">Reconciled</SelectItem>
                  </Select>
                  <Select placeholder="Filter by Type" selectedKeys={[filterType]} onSelectionChange={(keys) => setFilterType(Array.from(keys)[0] as string)}>
                    <SelectItem key="all">All Types</SelectItem>
                    <SelectItem key="Deposit">Deposit</SelectItem>
                    <SelectItem key="Withdrawal">Withdrawal</SelectItem>
                    <SelectItem key="Transfer">Transfer</SelectItem>
                    <SelectItem key="Charge">Charge</SelectItem>
                    <SelectItem key="Interest">Interest</SelectItem>
                  </Select>
                  <div className="flex gap-2">
                    <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
                    <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
                  </div>
                </div>

                <Table aria-label="Bank Transactions">
                  <TableHeader>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn>ACCOUNT</TableColumn>
                    <TableColumn>REFERENCE</TableColumn>
                    <TableColumn>DESCRIPTION</TableColumn>
                    <TableColumn>TYPE</TableColumn>
                    <TableColumn className="text-right">AMOUNT</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No transactions found.">
                    {transactionsToShow.map((txn) => {
                      const dir = txnDirectionLabel(txn);
                      const counterparty =
                        txn.type === 'Transfer' && txn.transferToAccountId
                          ? bankAccounts.find((b) => b.id === txn.transferToAccountId)?.accountName
                          : undefined;
                      const manual = isManualBankTxn(txn, journalEntries);
                      return (
                      <TableRow key={txn.id}>
                        <TableCell>{new Date(txn.transactionDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div>{bankAccounts.find(b => b.id === txn.bankAccountId)?.accountName || txn.bankAccountId}</div>
                          {counterparty && (
                            <div className="text-xs text-gray-500">
                              {dir === 'out' ? `→ ${counterparty}` : `← ${counterparty}`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{txn.reference}</TableCell>
                        <TableCell>{txn.description}</TableCell>
                        <TableCell>
                          <Chip variant="flat" size="sm">{txn.type}</Chip>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${dir === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                          {dir === 'in' ? '+' : '−'}{formatAmount(txn.amount)}
                        </TableCell>
                        <TableCell>
                          <Chip color={txn.status === 'Reconciled' ? 'success' : txn.status === 'Cleared' ? 'primary' : 'warning'} variant="flat" size="sm">{txn.status}</Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            {txn.status === 'Pending' && (
                              <Button size="sm" color="primary" variant="bordered" onPress={() => markBankTransactionCleared(txn.id)}>Mark cleared</Button>
                            )}
                            {manual && txn.status !== 'Reconciled' && (
                              <>
                                <Button size="sm" variant="bordered" onPress={() => openEditTransaction(txn)}>✏️ Edit</Button>
                                <Button size="sm" color="danger" variant="bordered" onPress={() => deleteManualBankTransaction(txn.id)}>🗑️ Delete</Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );})}
                  </TableBody>
                </Table>
                {transactionsPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination 
                      total={transactionsPages} 
                      page={transactionsPage} 
                      onChange={setTransactionsPage}
                      showControls
                    />
                  </div>
                )}
              </div>
            </Tab>

            <Tab key="reconciliation" title="🔄 Reconciliation">
              <BankReconciliation embedded initialAccountId={reconAccountId || bankAccounts[0]?.id} />
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Add/Edit Modals */}
      <Modal isOpen={isOpen} onClose={closeModal} size="lg">
        <ModalContent>
          <ModalHeader>
            {modalMode === 'account'
              ? (isEditMode ? 'Edit Bank Account' : 'Add Bank Account')
              : (isEditMode ? 'Edit Transaction' : 'Add Transaction')}
          </ModalHeader>
          <ModalBody>
            {modalMode === 'account' ? (
              <div className="grid grid-cols-2 gap-4">
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
                  label="GL account (Chart of Accounts)"
                  selectedKey={editingItem?.glAccountCode || undefined}
                  onSelectionChange={(key) => patchBankForm({
                    glAccountCode: key ? String(key) : undefined,
                    createDedicatedGl: false,
                  })}
                  placeholder="Select cash/bank GL account"
                  isDisabled={editingItem?.accountKind === 'petty_cash' || (!!editingItem?.createDedicatedGl && !isEditMode)}
                  description={
                    editingItem?.accountKind === 'petty_cash'
                      ? 'Petty cash maps to GL 1110 — Cash in Hand'
                      : editingItem?.createDedicatedGl && !isEditMode
                        ? 'A dedicated GL account will be created under 1120 on save'
                        : 'Link this register to a cash/bank GL account for journal posting and reconciliation'
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
                      Create dedicated GL account under Bank Accounts (1120)
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
                    Period / year opening (register & reconciliation only)
                  </SelectItem>
                  <SelectItem key="go_live" textValue="Go-live import">
                    Go-live import (posts Dr bank / Cr retained earnings)
                  </SelectItem>
                </Select>
                <Input
                  type="number"
                  label="Opening Balance"
                  value={String(editingItem?.openingBalance ?? 0)}
                  onChange={(e) => patchBankForm({ openingBalance: parseFloat(e.target.value) || 0 })}
                  description={
                    editingItem?.openingBalanceType === 'go_live'
                      ? 'One-time migration: posts Dr bank GL / Cr retained earnings (3200)'
                      : 'Starting balance for this period — updates the cashbook only; GL comes from transactions'
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
              <div className="grid grid-cols-2 gap-4">
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
                    Post to GL
                  </Checkbox>
                  <PostToGlInfo type={txnForm?.type} />
                </div>
                <p className="col-span-2 text-xs text-gray-500">
                  Hover or tap <span className="font-semibold">i</span> next to Post to GL for a full explanation.
                  Use the Reconciliation tab to match bank statements.
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
    </div>
  );
}
