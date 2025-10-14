"use client";

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import PageLayout from '../../components/PageLayout';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Tabs,
  Tab
} from "@heroui/react";
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';

// Lazy sections to keep the page responsive
const CheckOutsPage = dynamic(() => import('../check-outs/page'), { ssr: false });
const InvoicesPaymentsPage = dynamic(() => import('../client-services/invoices-payments/page'), { ssr: false });
const ServiceChargesPage = dynamic(() => import('../service-charges/page'), { ssr: false });
const ReservationsBookingsManager = dynamic(() => import('../../components/ReservationsBookingsManager'), { ssr: false });
const QuickCheckInManager = dynamic(() => import('../../components/QuickCheckInManager'), { ssr: false });

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
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Textarea,
  Chip
} from "@heroui/react";
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { trackEvent } from '../../lib/analytics/trackEvent';

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
  totalCharges?: number;
  totalPayments?: number;
  balance?: number;
  serviceCharges?: number;
  otherCharges?: number;
  taxTotal?: number;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function CheckInsSection() {
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
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [preExistingReservationIds, setPreExistingReservationIds] = useState<string[]>([]);
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

  // Quick intake state (Reservation search + Walk-in form)
  const [reservationSearchTerm, setReservationSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    guestName: '',
    phone: '',
    email: '',
    roomTypeId: '',
    arrivalDate: new Date().toISOString().split('T')[0],
    departureDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    adults: 1,
    children: 0,
    paymentMethod: 'Cash'
  });
  // Guest picker & purpose/billing/source (mirror)
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [guestResults, setGuestResults] = useState<any[]>([]);
  const [quickSelectedGuest, setQuickSelectedGuest] = useState<any | null>(null);
  const [stayReason, setStayReason] = useState('');
  const [stayReasonDetails, setStayReasonDetails] = useState('');
  const [payerType, setPayerType] = useState<'guest' | 'thirdparty'>('guest');
  const [source, setSource] = useState('Direct');

  // Handle Quick Check-In tab selection
  useEffect(() => {
    if (activeTab === 'quick') {
      setPreExistingReservationIds(frontOfficeStore.reservations.map(r => r.id));
      setQuickModalOpen(true);
    } else {
      setQuickModalOpen(false);
    }
  }, [activeTab]);

  // Load guests function
  const loadGuests = () => {
    const reservations = frontOfficeStore.reservations;
    const today = new Date();
    const data: CheckInGuest[] = reservations
      .filter(r => r.status === 'checked-in' && new Date(r.departure) >= today && r.roomId && r.roomId !== 'TBD')
      .map(reservation => {
        const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
        const creditBalance = guest?.creditBalance || 0;
        const nightsStayed = Math.max(0, Math.ceil((today.getTime() - new Date(reservation.arrival).getTime()) / (1000*60*60*24)));
        
        // Get the correct room rate from rate breakdown or fallback to room type rate
        const roomType = frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId);
        const roomRate = reservation.rateBreakdown?.[0]?.base || roomType?.baseRate || 0;
        
        // Get folio data for this reservation
        const folio = frontOfficeStore.getOrCreateFolio(reservation.id);
        const roomTotal = roomRate * (nightsStayed + 1);
        // Identify service charges by common keywords
        const serviceKeywords = ['service', 'swimming', 'laundry', 'pool', 'spa', 'gym', 'restaurant', 'bar', 'room service', 'minibar', 'parking', 'wifi', 'internet', 'breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'drink', 'food', 'meal'];
        const serviceCharges = folio.charges?.filter(charge => {
          const desc = charge.description?.toLowerCase() || '';
          return serviceKeywords.some(keyword => desc.includes(keyword));
        }).reduce((sum, charge) => sum + (charge.amount || 0), 0) || 0;
        
        const otherCharges = folio.charges?.filter(charge => {
          const desc = charge.description?.toLowerCase() || '';
          return !serviceKeywords.some(keyword => desc.includes(keyword));
        }).reduce((sum, charge) => sum + (charge.amount || 0), 0) || 0;
        
        // Calculate taxes from all charges
        const taxTotal = folio.charges?.reduce((sum, charge) => sum + (charge.tax || 0), 0) || 0;
        
        const totalCharges = roomTotal + serviceCharges + otherCharges + taxTotal;
        const totalPayments = folio.payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
        const balance = totalCharges - totalPayments;
        
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
          // Add folio data
          totalCharges,
          totalPayments,
          balance,
          serviceCharges,
          otherCharges,
          taxTotal
        } as CheckInGuest;
      });
    setGuests(data);
    setFilteredGuests(data);
  };

  // Handle Quick Check-In completion
  const handleQuickCheckInComplete = (reservationId: string) => {
    // Close modal and return to overview
    setQuickModalOpen(false);
    setActiveTab('overview');
    loadGuests(); // Refresh the guest list
    
    // Show success message
    trackEvent('FO.Reservation.CheckedIn', {
      reservationId,
      source: 'QuickCheckInManager'
    });
  };

  useEffect(() => {
    loadGuests();
    const unsub = frontOfficeStore.subscribe(loadGuests);
    return () => unsub();
  }, []);

  useEffect(() => {
    let filtered = guests;
    if (searchTerm) {
      filtered = filtered.filter(g =>
        g.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.phone?.includes(searchTerm) ||
        g.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== 'all') filtered = filtered.filter(g => g.status === statusFilter);
    setFilteredGuests(filtered);
    setPage(1);
  }, [guests, searchTerm, statusFilter]);

  const totalRoomRevenue = useMemo(() => guests.reduce((s,g) => s + (g.roomRate || 0), 0), [guests]);
  const totalRoomAmount = useMemo(() => guests.reduce((s,g) => s + ((g.roomRate || 0) * ((g.nightsStayed || 0) + 1)), 0), [guests]);
  const totalServiceCharges = useMemo(() => guests.reduce((s,g) => s + (g.serviceCharges || 0), 0), [guests]);
  const totalCharges = useMemo(() => guests.reduce((s,g) => s + (g.totalCharges || 0), 0), [guests]);
  const totalPayments = useMemo(() => guests.reduce((s,g) => s + (g.totalPayments || 0), 0), [guests]);
  const totalOutstanding = useMemo(() => guests.reduce((s,g) => s + (g.balance || 0), 0), [guests]);
  const avgNights = useMemo(() => guests.length ? (guests.reduce((s,g)=>s+g.nightsStayed,0)/guests.length).toFixed(1) : '0.0', [guests]);

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
    const r = frontOfficeStore.reservations.find(r => r.id === guest.id);
    if (r) {
      const dep = new Date(r.departure); dep.setDate(dep.getDate() + nights); r.departure = dep.toISOString(); r.status = 'checked-in';
      frontOfficeStore.notify();
      trackEvent('FO.Reservation.Updated', { reservationId: guest.id, guestName: guest.guestName, additionalNights: nights, source: 'check-ins' });
    }
      onClose();
    setSelectedGuest(null);
  };

  const handleApplyCredit = (guest: CheckInGuest) => {
    if (!guest.creditBalance || guest.creditBalance <= 0) return;
    const amount = guest.creditBalance; // Simplified - apply full credit balance
    const ok = frontOfficeStore.applyCreditPayment(guest.id, amount, 'Credit applied from unified Check-Ins');
    if (ok) setTimeout(() => {
      // Credit applied successfully
    }, 50);
  };

  const handleViewFolio = (guest: CheckInGuest) => {
    setSelectedFolioGuest(guest);
    setIsFolioModalOpen(true);
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
      frontOfficeStore.addPayment(
        selectedFolioGuest.id,
        paymentData.paymentMethod as 'Cash' | 'Card' | 'Mobile Money' | 'Bank Transfer' | 'Check' | 'Corporate Account',
        paymentData.amount,
        {
          notes: `${paymentData.type === 'deposit' ? 'Deposit' : paymentData.type === 'prepayment' ? 'Prepayment' : 'Payment'} - ${paymentData.notes || 'Guest payment'}`,
          processedBy: 'Front Desk',
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
      
      // Show success message
      alert(`Payment of ₵${paymentData.amount.toLocaleString()} processed successfully!`);
      
    } catch (error) {
      console.error('Payment processing error:', error);
      alert('Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick intake actions
  const searchReservations = async () => {
    if (!reservationSearchTerm.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const reservations = frontOfficeStore.reservations;
      const results = reservations.filter(r =>
        r.guestName.toLowerCase().includes(reservationSearchTerm.toLowerCase()) ||
        r.guestPhone?.includes(reservationSearchTerm) ||
        r.id.includes(reservationSearchTerm)
      );
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const checkInReservation = (reservation: any) => {
    frontOfficeStore.updateReservationStatus(reservation.id, 'checked-in');
    trackEvent('FO.Reservation.CheckedIn', { reservationId: reservation.id, guestName: reservation.guestName, roomType: reservation.roomType, source: 'quick-intake' });
    // refresh
    loadGuests();
  };

  const submitWalkIn = () => {
    const fallbackRoomType = (frontOfficeStore.roomTypes || [])[0];
    const roomType = frontOfficeStore.roomTypes.find(rt => rt.id === walkInForm.roomTypeId) || fallbackRoomType;
      const walkInReservation = {
        id: `walkin-${Date.now()}`,
      guestName: quickSelectedGuest?.name || walkInForm.guestName,
      guestPhone: quickSelectedGuest?.phone || walkInForm.phone,
      guestEmail: quickSelectedGuest?.email || walkInForm.email,
      roomType: roomType?.name || 'Standard',
      roomTypeId: roomType?.id,
        arrival: walkInForm.arrivalDate,
        departure: walkInForm.departureDate,
        adults: walkInForm.adults,
        children: walkInForm.children,
        paymentMethod: walkInForm.paymentMethod,
      remarksToGuest: stayReasonDetails,
      billingPersonName: payerType === 'thirdparty' ? 'Third Party' : undefined,
        status: 'checked-in' as const,
      source,
        createdAt: new Date().toISOString()
      };
    frontOfficeStore.addReservation(walkInReservation);
    trackEvent('FO.Reservation.CheckedIn', { guestName: walkInReservation.guestName, roomType: walkInReservation.roomType, source });
      setWalkInForm({
      guestName: '', phone: '', email: '', roomTypeId: '',
        arrivalDate: new Date().toISOString().split('T')[0],
      departureDate: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
      adults: 1, children: 0, paymentMethod: 'Cash'
    });
    setQuickSelectedGuest(null);
    setStayReason(''); setStayReasonDetails(''); setPayerType('guest'); setSource('Direct');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Guests</p><p className="text-2xl font-bold text-ghana-black">{guests.length}</p></div><div className="text-2xl">👥</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Avg Rate/Night</p><p className="text-2xl font-bold text-ghana-black">₵{guests.length > 0 ? Math.round(totalRoomRevenue / guests.length).toLocaleString() : '0'}</p></div><div className="text-2xl">💰</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Room Total</p><p className="text-2xl font-bold text-purple-600">₵{totalRoomAmount.toLocaleString()}</p></div><div className="text-2xl">🏨</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Service Charges</p><p className="text-2xl font-bold text-orange-600">₵{totalServiceCharges.toLocaleString()}</p></div><div className="text-2xl">🏊</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Amount</p><p className="text-2xl font-bold text-blue-600">₵{totalCharges.toLocaleString()}</p></div><div className="text-2xl">📊</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Payments</p><p className="text-2xl font-bold text-green-600">₵{totalPayments.toLocaleString()}</p></div><div className="text-2xl">💳</div></div></CardBody></Card>
        <Card className="border-0 shadow-lg"><CardBody className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Outstanding</p><p className="text-2xl font-bold text-red-600">₵{totalOutstanding.toLocaleString()}</p></div><div className="text-2xl">⏰</div></div></CardBody></Card>
        </div>

      <Card className="mb-2"><CardBody className="p-4"><div className="flex flex-col sm:flex-row gap-4"><Input placeholder="Search by guest name, room number, phone, or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1" startContent={<span className="text-gray-400">🔍</span>} /><Select placeholder="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-48"><SelectItem key="all">All Statuses</SelectItem><SelectItem key="checked-in">Checked In</SelectItem><SelectItem key="extended">Extended</SelectItem><SelectItem key="early-checkout">Early Checkout</SelectItem></Select><Button color="primary" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white" onPress={() => setTransferModalOpen(true)}>🔄 Room Transfer</Button></div></CardBody></Card>

      <Card><CardBody>
        <Tabs selectedKey={activeTab} onSelectionChange={(k)=>setActiveTab(k as string)} className="mb-4"><Tab key="quick" title="⚡ Quick Check-In" /><Tab key="overview" title="📊 Overview" /><Tab key="analytics" title="📈 Analytics" /></Tabs>

        {activeTab === 'quick' && (
          <Modal isOpen={quickModalOpen} onClose={() => setActiveTab('overview')} size="4xl">
            <ModalContent>
              <ModalHeader>⚡ Quick Check-In</ModalHeader>
              <ModalBody>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Auto-Processing:</strong> When you submit the form, we'll automatically assign an available room and check the guest in.
            </p>
                  </div>
                <Suspense fallback={<div className="p-6 text-center">Loading form...</div>}>
                  <QuickCheckInManager 
                    onCheckInComplete={handleQuickCheckInComplete}
                    onClose={() => setActiveTab('overview')}
                  />
                </Suspense>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onClick={() => setActiveTab('overview')}>Close</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        )}
        {false && (
          <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
              <h4 className="font-semibold mb-2">Find Reservation</h4>
              <div className="flex gap-2 mb-3">
                <Input placeholder="Name / Phone / Reservation ID" value={reservationSearchTerm} onChange={(e)=>setReservationSearchTerm(e.target.value)} onKeyPress={(e)=> e.key==='Enter' && searchReservations()} className="flex-1" />
                <Button color="primary" onClick={searchReservations} isLoading={isSearching}>Search</Button>
                </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {searchResults.map((r) => (
                  <Card key={r.id} className="border border-gray-200"><CardBody className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                        <p className="font-medium">{r.guestName}</p>
                        <p className="text-xs text-gray-600">{r.guestPhone} • {r.roomType} • {r.arrival} → {r.departure}</p>
                  </div>
                      <Button size="sm" color="primary" onClick={() => checkInReservation(r)}>✅ Check In</Button>
                </div>
                  </CardBody></Card>
                ))}
                {!searchResults.length && <p className="text-sm text-gray-500">No results yet. Search to find a reservation.</p>}
                  </div>

              {/* Guest List (mirror of reservation UI) */}
              <Card className="mt-6 bg-purple-50 border border-purple-200">
                <CardHeader className="pb-2">
                <div className="flex items-center justify-between w-full">
                    <span className="font-semibold">Guest List {quickSelectedGuest ? '(1 guest)' : '(0 guests)'}</span>
                    <span className="text-xs text-purple-600">Search and add guests from the system</span>
                </div>
              </CardHeader>
                <CardBody className="space-y-3">
                  <Input placeholder="Search for existing guests by name, phone, email, or Ghana Card" value={guestSearchTerm} onChange={(e)=>{ setGuestSearchTerm(e.target.value); const q=e.target.value.toLowerCase(); const results=(frontOfficeStore.guests||[]).filter((g:any)=> (g.name||'').toLowerCase().includes(q) || (g.phone||'').includes(q) || (g.email||'').toLowerCase().includes(q)); setGuestResults(results.slice(0,10)); }} />
                  <div className="min-h-16 p-4 rounded-lg border border-dashed border-purple-300 text-center text-sm text-purple-700 bg-white">
                    {quickSelectedGuest ? (
                      <div className="flex items-center justify-center gap-2">
                        <Chip color="primary" variant="flat">{quickSelectedGuest.name} • {quickSelectedGuest.phone}</Chip>
                        <Button size="sm" variant="light" onClick={()=>setQuickSelectedGuest(null)}>Remove</Button>
          </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-2xl">👥</div>
                        <div>No guests added yet</div>
                        <div className="text-xs">Search for guests above and click "Add" to include them</div>
              </div>
                )}
                                </div>
                  {guestSearchTerm && guestResults.length > 0 && (
                    <div className="space-y-2">
                      {guestResults.map((g:any)=> (
                        <Card key={g.id} className="border border-gray-200"><CardBody className="p-3"><div className="flex items-center justify-between"><div><p className="font-medium">{g.name}</p><p className="text-xs text-gray-600">{g.phone} • {g.email}</p></div><Button size="sm" onClick={()=>setQuickSelectedGuest(g)}>Add</Button></div></CardBody></Card>
                      ))}
                    </div>
                )}
              </CardBody>
            </Card>
          </div>

                        <div>
              <h4 className="font-semibold mb-2">Walk-In Guest</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Guest Name" placeholder="e.g., Ama Kofi" value={walkInForm.guestName} onChange={(e)=>setWalkInForm({ ...walkInForm, guestName: e.target.value })} />
                <Input label="Phone" placeholder="e.g., +233..." value={walkInForm.phone} onChange={(e)=>setWalkInForm({ ...walkInForm, phone: e.target.value })} />
                <Input label="Email" placeholder="guest@example.com" value={walkInForm.email} onChange={(e)=>setWalkInForm({ ...walkInForm, email: e.target.value })} />
                <Select label="Room Type" selectedKeys={walkInForm.roomTypeId ? [walkInForm.roomTypeId] : []} onSelectionChange={(keys)=>{ const id = Array.from(keys)[0] as string; setWalkInForm({ ...walkInForm, roomTypeId: id }); }}>
                  {(frontOfficeStore.roomTypes || []).map((rt: any) => (<SelectItem key={rt.id}>{rt.name}</SelectItem>))}
                </Select>
                <Input type="date" label="Arrival" value={walkInForm.arrivalDate} onChange={(e)=>setWalkInForm({ ...walkInForm, arrivalDate: e.target.value })} />
                <Input type="date" label="Departure" value={walkInForm.departureDate} onChange={(e)=>setWalkInForm({ ...walkInForm, departureDate: e.target.value })} />
                <Input type="number" min={1} label="Adults" value={String(walkInForm.adults)} onChange={(e)=>setWalkInForm({ ...walkInForm, adults: Number(e.target.value || 1) })} />
                <Input type="number" min={0} label="Children" value={String(walkInForm.children)} onChange={(e)=>setWalkInForm({ ...walkInForm, children: Number(e.target.value || 0) })} />
                <Select label="Payment Method" selectedKeys={[walkInForm.paymentMethod]} onSelectionChange={(keys)=>{ const pm = Array.from(keys)[0] as string; setWalkInForm({ ...walkInForm, paymentMethod: pm }); }}>
                  <SelectItem key="Cash">Cash</SelectItem>
                  <SelectItem key="Card">Card</SelectItem>
                  <SelectItem key="Transfer">Transfer</SelectItem>
                </Select>
                <div className="md:col-span-2">
                  <Button color="primary" onClick={submitWalkIn} isDisabled={!walkInForm.guestName || !walkInForm.roomTypeId}>Create & Check In</Button>
                        </div>
                      </div>
                        </div>
                  </div>
          {/* Purpose of Stay / Billing / Source sections */}
          <div className="grid grid-cols-1 gap-4 mt-6">
            <Card className="bg-blue-50 border border-blue-200">
              <CardHeader className="pb-2"><span className="font-semibold">Purpose of Stay</span></CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select label="Reason for Stay" selectedKeys={stayReason ? [stayReason] : []} onSelectionChange={(keys)=>setStayReason(Array.from(keys)[0] as string)}>
                    <SelectItem key="business">Business</SelectItem>
                    <SelectItem key="leisure">Leisure</SelectItem>
                    <SelectItem key="conference">Conference</SelectItem>
                    <SelectItem key="medical">Medical</SelectItem>
                    <SelectItem key="other">Other</SelectItem>
                  </Select>
                  <Textarea label="Additional Details" placeholder="More details about the purpose" value={stayReasonDetails} onChange={(e)=>setStayReasonDetails(e.target.value)} />
                      </div>
                    </CardBody>
                  </Card>

            <Card className="bg-green-50 border border-green-200">
              <CardHeader className="pb-2"><span className="font-semibold">Billing Information</span></CardHeader>
              <CardBody>
                <div className="flex items-center gap-4 text-sm">
                  <Button size="sm" variant={payerType==='guest'?'solid':'flat'} color={payerType==='guest'?'success':'default'} onClick={()=>setPayerType('guest')}>Guest Pays</Button>
                  <Button size="sm" variant={payerType==='thirdparty'?'solid':'flat'} color={payerType==='thirdparty'?'success':'default'} onClick={()=>setPayerType('thirdparty')}>Third Party Pays</Button>
                  <span className="text-gray-600">{payerType==='guest' ? 'Guest will be responsible for their own payment.' : 'A third party will handle payment.'}</span>
                      </div>
                    </CardBody>
                  </Card>

            <Card className="bg-yellow-50 border border-yellow-200">
              <CardHeader className="pb-2"><span className="font-semibold">Source</span></CardHeader>
              <CardBody>
                <Select placeholder="Select booking source" selectedKeys={[source]} onSelectionChange={(keys)=>setSource(Array.from(keys)[0] as string)} className="max-w-md">
                  <SelectItem key="Direct">Direct</SelectItem>
                  <SelectItem key="Walk-in">Walk-in</SelectItem>
                  <SelectItem key="OTA">OTA</SelectItem>
                  <SelectItem key="Corporate">Corporate</SelectItem>
                  <SelectItem key="Referral">Referral</SelectItem>
                </Select>
                    </CardBody>
                  </Card>
                </div>
                      </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <strong>Column Guide:</strong> 
              <span className="ml-2">RATE/NIGHT = Per night room rate</span>
              <span className="ml-4">ROOM TOTAL = Rate × (Nights + 1)</span>
              <span className="ml-4">SERVICE CHARGES = Swimming pool, laundry, etc.</span>
              <span className="ml-4">AMOUNT = Total charges (room + services + other + taxes)</span>
              <span className="ml-4">PAYMENTS = Total payments received</span>
              <span className="ml-4">BALANCE = Amount - Payments</span>
            </div>
            <Table aria-label="In-house guests table" className="min-w-full">
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
              {filteredGuests
                .sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime())
                .slice((page - 1) * rowsPerPage, page * rowsPerPage)
                .map((guest) => (
                <TableRow key={guest.id} className="hover:bg-gray-50">
                            <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar name={guest.guestName} size="sm" className="bg-ghana-gold text-white font-semibold" showFallback />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate">{guest.guestName}</p>
                        <p className="text-xs text-gray-600">{guest.phone}</p>
                        {guest.email && (<p className="text-xs text-blue-600 truncate">{guest.email}</p>)}
                      </div>
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
                  <TableCell className="text-center">{guest.nightsStayed}</TableCell>
                  <TableCell className="text-center font-semibold">₵{guest.roomRate.toLocaleString()}</TableCell>
                  <TableCell className="text-center font-semibold text-purple-600">₵{(guest.roomRate * (guest.nightsStayed + 1)).toLocaleString()}</TableCell>
                  <TableCell className="text-center font-semibold text-orange-600">₵{(guest.serviceCharges || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-center font-semibold text-blue-600">₵{(guest.totalCharges || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-center text-green-600 font-semibold">₵{(guest.totalPayments || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-semibold ${(guest.balance || 0) > 0 ? 'text-red-600' : (guest.balance || 0) < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      ₵{(guest.balance || 0).toLocaleString()}
                    </span>
                            </TableCell>
                  <TableCell className="text-center"><Badge color="success" variant="flat">Checked In</Badge></TableCell>
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
                        color="success" 
                        variant="solid"
                        className="bg-green-600 text-white font-semibold px-3 py-1"
                        onClick={() => handleExtendStay(guest, 1)}
                      >
                        +1 Night
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
                  </div>
        )}


        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
            <Card><CardHeader><h3 className="text-lg font-semibold">Room Rate Distribution</h3></CardHeader><CardBody>{guests.map(g => (<div key={g.id} className="flex justify-between text-sm mb-2"><span>{g.guestName}</span><span className="font-medium">₵{(g.roomRate || 0).toLocaleString()}</span></div>))}</CardBody></Card>
            <Card><CardHeader><h3 className="text-lg font-semibold">Stay Duration</h3></CardHeader><CardBody>{guests.map(g => (<div key={g.id} className="flex justify-between text-sm mb-2"><span>{g.guestName}</span><span className="font-medium">{g.nightsStayed + 1} nights</span></div>))}</CardBody></Card>
                </div>
        )}
      </CardBody></Card>

      <Modal isOpen={isOpen} onClose={onClose} size="2xl"><ModalContent><ModalHeader>Manage Guest - {selectedGuest?.guestName}</ModalHeader><ModalBody>{selectedGuest && (<div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-gray-600">Room</p><p className="text-lg font-semibold">{selectedGuest.roomNumber}</p></div><div><p className="text-sm text-gray-600">Check-in</p><p className="text-lg">{formatDate(selectedGuest.checkInDate)}</p></div><div><p className="text-sm text-gray-600">Check-out</p><p className="text-lg">{formatDate(selectedGuest.checkOutDate)}</p></div><div><p className="text-sm text-gray-600">Status</p><p className="text-lg font-semibold text-green-600">{selectedGuest.status}</p></div></div>)}</ModalBody><ModalFooter><Button variant="flat" onPress={onClose}>Close</Button><Button color="primary" onPress={() => selectedGuest && handleExtendStay(selectedGuest, 1)}>Extend Stay</Button><Button color="danger" variant="flat" onPress={() => selectedGuest && handleEarlyCheckout(selectedGuest)} isLoading={isProcessing}>Early Checkout</Button></ModalFooter></ModalContent></Modal>

      {/* Folio Modal */}
      <Modal isOpen={isFolioModalOpen} onClose={() => setIsFolioModalOpen(false)} size="5xl">
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
              const roomTotal = (selectedFolioGuest.roomRate || 0) * ((selectedFolioGuest.nightsStayed || 0) + 1);
              const serviceCharges = folio.charges?.filter(charge => {
                const desc = charge.description?.toLowerCase() || '';
                const serviceKeywords = ['service', 'swimming', 'laundry', 'pool', 'spa', 'gym', 'restaurant', 'bar', 'room service', 'minibar', 'parking', 'wifi', 'internet', 'breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'drink', 'food', 'meal'];
                return serviceKeywords.some(keyword => desc.includes(keyword));
              }).reduce((sum, charge) => sum + (charge.amount || 0), 0) || 0;
              const otherCharges = folio.charges?.filter(charge => {
                const desc = charge.description?.toLowerCase() || '';
                const serviceKeywords = ['service', 'swimming', 'laundry', 'pool', 'spa', 'gym', 'restaurant', 'bar', 'room service', 'minibar', 'parking', 'wifi', 'internet', 'breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'drink', 'food', 'meal'];
                return !serviceKeywords.some(keyword => desc.includes(keyword));
              }).reduce((sum, charge) => sum + (charge.amount || 0), 0) || 0;
              
              // Calculate total taxes from all charges
              const taxTotal = folio.charges?.reduce((sum, charge) => sum + (charge.tax || 0), 0) || 0;
              
              return (
                <div className="space-y-6">
                  {/* Financial Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardBody className="text-center p-4">
                        <div className="text-3xl font-bold text-blue-600">₵{roomTotal.toLocaleString()}</div>
                        <div className="text-sm text-blue-700 font-medium">Room Charges</div>
                        <div className="text-xs text-blue-600 mt-1">{(selectedFolioGuest.nightsStayed || 0) + 1} nights × ₵{(selectedFolioGuest.roomRate || 0).toLocaleString()}</div>
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
                            <span className="font-semibold text-blue-600">₵{roomTotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Service Charges</span>
                            <span className="font-semibold text-orange-600">₵{serviceCharges.toLocaleString()}</span>
                        </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Other Charges</span>
                            <span className="font-semibold text-purple-600">₵{otherCharges.toLocaleString()}</span>
                        </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">Taxes (VAT + NHIL + Tourism)</span>
                            <span className="font-semibold text-red-600">₵{taxTotal.toLocaleString()}</span>
                        </div>
                          <div className="flex justify-between items-center py-3 bg-gray-50 rounded-lg px-3">
                            <span className="font-bold text-gray-800">Total Charges (Incl. Tax)</span>
                            <span className="font-bold text-lg text-gray-800">₵{(selectedFolioGuest.totalCharges || 0).toLocaleString()}</span>
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
                                  <div className="font-semibold text-gray-800">₵{charge.amount.toLocaleString()}</div>
                                  {charge.tax && (
                                    <div className="text-xs text-gray-500">+₵{charge.tax.toLocaleString()} tax</div>
                                  )}
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
                    <SelectItem key={guest.id} value={guest.id}>
                      {guest.guestName} - Room {guest.roomNumber}
                    </SelectItem>
                  ))}
                </Select>
                
                <Select
                  label="Room Type"
                  placeholder="Select room type first"
                >
                  {frontOfficeStore.roomTypes.map(roomType => (
                    <SelectItem key={roomType.id} value={roomType.id}>
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
                  .filter(room => room.status === 'available')
                  .map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.number} - {room.type}
                    </SelectItem>
                  ))}
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
          <h1 className="text-3xl font-bold text-ghana-black">🔑 Guest Check-In & Check-Ins Management</h1>
          <p className="text-gray-600 mt-2">Process check-ins for reservations and walk-ins, then manage guests during their stay</p>
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
