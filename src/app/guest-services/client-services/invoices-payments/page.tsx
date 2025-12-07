'use client';

// Restored Invoices & Payments component for embedding inside consolidated tab
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Card,
  CardBody,
  CardHeader,
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
import { useSettingsStore } from '../../../lib/settings/store';
import { openPrintPreview } from '../../../lib/print/engine';
import { listTemplates } from '../../../lib/print/templates';
import { trackEvent } from '../../../lib/analytics/trackEvent';
import { logAudit } from '../../../lib/analytics/auditLogStore';

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
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'mobile_money' | 'check' | 'voucher' | 'corporate_account' | 'credit';
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  processedAt: string;
  processedBy: string;
  reference?: string;
  notes?: string;
  receiptUrl?: string;
  creditApplied?: number; // Amount applied from credit balance
  billedTo?: string;
  balance?: number;
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
  const [activeTab, setActiveTab] = useState('payments');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const settings = useSettingsStore();
  
  // Folio management state
  const [selectedFolio, setSelectedFolio] = useState<any>(null);
  const [folioSearchTerm, setFolioSearchTerm] = useState('');
  const [folioStatusFilter, setFolioStatusFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState<'all'|'guest'|'company'>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all'|'zero'|'positive'>('all');
  const [folioSortBy, setFolioSortBy] = useState<'balance'|'updatedAt'>('balance');
  const [folioSortOrder, setFolioSortOrder] = useState<'asc'|'desc'>('desc');
  const [folioDateFrom, setFolioDateFrom] = useState<string>('');
  const [folioDateTo, setFolioDateTo] = useState<string>('');
  const { isOpen: isFolioModalOpen, onOpen: onFolioModalOpen, onClose: onFolioModalClose } = useDisclosure();
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'charge' | 'credit' | 'discount'>('charge');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [folioPage, setFolioPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Modals
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
  const { isOpen: isPaymentOpen, onOpen: onPaymentOpen, onClose: onPaymentClose } = useDisclosure();
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const { isOpen: isAddPaymentOpen, onOpen: onAddPaymentOpen, onClose: onAddPaymentClose } = useDisclosure();
  const { isOpen: isCorpOpen, onOpen: onCorpOpen, onClose: onCorpClose } = useDisclosure();

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'cash',
    notes: '',
    reference: ''
  });

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

  // Folio filters matcher reused for count and slicing
  const matchesFolioFilters = React.useCallback((reservation: any) => {
    const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
    const guestName = guest?.name || reservation.guestName || 'Unknown';
    const matchesSearch = guestName.toLowerCase().includes(folioSearchTerm.toLowerCase()) ||
                          (reservation.guestPhone?.includes(folioSearchTerm) ?? false) ||
                          (reservation.guestEmail?.includes(folioSearchTerm) ?? false);
    const matchesStatus = folioStatusFilter === 'all' || reservation.status === folioStatusFilter;
    // Payer filter: company if billing/company present
    const isCompany = !!(reservation.billingPersonName || reservation.companyName);
    const matchesPayer = payerFilter === 'all' || (payerFilter === 'company' ? isCompany : !isCompany);
    // Balance filter
    const folio = frontOfficeStore.getOrCreateFolio(reservation.id);
    const bal = folio.balance || 0;
    const matchesBalance = balanceFilter === 'all' || (balanceFilter === 'zero' ? bal === 0 : bal > 0);
    // Date range filter: show reservations whose stay overlaps the selected range
    const fromOk = !folioDateFrom || new Date(reservation.departure) >= new Date(folioDateFrom);
    const toOk = !folioDateTo || new Date(reservation.arrival) <= new Date(folioDateTo);
    return matchesSearch && matchesStatus && matchesPayer && matchesBalance && fromOk && toOk;
  }, [folioSearchTerm, folioStatusFilter, payerFilter, balanceFilter, folioDateFrom, folioDateTo]);

  // Reset folio page when filters change
  useEffect(() => {
    setFolioPage(1);
  }, [folioSearchTerm, folioStatusFilter, payerFilter, balanceFilter, folioDateFrom, folioDateTo]);

  const totalFolioPages = Math.max(1, Math.ceil(
    frontOfficeStore.reservations.filter(matchesFolioFilters).length / itemsPerPage
  ));

  // Live folio-backed invoices & payments derived from frontOfficeStore
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const recomputeBillingFromStore = () => {
    const invs: Invoice[] = [];
    const pmts: Payment[] = [];
    
    console.log('[INVOICE-PAYMENT] Recomputing billing from store...');
    console.log('[INVOICE-PAYMENT] Total reservations:', frontOfficeStore.reservations.length);
    
    frontOfficeStore.reservations.forEach(res => {
      const folio = frontOfficeStore.getOrCreateFolio(res.id);
      const guest = frontOfficeStore.guests.find(g => g.id === res.guestId);
      
      // Update folio balances
      frontOfficeStore.updateFolioBalances(folio);
      
      const subtotal = folio.totalCharges || 0;
      const taxAmount = folio.charges.reduce((s, c) => s + (c.tax || 0), 0);
      const totalAmount = subtotal + taxAmount;
      const paid = folio.totalPayments || 0;
      const balance = folio.balance || Math.max(0, totalAmount - paid);
      
      console.log(`[INVOICE-PAYMENT] Reservation ${res.id}: total=${totalAmount}, paid=${paid}, balance=${balance}, payments=${folio.payments.length}`);
      
      // Map payment methods properly
      const mapPaymentMethod = (method: string): string => {
        switch (method) {
          case 'Cash': return 'cash';
          case 'Card': return 'credit_card';
          case 'Mobile Money': return 'mobile_money';
          case 'Credit': return 'credit';
          case 'Corporate Account': return 'corporate_account';
          case 'Bank Transfer': return 'bank_transfer';
          case 'Check': return 'check';
          default: return 'cash';
        }
      };
      
      // Create invoice payments array
      const invoicePayments = folio.payments.map(p => ({ 
        id: p.id, 
        invoiceId: res.id, 
        amount: p.amount, 
        paymentMethod: mapPaymentMethod(p.method) as any, 
        transactionId: p.id, 
        status: p.status || 'completed', 
        processedAt: p.date, 
        processedBy: p.processedBy || 'Front Desk',
        creditApplied: p.creditApplied || 0,
        notes: p.notes,
        reference: p.ref
      }));
      
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
        items: folio.charges.map(c => ({ 
          id: c.id, 
          description: c.description, 
          quantity: 1, 
          unitPrice: c.amount, 
          totalPrice: c.amount, 
          category: 'room' as const, 
          isTaxable: !!c.tax, 
          taxRate: 15 
        })),
        payments: invoicePayments,
        balance
      });
      
      // Add payments to the payments array
      folio.payments.forEach(p => {
        const payment: Payment = {
          id: p.id,
          invoiceId: res.id,
          amount: p.amount,
          paymentMethod: mapPaymentMethod(p.method) as any,
          transactionId: p.id,
          status: p.status || 'completed',
          processedAt: p.date,
          processedBy: p.processedBy || 'Front Desk',
          creditApplied: p.creditApplied || 0,
          notes: p.notes,
          reference: p.ref
        };
        pmts.push(payment);
        console.log(`[INVOICE-PAYMENT] Added payment: ${payment.id} for invoice ${payment.invoiceId}, amount: ₵${payment.amount}`);
      });
    });
    
    console.log(`[INVOICE-PAYMENT] Final results: ${invs.length} invoices, ${pmts.length} payments`);
    console.log('[INVOICE-PAYMENT] Payments:', pmts.map(p => ({ id: p.id, invoiceId: p.invoiceId, amount: p.amount, status: p.status })));
    
    setInvoices(invs);
    setPayments(pmts);
  };

  useEffect(() => {
    console.log('[INVOICE-PAYMENT] Component mounted, initializing...');
    recomputeBillingFromStore();
    const unsub = frontOfficeStore.subscribe(() => {
      console.log('[INVOICE-PAYMENT] Store changed, recomputing...');
      recomputeBillingFromStore();
    });
    return () => {
      console.log('[INVOICE-PAYMENT] Component unmounting, unsubscribing...');
      unsub();
    };
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
      case 'credit': return 'Credit';
      default: return method;
    }
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    const org = (() => {
      const biz = settings.countryCompliance[settings.defaultCountry]?.businessInfo;
      return {
        name: biz?.name || settings.systemName,
        address: biz?.address,
        phone: biz?.phone,
        email: biz?.email,
        taxId: biz?.taxId,
        logoUrl: undefined
      };
    })();

    const data = {
      org,
      guest: {
        name: invoice.guestName,
        roomNumber: invoice.roomNumber,
        roomType: invoice.roomType,
        arrivalDate: invoice.checkInDate,
        departureDate: invoice.checkOutDate,
        nights: invoice.nights
      },
      docNumber: invoice.invoiceNumber,
      docDate: invoice.createdAt,
      title: 'Invoice',
      items: invoice.items.map(it => ({
        description: it.description,
        qty: it.quantity,
        unitPrice: it.unitPrice,
        amount: it.totalPrice,
        date: it.date
      })),
      totals: {
        subTotal: invoice.subtotal,
        taxes: { vat: invoice.taxAmount },
        payments: invoice.totalAmount - invoice.balance,
        balance: invoice.balance,
        discount: invoice.discountAmount,
        grandTotal: invoice.totalAmount
      },
      footerNotes: [settings.invoiceSettings.footerText.replace('{TERMS}', String(settings.invoiceSettings.defaultPaymentTerms))],
      currency: settings.countryCompliance[settings.defaultCountry]?.currencySymbol || '₵'
    } as any;

    openPrintPreview('invoice', settings.printing.invoice, data);
    try { trackEvent('Print.Invoice' as any, { invoiceId: invoice.id, amount: invoice.totalAmount }); } catch {}
    try { logAudit({ area: 'accounting', action: 'print', entity: 'Invoice', entityId: invoice.id, details: `Printed ${invoice.invoiceNumber}`, severity: 'low' }); } catch {}
  };

  const handlePrintReceipt = (payment: Payment) => {
    const inv = invoices.find(i => i.id === payment.invoiceId);
    const org = (() => {
      const biz = settings.countryCompliance[settings.defaultCountry]?.businessInfo;
      return {
        name: biz?.name || settings.systemName,
        address: biz?.address,
        phone: biz?.phone,
        email: biz?.email,
        taxId: biz?.taxId,
        logoUrl: undefined
      };
    })();
    const data = {
      org,
      guest: {
        name: inv?.guestName || '',
        roomNumber: inv?.roomNumber,
        roomType: inv?.roomType,
        arrivalDate: inv?.checkInDate,
        departureDate: inv?.checkOutDate,
        nights: inv?.nights
      },
      docNumber: settings.getNextReceiptNumber(),
      docDate: payment.processedAt,
      title: 'Receipt',
      items: [
        { description: `Payment (${getPaymentMethodLabel(payment.paymentMethod)})`, amount: payment.amount, date: payment.processedAt }
      ],
      totals: {
        subTotal: payment.amount,
        payments: payment.amount,
        balance: 0,
        grandTotal: payment.amount
      },
      currency: settings.countryCompliance[settings.defaultCountry]?.currencySymbol || '₵'
    } as any;

    openPrintPreview('receipt', settings.printing.receipt, data);
    try { trackEvent('Print.Receipt' as any, { paymentId: payment.id, amount: payment.amount }); } catch {}
    try { logAudit({ area: 'accounting', action: 'print', entity: 'Payment', entityId: payment.id, details: `Printed receipt for ${payment.transactionId}`, severity: 'low' }); } catch {}
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    onViewOpen();
  };

  const handleViewPayment = (payment: Payment) => {
    // Enrich the selected payment with reservation context for the modal
    const res = frontOfficeStore.reservations.find(r => r.id === payment.invoiceId);
    const folio = res ? frontOfficeStore.getOrCreateFolio(res.id) : undefined;
    const billedTo = res ? (res.companyName || res.billingPersonName || res.guestName || '—') : '—';
    const balance = folio?.balance || 0;
    setSelectedPayment({ ...payment, billedTo, balance } as any);
    onPaymentOpen();
  };

  // Add payment to specific invoice
  const handleAddPaymentToInvoice = (invoice: Invoice, amount: number, method: string, notes?: string) => {
    // Find the reservation for this invoice
    const reservation = frontOfficeStore.reservations.find(r => r.id === invoice.id);
    if (!reservation) return;

    // Map payment method to store format
    const mapToStoreMethod = (method: string): 'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'|'Check' => {
      switch (method) {
        case 'cash': return 'Cash';
        case 'credit_card': return 'Card';
        case 'mobile_money': return 'Mobile Money';
        case 'credit': return 'Credit';
        case 'corporate_account': return 'Corporate Account';
        case 'bank_transfer': return 'Bank Transfer';
        case 'check': return 'Check';
        default: return 'Cash';
      }
    };

    // Add payment using the enhanced store method
    frontOfficeStore.addPayment(reservation.id, mapToStoreMethod(method), amount, {
      notes: notes || `Payment added to invoice ${invoice.invoiceNumber}`,
      processedBy: 'Front Desk',
      ref: `PAY-${Date.now()}`,
      invoiceId: invoice.id
    });

    try { trackEvent('Invoice.PaymentAdded' as any, { reservationId: reservation.id, invoiceId: invoice.id, amount, method }); } catch {}
    try { logAudit({ area: 'frontdesk', action: 'create', entity: 'Payment', entityId: invoice.id, details: `Added payment ₵${amount} (${method}) to ${invoice.invoiceNumber}`, severity: 'low' }); } catch {}

    // Refresh the data
    setTimeout(() => recomputeBillingFromStore(), 100);
  };

  // Apply credit payment to invoice
  const handleApplyCreditToInvoice = (invoice: Invoice) => {
    const reservation = frontOfficeStore.reservations.find(r => r.id === invoice.id);
    if (!reservation) return;

    const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
    if (!guest || !guest.creditBalance || guest.creditBalance <= 0) return;

    const amount = Math.min(guest.creditBalance, invoice.balance);
    const success = frontOfficeStore.applyCreditPayment(reservation.id, amount, `Credit applied to invoice ${invoice.invoiceNumber}`);
    
    if (success) {
      try { trackEvent('Invoice.CreditApplied' as any, { reservationId: reservation.id, invoiceId: invoice.id, amount }); } catch {}
      try { logAudit({ area: 'frontdesk', action: 'update', entity: 'Invoice', entityId: invoice.id, details: `Applied credit ₵${amount}`, severity: 'low' }); } catch {}
      setTimeout(() => recomputeBillingFromStore(), 100);
    }
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

  // Folio management functions
  const handleManageFolio = (reservation: any) => {
    setSelectedFolio(reservation);
    setAdjustmentAmount(0);
    setAdjustmentReason('');
    setAdjustmentType('charge');
    onFolioModalOpen();
  };

  const handleProcessAdjustment = async () => {
    if (!selectedFolio || adjustmentAmount <= 0 || !adjustmentReason.trim()) {
      alert('Please enter valid adjustment details');
      return;
    }

    try {
      if (adjustmentType === 'charge') {
        frontOfficeStore.addCharge(selectedFolio.id, adjustmentReason, adjustmentAmount);
      } else if (adjustmentType === 'credit') {
        frontOfficeStore.addPayment(selectedFolio.id, 'Credit', adjustmentAmount, { notes: adjustmentReason, processedBy: 'Front Desk' });
      } else if (adjustmentType === 'discount') {
        frontOfficeStore.addCharge(selectedFolio.id, `Discount: ${adjustmentReason}`, -adjustmentAmount);
      }

      try { trackEvent('Folio.AdjustmentProcessed' as any, { reservationId: selectedFolio.id, type: adjustmentType, amount: adjustmentAmount }); } catch {}
      try { logAudit({ area: 'frontdesk', action: 'update', entity: 'Folio', entityId: selectedFolio.id, details: `Adjustment (${adjustmentType}) ₵${adjustmentAmount} - ${adjustmentReason}`, severity: 'low' }); } catch {}

      recomputeBillingFromStore();
      alert('Adjustment processed successfully');
      setAdjustmentAmount(0);
      setAdjustmentReason('');
    } catch (error) {
      console.error('Adjustment processing error:', error);
      alert('Adjustment failed. Please try again.');
    }
  };

  const handleCreateInvoice = () => {
    const { subtotal, taxAmount, totalAmount } = calculateInvoiceTotals();
    // Create or link a reservation so folio/invoice stays consistent
    const reservation = frontOfficeStore.addReservation({
      guestName: newInvoice.guestName || 'Walk-in',
      guestPhone: newInvoice.guestPhone || '',
      guestEmail: newInvoice.guestEmail || '',
      roomType: newInvoice.roomType || 'Standard',
      arrival: newInvoice.checkInDate,
      departure: newInvoice.checkOutDate,
      adults: 1,
      children: 0,
      status: 'confirmed',
      source: 'Direct'
    } as any);

    const invoice: Invoice = {
      id: reservation.id,
      invoiceNumber: settings.getNextInvoiceNumber(),
      guestName: newInvoice.guestName,
      guestEmail: newInvoice.guestEmail,
      guestPhone: newInvoice.guestPhone,
      roomNumber: reservation.roomId || newInvoice.roomNumber,
      roomType: newInvoice.roomType,
      checkInDate: newInvoice.checkInDate,
      checkOutDate: newInvoice.checkOutDate,
      nights: Math.ceil((new Date(newInvoice.checkOutDate).getTime() - new Date(newInvoice.checkInDate).getTime()) / (1000 * 60 * 60 * 24)),
      subtotal,
      taxAmount,
      discountAmount: 0,
      totalAmount,
      status: 'draft',
      dueDate: new Date(Date.now() + settings.invoiceSettings.defaultPaymentTerms * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: newInvoice.notes,
      items: newInvoice.items,
      payments: [],
      balance: totalAmount
    };

    // Convert items into store folio charges for the reservation
    newInvoice.items.forEach(i => {
      const amt = i.totalPrice || (i.quantity * i.unitPrice);
      if (amt && amt !== 0) frontOfficeStore.addCharge(reservation.id, i.description || 'Custom Item', amt);
    });
    recomputeBillingFromStore();

    try { trackEvent('Invoice.Created' as any, { reservationId: reservation.id, invoiceNumber: invoice.invoiceNumber, amount: totalAmount }); } catch {}
    try { logAudit({ area: 'accounting', action: 'create', entity: 'Invoice', entityId: invoice.id, details: `Created ${invoice.invoiceNumber} for ${invoice.guestName}`, severity: 'medium' }); } catch {}

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

      {/* Credit Management Section */}
      {/* Removed per user request */}

      <Card>
        <CardBody>
            <div className="flex gap-4 mb-4 items-center">
            {/* Keep Payments default */}
            <Button
              variant={activeTab === 'payments' ? 'solid' : 'light'}
              color="primary"
              onPress={() => setActiveTab('payments')}
            >
              Payments ({payments.length})
            </Button>
            <Button
              variant={activeTab === 'folios' ? 'solid' : 'light'}
              color="secondary"
              onPress={() => setActiveTab('folios')}
            >
              📊 Folio Management ({frontOfficeStore.reservations.length})
            </Button>
              <Button
                variant={activeTab === 'print' ? 'solid' : 'light'}
                color="secondary"
                onPress={() => setActiveTab('print')}
              >
                🧾 Print Invoice
              </Button>
            <div className="ml-auto">
              <Button size="sm" variant="light" onPress={() => setActiveTab('invoices')}>
                View Invoices ({invoices.length})
              </Button>
              <Button size="sm" color="secondary" variant="flat" className="ml-2" onPress={onCorpOpen}>
                Post Corporate Receipt
              </Button>
            </div>
          </div>

          {activeTab === 'invoices' ? (
            <>
            <div className="flex items-center gap-3 mb-3">
              <Input
                placeholder="Search guest or room..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
                startContent={<span>🔎</span>}
              />
              <Select
                selectedKeys={new Set([statusFilter])}
                onSelectionChange={(keys) => setStatusFilter(Array.from(keys as Set<string>)[0] || 'all')}
                className="w-52"
                aria-label="Filter status"
              >
                <SelectItem key="all">All statuses</SelectItem>
                <SelectItem key="draft">Draft</SelectItem>
                <SelectItem key="pending">Pending</SelectItem>
                <SelectItem key="partially_paid">Partially Paid</SelectItem>
                <SelectItem key="paid">Paid</SelectItem>
                <SelectItem key="overdue">Overdue</SelectItem>
                <SelectItem key="cancelled">Cancelled</SelectItem>
                <SelectItem key="refunded">Refunded</SelectItem>
              </Select>
            </div>
            <Table aria-label="Invoices table">
              <TableHeader>
                <TableColumn>INVOICE</TableColumn>
                <TableColumn>
                  <button
                    className="font-semibold"
                    onClick={() => {
                      setSortBy('createdAt');
                      setSortOrder(prev => (sortBy === 'createdAt' && prev === 'desc') ? 'asc' : (sortBy === 'createdAt' && prev === 'asc') ? 'desc' : 'desc');
                    }}
                  >
                    DATE {sortBy === 'createdAt' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </button>
                </TableColumn>
                <TableColumn>GUEST</TableColumn>
                <TableColumn>ROOM</TableColumn>
                <TableColumn>AMOUNT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>DUE DATE</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {[...invoices]
                  .filter(inv => (statusFilter === 'all' ? true : inv.status === statusFilter))
                  .filter(inv => {
                    if (!searchTerm.trim()) return true;
                    const hay = `${inv.guestName} ${inv.roomNumber} ${inv.invoiceNumber}`.toLowerCase();
                    return hay.includes(searchTerm.toLowerCase());
                  })
                  .sort((a, b) => {
                    const keyA = sortBy === 'createdAt' ? a.createdAt : a.updatedAt;
                    const keyB = sortBy === 'createdAt' ? b.createdAt : b.updatedAt;
                    const av = new Date(keyA).getTime();
                    const bv = new Date(keyB).getTime();
                    return sortOrder === 'asc' ? av - bv : bv - av;
                  })
                  .slice((invoicePage - 1) * itemsPerPage, invoicePage * itemsPerPage)
                  .map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-gray-500">{invoice.checkInDate} - {invoice.checkOutDate}</p>
                        <p className="text-xs text-gray-400">Res: {invoice.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{new Date(invoice.createdAt).toLocaleDateString()}</span>
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
                        {invoice.balance > 0 && (
                          <Button 
                            size="sm" 
                            color="success" 
                            variant="flat"
                            onPress={() => {
                              setSelectedInvoice(invoice);
                              onPaymentOpen();
                            }}
                          >
                            Add Payment
                          </Button>
                        )}
                        {(() => {
                          const reservation = frontOfficeStore.reservations.find(r => r.id === invoice.id);
                          const guest = reservation ? frontOfficeStore.guests.find(g => g.id === reservation.guestId) : null;
                          const creditBalance = guest?.creditBalance || 0;
                          const canUseCredit = creditBalance > 0 && invoice.balance > 0;
                          
                          return canUseCredit ? (
                            <Button 
                              size="sm" 
                              color="primary" 
                              variant="flat"
                              onPress={() => handleApplyCreditToInvoice(invoice)}
                            >
                              Apply Credit
                            </Button>
                          ) : null;
                        })()}
                        <Button size="sm" variant="light" onPress={() => handlePrintInvoice(invoice)}>Print</Button>
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
          ) : activeTab === 'payments' ? (
            <>
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-blue-700">
                    <strong>Debug Info:</strong> Total payments: {payments.length} | 
                    Showing page {paymentPage} of {Math.max(1, Math.ceil(payments.length / itemsPerPage))} | 
                    Items per page: {itemsPerPage}
                  </p>
                  {payments.length > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      Payment IDs: {payments.map(p => p.id).join(', ')}
                    </p>
                  )}
                </div>
                <Button 
                  size="sm" 
                  color="primary" 
                  variant="flat"
                  onPress={() => {
                    console.log('[INVOICE-PAYMENT] Manual refresh triggered');
                    recomputeBillingFromStore();
                  }}
                >
                  🔄 Refresh
                </Button>
              </div>
            </div>
            <Table aria-label="Payments table">
              <TableHeader>
                <TableColumn>TRANSACTION</TableColumn>
                <TableColumn>INVOICE</TableColumn>
                <TableColumn>GUEST</TableColumn>
                <TableColumn>BILLED TO</TableColumn>
                <TableColumn>PAID</TableColumn>
                <TableColumn>BALANCE</TableColumn>
                <TableColumn>METHOD</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>DATE</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <div className="text-gray-500">
                        <p className="text-lg">No payments found</p>
                        <p className="text-sm">Payments will appear here when they are added to invoices</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  [...payments]
                    .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
                    .slice((paymentPage - 1) * itemsPerPage, paymentPage * itemsPerPage)
                    .map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                      <span className="font-medium">{payment.transactionId}</span>
                        <p className="text-sm text-gray-500">Ref: {payment.reference}</p>
                        <p className="text-xs text-gray-400">Res: {payment.invoiceId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{payment.invoiceId}</span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const res = frontOfficeStore.reservations.find(r => r.id === payment.invoiceId);
                        const guestName = res?.guestName || '—';
                        return <span className="font-medium">{guestName}</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const res = frontOfficeStore.reservations.find(r => r.id === payment.invoiceId);
                        if (!res) return '—';
                        const billed = res.companyName || res.billingPersonName || res.guestName || '—';
                        return <span className="font-medium">{billed}</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">₵{payment.amount.toFixed(2)}</span>
                        {payment.creditApplied && payment.creditApplied > 0 && (
                          <p className="text-xs text-green-600">Credit: ₵{payment.creditApplied.toFixed(2)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const res = frontOfficeStore.reservations.find(r => r.id === payment.invoiceId);
                        if (!res) return '—';
                        const folio = frontOfficeStore.getOrCreateFolio(res.id);
                        const balance = folio.balance || 0;
                        return <span className="font-medium">₵{balance.toFixed(2)}</span>;
                      })()}
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
                        <Button size="sm" variant="light" onPress={() => handlePrintReceipt(payment)}>Receipt</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                    ))
                )}
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
          ) : activeTab === 'folios' ? (
            <>
            <div className="mb-4 p-3 bg-purple-50 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-purple-800">📊 Folio Management</h3>
                  <p className="text-sm text-purple-600">Manage guest folios, adjustments, and bulk operations</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search folios..."
                    value={folioSearchTerm}
                    onChange={(e) => setFolioSearchTerm(e.target.value)}
                    className="w-64"
                    startContent={<span>🔍</span>}
                  />
                  <Input type="date" aria-label="From" value={folioDateFrom} onChange={(e)=> setFolioDateFrom(e.target.value)} className="w-36" />
                  <Input type="date" aria-label="To" value={folioDateTo} onChange={(e)=> setFolioDateTo(e.target.value)} className="w-36" />
                  <Select
                    placeholder="Filter by status"
                    selectedKeys={new Set([folioStatusFilter])}
                    onSelectionChange={(keys) => setFolioStatusFilter(Array.from(keys as Set<string>)[0] || 'all')}
                    className="w-48"
                  >
                    <SelectItem key="all">All Status</SelectItem>
                    <SelectItem key="checked-in">Checked In</SelectItem>
                    <SelectItem key="checked-out">Checked Out</SelectItem>
                    <SelectItem key="confirmed">Confirmed</SelectItem>
                  </Select>
                  <Select
                    placeholder="Payer"
                    selectedKeys={new Set([payerFilter])}
                    onSelectionChange={(keys) => setPayerFilter((Array.from(keys as Set<string>)[0] as any) || 'all')}
                    className="w-40"
                  >
                    <SelectItem key="all">All Payers</SelectItem>
                    <SelectItem key="guest">Guest</SelectItem>
                    <SelectItem key="company">Company</SelectItem>
                  </Select>
                  <Select
                    placeholder="Balance"
                    selectedKeys={new Set([balanceFilter])}
                    onSelectionChange={(keys) => setBalanceFilter((Array.from(keys as Set<string>)[0] as any) || 'all')}
                    className="w-40"
                  >
                    <SelectItem key="all">All Balances</SelectItem>
                    <SelectItem key="positive">Outstanding</SelectItem>
                    <SelectItem key="zero">Zero</SelectItem>
                  </Select>
                </div>
              </div>
            </div>

            <Table aria-label="Folio management table">
              <TableHeader>
                <TableColumn>ID</TableColumn>
                <TableColumn>GUEST</TableColumn>
                <TableColumn>PAYER</TableColumn>
                <TableColumn>ROOM</TableColumn>
                <TableColumn>CHECK-IN</TableColumn>
                <TableColumn>CHECK-OUT</TableColumn>
                <TableColumn>
                  <button
                    className="font-semibold"
                    onClick={() => {
                      setFolioSortBy('balance');
                      setFolioSortOrder(prev => (folioSortBy === 'balance' && prev === 'desc') ? 'asc' : (folioSortBy === 'balance' && prev === 'asc') ? 'desc' : 'desc');
                    }}
                  >
                    FINANCIAL STATUS {folioSortBy === 'balance' ? (folioSortOrder === 'asc' ? '▲' : '▼') : ''}
                  </button>
                </TableColumn>
                <TableColumn>FOLIO SUMMARY</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {frontOfficeStore.reservations
                  .filter(matchesFolioFilters)
                  .sort((a, b) => {
                    const fa = frontOfficeStore.getOrCreateFolio(a.id);
                    const fb = frontOfficeStore.getOrCreateFolio(b.id);
                    const av = (fa.balance || 0);
                    const bv = (fb.balance || 0);
                    return folioSortOrder === 'asc' ? av - bv : bv - av;
                  })
                  .slice((folioPage - 1) * itemsPerPage, folioPage * itemsPerPage)
                  .map((reservation) => {
                    const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
                    const folio = frontOfficeStore.getOrCreateFolio(reservation.id);
                    const room = frontOfficeStore.rooms.find(r => r.id === reservation.roomId);
                    const roomType = frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId);
                    const isCompany = !!(reservation.billingPersonName || reservation.companyName);
                    
                    return (
                      <TableRow key={reservation.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{reservation.resId || reservation.id}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-gray-900">{guest?.name || reservation.guestName || 'Unknown Guest'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {isCompany ? (
                              <>
                                <div className="font-medium">Company</div>
                                <div className="text-xs text-gray-500">{reservation.companyName || reservation.billingPersonName || 'Corporate'}</div>
                                {(!((reservation as any).projectCode || (reservation as any).costCenter || (reservation as any).poNumber)) && (
                                  <Badge color="danger" variant="flat" className="mt-1">Missing PO/Ref</Badge>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="font-medium">Guest</div>
                                <div className="text-xs text-gray-500">Self-paying</div>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">Room {room?.id || 'TBD'}</div>
                            <div className="text-xs text-gray-500">{roomType?.name || 'Standard'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{new Date(reservation.arrival).toLocaleDateString()}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{new Date(reservation.departure).toLocaleDateString()}</div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>Charges:</span>
                              <span className="font-medium">₵{(folio.totalCharges || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Payments:</span>
                              <span className="font-medium text-green-600">₵{(folio.totalPayments || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold">
                              <span>Balance:</span>
                              <span className={((folio.balance || 0) > 0) ? 'text-red-600' : 'text-green-600'}>
                                ₵{(folio.balance || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-xs text-gray-600">
                              {folio.charges.length} charges, {folio.payments.length} payments
                            </div>
                            <div className="text-xs text-gray-500">
                              Last updated: {new Date((reservation as any).updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              color="primary"
                              variant="flat"
                              onClick={() => handleManageFolio(reservation)}
                              startContent={<span>📊</span>}
                            >
                              Manage
                            </Button>
                            <Button
                              size="sm"
                              color="secondary"
                              variant="flat"
                              onClick={() => window.print()}
                              startContent={<span>🖨️</span>}
                            >
                              Print
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
            <div className="flex justify-end mt-3">
              <Pagination 
                page={folioPage}
                total={totalFolioPages}
                onChange={setFolioPage}
                showControls
                size="sm"
              />
            </div>
            </>
          ) : activeTab === 'print' ? (
            <>
              <div className="p-4 bg-blue-50 rounded-md mb-3 text-sm text-blue-700">Select an invoice and template, then click Print.</div>
              <div className="flex items-center gap-3 mb-3">
                <Select
                  aria-label="Choose invoice"
                  selectedKeys={new Set([selectedInvoice?.id || invoices[0]?.id || ''])}
                  onSelectionChange={(keys) => {
                    const id = Array.from(keys as Set<string>)[0];
                    const inv = invoices.find(i => i.id === id);
                    if (inv) setSelectedInvoice(inv);
                  }}
                  className="w-72"
                >
                  {invoices.map(inv => (
                    <SelectItem key={inv.id}>{inv.invoiceNumber} • {inv.guestName}</SelectItem>
                  ))}
                </Select>
                <Select
                  aria-label="Template"
                  selectedKeys={new Set([settings.printing.invoice || 'ghana-top-class-invoice'])}
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys as Set<string>)[0];
                    settings.printing.invoice = key as any;
                  }}
                  className="w-80"
                >
                  {listTemplates('invoice').map(t => (
                    <SelectItem key={t.key}>{t.name}</SelectItem>
                  ))}
                </Select>
                <Button color="primary" onPress={() => { if (selectedInvoice) handlePrintInvoice(selectedInvoice); }}>Print</Button>
              </div>
              <div className="text-sm text-gray-600">Tip: Use the new template "Ghana Top Class Invoice" for a premium layout with signatures.</div>
            </>
          ) : null}
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
                    <div><strong>Status:</strong> <span className="inline-flex ml-2"><Badge color={getStatusColor(selectedInvoice.status)} variant="flat" className="ml-2">{selectedInvoice.status.replace('_', ' ')}</Badge></span></div>
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
                  <div>
                    <h4 className="font-semibold mb-2">Payment Actions</h4>
                    {selectedInvoice.balance > 0 ? (
                      <div className="space-y-2">
                        <Button
                          size="sm"
                          color="success"
                          variant="flat"
                          onPress={() => {
                            setSelectedInvoice(selectedInvoice);
                            onAddPaymentOpen();
                          }}
                          className="w-full"
                        >
                          Add Payment
                        </Button>
                        {(() => {
                          const reservation = frontOfficeStore.reservations.find(r => r.id === selectedInvoice.id);
                          const guest = reservation ? frontOfficeStore.guests.find(g => g.id === reservation.guestId) : null;
                          const creditBalance = guest?.creditBalance || 0;
                          const canUseCredit = creditBalance > 0 && selectedInvoice.balance > 0;
                          
                          return canUseCredit ? (
                            <Button
                              size="sm"
                              color="primary"
                              variant="flat"
                              onPress={() => handleApplyCreditToInvoice(selectedInvoice)}
                              className="w-full"
                            >
                              Apply Credit (₵{Math.min(creditBalance, selectedInvoice.balance).toFixed(2)})
                            </Button>
                          ) : null;
                        })()}
                      </div>
                    ) : (
                      <div className="text-center">
                        <Badge color="success" variant="flat" className="text-sm">
                          Fully Paid
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                  <>
                    <Divider />
                    <div>
                      <h4 className="font-semibold mb-2">Payment History</h4>
                      <Table aria-label="Payment history">
                        <TableHeader>
                          <TableColumn>DATE</TableColumn>
                          <TableColumn>METHOD</TableColumn>
                          <TableColumn>AMOUNT</TableColumn>
                          <TableColumn>STATUS</TableColumn>
                          <TableColumn>REFERENCE</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {selectedInvoice.payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>
                                <div>
                                  <p className="text-sm">{new Date(payment.processedAt).toLocaleDateString()}</p>
                                  <p className="text-xs text-gray-500">{payment.processedBy}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <span className="text-sm">{getPaymentMethodLabel(payment.paymentMethod)}</span>
                                  {payment.creditApplied && payment.creditApplied > 0 && (
                                    <p className="text-xs text-green-600">Credit: ₵{payment.creditApplied.toFixed(2)}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">₵{payment.amount.toFixed(2)}</span>
                              </TableCell>
                              <TableCell>
                                <Badge color={getPaymentStatusColor(payment.status)} variant="flat" size="sm">
                                  {payment.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-gray-500">{payment.reference || payment.transactionId}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onViewClose}>Close</Button>
            <Button color="primary" onPress={() => selectedInvoice && handlePrintInvoice(selectedInvoice)}>Print Invoice</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Corporate Receipt Modal */}
      <Modal isOpen={isCorpOpen} onClose={onCorpClose} size="lg">
        <ModalContent>
          <ModalHeader>Post Corporate Receipt</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input label="Payer (Company)" placeholder="e.g., Ghana Telecom Ltd" value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
              <Input label="Amount" type="number" startContent={<span>₵</span>} value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
              <Input label="Reference" placeholder="e.g., BANK-REF-123" value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
              <div className="text-sm text-gray-600">The payment will be auto-allocated to selected outstanding folios by highest balance.</div>
              <div className="max-h-56 overflow-auto border rounded-md p-2">
                {[...frontOfficeStore.reservations]
                  .filter(r => (frontOfficeStore.getOrCreateFolio(r.id).balance || 0) > 0)
                  .map(r => (
                    <div key={r.id} className="flex items-center justify-between py-1 text-sm">
                      <div>
                        <span className="font-medium mr-2">{r.guestName}</span>
                        <span className="text-gray-500">Room {r.roomId || 'TBD'}</span>
                      </div>
                      <div className="text-right">₵{(frontOfficeStore.getOrCreateFolio(r.id).balance || 0).toLocaleString()}</div>
                    </div>
                ))}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={onCorpClose}>Cancel</Button>
            <Button color="primary" onClick={() => {
              const payer = paymentForm.notes || 'Corporate Payer';
              const amount = Number(paymentForm.amount || 0);
              if (amount <= 0) return;
              const outstanding = frontOfficeStore.reservations
                .filter(r => (frontOfficeStore.getOrCreateFolio(r.id).balance || 0) > 0)
                .map(r => r.id);
              const result = frontOfficeStore.postCorporateReceipt(payer, outstanding, amount, paymentForm.reference);
              try { trackEvent('Invoice.CorporateReceipt' as any, { payer, amount, appliedTo: result.allocations?.length || 0 }); } catch {}
              onCorpClose();
            }}>Post Receipt</Button>
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
                    {selectedPayment.creditApplied && selectedPayment.creditApplied > 0 && (
                      <p><strong>Credit Applied:</strong> ₵{selectedPayment.creditApplied.toFixed(2)}</p>
                    )}
                    {selectedPayment.reference && (
                      <p><strong>Reference:</strong> {selectedPayment.reference}</p>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Status</h4>
                    <div><strong>Status:</strong> <span className="inline-flex ml-2"><Badge color={getPaymentStatusColor(selectedPayment.status)} variant="flat" className="ml-2">{selectedPayment.status}</Badge></span></div>
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

      {/* Add Payment Modal */}
      <Modal isOpen={isAddPaymentOpen} onClose={onAddPaymentClose} size="lg">
        <ModalContent>
          <ModalHeader>Add Payment - {selectedInvoice?.invoiceNumber}</ModalHeader>
          <ModalBody>
            {selectedInvoice && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Invoice Summary</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Total Amount:</span>
                      <span className="font-medium">₵{selectedInvoice.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount Paid:</span>
                      <span className="font-medium text-green-600">₵{(selectedInvoice.totalAmount - selectedInvoice.balance).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Outstanding Balance:</span>
                      <span className="font-medium text-orange-600">₵{selectedInvoice.balance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Payment Amount"
                    type="number"
                    min="0.01"
                    max={selectedInvoice.balance}
                    step="0.01"
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    startContent="₵"
                    isRequired
                  />
                  <Select
                    label="Payment Method"
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                    isRequired
                  >
                    <SelectItem key="cash">Cash</SelectItem>
                    <SelectItem key="credit_card">Credit Card</SelectItem>
                    <SelectItem key="mobile_money">Mobile Money</SelectItem>
                    <SelectItem key="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem key="check">Check</SelectItem>
                    <SelectItem key="corporate_account">Corporate Account</SelectItem>
                    <SelectItem key="credit">Credit</SelectItem>
                  </Select>
                </div>

                <Input
                  label="Reference/Transaction ID"
                  placeholder="Enter transaction reference"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                />

                <Input
                  label="Notes"
                  placeholder="Payment notes (optional)"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                />

                {(() => {
                  const reservation = frontOfficeStore.reservations.find(r => r.id === selectedInvoice.id);
                  const guest = reservation ? frontOfficeStore.guests.find(g => g.id === reservation.guestId) : null;
                  const creditBalance = guest?.creditBalance || 0;
                  const canUseCredit = creditBalance > 0 && selectedInvoice.balance > 0;
                  
                  return canUseCredit ? (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2 text-blue-800">Available Credit</h4>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-blue-600">Guest has ₵{creditBalance.toFixed(2)} credit available</p>
                          <p className="text-xs text-blue-500">Can apply up to ₵{Math.min(creditBalance, selectedInvoice.balance).toFixed(2)}</p>
                        </div>
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          onPress={() => {
                            const amount = Math.min(creditBalance, selectedInvoice.balance);
                            setPaymentForm(prev => ({ 
                              ...prev, 
                              amount: amount.toString(),
                              method: 'credit'
                            }));
                          }}
                        >
                          Use Credit
                        </Button>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onAddPaymentClose}>
              Cancel
            </Button>
            <Button
              color="success"
              onPress={() => {
                if (selectedInvoice && paymentForm.amount) {
                  const amount = parseFloat(paymentForm.amount);
                  if (amount > 0 && amount <= selectedInvoice.balance) {
                    handleAddPaymentToInvoice(
                      selectedInvoice,
                      amount,
                      paymentForm.method,
                      paymentForm.notes || undefined
                    );
                    setPaymentForm({ amount: '', method: 'cash', notes: '', reference: '' });
                    onAddPaymentClose();
                  }
                }
              }}
              isDisabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0 || parseFloat(paymentForm.amount) > (selectedInvoice?.balance || 0)}
            >
              Add Payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Folio Management Modal */}
        <Modal isOpen={isFolioModalOpen} onClose={onFolioModalClose} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center justify-between w-full">
              <h3 className="text-xl font-semibold">📊 Folio Management</h3>
              <Badge color="primary" variant="flat">
                {selectedFolio?.guestName || 'Unknown Guest'} - Room {selectedFolio?.roomId || 'TBD'}
              </Badge>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedFolio && (
              <div className="space-y-6">
                {/* Guest Information */}
                <Card>
                  <CardHeader>
                    <h4 className="text-lg font-semibold">Guest Information</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Guest Name</div>
                        <div className="font-medium">{selectedFolio.guestName || 'Unknown'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Room Number</div>
                        <div className="font-medium">{selectedFolio.roomId || 'TBD'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Status</div>
                        <Badge color={selectedFolio.status === 'checked-in' ? 'success' : 'warning'} variant="flat">
                          {selectedFolio.status}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Arrival</div>
                        <div className="font-medium">{new Date(selectedFolio.arrival).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Departure</div>
                        <div className="font-medium">{new Date(selectedFolio.departure).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Nights</div>
                        <div className="font-medium">
                          {Math.ceil((new Date(selectedFolio.departure).getTime() - new Date(selectedFolio.arrival).getTime()) / (1000 * 60 * 60 * 24))}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Financial Summary */}
                <Card>
                  <CardHeader>
                    <h4 className="text-lg font-semibold">Financial Summary</h4>
                  </CardHeader>
                  <CardBody>
                    {(() => {
                      const folio = frontOfficeStore.getOrCreateFolio(selectedFolio.id);
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-sm text-blue-600">Total Charges</div>
                            <div className="text-2xl font-bold text-blue-700">₵{(folio.totalCharges || 0).toLocaleString()}</div>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-sm text-green-600">Total Payments</div>
                            <div className="text-2xl font-bold text-green-700">₵{(folio.totalPayments || 0).toLocaleString()}</div>
                          </div>
                          <div className="text-center p-4 bg-orange-50 rounded-lg">
                            <div className="text-sm text-orange-600">Outstanding Balance</div>
                            <div className="text-2xl font-bold text-orange-700">₵{(folio.balance || 0).toLocaleString()}</div>
                          </div>
                          <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="text-sm text-purple-600">Transactions</div>
                            <div className="text-2xl font-bold text-purple-700">{folio.charges.length + folio.payments.length}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardBody>
                </Card>

                {/* Detailed Folio */}
                <Card>
                  <CardHeader>
                    <h4 className="text-lg font-semibold">Detailed Folio</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-4">
                      {/* Charges */}
                      <div>
                        <h5 className="font-semibold mb-2 text-gray-700">Charges & Services</h5>
                        <Table aria-label="Folio charges">
                          <TableHeader>
                            <TableColumn>Date</TableColumn>
                            <TableColumn>Description</TableColumn>
                            <TableColumn align="end">Amount</TableColumn>
                            <TableColumn align="end">Tax</TableColumn>
                            <TableColumn>Actions</TableColumn>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const folio = frontOfficeStore.getOrCreateFolio(selectedFolio.id);
                              const reservations = frontOfficeStore.reservations.filter(r => r.id !== selectedFolio.id);
                              return folio.charges.map((charge, index) => (
                                <TableRow key={index}>
                                  <TableCell>{new Date(charge.date).toLocaleDateString()}</TableCell>
                                  <TableCell>{charge.description}</TableCell>
                                  <TableCell className="text-right">₵{charge.amount.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">₵{(charge.tax || 0).toLocaleString()}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="light" onPress={() => frontOfficeStore.voidCharge(selectedFolio.id, charge.id, 'User action')}>Void</Button>
                                      {reservations.length > 0 && (
                                        <Button size="sm" variant="light" onPress={() => frontOfficeStore.transferCharge(selectedFolio.id, charge.id, reservations[0].id, 'User action')}>Transfer</Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Payments */}
                      <div>
                        <h5 className="font-semibold mb-2 text-gray-700">Payments & Credits</h5>
                        <Table aria-label="Folio payments">
                          <TableHeader>
                            <TableColumn>Date</TableColumn>
                            <TableColumn>Method</TableColumn>
                            <TableColumn align="end">Amount</TableColumn>
                            <TableColumn>Status</TableColumn>
                            <TableColumn>Reference</TableColumn>
                            <TableColumn>Actions</TableColumn>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const folio = frontOfficeStore.getOrCreateFolio(selectedFolio.id);
                              return folio.payments.map((payment, index) => (
                                <TableRow key={index}>
                                  <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                                  <TableCell>{payment.method}</TableCell>
                                  <TableCell className="text-right">₵{payment.amount.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Badge color={payment.status === 'completed' ? 'success' : 'warning'} variant="flat">
                                      {payment.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{(payment as any).reference || '-'}</TableCell>
                                  <TableCell>
                                    {payment.amount > 0 && (
                                      <Button size="sm" variant="light" onPress={() => frontOfficeStore.refundPayment(selectedFolio.id, payment.id, payment.amount, 'Guest refund')}>Refund</Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Folio Adjustments */}
                <Card>
                  <CardHeader>
                    <h4 className="text-lg font-semibold">Folio Adjustments</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                          label="Adjustment Amount"
                          type="number"
                          value={adjustmentAmount.toString()}
                          onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                          placeholder="0"
                          startContent={<span className="text-gray-400">₵</span>}
                        />
                        <Select
                          label="Adjustment Type"
                          selectedKeys={new Set([adjustmentType])}
                          onSelectionChange={(keys) => setAdjustmentType(Array.from(keys as Set<string>)[0] as 'charge' | 'credit' | 'discount' || 'charge')}
                        >
                          <SelectItem key="charge">Add Charge</SelectItem>
                          <SelectItem key="credit">Add Credit</SelectItem>
                          <SelectItem key="discount">Apply Discount</SelectItem>
                        </Select>
                        <Input
                          label="Reason/Description"
                          value={adjustmentReason}
                          onChange={(e) => setAdjustmentReason(e.target.value)}
                          placeholder="Enter reason for adjustment"
                        />
                      </div>
                      {adjustmentAmount > 0 && adjustmentReason.trim() && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-blue-600">
                            {adjustmentType === 'charge' && `Will add ₵${adjustmentAmount.toLocaleString()} charge: ${adjustmentReason}`}
                            {adjustmentType === 'credit' && `Will add ₵${adjustmentAmount.toLocaleString()} credit: ${adjustmentReason}`}
                            {adjustmentType === 'discount' && `Will apply ₵${adjustmentAmount.toLocaleString()} discount: ${adjustmentReason}`}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={onFolioModalClose}>
              Close
            </Button>
            <Button 
              color="secondary" 
              onClick={() => window.print()}
              startContent={<span>🖨️</span>}
            >
              Print Folio
            </Button>
            <Button 
              color="primary" 
              onClick={handleProcessAdjustment}
              isDisabled={adjustmentAmount <= 0 || !adjustmentReason.trim()}
              startContent={<span>⚡</span>}
            >
              Process Adjustment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}


