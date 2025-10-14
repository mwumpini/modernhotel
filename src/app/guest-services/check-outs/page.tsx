'use client';

/**
 * Guest Check-Out Management Page
 * (Restored as an embeddable component for consolidated tabs)
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Chip,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Textarea,
  Accordion,
  AccordionItem
} from "@heroui/react";
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { openPrintPreview } from '../../lib/print/engine';
import { listTemplates } from '../../lib/print/templates';
import { useSettingsStore } from '../../lib/settings/store';
import { trackEvent } from '../../lib/analytics/trackEvent';

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
  const [dateFilter, setDateFilter] = useState<{ from?: string; to?: string }>({});
  // remove duplicate page declaration if present
  const [rowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedCheckOut, setSelectedCheckOut] = useState<CheckOutData | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [quickSettlementMethod, setQuickSettlementMethod] = useState<'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'>('Cash');
  // Folio settlement state (within modal)
  const [settlementMethod, setSettlementMethod] = useState<'Cash'|'Card'|'Mobile Money'|'Corporate Account'|'Bank Transfer'|'Check'|'Credit'>('Cash');
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementRef, setSettlementRef] = useState<string>('');

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
  }, [checkOuts, searchTerm, statusFilter, balanceFilter, billingFilter, sourceFilter, dateFilter.from, dateFilter.to]);

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
    const serviceKeywords = ['service', 'swimming', 'laundry', 'pool', 'spa', 'gym', 'restaurant', 'bar', 'room service', 'minibar', 'parking', 'wifi', 'internet', 'breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'drink', 'food', 'meal'];
    const serviceCharges = folio.charges?.filter(c => serviceKeywords.some(k => (c.description || '').toLowerCase().includes(k)))
      .reduce((s, c) => s + (c.amount || 0), 0) || 0;
    const otherCharges = folio.charges?.filter(c => !serviceKeywords.some(k => (c.description || '').toLowerCase().includes(k)))
      .reduce((s, c) => s + (c.amount || 0), 0) || 0;
    const taxTotal = folio.charges?.reduce((s, c) => s + (c.tax || 0), 0) || 0;
    const totalCharges = (folio.charges || []).reduce((s, c) => s + (c.amount || 0) + (c.tax || 0), 0);
    const totalPayments = (folio.payments || []).filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
    const outstandingBalance = Math.max(0, totalCharges - totalPayments);
    return { totalCharges, totalPayments, outstandingBalance, serviceCharges, otherCharges, taxTotal };
  };

  const loadCheckOuts = () => {
    const reservations = frontOfficeStore.reservations;
    const today = new Date();
    
    const checkOutsData: CheckOutData[] = reservations
      .filter(reservation => 
        reservation.status === 'checked-in' &&
        new Date(reservation.departure) <= today
      )
      .map(reservation => {
        const checkInDate = new Date(reservation.arrival);
        const checkOutDate = new Date(reservation.departure);
        const nightsStayed = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        const folioTotals = getFolioTotals(reservation.id);
        const roomType = frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId);
        const roomRate = reservation.rateBreakdown?.[0]?.base || roomType?.baseRate || 0;
        const roomTotal = roomRate * nightsStayed;
        
        const status: 'pending' | 'processing' | 'completed' | 'extended' =
          reservation.status === 'checked-out'
            ? 'completed'
            : (folioTotals.outstandingBalance || 0) > 0
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
          checkoutDateTime: undefined,
          status,
          nightsStayed,
          totalCharges: folioTotals.totalCharges,
          totalPayments: folioTotals.totalPayments,
          outstandingBalance: folioTotals.outstandingBalance,
          serviceCharges: folioTotals.serviceCharges,
          otherCharges: folioTotals.otherCharges,
          taxTotal: folioTotals.taxTotal,
          roomTotal,
          discount: 0,
          finalPaymentMethod: reservation.paymentMethod || 'Not specified',
          confirmationNumber: undefined,
          roomStatus: 'Occupied',
          phone: reservation.guestPhone,
          email: reservation.guestEmail,
          specialRequests: reservation.remarksToGuest,
          billingPerson: reservation.billingPersonName,
          lateCheckout: false,
          housekeepingStatus: 'pending',
          source: reservation.source || 'Front Office',
          staffId: 'pending',
          staffUsername: 'Pending',
          adults: reservation.adults || 1,
          children: reservation.children || 0,
          checkoutNotes: undefined,
          createdAt: reservation.createdAt || new Date().toISOString(),
          updatedAt: reservation.updatedAt || new Date().toISOString(),
          processedAt: undefined
        };
      });

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

    if (dateFilter.from) {
      filtered = filtered.filter(c => new Date(c.checkOutDate) >= new Date(dateFilter.from!));
    }
    if (dateFilter.to) {
      filtered = filtered.filter(c => new Date(c.checkOutDate) <= new Date(dateFilter.to!));
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
      // Prevent checkout if there is an outstanding balance
      const { outstandingBalance } = getFolioTotals(checkOut.id);
      if (outstandingBalance > 0) {
        const ok = confirm(`Outstanding balance ₵${outstandingBalance.toFixed(2)}. Settle before checkout?`);
        if (!ok) { setIsProcessing(false); return; }
        return; // user will settle via quick settlement UI
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

  const getCheckoutStats = () => {
    const totalPending = checkOuts.filter(c => c.status === 'pending').length;
    const totalCompleted = checkOuts.filter(c => c.status === 'completed').length;
    const totalExtended = checkOuts.filter(c => c.status === 'extended').length;
    const totalRevenue = checkOuts.reduce((sum, checkOut) => sum + checkOut.totalCharges, 0);
    
    return { totalPending, totalCompleted, totalExtended, totalRevenue };
  };

  const checkoutStats = getCheckoutStats();

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' });
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
    // Ghana tax split approximation using stored local rates
    const vatRate = Number((typeof localStorage !== 'undefined' && localStorage.getItem('tax.vat')) || '12.5');
    const nhilRate = Number((typeof localStorage !== 'undefined' && localStorage.getItem('tax.nhil')) || '2.5');
    const levyRate = Number((typeof localStorage !== 'undefined' && localStorage.getItem('tax.tourism')) || '1.0');
    const totalRate = vatRate + nhilRate + levyRate;
    const taxes = totalRate > 0 ? {
      vat: baseSum * (vatRate / 100),
      nhil: baseSum * (nhilRate / 100),
      levy: baseSum * (levyRate / 100)
    } : { vat: 0, nhil: 0, levy: 0 };
    const payments = (folio.payments || []).filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
    const subTotal = baseSum;
    const grandTotal = baseSum + taxSum;
    const balance = Math.max(0, grandTotal - payments);
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
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
                <div className="flex gap-2">
                  <Input type="date" labelPlacement="outside" placeholder="From" value={dateFilter.from || ''} onChange={(e)=> setDateFilter(prev=>({ ...prev, from: e.target.value }))} />
                  <Input type="date" labelPlacement="outside" placeholder="To" value={dateFilter.to || ''} onChange={(e)=> setDateFilter(prev=>({ ...prev, to: e.target.value }))} />
                </div>
              </div>
            </CardBody>
          </Card>

          <Table aria-label="Check-outs table" className="min-w-full">
            <TableHeader>
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
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar 
                        name={checkOut.guestName} 
                        size="sm" 
                        className="bg-ghana-gold text-white font-semibold"
                        showFallback
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate">{checkOut.guestName}</p>
                        <p className="text-xs text-gray-600">{(checkOut as any).guestPhone || 'N/A'}</p>
                        <p className="text-xs text-gray-500">ID: {checkOut.id.slice(-6)}</p>
                        {(checkOut as any).guestEmail && (
                          <p className="text-xs text-blue-600 truncate">{(checkOut as any).guestEmail}</p>
                        )}
                      </div>
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
                  <TableCell className="text-center font-semibold">₵{checkOut.roomRate.toLocaleString()}</TableCell>
                  <TableCell className="text-center font-semibold text-purple-600">₵{(checkOut.roomTotal || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-center font-semibold text-orange-600">₵{(checkOut.serviceCharges || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-center font-semibold text-blue-600">₵{(checkOut.totalCharges || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-center text-green-600 font-semibold">₵{(checkOut.totalPayments || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-semibold ${(checkOut.outstandingBalance || 0) > 0 ? 'text-red-600' : (checkOut.outstandingBalance || 0) < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      ₵{(checkOut.outstandingBalance || 0).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge color={getStatusColor(checkOut.status)} variant="flat" className="font-medium">
                        {getStatusText(checkOut.status)}
                      </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button size="sm" variant="light" onClick={() => openCheckOutModal(checkOut)}>View</Button>
                      {(checkOut.outstandingBalance || 0) > 0 && (
                        <Button size="sm" color="success" variant="flat" onClick={() => handleManageFolio(checkOut)}>Add Payment</Button>
                      )}
                      <Button size="sm" variant="light" onClick={() => {
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
                      }}>Print</Button>
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

        <Modal isOpen={isOpen} onClose={onClose} size="2xl">
          <ModalContent>
            <ModalHeader>Process Check-out</ModalHeader>
            <ModalBody>
              {selectedCheckOut && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                      <p className="text-lg font-semibold">{selectedCheckOut.guestName}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                      <p className="text-lg font-semibold">{selectedCheckOut.roomNumber}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                      <p className="text-lg">{new Date(selectedCheckOut.checkInDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date</label>
                      <p className="text-lg">{new Date(selectedCheckOut.checkOutDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nights Stayed</label>
                      <p className="text-lg">{selectedCheckOut.nightsStayed}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Charges</label>
                      <p className="text-lg font-semibold text-green-600">₵{selectedCheckOut.totalCharges.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Payments</label>
                      <p className="text-lg font-semibold text-blue-600">₵{selectedCheckOut.totalPayments.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Outstanding Balance</label>
                      <p className="text-lg font-semibold text-red-600">₵{selectedCheckOut.outstandingBalance.toLocaleString()}</p>
                    </div>
                    {(() => {
                      const reservation = frontOfficeStore.reservations.find(r => r.id === selectedCheckOut.id);
                      const guest = reservation ? frontOfficeStore.guests.find(g => g.id === reservation.guestId) : null;
                      const creditBalance = guest?.creditBalance || 0;
                      return creditBalance > 0 ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Available Credit</label>
                          <p className="text-lg font-semibold text-green-600">₵{creditBalance.toLocaleString()}</p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  
                  {selectedCheckOut.specialRequests && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
                      <p className="text-gray-600">{selectedCheckOut.specialRequests}</p>
                    </div>
                  )}
                  
                  {selectedCheckOut.billingPerson && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Billing Person</label>
                      <p className="text-gray-600">{selectedCheckOut.billingPerson}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Notes</label>
                    <Textarea
                      placeholder="Add any notes about the guest's stay or checkout..."
                      value={checkoutNotes}
                      onChange={(e) => setCheckoutNotes(e.target.value)}
                      className="w-full"
                      rows={3}
                    />
                  </div>

                  {/* Folio Details */}
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Folio</h4>
                    <Accordion>
                      <AccordionItem key="charges" aria-label="Charges" title="View Folio Charges">
                        <div className="space-y-2">
                          {(() => {
                            const folio = frontOfficeStore.getOrCreateFolio(selectedCheckOut.id);
                            if (!folio.charges.length) {
                              return <p className="text-sm text-gray-500">No charges posted.</p>;
                            }
                            return (
                              <Table aria-label="Folio charges">
                                <TableHeader>
                                  <TableColumn>DATE</TableColumn>
                                  <TableColumn>DESCRIPTION</TableColumn>
                                  <TableColumn align="end">AMOUNT</TableColumn>
                                  <TableColumn align="end">TAX</TableColumn>
                                </TableHeader>
                                <TableBody>
                                  {folio.charges.map(c => (
                                    <TableRow key={c.id}>
                                      <TableCell>{new Date(c.date).toLocaleDateString()}</TableCell>
                                      <TableCell>{c.description}</TableCell>
                                      <TableCell>₵{c.amount.toFixed(2)}</TableCell>
                                      <TableCell>₵{(c.tax || 0).toFixed(2)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            );
                          })()}
                        </div>
                      </AccordionItem>
                      <AccordionItem key="payments" aria-label="Payments" title="View Payments">
                        <div className="space-y-2">
                          {(() => {
                            const folio = frontOfficeStore.getOrCreateFolio(selectedCheckOut.id);
                            if (!folio.payments.length) {
                              return <p className="text-sm text-gray-500">No payments received.</p>;
                            }
                            return (
                              <Table aria-label="Folio payments">
                                <TableHeader>
                                  <TableColumn>DATE</TableColumn>
                                  <TableColumn>METHOD</TableColumn>
                                  <TableColumn align="end">AMOUNT</TableColumn>
                                  <TableColumn>STATUS</TableColumn>
                                  <TableColumn>REFERENCE</TableColumn>
                                </TableHeader>
                                <TableBody>
                                  {folio.payments.map(p => (
                                    <TableRow key={p.id}>
                                      <TableCell>{new Date(p.date).toLocaleDateString()}</TableCell>
                                      <TableCell>
                                        <div>
                                          <span>{p.method}</span>
                                          {p.creditApplied && p.creditApplied > 0 && (
                                            <p className="text-xs text-green-600">Credit: ₵{p.creditApplied.toFixed(2)}</p>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>₵{p.amount.toFixed(2)}</TableCell>
                                      <TableCell>
                                        <Badge 
                                          color={p.status === 'completed' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'} 
                                          variant="flat" 
                                          size="sm"
                                        >
                                          {p.status || 'completed'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-xs text-gray-500">{p.ref || p.id}</span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            );
                          })()}
                        </div>
                      </AccordionItem>
                    </Accordion>
                    {/* Settlement within Folio */}
                    {(() => {
                      const { outstandingBalance } = getFolioTotals(selectedCheckOut.id);
                      return (
                        <div className="mt-4 border rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-sm text-gray-700">Outstanding Balance</div>
                            <div className={`font-bold ${outstandingBalance > 0 ? 'text-red-600' : 'text-gray-600'}`}>₵{outstandingBalance.toLocaleString()}</div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Select label="Payment Method" selectedKeys={[settlementMethod]} onSelectionChange={(keys)=> setSettlementMethod(Array.from(keys)[0] as any)}>
                              <SelectItem key="Cash">Cash</SelectItem>
                              <SelectItem key="Card">Card</SelectItem>
                              <SelectItem key="Mobile Money">Mobile Money</SelectItem>
                              <SelectItem key="Bank Transfer">Bank Transfer</SelectItem>
                              <SelectItem key="Check">Check</SelectItem>
                              <SelectItem key="Corporate Account">Corporate Account</SelectItem>
                              <SelectItem key="Credit">Credit</SelectItem>
                            </Select>
                            <Input label="Amount (GHS)" type="number" value={String(settlementAmount)} onChange={(e)=> setSettlementAmount(parseFloat(e.target.value || '0'))} />
                            <Input label="Reference" value={settlementRef} onChange={(e)=> setSettlementRef(e.target.value)} />
                          </div>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                            <div>
                              <Select label="Receipt Template" selectedKeys={[receiptTpl]} onSelectionChange={(keys)=> setReceiptTpl(Array.from(keys)[0] as string)}>
                                {receiptTemplates.map(t => (<SelectItem key={t.key}>{t.name}</SelectItem>))}
                              </Select>
                            </div>
                            <div>
                              <Select label="Invoice Template" selectedKeys={[invoiceTpl]} onSelectionChange={(keys)=> setInvoiceTpl(Array.from(keys)[0] as string)}>
                                {invoiceTemplates.map(t => (<SelectItem key={t.key}>{t.name}</SelectItem>))}
                              </Select>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button variant="light" onPress={()=> handlePrintReceipt(selectedCheckOut)}>Print Receipt</Button>
                              <Button variant="light" onPress={()=> handlePrintInvoice(selectedCheckOut)}>Print Invoice</Button>
                            </div>
                          </div>
                            <Button color="success" className="bg-green-600 text-white"
                              isDisabled={outstandingBalance <= 0 || settlementAmount <= 0}
                              onPress={() => {
                                frontOfficeStore.addPayment(selectedCheckOut.id, settlementMethod, settlementAmount, { notes: 'Folio settlement during checkout', processedBy: 'Front Desk', ref: settlementRef });
                                setTimeout(() => loadCheckOuts(), 50);
                              }}
                            >
                              Settle Balance
                            </Button>
                          </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
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
                onPress={() => selectedCheckOut && handleCheckOut(selectedCheckOut)}
                isLoading={isProcessing}
              >
                Process Check-out
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Folio Management Modal removed - handled in Invoices & Payments page */}
      </div>
  );
}


