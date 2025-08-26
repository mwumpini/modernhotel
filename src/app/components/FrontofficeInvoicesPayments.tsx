'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Select,
  SelectItem,
  Chip,
  Progress,
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tabs,
  Tab
} from "@heroui/react";
import OfflineIndicator from './OfflineIndicator';

interface Invoice {
  id: string;
  guestName: string;
  roomNumber: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  amount: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  items: InvoiceItem[];
}

interface InvoiceItem {
  description: string;
  quantity: number;
  rate: string;
  amount: string;
}

interface Payment {
  id: string;
  invoiceId: string;
  guestName: string;
  amount: string;
  method: 'cash' | 'card' | 'mobile_money' | 'bank_transfer';
  status: 'completed' | 'pending' | 'failed';
  date: string;
  reference: string;
}

export default function FrontofficeInvoicesPayments() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTab, setSelectedTab] = useState("invoices");

  const invoices: Invoice[] = [
    {
      id: 'INV001',
      guestName: 'John Doe',
      roomNumber: '205',
      invoiceNumber: 'INV-2024-001',
      date: '2024-01-15',
      dueDate: '2024-01-18',
      amount: '₵2,400',
      status: 'paid',
      paymentMethod: 'Mobile Money',
      items: [
        { description: 'Deluxe Room (3 nights)', quantity: 3, rate: '₵800', amount: '₵2,400' }
      ]
    },
    {
      id: 'INV002',
      guestName: 'Sarah Johnson',
      roomNumber: '312',
      invoiceNumber: 'INV-2024-002',
      date: '2024-01-14',
      dueDate: '2024-01-20',
      amount: '₵3,600',
      status: 'pending',
      items: [
        { description: 'Standard Room (6 nights)', quantity: 6, rate: '₵600', amount: '₵3,600' }
      ]
    },
    {
      id: 'INV003',
      guestName: 'Kwame Asante',
      roomNumber: '401',
      invoiceNumber: 'INV-2024-003',
      date: '2024-01-10',
      dueDate: '2024-01-25',
      amount: '₵18,000',
      status: 'overdue',
      items: [
        { description: 'Suite (15 nights)', quantity: 15, rate: '₵1,200', amount: '₵18,000' }
      ]
    }
  ];

  const payments: Payment[] = [
    {
      id: 'PAY001',
      invoiceId: 'INV001',
      guestName: 'John Doe',
      amount: '₵2,400',
      method: 'mobile_money',
      status: 'completed',
      date: '2024-01-15',
      reference: 'MTN-123456789'
    },
    {
      id: 'PAY002',
      invoiceId: 'INV002',
      guestName: 'Sarah Johnson',
      amount: '₵1,800',
      method: 'card',
      status: 'pending',
      date: '2024-01-16',
      reference: 'CARD-987654321'
    },
    {
      id: 'PAY003',
      invoiceId: 'INV003',
      guestName: 'Kwame Asante',
      amount: '₵9,000',
      method: 'bank_transfer',
      status: 'completed',
      date: '2024-01-12',
      reference: 'BANK-456789123'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'overdue': return 'danger';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'cash': return 'success';
      case 'card': return 'primary';
      case 'mobile_money': return 'secondary';
      case 'bank_transfer': return 'warning';
      default: return 'default';
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'card': return 'Credit Card';
      case 'mobile_money': return 'Mobile Money';
      case 'bank_transfer': return 'Bank Transfer';
      default: return method;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ghana-black">🧾 Invoices & Payments</h1>
              <p className="text-gray-600 mt-2">Complete billing and payment management system</p>
            </div>
            
            {/* System Status Indicators */}
            <div className="flex items-center space-x-4">
              <OfflineIndicator />
              <Button
                color="primary"
                className="bg-ghana-green text-white"
                variant="flat"
                onPress={onOpen}
              >
                📄 New Invoice
              </Button>
            </div>
          </div>
        </div>

        {/* Financial Overview */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <h2 className="text-xl font-semibold text-ghana-black">💰 Financial Overview</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-3xl mb-2">💚</div>
                <p className="text-2xl font-bold text-green-600">₵24,000</p>
                <p className="text-sm text-green-700">Total Revenue</p>
              </div>
              
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-2xl font-bold text-blue-600">₵18,000</p>
                <p className="text-sm text-blue-700">Paid Invoices</p>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-3xl mb-2">⏰</div>
                <p className="text-2xl font-bold text-yellow-600">₵6,000</p>
                <p className="text-sm text-yellow-700">Pending</p>
              </div>

              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-3xl mb-2">🚨</div>
                <p className="text-2xl font-bold text-red-600">₵18,000</p>
                <p className="text-sm text-red-700">Overdue</p>
              </div>
            </div>

            {/* Payment Methods Distribution */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-ghana-black mb-4">💳 Payment Methods Distribution</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl mb-1">📱</div>
                  <p className="text-lg font-bold text-blue-600">₵12,000</p>
                  <p className="text-sm text-gray-600">Mobile Money</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl mb-1">💳</div>
                  <p className="text-lg font-bold text-purple-600">₵8,000</p>
                  <p className="text-sm text-gray-600">Credit Card</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl mb-1">🏦</div>
                  <p className="text-lg font-bold text-green-600">₵3,000</p>
                  <p className="text-sm text-gray-600">Bank Transfer</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl mb-1">💵</div>
                  <p className="text-lg font-bold text-orange-600">₵1,000</p>
                  <p className="text-sm text-gray-600">Cash</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Main Content Tabs */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <Tabs 
              selectedKey={selectedTab} 
              onSelectionChange={(key) => setSelectedTab(key as string)}
              className="w-full"
            >
              <Tab key="invoices" title="📄 Invoices" />
              <Tab key="payments" title="💳 Payments" />
              <Tab key="reports" title="📊 Reports" />
            </Tabs>
          </CardHeader>
          <CardBody>
            {selectedTab === 'invoices' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">Invoice Management</h3>
                  <Button color="primary" variant="flat" size="sm">
                    📊 Export
                  </Button>
                </div>
                <Table aria-label="Invoices table">
                  <TableHeader>
                    <TableColumn>Invoice #</TableColumn>
                    <TableColumn>Guest</TableColumn>
                    <TableColumn>Room</TableColumn>
                    <TableColumn>Date</TableColumn>
                    <TableColumn>Due Date</TableColumn>
                    <TableColumn>Amount</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Payment Method</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-semibold">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{invoice.guestName}</TableCell>
                        <TableCell>{invoice.roomNumber}</TableCell>
                        <TableCell>{invoice.date}</TableCell>
                        <TableCell>{invoice.dueDate}</TableCell>
                        <TableCell className="font-semibold">{invoice.amount}</TableCell>
                        <TableCell>
                          <Chip 
                            color={getStatusColor(invoice.status)}
                            size="sm"
                          >
                            {invoice.status}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          {invoice.paymentMethod ? (
                            <Chip 
                              color={getPaymentMethodColor(invoice.paymentMethod.toLowerCase().replace(' ', '_'))}
                              size="sm"
                            >
                              {invoice.paymentMethod}
                            </Chip>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">
                              View
                            </Button>
                            <Button size="sm" color="success" variant="flat">
                              Print
                            </Button>
                            {invoice.status === 'pending' && (
                              <Button size="sm" color="warning" variant="flat">
                                Collect
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedTab === 'payments' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">Payment Transactions</h3>
                  <Button color="primary" variant="flat" size="sm">
                    🔄 Refresh
                  </Button>
                </div>
                <Table aria-label="Payments table">
                  <TableHeader>
                    <TableColumn>Payment ID</TableColumn>
                    <TableColumn>Invoice #</TableColumn>
                    <TableColumn>Guest</TableColumn>
                    <TableColumn>Amount</TableColumn>
                    <TableColumn>Method</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Date</TableColumn>
                    <TableColumn>Reference</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-semibold">{payment.id}</TableCell>
                        <TableCell>{payment.invoiceId}</TableCell>
                        <TableCell>{payment.guestName}</TableCell>
                        <TableCell className="font-semibold">{payment.amount}</TableCell>
                        <TableCell>
                          <Chip 
                            color={getPaymentMethodColor(payment.method)}
                            size="sm"
                          >
                            {getPaymentMethodText(payment.method)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            color={getPaymentStatusColor(payment.status)}
                            size="sm"
                          >
                            {payment.status}
                          </Chip>
                        </TableCell>
                        <TableCell>{payment.date}</TableCell>
                        <TableCell className="font-mono text-sm">{payment.reference}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">
                              Receipt
                            </Button>
                            {payment.status === 'pending' && (
                              <Button size="sm" color="warning" variant="flat">
                                Verify
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedTab === 'reports' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <h3 className="text-lg font-semibold text-ghana-black">📈 Revenue Trends</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span>This Month</span>
                          <span className="font-semibold text-green-600">₵24,000</span>
                        </div>
                        <Progress value={80} color="success" className="w-full" />
                        <div className="flex justify-between items-center">
                          <span>Last Month</span>
                          <span className="font-semibold text-gray-600">₵20,000</span>
                        </div>
                        <Progress value={65} color="default" className="w-full" />
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <h3 className="text-lg font-semibold text-ghana-black">💳 Payment Methods</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span>Mobile Money</span>
                          <span className="font-semibold">50%</span>
                        </div>
                        <Progress value={50} color="secondary" className="w-full" />
                        <div className="flex justify-between items-center">
                          <span>Credit Card</span>
                          <span className="font-semibold">33%</span>
                        </div>
                        <Progress value={33} color="primary" className="w-full" />
                        <div className="flex justify-between items-center">
                          <span>Bank Transfer</span>
                          <span className="font-semibold">12%</span>
                        </div>
                        <Progress value={12} color="warning" className="w-full" />
                        <div className="flex justify-between items-center">
                          <span>Cash</span>
                          <span className="font-semibold">5%</span>
                        </div>
                        <Progress value={5} color="success" className="w-full" />
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* New Invoice Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="3xl">
          <ModalContent>
            <ModalHeader>📄 Create New Invoice</ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Input label="Guest Name" placeholder="Enter guest name" />
                <Input label="Room Number" placeholder="e.g., 205" />
                <Input label="Invoice Date" type="date" />
                <Input label="Due Date" type="date" />
              </div>
              
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Invoice Items</h4>
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <Input placeholder="Description" />
                    <Input placeholder="Quantity" type="number" />
                    <Input placeholder="Rate" />
                    <Input placeholder="Amount" />
                  </div>
                  <Button size="sm" color="primary" variant="flat">
                    + Add Item
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select label="Payment Method" placeholder="Select payment method">
                  <SelectItem key="cash">Cash</SelectItem>
                  <SelectItem key="card">Credit Card</SelectItem>
                  <SelectItem key="mobile_money">Mobile Money</SelectItem>
                  <SelectItem key="bank_transfer">Bank Transfer</SelectItem>
                </Select>
                <Input label="Total Amount" placeholder="₵0.00" />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={onClose}>
                Create Invoice
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
