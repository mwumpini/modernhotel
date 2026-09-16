"use client";

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import PageLayout from '../../components/PageLayout';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Tabs,
  Tab,
  Pagination
} from "@heroui/react";
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import FrontOfficeBackButton from '../../components/FrontOfficeBackButton';

// Lazy sections to keep the page responsive
const CheckOutsPage = dynamic(() => import('../check-outs/page'), { ssr: false });
const InvoicesPaymentsPage = dynamic(() => import('../client-services/invoices-payments/page'), { ssr: false });
const ServiceChargesPage = dynamic(() => import('../service-charges/page'), { ssr: false });
const ReservationsBookingsManager = dynamic(() => import('../../components/ReservationsBookingsManager'), { ssr: false });

// --- Check-ins section (existing logic) ---
import {
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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea
} from "@heroui/react";
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { resolveGuestAddress } from '../../lib/frontoffice/helpers/guests';
import { getFolioDisplayTotals } from '../../lib/frontoffice/helpers/folio';
import { calculateStayNights } from '../../lib/frontoffice/helpers/rates';
import { postRoomChargeForDate, isRoomLine } from '../../lib/frontoffice/roomCharges';
import { trackEvent } from '../../lib/analytics/trackEvent';
import type { Reservation } from '../../lib/frontoffice/types';
import { formatMoney } from '../../lib/format/currency';
import { useSettingsStore } from '../../lib/settings/store';
import { useCurrentUserName } from '../../lib/auth/useCurrentUserName';
import { openPrintPreview } from '../../lib/print/engine';
import { buildOrgProfile } from '../../lib/print/buildOrgProfile';

interface CheckInGuest {
  id: string;
  guestProfileId?: string;
  guestName: string;
  roomNumber: string;
  roomType: string;
  roomRate: number;
  checkInDate: string;
  checkInDateTime: string;
  checkOutDate: string;
  status: 'checked-in' | 'extended' | 'early-checkout';
  nightsStayed: number;
  phone?: string;
  email?: string;
  specialRequests?: string;
  billingPerson?: string;
  lastActivity?: string;
  source: string;
  staffId?: string;
  adults: number;
  children: number;
  paymentMethod?: string;
  creditBalance?: number;
  // Folio data
  bookedNights?: number;
  roomTotal?: number;
  totalCharges?: number;
  totalPayments?: number;
  balance?: number;
  serviceCharges?: number;
  otherCharges?: number;
  taxTotal?: number;
  taxExempt?: boolean;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function CheckInsSection() {
  const currentUserName = useCurrentUserName();
  const [guests, setGuests] = useState<CheckInGuest[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<CheckInGuest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [selectedGuest, setSelectedGuest] = useState<CheckInGuest | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isFolioModalOpen, setIsFolioModalOpen] = useState(false);
  const [selectedFolioGuest, setSelectedFolioGuest] = useState<CheckInGuest | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'cash',
    reference: '',
    notes: '',
    type: 'deposit' // 'deposit', 'payment', 'prepayment'
  });
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'specific' | 'range'>('today');
  const [dateFilterSingle, setDateFilterSingle] = useState('');
  const [dateFilterFrom, setDateFilterFrom] = useState('');
  const [dateFilterTo, setDateFilterTo] = useState('');
  const [noShowTarget, setNoShowTarget] = useState<Reservation | null>(null);
  const { isOpen: isNoShowOpen, onOpen: onNoShowOpen, onClose: onNoShowClose } = useDisclosure();
  const [inlineNotification, setInlineNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showNotification = (type: 'success' | 'error', message: string) => {
    setInlineNotification({ type, message });
    setTimeout(() => setInlineNotification(null), 4000);
  };

  // Load guests function
  const loadGuests = () => {
    const reservations = frontOfficeStore.reservations;
    const today = new Date();
    const data: CheckInGuest[] = reservations
      .filter(r => r.status === 'checked-in' && new Date(r.departure) >= today && r.roomId && r.roomId !== 'TBD')
      .map(reservation => {
        const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
        const creditBalance = guest?.creditBalance || 0;
        const nightsStayed = Math.max(0, Math.ceil((today.getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24)));
        const roomType = frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId);
        frontOfficeStore.ensureReservationRates(reservation);
        frontOfficeStore.ensureFolioRoomCharges(reservation.id);
        const quote = frontOfficeStore.getReservationQuote(reservation);
        // Table: tax-inclusive for quick guest-facing quotes; folio modal keeps net + tax breakdown.
        const roomRate = quote.nightlyGross;
        const folio = frontOfficeStore.getOrCreateFolio(reservation.id);
        frontOfficeStore.updateFolioBalances(folio);
        const totals = getFolioDisplayTotals(folio);
        const bookedNights = calculateStayNights(reservation.arrival, reservation.departure) || 1;
        const roomTotal = totals.roomChargesInclusive || quote.grandTotal;
        
        return {
        id: reservation.id,
          guestProfileId: reservation.guestId,
        guestName: reservation.guestName,
        roomNumber: reservation.roomId || 'TBD',
        roomType: roomType?.name || 'Standard',
          roomRate: roomRate,
          checkInDate: reservation.arrival,
          checkInDateTime: reservation.arrival,
          checkOutDate: reservation.departure,
          status: 'checked-in',
          nightsStayed,
        phone: reservation.guestPhone,
        email: reservation.guestEmail,
          specialRequests: reservation.remarksToGuest,
          billingPerson: reservation.billingPersonName,
          lastActivity: 'Check-in',
          source: reservation.source || 'Direct',
          staffId: 'Front Desk',
          adults: reservation.adults || 1,
          children: reservation.children || 0,
          paymentMethod: reservation.paymentMethod,
          creditBalance,
          bookedNights,
          totalCharges: totals.totalCharges,      // gross incl. tax
          totalPayments: totals.totalPayments,
          balance: totals.balance,               // true Amount−Payments; negative = credit
          serviceCharges: totals.serviceChargesInclusive, // gross incl. tax
          otherCharges: totals.otherCharges,
          taxTotal: totals.taxTotal,
          roomTotal,                              // gross incl. tax
          taxExempt: reservation.taxExempt,
        } as CheckInGuest;
      });
    setGuests(data);
    setFilteredGuests(data);
  };

  useEffect(() => {
    loadGuests();
    const unsub = frontOfficeStore.subscribe(loadGuests);
    return () => unsub();
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let filtered = guests;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.guestName.toLowerCase().includes(term) ||
        g.roomNumber.toLowerCase().includes(term) ||
        g.phone?.includes(searchTerm) ||
        g.email?.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') filtered = filtered.filter(g => g.status === statusFilter);
    // Date filter on check-in (arrival) date
    if (dateFilterMode === 'today') {
      filtered = filtered.filter(g => g.checkInDate?.slice(0, 10) === today);
    } else if (dateFilterMode === 'specific' && dateFilterSingle) {
      filtered = filtered.filter(g => g.checkInDate?.slice(0, 10) === dateFilterSingle);
    } else if (dateFilterMode === 'range') {
      filtered = filtered.filter(g => {
        const d = g.checkInDate?.slice(0, 10) ?? '';
        if (dateFilterFrom && d < dateFilterFrom) return false;
        if (dateFilterTo   && d > dateFilterTo)   return false;
        return true;
      });
    }
    setFilteredGuests(filtered);
    setPage(1);
  }, [guests, searchTerm, statusFilter, dateFilterMode, dateFilterSingle, dateFilterFrom, dateFilterTo]);

  // All KPI totals track filteredGuests so cards match the table rows
  const totalRoomRevenue    = useMemo(() => filteredGuests.reduce((s,g) => s + (g.roomRate || 0), 0), [filteredGuests]);
  const totalRoomAmount     = useMemo(() => filteredGuests.reduce((s,g) => s + (g.roomTotal || 0), 0), [filteredGuests]);
  const totalServiceCharges = useMemo(() => filteredGuests.reduce((s,g) => s + (g.serviceCharges || 0), 0), [filteredGuests]);
  const totalCharges        = useMemo(() => filteredGuests.reduce((s,g) => s + (g.totalCharges || 0), 0), [filteredGuests]);
  const totalPayments       = useMemo(() => filteredGuests.reduce((s,g) => s + (g.totalPayments || 0), 0), [filteredGuests]);
  const totalOutstanding    = useMemo(() => filteredGuests.reduce((s,g) => s + (g.balance || 0), 0), [filteredGuests]);
  const avgNights           = useMemo(() => filteredGuests.length ? (filteredGuests.reduce((s,g)=>s+(g.bookedNights ?? g.nightsStayed),0)/filteredGuests.length).toFixed(1) : '0.0', [filteredGuests]);

  const handleEarlyCheckout = async (guest: CheckInGuest) => {
    setIsProcessing(true);
    try {
      frontOfficeStore.processCheckout(guest.id, 'Early checkout from unified Check-Ins');
      trackEvent('FO.Reservation.CheckedOut', { reservationId: guest.id, guestName: guest.guestName, roomNumber: guest.roomNumber, source: 'check-ins' });
      onClose();
      setSelectedGuest(null);
      // Tab switch handled by user; Check-outs list will auto-refresh via store subscription
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtendStay = async (guest: CheckInGuest, nights: number) => {
    const oldDeparture = guest.checkOutDate.slice(0, 10);
    const result = frontOfficeStore.extendStay(guest.id, nights);
    if (!result) {
      showNotification('error', 'Could not update stay — reservation not found');
      return;
    }

    const newDeparture = result.departure.slice(0, 10);

    if (nights > 0) {
      // Post room charge(s) for the newly added night(s) immediately so the folio is up to date
      for (let i = 0; i < nights; i++) {
        const d = new Date(oldDeparture);
        d.setDate(d.getDate() + i);
        postRoomChargeForDate(frontOfficeStore as any, guest.id, d.toISOString().slice(0, 10));
      }
    } else if (nights < 0) {
      // Void any room charge(s) that were already posted for the now-removed night(s)
      const folio = frontOfficeStore.getOrCreateFolio(guest.id);
      const toVoid = (folio.charges || []).filter((c: any) => {
        if (!isRoomLine(c.description)) return false;
        const chargeDate = (c.date || '').slice(0, 10);
        // The removed nights are between newDeparture (inclusive) and oldDeparture (exclusive)
        return chargeDate >= newDeparture && chargeDate < oldDeparture;
      });
      for (const charge of toVoid) {
        frontOfficeStore.voidCharge(guest.id, (charge as any).id, `Stay shortened — night of ${(charge as any).date?.slice(0, 10)} removed`);
      }
    }

    trackEvent('FO.Reservation.Updated', {
      reservationId: guest.id,
      guestName: guest.guestName,
      additionalNights: nights,
      oldDeparture,
      newDeparture,
      source: 'check-ins'
    });

    loadGuests();
    onClose();
    setSelectedGuest(null);

    const bookedNights = calculateStayNights(result.arrival, result.departure);
    const formattedDate = new Date(newDeparture).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
    showNotification(
      'success',
      nights > 0
        ? `✅ Stay extended for ${guest.guestName} — checkout now ${formattedDate} (${bookedNights} nights)`
        : `✅ Stay shortened for ${guest.guestName} — checkout now ${formattedDate} (${bookedNights} nights)`
    );
  };

  const handleApplyCredit = (guest: CheckInGuest) => {
    if (!guest.creditBalance || guest.creditBalance <= 0) return;
    const amount = guest.creditBalance; // Simplified - apply full credit balance
    const ok = frontOfficeStore.applyCreditPayment(guest.id, amount, 'Credit applied from unified Check-Ins', currentUserName);
    if (ok) {
      loadGuests();
      showNotification('success', `Credit of ₵${amount.toLocaleString()} applied to ${guest.guestName}'s account`);
    } else {
      showNotification('error', 'Failed to apply credit. Please try again.');
    }
  };

  const handleViewFolio = (guest: CheckInGuest) => {
    setSelectedFolioGuest(guest);
    setIsFolioModalOpen(true);
  };

  // Registration Card — printed at check-in, before anything's been charged:
  // guest/stay details + signature, no line items or totals (see
  // registrationCardBlocks in lib/print/blockDefaults.ts).
  const handlePrintRegistrationCard = (guest: CheckInGuest) => {
    const settingsState = useSettingsStore.getState();
    const address = resolveGuestAddress(frontOfficeStore.guests, guest.guestProfileId);
    const resId = frontOfficeStore.reservations.find(r => r.id === guest.id)?.resId || guest.id;
    const data = {
      org: buildOrgProfile(settingsState),
      guest: {
        name: guest.guestName,
        company: guest.billingPerson || undefined,
        address,
        roomNumber: guest.roomNumber,
        roomType: guest.roomType,
        roomRate: guest.roomRate,
        arrivalDate: guest.checkInDate,
        departureDate: guest.checkOutDate,
        nights: guest.bookedNights ?? guest.nightsStayed,
      },
      docNumber: resId,
      docDate: new Date().toISOString(),
      title: 'Registration Card',
      items: [],
      totals: { subTotal: 0 },
      footerNotes: guest.specialRequests ? [`Remarks: ${guest.specialRequests}`] : undefined,
      currency: '₵',
    } as any;
    trackEvent('RegistrationCard.Printed', { reservationId: guest.id, guestName: guest.guestName }, { sourceModule: 'CheckIns' });
    openPrintPreview('registration-card' as any, settingsState.printing['registration-card'] || 'builtin-registration-card-standard', data);
  };

  const handlePaymentClick = (guest: CheckInGuest, paymentType: 'deposit' | 'payment' | 'prepayment' = 'payment') => {
    setSelectedFolioGuest(guest);
    setPaymentData({
      amount: paymentType === 'deposit' ? (guest.roomRate || 0) * 0.5 : (guest.balance || 0), // 50% deposit or full balance
      paymentMethod: 'cash',
      reference: '',
      notes: '',
      type: paymentType
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolioGuest || paymentData.amount <= 0) return;

    try {
      setIsProcessing(true);
      
      // Use the store's addPayment method
      const paymentMethodMap: Record<string, 'Cash' | 'Card' | 'Mobile Money' | 'Bank Transfer' | 'Check' | 'Corporate Account'> = {
        cash: 'Cash',
        card: 'Card',
        'mobile money': 'Mobile Money',
        'bank transfer': 'Bank Transfer',
        check: 'Check',
        'corporate account': 'Corporate Account',
      };
      const method = paymentMethodMap[paymentData.paymentMethod.toLowerCase()] || 'Cash';
      frontOfficeStore.addPayment(
        selectedFolioGuest.id,
        method,
        paymentData.amount,
        {
          notes: `${paymentData.type === 'deposit' ? 'Deposit' : paymentData.type === 'prepayment' ? 'Prepayment' : 'Payment'} - ${paymentData.notes || 'Guest payment'}`,
          processedBy: currentUserName,
          ref: paymentData.reference || undefined
        }
      );

      // Track event
      trackEvent('FO.Payment.Processed' as any, {
        reservationId: selectedFolioGuest.id,
        guestName: selectedFolioGuest.guestName,
        amount: paymentData.amount,
        method: paymentData.paymentMethod,
        type: paymentData.type
      }, { sourceModule: 'Check-Ins' });

      // Reset and close
      setPaymentData({ amount: 0, paymentMethod: 'cash', reference: '', notes: '', type: 'deposit' });
      setIsPaymentModalOpen(false);

      // Refresh data
      loadGuests();
      
      showNotification('success', `Payment of ₵${paymentData.amount.toLocaleString()} processed successfully!`);

    } catch (error) {
      console.error('Payment processing error:', error);
      showNotification('error', 'Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openNoShowConfirm = (reservation: Reservation) => {
    setNoShowTarget(reservation);
    onNoShowOpen();
  };

  const confirmNoShow = () => {
    if (!noShowTarget) return;
    frontOfficeStore.markNoShow(noShowTarget.id);
    trackEvent('FO.Reservation.NoShowManual' as any, { reservationId: noShowTarget.id, guestName: noShowTarget.guestName });
    onNoShowClose();
    setNoShowTarget(null);
    loadGuests();
  };

  return (
    <div className="space-y-6">
      {inlineNotification && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${inlineNotification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {inlineNotification.type === 'success' ? '✅' : '❌'} {inlineNotification.message}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Guests</p><p className="text-2xl font-bold text-ghana-black">{filteredGuests.length}</p></div><div className="text-2xl">👥</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Avg Rate/Night</p><p className="text-2xl font-bold text-ghana-black">₵{filteredGuests.length > 0 ? formatMoney(totalRoomRevenue / filteredGuests.length) : '0.00'}</p></div><div className="text-2xl">💰</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Room Total</p><p className="text-2xl font-bold text-purple-600">₵{totalRoomAmount.toLocaleString()}</p></div><div className="text-2xl">🏨</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Service Charges</p><p className="text-2xl font-bold text-orange-600">₵{totalServiceCharges.toLocaleString()}</p></div><div className="text-2xl">🏊</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Amount</p><p className="text-2xl font-bold text-blue-600">₵{totalCharges.toLocaleString()}</p></div><div className="text-2xl">📊</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Payments</p><p className="text-2xl font-bold text-green-600">₵{totalPayments.toLocaleString()}</p></div><div className="text-2xl">💳</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Net Balance</p><p className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-red-600' : totalOutstanding < 0 ? 'text-green-600' : 'text-gray-500'}`}>₵{totalOutstanding.toLocaleString()}</p></div><div className="text-2xl">⚖️</div></div></CardBody></Card>
        </div>

      <Card className="mb-2"><CardBody className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-4">
          <Input placeholder="Search by guest name, room number, phone, or email..." onChange={(e) => setSearchTerm(e.target.value)} className="flex-1" startContent={<span className="text-gray-400">🔍</span>} />
          <Select placeholder="Filter by status" onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-48">
            <SelectItem key="all">All Statuses</SelectItem>
            <SelectItem key="checked-in">Checked In</SelectItem>
            <SelectItem key="extended">Extended</SelectItem>
            <SelectItem key="early-checkout">Early Checkout</SelectItem>
          </Select>
          <Button color="primary" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white" onPress={() => setTransferModalOpen(true)}>🔄 Room Transfer</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-500 mr-1">📅 Check-in Date:</span>
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
      </CardBody></Card>

      <Card><CardBody>
        <Tabs selectedKey={activeTab} onSelectionChange={(k)=>setActiveTab(k as string)} className="mb-4"><Tab key="overview" title="📊 Overview" /><Tab key="analytics" title="📈 Analytics" /></Tabs>

        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Table aria-label="In-house guests table" className="min-w-full">
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
              {filteredGuests
                .sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime())
                .slice((page - 1) * rowsPerPage, page * rowsPerPage)
                .map((guest) => (
              <TableRow key={guest.id} className="hover:bg-gray-50">
                            <TableCell className="font-semibold">{guest.id}</TableCell>
                            <TableCell>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{guest.guestName}</p>
                    </div>
                            </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {(() => {
                        const res = frontOfficeStore.reservations.find(r => r.id === guest.id);
                        const billed = res?.companyName || res?.billingPersonName || 'Self';
                        return <span className="font-medium">{billed}</span>;
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-center">{guest.roomNumber}</TableCell>
                  <TableCell className="text-center">{guest.roomType}</TableCell>
                  <TableCell className="text-center">{guest.adults}</TableCell>
                  <TableCell className="text-center">{guest.children}</TableCell>
                  <TableCell className="text-center">{formatDate(guest.checkInDate)}<br/><span className="text-xs text-gray-500">{formatTime(guest.checkInDateTime)}</span></TableCell>
                  <TableCell className="text-center">{formatDate(guest.checkOutDate)}</TableCell>
                  <TableCell className="text-center">{guest.bookedNights ?? guest.nightsStayed}</TableCell>
                  <TableCell className="text-center font-semibold">₵{formatMoney(guest.roomRate)}</TableCell>
                  <TableCell className="text-center font-semibold text-purple-600">₵{formatMoney(guest.roomTotal || 0)}</TableCell>
                  <TableCell className="text-center font-semibold text-orange-600">₵{formatMoney(guest.serviceCharges || 0)}</TableCell>
                  <TableCell className="text-center font-semibold text-blue-600">₵{formatMoney(guest.totalCharges || 0)}</TableCell>
                  <TableCell className="text-center text-green-600 font-semibold">₵{formatMoney(guest.totalPayments || 0)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-semibold ${(guest.balance || 0) > 0 ? 'text-red-600' : (guest.balance || 0) < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      ₵{formatMoney(guest.balance || 0)}
                    </span>
                            </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Checked In
                    </span>
                  </TableCell>
                            <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button 
                        size="sm" 
                        color="primary" 
                        variant="solid"
                        className="bg-blue-600 text-white font-semibold px-3 py-1"
                        onClick={() => handleViewFolio(guest)}
                      >
                        📊 Folio
                                  </Button>
                      <Button
                        size="sm"
                        color="default"
                        variant="solid"
                        className="bg-gray-600 text-white font-semibold px-3 py-1"
                        onClick={() => handlePrintRegistrationCard(guest)}
                      >
                        🧾 Print
                      </Button>
                      <Button
                        size="sm"
                        color="success"
                        variant="solid"
                        className="bg-green-600 text-white font-semibold px-3 py-1"
                        onClick={() => handleExtendStay(guest, 1)}
                      >
                        +1 Night
                      </Button>
                      <Button
                        size="sm"
                        color="warning"
                        variant="solid"
                        className="text-white font-semibold px-3 py-1"
                        isDisabled={(() => {
                          const today = new Date(); today.setHours(0, 0, 0, 0);
                          const dep = new Date(guest.checkOutDate); dep.setHours(0, 0, 0, 0);
                          const remainingNights = Math.round((dep.getTime() - today.getTime()) / 86400000);
                          return remainingNights <= 1; // must keep at least 1 night remaining
                        })()}
                        onClick={() => handleExtendStay(guest, -1)}
                      >
                        −1 Night
                      </Button>
                      <Button 
                        size="sm" 
                        color="danger" 
                        variant="solid"
                        className="bg-red-600 text-white font-semibold px-3 py-1"
                        onClick={() => handleEarlyCheckout(guest)}
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
                total={Math.max(1, Math.ceil(filteredGuests.length / rowsPerPage))}
                onChange={setPage}
                showControls
                size="sm"
              />
            </div>
            </div>
        )}


        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
            <Card><CardHeader><h3 className="text-lg font-semibold">Room Rate Distribution</h3></CardHeader><CardBody>{filteredGuests.map(g => (<div key={g.id} className="flex justify-between text-sm mb-2"><span>{g.guestName}</span><span className="font-medium">₵{(g.roomRate || 0).toLocaleString()}</span></div>))}</CardBody></Card>
            <Card><CardHeader><h3 className="text-lg font-semibold">Stay Duration</h3></CardHeader><CardBody>{filteredGuests.map(g => (<div key={g.id} className="flex justify-between text-sm mb-2"><span>{g.guestName}</span><span className="font-medium">{g.bookedNights ?? g.nightsStayed} nights</span></div>))}</CardBody></Card>
                </div>
        )}
      </CardBody></Card>

      <Modal isOpen={isOpen} onClose={onClose} size="2xl"><ModalContent><ModalHeader>Manage Guest - {selectedGuest?.guestName}</ModalHeader><ModalBody>{selectedGuest && (<div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-gray-600">Room</p><p className="text-lg font-semibold">{selectedGuest.roomNumber}</p></div><div><p className="text-sm text-gray-600">Check-in</p><p className="text-lg">{formatDate(selectedGuest.checkInDate)}</p></div><div><p className="text-sm text-gray-600">Check-out</p><p className="text-lg">{formatDate(selectedGuest.checkOutDate)}</p></div><div><p className="text-sm text-gray-600">Status</p><p className="text-lg font-semibold text-green-600">{selectedGuest.status}</p></div></div>)}</ModalBody><ModalFooter><Button variant="flat" onPress={onClose}>Close</Button><Button color="primary" onPress={() => selectedGuest && handleExtendStay(selectedGuest, 1)}>Extend Stay</Button><Button color="danger" variant="flat" onPress={() => selectedGuest && handleEarlyCheckout(selectedGuest)} isLoading={isProcessing}>Early Checkout</Button></ModalFooter></ModalContent></Modal>

      {/* Folio Modal */}
      <Modal isOpen={isFolioModalOpen} onClose={() => setIsFolioModalOpen(false)} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xl">📊</span>
                          </div>
                          <div>
                <h2 className="text-xl font-bold">Guest Folio</h2>
                <p className="text-blue-100 text-sm">{selectedFolioGuest?.guestName} • Room {selectedFolioGuest?.roomNumber}</p>
                          </div>
                        </div>
          </ModalHeader>
          <ModalBody className="p-6">
            {selectedFolioGuest && (() => {
              const folio = frontOfficeStore.getOrCreateFolio(selectedFolioGuest.id);
              frontOfficeStore.updateFolioBalances(folio);
              const folioTotals = getFolioDisplayTotals(folio);
              const roomTotal = folioTotals.roomCharges;
              const serviceCharges = folioTotals.serviceCharges;
              const otherCharges = folioTotals.otherCharges;
              const taxTotal = folioTotals.taxTotal;
              
              return (
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
                          <div className="font-medium">{selectedFolioGuest.guestName || 'Unknown'}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Room Number</div>
                          <div className="font-medium">{selectedFolioGuest.roomNumber || 'TBD'}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Status</div>
                          <Badge color={selectedFolioGuest.status === 'checked-in' ? 'success' : 'warning'} variant="flat">
                            {selectedFolioGuest.status}
                          </Badge>
                        </div>
                        {selectedFolioGuest.taxExempt && (
                          <div>
                            <div className="text-sm text-gray-600">Tax</div>
                            <Badge color="secondary" variant="flat">Tax Exempt</Badge>
                          </div>
                        )}
                        <div>
                          <div className="text-sm text-gray-600">Arrival</div>
                          <div className="font-medium">
                            {formatDate(selectedFolioGuest.checkInDate)}
                            <span className="text-xs text-gray-500 ml-1">{formatTime(selectedFolioGuest.checkInDateTime)}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Departure</div>
                          <div className="font-medium">{formatDate(selectedFolioGuest.checkOutDate)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Nights</div>
                          <div className="font-medium">{selectedFolioGuest.bookedNights ?? selectedFolioGuest.nightsStayed}</div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {/* Financial Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardBody className="text-center p-4">
                        <div className="text-3xl font-bold text-blue-600">₵{formatMoney(roomTotal)}</div>
                        <div className="text-sm text-blue-700 font-medium">Room Charges</div>
                        <div className="text-xs text-blue-600 mt-1">Room rate excl. tax</div>
                      </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                      <CardBody className="text-center p-4">
                        <div className="text-3xl font-bold text-orange-600">₵{serviceCharges.toLocaleString()}</div>
                        <div className="text-sm text-orange-700 font-medium">Service Charges</div>
                        <div className="text-xs text-orange-600 mt-1">Pool, laundry, dining, etc.</div>
                      </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                      <CardBody className="text-center p-4">
                        <div className="text-3xl font-bold text-green-600">₵{(selectedFolioGuest.totalPayments || 0).toLocaleString()}</div>
                        <div className="text-sm text-green-700 font-medium">Payments Received</div>
                        <div className="text-xs text-green-600 mt-1">{folio.payments?.length || 0} transactions</div>
                      </CardBody>
                    </Card>
                    <Card className={`${(selectedFolioGuest.balance || 0) > 0 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}>
                      <CardBody className="text-center p-4">
                        <div className={`text-3xl font-bold ${(selectedFolioGuest.balance || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          ₵{(selectedFolioGuest.balance || 0).toLocaleString()}
                          </div>
                        <div className={`text-sm font-medium ${(selectedFolioGuest.balance || 0) > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                          {(selectedFolioGuest.balance || 0) > 0 ? 'Outstanding' : 'Balance'}
                          </div>
                        <div className={`text-xs mt-1 ${(selectedFolioGuest.balance || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {(selectedFolioGuest.balance || 0) > 0 ? 'Amount owed' : 'Fully paid'}
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Charges Breakdown */}
                    <Card className="border-0 shadow-lg">
                      <CardHeader className="bg-gray-50">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <span className="text-blue-600">💰</span>
                          Charges Breakdown
                        </h3>
                    </CardHeader>
                      <CardBody className="p-0">
                        <div className="space-y-3 p-4">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Room Charges</span>
                            <span className="font-semibold text-blue-600">₵{formatMoney(roomTotal)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Service Charges</span>
                            <span className="font-semibold text-orange-600">₵{formatMoney(serviceCharges)}</span>
                        </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Other Charges</span>
                            <span className="font-semibold text-purple-600">₵{formatMoney(otherCharges)}</span>
                        </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Taxes (VAT + NHIL + GETFund + Tourism)</span>
                            <span className="font-semibold text-red-600">₵{formatMoney(taxTotal)}</span>
                        </div>
                          {Math.abs(folioTotals.roundingAdjustment || 0) >= 0.01 && (
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-600">Rounding Adjustment</span>
                              <span className="font-semibold text-gray-600">
                                {folioTotals.roundingAdjustment > 0 ? '+' : ''}₵{formatMoney(folioTotals.roundingAdjustment)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center py-3 bg-gray-50 rounded-lg px-3">
                            <span className="font-bold text-gray-800">Total Charges (Incl. Tax)</span>
                            <span className="font-bold text-lg text-gray-800">₵{formatMoney(folioTotals.totalCharges)}</span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                    
                    {/* Payment Summary */}
                    <Card className="border-0 shadow-lg">
                      <CardHeader className="bg-gray-50">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <span className="text-green-600">💳</span>
                          Payment Summary
                        </h3>
                    </CardHeader>
                      <CardBody className="p-0">
                        <div className="space-y-3 p-4">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Total Payments</span>
                            <span className="font-semibold text-green-600">₵{(selectedFolioGuest.totalPayments || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Payment Methods</span>
                            <span className="text-sm text-gray-500">
                              {folio.payments?.map(p => p.method).join(', ') || 'None'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-3 bg-gray-50 rounded-lg px-3">
                            <span className="font-bold text-gray-800">Current Balance</span>
                            <span className={`font-bold text-lg ${(selectedFolioGuest.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ₵{(selectedFolioGuest.balance || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  {/* Recent Transactions */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="bg-gray-50">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-purple-600">📋</span>
                        Recent Transactions
                      </h3>
                    </CardHeader>
                    <CardBody className="p-0">
                      <div className="max-h-64 overflow-y-auto">
                        {folio.charges && folio.charges.length > 0 ? (
                          <div className="space-y-2 p-4">
                            {folio.charges.slice(0, 10).map((charge, index) => (
                              <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-blue-600 text-sm">💰</span>
                        </div>
                        <div>
                                    <div className="font-medium text-gray-800">{charge.description}</div>
                                    <div className="text-xs text-gray-500">{new Date(charge.date).toLocaleDateString()}</div>
                        </div>
                  </div>
                                <div className="text-right">
                                  <div className="font-semibold text-gray-800">
                                    ₵{formatMoney(charge.amount)}
                                  </div>
                    </div>
                    </div>
                            ))}
                        </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <div className="text-4xl mb-2">📝</div>
                            <div>No charges recorded yet</div>
                        </div>
                  )}
                      </div>
                    </CardBody>
                  </Card>
                      </div>
              );
            })()}
            </ModalBody>
          <ModalFooter className="bg-gray-50">
            <div className="flex justify-between items-center w-full">
              <div className="text-sm text-gray-600">
                Last updated: {new Date().toLocaleString()}
              </div>
              <div className="flex gap-2">
                        <Button
                  variant="light" 
                  onPress={() => setIsFolioModalOpen(false)}
                  className="px-6"
                >
                  Close
                        </Button>
                        <Button
                  color="primary" 
                  className="bg-blue-600 text-white px-6"
                  onPress={() => handlePaymentClick(selectedFolioGuest!, 'payment')}
                >
                  💳 Process Payment
                        </Button>
                      </div>
                      </div>
            </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Room Transfer Modal */}
      <Modal isOpen={transferModalOpen} onClose={() => setTransferModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xl">🔄</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">Room Transfer</h2>
                <p className="text-blue-100 text-sm">Transfer guest to a different room</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Select Guest"
                  placeholder="Choose guest to transfer"
                >
                  {guests.map(guest => (
                    <SelectItem key={guest.id}>
                      {guest.guestName} - Room {guest.roomNumber}
                    </SelectItem>
                  ))}
                </Select>
                
                <Select
                  label="Room Type"
                  placeholder="Select room type first"
                >
                  {frontOfficeStore.roomTypes.map(roomType => (
                    <SelectItem key={roomType.id}>
                      {roomType.name} - ₵{roomType.baseRate.toLocaleString()}/night
                    </SelectItem>
                  ))}
                </Select>
              </div>
              
                <Select
                  label="New Room"
                  placeholder="Select new room"
                >
                  {frontOfficeStore.rooms
                    .map(room => {
                      const rt = frontOfficeStore.roomTypes.find(r => r.id === room.roomTypeId);
                      return (
                        <SelectItem key={room.id}>
                          {room.id} - {rt?.name || room.roomTypeId}
                        </SelectItem>
                      );
                    })}
                </Select>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Transfer Reason"
                  placeholder="Why is this transfer needed?"
                >
                  <SelectItem key="maintenance">🔧 Maintenance Required</SelectItem>
                  <SelectItem key="guest_request">🙋 Guest Request</SelectItem>
                  <SelectItem key="upgrade">⬆️ Room Upgrade</SelectItem>
                  <SelectItem key="downgrade">⬇️ Room Downgrade</SelectItem>
                  <SelectItem key="noise_complaint">🔇 Noise Complaint</SelectItem>
                  <SelectItem key="room_issue">🚫 Room Issue</SelectItem>
                  <SelectItem key="group_consolidation">👥 Group Consolidation</SelectItem>
                  <SelectItem key="overbooking">📋 Overbooking Resolution</SelectItem>
                  <SelectItem key="special_needs">♿ Special Needs</SelectItem>
                  <SelectItem key="other">📝 Other</SelectItem>
                </Select>
                
                <Textarea
                  label="Additional Comments"
                  placeholder="Enter additional details..."
                  rows={3}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              🔄 Process Transfer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xl">💳</span>
            </div>
              <div>
                <h2 className="text-xl font-bold">
                  {paymentData.type === 'deposit' ? 'Process Deposit' : 
                   paymentData.type === 'prepayment' ? 'Process Prepayment' : 'Process Payment'}
                </h2>
                <p className="text-green-100 text-sm">{selectedFolioGuest?.guestName} • Room {selectedFolioGuest?.roomNumber}</p>
            </div>
            </div>
            </ModalHeader>
          <ModalBody className="p-6">
            <form onSubmit={handlePaymentSubmit} className="space-y-6">
              {/* Payment Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                    <span className="text-gray-600">Guest:</span>
                    <div className="font-medium">{selectedFolioGuest?.guestName}</div>
                    </div>
                  <div>
                    <span className="text-gray-600">Room:</span>
                    <div className="font-medium">{selectedFolioGuest?.roomNumber}</div>
                  </div>
                    <div>
                    <span className="text-gray-600">Current Balance:</span>
                    <div className="font-medium text-red-600">₵{(selectedFolioGuest?.balance || 0).toLocaleString()}</div>
                    </div>
                    <div>
                    <span className="text-gray-600">Payment Type:</span>
                    <div className="font-medium capitalize">{paymentData.type}</div>
                  </div>
                    </div>
                    </div>
                    
              {/* Payment Form */}
              <div className="grid grid-cols-3 gap-4">
                      <Select
                  label="Payment Type"
                  value={paymentData.type}
                  onChange={(e) => {
                    const newType = e.target.value as 'deposit' | 'payment' | 'prepayment';
                    setPaymentData(prev => ({ 
                      ...prev, 
                      type: newType,
                      amount: newType === 'deposit' ? (selectedFolioGuest?.roomRate || 0) * 0.5 : 
                              newType === 'prepayment' ? (selectedFolioGuest?.balance || 0) : 
                              (selectedFolioGuest?.balance || 0)
                    }));
                  }}
                  isRequired
                >
                  <SelectItem key="deposit">💰 Deposit (50% of room rate)</SelectItem>
                  <SelectItem key="prepayment">⚡ Prepayment (Full balance)</SelectItem>
                  <SelectItem key="payment">💳 Payment (Custom amount)</SelectItem>
                      </Select>
                <Input
                  label="Payment Amount (GHS)"
                  type="number"
                  value={paymentData.amount.toString()}
                  onChange={(e) => setPaymentData(prev => ({ 
                    ...prev, 
                    amount: parseFloat(e.target.value) || 0 
                  }))}
                  isRequired
                  description={paymentData.type === 'deposit' ? 'Suggested: 50% of room rate' : 
                             paymentData.type === 'prepayment' ? 'Full balance amount' : 
                             'Enter payment amount'}
                />
                <Select
                  label="Payment Method"
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData(prev => ({ 
                    ...prev, 
                    paymentMethod: e.target.value 
                  }))}
                  isRequired
                >
                  <SelectItem key="cash">💵 Cash</SelectItem>
                  <SelectItem key="card">💳 Card</SelectItem>
                  <SelectItem key="mobile_money">📱 Mobile Money</SelectItem>
                  <SelectItem key="bank_transfer">🏦 Bank Transfer</SelectItem>
                  <SelectItem key="check">📝 Check</SelectItem>
                  <SelectItem key="corporate_account">🏢 Corporate Account</SelectItem>
                </Select>
                  </div>
                  
              <Input
                label="Reference/Transaction ID"
                value={paymentData.reference}
                onChange={(e) => setPaymentData(prev => ({ 
                  ...prev, 
                  reference: e.target.value 
                }))}
                placeholder="Enter transaction reference or check number"
              />

              <Textarea
                label="Payment Notes (Optional)"
                value={paymentData.notes}
                onChange={(e) => setPaymentData(prev => ({ 
                  ...prev, 
                  notes: e.target.value 
                }))}
                placeholder="Additional notes about this payment..."
                rows={3}
              />

              {/* Payment Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-900">Payment Amount:</span>
                  <span className="text-xl font-bold text-blue-900">
                    ₵{paymentData.amount.toLocaleString()}
                  </span>
                </div>
                {paymentData.amount < (selectedFolioGuest?.balance || 0) && (
                  <div className="text-sm text-orange-600 mt-1">
                    ⚠️ Partial payment - Remaining: ₵{((selectedFolioGuest?.balance || 0) - paymentData.amount).toLocaleString()}
                    </div>
                  )}
                {paymentData.amount > (selectedFolioGuest?.balance || 0) && (
                  <div className="text-sm text-green-600 mt-1">
                    💰 Overpayment - Change: ₵{(paymentData.amount - (selectedFolioGuest?.balance || 0)).toLocaleString()}
                </div>
              )}
              </div>
            </form>
            </ModalBody>
          <ModalFooter className="bg-gray-50">
            <div className="flex justify-between items-center w-full">
              <Button 
                variant="light" 
                onPress={() => setIsPaymentModalOpen(false)}
                className="px-6"
              >
                Cancel
                  </Button>
                  <Button 
                color="success" 
                className="bg-green-600 text-white px-6"
                onPress={() => handlePaymentSubmit(new Event('submit') as any)}
                isDisabled={paymentData.amount <= 0 || isProcessing}
                isLoading={isProcessing}
              >
                {isProcessing ? 'Processing...' : '💳 Process Payment'}
              </Button>
                </div>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={isNoShowOpen} onClose={onNoShowClose}>
          <ModalContent>
            <ModalHeader>Mark no-show</ModalHeader>
            <ModalBody>
              {noShowTarget && (
                <p className="text-sm">
                  Mark <strong>{noShowTarget.guestName}</strong> ({noShowTarget.resId || noShowTarget.id}) as a no-show?
                  Penalty and GL post apply per your no-show policy.
                </p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onNoShowClose}>Cancel</Button>
              <Button color="danger" onPress={confirmNoShow}>Confirm no-show</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
  );
}

// --- Unified Page Wrapper ---
function CheckInsPageInner() {
  const params = useSearchParams();
  const initialTab = params.get('tab') || 'reservations';
  const [selectedTab, setSelectedTab] = useState(initialTab);
  const router = useRouter();

  return (
    <PageLayout>
      <div className="p-6">
        <div className="mb-6">
          <FrontOfficeBackButton />
          <h1 className="text-3xl font-bold text-ghana-black">🏨 Front Office Operations</h1>
          <p className="text-gray-600 mt-2">Reservations, check-ins, check-outs, service charges, and guest billing — all in one place</p>
                      </div>

        <Tabs selectedKey={selectedTab} onSelectionChange={(key) => setSelectedTab(key as string)} className="w-full">
          <Tab key="reservations" title="📅 Reservations & Bookings Management">
            <Card className="border-0 shadow-lg"><CardBody><Suspense fallback={<div className="p-6 text-center">Loading Reservations & Bookings...</div>}><ReservationsBookingsManager /></Suspense></CardBody></Card>
          </Tab>
          <Tab key="checkins" title="🏠 Check-Ins Management">
            <CheckInsSection />
          </Tab>
          <Tab key="checkouts" title="🚪 Check-outs">
            <div className="pt-2"><CheckOutsPage /></div>
          </Tab>
          <Tab key="servicecharges" title="🏊 Service Charges">
            <div className="pt-2"><ServiceChargesPage /></div>
          </Tab>
          <Tab key="billing" title="💳 Invoices & Payments">
            <div className="pt-2"><InvoicesPaymentsPage /></div>
          </Tab>
        </Tabs>
      </div>
    </PageLayout>
  );
}

export default function CheckInsPage() {
  return (
    <Suspense fallback={null}>
      <CheckInsPageInner />
    </Suspense>
  );
}
