'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Badge, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Tabs, Tab, Textarea, Divider, Spinner, Alert
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import { ChartOfAccounts as ChartOfAccountsType } from '@/app/lib/accounting/models';

export default function ChartOfAccountsPage() {
  const {
    chartOfAccounts,
    selectedAccount,
    isLoading,
    error,
    addChartOfAccount,
    updateChartOfAccount,
    deleteChartOfAccount,
    setSelectedAccount
  } = useAccountingStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingAccount, setEditingAccount] = useState<ChartOfAccountsType | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Filter and sort accounts
  const filteredAndSortedAccounts = useMemo(() => {
    let filtered = chartOfAccounts.filter(account => {
      const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           account.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || account.type === filterType;
      const matchesCategory = filterCategory === 'all' || account.category === filterCategory;
      
      return matchesSearch && matchesType && matchesCategory;
    });

    // Sort accounts
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof ChartOfAccountsType];
      let bValue: any = b[sortBy as keyof ChartOfAccountsType];
      
      if (sortBy === 'code') {
        aValue = parseInt(a.code);
        bValue = parseInt(b.code);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [chartOfAccounts, searchTerm, filterType, filterCategory, sortBy, sortOrder]);

  // Get unique categories and types for filters
  const categories = useMemo(() => {
    const cats = [...new Set(chartOfAccounts.map(acc => acc.category))];
    return cats.sort();
  }, [chartOfAccounts]);

  const types = useMemo(() => {
    const types = [...new Set(chartOfAccounts.map(acc => acc.type))];
    return types.sort();
  }, [chartOfAccounts]);

  // Handle account operations
  const handleAddAccount = () => {
    setEditingAccount({
      id: '',
      code: '',
      name: '',
      type: 'Asset',
      category: '',
      description: '',
      isActive: true,
      level: 1,
      currency: 'GHS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setIsEditMode(false);
    onOpen();
  };

  const handleEditAccount = (account: ChartOfAccountsType) => {
    setEditingAccount({ ...account });
    setIsEditMode(true);
    onOpen();
  };

  const handleDeleteAccount = (accountId: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      deleteChartOfAccount(accountId);
    }
  };

  const handleSaveAccount = () => {
    if (!editingAccount) return;
    
    if (isEditMode) {
      updateChartOfAccount(editingAccount.id, editingAccount);
    } else {
      addChartOfAccount(editingAccount);
    }
    
    onClose();
    setEditingAccount(null);
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'Asset': return 'success';
      case 'Liability': return 'danger';
      case 'Equity': return 'warning';
      case 'Revenue': return 'primary';
      case 'Expense': return 'secondary';
      default: return 'default';
    }
  };

  const getAccountLevelColor = (level: number) => {
    switch (level) {
      case 1: return 'primary';
      case 2: return 'secondary';
      case 3: return 'default';
      default: return 'default';
    }
  };

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
        <h1 className="text-3xl font-bold text-gray-900">📊 Chart of Accounts</h1>
        <p className="text-gray-600 mt-2">
          Manage your hotel's chart of accounts structure and account hierarchy
        </p>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            
            <Select
              placeholder="Filter by Type"
              selectedKeys={[filterType]}
              onSelectionChange={(keys) => setFilterType(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Types</SelectItem>
              {types.map(type => (
                <SelectItem key={type}>{type}</SelectItem>
              ))}
            </Select>

            <Select
              placeholder="Filter by Category"
              selectedKeys={[filterCategory]}
              onSelectionChange={(keys) => setFilterCategory(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category}>{category}</SelectItem>
              ))}
            </Select>

            <Select
              placeholder="Sort by"
              selectedKeys={[sortBy]}
              onSelectionChange={(keys) => setSortBy(Array.from(keys)[0] as string)}
            >
              <SelectItem key="code">Account Code</SelectItem>
              <SelectItem key="name">Account Name</SelectItem>
              <SelectItem key="type">Account Type</SelectItem>
              <SelectItem key="category">Category</SelectItem>
            </Select>
          </div>

          <div className="flex justify-between items-center mt-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={sortOrder === 'asc' ? 'solid' : 'bordered'}
                onClick={() => setSortOrder('asc')}
              >
                ↑ Ascending
              </Button>
              <Button
                size="sm"
                variant={sortOrder === 'desc' ? 'solid' : 'bordered'}
                onClick={() => setSortOrder('desc')}
              >
                ↓ Descending
              </Button>
            </div>

            <Button
              color="primary"
              onClick={handleAddAccount}
              startContent={<span>➕</span>}
            >
              Add Account
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert color="danger" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              Accounts ({filteredAndSortedAccounts.length})
            </h3>
            <Badge color="success" variant="flat">
              {chartOfAccounts.filter(acc => acc.isActive).length} Active
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <Table aria-label="Chart of Accounts">
            <TableHeader>
              <TableColumn>CODE</TableColumn>
              <TableColumn>NAME</TableColumn>
              <TableColumn>TYPE</TableColumn>
              <TableColumn>CATEGORY</TableColumn>
              <TableColumn>LEVEL</TableColumn>
              <TableColumn>CURRENCY</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No accounts found.">
              {filteredAndSortedAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <span className="font-mono font-medium">{account.code}</span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{account.name}</div>
                      {account.description && (
                        <div className="text-sm text-gray-500">{account.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip color={getAccountTypeColor(account.type)} variant="flat" size="sm">
                      {account.type}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{account.category}</span>
                  </TableCell>
                  <TableCell>
                    <Chip color={getAccountLevelColor(account.level)} variant="flat" size="sm">
                      Level {account.level}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{account.currency}</span>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      color={account.isActive ? 'success' : 'danger'} 
                      variant="flat" 
                      size="sm"
                    >
                      {account.isActive ? 'Active' : 'Inactive'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="bordered"
                        onClick={() => handleEditAccount(account)}
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="bordered"
                        onClick={() => handleDeleteAccount(account.id)}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Add/Edit Account Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isEditMode ? 'Edit Account' : 'Add New Account'}
          </ModalHeader>
          <ModalBody>
            {editingAccount && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Account Code"
                    placeholder="e.g., 1100"
                    value={editingAccount.code}
                    onChange={(e) => setEditingAccount({...editingAccount, code: e.target.value})}
                    required
                  />
                  <Input
                    label="Account Name"
                    placeholder="e.g., Cash in Hand"
                    value={editingAccount.name}
                    onChange={(e) => setEditingAccount({...editingAccount, name: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Account Type"
                    selectedKeys={[editingAccount.type]}
                    onSelectionChange={(keys) => setEditingAccount({
                      ...editingAccount, 
                      type: Array.from(keys)[0] as any
                    })}
                    required
                  >
                    <SelectItem key="Asset">Asset</SelectItem>
                    <SelectItem key="Liability">Liability</SelectItem>
                    <SelectItem key="Equity">Equity</SelectItem>
                    <SelectItem key="Revenue">Revenue</SelectItem>
                    <SelectItem key="Expense">Expense</SelectItem>
                  </Select>

                  <Select
                    label="Account Level"
                    selectedKeys={[editingAccount.level.toString()]}
                    onSelectionChange={(keys) => setEditingAccount({
                      ...editingAccount, 
                      level: parseInt(Array.from(keys)[0] as string)
                    })}
                    required
                  >
                    <SelectItem key="1">Level 1 - Main Account</SelectItem>
                    <SelectItem key="2">Level 2 - Sub Account</SelectItem>
                    <SelectItem key="3">Level 3 - Detail Account</SelectItem>
                  </Select>
                </div>

                <Input
                  label="Category"
                  placeholder="e.g., Current Assets"
                  value={editingAccount.category}
                  onChange={(e) => setEditingAccount({...editingAccount, category: e.target.value})}
                  required
                />

                <Textarea
                  label="Description"
                  placeholder="Account description..."
                  value={editingAccount.description || ''}
                  onChange={(e) => setEditingAccount({...editingAccount, description: e.target.value})}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Currency"
                    selectedKeys={[editingAccount.currency]}
                    onSelectionChange={(keys) => setEditingAccount({
                      ...editingAccount, 
                      currency: Array.from(keys)[0] as string
                    })}
                    required
                  >
                    <SelectItem key="GHS">GHS - Ghana Cedi</SelectItem>
                    <SelectItem key="USD">USD - US Dollar</SelectItem>
                    <SelectItem key="EUR">EUR - Euro</SelectItem>
                  </Select>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={editingAccount.isActive}
                      onChange={(e) => setEditingAccount({
                        ...editingAccount, 
                        isActive: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <label htmlFor="isActive">Account is Active</label>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleSaveAccount}>
              {isEditMode ? 'Update' : 'Create'} Account
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
