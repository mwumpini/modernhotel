'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Badge, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Tabs, Tab, Textarea, Divider, Spinner, Alert, Progress
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';

export default function AccountsPayablePage() {
  const {
    businessPartners,
    invoices,
    payments,
    isLoading,
    error
  } = useAccountingStore();

  const [selectedTab, setSelectedTab] = useState("suppliers");

  // Calculate totals
  const totalPayables = useMemo(() => {
    return businessPartners
      .filter(partner => partner.type === 'Supplier' || partner.type === 'Both')
      .reduce((sum, partner) => sum + partner.balance, 0);
  }, [businessPartners]);

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

  const outstandingPayables = totalPayables - totalPayments;

  // Filter suppliers
  const suppliers = useMemo(() => {
    return businessPartners.filter(partner => 
      partner.type === 'Supplier' || partner.type === 'Both'
    );
  }, [businessPartners]);

  // Filter purchase invoices
  const purchaseInvoices = useMemo(() => {
    return invoices.filter(invoice => invoice.type === 'Purchase');
  }, [invoices]);

  // Filter payments
  const supplierPayments = useMemo(() => {
    return payments.filter(payment => payment.type === 'Payment');
  }, [payments]);

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
            <div className="text-2xl font-bold text-red-600">₵{totalPayables.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Payables</div>
            <Progress value={100} size="sm" color="danger" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-orange-600">₵{outstandingPayables.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Outstanding</div>
            <Progress value={100} size="sm" color="warning" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">₵{totalInvoices.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Invoices</div>
            <Progress value={100} size="sm" color="primary" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">₵{totalPayments.toLocaleString()}</div>
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
            <Tab key="suppliers" title="🏢 Suppliers">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Supplier Accounts</h3>
                  <Button
                    color="primary"
                    startContent={<span>➕</span>}
                  >
                    Add Supplier
                  </Button>
                </div>

                <Table aria-label="Supplier Accounts">
                  <TableHeader>
                    <TableColumn>SUPPLIER</TableColumn>
                    <TableColumn>CONTACT</TableColumn>
                    <TableColumn>BALANCE</TableColumn>
                    <TableColumn>CREDIT LIMIT</TableColumn>
                    <TableColumn>PAYMENT TERMS</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No suppliers found.">
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{supplier.name}</div>
                            <div className="text-sm text-gray-500">{supplier.code}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {supplier.contactPerson && (
                              <div className="text-sm">{supplier.contactPerson}</div>
                            )}
                            {supplier.email && (
                              <div className="text-sm text-gray-500">{supplier.email}</div>
                            )}
                            {supplier.phone && (
                              <div className="text-sm text-gray-500">{supplier.phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`text-right font-medium ${
                            supplier.balance > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            ₵{supplier.balance.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            ₵{supplier.creditLimit?.toLocaleString() || '0'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {supplier.paymentTerms || 'N/A'} days
                          </span>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            color={supplier.balance > 0 ? 'warning' : 'success'} 
                            variant="flat" 
                            size="sm"
                          >
                            {supplier.balance > 0 ? 'Outstanding' : 'Current'}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="invoices" title="📄 Purchase Invoices">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Purchase Invoices</h3>
                  <Button
                    color="primary"
                    startContent={<span>➕</span>}
                  >
                    Add Invoice
                  </Button>
                </div>

                <Table aria-label="Purchase Invoices">
                  <TableHeader>
                    <TableColumn>INVOICE #</TableColumn>
                    <TableColumn>SUPPLIER</TableColumn>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn>DUE DATE</TableColumn>
                    <TableColumn>AMOUNT</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No purchase invoices found.">
                    {purchaseInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <span className="font-mono font-medium">{invoice.invoiceNumber}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{invoice.businessPartnerId}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {new Date(invoice.date).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-right font-medium">
                            ₵{invoice.total.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            color={
                              invoice.status === 'Paid' ? 'success' : 
                              invoice.status === 'Posted' ? 'primary' : 
                              'default'
                            } 
                            variant="flat" 
                            size="sm"
                          >
                            {invoice.status}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="payments" title="💸 Payments">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Supplier Payments</h3>
                  <Button
                    color="primary"
                    startContent={<span>➕</span>}
                  >
                    Record Payment
                  </Button>
                </div>

                <Table aria-label="Supplier Payments">
                  <TableHeader>
                    <TableColumn>PAYMENT #</TableColumn>
                    <TableColumn>SUPPLIER</TableColumn>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn>AMOUNT</TableColumn>
                    <TableColumn>METHOD</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No payments found.">
                    {supplierPayments.map((payment) => (
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
                        <TableCell>
                          <div className="text-right font-medium">
                            ₵{payment.amount.toLocaleString()}
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
