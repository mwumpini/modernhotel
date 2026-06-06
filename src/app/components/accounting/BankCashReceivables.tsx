'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Card, CardBody, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Tabs, Tab, Spinner, Alert, Progress, Pagination
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import BankReconciliation from './BankReconciliation';

export default function BankCashManagementPage() {
  const {
    bankAccounts,
    bankTransactions,
    isLoading,
    error,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
    addBankTransaction,
    updateBankTransaction,
    deleteBankTransaction,
    reconcileBankTransaction,
    initializeAccounting
  } = useAccountingStore();

  const [selectedTab, setSelectedTab] = useState("bank-accounts");
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [reconAccountId, setReconAccountId] = useState<string | undefined>();
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);

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
    return bankAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
  }, [bankAccounts]);

  const totalCashFlow = useMemo(() => {
    const inflow = bankTransactions
      .filter(t => t.type === 'Deposit' || t.type === 'Interest')
      .reduce((sum, t) => sum + t.amount, 0);
    const outflow = bankTransactions
      .filter(t => t.type === 'Withdrawal' || t.type === 'Charge')
      .reduce((sum, t) => sum + t.amount, 0);
    return inflow - outflow;
  }, [bankTransactions]);

  const totalCash = useMemo(() => {
    return bankAccounts
      .filter(account => account.accountName.toLowerCase().includes('cash'))
      .reduce((sum, account) => sum + account.currentBalance, 0);
  }, [bankAccounts]);

  // Pagination logic for different tabs
  const accountsToShow = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return bankAccounts.slice(start, end);
  }, [bankAccounts, page]);

  const transactionsToShow = useMemo(() => {
    const filtered = bankTransactions.filter(txn => {
      if (filterStatus !== 'all' && txn.status !== filterStatus) return false;
      if (filterType !== 'all' && txn.type !== filterType) return false;
      if (dateRange.start && dateRange.end) {
        const d = new Date(txn.transactionDate).toISOString().slice(0,10);
        if (d < dateRange.start || d > dateRange.end) return false;
      }
      return true;
    });
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filtered.slice(start, end);
  }, [bankTransactions, page, filterStatus, filterType, dateRange]);


  const accountsPages = Math.ceil(bankAccounts.length / rowsPerPage);
  const transactionsPages = Math.ceil(bankTransactions.filter(txn => {
    if (filterStatus !== 'all' && txn.status !== filterStatus) return false;
    if (filterType !== 'all' && txn.type !== filterType) return false;
    if (dateRange.start && dateRange.end) {
      const d = new Date(txn.transactionDate).toISOString().slice(0,10);
      if (d < dateRange.start || d > dateRange.end) return false;
    }
    return true;
  }).length / rowsPerPage);

  if (isLoading) {
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
            <div className="text-2xl font-bold text-green-600">₵{totalBankBalance.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Bank Balance</div>
            <Progress value={100} size="sm" color="success" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">₵{totalCash.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Cash</div>
            <Progress value={100} size="sm" color="primary" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">₵{totalCashFlow.toLocaleString()}</div>
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
            <Tab key="bank-accounts" title="🏦 Bank Accounts">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Bank & Cash Accounts</h3>
                  <Button color="primary" startContent={<span>➕</span>} onClick={() => { setIsEditMode(false); setEditingItem({}); onOpen(); }}>
                    Add Account
                  </Button>
                </div>

                <Table aria-label="Bank Accounts">
                  <TableHeader>
                    <TableColumn>ACCOUNT</TableColumn>
                    <TableColumn>BANK</TableColumn>
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
                        <TableCell><span className="font-mono text-sm">{acc.currency}</span></TableCell>
                        <TableCell className="text-right">₵{acc.openingBalance.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">₵{acc.currentBalance.toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip color={acc.isActive ? 'success' : 'danger'} variant="flat" size="sm">{acc.isActive ? 'Active' : 'Inactive'}</Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="bordered" onPress={() => { setReconAccountId(acc.id); setSelectedTab('reconciliation'); }}>Reconcile</Button>
                            <Button size="sm" variant="bordered" onClick={() => { setIsEditMode(true); setEditingItem(acc); onOpen(); }}>✏️ Edit</Button>
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
                      page={page} 
                      onChange={setPage}
                      showControls
                    />
                  </div>
                )}
              </div>
            </Tab>

            <Tab key="transactions" title="🔁 Transactions">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Bank Transactions</h3>
                  <Button color="primary" startContent={<span>➕</span>} onClick={() => { setIsEditMode(false); setEditingItem({ type: 'Deposit', amount: 0, bankAccountId: bankAccounts[0]?.id }); onOpen(); }}>
                    Add Transaction
                  </Button>
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
                    {transactionsToShow
                      .filter(txn =>
                        !searchTerm || txn.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        txn.description.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>{new Date(txn.transactionDate).toLocaleDateString()}</TableCell>
                        <TableCell>{bankAccounts.find(b => b.id === txn.bankAccountId)?.accountName || txn.bankAccountId}</TableCell>
                        <TableCell className="font-mono text-sm">{txn.reference}</TableCell>
                        <TableCell>{txn.description}</TableCell>
                        <TableCell>
                          <Chip variant="flat" size="sm">{txn.type}</Chip>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>₵{Math.abs(txn.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip color={txn.status === 'Reconciled' ? 'success' : txn.status === 'Cleared' ? 'primary' : 'warning'} variant="flat" size="sm">{txn.status}</Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {txn.status !== 'Reconciled' && (
                              <Button size="sm" color="success" variant="bordered" onClick={() => reconcileBankTransaction(txn.id)}>✔️ Reconcile</Button>
                            )}
                            <Button size="sm" variant="bordered" onClick={() => { setIsEditMode(true); setEditingItem(txn); onOpen(); }}>✏️ Edit</Button>
                            <Button size="sm" color="danger" variant="bordered" onClick={() => deleteBankTransaction(txn.id)}>🗑️ Delete</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {transactionsPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination 
                      total={transactionsPages} 
                      page={page} 
                      onChange={setPage}
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
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader>
            {selectedTab === 'bank-accounts' ? (isEditMode ? 'Edit Bank Account' : 'Add Bank Account') : (isEditMode ? 'Edit Transaction' : 'Add Transaction')}
          </ModalHeader>
          <ModalBody>
            {selectedTab === 'bank-accounts' ? (
              <div className="grid grid-cols-2 gap-4">
                <Input label="Account Name" value={editingItem?.accountName || ''} onChange={(e) => setEditingItem({ ...editingItem, accountName: e.target.value })} />
                <Input label="Account Number" value={editingItem?.accountNumber || ''} onChange={(e) => setEditingItem({ ...editingItem, accountNumber: e.target.value })} />
                <Input label="Bank Name" value={editingItem?.bankName || ''} onChange={(e) => setEditingItem({ ...editingItem, bankName: e.target.value })} />
                <Select label="Currency" selectedKeys={[editingItem?.currency || 'GHS']} onSelectionChange={(keys) => setEditingItem({ ...editingItem, currency: Array.from(keys)[0] })}>
                  <SelectItem key="GHS">GHS</SelectItem>
                  <SelectItem key="USD">USD</SelectItem>
                </Select>
                <Input type="number" label="Opening Balance" value={editingItem?.openingBalance ?? 0} onChange={(e) => setEditingItem({ ...editingItem, openingBalance: parseFloat(e.target.value) || 0 })} />
                <Input type="number" label="Current Balance" value={editingItem?.currentBalance ?? 0} onChange={(e) => setEditingItem({ ...editingItem, currentBalance: parseFloat(e.target.value) || 0 })} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Select label="Account" selectedKeys={[editingItem?.bankAccountId || bankAccounts[0]?.id]} onSelectionChange={(keys) => setEditingItem({ ...editingItem, bankAccountId: Array.from(keys)[0] })}>
                  {bankAccounts.map(acc => (<SelectItem key={acc.id}>{acc.accountName}</SelectItem>))}
                </Select>
                <Select label="Type" selectedKeys={[editingItem?.type || 'Deposit']} onSelectionChange={(keys) => setEditingItem({ ...editingItem, type: Array.from(keys)[0] })}>
                  <SelectItem key="Deposit">Deposit</SelectItem>
                  <SelectItem key="Withdrawal">Withdrawal</SelectItem>
                  <SelectItem key="Transfer">Transfer</SelectItem>
                  <SelectItem key="Charge">Charge</SelectItem>
                  <SelectItem key="Interest">Interest</SelectItem>
                </Select>
                <Input label="Reference" value={editingItem?.reference || ''} onChange={(e) => setEditingItem({ ...editingItem, reference: e.target.value })} />
                <Input label="Description" value={editingItem?.description || ''} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} />
                <Input type="number" label="Amount" value={editingItem?.amount ?? 0} onChange={(e) => setEditingItem({ ...editingItem, amount: parseFloat(e.target.value) || 0 })} />
                <Input type="date" label="Date" value={(editingItem?.transactionDate || new Date().toISOString()).slice(0,10)} onChange={(e) => setEditingItem({ ...editingItem, transactionDate: new Date(e.target.value).toISOString() })} />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>Cancel</Button>
            <Button color="primary" onPress={() => {
              if (selectedTab === 'bank-accounts') {
                if (isEditMode) {
                  updateBankAccount(editingItem.id, editingItem);
                } else {
                  addBankAccount({ ...editingItem, id: `BA-${Date.now()}`, glAccountCode: editingItem.glAccountCode || '1120', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
                }
              } else {
                if (isEditMode) {
                  updateBankTransaction(editingItem.id, editingItem);
                } else {
                  addBankTransaction({ ...editingItem, id: `BT-${Date.now()}`, status: 'Pending', currency: bankAccounts.find(b => b.id === editingItem.bankAccountId)?.currency || 'GHS', balance: 0, createdAt: new Date().toISOString() });
                }
              }
              onClose();
              setEditingItem(null);
            }}>{isEditMode ? 'Update' : 'Create'}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
