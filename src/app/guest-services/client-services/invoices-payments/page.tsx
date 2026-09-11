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
import { openPrintPreview, openHtmlPrintWindow } from '../../../lib/print/engine';
import { listTemplates } from '../../../lib/print/templates';
import { buildOrgProfile } from '../../../lib/print/buildOrgProfile';
import { trackEvent } from '../../../lib/analytics/trackEvent';
import { logAudit } from '../../../lib/analytics/auditLogStore';
import { computeSalesTaxTotal, effectiveSalesTaxRate } from '../../../lib/tax/engine';
import { formatMoney } from '../../../lib/format/currency';

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
  const [activeTab, setActiveTab] = useState('folios');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'specific' | 'range'>('today');
  const [dateFilterSingle, setDateFilterSingle] = useState('');
  const [dateFilterFrom, setDateFilterFrom] = useState('');
  const [dateFilterTo, setDateFilterTo] = useState('');
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
  const [folioDateFilterMode, setFolioDateFilterMode] = useState<'all' | 'today' | 'specific' | 'range'>('all');
  const [folioDateSingle, setFolioDateSingle] = useState('');
  const [folioDateFrom, setFolioDateFrom] = useState<string>('');
  const [folioDateTo, setFolioDateTo] = useState<string>('');

  // Payment Ledger date filter
  const [paymentDateFilterMode, setPaymentDateFilterMode] = useState<'all' | 'today' | 'specific' | 'range'>('all');
  const [paymentDateSingle, setPaymentDateSingle] = useState('');
  const [paymentDateFrom, setPaymentDateFrom] = useState('');
  const [paymentDateTo, setPaymentDateTo] = useState('');
  const { isOpen: isFolioModalOpen, onOpen: onFolioModalOpen, onClose: onFolioModalClose } = useDisclosure();
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'charge' | 'credit' | 'discount' | 'complimentary'>('charge');
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
  const { isOpen: isSplitOpen, onOpen: onSplitOpen, onClose: onSplitClose } = useDisclosure();

  const [corpPayerName, setCorpPayerName] = useState('');
  const [corpAmount, setCorpAmount] = useState('');
  const [corpReference, setCorpReference] = useState('');
  const [splitChargeId, setSplitChargeId] = useState<string>('');
  const [splitTargetReservationId, setSplitTargetReservationId] = useState<string>('');
  const [splitAmount, setSplitAmount] = useState<number>(0);
  const [splitNote, setSplitNote] = useState<string>('');
  const [inlineNotification, setInlineNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  // Increments whenever the store notifies — forces useMemos that read store directly to recompute
  const [storeVersion, setStoreVersion] = useState(0);
  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setInlineNotification({ type, message });
    setTimeout(() => setInlineNotification(null), 4000);
  };

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
    // Date filter: match by check-in date
    const today = new Date().toISOString().slice(0, 10);
    const arrivalDate = reservation.arrival?.slice(0, 10) ?? '';
    let dateOk = true;
    if (folioDateFilterMode === 'today') dateOk = arrivalDate === today;
    else if (folioDateFilterMode === 'specific' && folioDateSingle) dateOk = arrivalDate === folioDateSingle;
    else if (folioDateFilterMode === 'range') {
      if (folioDateFrom && arrivalDate < folioDateFrom) dateOk = false;
      if (folioDateTo   && arrivalDate > folioDateTo)   dateOk = false;
    }
    return matchesSearch && matchesStatus && matchesPayer && matchesBalance && dateOk;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folioSearchTerm, folioStatusFilter, payerFilter, balanceFilter, folioDateFilterMode, folioDateSingle, folioDateFrom, folioDateTo, storeVersion]);

  // Reset folio page when filters change
  useEffect(() => {
    setFolioPage(1);
  }, [folioSearchTerm, folioStatusFilter, payerFilter, balanceFilter, folioDateFilterMode, folioDateSingle, folioDateFrom, folioDateTo]);

  const totalFolioPages = useMemo(() => Math.max(1, Math.ceil(
    frontOfficeStore.reservations.filter(matchesFolioFilters).length / itemsPerPage
  // eslint-disable-next-line react-hooks/exhaustive-deps
  )), [folioSearchTerm, folioStatusFilter, payerFilter, balanceFilter, folioDateFilterMode, folioDateSingle, folioDateFrom, folioDateTo, itemsPerPage, storeVersion]);

  // Live folio-backed invoices & payments derived from frontOfficeStore
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const recomputeBillingFromStore = () => {
    const invs: Invoice[] = [];
    const pmts: Payment[] = [];
    
    console.log('[INVOICE-PAYMENT] Recomputing billing from store...');
    console.log('[INVOICE-PAYMENT] Total reservations:', frontOfficeStore.reservations.length);
    
    frontOfficeStore.reservations.forEach(res => {
      frontOfficeStore.ensureReservationRates(res);
      if (res.status === 'checked-in') {
        try { frontOfficeStore.ensureFolioRoomCharges(res.id); } catch {}
      }
      const folio = frontOfficeStore.getOrCreateFolio(res.id);
      const guest = frontOfficeStore.guests.find(g => g.id === res.guestId);
      
      // Update folio balances
      frontOfficeStore.updateFolioBalances(folio);
      
      const subtotal = folio.charges.reduce((s, c) => s + (c.amount || 0), 0);
      const taxAmount = folio.charges.reduce((s, c) => s + (c.tax || 0), 0);
      const totalAmount = subtotal + taxAmount;
      const paid = folio.totalPayments || 0;
      const balance = folio.balance ?? (totalAmount - paid);
      
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
        status: balance <= 0 ? 'paid' : (paid > 0 ? 'partially_paid' : 'pending'),
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
      setStoreVersion(v => v + 1);
    });
    return () => {
      console.log('[INVOICE-PAYMENT] Component unmounting, unsubscribing...');
      unsub();
    };
  }, []);

  // Derive a filtered invoice list so stats and table always agree
  const filteredInvoices = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return invoices
      .filter(inv => statusFilter === 'all' ? true : inv.status === statusFilter)
      .filter(inv => {
        if (!searchTerm.trim()) return true;
        const hay = `${inv.guestName} ${inv.roomNumber} ${inv.invoiceNumber}`.toLowerCase();
        return hay.includes(searchTerm.toLowerCase());
      })
      .filter(inv => {
        const d = inv.createdAt?.slice(0, 10) ?? '';
        if (dateFilterMode === 'today') return d === today;
        if (dateFilterMode === 'specific' && dateFilterSingle) return d === dateFilterSingle;
        if (dateFilterMode === 'range') {
          if (dateFilterFrom && d < dateFilterFrom) return false;
          if (dateFilterTo   && d > dateFilterTo)   return false;
        }
        return true;
      });
  }, [invoices, statusFilter, searchTerm, dateFilterMode, dateFilterSingle, dateFilterFrom, dateFilterTo]);

  const filteredPayments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...payments]
      .filter(p => {
        const d = (p.processedAt || '').slice(0, 10);
        if (paymentDateFilterMode === 'today') return d === today;
        if (paymentDateFilterMode === 'specific' && paymentDateSingle) return d === paymentDateSingle;
        if (paymentDateFilterMode === 'range') {
          if (paymentDateFrom && d < paymentDateFrom) return false;
          if (paymentDateTo   && d > paymentDateTo)   return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());
  }, [payments, paymentDateFilterMode, paymentDateSingle, paymentDateFrom, paymentDateTo]);

  // Stats always reflect the filtered list so KPI cards match the table rows
  const stats = useMemo(() => {
    const totalInvoices   = filteredInvoices.length;
    const totalAmount     = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalCollected  = filteredInvoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.balance), 0);
    const totalOutstanding = filteredInvoices.reduce((sum, inv) => sum + inv.balance, 0);
    const overdueInvoices = filteredInvoices.filter(inv => inv.status === 'overdue').length;
    const overdueAmount   = filteredInvoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.balance, 0);
    const collectionRate  = totalAmount > 0 ? ((totalCollected / totalAmount) * 100) : 0;
    return { totalInvoices, totalAmount, totalCollected, totalOutstanding, overdueInvoices, overdueAmount, collectionRate };
  }, [filteredInvoices]);

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
    const org = buildOrgProfile(settings);

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
    const org = buildOrgProfile(settings);
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

  // Folio Management modal's "Print Folio" — was a bare window.print() of the
  // modal's own live Tailwind-styled DOM (broken: see html2pdf's oklch() error
  // for the same pattern elsewhere). This is a fixed-layout internal report
  // (Guest Information / Financial Summary / Charges & Services / Payments &
  // Credits, mirroring the modal above) — NOT one of the Document Templates
  // engine's customizable invoice/receipt/proforma documents, since a folio
  // report isn't something a tenant reformats per guest-facing branding the
  // way an invoice is; it always looks the same, just with the org's own
  // header up top. Built and opened directly rather than via openPrintPreview.
  const handlePrintFolio = (reservation: any) => {
    if (!reservation) return;
    const folio = frontOfficeStore.getOrCreateFolio(reservation.id);
    const org = buildOrgProfile(settings);
    const currency = settings.countryCompliance[settings.defaultCountry]?.currencySymbol || '₵';
    const fmt = (n?: number) => `${currency}${formatMoney(n || 0)}`;

    const totalCharges = folio.totalCharges || 0;
    const totalPayments = folio.totalPayments || 0;
    const balance = folio.balance || 0;
    const transactionCount = (folio.charges?.length || 0) + (folio.payments?.length || 0);
    const nights = Math.ceil((new Date(reservation.departure).getTime() - new Date(reservation.arrival).getTime()) / 86400000);

    const chargeRows = (folio.charges || []).length
      ? (folio.charges || []).map((c: any) => `
        <tr>
          <td>${new Date(c.date).toLocaleDateString()}</td>
          <td>${c.description || 'Charge'}</td>
          <td class="right">${fmt(c.amount)}</td>
          <td class="right">${fmt(c.tax)}</td>
        </tr>`).join('')
      : `<tr><td colspan="4" class="empty">No charges recorded</td></tr>`;

    const paymentRows = (folio.payments || []).length
      ? (folio.payments || []).map((p: any) => `
        <tr>
          <td>${new Date(p.date).toLocaleDateString()}</td>
          <td>${p.method || ''}</td>
          <td class="right">${fmt(p.amount)}</td>
          <td>${p.status || ''}</td>
          <td>${p.reference || '-'}</td>
        </tr>`).join('')
      : `<tr><td colspan="5" class="empty">No payments recorded</td></tr>`;

    const html = `
    <!doctype html><html><head><meta charset="utf-8" />
    <title>Folio — ${reservation.guestName || ''}</title>
    <style>
      :root { --fg:#111; --muted:#555; --border:#ddd; }
      * { box-sizing:border-box; }
      body { font-family: Arial, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", sans-serif; color:var(--fg); margin:0; padding:24px; }
      h1,h2,h3,h4 { margin:0; }
      .header { text-align:center; border-bottom:2px solid var(--border); padding-bottom:16px; margin-bottom:16px; }
      .logo { max-width:120px; max-height:80px; object-fit:contain; margin-bottom:8px; }
      .org-name { font-size:1.4em; font-weight:700; }
      .org-detail { font-size:12px; color:var(--muted); margin-top:2px; }
      .doc-title { text-align:center; font-size:1.2em; font-weight:700; margin:4px 0 20px; text-decoration:underline; }
      .section { margin-bottom:20px; }
      .section-title { font-size:1.05em; font-weight:700; margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:4px; }
      .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; }
      .field-label { font-size:11px; color:var(--muted); }
      .field-value { font-weight:600; margin-top:2px; }
      .stats { display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; }
      .stat-card { text-align:center; padding:12px; border-radius:8px; border:1px solid var(--border); }
      .stat-value { font-size:1.4em; font-weight:700; }
      .stat-label { font-size:11px; color:var(--muted); margin-top:2px; }
      table { width:100%; border-collapse:collapse; margin-top:8px; font-size:12px; }
      th, td { border:1px solid var(--border); padding:6px 8px; text-align:left; }
      th { background:#f7f7f7; }
      .right { text-align:right; }
      .empty { text-align:center; color:var(--muted); padding:16px; }
      .footer { margin-top:24px; font-size:11px; color:var(--muted); text-align:center; }
      @media print { body { padding:0; } }
    </style>
    </head><body>
      <div class="header">
        ${org.logoUrl ? `<img class="logo" src="${org.logoUrl}" />` : ''}
        <div class="org-name">${org.name || ''}</div>
        <div class="org-detail">${[org.address, org.phone, org.email].filter(Boolean).join(' • ')}</div>
      </div>

      <div class="doc-title">Guest Folio Statement</div>

      <div class="section">
        <div class="section-title">Guest Information</div>
        <div class="grid">
          <div><div class="field-label">Guest Name</div><div class="field-value">${reservation.guestName || 'Unknown'}</div></div>
          <div><div class="field-label">Room Number</div><div class="field-value">${reservation.roomId || 'TBD'}</div></div>
          <div><div class="field-label">Status</div><div class="field-value">${reservation.status || ''}</div></div>
          <div><div class="field-label">Arrival</div><div class="field-value">${new Date(reservation.arrival).toLocaleDateString()}</div></div>
          <div><div class="field-label">Departure</div><div class="field-value">${new Date(reservation.departure).toLocaleDateString()}</div></div>
          <div><div class="field-label">Nights</div><div class="field-value">${nights}</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Financial Summary</div>
        <div class="stats">
          <div class="stat-card" style="background:#eff6ff;"><div class="stat-value" style="color:#2563eb;">${fmt(totalCharges)}</div><div class="stat-label">Total Charges</div></div>
          <div class="stat-card" style="background:#f0fdf4;"><div class="stat-value" style="color:#16a34a;">${fmt(totalPayments)}</div><div class="stat-label">Total Payments</div></div>
          <div class="stat-card" style="background:#fff7ed;"><div class="stat-value" style="color:#c2410c;">${fmt(balance)}</div><div class="stat-label">Outstanding Balance</div></div>
          <div class="stat-card" style="background:#faf5ff;"><div class="stat-value" style="color:#7e22ce;">${transactionCount}</div><div class="stat-label">Transactions</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Charges &amp; Services</div>
        <table>
          <thead><tr><th>Date</th><th>Description</th><th class="right">Amount</th><th class="right">Tax</th></tr></thead>
          <tbody>${chargeRows}</tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Payments &amp; Credits</div>
        <table>
          <thead><tr><th>Date</th><th>Method</th><th class="right">Amount</th><th>Status</th><th>Reference</th></tr></thead>
          <tbody>${paymentRows}</tbody>
        </table>
      </div>

      <div class="footer">Generated ${new Date().toLocaleString()}</div>
    </body></html>`;

    openHtmlPrintWindow(html);
    try { trackEvent('Print.Folio' as any, { reservationId: reservation.id, guestName: reservation.guestName }); } catch {}
    try { logAudit({ area: 'frontdesk', action: 'print', entity: 'Folio', entityId: reservation.id, details: `Printed folio for ${reservation.guestName}`, severity: 'low' }); } catch {}
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
  const handleAddPaymentToInvoice = (invoice: Invoice, amount: number, method: string, notes?: string, reference?: string) => {
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

    // Add payment using the enhanced store method — use the user-entered reference, fall back to auto-id
    frontOfficeStore.addPayment(reservation.id, mapToStoreMethod(method), amount, {
      notes: notes || `Payment added to invoice ${invoice.invoiceNumber}`,
      processedBy: 'Front Desk',
      ref: reference?.trim() || `PAY-${Date.now()}`,
      invoiceId: invoice.id
    });

    try { trackEvent('Invoice.PaymentAdded' as any, { reservationId: reservation.id, invoiceId: invoice.id, amount, method, reference }); } catch {}
    try { logAudit({ area: 'frontdesk', action: 'create', entity: 'Payment', entityId: invoice.id, details: `Added payment ₵${amount} (${method}) to ${invoice.invoiceNumber}${reference ? ` ref: ${reference}` : ''}`, severity: 'low' }); } catch {}
    // Store already calls notify() → subscription re-runs recomputeBillingFromStore automatically
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
    const taxAmount = computeSalesTaxTotal(subtotal);
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
      showNotification('warning', 'Please enter valid adjustment details');
      return;
    }

    try {
      if (adjustmentType === 'charge') {
        frontOfficeStore.addCharge(selectedFolio.id, adjustmentReason, adjustmentAmount);
      } else if (adjustmentType === 'credit') {
        frontOfficeStore.addPayment(selectedFolio.id, 'Credit', adjustmentAmount, { notes: adjustmentReason, processedBy: 'Front Desk' });
      } else if (adjustmentType === 'discount') {
        frontOfficeStore.addCharge(selectedFolio.id, `Discount: ${adjustmentReason}`, -adjustmentAmount);
      } else if (adjustmentType === 'complimentary') {
        frontOfficeStore.addCharge(selectedFolio.id, `Complimentary: ${adjustmentReason}`, -adjustmentAmount);
      }

      try { trackEvent('Folio.AdjustmentProcessed' as any, { reservationId: selectedFolio.id, type: adjustmentType, amount: adjustmentAmount }); } catch {}
      try { logAudit({ area: 'frontdesk', action: 'update', entity: 'Folio', entityId: selectedFolio.id, details: `Adjustment (${adjustmentType}) ₵${adjustmentAmount} - ${adjustmentReason}`, severity: 'low' }); } catch {}

      recomputeBillingFromStore();
      showNotification('success', 'Adjustment processed successfully');
      setAdjustmentAmount(0);
      setAdjustmentReason('');
    } catch (error) {
      console.error('Adjustment processing error:', error);
      showNotification('error', 'Adjustment failed. Please try again.');
    }
  };

  const handleSplitCharge = () => {
    if (!selectedFolio || !splitChargeId || !splitTargetReservationId || splitAmount <= 0) {
      showNotification('warning', 'Select target folio and enter a valid split amount');
      return;
    }
    const ok = frontOfficeStore.splitCharge(
      selectedFolio.id,
      splitChargeId,
      splitTargetReservationId,
      splitAmount,
      splitNote.trim() || undefined,
    );
    if (ok) {
      try { trackEvent('Folio.ChargeSplit' as any, { from: selectedFolio.id, to: splitTargetReservationId, amount: splitAmount }); } catch {}
      try { logAudit({ area: 'frontdesk', action: 'update', entity: 'Folio', entityId: selectedFolio.id, details: `Split ₵${splitAmount} to ${splitTargetReservationId}`, severity: 'medium' }); } catch {}
      recomputeBillingFromStore();
      onSplitClose();
      setSplitChargeId('');
      setSplitTargetReservationId('');
      setSplitAmount(0);
      setSplitNote('');
    } else {
      showNotification('error', 'Split failed — check amount and charge');
    }
  };

  const openSplitModal = (chargeId: string, maxAmount: number) => {
    setSplitChargeId(chargeId);
    setSplitAmount(maxAmount);
    setSplitTargetReservationId('');
    setSplitNote('');
    onSplitOpen();
  };

  // Voiding a folio charge is irreversible (it posts an offsetting negative
  // line rather than deleting anything) and directly changes what the guest
  // owes, so it's gated behind its own permission rather than the general
  // frontdesk.* module access — re-checked here (not just at the button)
  // so a stale render or a direct call can't bypass it.
  const handleVoidCharge = (reservationId: string, chargeId: string) => {
    if (!useSettingsStore.getState().hasPermission('frontdesk.void-charge')) {
      showNotification('error', "You don't have permission to void charges.");
      return;
    }
    if (!window.confirm('Void this charge? This posts a reversing entry and cannot be undone.')) return;
    frontOfficeStore.voidCharge(reservationId, chargeId, 'User action');
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
      {inlineNotification && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${inlineNotification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : inlineNotification.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {inlineNotification.type === 'success' ? '✅' : inlineNotification.type === 'warning' ? '⚠️' : '❌'} {inlineNotification.message}
        </div>
      )}
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
                <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
              </div>
              <div className="text-blue-500 text-2xl">📄</div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{invoices.length} total</p>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Collected</p>
                <p className="text-2xl font-bold text-green-600">₵{formatMoney(stats.totalCollected)}</p>
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
                <p className="text-2xl font-bold text-orange-600">₵{formatMoney(stats.totalOutstanding)}</p>
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
                <p className="text-2xl font-bold text-red-600">₵{formatMoney(stats.overdueAmount)}</p>
              </div>
              <div className="text-red-500 text-2xl">🚨</div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{stats.overdueInvoices} invoices</p>
          </CardBody>
        </Card>
      </div>

      {/* Credit Management Section */}
      {/* Removed per user request */}

      <Card>
        <CardBody>
            <div className="flex gap-3 mb-4 items-center">
            <Button
              variant={activeTab === 'folios' ? 'solid' : 'light'}
              color="primary"
              className={activeTab === 'folios' ? 'bg-indigo-600 text-white font-semibold' : ''}
              onPress={() => setActiveTab('folios')}
            >
              Folios ({frontOfficeStore.reservations.length})
            </Button>
            <Button
              variant={activeTab === 'invoices' ? 'solid' : 'light'}
              color="primary"
              className={activeTab === 'invoices' ? 'bg-indigo-600 text-white font-semibold' : ''}
              onPress={() => setActiveTab('invoices')}
            >
              Invoices ({invoices.length})
            </Button>
            <Button
              variant={activeTab === 'payments' ? 'solid' : 'light'}
              color="primary"
              className={activeTab === 'payments' ? 'bg-indigo-600 text-white font-semibold' : ''}
              onPress={() => setActiveTab('payments')}
            >
              Payment Ledger ({payments.length})
            </Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" color="secondary" variant="solid" className="bg-purple-600 text-white font-semibold px-3" onPress={onCorpOpen}>
                Post Corporate Receipt
              </Button>
            </div>
          </div>

          {activeTab === 'invoices' ? (
            <>
            <div className="space-y-3 mb-3">
              <div className="flex items-center gap-3">
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
              {/* Date filter pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-500 mr-1">📅 Invoice Date:</span>
                {(['all', 'today', 'specific', 'range'] as const).map((mode) => {
                  const labels: Record<string, string> = { all: 'All Dates', today: 'Today', specific: 'Specific Date', range: 'Date Range' };
                  return (
                    <button key={mode} onClick={() => setDateFilterMode(mode)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${dateFilterMode === mode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'}`}
                    >{labels[mode]}</button>
                  );
                })}
                {dateFilterMode === 'specific' && (
                  <input type="date" value={dateFilterSingle} onChange={(e) => setDateFilterSingle(e.target.value)}
                    className="ml-2 px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                )}
                {dateFilterMode === 'range' && (
                  <div className="flex items-center gap-2 ml-2">
                    <input type="date" value={dateFilterFrom} onChange={(e) => setDateFilterFrom(e.target.value)}
                      className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <span className="text-gray-400 text-sm">→</span>
                    <input type="date" value={dateFilterTo} onChange={(e) => setDateFilterTo(e.target.value)}
                      className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                )}
              </div>
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
                {[...filteredInvoices]
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
                        <p className="font-medium">₵{formatMoney(invoice.totalAmount)}</p>
                        <p className="text-sm text-gray-500">Tax: ₵{formatMoney(invoice.taxAmount)}</p>
                        {invoice.discountAmount > 0 && (
                          <p className="text-sm text-green-600">Discount: -₵{formatMoney(invoice.discountAmount)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                        ${invoice.status === 'paid' ? 'bg-green-100 text-green-700 border border-green-200'
                        : invoice.status === 'overdue' ? 'bg-red-100 text-red-700 border border-red-200'
                        : invoice.status === 'partially_paid' ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : invoice.status === 'cancelled' || invoice.status === 'refunded' ? 'bg-gray-100 text-gray-600 border border-gray-200'
                        : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full
                          ${invoice.status === 'paid' ? 'bg-green-500'
                          : invoice.status === 'overdue' ? 'bg-red-500'
                          : invoice.status === 'partially_paid' ? 'bg-blue-500'
                          : invoice.status === 'cancelled' || invoice.status === 'refunded' ? 'bg-gray-400'
                          : 'bg-amber-500'}`} />
                        {invoice.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{invoice.dueDate}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" color="primary" variant="solid" className="bg-blue-600 text-white font-semibold px-3 py-1" onPress={() => handleViewInvoice(invoice)}>
                          View
                        </Button>
                        {invoice.balance > 0 && (
                          <Button
                            size="sm"
                            color="success"
                            variant="solid"
                            className="bg-green-600 text-white font-semibold px-3 py-1"
                            onPress={() => {
                              setSelectedInvoice(invoice);
                              onAddPaymentOpen();
                            }}
                          >
                            Pay
                          </Button>
                        )}
                        {(() => {
                          const reservation = frontOfficeStore.reservations.find(r => r.id === invoice.id);
                          const guest = reservation ? frontOfficeStore.guests.find(g => g.id === reservation.guestId) : null;
                          const creditBalance = guest?.creditBalance || 0;
                          const canUseCredit = creditBalance > 0 && invoice.balance > 0;
                          return canUseCredit ? (
                            <Button size="sm" color="warning" variant="solid" className="text-white font-semibold px-3 py-1" onPress={() => handleApplyCreditToInvoice(invoice)}>
                              Credit
                            </Button>
                          ) : null;
                        })()}
                        <Button size="sm" color="default" variant="solid" className="bg-gray-600 text-white font-semibold px-3 py-1" onPress={() => handlePrintInvoice(invoice)}>Print</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end mt-3">
              <Pagination 
                page={invoicePage}
                total={Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage))}
                onChange={setInvoicePage}
                showControls
                size="sm"
              />
            </div>
            </>
          ) : activeTab === 'payments' ? (
            <>
            {/* Payment Ledger filters */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <div>
                <h3 className="text-base font-semibold text-gray-800">Payment Ledger</h3>
                <p className="text-sm text-gray-500">All recorded payment transactions across guest folios</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-500">📅 Payment Date:</span>
                {(['all', 'today', 'specific', 'range'] as const).map((mode) => {
                  const labels: Record<string, string> = { all: 'All Dates', today: 'Today', specific: 'Specific Date', range: 'Date Range' };
                  return (
                    <button key={mode} onClick={() => { setPaymentDateFilterMode(mode); setPaymentPage(1); }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${paymentDateFilterMode === mode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'}`}
                    >{labels[mode]}</button>
                  );
                })}
                {paymentDateFilterMode === 'specific' && (
                  <input type="date" value={paymentDateSingle} onChange={(e) => { setPaymentDateSingle(e.target.value); setPaymentPage(1); }}
                    className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                )}
                {paymentDateFilterMode === 'range' && (
                  <div className="flex items-center gap-2">
                    <input type="date" value={paymentDateFrom} onChange={(e) => { setPaymentDateFrom(e.target.value); setPaymentPage(1); }}
                      className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <span className="text-gray-400 text-sm">→</span>
                    <input type="date" value={paymentDateTo} onChange={(e) => { setPaymentDateTo(e.target.value); setPaymentPage(1); }}
                      className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                )}
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
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <div className="text-gray-500">
                        <p className="text-lg">No payments found</p>
                        <p className="text-sm">{payments.length > 0 ? 'Try a different date filter' : 'Payments will appear here when they are added to invoices'}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.slice((paymentPage - 1) * itemsPerPage, paymentPage * itemsPerPage)
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
                        {payment.amount < 0 ? (
                          <span className="font-semibold text-purple-600">−₵{formatMoney(Math.abs(payment.amount))}</span>
                        ) : (
                          <span className="font-medium text-gray-900">₵{formatMoney(payment.amount)}</span>
                        )}
                        {payment.amount < 0 && (
                          <p className="text-xs text-purple-500 font-medium">Refund</p>
                        )}
                        {payment.creditApplied && payment.creditApplied > 0 && (
                          <p className="text-xs text-green-600">Credit: ₵{formatMoney(payment.creditApplied)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const res = frontOfficeStore.reservations.find(r => r.id === payment.invoiceId);
                        if (!res) return '—';
                        const folio = frontOfficeStore.getOrCreateFolio(res.id);
                        const balance = folio.balance || 0;
                        return <span className="font-medium">₵{formatMoney(balance)}</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat">{getPaymentMethodLabel(payment.paymentMethod)}</Chip>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                        ${payment.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200'
                        : payment.status === 'failed' ? 'bg-red-100 text-red-700 border border-red-200'
                        : payment.status === 'refunded' ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : payment.status === 'cancelled' ? 'bg-gray-100 text-gray-600 border border-gray-200'
                        : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full
                          ${payment.status === 'completed' ? 'bg-green-500'
                          : payment.status === 'failed' ? 'bg-red-500'
                          : payment.status === 'refunded' ? 'bg-purple-500'
                          : payment.status === 'cancelled' ? 'bg-gray-400'
                          : 'bg-amber-500'}`} />
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm">{new Date(payment.processedAt).toLocaleDateString()}</span>
                        <p className="text-xs text-gray-500">{payment.processedBy}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" color="primary" variant="solid" className="bg-blue-600 text-white font-semibold px-3 py-1" onPress={() => handleViewPayment(payment)}>View</Button>
                        <Button size="sm" color="default" variant="solid" className="bg-gray-600 text-white font-semibold px-3 py-1" onPress={() => handlePrintReceipt(payment)}>Receipt</Button>
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
                total={Math.max(1, Math.ceil(filteredPayments.length / itemsPerPage))}
                onChange={setPaymentPage}
                showControls
                size="sm"
              />
            </div>
            </>
          ) : activeTab === 'folios' ? (
            <>
            <div className="mb-4 p-4 bg-indigo-50 rounded-lg space-y-2">
              {/* Row 1: title */}
              <h3 className="text-lg font-semibold text-indigo-800">Guest Folios</h3>

              {/* Row 2: subtitle left, filters right */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-indigo-600 shrink-0">Live charge ledger per guest — add payments, print invoices, or manage adjustments</p>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Input
                    placeholder="Search guest, room..."
                    value={folioSearchTerm}
                    onChange={(e) => setFolioSearchTerm(e.target.value)}
                    className="w-48"
                    startContent={<span className="text-gray-400 text-sm">🔍</span>}
                    size="sm"
                  />
                  <Select
                    placeholder="Status"
                    selectedKeys={new Set([folioStatusFilter])}
                    onSelectionChange={(keys) => setFolioStatusFilter(Array.from(keys as Set<string>)[0] || 'all')}
                    className="w-36"
                    size="sm"
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
                    className="w-32"
                    size="sm"
                  >
                    <SelectItem key="all">All Payers</SelectItem>
                    <SelectItem key="guest">Guest</SelectItem>
                    <SelectItem key="company">Company</SelectItem>
                  </Select>
                  <Select
                    placeholder="Balance"
                    selectedKeys={new Set([balanceFilter])}
                    onSelectionChange={(keys) => setBalanceFilter((Array.from(keys as Set<string>)[0] as any) || 'all')}
                    className="w-32"
                    size="sm"
                  >
                    <SelectItem key="all">All Balances</SelectItem>
                    <SelectItem key="positive">Outstanding</SelectItem>
                    <SelectItem key="zero">Zero</SelectItem>
                  </Select>
                </div>
              </div>

              {/* Row 3: date pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-sm font-medium text-gray-500">📅 Check-in Date:</span>
                {(['all', 'today', 'specific', 'range'] as const).map((mode) => {
                  const labels: Record<string, string> = { all: 'All Dates', today: 'Today', specific: 'Specific Date', range: 'Date Range' };
                  return (
                    <button key={mode} onClick={() => setFolioDateFilterMode(mode)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${folioDateFilterMode === mode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'}`}
                    >{labels[mode]}</button>
                  );
                })}
                {folioDateFilterMode === 'specific' && (
                  <input type="date" value={folioDateSingle} onChange={(e) => setFolioDateSingle(e.target.value)}
                    className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                )}
                {folioDateFilterMode === 'range' && (
                  <div className="flex items-center gap-2">
                    <input type="date" value={folioDateFrom} onChange={(e) => setFolioDateFrom(e.target.value)}
                      className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <span className="text-gray-400 text-sm">→</span>
                    <input type="date" value={folioDateTo} onChange={(e) => setFolioDateTo(e.target.value)}
                      className="px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                )}
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
                              <span className="font-medium">₵{formatMoney((folio.totalCharges || 0))}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Payments:</span>
                              <span className="font-medium text-green-600">₵{formatMoney((folio.totalPayments || 0))}</span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold">
                              <span>Balance:</span>
                              <span className={((folio.balance || 0) > 0) ? 'text-red-600' : 'text-green-600'}>
                                ₵{formatMoney((folio.balance || 0))}
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
                          <div className="flex gap-1">
                            <Button size="sm" color="primary" variant="solid" className="bg-blue-600 text-white font-semibold px-3 py-1" onPress={() => handleManageFolio(reservation)}>Manage</Button>
                            {(() => {
                              const inv = invoices.find(i => i.id === reservation.id);
                              return inv ? (
                                <Button size="sm" color="default" variant="solid" className="bg-gray-600 text-white font-semibold px-3 py-1" onPress={() => handlePrintInvoice(inv)}>Print</Button>
                              ) : null;
                            })()}
                            {(() => {
                              const inv = invoices.find(i => i.id === reservation.id);
                              const folio = frontOfficeStore.getOrCreateFolio(reservation.id);
                              const bal = folio.balance || 0;
                              return (bal > 0 && inv) ? (
                                <Button size="sm" color="success" variant="solid" className="bg-green-600 text-white font-semibold px-3 py-1" onPress={() => { setSelectedInvoice(inv); onAddPaymentOpen(); }}>Pay</Button>
                              ) : null;
                            })()}
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
                    useSettingsStore.getState().updateNestedSetting('printing', { ...settings.printing, invoice: key });
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
                          <TableCell>₵{formatMoney(item.unitPrice)}</TableCell>
                          <TableCell>₵{formatMoney(item.totalPrice)}</TableCell>
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
                    <p><strong>Subtotal:</strong> ₵{formatMoney(selectedInvoice.subtotal)}</p>
                    <p><strong>Tax:</strong> ₵{formatMoney(selectedInvoice.taxAmount)}</p>
                    {selectedInvoice.discountAmount > 0 && (<p><strong>Discount:</strong> -₵{formatMoney(selectedInvoice.discountAmount)}</p>)}
                    <p className="text-lg font-bold"><strong>Total:</strong> ₵{formatMoney(selectedInvoice.totalAmount)}</p>
                    <p><strong>Balance:</strong> ₵{formatMoney(selectedInvoice.balance)}</p>
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
                              Apply Credit (₵{formatMoney(Math.min(creditBalance, selectedInvoice.balance))})
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
                                    <p className="text-xs text-green-600">Credit: ₵{formatMoney(payment.creditApplied)}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">₵{formatMoney(payment.amount)}</span>
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
              <Input label="Payer (Company)" placeholder="e.g., Ghana Telecom Ltd" isRequired value={corpPayerName}
                onChange={(e) => setCorpPayerName(e.target.value)} />
              <Input label="Amount" type="number" startContent={<span>₵</span>} isRequired value={corpAmount}
                onChange={(e) => setCorpAmount(e.target.value)} />
              <Input label="Bank Reference / LPO / PO Number" placeholder="e.g., BANK-REF-123 or LPO-456" value={corpReference}
                onChange={(e) => setCorpReference(e.target.value)} />
              <div className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded">
                Payment will be auto-allocated to outstanding folios below — highest balance first.
              </div>
              <div className="max-h-56 overflow-auto border rounded-md p-2">
                {[...frontOfficeStore.reservations]
                  .filter(r => (frontOfficeStore.getOrCreateFolio(r.id).balance || 0) > 0)
                  .sort((a, b) => (frontOfficeStore.getOrCreateFolio(b.id).balance || 0) - (frontOfficeStore.getOrCreateFolio(a.id).balance || 0))
                  .map(r => (
                    <div key={r.id} className="flex items-center justify-between py-1 text-sm border-b last:border-0">
                      <div>
                        <span className="font-medium mr-2">{r.guestName}</span>
                        <span className="text-gray-500">Room {r.roomId || 'TBD'}</span>
                        {(r.companyName || r.billingPersonName) && (
                          <span className="ml-2 text-xs text-indigo-600">{r.companyName || r.billingPersonName}</span>
                        )}
                      </div>
                      <div className="text-right font-semibold text-red-600">₵{formatMoney((frontOfficeStore.getOrCreateFolio(r.id).balance || 0))}</div>
                    </div>
                ))}
                {frontOfficeStore.reservations.filter(r => (frontOfficeStore.getOrCreateFolio(r.id).balance || 0) > 0).length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">No outstanding balances</div>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onCorpClose}>Cancel</Button>
            <Button color="primary" variant="solid" className="bg-purple-600 text-white font-semibold" isDisabled={!corpPayerName.trim() || Number(corpAmount) <= 0} onPress={() => {
              const payer = corpPayerName.trim() || 'Corporate Payer';
              const amount = Number(corpAmount || 0);
              if (amount <= 0) return;
              const outstanding = frontOfficeStore.reservations
                .filter(r => (frontOfficeStore.getOrCreateFolio(r.id).balance || 0) > 0)
                .map(r => r.id);
              const result = frontOfficeStore.postCorporateReceipt(payer, outstanding, amount, corpReference.trim() || undefined);
              try { trackEvent('Invoice.CorporateReceipt' as any, { payer, amount, appliedTo: result.allocations?.length || 0 }); } catch {}
              try { logAudit({ area: 'accounting', action: 'create', entity: 'Payment', entityId: `CORP-${Date.now()}`, details: `Corporate receipt ₵${amount} from ${payer}${corpReference ? ` ref: ${corpReference}` : ''}, allocated to ${result.allocations?.length || 0} folios`, severity: 'medium' }); } catch {}
              showNotification('success', `Corporate receipt ₵${formatMoney(amount)} from ${payer} allocated to ${result.allocations?.length || 0} folio(s). Unallocated: ₵${formatMoney(result.remaining)}`);
              setCorpPayerName('');
              setCorpAmount('');
              setCorpReference('');
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
                    <p><strong>Amount:</strong> ₵{formatMoney(selectedPayment.amount)}</p>
                    <p><strong>Method:</strong> {getPaymentMethodLabel(selectedPayment.paymentMethod)}</p>
                    {selectedPayment.creditApplied && selectedPayment.creditApplied > 0 && (
                      <p><strong>Credit Applied:</strong> ₵{formatMoney(selectedPayment.creditApplied)}</p>
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
                      <Input label="Total" value={`₵${formatMoney(item.totalPrice)}`} isReadOnly size="sm" />
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
                  <div className="flex justify-between"><span>Subtotal:</span><span className="font-medium">₵{formatMoney(calculateInvoiceTotals().subtotal)}</span></div>
                  <div className="flex justify-between"><span>Tax ({(effectiveSalesTaxRate() * 100).toFixed(1).replace(/\.0$/, '')}%):</span><span className="font-medium">₵{formatMoney(calculateInvoiceTotals().taxAmount)}</span></div>
                  <Divider />
                  <div className="flex justify-between text-lg font-bold"><span>Total:</span><span className="text-primary">₵{formatMoney(calculateInvoiceTotals().totalAmount)}</span></div>
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
                      <span className="font-medium">₵{formatMoney(selectedInvoice.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount Paid:</span>
                      <span className="font-medium text-green-600">₵{formatMoney((selectedInvoice.totalAmount - selectedInvoice.balance))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Outstanding Balance:</span>
                      <span className="font-medium text-orange-600">₵{formatMoney(selectedInvoice.balance)}</span>
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
                    selectedKeys={new Set([paymentForm.method])}
                    onSelectionChange={(keys) => setPaymentForm(prev => ({ ...prev, method: Array.from(keys as Set<string>)[0] || 'cash' }))}
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
                          <p className="text-sm text-blue-600">Guest has ₵{formatMoney(creditBalance)} credit available</p>
                          <p className="text-xs text-blue-500">Can apply up to ₵{formatMoney(Math.min(creditBalance, selectedInvoice.balance))}</p>
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
                      paymentForm.notes || undefined,
                      paymentForm.reference || undefined
                    );
                    showNotification('success', `Payment of ₵${formatMoney(amount)} recorded for ${selectedInvoice.invoiceNumber}`);
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
          <ModalHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">Folio Management</h2>
                <p className="text-blue-100 text-sm">{selectedFolio?.guestName || 'Unknown Guest'} • Room {selectedFolio?.roomId || 'TBD'}</p>
              </div>
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
                      {selectedFolio.taxExempt && (
                        <div>
                          <div className="text-sm text-gray-600">Tax</div>
                          <Badge color="secondary" variant="flat">Tax Exempt</Badge>
                        </div>
                      )}
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
                            <div className="text-2xl font-bold text-blue-700">₵{formatMoney((folio.totalCharges || 0))}</div>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-sm text-green-600">Total Payments</div>
                            <div className="text-2xl font-bold text-green-700">₵{formatMoney((folio.totalPayments || 0))}</div>
                          </div>
                          <div className="text-center p-4 bg-orange-50 rounded-lg">
                            <div className="text-sm text-orange-600">Outstanding Balance</div>
                            <div className="text-2xl font-bold text-orange-700">₵{formatMoney((folio.balance || 0))}</div>
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
                              return folio.charges.map((charge) => (
                                <TableRow key={charge.id}>
                                  <TableCell>{new Date(charge.date).toLocaleDateString()}</TableCell>
                                  <TableCell>{charge.description}</TableCell>
                                  <TableCell className="text-right">₵{formatMoney(charge.amount)}</TableCell>
                                  <TableCell className="text-right">₵{formatMoney((charge.tax || 0))}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      {settings.hasPermission('frontdesk.void-charge') && (
                                        <Button size="sm" variant="light" onPress={() => handleVoidCharge(selectedFolio.id, charge.id)}>Void</Button>
                                      )}
                                      <Button size="sm" variant="light" color="secondary" onPress={() => openSplitModal(charge.id, charge.amount)}>Split</Button>
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
                              return folio.payments.map((payment) => (
                                <TableRow key={payment.id}>
                                  <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                                  <TableCell>{payment.method}</TableCell>
                                  <TableCell className="text-right">₵{formatMoney(payment.amount)}</TableCell>
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
                          onSelectionChange={(keys) => setAdjustmentType(Array.from(keys as Set<string>)[0] as 'charge' | 'credit' | 'discount' | 'complimentary' || 'charge')}
                        >
                          <SelectItem key="charge">Add Charge</SelectItem>
                          <SelectItem key="credit">Add Credit</SelectItem>
                          <SelectItem key="discount">Apply Discount</SelectItem>
                          <SelectItem key="complimentary">Complimentary (Comp)</SelectItem>
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
                            {adjustmentType === 'charge' && `Will add ₵${formatMoney(adjustmentAmount)} charge: ${adjustmentReason}`}
                            {adjustmentType === 'credit' && `Will add ₵${formatMoney(adjustmentAmount)} credit: ${adjustmentReason}`}
                            {adjustmentType === 'discount' && `Will apply ₵${formatMoney(adjustmentAmount)} discount: ${adjustmentReason}`}
                            {adjustmentType === 'complimentary' && `Will waive ₵${formatMoney(adjustmentAmount)} as complimentary: ${adjustmentReason}`}
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
              onClick={() => handlePrintFolio(selectedFolio)}
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

      <Modal isOpen={isSplitOpen} onClose={onSplitClose}>
        <ModalContent>
          <ModalHeader>Split charge</ModalHeader>
          <ModalBody className="space-y-4">
            <p className="text-sm text-gray-600">
              Move part of this charge to another guest folio. Tax is allocated proportionally.
            </p>
            <Input
              type="number"
              label="Amount to move (₵)"
              value={splitAmount > 0 ? String(splitAmount) : ''}
              onValueChange={(v) => setSplitAmount(parseFloat(v) || 0)}
              min={0}
            />
            <Select
              label="Target reservation"
              placeholder="Select guest folio"
              selectedKeys={splitTargetReservationId ? [splitTargetReservationId] : []}
              onSelectionChange={(keys) => {
                const k = Array.from(keys)[0];
                setSplitTargetReservationId(k ? String(k) : '');
              }}
            >
              {frontOfficeStore.reservations
                .filter((r) => selectedFolio && r.id !== selectedFolio.id && r.status === 'checked-in')
                .map((r) => (
                  <SelectItem key={r.id} textValue={`${r.guestName} (${r.id})`}>
                    {r.guestName} — {r.id}
                  </SelectItem>
                ))}
            </Select>
            <Input
              label="Note (optional)"
              value={splitNote}
              onValueChange={setSplitNote}
              placeholder="e.g. Shared corporate billing"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onSplitClose}>Cancel</Button>
            <Button color="primary" onPress={handleSplitCharge} isDisabled={!splitTargetReservationId || splitAmount <= 0}>
              Split charge
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}


