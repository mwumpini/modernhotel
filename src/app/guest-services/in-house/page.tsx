'use client';

/**
 * In-House Guests Management Page
 * 
 * This component provides real-time management of currently checked-in guests.
 * It automatically synchronizes with the check-in and check-out systems:
 * 
 * LINKED COMPONENTS:
 * - Check-ins: When guests check in, they automatically appear in this table
 * - Check-outs: When guests check out, they are automatically removed
 * - Reservations: Real-time updates from reservation status changes
 * 
 * REACTIVE FEATURES:
 * - Store subscription for immediate updates
 * - Enhanced folio calculations with credit support
 * - Automatic filtering and search
 * - Real-time guest count and revenue statistics
 * 
 * OPERATIONS:
 * - View guest details and stay information
 * - Extend guest stays
 * - Process early checkouts
 * - Monitor revenue and occupancy analytics
 * - Apply credit payments
 */

import React, { useState, useEffect } from 'react';
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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip,
  Avatar,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tabs,
  Tab,
  Divider
} from "@heroui/react";
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { trackEvent } from '../../lib/analytics/trackEvent';

interface InHouseGuest {
  id: string; // Reservation ID
  folioId: string; // Unique folio identifier
  guestProfileId?: string; // Guest Profile ID for repeat visits
  guestName: string;
  roomNumber: string;
  roomType: string;
  roomRate: number;
  checkInDate: string;
  checkInDateTime: string;
  checkOutDate: string;
  status: 'checked-in' | 'extended' | 'early-checkout';
  nightsStayed: number;
  totalCharges: number; // Total charges posted to folio
  totalPayments: number; // Total payments received
  outstandingBalance: number; // Balance due
  phone?: string;
  email?: string;
  specialRequests?: string;
  billingPerson?: string;
  lastActivity?: string;
  source: string; // Source of booking
  staffId?: string; // Front desk agent ID
  adults: number;
  children: number;
  paymentMethod?: string;
  creditBalance?: number; // Available credit balance
}

export default function InHousePage() {
  const [guests, setGuests] = useState<InHouseGuest[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<InHouseGuest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [selectedGuest, setSelectedGuest] = useState<InHouseGuest | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [activeTab, setActiveTab] = useState('overview');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadInHouseGuests();
    const unsubscribe = frontOfficeStore.subscribe(loadInHouseGuests);
    
    console.log('[IN-HOUSE] Component subscribed to frontOfficeStore changes');
    
    return () => {
      unsubscribe();
      console.log('[IN-HOUSE] Component unsubscribed from frontOfficeStore changes');
    };
  }, []);

  useEffect(() => {
    filterGuests();
  }, [guests, searchTerm, statusFilter]);

  // Reset to first page whenever the filtered list changes size
  useEffect(() => {
    setPage(1);
  }, [filteredGuests.length]);

  const loadInHouseGuests = () => {
    const reservations = frontOfficeStore.reservations;
    const today = new Date();
    
    console.log('[IN-HOUSE] Loading in-house guests from reservations:', reservations.length);
    
    const inHouseData: InHouseGuest[] = reservations
      .filter(reservation => {
        const isCheckedIn = reservation.status === 'checked-in';
        const hasValidDates = new Date(reservation.departure) >= today;
        const hasRoomAssigned = reservation.roomId && reservation.roomId !== 'TBD';
        
        console.log(`[IN-HOUSE] Reservation ${reservation.id}: status=${reservation.status}, departure=${reservation.departure}, roomId=${reservation.roomId}, isCheckedIn=${isCheckedIn}, hasValidDates=${hasValidDates}, hasRoomAssigned=${hasRoomAssigned}`);
        
        return isCheckedIn && hasValidDates && hasRoomAssigned;
      })
      .map(reservation => {
        const checkInDate = new Date(reservation.arrival);
        const checkOutDate = new Date(reservation.departure);
        const nightsStayed = Math.ceil((today.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Get folio with enhanced calculations
        const folio = frontOfficeStore.getOrCreateFolio(reservation.id);
        frontOfficeStore.updateFolioBalances(folio);
        
        // Get guest credit balance
        const guest = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
        const creditBalance = guest?.creditBalance || 0;
        
        const guestData: InHouseGuest = {
          id: reservation.id,
          folioId: folio.id,
          guestProfileId: reservation.guestId,
          guestName: reservation.guestName,
          roomNumber: reservation.roomId || 'TBD',
          roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Standard',
          roomRate: reservation.rateBreakdown?.[0]?.base || 0,
          checkInDate: reservation.arrival,
          checkInDateTime: reservation.arrival,
          checkOutDate: reservation.departure,
          status: 'checked-in' as const,
          nightsStayed: Math.max(0, nightsStayed),
          totalCharges: folio.totalCharges || 0,
          totalPayments: folio.totalPayments || 0,
          outstandingBalance: folio.balance || 0,
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
          creditBalance
        };
        
        console.log(`[IN-HOUSE] Mapped guest: ${guestData.guestName} in room ${guestData.roomNumber}, balance: ₵${guestData.outstandingBalance}`);
        return guestData;
      });

    console.log(`[IN-HOUSE] Total in-house guests loaded: ${inHouseData.length}`);
    setGuests(inHouseData);
  };

  const filterGuests = () => {
    let filtered = guests;

    if (searchTerm) {
      filtered = filtered.filter(guest => 
        guest.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guest.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guest.phone?.includes(searchTerm) ||
        guest.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(guest => guest.status === statusFilter);
    }

    console.log(`[IN-HOUSE] Filtered guests: ${filtered.length} out of ${guests.length} total`);
    setFilteredGuests(filtered);
  };

  const handleEarlyCheckout = async (guest: InHouseGuest) => {
    setIsProcessing(true);
    try {
      console.log(`[IN-HOUSE] Processing early checkout for guest: ${guest.guestName}`);
      
      // Use the store method for checkout
      frontOfficeStore.processCheckout(guest.id, 'Early checkout processed from in-house management');
      
      trackEvent('FO.Reservation.CheckedOut', {
        reservationId: guest.id,
        guestName: guest.guestName,
        roomNumber: guest.roomNumber,
        source: 'in-house-management'
      });

      onClose();
      setSelectedGuest(null);
    } catch (error) {
      console.error('[IN-HOUSE] Error processing early checkout:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtendStay = async (guest: InHouseGuest, additionalNights: number) => {
    try {
      console.log(`[IN-HOUSE] Extending stay for guest: ${guest.guestName} by ${additionalNights} nights`);
      
      const updatedReservation = frontOfficeStore.reservations.find(r => r.id === guest.id);
      if (updatedReservation) {
        const currentDeparture = new Date(updatedReservation.departure);
        currentDeparture.setDate(currentDeparture.getDate() + additionalNights);
        updatedReservation.departure = currentDeparture.toISOString();
        updatedReservation.status = 'checked-in';
        frontOfficeStore.notify();
      }

      trackEvent('FO.Reservation.Updated', {
        reservationId: guest.id,
        guestName: guest.guestName,
        additionalNights,
        source: 'in-house-management'
      });

      onClose();
      setSelectedGuest(null);
    } catch (error) {
      console.error('[IN-HOUSE] Error extending stay:', error);
    }
  };

  const handleApplyCredit = (guest: InHouseGuest) => {
    if (!guest.creditBalance || guest.creditBalance <= 0) return;
    
    const amount = Math.min(guest.creditBalance, guest.outstandingBalance);
    const success = frontOfficeStore.applyCreditPayment(guest.id, amount, 'Credit applied from in-house management');
    
    if (success) {
      trackEvent('FO.Guest.Updated', {
        reservationId: guest.id,
        guestName: guest.guestName,
        amount,
        source: 'in-house-management'
      });
      
      // Refresh the data
      setTimeout(() => loadInHouseGuests(), 100);
    }
  };

  // Payment reminder and credit monitoring (dummy flows with logs)
  const handleSendPaymentReminder = (guest: InHouseGuest, channel: 'sms'|'email'|'call') => {
    const payload = {
      reservationId: guest.id,
      guestName: guest.guestName,
      roomNumber: guest.roomNumber,
      balance: guest.outstandingBalance,
      creditBalance: guest.creditBalance || 0,
      channel,
      timestamp: new Date().toISOString()
    };
    console.log('[IN-HOUSE] Payment reminder sent', payload);
    trackEvent('Analytics.ActionClicked', { action: 'PaymentReminderSent', ...payload });
    alert(`Reminder queued via ${channel.toUpperCase()} for ${guest.guestName}.`);
  };

  const handleCreditReview = (guest: InHouseGuest) => {
    const payload = {
      reservationId: guest.id,
      guestName: guest.guestName,
      roomNumber: guest.roomNumber,
      balance: guest.outstandingBalance,
      creditBalance: guest.creditBalance || 0,
      note: 'Credit review started',
      timestamp: new Date().toISOString()
    };
    console.log('[IN-HOUSE] Credit review initiated', payload);
    trackEvent('Analytics.ActionClicked', { ...payload, action: 'CreditReviewInitiated' });
    alert('Credit review placeholder opened.');
  };

  const openGuestModal = (guest: InHouseGuest) => {
    setSelectedGuest(guest);
    onOpen();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked-in': return 'success';
      case 'extended': return 'primary';
      case 'early-checkout': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'checked-in': return 'Checked In';
      case 'extended': return 'Extended';
      case 'early-checkout': return 'Early Checkout';
      default: return status;
    }
  };

  const getRevenueStats = () => {
    const totalRevenue = guests.reduce((sum, guest) => sum + guest.totalCharges, 0);
    const totalPayments = guests.reduce((sum, guest) => sum + guest.totalPayments, 0);
    const totalOutstanding = guests.reduce((sum, guest) => sum + guest.outstandingBalance, 0);
    const avgRevenuePerGuest = guests.length > 0 ? totalRevenue / guests.length : 0;
    const avgNightsPerGuest = guests.length > 0 ? guests.reduce((sum, guest) => sum + guest.nightsStayed, 0) / guests.length : 0;
    
    return { totalRevenue, totalPayments, totalOutstanding, avgRevenuePerGuest, avgNightsPerGuest };
  };

  const revenueStats = getRevenueStats();

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="pt-2">
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🏠 In-House Guests</h1>
          <p className="text-gray-600">Manage current guests and their stay experience</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-lg">
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Guests</p>
                  <p className="text-2xl font-bold text-ghana-black">{guests.length}</p>
                </div>
                <div className="text-2xl">👥</div>
              </div>
            </CardBody>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-ghana-black">₵{revenueStats.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="text-2xl">💰</div>
              </div>
            </CardBody>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Outstanding</p>
                  <p className="text-2xl font-bold text-orange-600">₵{revenueStats.totalOutstanding.toLocaleString()}</p>
                </div>
                <div className="text-2xl">⏰</div>
              </div>
            </CardBody>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Nights</p>
                  <p className="text-2xl font-bold text-ghana-black">{revenueStats.avgNightsPerGuest.toFixed(1)}</p>
                </div>
                <div className="text-2xl">🌙</div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Search and Filter Controls */}
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
                <SelectItem key="checked-in">Checked In</SelectItem>
                <SelectItem key="extended">Extended</SelectItem>
                <SelectItem key="early-checkout">Early Checkout</SelectItem>
              </Select>
            </div>
          </CardBody>
        </Card>

        {/* Main Content */}
        <Card>
          <CardBody>
            <Tabs 
              selectedKey={activeTab} 
              onSelectionChange={(key) => setActiveTab(key as string)}
              className="mb-4"
            >
              <Tab key="overview" title="📊 Overview" />
              <Tab key="analytics" title="📈 Analytics" />
            </Tabs>

            {activeTab === 'overview' && (
              <div>
                {/* Simplified single-element columns for clarity */}
                <Table aria-label="In-house guests table" className="min-w-full">
                  <TableHeader>
                    <TableColumn className="w-40">GUEST</TableColumn>
                    <TableColumn className="w-20">ROOM</TableColumn>
                    <TableColumn className="w-28">ROOM TYPE</TableColumn>
                    <TableColumn className="w-20">ADULTS</TableColumn>
                    <TableColumn className="w-20">CHILDREN</TableColumn>
                    <TableColumn className="w-28">ARRIVAL</TableColumn>
                    <TableColumn className="w-28">DEPARTURE</TableColumn>
                    <TableColumn className="w-20">NIGHTS</TableColumn>
                    <TableColumn className="w-28">RATE</TableColumn>
                    <TableColumn className="w-28">CHARGES</TableColumn>
                    <TableColumn className="w-28">PAYMENTS</TableColumn>
                    <TableColumn className="w-28">BALANCE</TableColumn>
                    <TableColumn className="w-28">CREDIT</TableColumn>
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
                        <TableCell className="font-semibold text-center">{guest.roomNumber}</TableCell>
                        <TableCell className="text-center">{guest.roomType}</TableCell>
                        <TableCell className="text-center">{guest.adults}</TableCell>
                        <TableCell className="text-center">{guest.children}</TableCell>
                        <TableCell className="text-center">{formatDate(guest.checkInDate)}</TableCell>
                        <TableCell className="text-center">{formatDate(guest.checkOutDate)}</TableCell>
                        <TableCell className="text-center">{guest.nightsStayed}</TableCell>
                        <TableCell className="text-center">₵{guest.roomRate.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-semibold">₵{guest.totalCharges.toLocaleString()}</TableCell>
                        <TableCell className="text-center text-green-600 font-semibold">₵{guest.totalPayments.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <span className={guest.outstandingBalance > 0 ? 'text-orange-600 font-semibold' : 'text-green-700 font-semibold'}>
                            ₵{guest.outstandingBalance.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                            {guest.creditBalance && guest.creditBalance > 0 ? (
                            <div className="space-y-1">
                                <p className="font-semibold text-blue-600">₵{guest.creditBalance.toLocaleString()}</p>
                                {guest.outstandingBalance > 0 && (
                                <Button size="sm" color="success" variant="flat" onClick={() => handleApplyCredit(guest)}>Apply</Button>
                                )}
                              </div>
                            ) : (
                            <span className="text-gray-400">0</span>
                            )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge color={getStatusColor(guest.status)} variant="flat" className="font-medium">
                              {getStatusText(guest.status)}
                            </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" color="primary" variant="flat" onClick={() => openGuestModal(guest)}>Manage</Button>
                            <Button size="sm" color="success" variant="flat" onClick={() => handleExtendStay(guest, 1)}>+1</Button>
                            <Button size="sm" color="warning" variant="flat" onClick={() => handleEarlyCheckout(guest)}>Out</Button>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button size="sm" variant="flat">More</Button>
                              </DropdownTrigger>
                              <DropdownMenu aria-label="More in-house actions">
                                <DropdownItem key="reminder-sms" onClick={() => handleSendPaymentReminder(guest, 'sms')}>
                                  📲 Send SMS Reminder
                                </DropdownItem>
                                <DropdownItem key="reminder-email" onClick={() => handleSendPaymentReminder(guest, 'email')}>
                                  ✉️ Send Email Reminder
                                </DropdownItem>
                                <DropdownItem key="reminder-call" onClick={() => handleSendPaymentReminder(guest, 'call')}>
                                  📞 Log Call Reminder
                                </DropdownItem>
                                <DropdownItem key="credit-review" onClick={() => handleCreditReview(guest)}>
                                  🧾 Start Credit Review
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="flex justify-end mt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Showing {((page - 1) * rowsPerPage) + 1} to {Math.min(page * rowsPerPage, filteredGuests.length)} of {filteredGuests.length} guests
                    </span>
                  </div>
                </div>
              </div>
            )}
                
            {activeTab === 'analytics' && (
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Revenue Distribution</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        {guests.map(guest => (
                          <div key={guest.id} className="flex justify-between items-center">
                            <span className="text-sm">{guest.guestName}</span>
                            <span className="font-medium">₵{guest.totalCharges.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Stay Duration</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        {guests.map(guest => (
                          <div key={guest.id} className="flex justify-between items-center">
                            <span className="text-sm">{guest.guestName}</span>
                            <span className="font-medium">{guest.nightsStayed + 1} nights</span>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                </div>
                
                {/* Additional Analytics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Room Type Distribution</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        {Array.from(new Set(guests.map(g => g.roomType))).map(roomType => {
                          const count = guests.filter(g => g.roomType === roomType).length;
                          return (
                            <div key={roomType} className="flex justify-between items-center">
                              <span className="text-sm">{roomType}</span>
                              <Badge color="primary" variant="flat">{count}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Revenue by Room Type</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        {Array.from(new Set(guests.map(g => g.roomType))).map(roomType => {
                          const revenue = guests
                            .filter(g => g.roomType === roomType)
                            .reduce((sum, g) => sum + g.totalCharges, 0);
                          return (
                            <div key={roomType} className="flex justify-between items-center">
                              <span className="text-sm">{roomType}</span>
                              <span className="font-medium">₵{revenue.toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">Credit Status</h3>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Guests with Credit</span>
                          <Badge color="success" variant="flat">
                            {guests.filter(g => (g.creditBalance || 0) > 0).length}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Total Credit Available</span>
                          <span className="font-medium text-blue-600">
                            ₵{guests.reduce((sum, g) => sum + (g.creditBalance || 0), 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Guest Management Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="2xl">
          <ModalContent>
            <ModalHeader>Manage Guest - {selectedGuest?.guestName}</ModalHeader>
            <ModalBody>
              {selectedGuest && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                      <p className="text-lg font-semibold">{selectedGuest.guestName}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                      <p className="text-lg font-semibold">{selectedGuest.roomNumber}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                      <p className="text-lg">{formatDate(selectedGuest.checkInDate)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date</label>
                      <p className="text-lg">{formatDate(selectedGuest.checkOutDate)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nights Stayed</label>
                      <p className="text-lg">{selectedGuest.nightsStayed}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Charges</label>
                      <p className="text-lg font-semibold text-green-600">₵{selectedGuest.totalCharges.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Payments</label>
                      <p className="text-lg font-semibold text-blue-600">₵{selectedGuest.totalPayments.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Outstanding Balance</label>
                      <p className="text-lg font-semibold text-orange-600">₵{selectedGuest.outstandingBalance.toLocaleString()}</p>
                    </div>
                    {selectedGuest.creditBalance && selectedGuest.creditBalance > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Available Credit</label>
                        <p className="text-lg font-semibold text-blue-600">₵{selectedGuest.creditBalance.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                  
                  {selectedGuest.specialRequests && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
                      <p className="text-gray-600">{selectedGuest.specialRequests}</p>
                    </div>
                  )}
                  
                  {selectedGuest.billingPerson && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Billing Person</label>
                      <p className="text-gray-600">{selectedGuest.billingPerson}</p>
                    </div>
                  )}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose}>
                Close
              </Button>
              {selectedGuest && selectedGuest.creditBalance && selectedGuest.creditBalance > 0 && selectedGuest.outstandingBalance > 0 && (
                <Button 
                  color="success" 
                  variant="flat"
                  onPress={() => {
                    handleApplyCredit(selectedGuest);
                    onClose();
                  }}
                >
                  Apply Credit (₵{Math.min(selectedGuest.creditBalance, selectedGuest.outstandingBalance).toFixed(2)})
                </Button>
              )}
              <Button 
                color="primary" 
                onPress={() => selectedGuest && handleExtendStay(selectedGuest, 1)}
              >
                Extend Stay
              </Button>
              <Button 
                color="danger" 
                variant="flat"
                onPress={() => selectedGuest && handleEarlyCheckout(selectedGuest)}
                isLoading={isProcessing}
              >
                Early Checkout
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
