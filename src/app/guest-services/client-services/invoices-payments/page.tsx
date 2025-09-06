'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Badge,
  Chip,
  Divider
} from '@heroui/react';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: 'room' | 'food' | 'service' | 'amenity' | 'tax' | 'discount';
  taxRate?: number;
  isTaxable: boolean;
  notes?: string;
  date?: string;
}

interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'mobile_money' | 'check' | 'voucher' | 'corporate_account';
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  processedAt: string;
  processedBy: string;
  reference?: string;
  notes?: string;
  receiptUrl?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomNumber: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded' | 'partially_paid';
  paymentMethod?: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  items: InvoiceItem[];
  payments: Payment[];
  balance: number;
}

export default function InvoicesPaymentsPage() {
  const [activeTab, setActiveTab] = useState('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Modals
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
  const { isOpen: isPaymentOpen, onOpen: onPaymentOpen, onClose: onPaymentClose } = useDisclosure();
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();

  // Create Invoice Form State
  const [newInvoice, setNewInvoice] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    roomNumber: '',
    roomType: '',
    checkInDate: '',
    checkOutDate: '',
    notes: '',
    items: [
      {
        id: '1',
        description: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        category: 'room' as const,
        isTaxable: true,
        taxRate: 15
      }
    ]
  });

  // Mock data
  const invoices: Invoice[] = [
    {
      id: '1',
      invoiceNumber: 'INV-2024-001',
      guestName: 'John Smith',
      guestEmail: 'john.smith@email.com',
      guestPhone: '+233 24 123 4567',
      roomNumber: '101',
      roomType: 'Deluxe Suite',
      checkInDate: '2024-01-15',
      checkOutDate: '2024-01-18',
      nights: 3,
      subtotal: 450.00,
      taxAmount: 67.50,
      discountAmount: 0,
      totalAmount: 517.50,
      status: 'paid',
      paymentMethod: 'credit_card',
      dueDate: '2024-01-18',
      createdAt: '2024-01-15',
      updatedAt: '2024-01-18',
      notes: 'Guest requested late checkout',
      items: [
        { id: '1', description: 'Deluxe Suite - 3 nights', quantity: 3, unitPrice: 150.00, totalPrice: 450.00, category: 'room', isTaxable: true, taxRate: 15 },
        { id: '2', description: 'Room Service - Dinner', quantity: 1, unitPrice: 25.00, totalPrice: 25.00, category: 'food', isTaxable: true, taxRate: 15 },
        { id: '3', description: 'Laundry Service', quantity: 1, unitPrice: 15.00, totalPrice: 15.00, category: 'service', isTaxable: true, taxRate: 15 }
      ],
      payments: [],
      balance: 0
    },
    {
      id: '2',
      invoiceNumber: 'INV-2024-002',
      guestName: 'Sarah Johnson',
      guestEmail: 'sarah.j@email.com',
      guestPhone: '+233 20 987 6543',
      roomNumber: '205',
      roomType: 'Standard Room',
      checkInDate: '2024-01-20',
      checkOutDate: '2024-01-22',
      nights: 2,
      subtotal: 200.00,
      taxAmount: 30.00,
      discountAmount: 20.00,
      totalAmount: 210.00,
      status: 'partially_paid',
      paymentMethod: 'mobile_money',
      dueDate: '2024-01-22',
      createdAt: '2024-01-20',
      updatedAt: '2024-01-22',
      notes: 'Corporate client - 10% discount applied',
      items: [
        { id: '4', description: 'Standard Room - 2 nights', quantity: 2, unitPrice: 100.00, totalPrice: 200.00, category: 'room', isTaxable: true, taxRate: 15 }
      ],
      payments: [],
      balance: 60.00
    }
  ];

  const payments: Payment[] = [
    {
      id: '1',
      invoiceId: '1',
      amount: 517.50,
      paymentMethod: 'credit_card',
      transactionId: 'TXN-001',
      status: 'completed',
      processedAt: '2024-01-18',
      processedBy: 'Front Desk',
      reference: 'CC-1234',
      notes: 'Payment received successfully',
      receiptUrl: '/receipts/TXN-001.pdf'
    },
    {
      id: '2',
      invoiceId: '2',
      amount: 150.00,
      paymentMethod: 'mobile_money',
      transactionId: 'TXN-002',
      status: 'completed',
      processedAt: '2024-01-22',
      processedBy: 'Mobile App',
      reference: 'MM-5678',
      notes: 'Partial payment received',
      receiptUrl: '/receipts/TXN-002.pdf'
    }
  ];

  // Stats calculation
  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.balance), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance, 0);
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
    const overdueAmount = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.balance, 0);
    const collectionRate = totalAmount > 0 ? ((totalCollected / totalAmount) * 100) : 0;

    return {
      totalInvoices,
      totalAmount,
      totalCollected,
      totalOutstanding,
      overdueInvoices,
      overdueAmount,
      collectionRate
    };
  }, [invoices]);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'overdue': return 'danger';
      case 'cancelled': return 'default';
      case 'refunded': return 'secondary';
      case 'draft': return 'default';
      case 'partially_paid': return 'warning';
      default: return 'default';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      case 'refunded': return 'secondary';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'credit_card': return 'Credit Card';
      case 'debit_card': return 'Debit Card';
      case 'bank_transfer': return 'Bank Transfer';
      case 'mobile_money': return 'Mobile Money';
      case 'check': return 'Check';
      case 'voucher': return 'Voucher';
      case 'corporate_account': return 'Corporate Account';
      default: return method;
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    onViewOpen();
  };

  const handleViewPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    onPaymentOpen();
  };

  // Create Invoice Functions
  const addInvoiceItem = () => {
    const newItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      category: 'room' as const,
      isTaxable: true,
      taxRate: 15
    };
    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const removeInvoiceItem = (itemId: string) => {
    if (newInvoice.items.length > 1) {
      setNewInvoice(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== itemId)
      }));
    }
  };

  const updateInvoiceItem = (itemId: string, field: keyof InvoiceItem, value: any) => {
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updatedItem.totalPrice = updatedItem.quantity * updatedItem.unitPrice;
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const calculateInvoiceTotals = () => {
    const subtotal = newInvoice.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = subtotal * 0.15; // 15% tax
    const totalAmount = subtotal + taxAmount;
    return { subtotal, taxAmount, totalAmount };
  };

  const handleCreateInvoice = () => {
    const { subtotal, taxAmount, totalAmount } = calculateInvoiceTotals();
    
    const invoice: Invoice = {
      id: Date.now().toString(),
      invoiceNumber: `INV-${Date.now()}`,
      guestName: newInvoice.guestName,
      guestEmail: newInvoice.guestEmail,
      guestPhone: newInvoice.guestPhone,
      roomNumber: newInvoice.roomNumber,
      roomType: newInvoice.roomType,
      checkInDate: newInvoice.checkInDate,
      checkOutDate: newInvoice.checkOutDate,
      nights: Math.ceil((new Date(newInvoice.checkOutDate).getTime() - new Date(newInvoice.checkInDate).getTime()) / (1000 * 60 * 60 * 24)),
      subtotal,
      taxAmount,
      discountAmount: 0,
      totalAmount,
      status: 'draft',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: newInvoice.notes,
      items: newInvoice.items,
      payments: [],
      balance: totalAmount
    };

    // Add to invoices array (in a real app, this would be saved to database)
    console.log('Creating invoice:', invoice);
    
    // Reset form
    setNewInvoice({
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      roomNumber: '',
      roomType: '',
      checkInDate: '',
      checkOutDate: '',
      notes: '',
      items: [
        {
          id: '1',
          description: '',
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
          category: 'room' as const,
          isTaxable: true,
          taxRate: 15
        }
      ]
    });
    
    onCreateClose();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices & Payments</h1>
          <p className="text-gray-600">Manage guest billing and payment processing</p>
        </div>
          <Button color="primary" onPress={onCreateOpen}>
          + Create Invoice
          </Button>
      </div>

      {/* Dashboard Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
            <p className="text-sm text-gray-600">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
              </div>
              <div className="text-blue-500 text-2xl">📄</div>
            </div>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Collected</p>
                <p className="text-2xl font-bold text-green-600">₵{stats.totalCollected.toLocaleString()}</p>
              </div>
              <div className="text-green-500 text-2xl">💰</div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{stats.collectionRate.toFixed(1)}% collection rate</p>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-orange-600">₵{stats.totalOutstanding.toLocaleString()}</p>
              </div>
              <div className="text-orange-500 text-2xl">⏰</div>
            </div>
            <p className="text-xs text-gray-500 mt-1">To be collected</p>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
            <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">₵{stats.overdueAmount.toLocaleString()}</p>
      </div>
              <div className="text-red-500 text-2xl">🚨</div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{stats.overdueInvoices} invoices</p>
          </CardBody>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardBody>
          <div className="flex gap-4 mb-4">
            <Button
              variant={activeTab === 'invoices' ? 'solid' : 'light'}
              color="primary"
              onPress={() => setActiveTab('invoices')}
            >
              Invoices ({invoices.length})
            </Button>
            <Button
              variant={activeTab === 'payments' ? 'solid' : 'light'}
              color="primary"
              onPress={() => setActiveTab('payments')}
            >
              Payments ({payments.length})
            </Button>
          </div>

          {/* Table */}
          {activeTab === 'invoices' ? (
            <Table aria-label="Invoices table">
              <TableHeader>
                <TableColumn>INVOICE</TableColumn>
                <TableColumn>GUEST</TableColumn>
                <TableColumn>ROOM</TableColumn>
                <TableColumn>AMOUNT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>DUE DATE</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-gray-500">{invoice.checkInDate} - {invoice.checkOutDate}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                      <span className="font-medium">{invoice.guestName}</span>
                        <p className="text-sm text-gray-500">{invoice.guestEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                      <span className="font-medium">{invoice.roomNumber}</span>
                        <p className="text-sm text-gray-500">{invoice.roomType}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">₵{invoice.totalAmount.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">Tax: ₵{invoice.taxAmount.toFixed(2)}</p>
                        {invoice.discountAmount > 0 && (
                          <p className="text-sm text-green-600">Discount: -₵{invoice.discountAmount.toFixed(2)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge color={getStatusColor(invoice.status)} variant="flat">
                        {invoice.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{invoice.dueDate}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="light" onPress={() => handleViewInvoice(invoice)}>
                          View
                        </Button>
                        <Button size="sm" variant="light">
                          Print
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table aria-label="Payments table">
              <TableHeader>
                <TableColumn>TRANSACTION</TableColumn>
                <TableColumn>INVOICE</TableColumn>
                <TableColumn>AMOUNT</TableColumn>
                <TableColumn>METHOD</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>DATE</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                      <span className="font-medium">{payment.transactionId}</span>
                        <p className="text-sm text-gray-500">Ref: {payment.reference}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{payment.invoiceId}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">₵{payment.amount.toFixed(2)}</span>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat">
                        {getPaymentMethodLabel(payment.paymentMethod)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Badge color={getPaymentStatusColor(payment.status)} variant="flat">
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm">{new Date(payment.processedAt).toLocaleDateString()}</span>
                        <p className="text-xs text-gray-500">{payment.processedBy}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="light" onPress={() => handleViewPayment(payment)}>
                          View
                        </Button>
                        <Button size="sm" variant="light">
                          Receipt
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Invoice Detail Modal */}
      <Modal isOpen={isViewOpen} onClose={onViewClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            Invoice Details - {selectedInvoice?.invoiceNumber}
          </ModalHeader>
          <ModalBody>
            {selectedInvoice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Guest Information</h4>
                    <p><strong>Name:</strong> {selectedInvoice.guestName}</p>
                    <p><strong>Email:</strong> {selectedInvoice.guestEmail}</p>
                    <p><strong>Phone:</strong> {selectedInvoice.guestPhone}</p>
                    <p><strong>Room:</strong> {selectedInvoice.roomNumber} ({selectedInvoice.roomType})</p>
                    <p><strong>Check-in:</strong> {selectedInvoice.checkInDate}</p>
                    <p><strong>Check-out:</strong> {selectedInvoice.checkOutDate}</p>
                    <p><strong>Nights:</strong> {selectedInvoice.nights}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Invoice Information</h4>
                    <p><strong>Number:</strong> {selectedInvoice.invoiceNumber}</p>
                    <p><strong>Status:</strong> 
                      <Badge color={getStatusColor(selectedInvoice.status)} variant="flat" className="ml-2">
                        {selectedInvoice.status.replace('_', ' ')}
                      </Badge>
                    </p>
                    <p><strong>Due Date:</strong> {selectedInvoice.dueDate}</p>
                    <p><strong>Created:</strong> {selectedInvoice.createdAt}</p>
                    <p><strong>Updated:</strong> {selectedInvoice.updatedAt}</p>
                    {selectedInvoice.notes && (
                      <p><strong>Notes:</strong> {selectedInvoice.notes}</p>
                    )}
                  </div>
                </div>

                <Divider />

                <div>
                  <h4 className="font-semibold mb-2">Items</h4>
                  <Table aria-label="Invoice items">
                    <TableHeader>
                      <TableColumn>DESCRIPTION</TableColumn>
                      <TableColumn>QTY</TableColumn>
                      <TableColumn>UNIT PRICE</TableColumn>
                      <TableColumn>TOTAL</TableColumn>
                      <TableColumn>CATEGORY</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>₵{item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell>₵{item.totalPrice.toFixed(2)}</TableCell>
                          <TableCell>
                            <Chip size="sm" variant="flat">
                              {item.category}
                            </Chip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Divider />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Summary</h4>
                    <p><strong>Subtotal:</strong> ₵{selectedInvoice.subtotal.toFixed(2)}</p>
                    <p><strong>Tax:</strong> ₵{selectedInvoice.taxAmount.toFixed(2)}</p>
                    {selectedInvoice.discountAmount > 0 && (
                      <p><strong>Discount:</strong> -₵{selectedInvoice.discountAmount.toFixed(2)}</p>
                    )}
                    <p className="text-lg font-bold"><strong>Total:</strong> ₵{selectedInvoice.totalAmount.toFixed(2)}</p>
                    <p><strong>Balance:</strong> ₵{selectedInvoice.balance.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onViewClose}>
              Close
            </Button>
            <Button color="primary">
              Print Invoice
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Payment Detail Modal */}
      <Modal isOpen={isPaymentOpen} onClose={onPaymentClose} size="lg">
        <ModalContent>
          <ModalHeader>
            Payment Details - {selectedPayment?.transactionId}
          </ModalHeader>
          <ModalBody>
            {selectedPayment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Transaction</h4>
                    <p><strong>ID:</strong> {selectedPayment.transactionId}</p>
                    <p><strong>Invoice:</strong> {selectedPayment.invoiceId}</p>
                    <p><strong>Amount:</strong> ₵{selectedPayment.amount.toFixed(2)}</p>
                    <p><strong>Method:</strong> {getPaymentMethodLabel(selectedPayment.paymentMethod)}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Status</h4>
                    <p><strong>Status:</strong> 
                      <Badge color={getPaymentStatusColor(selectedPayment.status)} variant="flat" className="ml-2">
                        {selectedPayment.status}
                      </Badge>
                    </p>
                    <p><strong>Processed:</strong> {selectedPayment.processedAt}</p>
                    <p><strong>By:</strong> {selectedPayment.processedBy}</p>
                    {selectedPayment.reference && (
                      <p><strong>Reference:</strong> {selectedPayment.reference}</p>
                    )}
                  </div>
                </div>

                {selectedPayment.notes && (
                  <>
                    <Divider />
                    <div>
                      <h4 className="font-semibold mb-2">Notes</h4>
                      <p>{selectedPayment.notes}</p>
                    </div>
                  </>
                )}

                {selectedPayment.receiptUrl && (
                  <>
                    <Divider />
                    <div>
                      <h4 className="font-semibold mb-2">Receipt</h4>
                      <Button 
                        variant="flat" 
                        color="primary"
                        onPress={() => window.open(selectedPayment.receiptUrl, '_blank')}
                      >
                        View Receipt
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onPaymentClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Create Invoice Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="4xl">
        <ModalContent>
          <ModalHeader>Create New Invoice</ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* Guest Information */}
              <div>
                <h4 className="font-semibold mb-3 text-gray-800">Guest Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Guest Name"
                  placeholder="Enter guest name"
                  value={newInvoice.guestName}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, guestName: e.target.value }))}
                    required
                  />
                  <Input
                    label="Guest Email"
                    type="email"
                    placeholder="Enter guest email"
                    value={newInvoice.guestEmail}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, guestEmail: e.target.value }))}
                    required
                  />
                  <Input
                    label="Guest Phone"
                    placeholder="Enter guest phone"
                    value={newInvoice.guestPhone}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, guestPhone: e.target.value }))}
                    required
                />
                <Input
                  label="Room Number"
                  placeholder="Enter room number"
                  value={newInvoice.roomNumber}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, roomNumber: e.target.value }))}
                    required
                  />
                  <Input
                    label="Room Type"
                    placeholder="e.g., Deluxe Suite, Standard Room"
                    value={newInvoice.roomType}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, roomType: e.target.value }))}
                    required
                  />
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <Input
                  label="Check-in Date"
                  type="date"
                  value={newInvoice.checkInDate}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, checkInDate: e.target.value }))}
                      required
                />
                <Input
                  label="Check-out Date"
                  type="date"
                  value={newInvoice.checkOutDate}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, checkOutDate: e.target.value }))}
                      required
                />
                  </div>
                </div>
              </div>

              <Divider />

              {/* Invoice Items */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-800">Invoice Items</h4>
                  <Button 
                    size="sm" 
                    color="primary" 
                    variant="flat"
                    onPress={addInvoiceItem}
                  >
                    + Add Item
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {newInvoice.items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-6 gap-3 items-end p-3 bg-gray-50 rounded-lg">
                      <Input
                        label="Description"
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateInvoiceItem(item.id, 'description', e.target.value)}
                        size="sm"
                      />
                      <Input
                        label="Qty"
                        type="number"
                        min="1"
                        value={item.quantity.toString()}
                        onChange={(e) => updateInvoiceItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        size="sm"
                      />
                      <Input
                        label="Unit Price"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.unitPrice.toString()}
                        onChange={(e) => updateInvoiceItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        size="sm"
                      />
                      <Input
                        label="Total"
                        value={`₵${item.totalPrice.toFixed(2)}`}
                        isReadOnly
                        size="sm"
                      />
                      <Select
                        label="Category"
                        size="sm"
                        value={item.category}
                        onChange={(e) => updateInvoiceItem(item.id, 'category', e.target.value)}
                      >
                        <SelectItem key="room">Room</SelectItem>
                        <SelectItem key="food">Food</SelectItem>
                        <SelectItem key="service">Service</SelectItem>
                        <SelectItem key="amenity">Amenity</SelectItem>
                      </Select>
                      <Button 
                        size="sm" 
                        color="danger" 
                        variant="flat"
                        onPress={() => removeInvoiceItem(item.id)}
                        isDisabled={newInvoice.items.length === 1}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Divider />

              {/* Notes */}
              <div>
                <h4 className="font-semibold mb-2 text-gray-800">Additional Notes</h4>
                <Input
                  placeholder="Any special instructions or notes for this invoice..."
                  value={newInvoice.notes}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 text-gray-800">Invoice Summary</h4>
                <div className="space-y-2 text-right">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">₵{calculateInvoiceTotals().subtotal.toFixed(2)}</span>
                </div>
                  <div className="flex justify-between">
                    <span>Tax (15%):</span>
                    <span className="font-medium">₵{calculateInvoiceTotals().taxAmount.toFixed(2)}</span>
                  </div>
                  <Divider />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-primary">₵{calculateInvoiceTotals().totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCreateClose}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={handleCreateInvoice}
              isDisabled={!newInvoice.guestName || !newInvoice.roomNumber || newInvoice.items.some(item => !item.description || item.unitPrice <= 0)}
            >
              Create Invoice
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
