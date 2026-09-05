'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Checkbox, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Tabs, Tab, Textarea, Divider, Spinner, Alert, Progress, Pagination,
  Autocomplete, AutocompleteItem
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import { useSupplierStore } from '@/app/lib/inventory/supplierStore';
import { useStockStore } from '@/app/lib/inventory/stockStore';
import { computePurchaseTax } from '@/app/lib/tax/engine';
import { computeServiceWht } from '@/app/lib/accounting/purchaseWht';
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';
import { filterFinanceApInvoices } from '@/app/lib/accounting/apSubledger';
import { GL_ACCOUNTS } from '@/app/lib/accounting/integration';

export default function AccountsPayablePage() {
  const {
    businessPartners,
    invoices,
    payments,
    chartOfAccounts,
    costCenters,
    bankAccounts,
    isLoading,
    error,
    addBusinessPartner,
    updateBusinessPartner,
    addInvoice,
    updateInvoice,
    addPayment,
    postPayment,
    recordSupplierWHTPayment,

  } = useAccountingStore();
  const { generateNextSupplierCode } = useSupplierStore();
  const { stockItems } = useStockStore();

  const [selectedTab, setSelectedTab] = useState("balances");
  const [isOpen, setIsOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'supplier'|'invoice'|'payment'>('supplier');
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [postOnSave, setPostOnSave] = useState(true);
  const [showAdvancedInvoice, setShowAdvancedInvoice] = useState(false);
  const [isTotalsOpen, setIsTotalsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (dialogType === 'supplier') {
      if (!form.name || String(form.name).trim().length < 2) e.name = 'Name is required';
      if (form.email && !/^([^\s@]+)@([^\s@]+)\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
      if (form.phone && !/^[0-9+\-()\s]{6,}$/.test(form.phone)) e.phone = 'Invalid phone';
      if (form.creditLimit != null && Number(form.creditLimit) < 0) e.creditLimit = 'Must be >= 0';
      if (form.paymentTerms != null && Number(form.paymentTerms) < 0) e.paymentTerms = 'Must be >= 0';
    } else if (dialogType === 'invoice') {
      if (!form.businessPartnerId) e.businessPartnerId = 'Supplier is required';
      if (!form.date) e.date = 'Date is required';
      if (!form.dueDate) e.dueDate = 'Due date is required';
      if (Number(form.total || 0) < 0) e.total = 'Total must be >= 0';
    } else if (dialogType === 'payment') {
      const whtAmount = form.applyWht ? Number(form.whtAmount || 0) : 0;
      if (!form.businessPartnerId) e.businessPartnerId = 'Supplier is required';
      if (!form.date) e.date = 'Date is required';
      if (!(Number(form.amount || 0) + whtAmount > 0)) e.amount = 'Amount must be > 0';
      else if (Number(form.amount || 0) < 0) e.amount = 'Amount must be >= 0';
      if (form.paymentMethod === 'Bank' && !form.bankAccountId) e.bankAccountId = 'Bank account required for Bank payments';
      if (form.invoiceId) {
        const inv = purchaseInvoices.find(i => i.id === form.invoiceId);
        if (inv) {
          const paidForInvoice = payments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
          const outstanding = Math.max(0, (inv.total || 0) - paidForInvoice);
          if (Number(form.amount || 0) + whtAmount > outstanding + 0.01) e.amount = `Amount exceeds outstanding (${formatAccountingCurrency(outstanding)})`;
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Calculate totals — derive from invoices and per-invoice payments to avoid double-counting
  const totalInvoices = useMemo(() => {
    return invoices
      .filter(invoice => invoice.type === 'Purchase')
      .reduce((sum, invoice) => sum + invoice.total, 0);
  }, [invoices]);

  const totalPayments = useMemo(() => {
    return payments
      .filter(payment => payment.type === 'Payment')
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  // Filter purchase invoices — excludes Draft/Void, which have no GL impact and
  // shouldn't count toward payables/aging any more than a Draft/Void sale counts
  // toward receivables (see arSubledger.ts's isFinanceArInvoice, its AR mirror).
  const purchaseInvoices = useMemo(() => {
    return filterFinanceApInvoices(invoices);
  }, [invoices]);

  // Total Payables = sum of per-invoice balances (total − paidAmount on each invoice)
  const totalPayables = useMemo(() => {
    return purchaseInvoices
      .reduce((sum, invoice) => sum + Math.max(0, (invoice.total || 0) - (invoice.paidAmount || 0)), 0);
  }, [purchaseInvoices]);

  // Overdue = the portion of totalPayables whose due date has already passed
  const totalOverduePayables = useMemo(() => {
    const now = new Date();
    return purchaseInvoices
      .reduce((sum, invoice) => {
        const balance = Math.max(0, (invoice.total || 0) - (invoice.paidAmount || 0));
        if (balance <= 0) return sum;
        const dueDate = new Date(invoice.dueDate || invoice.date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysOverdue > 0 ? sum + balance : sum;
      }, 0);
  }, [purchaseInvoices]);

  // Filter suppliers
  const suppliers = useMemo(() => {
    return businessPartners.filter(partner =>
      partner.type === 'Supplier' || partner.type === 'Both'
    );
  }, [businessPartners]);

  // Filter payments
  const supplierPayments = useMemo(() => {
    return payments.filter(payment => payment.type === 'Payment');
  }, [payments]);

  // Supplier Aging Analysis — buckets are each invoice's own remaining balance (total minus
  // what's actually been paid on it), not the gross invoice total, so a partially- or
  // fully-paid overdue invoice doesn't keep showing as fully owed. outstandingBalance is the
  // sum of the same per-invoice balances, so it always reconciles exactly with the buckets.
  const supplierAging = useMemo(() => {
    const now = new Date();
    return suppliers.map(supplier => {
      const supplierInvoices = purchaseInvoices.filter(inv => inv.businessPartnerId === supplier.id);
      const supplierPaymentsFiltered = supplierPayments.filter(pay => pay.businessPartnerId === supplier.id);

      const totalInvoiced = supplierInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalPaid = supplierPaymentsFiltered.reduce((sum, pay) => sum + pay.amount, 0);

      let current = 0, overdue30 = 0, overdue60 = 0, overdue90 = 0, overdue90Plus = 0;
      supplierInvoices.forEach(inv => {
        const paidForInvoice = inv.paidAmount != null
          ? inv.paidAmount
          : supplierPaymentsFiltered.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
        const balance = Math.max(0, (inv.total || 0) - paidForInvoice);
        if (balance <= 0) return;
        const dueDate = new Date(inv.dueDate || inv.date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue <= 0) current += balance;
        else if (daysOverdue <= 30) overdue30 += balance;
        else if (daysOverdue <= 60) overdue60 += balance;
        else if (daysOverdue <= 90) overdue90 += balance;
        else overdue90Plus += balance;
      });

      const outstandingBalance = current + overdue30 + overdue60 + overdue90 + overdue90Plus;

      return {
        ...supplier,
        totalInvoiced,
        totalPaid,
        outstandingBalance,
        current,
        overdue30,
        overdue60,
        overdue90,
        overdue90Plus,
        lastInvoiceDate: supplierInvoices.length > 0 ?
          new Date(Math.max(...supplierInvoices.map(inv => new Date(inv.date).getTime()))).toISOString().slice(0,10) : null,
        lastPaymentDate: supplierPaymentsFiltered.length > 0 ?
          new Date(Math.max(...supplierPaymentsFiltered.map(pay => new Date(pay.date).getTime()))).toISOString().slice(0,10) : null
      };
    });
  }, [suppliers, purchaseInvoices, supplierPayments]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return purchaseInvoices.filter(invoice => {
      // Status filter
      if (statusFilter !== 'all') {
        const paidAmount = (invoice.paidAmount != null)
          ? invoice.paidAmount
          : supplierPayments.filter(p => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
        const balance = invoice.total - paidAmount;
        const dueDate = new Date(invoice.dueDate);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (statusFilter === 'paid' && balance > 0) return false;
        if (statusFilter === 'outstanding' && balance <= 0) return false;
        if (statusFilter === 'overdue' && daysOverdue <= 0) return false;
      }
      
      // Supplier filter
      if (supplierFilter !== 'all' && invoice.businessPartnerId !== supplierFilter) return false;
      
      // Date filters
      if (dateFromFilter && invoice.date < dateFromFilter) return false;
      if (dateToFilter && invoice.date > dateToFilter) return false;
      
      return true;
    });
  }, [purchaseInvoices, supplierPayments, statusFilter, supplierFilter, dateFromFilter, dateToFilter]);

  // Pagination
  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return suppliers.slice(start, start + rowsPerPage);
  }, [suppliers, page]);

  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredInvoices.slice(start, start + rowsPerPage);
  }, [filteredInvoices, page]);

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return supplierPayments.slice(start, start + rowsPerPage);
  }, [supplierPayments, page]);

  const suppliersPages = Math.ceil(suppliers.length / rowsPerPage);
  const invoicesPages = Math.ceil(filteredInvoices.length / rowsPerPage);
  const paymentsPages = Math.ceil(supplierPayments.length / rowsPerPage);

  // Opens the "new invoice" dialog pre-filled for a given supplier — used by every quick-action
  // "Invoice" button so they all create a real invoice instead of misusing `editing` (which
  // must hold an invoice being edited, never a supplier) and silently no-op'ing on save.
  const openNewInvoiceFor = (supplierId: string) => {
    setDialogType('invoice');
    setEditing(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      businessPartnerId: supplierId,
      invoiceNumber: '',
      date: today,
      dueDate: today,
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      description: '',
      lines: [{ id: `INL-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, taxPercent: 20, glAccountCode: '5100' }]
    });
    setIsOpen(true);
  };

  // Opens the "record payment" dialog pre-filled for a given supplier/amount.
  const openNewPaymentFor = (supplierId: string, amount: number, description: string) => {
    setDialogType('payment');
    setEditing(null);
    setForm({
      businessPartnerId: supplierId,
      date: new Date().toISOString().slice(0, 10),
      amount,
      paymentMethod: 'Bank',
      reference: description,
    });
    setIsOpen(true);
  };

  // Opens the "record payment" dialog for a specific invoice, pre-selected and pre-split into
  // cash + any remaining WHT — mirrors the invoice Autocomplete's own selection logic so every
  // entry point into "pay this invoice" behaves the same way.
  const openPaymentForInvoice = (inv: (typeof purchaseInvoices)[number]) => {
    const paidForInvoice = payments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
    const outstanding = Math.max(0, (inv.total || 0) - paidForInvoice);
    const whtConfigured = Number(inv.taxBreakdown?.withholding || 0);
    const whtAlreadyWithheld = payments
      .filter((p: any) => p.invoiceId === inv.id && p.isWHTCertificate)
      .reduce((s: number, p: any) => s + Number(p.whtAmount || p.amount || 0), 0);
    const whtRemaining = Math.min(outstanding, Math.max(0, whtConfigured - whtAlreadyWithheld));
    const applyWht = whtRemaining > 0;
    const amount = Math.max(0, outstanding - (applyWht ? whtRemaining : 0));
    setDialogType('payment');
    setEditing(null);
    setForm({
      businessPartnerId: inv.businessPartnerId,
      invoiceId: inv.id,
      date: new Date().toISOString().slice(0, 10),
      amount,
      applyWht,
      whtAmount: whtRemaining,
      paymentMethod: 'Bank',
      reference: `Payment for invoice ${inv.invoiceNumber}`,
    });
    setIsOpen(true);
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
        <h1 className="text-3xl font-bold text-gray-900">💳 Accounts Payable</h1>
        <p className="text-gray-600 mt-2">
          Manage supplier accounts, purchase invoices, and payments
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-red-600">{formatAccountingCurrency(totalPayables)}</div>
            <div className="text-sm text-gray-600">Total Payables</div>
            <Progress value={100} size="sm" color="danger" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-orange-600">{formatAccountingCurrency(totalOverduePayables)}</div>
            <div className="text-sm text-gray-600">Overdue</div>
            <Progress value={100} size="sm" color="warning" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">{formatAccountingCurrency(totalInvoices)}</div>
            <div className="text-sm text-gray-600">Total Invoices</div>
            <Progress value={100} size="sm" color="primary" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatAccountingCurrency(totalPayments)}</div>
            <div className="text-sm text-gray-600">Total Payments</div>
            <Progress value={100} size="sm" color="success" className="mt-2" />
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
            <Tab key="balances" title="📊 Supplier Balances & Aging">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Supplier Balance Analysis</h3>
                  <div className="flex gap-2">
                  <Button size="sm" color="primary" onClick={() => { 
                      setDialogType('supplier'); 
                      setEditing(null);
                      setForm({
                        code: generateNextSupplierCode(),
                        name: '',
                        contactPerson: '',
                        email: '',
                        phone: '',
                        address: '',
                        city: '',
                        country: 'Ghana',
                        postalCode: '',
                        taxNumber: '',
                        paymentTerms: 'net30',
                        creditLimit: 0,
                        currentBalance: 0,
                        rating: 0,
                        categories: [],
                        isActive: true
                      }); 
                      setIsOpen(true); 
                    }}>
                      ➕ Add Supplier
                    </Button>
                  </div>
                </div>

                <Table aria-label="Supplier Aging">
                  <TableHeader>
                    <TableColumn>SUPPLIER</TableColumn>
                    <TableColumn className="text-right">OUTSTANDING</TableColumn>
                    <TableColumn className="text-right">CURRENT</TableColumn>
                    <TableColumn className="text-right">1-30 DAYS</TableColumn>
                    <TableColumn className="text-right">31-60 DAYS</TableColumn>
                    <TableColumn className="text-right">61-90 DAYS</TableColumn>
                    <TableColumn className="text-right">90+ DAYS</TableColumn>
                    <TableColumn>LAST ACTIVITY</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No supplier data found.">
                    {supplierAging.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell>
                          <div className="font-medium">{supplier.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{supplier.code}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {formatAccountingCurrency(supplier.outstandingBalance)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatAccountingCurrency(supplier.current)}
                        </TableCell>
                        <TableCell className="text-right text-yellow-600">
                          {formatAccountingCurrency(supplier.overdue30)}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {formatAccountingCurrency(supplier.overdue60)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatAccountingCurrency(supplier.overdue90)}
                        </TableCell>
                        <TableCell className="text-right text-red-800 font-bold">
                          {formatAccountingCurrency(supplier.overdue90Plus)}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div>Invoice: {supplier.lastInvoiceDate || 'Never'}</div>
                            <div>Payment: {supplier.lastPaymentDate || 'Never'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="bordered" onClick={() => openNewInvoiceFor(supplier.id)}>📄 Invoice</Button>
                            <Button size="sm" color="danger" variant="bordered" onClick={() => openNewPaymentFor(supplier.id, supplier.outstandingBalance || 0, `Payment to ${supplier.name}`)}>💳 Payment</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="suppliers" title="🏢 Suppliers">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Supplier Accounts</h3>
                  <Button color="primary" startContent={<span>➕</span>} onClick={() => { 
                    setDialogType('supplier'); 
                    setEditing(null); 
                    setForm({
                      code: generateNextSupplierCode(),
                      name: '',
                      contactPerson: '',
                      email: '',
                      phone: '',
                      address: '',
                      city: '',
                      country: 'Ghana',
                      postalCode: '',
                      taxNumber: '',
                      paymentTerms: 'net30',
                      creditLimit: 0,
                      currentBalance: 0,
                      rating: 0,
                      categories: [],
                      isActive: true
                    }); 
                    setIsOpen(true); 
                  }}>
                    Add Supplier
                  </Button>
                </div>

                <Table aria-label="Supplier Accounts">
                  <TableHeader>
                    <TableColumn>SUPPLIER</TableColumn>
                    <TableColumn>CONTACT INFO</TableColumn>
                    <TableColumn>ADDRESS</TableColumn>
                    <TableColumn className="text-right">CREDIT LIMIT</TableColumn>
                    <TableColumn className="text-right">CURRENT BALANCE</TableColumn>
                    <TableColumn>PAYMENT TERMS</TableColumn>
                    <TableColumn>LAST ACTIVITY</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No suppliers found.">
                    {paginatedSuppliers.map((supplier) => {
                      const supplierInvoices = purchaseInvoices.filter(inv => inv.businessPartnerId === supplier.id);
                      const supplierPaymentsFiltered = supplierPayments.filter(pay => pay.businessPartnerId === supplier.id);
                      const totalInvoiced = supplierInvoices.reduce((sum, inv) => sum + inv.total, 0);
                      const totalPaid = supplierPaymentsFiltered.reduce((sum, pay) => sum + pay.amount, 0);
                      const lastInvoiceDate = supplierInvoices.length > 0 ?
                        new Date(Math.max(...supplierInvoices.map(inv => new Date(inv.date).getTime()))).toISOString().slice(0,10) : null;
                      const lastPaymentDate = supplierPaymentsFiltered.length > 0 ?
                        new Date(Math.max(...supplierPaymentsFiltered.map(pay => new Date(pay.date).getTime()))).toISOString().slice(0,10) : null;
                      // supplier.balance is a stored field nudged by many scattered call sites and
                      // directly hand-editable — it can and does drift from the real invoice-derived
                      // balance. Use the same live computation the Aging tab already gets right,
                      // instead of a second, unreliable number for the same thing.
                      const outstandingBalance = supplierAging.find(a => a.id === supplier.id)?.outstandingBalance ?? 0;

                      return (
                        <TableRow key={supplier.id}>
                          <TableCell>
                            <div className="font-medium">{supplier.name}</div>
                            <div className="text-xs text-gray-500 font-mono">{supplier.code}</div>
                            <div className="text-xs text-gray-500">{supplier.taxNumber || 'No Tax ID'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {supplier.contactPerson && <div className="font-medium">{supplier.contactPerson}</div>}
                              {supplier.email && <div className="text-blue-600">{supplier.email}</div>}
                              {supplier.phone && <div className="text-gray-600">{supplier.phone}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {supplier.address && <div>{supplier.address}</div>}
                              {supplier.countryCode && <div>{supplier.countryCode}</div>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium">{formatAccountingCurrency((supplier.creditLimit || 0))}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className={`font-semibold ${outstandingBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatAccountingCurrency(Math.abs(outstandingBalance))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {supplier.paymentTerms ? `${supplier.paymentTerms} days` : 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div>Invoice: {lastInvoiceDate || 'Never'}</div>
                              <div>Payment: {lastPaymentDate || 'Never'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip
                              color={
                                outstandingBalance > (supplier.creditLimit || 0) ? 'danger' :
                                outstandingBalance > 0 ? 'warning' :
                                'success'
                              }
                              variant="flat"
                              size="sm"
                            >
                              {outstandingBalance > (supplier.creditLimit || 0) ? 'Over Limit' :
                               outstandingBalance > 0 ? 'Outstanding' :
                               'Current'}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="bordered" onClick={() => { 
                                setDialogType('supplier'); 
                                setEditing(supplier); 
                                // Map BusinessPartner to form fields matching inventory form
                                setForm({ 
                                  ...supplier,
                                  code: supplier.code,
                                  name: supplier.name,
                                  contactPerson: supplier.contactPerson || '',
                                  email: supplier.email || '',
                                  phone: supplier.phone || '',
                                  taxNumber: supplier.taxNumber || '',
                                  taxId: supplier.taxNumber || '', // Also map taxId for compatibility
                                  address: supplier.address || '',
                                  city: '', // BusinessPartner doesn't have city
                                  country: supplier.countryCode === 'GH' ? 'Ghana' : supplier.countryCode || 'Ghana',
                                  postalCode: '', // BusinessPartner doesn't have postalCode
                                  paymentTerms: supplier.paymentTerms === 0 ? 'immediate' :
                                                supplier.paymentTerms === 30 ? 'net30' :
                                                supplier.paymentTerms === 60 ? 'net60' :
                                                supplier.paymentTerms === 90 ? 'net90' : 'net30',
                                  creditLimit: supplier.creditLimit || 0,
                                  currentBalance: outstandingBalance,
                                  rating: 0, // BusinessPartner doesn't have rating
                                  categories: [], // BusinessPartner doesn't have categories
                                  isActive: supplier.isActive !== undefined ? supplier.isActive : true
                                }); 
                                setIsOpen(true); 
                              }}>✏️ Edit</Button>
                              <Button size="sm" color="primary" variant="bordered" onClick={() => openNewInvoiceFor(supplier.id)}>📄 Invoice</Button>
                              {outstandingBalance > 0 && (
                                <Button size="sm" color="danger" variant="bordered" onClick={() => openNewPaymentFor(supplier.id, outstandingBalance, `Payment to ${supplier.name}`)}>💳 Payment</Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {suppliersPages > 1 && (
                  <div className="flex justify-center mt-4 p-4">
                    <Pagination 
                      total={suppliersPages} 
                      page={page} 
                      onChange={setPage}
                      showControls
                    />
                  </div>
                )}
              </div>
            </Tab>

            <Tab key="invoices" title="📄 Bills (Purchases)">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Bills (Purchases)</h3>
                  <Button color="primary" startContent={<span>➕</span>} onClick={() => {
                    setDialogType('invoice');
                    setEditing(null);
                    const today = new Date().toISOString().slice(0,10);
                    setForm({
                      businessPartnerId: (suppliers[0]?.id) || '',
                      invoiceNumber: '',
                      date: today,
                      dueDate: today,
                      subtotal: 0,
                      taxAmount: 0,
                      total: 0,
                      description: '',
                      lines: [{ id: `INL-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, taxPercent: 20, glAccountCode: '5100' }]
                    });
                    setIsOpen(true);
                  }}>
                  Add Bill
                  </Button>
                </div>


                {/* Invoice Filters */}
                <div className="flex gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <Select 
                    placeholder="Filter by Status" 
                    className="w-48"
                    selectedKeys={[statusFilter]}
                    onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0] as string)}
                  >
                    <SelectItem key="all">All Status</SelectItem>
                    <SelectItem key="outstanding">Outstanding</SelectItem>
                    <SelectItem key="overdue">Overdue</SelectItem>
                    <SelectItem key="paid">Paid</SelectItem>
                  </Select>
                  <Select 
                    placeholder="Filter by Supplier" 
                    className="w-48"
                    selectedKeys={[supplierFilter]}
                    onSelectionChange={(keys) => setSupplierFilter(Array.from(keys)[0] as string)}
                  >
                    <SelectItem key="all">All Suppliers</SelectItem>
                    <>
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier.id}>{supplier.name}</SelectItem>
                      ))}
                    </>
                  </Select>
                  <Input 
                    type="date" 
                    placeholder="From Date" 
                    className="w-40"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                  />
                  <Input 
                    type="date" 
                    placeholder="To Date" 
                    className="w-40"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                  />
                </div>

              <Table aria-label="Bills">
                  <TableHeader>
                    <TableColumn>INVOICE #</TableColumn>
                    <TableColumn>SUPPLIER</TableColumn>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn>DUE DATE</TableColumn>
                    <TableColumn className="text-right">SUBTOTAL</TableColumn>
                    <TableColumn className="text-right">TAX</TableColumn>
                    <TableColumn className="text-right">TOTAL</TableColumn>
                    <TableColumn className="text-right">PAID</TableColumn>
                    <TableColumn className="text-right">BALANCE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>AGING</TableColumn>
                    <TableColumn>APPROVAL</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No purchase invoices found.">
                    {paginatedInvoices.map((invoice) => {
                      const supplier = suppliers.find(s => s.id === invoice.businessPartnerId);
                      // Use per-invoice paidAmount from store; fall back to invoice-linked payments
                      const paidAmount = (invoice.paidAmount != null)
                        ? invoice.paidAmount
                        : supplierPayments.filter(p => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
                      const balance = invoice.total - paidAmount;
                      const dueDate = new Date(invoice.dueDate);
                      const today = new Date();
                      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                      
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            <div className="font-mono font-medium">{invoice.invoiceNumber}</div>
                            <div className="text-xs text-gray-500">{invoice.poNumber || 'No PO'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{supplier?.name || 'Unknown Supplier'}</div>
                            <div className="text-xs text-gray-500">{supplier?.code || invoice.businessPartnerId}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{new Date(invoice.date).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-500">{new Date(invoice.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{new Date(invoice.dueDate).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-500">{new Date(invoice.dueDate).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium">{formatAccountingCurrency(invoice.subtotal)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="text-sm">{formatAccountingCurrency(invoice.taxAmount)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-semibold text-red-600">{formatAccountingCurrency(invoice.total)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="text-green-600">{formatAccountingCurrency(paidAmount)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatAccountingCurrency(balance)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              color={
                                balance <= 0 ? 'success' : 
                                daysOverdue > 30 ? 'danger' : 
                                daysOverdue > 0 ? 'warning' : 
                                'primary'
                              } 
                              variant="flat" 
                              size="sm"
                            >
                              {balance <= 0 ? 'Paid' : 
                               daysOverdue > 0 ? 'Overdue' : 
                               'Outstanding'}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            {daysOverdue > 0 ? (
                              <div className="text-xs text-red-600 font-medium">
                                {daysOverdue} days overdue
                              </div>
                            ) : daysOverdue === 0 ? (
                              <div className="text-xs text-yellow-600 font-medium">
                                Due today
                              </div>
                            ) : (
                              <div className="text-xs text-green-600">
                                {Math.abs(daysOverdue)} days left
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              color={
                                invoice.status === 'Paid' ? 'success' : 
                                invoice.status === 'Posted' ? 'primary' : 
                                invoice.status === 'Void' ? 'danger' : 
                                'default'
                              } 
                              variant="flat" 
                              size="sm"
                            >
                              {invoice.status}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="bordered" onClick={() => { 
                                setDialogType('invoice'); 
                                setEditing(invoice); 
                                setForm({
                                  businessPartnerId: invoice.businessPartnerId,
                                  invoiceNumber: invoice.invoiceNumber,
                                  date: invoice.date.slice(0,10),
                                  dueDate: invoice.dueDate.slice(0,10),
                                  subtotal: invoice.subtotal,
                                  taxAmount: invoice.taxAmount,
                                  total: invoice.total,
                                  currency: invoice.currency,
                                  description: invoice.description
                                }); 
                                setIsOpen(true); 
                              }}>✏️ Edit</Button>
                              {balance > 0 && (
                                <Button size="sm" color="danger" variant="bordered" onClick={() => openPaymentForInvoice(invoice)}>💳 Payment</Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {invoicesPages > 1 && (
                  <div className="flex justify-center mt-4 p-4">
                    <Pagination 
                      total={invoicesPages} 
                      page={page} 
                      onChange={setPage}
                      showControls
                    />
                  </div>
                )}
              </div>
            </Tab>

            <Tab key="payments" title="💸 Payments">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Supplier Payments</h3>
                  <Button color="primary" startContent={<span>➕</span>} onClick={() => { setDialogType('payment'); setEditing(null); setForm({ businessPartnerId: suppliers[0]?.id || '', date: new Date().toISOString().slice(0,10), amount: 0, paymentMethod: 'Bank', reference: '' }); setIsOpen(true); }}>
                    Record Payment
                  </Button>
                </div>

                <Table aria-label="Supplier Payments">
                  <TableHeader>
                    <TableColumn>PAYMENT #</TableColumn>
                    <TableColumn>SUPPLIER</TableColumn>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn className="text-right">AMOUNT</TableColumn>
                    <TableColumn>METHOD</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No payments found.">
                    {paginatedPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <span className="font-mono font-medium">{payment.paymentNumber}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{payment.businessPartnerId}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {new Date(payment.date).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatAccountingCurrency(payment.amount)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip variant="flat" size="sm">
                            {payment.paymentMethod}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            color={
                              payment.status === 'Posted' ? 'success' : 
                              payment.status === 'Draft' ? 'default' : 
                              'danger'
                            } 
                            variant="flat" 
                            size="sm"
                          >
                            {payment.status}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="bordered" onClick={() => { setDialogType('payment'); setEditing(payment); setForm({
                              businessPartnerId: payment.businessPartnerId,
                              date: payment.date.slice(0,10),
                              amount: payment.amount,
                              paymentMethod: payment.paymentMethod,
                              reference: payment.reference || '',
                              invoiceId: payment.invoiceId || '',
                              bankAccountId: payment.bankAccountId || '',
                              checkNumber: payment.checkNumber || '',
                              receivedBy: payment.receivedBy || '',
                              receiverContact: payment.receiverContact || '',
                              receiverIdType: payment.receiverIdType || '',
                              receiverIdNumber: payment.receiverIdNumber || '',
                              receivedDate: payment.receivedDate ? payment.receivedDate.slice(0,10) : '',
                              receiverSignature: payment.receiverSignature || '',
                              attachments: payment.attachments || [],
                              pdfUrl: payment.pdfUrl || '',
                              pdfFileName: payment.pdfFileName || ''
                            }); setIsOpen(true); }}>✏️ Edit</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {paymentsPages > 1 && (
                  <div className="flex justify-center mt-4 p-4">
                    <Pagination 
                      total={paymentsPages} 
                      page={page} 
                      onChange={setPage}
                      showControls
                    />
                  </div>
                )}
              </div>
            </Tab>

          </Tabs>
        </CardBody>
      </Card>

      {/* Create/Edit Dialog */}
      <ModalContainer
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={dialogType === 'supplier' ? (editing ? 'Edit Supplier' : 'Add Supplier') : dialogType === 'invoice' ? (editing ? 'Edit Purchase Invoice' : 'Add Purchase Invoice') : (editing ? 'Edit Payment' : 'Record Payment')}
        onSave={() => {
          if (!validate()) return;
          if (dialogType === 'supplier') {
            // Convert payment terms string to number if needed
            let paymentTermsDays = 30;
            if (typeof form.paymentTerms === 'string') {
              const paymentTermsMap: Record<string, number> = {
                'immediate': 0,
                'net30': 30,
                'net60': 60,
                'net90': 90
              };
              paymentTermsDays = paymentTermsMap[form.paymentTerms] !== undefined ? paymentTermsMap[form.paymentTerms] : 30;
            } else if (typeof form.paymentTerms === 'number') {
              paymentTermsDays = form.paymentTerms;
            }

            const payload: import('@/app/lib/accounting/models').BusinessPartner = {
              id: editing?.id || `BP-${Date.now()}`,
              code: form.code || generateNextSupplierCode(),
              name: form.name || '',
              type: 'Supplier' as const,
              taxNumber: form.taxNumber || form.taxId || '',
              address: form.address || '',
              phone: form.phone || '',
              email: form.email || '',
              contactPerson: form.contactPerson || '',
              creditLimit: Number(form.creditLimit || 0),
              paymentTerms: paymentTermsDays,
              glAccountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE,
              currency: form.currency || 'GHS',
              balance: Number(form.currentBalance || editing?.balance || 0),
              isActive: form.isActive !== undefined ? form.isActive !== false : true,
              countryCode: form.country === 'Ghana' ? 'GH' : (form.country || 'GH'),
              createdAt: editing?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              // Preserve bank details if they exist
              bankName: form.bankName,
              bankAccountNumber: form.bankAccountNumber,
              bankSwift: form.bankSwift,
              bankIban: form.bankIban
            };
            if (editing) updateBusinessPartner(editing.id, payload); else addBusinessPartner(payload);
          } else if (dialogType === 'invoice') {
            // duplicate invoice check
            const dup = purchaseInvoices.some((inv)=> inv.invoiceNumber === (form.invoiceNumber||'') && inv.businessPartnerId === form.businessPartnerId && (!editing || inv.id !== editing.id));
            if (dup) { setErrors({ invoiceNumber: 'Duplicate invoice for this supplier' }); return; }
            const invId = editing?.id || `INV-${Date.now()}`;
            const lines = (form.lines || []).map((ln: any, idx: number) => {
              const amount = +(Number(ln.quantity || 0) * Number(ln.unitPrice || 0)).toFixed(2);
              const taxAmount = +((amount * Number(ln.taxPercent || 0)) / 100).toFixed(2);
              return {
                id: ln.id || `INL-${Date.now()}-${idx}`,
                invoiceId: invId,
                description: ln.description || '',
                quantity: Number(ln.quantity || 0),
                unitPrice: Number(ln.unitPrice || 0),
                amount,
                taxAmount,
                glAccountCode: ln.glAccountCode || '5100'
              };
            });
            const subtotalFromLines = lines.reduce((s: number, l: any) => s + l.amount, 0);
            const taxFromLines = lines.reduce((s: number, l: any) => s + l.taxAmount, 0);
            const payload = {
              id: invId,
              invoiceNumber: form.invoiceNumber || `PINV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
              type: 'Purchase' as const,
              date: (form.date ? new Date(form.date) : new Date()).toISOString(),
              dueDate: (form.dueDate ? new Date(form.dueDate) : new Date()).toISOString(),
              businessPartnerId: form.businessPartnerId,
              description: form.description || 'Purchase invoice',
              subtotal: +(Number(form.subtotal ?? subtotalFromLines)).toFixed(2),
              taxAmount: +(Number(form.taxAmount ?? taxFromLines)).toFixed(2),
              total: +((Number(form.subtotal ?? subtotalFromLines)) + (Number(form.taxAmount ?? taxFromLines))).toFixed(2),
              currency: form.currency || 'GHS',
              status: editing?.status || 'Posted',
              paidAmount: editing?.paidAmount || 0,
              createdAt: editing?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              poNumber: form.poNumber || '',
              receiptNumber: form.receiptNumber || '',
              attachments: form.attachments || [],
              discountAmount: Number(form.discountAmount || 0),
              shippingCharges: Number(form.shippingCharges || 0),
              otherCharges: Number(form.otherCharges || 0),
              amountDue: +(((Number(form.subtotal ?? subtotalFromLines)) + (Number(form.taxAmount ?? taxFromLines)) + Number(form.shippingCharges || 0) + Number(form.otherCharges || 0) - Number(form.discountAmount || 0) - Number(form.taxBreakdown?.withholding || 0)) - Number(form.paidAmount || 0)).toFixed(2),
              workflowStatus: form.workflowStatus || 'Posted',
              taxBreakdown: form.taxBreakdown || undefined,
              lines
            } as any;
            if (editing) updateInvoice(editing.id, payload); else addInvoice(payload);
          } else if (dialogType === 'payment' && !editing && form.applyWht && form.invoiceId && Number(form.whtAmount || 0) > 0) {
            const result = recordSupplierWHTPayment({
              invoiceId: form.invoiceId,
              cashAmount: Number(form.amount || 0),
              whtAmount: Number(form.whtAmount || 0),
              paymentMethod: form.paymentMethod || 'Bank',
              bankAccountId: form.bankAccountId || undefined,
              reference: form.reference || undefined,
            });
            if (!result) {
              setErrors({ amount: 'Could not record payment — check the amount against the outstanding balance.' });
              return;
            }
          } else if (dialogType === 'payment') {
            const payload = {
              id: editing?.id || `PAY-${Date.now()}`,
              paymentNumber: editing?.paymentNumber || `AP-PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
              date: (form.date ? new Date(form.date) : new Date()).toISOString(),
              type: 'Payment' as const,
              businessPartnerId: form.businessPartnerId,
              invoiceId: form.invoiceId || undefined,
              description: form.reference || 'Supplier payment',
              amount: Number(form.amount || 0),
              currency: 'GHS',
              paymentMethod: form.paymentMethod || 'Bank',
              bankAccountId: form.bankAccountId || undefined,
              checkNumber: form.checkNumber || undefined,
              status: 'Draft' as const,
              // receipt/pdf
              receivedBy: form.receivedBy,
              receiverContact: form.receiverContact,
              receiverIdType: form.receiverIdType,
              receiverIdNumber: form.receiverIdNumber,
              receivedDate: form.receivedDate,
              receiverSignature: form.receiverSignature,
              attachments: form.attachments,
              pdfUrl: form.pdfUrl,
              pdfFileName: form.pdfFileName,
              createdAt: editing?.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            if (editing) {
              // No updatePayment in store; treat as add new for simplicity
              addPayment(payload as any);
            } else {
              addPayment(payload as any);
            }
            // Post the payment to create JE and bank transaction
            if (postOnSave) {
              try { postPayment(payload.id); } catch {}
            }
          }
          setIsOpen(false);
          setEditing(null);
          setForm({});
        }}
      >
        {dialogType === 'supplier' && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Supplier Code"
              value={form.code || ''}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Auto-generated"
              isDisabled={!editing}
              description={editing ? "Code can be edited" : "Code is auto-generated"}
              isRequired
            />
            <div>
              <Input
                label="Supplier Name"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter supplier name"
                isRequired
              />
              {errors.name && <div className="text-red-600 text-xs mt-1">{errors.name}</div>}
            </div>
            <Input
              label="Contact Person"
              value={form.contactPerson || ''}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="Contact person name"
              isRequired
            />
            <div>
              <Input
                label="Email"
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="supplier@email.com"
                isRequired
              />
              {errors.email && <div className="text-red-600 text-xs mt-1">{errors.email}</div>}
            </div>
            <div>
              <Input
                label="Phone"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+233 XX XXX XXXX"
                isRequired
              />
              {errors.phone && <div className="text-red-600 text-xs mt-1">{errors.phone}</div>}
            </div>
            <Input
              label="Tax ID"
              value={form.taxNumber || ''}
              onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
              placeholder="e.g., GH123456789"
            />
            <Textarea
              label="Address"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street address"
              className="col-span-2"
              isRequired
            />
            <Input
              label="City"
              value={form.city || ''}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="City"
              isRequired
            />
            <Input
              label="Country"
              value={form.country || 'Ghana'}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder="Country"
            />
            <Input
              label="Postal Code"
              value={form.postalCode || ''}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              placeholder="Postal code"
            />
            <Select
              label="Payment Terms"
              selectedKeys={form.paymentTerms !== undefined && form.paymentTerms !== null ? [form.paymentTerms.toString()] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                // Convert string back to number for BusinessPartner
                const paymentTermsMap: Record<string, number> = {
                  'immediate': 0,
                  'net30': 30,
                  'net60': 60,
                  'net90': 90
                };
                // If it's already a number string, use it directly
                const value = paymentTermsMap[selected] !== undefined ? paymentTermsMap[selected] : (selected === '0' || selected === '30' || selected === '60' || selected === '90' ? parseInt(selected) : 30);
                setForm({ ...form, paymentTerms: value });
              }}
              value={form.paymentTerms?.toString() || '30'}
            >
              <SelectItem key="immediate">Immediate</SelectItem>
              <SelectItem key="net30">Net 30</SelectItem>
              <SelectItem key="net60">Net 60</SelectItem>
              <SelectItem key="net90">Net 90</SelectItem>
            </Select>
            <div>
              <Input
                label="Credit Limit (₵)"
                type="number"
                value={form.creditLimit?.toString() || '0'}
                onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })}
                isRequired
              />
              {errors.creditLimit && <div className="text-red-600 text-xs mt-1">{errors.creditLimit}</div>}
            </div>
            <Input
              label="Rating (1-5)"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={form.rating?.toString() || '0'}
              onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Current Balance (₵)"
              type="number"
              value={form.currentBalance?.toString() || (editing?.balance?.toString() || '0')}
              onChange={(e) => setForm({ ...form, currentBalance: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Categories (comma separated)"
              value={form.categories?.join(', ') || ''}
              onChange={(e) => setForm({ 
                ...form, 
                categories: e.target.value.split(',').map(c => c.trim()).filter(c => c) 
              })}
              placeholder="e.g., food, beverage, cleaning"
              className="col-span-2"
            />
            <div className="col-span-2">
              <Chip
                color={form.isActive !== false ? 'success' : 'default'}
                onClick={() => setForm({ ...form, isActive: !(form.isActive !== false) })}
                className="cursor-pointer"
              >
                {form.isActive !== false ? '✓ Active' : 'Inactive'}
              </Chip>
            </div>
            <Input
              label="Bank Name"
              value={form.bankName || ''}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="Bank name"
            />
            <Input
              label="Bank Account #"
              value={form.bankAccountNumber || ''}
              onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
              placeholder="Account number"
            />
            <Input
              label="SWIFT/BIC"
              value={form.bankSwift || ''}
              onChange={(e) => setForm({ ...form, bankSwift: e.target.value })}
              placeholder="SWIFT code"
            />
            <Input
              label="IBAN"
              value={form.bankIban || ''}
              onChange={(e) => setForm({ ...form, bankIban: e.target.value })}
              placeholder="IBAN"
            />

            {Array.isArray(form.taxComponents) && form.taxComponents.length > 0 && (
              <div className="col-span-2 p-3 border rounded mt-2">
                <div className="font-semibold mb-2">Tax Components (from Compliance)</div>
                <Table aria-label="Tax Components">
                  <TableHeader>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>GL CODE</TableColumn>
                    <TableColumn>AMOUNT</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {form.taxComponents.map((t: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell><span className="font-mono text-sm">{t.glCode}</span></TableCell>
                        <TableCell>{formatAccountingCurrency(Number(t.amount||0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
        {dialogType === 'invoice' && (
          <div className="space-y-4">
            {/* Header bar */}
            <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
              <div className="flex items-center gap-2">
                <Chip size="sm" color={editing ? 'primary' : 'default'} variant="flat">{editing ? 'Editing' : 'Draft'}</Chip>
                <span className="text-sm text-gray-600">Purchase Invoice</span>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Invoice #</div>
                <div className="font-mono text-sm">{form.invoiceNumber || 'Auto'}</div>
              </div>
            </div>

            {/* Two-column layout with summary */}
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                {/* Party & Document */}
                <div className="grid grid-cols-3 gap-4">
              <Select size="sm" label="Supplier" selectedKeys={[form.businessPartnerId || suppliers[0]?.id]} onSelectionChange={(keys) => setForm({ ...form, businessPartnerId: Array.from(keys)[0] })}>
                {suppliers.map(s => (<SelectItem key={s.id}>{s.name}</SelectItem>))}
              </Select>
              <Input size="sm" label="Invoice #" value={form.invoiceNumber || ''} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
              <Input size="sm" label="PO Number" value={form.poNumber || ''} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-3 gap-4">
              <div>
                <Input size="sm" type="date" label="Date" value={form.date || new Date().toISOString().slice(0,10)} onChange={(e) => setForm({ ...form, date: e.target.value, dueDate: (() => { const d = new Date(e.target.value); const supplier = suppliers.find(s => s.id === (form.businessPartnerId || suppliers[0]?.id)); const terms = supplier?.paymentTerms || 0; const due = new Date(d.getTime() + terms * 86400000); return due.toISOString().slice(0,10); })() })} />
                {errors.date && <div className="text-red-600 text-xs mt-1">{errors.date}</div>}
              </div>
              <div>
                <Input size="sm" type="date" label="Due Date" value={form.dueDate || new Date().toISOString().slice(0,10)} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                {errors.dueDate && <div className="text-red-600 text-xs mt-1">{errors.dueDate}</div>}
              </div>
              <Input size="sm" label="Receipt/Delivery Note" value={form.receiptNumber || ''} onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })} />
                </div>

                {/* Supplier preview card */}
                {(() => {
                  const sup = suppliers.find(s => s.id === (form.businessPartnerId || suppliers[0]?.id));
                  if (!sup) return null;
                  const terms = sup.paymentTerms ?? 0;
                  return (
                    <Card>
                      <CardBody className="grid grid-cols-3 gap-4 text-sm text-gray-700">
                        <div>
                          <div className="font-medium">Supplier</div>
                          <div>{sup.name}</div>
                          {sup.contactPerson && <div className="text-xs text-gray-500">Attn: {sup.contactPerson}</div>}
                        </div>
                        <div>
                          <div className="font-medium">Contact</div>
                          <div className="text-xs text-gray-500">{sup.phone || '-'}{sup.email ? ` · ${sup.email}` : ''}</div>
                        </div>
                        <div>
                          <div className="font-medium">Terms</div>
                          <div className="text-xs text-gray-500">Net {terms} days</div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })()}

                {/* Money */}
                <div className="grid grid-cols-4 gap-4">
              <Input size="sm" label="Currency" value={form.currency || 'GHS'} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              <Input size="sm" type="number" label="Exchange Rate" value={form.exchangeRate ?? 1} onChange={(e) => setForm({ ...form, exchangeRate: parseFloat(e.target.value) || 1 })} />
              <Input size="sm" type="number" label="Subtotal" value={form.subtotal ?? 0} onChange={(e) => {
                const subtotal = parseFloat(e.target.value) || 0;
                const taxAmount = computePurchaseTax(subtotal).totalTax;
                const whtAmount = form.whtApplicable ? (computeServiceWht(subtotal)?.amount || 0) : form.taxBreakdown?.withholding;
                setForm({ ...form, subtotal, taxAmount, total: +(subtotal + taxAmount).toFixed(2), taxBreakdown: { ...(form.taxBreakdown || {}), withholding: whtAmount } });
              }} />
              <Input size="sm" type="number" label="Tax Amount" value={form.taxAmount ?? 0} onChange={(e) => {
                const taxAmount = parseFloat(e.target.value) || 0;
                const subtotal = Number(form.subtotal || 0);
                setForm({ ...form, taxAmount, total: +(subtotal + taxAmount).toFixed(2) });
              }} />
                </div>
            {/* Totals quick view */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">Totals are calculated automatically.</div>
              <Button size="sm" variant="bordered" onClick={()=> setIsTotalsOpen(true)}>View Totals</Button>
            </div>
            {/* Total shown in summary card */}
            {errors.total && <div className="text-red-600 text-xs mt-1">{errors.total}</div>}
            <Input size="sm" label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            {errors.businessPartnerId && <div className="text-red-600 text-xs">{errors.businessPartnerId}</div>}

            {/* Tax Options - simplified */}
            <div className="grid grid-cols-4 gap-4 p-3 border rounded">
              <Select size="sm" label="Tax Type" selectedKeys={[form.taxType || 'STANDARD']} onSelectionChange={(keys)=> {
                const v = Array.from(keys)[0] as string;
                if (v === 'NONE') {
                  const subtotal = Number(form.subtotal||0);
                  setForm({ ...form, taxType: 'NONE', taxAmount: 0, total: +(subtotal).toFixed(2) });
                } else {
                  setForm({ ...form, taxType: v });
                }
              }}>
                <SelectItem key="STANDARD">Standard (Purchase stack)</SelectItem>
                <SelectItem key="CUSTOM">Custom Rate</SelectItem>
                <SelectItem key="NONE">No Tax</SelectItem>
              </Select>
              {form.taxType === 'CUSTOM' && (
                <Input size="sm" type="number" label="Custom Rate %" value={form.customTaxPercent ?? 0} onChange={(e)=> setForm({ ...form, customTaxPercent: parseFloat(e.target.value)||0 })} />
              )}
              <div className="col-span-1 flex items-end">
                <Button size="sm" variant="bordered" onClick={() => {
                  const subtotal = Number(form.subtotal||0);
                  if ((form.taxType||'STANDARD') === 'CUSTOM') {
                    const rate = Number(form.customTaxPercent||0)/100;
                    const taxAmount = +(subtotal*rate).toFixed(2);
                    setForm({ ...form, taxAmount, total: +(subtotal+taxAmount).toFixed(2) });
                    return;
                  }
                  if ((form.taxType||'STANDARD') === 'NONE') {
                    setForm({ ...form, taxAmount: 0, total: subtotal });
                    return;
                  }
                  const { totalTax } = computePurchaseTax(subtotal);
                  const taxAmount = +totalTax.toFixed(2);
                  setForm({ ...form, taxAmount, total: +(subtotal + taxAmount).toFixed(2) });
                }}>Apply Tax</Button>
              </div>
            </div>

            {/* Withholding Tax (Purchases) — real rate from the compliance tax-rule engine */}
            <div className="grid grid-cols-4 gap-4 p-3 border rounded items-end">
              <div className="col-span-4 sm:col-span-1 flex items-center h-10">
                <Checkbox isSelected={!!form.whtApplicable} onValueChange={(checked) => {
                  const subtotal = Number(form.subtotal || 0);
                  if (checked) {
                    const wht = computeServiceWht(subtotal);
                    setForm({ ...form, whtApplicable: true, taxBreakdown: { ...(form.taxBreakdown || {}), withholding: wht?.amount || 0 } });
                  } else {
                    const tb = { ...(form.taxBreakdown || {}) };
                    delete tb.withholding;
                    setForm({ ...form, whtApplicable: false, taxBreakdown: tb });
                  }
                }}>Service invoice — withhold tax</Checkbox>
              </div>
              {form.whtApplicable && (() => {
                const wht = computeServiceWht(Number(form.subtotal || 0));
                if (!wht) {
                  return <div className="col-span-3 text-xs text-amber-600">No active WHT rule for services — configure one in Books &amp; Taxes → Tax Rate Builder (Purchases).</div>;
                }
                return (
                  <>
                    <Input size="sm" isReadOnly label="WHT Rate" value={`${wht.rate}%`} />
                    <Input size="sm" type="number" label="WHT Amount" value={form.taxBreakdown?.withholding ?? wht.amount}
                      onChange={(e) => setForm({ ...form, taxBreakdown: { ...(form.taxBreakdown || {}), withholding: parseFloat(e.target.value) || 0 } })} />
                    <div className="text-xs text-gray-500">Retained from payment to supplier; remitted to GRA. Net payable: {formatAccountingCurrency((Number(form.subtotal || 0) + Number(form.taxAmount || 0) - Number(form.taxBreakdown?.withholding || 0)))}</div>
                  </>
                );
              })()}
            </div>

                {/* Charges & Discounts */}
                <div className="grid grid-cols-4 gap-4">
              <Input size="sm" type="number" label="Discount Amount" value={form.discountAmount ?? 0} onChange={(e)=> setForm({ ...form, discountAmount: parseFloat(e.target.value)||0 })} />
              <Input size="sm" type="number" label="Shipping/Handling" value={form.shippingCharges ?? 0} onChange={(e)=> setForm({ ...form, shippingCharges: parseFloat(e.target.value)||0 })} />
              <Input size="sm" type="number" label="Other Charges" value={form.otherCharges ?? 0} onChange={(e)=> setForm({ ...form, otherCharges: parseFloat(e.target.value)||0 })} />
              <Input size="sm" type="number" label="Amount Paid" value={form.paidAmount ?? 0} onChange={(e)=> setForm({ ...form, paidAmount: parseFloat(e.target.value)||0 })} />
                </div>

                {/* Approvals & Attachments moved below Line Items */}

                {/* Line Items */}
                <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Line Items</h4>
                <Button size="sm" variant="bordered" onClick={() => {
                  const next = [...(form.lines || [])];
                  next.push({ id: `INL-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, taxPercent: 20, glAccountCode: '5100', uom: 'Each', costCenter: '' });
                  const subtotal = next.reduce((s, l) => s + (Number(l.quantity||0)*Number(l.unitPrice||0)), 0);
                  const taxAmount = next.reduce((s, l) => s + ((Number(l.quantity||0)*Number(l.unitPrice||0)) * Number(l.taxPercent||0) / 100), 0);
                  setForm({ ...form, lines: next, subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2), total: +(subtotal+taxAmount).toFixed(2) });
                }}>➕ Add Row</Button>
              </div>
              <Table aria-label="Invoice Lines" isStriped>
                <TableHeader>
                  <TableColumn width={240}>ITEM</TableColumn>
                  <TableColumn width={420}>DESCRIPTION</TableColumn>
                  <TableColumn width={90}>QTY</TableColumn>
                  <TableColumn width={120}>UNIT PRICE</TableColumn>
                  <TableColumn width={110}>UOM</TableColumn>
                  <TableColumn width={100}>TAX %</TableColumn>
                  <TableColumn width={200}>GL ACCOUNT</TableColumn>
                  <TableColumn width={200}>COST CENTER</TableColumn>
                  <TableColumn width={140}>LINE TOTAL</TableColumn>
                  <TableColumn width={100}>ACTIONS</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No lines">
                  {(form.lines || []).map((ln: any, idx: number) => {
                    const lineAmount: number = +(Number(ln.quantity || 0) * Number(ln.unitPrice || 0)).toFixed(2);
                    return (
                      <TableRow key={ln.id || idx}>
                        <TableCell>
                          <Autocomplete size="sm" selectedKey={ln.itemId || undefined} onSelectionChange={(key)=> {
                            const item = stockItems.find(i => i.id === String(key||''));
                            const next = [...(form.lines || [])];
                            if (item) {
                              next[idx] = {
                                ...next[idx],
                                itemId: item.id,
                                itemCode: item.itemCode,
                                description: next[idx]?.description || item.name,
                                unitPrice: next[idx]?.unitPrice ?? item.unitCost,
                                uom: next[idx]?.uom || item.unit
                              };
                              const subtotal: number = next.reduce((s: number, l: any) => s + (Number(l.quantity||0)*Number(l.unitPrice||0)), 0);
                              const taxAmount: number = next.reduce((s: number, l: any) => s + ((Number(l.quantity||0)*Number(l.unitPrice||0)) * Number(l.taxPercent||0) / 100), 0);
                              setForm({ ...form, lines: next, subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2), total: +(subtotal+taxAmount).toFixed(2) });
                            } else {
                              next[idx] = { ...next[idx], itemId: '', itemCode: '' };
                              setForm({ ...form, lines: next });
                            }
                          }} placeholder="Select item">
                            {(stockItems||[]).filter(it => !form.businessPartnerId || it.supplierId === form.businessPartnerId).map(item => (
                              <AutocompleteItem key={item.id} textValue={`${item.itemCode} ${item.name}`}>
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs">{item.itemCode}</span>
                                  <span className="text-xs text-gray-600">{item.name}</span>
                                </div>
                              </AutocompleteItem>
                            ))}
                          </Autocomplete>
                        </TableCell>
                        <TableCell><Input aria-label="Description" value={ln.description || ''} onChange={(e) => { const next = [...form.lines]; next[idx].description = e.target.value; setForm({ ...form, lines: next }); }} /></TableCell>
                        <TableCell><Input type="number" aria-label="Quantity" value={ln.quantity ?? 1} onChange={(e) => { const next = [...form.lines]; next[idx].quantity = parseFloat(e.target.value) || 0; const subtotal: number = next.reduce((s: number, l: any) => s + (Number(l.quantity||0)*Number(l.unitPrice||0)), 0); const taxAmount: number = next.reduce((s: number, l: any) => s + ((Number(l.quantity||0)*Number(l.unitPrice||0)) * Number(l.taxPercent||0) / 100), 0); setForm({ ...form, lines: next, subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2), total: +(subtotal+taxAmount).toFixed(2) }); }} /></TableCell>
                        <TableCell><Input type="number" aria-label="Unit Price" value={ln.unitPrice ?? 0} onChange={(e) => { const next = [...form.lines]; next[idx].unitPrice = parseFloat(e.target.value) || 0; const subtotal: number = next.reduce((s: number, l: any) => s + (Number(l.quantity||0)*Number(l.unitPrice||0)), 0); const taxAmount: number = next.reduce((s: number, l: any) => s + ((Number(l.quantity||0)*Number(l.unitPrice||0)) * Number(l.taxPercent||0) / 100), 0); setForm({ ...form, lines: next, subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2), total: +(subtotal+taxAmount).toFixed(2) }); }} /></TableCell>
                        <TableCell><Input aria-label="UOM" value={ln.uom || 'Each'} onChange={(e)=> { const next = [...form.lines]; next[idx].uom = e.target.value; setForm({ ...form, lines: next }); }} /></TableCell>
                        <TableCell><Input type="number" aria-label="Tax Percent" value={ln.taxPercent ?? 0} onChange={(e) => { const next = [...form.lines]; next[idx].taxPercent = parseFloat(e.target.value) || 0; const subtotal: number = next.reduce((s: number, l: any) => s + (Number(l.quantity||0)*Number(l.unitPrice||0)), 0); const taxAmount: number = next.reduce((s: number, l: any) => s + ((Number(l.quantity||0)*Number(l.unitPrice||0)) * Number(l.taxPercent||0) / 100), 0); setForm({ ...form, lines: next, subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2), total: +(subtotal+taxAmount).toFixed(2) }); }} /></TableCell>
                        <TableCell>
                          <Autocomplete size="sm" selectedKey={ln.glAccountCode || undefined} onSelectionChange={(key)=> { const next = [...form.lines]; next[idx].glAccountCode = String(key||''); setForm({ ...form, lines: next }); }} placeholder="GL code">
                            {chartOfAccounts.map(acc => (
                              <AutocompleteItem key={acc.code} textValue={`${acc.code} ${acc.name}`}>
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs">{acc.code}</span>
                                  <span className="text-xs text-gray-600">{acc.name}</span>
                                </div>
                              </AutocompleteItem>
                            ))}
                          </Autocomplete>
                        </TableCell>
                        <TableCell>
                          <Autocomplete size="sm" selectedKey={ln.costCenter || undefined} onSelectionChange={(key)=> { const next = [...form.lines]; next[idx].costCenter = String(key||''); setForm({ ...form, lines: next }); }} placeholder="Cost center">
                            {(costCenters||[]).map(cc => (
                              <AutocompleteItem key={cc.code} textValue={`${cc.code} ${cc.name}`}>
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs">{cc.code}</span>
                                  <span className="text-xs text-gray-600">{cc.name}</span>
                                </div>
                              </AutocompleteItem>
                            ))}
                          </Autocomplete>
                        </TableCell>
                        <TableCell>{formatAccountingCurrency(lineAmount)}</TableCell>
                        <TableCell><Button size="sm" color="danger" variant="bordered" onClick={() => { const next = (form.lines || []).filter((_: any, i: number) => i !== idx); const subtotal: number = next.reduce((s: number, l: any) => s + (Number(l.quantity||0)*Number(l.unitPrice||0)), 0); const taxAmount: number = next.reduce((s: number, l: any) => s + ((Number(l.quantity||0)*Number(l.unitPrice||0)) * Number(l.taxPercent||0) / 100), 0); setForm({ ...form, lines: next, subtotal: +subtotal.toFixed(2), taxAmount: +taxAmount.toFixed(2), total: +(subtotal+taxAmount).toFixed(2) }); }}>🗑️ Remove</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
                </div>
                {/* Approvals & Attachments (placeholders) */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <Input size="sm" label="Prepared By" value={form.preparedBy || ''} onChange={(e)=> setForm({ ...form, preparedBy: e.target.value })} />
                  <Input size="sm" label="Checked By" value={form.checkedBy || ''} onChange={(e)=> setForm({ ...form, checkedBy: e.target.value })} />
                  <Input size="sm" label="Approved By" value={form.approvedBy || ''} onChange={(e)=> setForm({ ...form, approvedBy: e.target.value })} />
                  <Input size="sm" label="Authorized By" value={form.authorizedBy || ''} onChange={(e)=> setForm({ ...form, authorizedBy: e.target.value })} />
                  <Input size="sm" label="Payment Approved By" value={form.paymentApprovedBy || ''} onChange={(e)=> setForm({ ...form, paymentApprovedBy: e.target.value })} />
                  <Input size="sm" label="Attachments (filenames)" value={(form.attachments||[]).join(', ')} onChange={(e)=> setForm({ ...form, attachments: e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean) })} />
                </div>
              </div>
            </div>
          </div>
        )}
        {dialogType === 'payment' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
            <Select label="Supplier" selectedKeys={[form.businessPartnerId || suppliers[0]?.id]} onSelectionChange={(keys) => setForm({ ...form, businessPartnerId: Array.from(keys)[0], invoiceId: '' })}>
              {suppliers.map(s => (<SelectItem key={s.id}>{s.name}</SelectItem>))}
            </Select>
            <div>
              <Input type="date" label="Date" value={form.date || new Date().toISOString().slice(0,10)} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              {errors.date && <div className="text-red-600 text-xs mt-1">{errors.date}</div>}
            </div>
              {/* Optional invoice link (filtered by supplier) */}
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Invoice (optional)</label>
                <Autocomplete
                  allowsCustomValue={false}
                  selectedKey={form.invoiceId || undefined}
                  onSelectionChange={(key) => {
                    const id = String(key || '');
                    const inv = purchaseInvoices.find(i => i.id === id);
                    if (!inv) { setForm({ ...form, invoiceId: '' }); return; }
                    // Calculate outstanding using payments linked to the invoice (if any)
                    const paidForInvoice = payments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
                    const outstanding = Math.max(0, (inv.total || 0) - paidForInvoice);
                    const whtConfigured = Number(inv.taxBreakdown?.withholding || 0);
                    const whtAlreadyWithheld = payments
                      .filter((p: any) => p.invoiceId === inv.id && p.isWHTCertificate)
                      .reduce((s: number, p: any) => s + Number(p.whtAmount || p.amount || 0), 0);
                    const whtRemaining = Math.min(outstanding, Math.max(0, whtConfigured - whtAlreadyWithheld));
                    const applyWht = whtRemaining > 0;
                    const nextAmount = Math.max(0, outstanding - (applyWht ? whtRemaining : 0));
                    setForm({ ...form, invoiceId: inv.id, amount: nextAmount, applyWht, whtAmount: whtRemaining, reference: form.reference || `Payment for invoice ${inv.invoiceNumber}` });
                  }}
                  placeholder={form.businessPartnerId ? 'Select purchase invoice' : 'Select supplier first'}
                  isDisabled={!form.businessPartnerId}
                >
                  {purchaseInvoices
                    .filter(inv => !form.businessPartnerId || inv.businessPartnerId === form.businessPartnerId)
                    .map(inv => {
                      const paid = payments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
                      const bal = Math.max(0, (inv.total || 0) - paid);
                      return (
                        <AutocompleteItem key={inv.id} textValue={`${inv.invoiceNumber}`}>
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span className="font-mono text-xs">{inv.invoiceNumber}</span>
                            <span className="text-xs text-gray-600">{formatAccountingCurrency(bal)} outstanding</span>
                          </div>
                        </AutocompleteItem>
                      );
                    })}
                </Autocomplete>
                {form.invoiceId && (() => {
                  const inv = purchaseInvoices.find(i => i.id === form.invoiceId);
                  if (!inv) return null;
                  const paid = payments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
                  const bal = Math.max(0, (inv.total || 0) - paid);
                  const settling = Number(form.amount || 0) + (form.applyWht ? Number(form.whtAmount || 0) : 0);
                  const newBal = Math.max(0, bal - settling);
                  return (
                    <div className="mt-1 text-xs text-gray-600">
                      Outstanding: {formatAccountingCurrency(bal)} → New: <span className={newBal === 0 ? 'text-green-600' : 'text-orange-600'}>{formatAccountingCurrency(newBal)}</span>
                    </div>
                  );
                })()}
                {form.invoiceId && (() => {
                  const inv = purchaseInvoices.find(i => i.id === form.invoiceId);
                  const whtConfigured = Number(inv?.taxBreakdown?.withholding || 0);
                  if (!inv || whtConfigured <= 0) return null;
                  const whtAlreadyWithheld = payments
                    .filter((p: any) => p.invoiceId === inv.id && p.isWHTCertificate)
                    .reduce((s: number, p: any) => s + Number(p.whtAmount || p.amount || 0), 0);
                  const whtRemaining = Math.max(0, whtConfigured - whtAlreadyWithheld);
                  if (whtRemaining <= 0) return null;
                  return (
                    <div className="mt-2 flex items-center gap-3">
                      <Checkbox isSelected={!!form.applyWht} onValueChange={(checked) => {
                        const paidForInvoice = payments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
                        const outstanding = Math.max(0, (inv.total || 0) - paidForInvoice);
                        if (checked) {
                          setForm({ ...form, applyWht: true, whtAmount: whtRemaining, amount: Math.max(0, outstanding - whtRemaining) });
                        } else {
                          setForm({ ...form, applyWht: false, whtAmount: 0, amount: outstanding });
                        }
                      }}>Withhold tax on this payment ({formatAccountingCurrency(whtRemaining)})</Checkbox>
                    </div>
                  );
                })()}
              </div>
            <div>
              <Input type="number" label="Amount (cash to supplier)" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
              {errors.amount && <div className="text-red-600 text-xs mt-1">{errors.amount}</div>}
              {form.applyWht && <div className="text-xs text-gray-500 mt-1">+ {formatAccountingCurrency(Number(form.whtAmount || 0))} withheld (WHT payable to GRA)</div>}
            </div>
            <Select label="Method" selectedKeys={[form.paymentMethod || 'Bank']} onSelectionChange={(keys) => setForm({ ...form, paymentMethod: Array.from(keys)[0] })}>
              <SelectItem key="Cash">Cash</SelectItem>
              <SelectItem key="Bank">Bank</SelectItem>
              <SelectItem key="Check">Check</SelectItem>
              <SelectItem key="Card">Card</SelectItem>
              <SelectItem key="Mobile Money">Mobile Money</SelectItem>
            </Select>
              <Input label="Reference" value={form.reference || ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            {errors.businessPartnerId && <div className="text-red-600 text-xs">{errors.businessPartnerId}</div>}
            </div>

            {form.paymentMethod === 'Bank' && (
              <div className="grid grid-cols-2 gap-4">
                <Select label="Bank Account" selectedKeys={[form.bankAccountId || '']} onSelectionChange={(keys)=> setForm({ ...form, bankAccountId: Array.from(keys)[0] })}>
                  {bankAccounts.map(acc => (
                    <SelectItem key={acc.id}>{acc.accountName} - {acc.accountNumber}</SelectItem>
                  ))}
                </Select>
                <Input label="Cheque No" value={form.checkNumber || ''} onChange={(e)=> setForm({ ...form, checkNumber: e.target.value })} />
              </div>
            )}
            {errors.bankAccountId && <div className="text-red-600 text-xs">{errors.bankAccountId}</div>}

            <div className="space-y-2">
              <div className="font-semibold text-sm">Receipt Acknowledgement</div>
              <div className="grid grid-cols-3 gap-4">
                <Input size="sm" label="Received By" value={form.receivedBy || ''} onChange={(e)=> setForm({ ...form, receivedBy: e.target.value })} />
                <Input size="sm" label="Receiver Contact" value={form.receiverContact || ''} onChange={(e)=> setForm({ ...form, receiverContact: e.target.value })} />
                <Select size="sm" label="Receiver ID Type" selectedKeys={form.receiverIdType ? [form.receiverIdType] : []} onSelectionChange={(keys)=> setForm({ ...form, receiverIdType: Array.from(keys)[0] as string })}>
                  <SelectItem key="Ghana Card">Ghana Card</SelectItem>
                  <SelectItem key="Passport">Passport</SelectItem>
                  <SelectItem key="Driver's License">Driver's License</SelectItem>
                  <SelectItem key="Voter ID">Voter ID</SelectItem>
                  <SelectItem key="National ID">National ID</SelectItem>
                  <SelectItem key="Other">Other</SelectItem>
                </Select>
                <Input size="sm" label="Receiver ID Number" value={form.receiverIdNumber || ''} onChange={(e)=> setForm({ ...form, receiverIdNumber: e.target.value })} />
                <Input size="sm" type="date" label="Received Date" value={form.receivedDate || ''} onChange={(e)=> setForm({ ...form, receivedDate: e.target.value })} />
                <Textarea size="sm" minRows={1} label="Receiver Signature (base64)" value={form.receiverSignature || ''} onChange={(e)=> setForm({ ...form, receiverSignature: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-sm">Files</div>
              <div className="grid grid-cols-3 gap-4">
                <Input size="sm" label="Attachments (filenames)" value={(form.attachments||[]).join(', ')} onChange={(e)=> setForm({ ...form, attachments: e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean) })} />
                <Input size="sm" label="PDF URL" value={form.pdfUrl || ''} onChange={(e)=> setForm({ ...form, pdfUrl: e.target.value })} />
                <Input size="sm" label="PDF File Name" value={form.pdfFileName || ''} onChange={(e)=> setForm({ ...form, pdfFileName: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox isSelected={postOnSave} onValueChange={setPostOnSave}>Post payment on save</Checkbox>
            </div>
          </div>
        )}
      </ModalContainer>

      {/* View Totals Modal */}
      <Modal isOpen={isTotalsOpen} onClose={() => setIsTotalsOpen(false)} size="md">
        <ModalContent>
          <ModalHeader>Invoice Totals</ModalHeader>
          <ModalBody>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatAccountingCurrency(Number(form.subtotal||0))}</span></div>
              <div className="flex justify-between text-sm text-gray-600"><span>Tax</span><span>{formatAccountingCurrency(Number(form.taxAmount||0))}</span></div>
              <div className="flex justify-between text-sm text-gray-600"><span>Discount</span><span>{formatAccountingCurrency(Number(form.discountAmount||0))}</span></div>
              <div className="flex justify-between text-sm text-gray-600"><span>Shipping</span><span>{formatAccountingCurrency(Number(form.shippingCharges||0))}</span></div>
              <div className="flex justify-between text-sm text-gray-600"><span>Other</span><span>{formatAccountingCurrency(Number(form.otherCharges||0))}</span></div>
              <Divider/>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatAccountingCurrency(Number(form.total||0))}</span></div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setIsTotalsOpen(false)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// Modal at end to create/edit supplier, invoice, payment
// Lightweight custom modal to keep dependencies minimal
function ModalContainer({ open, onClose, title, children, onSave }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; onSave: () => void; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-[70vw] max-h-[90vh] rounded-lg shadow-xl">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h3 className="font-semibold">{title}</h3>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm border rounded" onClick={onSave}>Save</button>
            <button className="px-3 py-1 text-sm border rounded" onClick={() => { onSave(); onClose(); }}>Save & Close</button>
            <button className="px-3 py-1 text-sm border rounded" onClick={() => { try { window.print(); } catch {} }}>Print</button>
            <button className="px-3 py-1 text-sm border rounded" onClick={() => { alert('PDF export coming soon'); }}>PDF</button>
            <button onClick={onClose} className="px-3 py-1 text-sm border rounded">✖</button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto max-h-[80vh]">
          {children}
        </div>
        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button className="px-3 py-2 text-sm border rounded" onClick={onClose}>Cancel</button>
          <button className="px-3 py-2 text-sm bg-ghana-green text-white rounded" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// end of file
