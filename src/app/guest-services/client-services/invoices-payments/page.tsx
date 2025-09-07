'use client';

// Restored Invoices & Payments component for embedding inside consolidated tab
import React, { useState, useMemo, useEffect } from 'react';
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
  Pagination,
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
import { frontOfficeStore } from '../../../lib/frontoffice/store';

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
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Modals
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
  const { isOpen: isPaymentOpen, onOpen: onPaymentOpen, onClose: onPaymentClose } = useDisclosure();
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();

  // Create Invoice Form State
  const [newInvoice, setNewInvoice] = useState<{
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    roomNumber: string;
    roomType: string;
    checkInDate: string;
    checkOutDate: string;
    notes: string;
    items: InvoiceItem[];
  }>({
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
      } as InvoiceItem
    ]
  });

  // Live folio-backed invoices & payments derived from frontOfficeStore
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const recomputeBillingFromStore = () => {
    const invs: Invoice[] = [];
    const pmts: Payment[] = [];
    frontOfficeStore.reservations.forEach(res => {
      const folio = frontOfficeStore.getOrCreateFolio(res.id);
      const subtotal = folio.charges.reduce((s, c) => s + c.amount, 0);
      const taxAmount = folio.charges.reduce((s, c) => s + (c.tax || 0), 0);
      const totalAmount = subtotal + taxAmount;
      const paid = folio.payments.reduce((s, p) => s + p.amount, 0);
      const balance = Math.max(0, totalAmount - paid);
      invs.push({
        id: res.id,
        invoiceNumber: `INV-${res.id}`,
        guestName: res.guestName,
        guestEmail: res.guestEmail || '',
        guestPhone: res.guestPhone || '',
        roomNumber: res.roomId || 'TBD',
        roomType: (frontOfficeStore.roomTypes.find(rt => rt.id === res.roomTypeId)?.name) || 'Standard',
        checkInDate: res.arrival,
        checkOutDate: res.departure,
        nights: Math.max(1, Math.ceil((new Date(res.departure).getTime() - new Date(res.arrival).getTime()) / (1000 * 60 * 60 * 24))),
        subtotal,
        taxAmount,
        discountAmount: 0,
        totalAmount,
        status: balance === 0 ? 'paid' : (paid > 0 ? 'partially_paid' : 'pending'),
        paymentMethod: res.paymentMethod,
        dueDate: res.departure,
        createdAt: res.createdAt || new Date().toISOString(),
        updatedAt: res.updatedAt || new Date().toISOString(),
        notes: res.remarksToGuest,
        items: folio.charges.map(c => ({ id: c.id, description: c.description, quantity: 1, unitPrice: c.amount, totalPrice: c.amount, category: 'room' as const, isTaxable: !!c.tax, taxRate: 15 })),
        payments: folio.payments.map(p => ({ id: p.id, invoiceId: res.id, amount: p.amount, paymentMethod: (p.method === 'Cash' ? 'cash' : p.method === 'Card' ? 'credit_card' : 'mobile_money'), transactionId: p.id, status: 'completed', processedAt: p.date, processedBy: 'Front Desk' } as any)),
        balance
      });
      folio.payments.forEach(p => pmts.push({
        id: p.id,
        invoiceId: res.id,
        amount: p.amount,
        paymentMethod: (p.method === 'Cash' ? 'cash' : p.method === 'Card' ? 'credit_card' : 'mobile_money') as any,
        transactionId: p.id,
        status: 'completed',
        processedAt: p.date,
        processedBy: 'Front Desk'
      }));
    });
    setInvoices(invs);
    setPayments(pmts);
  };

  useEffect(() => {
    recomputeBillingFromStore();
    const unsub = frontOfficeStore.subscribe(recomputeBillingFromStore);
    return unsub;
  }, []);

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.balance), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance, 0);
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
    const overdueAmount = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.balance, 0);
    const collectionRate = totalAmount > 0 ? ((totalCollected / totalAmount) * 100) : 0;
    return { totalInvoices, totalAmount, totalCollected, totalOutstanding, overdueInvoices, overdueAmount, collectionRate };
  }, [invoices]);

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

  const addInvoiceItem = () => {
    const newItem: InvoiceItem = { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, totalPrice: 0, category: 'room', isTaxable: true, taxRate: 15 } as InvoiceItem;
    setNewInvoice(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const removeInvoiceItem = (itemId: string) => {
    if (newInvoice.items.length > 1) {
      setNewInvoice(prev => ({ ...prev, items: prev.items.filter(item => item.id !== itemId) }));
    }
  };

  const updateInvoiceItem = (itemId: string, field: keyof InvoiceItem, value: any) => {
    setNewInvoice(prev => {
      const items: InvoiceItem[] = prev.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value } as InvoiceItem;
          if (field === 'quantity' || field === 'unitPrice') {
            updatedItem.totalPrice = updatedItem.quantity * updatedItem.unitPrice;
          }
          return updatedItem;
        }
        return item;
      });
      return { ...prev, items };
    });
  };

  const calculateInvoiceTotals = () => {
    const subtotal = newInvoice.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = subtotal * 0.15;
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
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: newInvoice.notes,
      items: newInvoice.items,
      payments: [],
      balance: totalAmount
    };

    // Convert items into store folio charges
    newInvoice.items.forEach(i => {
      frontOfficeStore.addCharge(invoice.id, i.description || 'Custom Item', i.totalPrice || (i.quantity * i.unitPrice));
    });
    recomputeBillingFromStore();

    setNewInvoice({
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      roomNumber: '',
      roomType: '',
      checkInDate: '',
      checkOutDate: '',
      notes: '',
      items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, totalPrice: 0, category: 'room', isTaxable: true, taxRate: 15 } as InvoiceItem]
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
        <Button color="primary" onPress={onCreateOpen}>+ Create Invoice</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
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
                <p className="text-2xl font-bold text-green-600">₵{(invoices.reduce((s, i) => s + (i.totalAmount - i.balance), 0)).toLocaleString()}</p>
              </div>
              <div className="text-green-500 text-2xl">💰</div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{((invoices.reduce((s, i) => s + (i.totalAmount - i.balance), 0) / invoices.reduce((s, i) => s + i.totalAmount, 0)) * 100 || 0).toFixed(1)}% collection rate</p>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-orange-600">₵{(invoices.reduce((s, i) => s + i.balance, 0)).toLocaleString()}</p>
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
                <p className="text-2xl font-bold text-red-600">₵{(invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.balance, 0)).toLocaleString()}</p>
              </div>
              <div className="text-red-500 text-2xl">🚨</div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{invoices.filter(i => i.status === 'overdue').length} invoices</p>
          </CardBody>
        </Card>
      </div>

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

          {activeTab === 'invoices' ? (
            <>
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
                {invoices
                  .slice((invoicePage - 1) * itemsPerPage, invoicePage * itemsPerPage)
                  .map((invoice) => (
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
                        <Button size="sm" variant="light">Print</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end mt-3">
              <Pagination 
                page={invoicePage}
                total={Math.max(1, Math.ceil(invoices.length / itemsPerPage))}
                onChange={setInvoicePage}
                showControls
                size="sm"
              />
            </div>
            </>
          ) : (
            <>
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
                {payments
                  .slice((paymentPage - 1) * itemsPerPage, paymentPage * itemsPerPage)
                  .map((payment) => (
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
                      <Chip size="sm" variant="flat">{getPaymentMethodLabel(payment.paymentMethod)}</Chip>
                    </TableCell>
                    <TableCell>
                      <Badge color={getPaymentStatusColor(payment.status)} variant="flat">{payment.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm">{new Date(payment.processedAt).toLocaleDateString()}</span>
                        <p className="text-xs text-gray-500">{payment.processedBy}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="light" onPress={() => handleViewPayment(payment)}>View</Button>
                        <Button size="sm" variant="light">Receipt</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end mt-3">
              <Pagination 
                page={paymentPage}
                total={Math.max(1, Math.ceil(payments.length / itemsPerPage))}
                onChange={setPaymentPage}
                showControls
                size="sm"
              />
            </div>
            </>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isViewOpen} onClose={onViewClose} size="2xl">
        <ModalContent>
          <ModalHeader>Invoice Details - {selectedInvoice?.invoiceNumber}</ModalHeader>
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
                    <p><strong>Status:</strong> <Badge color={getStatusColor(selectedInvoice.status)} variant="flat" className="ml-2">{selectedInvoice.status.replace('_', ' ')}</Badge></p>
                    <p><strong>Due Date:</strong> {selectedInvoice.dueDate}</p>
                    <p><strong>Created:</strong> {selectedInvoice.createdAt}</p>
                    <p><strong>Updated:</strong> {selectedInvoice.updatedAt}</p>
                    {selectedInvoice.notes && (<p><strong>Notes:</strong> {selectedInvoice.notes}</p>)}
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
                          <TableCell><Chip size="sm" variant="flat">{item.category}</Chip></TableCell>
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
                    {selectedInvoice.discountAmount > 0 && (<p><strong>Discount:</strong> -₵{selectedInvoice.discountAmount.toFixed(2)}</p>)}
                    <p className="text-lg font-bold"><strong>Total:</strong> ₵{selectedInvoice.totalAmount.toFixed(2)}</p>
                    <p><strong>Balance:</strong> ₵{selectedInvoice.balance.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onViewClose}>Close</Button>
            <Button color="primary">Print Invoice</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isPaymentOpen} onClose={onPaymentClose} size="lg">
        <ModalContent>
          <ModalHeader>Payment Details - {selectedPayment?.transactionId}</ModalHeader>
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
                    <p><strong>Status:</strong> <Badge color={getPaymentStatusColor(selectedPayment.status)} variant="flat" className="ml-2">{selectedPayment.status}</Badge></p>
                    <p><strong>Processed:</strong> {selectedPayment.processedAt}</p>
                    <p><strong>By:</strong> {selectedPayment.processedBy}</p>
                    {selectedPayment.reference && (<p><strong>Reference:</strong> {selectedPayment.reference}</p>)}
                  </div>
                </div>
                {selectedPayment.notes && (<><Divider /><div><h4 className="font-semibold mb-2">Notes</h4><p>{selectedPayment.notes}</p></div></>)}
                {selectedPayment.receiptUrl && (<><Divider /><div><h4 className="font-semibold mb-2">Receipt</h4><Button variant="flat" color="primary" onPress={() => window.open(selectedPayment.receiptUrl, '_blank')}>View Receipt</Button></div></>)}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onPaymentClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="4xl">
        <ModalContent>
          <ModalHeader>Create New Invoice</ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3 text-gray-800">Guest Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Guest Name" placeholder="Enter guest name" value={newInvoice.guestName} onChange={(e) => setNewInvoice(prev => ({ ...prev, guestName: e.target.value }))} required />
                  <Input label="Guest Email" type="email" placeholder="Enter guest email" value={newInvoice.guestEmail} onChange={(e) => setNewInvoice(prev => ({ ...prev, guestEmail: e.target.value }))} required />
                  <Input label="Guest Phone" placeholder="Enter guest phone" value={newInvoice.guestPhone} onChange={(e) => setNewInvoice(prev => ({ ...prev, guestPhone: e.target.value }))} required />
                  <Input label="Room Number" placeholder="Enter room number" value={newInvoice.roomNumber} onChange={(e) => setNewInvoice(prev => ({ ...prev, roomNumber: e.target.value }))} required />
                  <Input label="Room Type" placeholder="e.g., Deluxe Suite, Standard Room" value={newInvoice.roomType} onChange={(e) => setNewInvoice(prev => ({ ...prev, roomType: e.target.value }))} required />
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <Input label="Check-in Date" type="date" value={newInvoice.checkInDate} onChange={(e) => setNewInvoice(prev => ({ ...prev, checkInDate: e.target.value }))} required />
                    <Input label="Check-out Date" type="date" value={newInvoice.checkOutDate} onChange={(e) => setNewInvoice(prev => ({ ...prev, checkOutDate: e.target.value }))} required />
                  </div>
                </div>
              </div>

              <Divider />

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-800">Invoice Items</h4>
                  <Button size="sm" color="primary" variant="flat" onPress={addInvoiceItem}>+ Add Item</Button>
                </div>
                <div className="space-y-3">
                  {newInvoice.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-6 gap-3 items-end p-3 bg-gray-50 rounded-lg">
                      <Input label="Description" placeholder="Item description" value={item.description} onChange={(e) => updateInvoiceItem(item.id, 'description', e.target.value)} size="sm" />
                      <Input label="Qty" type="number" min="1" value={item.quantity.toString()} onChange={(e) => updateInvoiceItem(item.id, 'quantity', parseInt(e.target.value) || 1)} size="sm" />
                      <Input label="Unit Price" type="number" min="0" step="0.01" placeholder="0.00" value={item.unitPrice.toString()} onChange={(e) => updateInvoiceItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} size="sm" />
                      <Input label="Total" value={`₵${item.totalPrice.toFixed(2)}`} isReadOnly size="sm" />
                      <Select label="Category" size="sm" value={item.category} onChange={(e) => updateInvoiceItem(item.id, 'category', e.target.value)}>
                        <SelectItem key="room">Room</SelectItem>
                        <SelectItem key="food">Food</SelectItem>
                        <SelectItem key="service">Service</SelectItem>
                        <SelectItem key="amenity">Amenity</SelectItem>
                      </Select>
                      <Button size="sm" color="danger" variant="flat" onPress={() => removeInvoiceItem(item.id)} isDisabled={newInvoice.items.length === 1}>Remove</Button>
                    </div>
                  ))}
                </div>
              </div>

              <Divider />

              <div>
                <h4 className="font-semibold mb-2 text-gray-800">Additional Notes</h4>
                <Input placeholder="Any special instructions or notes for this invoice..." value={newInvoice.notes} onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))} />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 text-gray-800">Invoice Summary</h4>
                <div className="space-y-2 text-right">
                  <div className="flex justify-between"><span>Subtotal:</span><span className="font-medium">₵{calculateInvoiceTotals().subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Tax (15%):</span><span className="font-medium">₵{calculateInvoiceTotals().taxAmount.toFixed(2)}</span></div>
                  <Divider />
                  <div className="flex justify-between text-lg font-bold"><span>Total:</span><span className="text-primary">₵{calculateInvoiceTotals().totalAmount.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCreateClose}>Cancel</Button>
            <Button color="primary" onPress={handleCreateInvoice} isDisabled={!newInvoice.guestName || !newInvoice.roomNumber || newInvoice.items.some(item => !item.description || item.unitPrice <= 0)}>Create Invoice</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}


