'use client';

/**
 * Guest Check-Out Management Page
 * (Restored as an embeddable component for consolidated tabs)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card,
  CardHeader,
  CardBody,
  Button, 
  Badge, 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell,
  Pagination,
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea,
  Accordion,
  AccordionItem
} from "@heroui/react";
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { openPrintPreview } from '../../lib/print/engine';
import { listTemplates } from '../../lib/print/templates';
import { useSettingsStore } from '../../lib/settings/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { salesTaxBreakdown } from '../../lib/tax/engine';
import { getFolioDisplayTotals } from '../../lib/frontoffice/helpers/folio';

interface CheckOutData {
  id: string; // Reservation ID
  uniqueCheckOutId: string; // Unique check-out identifier
  folioId: string; // Unique folio identifier
  guestProfileId?: string; // Guest Profile ID for repeat visits
  guestName: string;
  roomNumber: string;
  roomType: string;
  roomRate: number;
  checkInDate: string;
  checkInDateTime: string;
  checkOutDate: string;
  checkoutDateTime?: string;
  status: 'pending' | 'processing' | 'completed' | 'extended';
  nightsStayed: number;
  totalCharges: number; // Sum of all charges posted to folio
  totalPayments: number; // Sum of all payments and deposits received
  outstandingBalance: number; // Final amount to be paid
  discount?: number; // Any discounts applied
  finalPaymentMethod?: string; // Payment method for final settlement
  confirmationNumber?: string; // Unique number for final receipt
  roomStatus?: string; // New status of room after checkout
  phone?: string;
  email?: string;
  specialRequests?: string;
  billingPerson?: string;
  lateCheckout?: boolean;
  housekeepingStatus?: string;
  source: string; // Source of original booking
  staffId: string; // Employee who performed checkout
  staffUsername: string; // Staff username for accountability
  adults: number;
  children: number;
  checkoutNotes?: string;
  createdAt: string; // When the check-out record was created
  updatedAt: string; // When the check-out record was last updated
  processedAt?: string; // When the check-out was actually processed
  // UI-only computed fields for display parity with Check-ins
  serviceCharges?: number;
  otherCharges?: number;
  taxTotal?: number;
  roomTotal?: number;
}

export default function CheckOutsPage() {
  const [checkOuts, setCheckOuts] = useState<CheckOutData[]>([]);
  const [filteredCheckOuts, setFilteredCheckOuts] = useState<CheckOutData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<string>('all'); // all | zero | outstanding
  const [billingFilter, setBillingFilter] = useState<string>('all'); // all | guest | corporate | credit
  const [sourceFilter, setSourceFilter] = useState<string>('all'); // market/source
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'specific' | 'range'>('today');
  const [dateFilterSingle, setDateFilterSingle] = useState('');
  const [dateFilterFrom, setDateFilterFrom] = useState('');
  const [dateFilterTo, setDateFilterTo] = useState('');
  // remove duplicate page declaration if present
  const [rowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedCheckOut, setSelectedCheckOut] = useState<CheckOutData | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isBalanceWarnOpen, onOpen: onBalanceWarnOpen, onClose: onBalanceWarnClose } = useDisclosure();
  const [balanceWarnAmount, setBalanceWarnAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [quickSettlementMethod, setQuickSettlementMethod] = useState<'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'>('Cash');
  // Folio settlement state (within modal)
  const [settlementMethod, setSettlementMethod] = useState<'Cash'|'Card'|'Mobile Money'|'Corporate Account'|'Bank Transfer'|'Check'|'Credit'>('Cash');
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementRef, setSettlementRef] = useState<string>('');
  const [usePayLater, setUsePayLater] = useState<boolean>(false);

  // Payment processing state
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentReference, setPaymentReference] = useState<string>('');
  // Print templates
  const receiptTemplates = useMemo(() => listTemplates('receipt'), []);
  const invoiceTemplates = useMemo(() => listTemplates('invoice'), []);
  const proformaTemplates = useMemo(() => listTemplates('proforma'), []);
  const settings = useSettingsStore();
  const [receiptTpl, setReceiptTpl] = useState<string>((settings as any)?.printing?.receipt || receiptTemplates[0]?.key || 'simple-receipt');
  const [invoiceTpl, setInvoiceTpl] = useState<string>((settings as any)?.printing?.invoice || invoiceTemplates[0]?.key || 'corporate-invoice');
  const [proformaTpl, setProformaTpl] = useState<string>((settings as any)?.printing?.proforma || proformaTemplates[0]?.key || 'conference-proforma-grid');

  useEffect(() => {
    loadCheckOuts();
    const unsubscribe = frontOfficeStore.subscribe(loadCheckOuts);
    return unsubscribe;
  }, []);

  useEffect(() => {
    filterCheckOuts();
  }, [checkOuts, searchTerm, statusFilter, balanceFilter, billingFilter, sourceFilter, dateFilterMode, dateFilterSingle, dateFilterFrom, dateFilterTo]);

  // Reset to first page whenever the filtered list changes size
  useEffect(() => {
    setPage(1);
  }, [filteredCheckOuts.length]);

  // Prefill settlement amount when opening modal
  useEffect(() => {
    if (selectedCheckOut) {
      const { outstandingBalance } = getFolioTotals(selectedCheckOut.id);
      setSettlementAmount(outstandingBalance || 0);
      setSettlementMethod('Cash');
      setSettlementRef('');
    }
  }, [selectedCheckOut]);

  // Compute accurate folio totals for a reservation
  const getFolioTotals = (reservationId: string) => {
    const folio = frontOfficeStore.getOrCreateFolio(reservationId);
    frontOfficeStore.updateFolioBalances(folio);
    const totals = getFolioDisplayTotals(folio);
    return {
      totalCharges: totals.totalCharges,
      totalPayments: totals.totalPayments,
      outstandingBalance: totals.outstandingBalance,
      balance: totals.balance,
      serviceCharges: totals.serviceCharges,
      serviceChargesInclusive: totals.serviceChargesInclusive,
      otherCharges: totals.otherCharges,
      taxTotal: totals.taxTotal,
      roomCharges: totals.roomCharges,
      roomChargesInclusive: totals.roomChargesInclusive,
    };
  };

  const loadCheckOuts = () => {
    const reservations = frontOfficeStore.reservations;
    const today = new Date();

    const mapToCheckOutData = (reservation: any): CheckOutData => {
      const checkInDate = new Date(reservation.arrival);
      const checkOutDate = new Date(reservation.departure);
      const nightsStayed = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
      frontOfficeStore.ensureReservationRates(reservation);
      frontOfficeStore.ensureFolioRoomCharges(reservation.id);
      const folioTotals = getFolioTotals(reservation.id);
      const roomType = frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId);
      const quote = frontOfficeStore.getReservationQuote(reservation);
      // Table: tax-inclusive for front-desk quotes; folio accordion keeps net + tax columns.
      const roomRate = quote.nightlyGross;
      const roomTotal = folioTotals.roomChargesInclusive || quote.grandTotal;

      const status: 'pending' | 'processing' | 'completed' | 'extended' =
        reservation.status === 'checked-out'
          ? 'completed'
          : (folioTotals.outstandingBalance || 0) > 0   // use clamped value for status only
          ? 'pending'
          : 'processing';

      return {
        id: reservation.id,
        uniqueCheckOutId: `checkout-${Date.now()}`,
        folioId: reservation.id,
        guestProfileId: undefined,
        guestName: reservation.guestName,
        roomNumber: reservation.roomId || 'TBD',
        roomType: roomType?.name || 'Standard',
        roomRate: roomRate,
        checkInDate: reservation.arrival,
        checkInDateTime: reservation.arrival,
        checkOutDate: reservation.departure,
        checkoutDateTime: (reservation as any).checkOutTime,
        status,
        nightsStayed,
        totalCharges: folioTotals.totalCharges,       // gross incl. tax
        totalPayments: folioTotals.totalPayments,
        outstandingBalance: folioTotals.balance,      // true Amount−Payments; negative = credit/overpayment
        serviceCharges: folioTotals.serviceChargesInclusive, // gross incl. tax
        otherCharges: folioTotals.otherCharges,
        taxTotal: folioTotals.taxTotal,
        roomTotal,                                     // gross incl. tax
        discount: 0,
        finalPaymentMethod: reservation.paymentMethod || 'Not specified',
        confirmationNumber: undefined,
        roomStatus: reservation.status === 'checked-out' ? 'Dirty' : 'Occupied',
        phone: reservation.guestPhone,
        email: reservation.guestEmail,
        specialRequests: reservation.remarksToGuest,
        billingPerson: reservation.billingPersonName,
        lateCheckout: false,
        housekeepingStatus: reservation.status === 'checked-out' ? 'turnover' : 'pending',
        source: reservation.source || 'Front Office',
        staffId: 'pending',
        staffUsername: 'Pending',
        adults: reservation.adults || 1,
        children: reservation.children || 0,
        checkoutNotes: (reservation as any).checkoutNotes,
        createdAt: reservation.createdAt || new Date().toISOString(),
        updatedAt: reservation.updatedAt || new Date().toISOString(),
        processedAt: (reservation as any).checkOutTime
      };
    };

    const due = reservations
      .filter(r => r.status === 'checked-in' && new Date(r.departure) <= today)
      .map(mapToCheckOutData);

    const completed = reservations
      .filter(r => r.status === 'checked-out')
      .map(mapToCheckOutData);

    const checkOutsData: CheckOutData[] = [...due, ...completed];
    setCheckOuts(checkOutsData);
  };

  const filterCheckOuts = () => {
    let filtered = checkOuts;

    if (searchTerm) {
      filtered = filtered.filter(checkOut => 
        checkOut.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checkOut.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checkOut.phone?.includes(searchTerm) ||
        checkOut.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(checkOut => checkOut.status === statusFilter);
    }

    if (balanceFilter !== 'all') {
      filtered = filtered.filter(c => balanceFilter === 'zero' ? (c.outstandingBalance || 0) === 0 : (c.outstandingBalance || 0) > 0);
    }

    if (billingFilter !== 'all') {
      filtered = filtered.filter(c => {
        const type = (c.billingPerson ? 'corporate' : (c.finalPaymentMethod || '').toLowerCase().includes('credit') ? 'credit' : 'guest');
        return type === billingFilter;
      });
    }

    if (sourceFilter !== 'all') {
      filtered = filtered.filter(c => (c.source || '').toUpperCase() === sourceFilter.toUpperCase());
    }

    const today = new Date().toISOString().slice(0, 10);
    if (dateFilterMode === 'today') {
      filtered = filtered.filter(c => c.checkOutDate?.slice(0, 10) === today);
    } else if (dateFilterMode === 'specific' && dateFilterSingle) {
      filtered = filtered.filter(c => c.checkOutDate?.slice(0, 10) === dateFilterSingle);
    } else if (dateFilterMode === 'range') {
      filtered = filtered.filter(c => {
        const d = c.checkOutDate?.slice(0, 10) ?? '';
        if (dateFilterFrom && d < dateFilterFrom) return false;
        if (dateFilterTo   && d > dateFilterTo)   return false;
        return true;
      });
    }

    setFilteredCheckOuts(filtered);
  };

  // Simplified payment processing - open billing tab for detailed folio management
  const handleManageFolio = (checkOut: CheckOutData) => {
    window.location.href = '/guest-services/check-ins?tab=billing';
  };

  // Payment processing removed - handled in invoices & payments page

  const handleCheckOut = async (checkOut: CheckOutData) => {
    setIsProcessing(true);
    try {
      // Respect Pay Later policy from settings
      const settingsState = useSettingsStore.getState();
      const policy = settingsState.roomManagement?.payLaterPolicy || 'both';
      const res = frontOfficeStore.reservations.find(r => r.id === checkOut.id);
      const isCorporate = !!(res?.companyName || res?.billingPersonName);
      const payLaterAllowed = (policy === 'both') || (policy === 'corporate' && isCorporate) || (policy === 'individual' && !isCorporate);

      // Prevent checkout if there is an outstanding balance and pay later is NOT allowed (or not selected)
      const { outstandingBalance } = getFolioTotals(checkOut.id);
      if (outstandingBalance > 0 && !(payLaterAllowed && usePayLater)) {
        setBalanceWarnAmount(outstandingBalance);
        onBalanceWarnOpen();
        setIsProcessing(false);
        return;
      }

      // Use store API for checkout to ensure consistency
      frontOfficeStore.processCheckout(checkOut.id, checkoutNotes);

      trackEvent('FO.Reservation.CheckedOut', {
        reservationId: checkOut.id,
        guestName: checkOut.guestName,
        roomNumber: checkOut.roomNumber,
        nightsStayed: checkOut.nightsStayed
      });

      onClose();
      setSelectedCheckOut(null);
      setCheckoutNotes('');
    } catch (error) {
      console.error('Error processing check-out:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Called when staff confirm "proceed anyway" from balance-warning modal
  const handleBalanceWarnConfirm = () => {
    onBalanceWarnClose();
    if (!selectedCheckOut) return;
    setIsProcessing(true);
    try {
      frontOfficeStore.processCheckout(selectedCheckOut.id, checkoutNotes);
      trackEvent('FO.Reservation.CheckedOut', {
        reservationId: selectedCheckOut.id,
        guestName: selectedCheckOut.guestName,
        roomNumber: selectedCheckOut.roomNumber,
        nightsStayed: selectedCheckOut.nightsStayed
      });
      onClose();
      setSelectedCheckOut(null);
      setCheckoutNotes('');
    } catch (err) {
      console.error('Error processing check-out:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick settlement to clear outstanding balance before checkout
  const handleQuickSettlement = (checkOut: CheckOutData) => {
    const { outstandingBalance } = getFolioTotals(checkOut.id);
    if (outstandingBalance <= 0) return;
    
    // Use the enhanced addPayment method with proper options
    frontOfficeStore.addPayment(checkOut.id, quickSettlementMethod, outstandingBalance, {
      notes: `Quick settlement during checkout - ${checkOut.guestName}`,
      processedBy: 'Front Desk',
      ref: `SETTLE-${Date.now()}`
    });
    
    setTimeout(() => loadCheckOuts(), 0);
  };

  const handleExtendStay = async (checkOut: CheckOutData, additionalNights: number) => {
    try {
      const updatedReservation = frontOfficeStore.reservations.find(r => r.id === checkOut.id);
      if (updatedReservation) {
        const currentDeparture = new Date(updatedReservation.departure);
        currentDeparture.setDate(currentDeparture.getDate() + additionalNights);
        updatedReservation.departure = currentDeparture.toISOString();
        updatedReservation.status = 'checked-in';
        frontOfficeStore.notify();
      }

      trackEvent('FO.Reservation.Updated', {
        reservationId: checkOut.id,
        guestName: checkOut.guestName,
        additionalNights
      });

      onClose();
      setSelectedCheckOut(null);
    } catch (error) {
      console.error('Error extending stay:', error);
    }
  };

  // Ghanaian hotel-specific checkout processes
  const handlePrintReceipt = (checkOut: CheckOutData) => {
    const data = buildPrintData(checkOut);
    openPrintPreview('receipt', receiptTpl, data);
  };

  const handlePrintInvoice = (checkOut: CheckOutData) => {
    const data = buildPrintData(checkOut);
    openPrintPreview('invoice', invoiceTpl, data);
  };

  const handleGuestFeedback = (checkOut: CheckOutData) => {
    console.log(`[CHECKOUT] Guest feedback requested for: ${checkOut.guestName} in room ${checkOut.roomNumber}`);
    // This would typically open a feedback form
    trackEvent('FO.Reservation.CheckedOut', {
      reservationId: checkOut.id,
      guestName: checkOut.guestName,
      roomNumber: checkOut.roomNumber
    });
  };

  const handleLoyaltyPoints = (checkOut: CheckOutData) => {
    console.log(`[CHECKOUT] Loyalty points processing for: ${checkOut.guestName}`);
    // This would typically calculate and award loyalty points
    trackEvent('FO.Reservation.CheckedOut', {
      reservationId: checkOut.id,
      guestName: checkOut.guestName,
      nightsStayed: checkOut.nightsStayed,
      totalCharges: checkOut.totalCharges
    });
  };

  const handleTaxiService = (checkOut: CheckOutData) => {
    console.log(`[CHECKOUT] Taxi service requested for: ${checkOut.guestName}`);
    // This would typically arrange taxi service
    trackEvent('FO.Reservation.CheckedOut', {
      reservationId: checkOut.id,
      guestName: checkOut.guestName,
      roomNumber: checkOut.roomNumber
    });
  };

  const openCheckOutModal = (checkOut: CheckOutData) => {
    setSelectedCheckOut(checkOut);
    onOpen();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'primary';
      case 'completed': return 'success';
      case 'extended': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'completed': return 'Completed';
      case 'extended': return 'Extended';
      default: return status;
    }
  };

  // Stats always reflect the filtered list so KPI cards match the table rows
  const checkoutStats = useMemo(() => {
    const totalPending   = filteredCheckOuts.filter(c => c.status === 'pending').length;
    const totalCompleted = filteredCheckOuts.filter(c => c.status === 'completed').length;
    const totalExtended  = filteredCheckOuts.filter(c => c.status === 'extended').length;
    const totalRevenue   = filteredCheckOuts.reduce((sum, c) => sum + c.totalCharges, 0);
    return { totalPending, totalCompleted, totalExtended, totalRevenue };
  }, [filteredCheckOuts]);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatMoney = (amount: number) =>
    amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', hour12: true });

  const getAnalyticsData = (checkOut: CheckOutData) => ({
    'data-checkout-id': checkOut.uniqueCheckOutId,
    'data-reservation-id': checkOut.id,
    'data-staff-id': checkOut.staffId,
    'data-staff-username': checkOut.staffUsername,
    'data-created-date': checkOut.createdAt,
    'data-processed-date': checkOut.processedAt,
    'data-status': checkOut.status,
    'data-room-type': checkOut.roomType,
    'data-source': checkOut.source
  });

  // Build printable data from store folio/reservation
  const buildPrintData = (checkOut: CheckOutData) => {
    const settings = useSettingsStore.getState?.() as any;
    const org = {
      name: settings?.organization?.name || 'Hotel',
      address: settings?.organization?.address || '',
      phone: settings?.organization?.phone || '',
      email: settings?.organization?.email || '',
      taxId: settings?.organization?.taxId || '',
      logoUrl: settings?.branding?.logoUrl || ''
    };
    const folio = frontOfficeStore.getOrCreateFolio(checkOut.id);
    const items = (folio.charges || []).map((c) => ({ description: c.description || 'Charge', amount: (c.amount || 0) + (c.tax || 0), unitPrice: c.amount, qty: 1 }));
    const baseSum = (folio.charges || []).reduce((s, c) => s + (c.amount || 0), 0);
    const taxSum = (folio.charges || []).reduce((s, c) => s + (c.tax || 0), 0);
    const breakdown = salesTaxBreakdown(baseSum);
    const taxes = { vat: breakdown.vat, nhil: breakdown.nhil, levy: breakdown.tourism };
    const payments = (folio.payments || []).filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
    const subTotal = baseSum;
    const grandTotal = baseSum + taxSum;
    const balance = grandTotal - payments; // true balance: negative = credit/overpayment
    return {
      org,
      guest: {
        name: checkOut.guestName,
        company: checkOut.billingPerson,
        roomNumber: checkOut.roomNumber,
        roomType: checkOut.roomType,
        arrivalDate: new Date(checkOut.checkInDate).toLocaleDateString(),
        departureDate: new Date(checkOut.checkOutDate).toLocaleDateString(),
        nights: checkOut.nightsStayed
      },
      docNumber: checkOut.id,
      docDate: new Date().toISOString(),
      items,
      totals: { subTotal, taxes, payments, balance, grandTotal },
      footerNotes: [
        'Accounts must be settled before vacating room.',
        'Please return key at Reception before departure.'
      ],
      currency: '₵'
    } as any;
  };

  return (
    <div className="pt-2">
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">🚪 Guest Check-outs</h1>
            <p className="text-gray-600">Process guest departures and manage checkout workflow</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Check-outs</p>
                    <p className="text-2xl font-bold text-ghana-black">{checkoutStats.totalPending}</p>
                  </div>
                  <div className="text-2xl">⏳</div>
                </div>
              </CardBody>
            </Card>
            <Card className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Completed Today</p>
                    <p className="text-2xl font-bold text-ghana-black">{checkoutStats.totalCompleted}</p>
                  </div>
                  <div className="text-2xl">✅</div>
                </div>
              </CardBody>
            </Card>
            <Card className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Extended Stays</p>
                    <p className="text-2xl font-bold text-ghana-black">{checkoutStats.totalExtended}</p>
                  </div>
                  <div className="text-2xl">🔄</div>
                </div>
              </CardBody>
            </Card>
            <Card className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-ghana-black">₵{checkoutStats.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="text-2xl">💰</div>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card className="mb-6">
            <CardBody className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Input
                  placeholder="Search by guest name, room number, phone, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                  startContent={<span className="text-gray-400">🔍</span>}
                />
                <Select
                  placeholder="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-48"
                >
                  <SelectItem key="all">All Statuses</SelectItem>
                  <SelectItem key="pending">Pending</SelectItem>
                  <SelectItem key="processing">Processing</SelectItem>
                  <SelectItem key="completed">Completed</SelectItem>
                  <SelectItem key="extended">Extended</SelectItem>
                </Select>
                <Select
                  placeholder="Settlement"
                  value={quickSettlementMethod}
                  onChange={(e) => setQuickSettlementMethod(e.target.value as any)}
                  className="w-full sm:w-48"
                >
                  <SelectItem key="Cash">Cash</SelectItem>
                  <SelectItem key="Card">Card</SelectItem>
                  <SelectItem key="Mobile Money">Mobile Money</SelectItem>
                  <SelectItem key="Credit">Credit</SelectItem>
                  <SelectItem key="Corporate Account">Corporate Account</SelectItem>
                  <SelectItem key="Bank Transfer">Bank Transfer</SelectItem>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <Select placeholder="Balance" value={balanceFilter} onChange={(e)=> setBalanceFilter(e.target.value)}>
                  <SelectItem key="all">All</SelectItem>
                  <SelectItem key="zero">Zero</SelectItem>
                  <SelectItem key="outstanding">Outstanding</SelectItem>
                </Select>
                <Select placeholder="Billing Type" value={billingFilter} onChange={(e)=> setBillingFilter(e.target.value)}>
                  <SelectItem key="all">All</SelectItem>
                  <SelectItem key="guest">Guest Pays</SelectItem>
                  <SelectItem key="corporate">Corporate</SelectItem>
                  <SelectItem key="credit">Credit</SelectItem>
                </Select>
                <Select
                  placeholder="Source"
                  selectedKeys={[sourceFilter]}
                  onSelectionChange={(keys)=> setSourceFilter(Array.from(keys)[0] as string)}
                  items={[{ key: 'all', label: 'All' }, ...((frontOfficeStore.marketCodes || []).map((mc: any) => ({ key: String(mc), label: String(mc) })))] as any}
                >
                  {(item: any) => (<SelectItem key={item.key}>{item.label}</SelectItem>)}
                </Select>
              </div>
              {/* Date filter pills */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-sm font-medium text-gray-500 mr-1">📅 Check-out Date:</span>
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
            </CardBody>
          </Card>

          <Table aria-label="Check-outs table" className="min-w-full">
            <TableHeader>
              <TableColumn className="w-28">ID</TableColumn>
              <TableColumn className="w-40">GUEST</TableColumn>
              <TableColumn className="w-36">BILLED TO</TableColumn>
              <TableColumn className="w-20">ROOM</TableColumn>
              <TableColumn className="w-28">ROOM TYPE</TableColumn>
              <TableColumn className="w-20">ADULTS</TableColumn>
              <TableColumn className="w-20">CHILDREN</TableColumn>
              <TableColumn className="w-28">ARRIVAL</TableColumn>
              <TableColumn className="w-28">DEPARTURE</TableColumn>
              <TableColumn className="w-20">NIGHTS</TableColumn>
              <TableColumn className="w-24">RATE/NIGHT</TableColumn>
              <TableColumn className="w-28">ROOM TOTAL</TableColumn>
              <TableColumn className="w-28">SERVICE CHARGES</TableColumn>
              <TableColumn className="w-28">AMOUNT</TableColumn>
              <TableColumn className="w-28">PAYMENTS</TableColumn>
              <TableColumn className="w-28">BALANCE</TableColumn>
              <TableColumn className="w-24">STATUS</TableColumn>
              <TableColumn className="w-36">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {[...filteredCheckOuts]
                .sort((a, b) => {
                  const ad = new Date(a.updatedAt || a.createdAt).getTime();
                  const bd = new Date(b.updatedAt || b.createdAt).getTime();
                  return bd - ad;
                })
                .slice((page - 1) * rowsPerPage, page * rowsPerPage)
                .map((checkOut) => (
                <TableRow 
                  key={checkOut.id}
                  className="hover:bg-gray-50"
                  {...getAnalyticsData(checkOut)}
                >
                  <TableCell className="font-semibold">{checkOut.id}</TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{checkOut.guestName}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {(() => {
                        const res = frontOfficeStore.reservations.find(r => r.id === checkOut.id);
                        const billed = res?.companyName || res?.billingPersonName || 'Self';
                        return <span className="font-medium">{billed}</span>;
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{checkOut.roomNumber}</TableCell>
                  <TableCell className="text-center">{checkOut.roomType}</TableCell>
                  <TableCell className="text-center">{checkOut.adults}</TableCell>
                  <TableCell className="text-center">{checkOut.children}</TableCell>
                  <TableCell className="text-center">{formatDate(checkOut.checkInDate)}</TableCell>
                  <TableCell className="text-center">{formatDate(checkOut.checkOutDate)}</TableCell>
                  <TableCell className="text-center">{checkOut.nightsStayed}</TableCell>
                  <TableCell className="text-center font-semibold">₵{formatMoney(checkOut.roomRate)}</TableCell>
                  <TableCell className="text-center font-semibold text-purple-600">₵{formatMoney(checkOut.roomTotal || 0)}</TableCell>
                  <TableCell className="text-center font-semibold text-orange-600">₵{formatMoney(checkOut.serviceCharges || 0)}</TableCell>
                  <TableCell className="text-center font-semibold text-blue-600">₵{formatMoney(checkOut.totalCharges || 0)}</TableCell>
                  <TableCell className="text-center text-green-600 font-semibold">₵{formatMoney(checkOut.totalPayments || 0)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-semibold ${(checkOut.outstandingBalance || 0) > 0 ? 'text-red-600' : (checkOut.outstandingBalance || 0) < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      ₵{formatMoney(checkOut.outstandingBalance || 0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                      ${checkOut.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200'
                      : checkOut.status === 'processing' ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : checkOut.status === 'extended' ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full
                        ${checkOut.status === 'completed' ? 'bg-green-500'
                        : checkOut.status === 'processing' ? 'bg-blue-500'
                        : checkOut.status === 'extended' ? 'bg-purple-500'
                        : 'bg-amber-500'}`} />
                      {getStatusText(checkOut.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button
                        size="sm"
                        color="primary"
                        variant="solid"
                        className="bg-blue-600 text-white font-semibold px-3 py-1"
                        onClick={() => openCheckOutModal(checkOut)}
                      >
                        View
                      </Button>
                      {(checkOut.outstandingBalance || 0) > 0 && (
                        <Button
                          size="sm"
                          color="success"
                          variant="solid"
                          className="bg-green-600 text-white font-semibold px-3 py-1"
                          onClick={() => handleManageFolio(checkOut)}
                        >
                          Pay
                        </Button>
                      )}
                      <Button
                        size="sm"
                        color="default"
                        variant="solid"
                        className="bg-gray-600 text-white font-semibold px-3 py-1"
                        onClick={() => {
                        const inv = {
                          id: checkOut.id,
                          invoiceNumber: `INV-${checkOut.id}`,
                          guestName: checkOut.guestName,
                          guestEmail: (checkOut as any).guestEmail || '',
                          guestPhone: (checkOut as any).guestPhone || '',
                          roomNumber: String(checkOut.roomNumber || ''),
                          roomType: String(checkOut.roomType || ''),
                          checkInDate: checkOut.checkInDate,
                          checkOutDate: checkOut.checkOutDate,
                          nights: checkOut.nightsStayed,
                          subtotal: (checkOut.totalCharges || 0) - ((frontOfficeStore.getOrCreateFolio(checkOut.id).charges || []).reduce((s,c)=> s + (c.tax || 0),0)),
                          taxAmount: (frontOfficeStore.getOrCreateFolio(checkOut.id).charges || []).reduce((s,c)=> s + (c.tax || 0),0),
                          discountAmount: 0,
                          totalAmount: checkOut.totalCharges || 0,
                          status: (checkOut.outstandingBalance || 0) === 0 ? 'paid' : 'pending',
                          dueDate: checkOut.checkOutDate,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                          notes: '',
                          items: [],
                          payments: [],
                          balance: checkOut.outstandingBalance || 0,
                        } as any;
                        // Reuse invoice print from payments page
                        try {
                          const settings = useSettingsStore.getState();
                          const data = {
                            org: { name: 'Hotel', address: '', phone: '', email: '' },
                            guest: { name: inv.guestName, roomNumber: inv.roomNumber, roomType: inv.roomType, arrivalDate: inv.checkInDate, departureDate: inv.checkOutDate, nights: inv.nights },
                            docNumber: inv.invoiceNumber,
                            docDate: inv.createdAt,
                            title: 'Invoice',
                            items: (frontOfficeStore.getOrCreateFolio(checkOut.id).charges || []).map(c => ({ description: c.description, amount: c.amount + (c.tax || 0), date: c.date })),
                            totals: { subTotal: inv.subtotal, taxes: { vat: undefined }, payments: (checkOut.totalPayments || 0), balance: inv.balance, grandTotal: inv.totalAmount },
                            footerNotes: ['Thank you for staying with us.'],
                            currency: '₵'
                          } as any;
                          openPrintPreview('invoice' as any, settings.printing.invoice || 'ghana-top-class-invoice', data);
                        } catch {}
                      }}
                      >
                        Print
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="solid"
                        className="bg-red-600 text-white font-semibold px-3 py-1"
                        onClick={() => openCheckOutModal(checkOut)}
                      >
                        Check Out
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end mt-3">
            <Pagination 
              page={page}
              total={Math.max(1, Math.ceil(filteredCheckOuts.length / rowsPerPage))}
              onChange={setPage}
              showControls
              size="sm"
            />
          </div>
        </div>

        <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-0">
              <div className="flex items-center gap-3 px-6 py-4 w-full">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🚪</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold">Process Check-out</h2>
                  <p className="text-emerald-100 text-sm truncate">
                    {selectedCheckOut?.guestName} • Room {selectedCheckOut?.roomNumber} • {selectedCheckOut?.nightsStayed} night{selectedCheckOut?.nightsStayed !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-emerald-200">Check-in</p>
                  <p className="text-sm font-semibold text-white">{selectedCheckOut ? new Date(selectedCheckOut.checkInDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }) : ''}</p>
                </div>
                <div className="text-emerald-300 text-lg mx-1">→</div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-emerald-200">Check-out</p>
                  <p className="text-sm font-semibold text-white">{selectedCheckOut ? new Date(selectedCheckOut.checkOutDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }) : ''}</p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody className="p-6">
              {selectedCheckOut && (() => {
                const settingsState = useSettingsStore.getState();
                const policy = settingsState.roomManagement?.payLaterPolicy || 'both';
                const res = frontOfficeStore.reservations.find(r => r.id === selectedCheckOut.id);
                const isCorporate = !!(res?.companyName || res?.billingPersonName);
                const payLaterAllowed = (policy === 'both') || (policy === 'corporate' && isCorporate) || (policy === 'individual' && !isCorporate);
                const folio = frontOfficeStore.getOrCreateFolio(selectedCheckOut.id);
                frontOfficeStore.updateFolioBalances(folio);
                const folioTotals = getFolioDisplayTotals(folio);
                const balance = selectedCheckOut.outstandingBalance; // true balance, can be negative
                const reservation = frontOfficeStore.reservations.find(r => r.id === selectedCheckOut.id);
                const guestProfile = reservation ? frontOfficeStore.guests.find(g => g.id === reservation.guestId) : null;
                const creditBalance = guestProfile?.creditBalance || 0;
                return (
                <div className="space-y-6">

                  {/* ── KPI Summary Cards ── */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardBody className="text-center p-4">
                        <div className="text-2xl font-bold text-blue-600">₵{folioTotals.roomChargesInclusive.toLocaleString()}</div>
                        <div className="text-sm text-blue-700 font-medium">Room Charges</div>
                        <div className="text-xs text-blue-500 mt-1">incl. tax</div>
                      </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                      <CardBody className="text-center p-4">
                        <div className="text-2xl font-bold text-orange-600">₵{folioTotals.serviceChargesInclusive.toLocaleString()}</div>
                        <div className="text-sm text-orange-700 font-medium">Service Charges</div>
                        <div className="text-xs text-orange-500 mt-1">incl. tax</div>
                      </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                      <CardBody className="text-center p-4">
                        <div className="text-2xl font-bold text-green-600">₵{folioTotals.totalPayments.toLocaleString()}</div>
                        <div className="text-sm text-green-700 font-medium">Payments</div>
                        <div className="text-xs text-green-500 mt-1">{folio.payments?.length || 0} transactions</div>
                      </CardBody>
                    </Card>
                    <Card className={`${balance > 0 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' : balance < 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}>
                      <CardBody className="text-center p-4">
                        <div className={`text-2xl font-bold ${balance > 0 ? 'text-red-600' : balance < 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                          ₵{Math.abs(balance).toLocaleString()}
                        </div>
                        <div className={`text-sm font-medium ${balance > 0 ? 'text-red-700' : balance < 0 ? 'text-emerald-700' : 'text-gray-600'}`}>
                          {balance > 0 ? 'Outstanding' : balance < 0 ? 'Credit / Overpaid' : 'Settled'}
                        </div>
                        <div className={`text-xs mt-1 ${balance > 0 ? 'text-red-500' : balance < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                          {balance > 0 ? 'Amount owed' : balance < 0 ? 'Refund owed' : 'Fully paid'}
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  {/* ── Charges & Payments Breakdown ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-0 shadow-lg">
                      <CardHeader className="bg-gray-50">
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                          <span className="text-blue-600">💰</span> Charges Breakdown
                        </h3>
                      </CardHeader>
                      <CardBody className="p-0">
                        <div className="space-y-1 p-4">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Room Charges</span>
                            <span className="font-semibold text-blue-600">₵{folioTotals.roomChargesInclusive.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Service Charges</span>
                            <span className="font-semibold text-orange-600">₵{folioTotals.serviceChargesInclusive.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Other Charges</span>
                            <span className="font-semibold text-purple-600">₵{folioTotals.otherCharges.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Taxes (VAT + NHIL + GETFund + Tourism)</span>
                            <span className="font-semibold text-red-600">₵{folioTotals.taxTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 bg-gray-50 rounded-lg px-3 mt-2">
                            <span className="font-bold text-gray-800 text-sm">Total Charges (Incl. Tax)</span>
                            <span className="font-bold text-base text-gray-800">₵{folioTotals.totalCharges.toFixed(2)}</span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card className="border-0 shadow-lg">
                      <CardHeader className="bg-gray-50">
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                          <span className="text-green-600">💳</span> Payment Summary
                        </h3>
                      </CardHeader>
                      <CardBody className="p-0">
                        <div className="space-y-1 p-4">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Total Payments</span>
                            <span className="font-semibold text-green-600">₵{folioTotals.totalPayments.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Payment Methods</span>
                            <span className="text-sm text-gray-500 text-right max-w-[180px] truncate">
                              {folio.payments?.filter(p => p.status === 'completed').map(p => p.method).join(', ') || 'None'}
                            </span>
                          </div>
                          {creditBalance > 0 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-sm text-gray-600">Available Credit</span>
                              <span className="font-semibold text-emerald-600">₵{creditBalance.toFixed(2)}</span>
                            </div>
                          )}
                          {selectedCheckOut.billingPerson && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-sm text-gray-600">Billed To</span>
                              <span className="text-sm text-gray-700 font-medium">{selectedCheckOut.billingPerson}</span>
                            </div>
                          )}
                          <div className={`flex justify-between items-center py-3 rounded-lg px-3 mt-2 ${balance > 0 ? 'bg-red-50' : balance < 0 ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                            <span className="font-bold text-gray-800 text-sm">{balance < 0 ? 'Credit Balance' : 'Current Balance'}</span>
                            <span className={`font-bold text-base ${balance > 0 ? 'text-red-600' : balance < 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                              {balance < 0 ? '-' : ''}₵{Math.abs(balance).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  {/* ── Folio Line Items (Accordion) ── */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="bg-gray-50">
                      <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-purple-600">📋</span> Folio Line Items
                      </h3>
                    </CardHeader>
                    <CardBody className="p-2">
                      <Accordion>
                        <AccordionItem key="charges" aria-label="Charges" title={`Charges (${folio.charges?.length || 0})`}>
                          <div className="max-h-52 overflow-y-auto">
                            {folio.charges?.length ? (
                              <Table aria-label="Folio charges" removeWrapper>
                                <TableHeader>
                                  <TableColumn>DATE</TableColumn>
                                  <TableColumn>DESCRIPTION</TableColumn>
                                  <TableColumn align="end">NET</TableColumn>
                                  <TableColumn align="end">TAX</TableColumn>
                                </TableHeader>
                                <TableBody>
                                  {folio.charges.map(c => (
                                    <TableRow key={c.id}>
                                      <TableCell className="text-xs text-gray-500">{new Date(c.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}</TableCell>
                                      <TableCell className="text-sm">{c.description}</TableCell>
                                      <TableCell className={`text-sm font-medium text-right ${c.amount < 0 ? 'text-emerald-600' : ''}`}>₵{c.amount.toFixed(2)}</TableCell>
                                      <TableCell className="text-sm text-right text-gray-500">₵{(c.tax || 0).toFixed(2)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : <p className="text-sm text-gray-500 py-3 text-center">No charges posted</p>}
                          </div>
                        </AccordionItem>
                        <AccordionItem key="payments" aria-label="Payments" title={`Payments (${folio.payments?.length || 0})`}>
                          <div className="max-h-52 overflow-y-auto">
                            {folio.payments?.length ? (
                              <Table aria-label="Folio payments" removeWrapper>
                                <TableHeader>
                                  <TableColumn>DATE</TableColumn>
                                  <TableColumn>METHOD</TableColumn>
                                  <TableColumn align="end">AMOUNT</TableColumn>
                                  <TableColumn>STATUS</TableColumn>
                                  <TableColumn>REF</TableColumn>
                                </TableHeader>
                                <TableBody>
                                  {folio.payments.map(p => (
                                    <TableRow key={p.id}>
                                      <TableCell className="text-xs text-gray-500">{new Date(p.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}</TableCell>
                                      <TableCell className="text-sm">
                                        {p.method}
                                        {p.creditApplied && p.creditApplied > 0 && <p className="text-xs text-emerald-600">Credit: ₵{p.creditApplied.toFixed(2)}</p>}
                                      </TableCell>
                                      <TableCell className={`text-sm font-medium text-right ${p.amount < 0 ? 'text-red-500' : 'text-green-600'}`}>₵{p.amount.toFixed(2)}</TableCell>
                                      <TableCell>
                                        <Badge color={p.status === 'completed' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'} variant="flat" size="sm">
                                          {p.status || 'completed'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell><span className="text-xs text-gray-400">{p.ref || '—'}</span></TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : <p className="text-sm text-gray-500 py-3 text-center">No payments received</p>}
                          </div>
                        </AccordionItem>
                      </Accordion>
                    </CardBody>
                  </Card>

                  {/* ── Settlement ── */}
                  {(() => {
                    const { outstandingBalance } = getFolioTotals(selectedCheckOut.id);
                    return (
                      <Card className="border-0 shadow-lg">
                        <CardHeader className="bg-gray-50">
                          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <span className="text-emerald-600">⚖️</span> Settlement
                            <span className={`ml-auto text-base font-bold ${outstandingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {outstandingBalance > 0 ? `₵${outstandingBalance.toFixed(2)} due` : 'Settled ✓'}
                            </span>
                          </h3>
                        </CardHeader>
                        <CardBody className="p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Select label="Payment Method" selectedKeys={[usePayLater ? 'Pay Later' : settlementMethod]} onSelectionChange={(keys) => {
                              const k = Array.from(keys)[0] as string;
                              if (k === 'Pay Later') { setUsePayLater(true); setSettlementAmount(0); setSettlementMethod('Credit'); }
                              else { setUsePayLater(false); setSettlementMethod(k as any); }
                            }}>
                              <SelectItem key="Pay Later">Pay Later</SelectItem>
                              <SelectItem key="Cash">Cash</SelectItem>
                              <SelectItem key="Card">Card</SelectItem>
                              <SelectItem key="Mobile Money">Mobile Money</SelectItem>
                              <SelectItem key="Bank Transfer">Bank Transfer</SelectItem>
                              <SelectItem key="Check">Check</SelectItem>
                              <SelectItem key="Corporate Account">Corporate Account</SelectItem>
                              <SelectItem key="Credit">Credit</SelectItem>
                            </Select>
                            <Input label="Amount (GHS)" type="number" value={String(usePayLater ? 0 : settlementAmount)} onChange={(e) => setSettlementAmount(parseFloat(e.target.value || '0'))} isDisabled={usePayLater} />
                            <Input label="Reference" value={settlementRef} onChange={(e) => setSettlementRef(e.target.value)} />
                          </div>
                          {usePayLater && <p className="text-xs text-gray-500">Pay Later selected. For corporate accounts enter PO / Cost Center in Reference.</p>}
                          {payLaterAllowed && (
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800">
                              ℹ️ Pay Later is enabled ({policy}). Corporate accounts require a PO/Project/Cost Center reference.
                            </div>
                          )}
                          <div className="flex items-end gap-3 pt-1">
                            <Select label="Receipt Template" className="flex-1" selectedKeys={[receiptTpl]} onSelectionChange={(keys) => setReceiptTpl(Array.from(keys)[0] as string)}>
                              {receiptTemplates.map(t => (<SelectItem key={t.key}>{t.name}</SelectItem>))}
                            </Select>
                            <Select label="Invoice Template" className="flex-1" selectedKeys={[invoiceTpl]} onSelectionChange={(keys) => setInvoiceTpl(Array.from(keys)[0] as string)}>
                              {invoiceTemplates.map(t => (<SelectItem key={t.key}>{t.name}</SelectItem>))}
                            </Select>
                            <Button variant="flat" onPress={() => handlePrintReceipt(selectedCheckOut)} className="mb-0.5">🧾 Receipt</Button>
                            <Button variant="flat" onPress={() => handlePrintInvoice(selectedCheckOut)} className="mb-0.5">🧾 Invoice</Button>
                            <Button color="success" className="bg-emerald-600 text-white mb-0.5"
                              isDisabled={outstandingBalance <= 0 || settlementAmount <= 0}
                              onPress={() => {
                                frontOfficeStore.addPayment(selectedCheckOut.id, settlementMethod, settlementAmount, { notes: 'Folio settlement during checkout', processedBy: 'Front Desk', ref: settlementRef });
                                try { handlePrintReceipt(selectedCheckOut); } catch {}
                                setTimeout(() => loadCheckOuts(), 50);
                              }}
                            >
                              💳 Process Payment
                            </Button>
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })()}

                  {/* ── Notes ── */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="bg-gray-50">
                      <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-gray-500">📝</span> Check-out Notes
                        {selectedCheckOut.specialRequests && <span className="ml-2 text-xs text-amber-600 font-normal">⚠️ Special requests on file</span>}
                      </h3>
                    </CardHeader>
                    <CardBody className="p-4 space-y-3">
                      {selectedCheckOut.specialRequests && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800">
                          <span className="font-medium">Special Requests: </span>{selectedCheckOut.specialRequests}
                        </div>
                      )}
                      <Textarea
                        placeholder="Add any notes about the guest's stay or checkout..."
                        value={checkoutNotes}
                        onChange={(e) => setCheckoutNotes(e.target.value)}
                        className="w-full"
                        rows={3}
                      />
                    </CardBody>
                  </Card>

                </div>
                );
              })()}
            </ModalBody>
            <ModalFooter className="bg-gray-50 border-t">
              <div className="flex justify-between items-center w-full">
                <div className="text-xs text-gray-400">Last updated: {new Date().toLocaleString()}</div>
                <div className="flex gap-2">
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
              {(() => {
                const reservation = selectedCheckOut ? frontOfficeStore.reservations.find(r => r.id === selectedCheckOut.id) : null;
                const guest = reservation ? frontOfficeStore.guests.find(g => g.id === reservation.guestId) : null;
                const creditBalance = guest?.creditBalance || 0;
                const canUseCredit = creditBalance > 0 && (selectedCheckOut?.outstandingBalance || 0) > 0;
                
                return canUseCredit ? (
                  <Button 
                    color="success" 
                    variant="flat"
                    onPress={() => {
                      if (selectedCheckOut) {
                        const amount = Math.min(creditBalance, selectedCheckOut.outstandingBalance);
                        frontOfficeStore.applyCreditPayment(selectedCheckOut.id, amount, 'Credit applied during checkout');
                        setTimeout(() => loadCheckOuts(), 100);
                      }
                    }}
                  >
                    Apply Credit (₵{Math.min(creditBalance, selectedCheckOut?.outstandingBalance || 0).toFixed(2)})
                  </Button>
                ) : null;
              })()}
              <Button
                color="primary"
                className="bg-emerald-600 text-white"
                onPress={() => selectedCheckOut && handleCheckOut(selectedCheckOut)}
                isLoading={isProcessing}
              >
                🚪 Process Check-out
              </Button>
                </div>
              </div>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Folio Management Modal removed - handled in Invoices & Payments page */}

        {/* Balance Warning Modal */}
        <Modal isOpen={isBalanceWarnOpen} onClose={onBalanceWarnClose} size="sm">
          <ModalContent>
            <ModalHeader className="bg-amber-50 border-b border-amber-200">
              <div className="flex items-center gap-2 text-amber-800">
                <span className="text-xl">⚠️</span> Outstanding Balance
              </div>
            </ModalHeader>
            <ModalBody className="py-4">
              <p className="text-gray-700">
                This guest has an outstanding balance of{' '}
                <span className="font-bold text-red-600">₵{balanceWarnAmount.toFixed(2)}</span>.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Do you want to proceed with checkout anyway and handle payment separately?
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onBalanceWarnClose}>Cancel — Settle First</Button>
              <Button color="warning" onPress={handleBalanceWarnConfirm} isLoading={isProcessing}>
                Proceed with Checkout
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
  );
}


