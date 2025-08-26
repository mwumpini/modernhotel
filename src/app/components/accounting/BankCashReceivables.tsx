'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Badge, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Tabs, Tab, Textarea, Divider, Spinner, Alert, Progress
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import { BankAccount, BankTransaction, BusinessPartner } from '@/app/lib/accounting/models';

export default function BankCashReceivablesPage() {
  const {
    bankAccounts,
    bankTransactions,
    businessPartners,
    isLoading,
    error
  } = useAccountingStore();

  const [selectedTab, setSelectedTab] = useState("bank-accounts");
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Calculate totals
  const totalBankBalance = useMemo(() => {
    return bankAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
  }, [bankAccounts]);

  const totalReceivables = useMemo(() => {
    return businessPartners
      .filter(partner => partner.type === 'Customer' || partner.type === 'Both')
      .reduce((sum, partner) => sum + partner.balance, 0);
  }, [businessPartners]);

  const totalCash = useMemo(() => {
    return bankAccounts
      .filter(account => account.accountName.toLowerCase().includes('cash'))
      .reduce((sum, account) => sum + account.currentBalance, 0);
  }, [bankAccounts]);

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
        <h1 className="text-3xl font-bold text-gray-900">🏦 Bank, Cash & Receivables</h1>
        <p className="text-gray-600 mt-2">
          Manage bank accounts, cash positions, and customer receivables
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
            <div className="text-2xl font-bold text-orange-600">₵{totalReceivables.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Receivables</div>
            <Progress value={100} size="sm" color="warning" className="mt-2" />
          </CardBody>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert color="danger" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="text-center p-8">
        <h3 className="text-lg font-semibold mb-2">Bank, Cash & Receivables Management</h3>
        <p className="text-gray-600">Full implementation coming soon...</p>
      </div>
    </div>
  );
}
