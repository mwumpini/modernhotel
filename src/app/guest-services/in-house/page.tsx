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
 * - Scheduled refresh every 30 seconds
 * - Automatic filtering and search
 * - Real-time guest count and revenue statistics
 * 
 * OPERATIONS:
 * - View guest details and stay information
 * - Extend guest stays
 * - Process early checkouts
 * - Monitor revenue and occupancy analytics
 */

import React, { useState, useEffect } from 'react';
import PageLayout from '../../components/PageLayout';
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
  Tab
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
}

interface FolioTransaction {
  transactionId: string;
  folioId: string;
  dateTime: string;
  description: string;
  department: string;
  amount: number;
  taxes: number;
  totalAmount: number;
  paymentType?: string; // For payments
  staffId: string;
  roomNumber: string;
  category: 'charge' | 'payment' | 'adjustment';
}

export default function InHousePage() {
  const [guests, setGuests] = useState<InHouseGuest[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<InHouseGuest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedGuest, setSelectedGuest] = useState<InHouseGuest | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadInHouseGuests();
    const unsubscribe = frontOfficeStore.subscribe(loadInHouseGuests);
    
    // Log when the component subscribes to store changes
    console.log('[IN-HOUSE] Component subscribed to frontOfficeStore changes');
    
    return () => {
      unsubscribe();
      console.log('[IN-HOUSE] Component unsubscribed from frontOfficeStore changes');
    };
  }, []);

  // Enhanced real-time synchronization
  useEffect(() => {
    // Set up interval to refresh data every 30 seconds for real-time updates
    const interval = setInterval(() => {
      console.log('[IN-HOUSE] Performing scheduled refresh of in-house guests');
      loadInHouseGuests();
    }, 30000);

    return () => {
      clearInterval(interval);
      console.log('[IN-HOUSE] Scheduled refresh interval cleared');
    };
  }, []);

  useEffect(() => {
    filterGuests();
  }, [guests, searchTerm, statusFilter]);

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
        
        const guestData = {
          id: reservation.id,
          folioId: reservation.id, // Assuming folioId is the same as reservation ID for now
          guestProfileId: reservation.guestProfileId,
          guestName: reservation.guestName,
          roomNumber: reservation.roomId || 'TBD',
          roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Standard',
          roomRate: reservation.rateBreakdown?.[0]?.rate || 0, // Assuming rate is the first day rate
          checkInDate: reservation.arrival,
          checkInDateTime: reservation.arrival,
          checkOutDate: reservation.departure,
          status: 'checked-in' as const,
          nightsStayed: Math.max(0, nightsStayed),
          totalCharges: reservation.rateBreakdown?.reduce((sum, day) => sum + day.total, 0) || 0,
          totalPayments: 0, // Placeholder, will be updated
          outstandingBalance: 0, // Placeholder, will be updated
          phone: reservation.guestPhone,
          email: reservation.guestEmail,
          specialRequests: reservation.remarksToGuest,
          billingPerson: reservation.billingPersonName,
          lastActivity: 'Check-in',
          source: reservation.source,
          staffId: reservation.staffId,
          adults: reservation.adults || 0,
          children: reservation.children || 0,
          paymentMethod: reservation.paymentMethod
        };
        
        console.log(`[IN-HOUSE] Mapped guest: ${guestData.guestName} in room ${guestData.roomNumber}`);
        return guestData;
      });

    console.log(`[IN-HOUSE] Total in-house guests loaded: ${inHouseData.length}`);
    setGuests(inHouseData);
  };

  // Enhanced filtering with real-time updates
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

  // Enhanced early checkout with proper status update
  const handleEarlyCheckout = async (guest: InHouseGuest) => {
    try {
      console.log(`[IN-HOUSE] Processing early checkout for guest: ${guest.guestName}`);
      
      // Use the store method for checkout
      const result = frontOfficeStore.processCheckout(guest.id, 'Early checkout processed from in-house management');
      
      if (result) {
        console.log(`[IN-HOUSE] Guest ${guest.guestName} checked out successfully`);
      } else {
        console.error(`[IN-HOUSE] Failed to process checkout for guest: ${guest.guestName}`);
      }

      onClose();
      setSelectedGuest(null);
    } catch (error) {
      console.error('[IN-HOUSE] Error processing early checkout:', error);
    }
  };

  // Enhanced extend stay with proper date update
  const handleExtendStay = async (guest: InHouseGuest, additionalNights: number) => {
    try {
      console.log(`[IN-HOUSE] Extending stay for guest: ${guest.guestName} by ${additionalNights} nights`);
      
      // Use the store method for extending stay
      const result = frontOfficeStore.extendStay(guest.id, additionalNights);
      
      if (result) {
        console.log(`[IN-HOUSE] Guest ${guest.guestName} stay extended successfully`);
      } else {
        console.error(`[IN-HOUSE] Failed to extend stay for guest: ${guest.guestName}`);
      }

      onClose();
      setSelectedGuest(null);
    } catch (error) {
      console.error('[IN-HOUSE] Error extending stay:', error);
    }
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
    const avgRevenuePerGuest = guests.length > 0 ? totalRevenue / guests.length : 0;
    const avgNightsPerGuest = guests.length > 0 ? guests.reduce((sum, guest) => sum + guest.nightsStayed, 0) / guests.length : 0;
    
    return { totalRevenue, avgRevenuePerGuest, avgNightsPerGuest };
  };

  const revenueStats = getRevenueStats();

  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
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
                    <p className="text-sm font-medium text-gray-600">Avg Revenue/Guest</p>
                    <p className="text-2xl font-bold text-ghana-black">₵{revenueStats.avgRevenuePerGuest.toFixed(0)}</p>
                  </div>
                  <div className="text-2xl">📊</div>
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

          {/* Main Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                {/* Tabs on the extreme left */}
              <Tabs 
                selectedKey={activeTab} 
                onSelectionChange={(key) => setActiveTab(key as string)}
                >
                  <Tab key="overview" title="📊 Overview" />
                  <Tab key="analytics" title="📈 Analytics" />
                </Tabs>
                
                {/* Search and Filter Controls on the extreme right */}
                <div className="flex items-center gap-4">
                      <Input
                        placeholder="Search by guest name, room number, phone, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-80"
                        startContent={<span className="text-gray-400">🔍</span>}
                      />
                      <Select
                        placeholder="Filter by status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-48"
                      >
                        <SelectItem key="all">All Statuses</SelectItem>
                        <SelectItem key="checked-in">Checked In</SelectItem>
                        <SelectItem key="extended">Extended</SelectItem>
                        <SelectItem key="early-checkout">Early Checkout</SelectItem>
                      </Select>
                    </div>
              </div>
            </CardHeader>
            <CardBody>
              {activeTab === 'overview' && (
                <div>
                  {/* Guests Table - Full Width */}
                  <Table aria-label="In-house guests table">
                    <TableHeader>
                      <TableColumn>Unique ID</TableColumn>
                      <TableColumn>Guest Name</TableColumn>
                      <TableColumn>Guest Profile ID</TableColumn>
                      <TableColumn>Phone</TableColumn>
                      <TableColumn>Email</TableColumn>
                      <TableColumn>Room Number</TableColumn>
                      <TableColumn>Room Type</TableColumn>
                      <TableColumn>Room Rate</TableColumn>
                      <TableColumn>Check-in Date</TableColumn>
                      <TableColumn>Check-in Time</TableColumn>
                      <TableColumn>Departure Date</TableColumn>
                      <TableColumn>Departure Time</TableColumn>
                      <TableColumn>Adults</TableColumn>
                      <TableColumn>Children</TableColumn>
                      <TableColumn>Total Charges</TableColumn>
                      <TableColumn>Total Payments</TableColumn>
                      <TableColumn>Outstanding Balance</TableColumn>
                      <TableColumn>Payment Method</TableColumn>
                      <TableColumn>Source</TableColumn>
                      <TableColumn>Staff ID</TableColumn>
                      <TableColumn>Staff Username</TableColumn>
                      <TableColumn>Folio ID</TableColumn>
                      <TableColumn>Status</TableColumn>
                      <TableColumn>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {filteredGuests.map((guest) => (
                        <TableRow key={guest.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-purple-600">{guest.uniqueId}</p>
                              <p className="text-xs text-gray-500">Reservation: {guest.id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar name={guest.guestName} size="sm" />
                              <div>
                                <p className="font-medium">{guest.guestName}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              {guest.guestProfileId ? (
                                <p className="font-medium text-blue-600">{guest.guestProfileId}</p>
                              ) : (
                                <p className="text-sm text-gray-400">Not assigned</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium">{guest.phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium">{guest.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium">{guest.roomNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium">{guest.roomType}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium text-green-600">₵{guest.roomRate}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium">{formatDate(guest.checkInDateTime)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="text-sm text-gray-600">{formatTime(guest.checkInDateTime)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium">{formatDate(guest.checkOutDate)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="text-sm text-gray-600">{formatTime(guest.checkOutDate)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium">{guest.adults}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium">{guest.children}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium text-red-600">₵{guest.totalCharges}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium text-green-600">₵{guest.totalPayments}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium text-orange-600">₵{guest.outstandingBalance}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium">{guest.paymentMethod}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium">{guest.source}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium text-blue-600">{guest.staffId}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <p className="font-medium text-blue-600">{guest.staffUsername}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              {guest.folioId ? (
                                <p className="font-medium text-purple-600">{guest.folioId}</p>
                              ) : (
                                <p className="text-sm text-gray-400">Not assigned</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge color="success" variant="flat">In House</Badge>
                          </TableCell>
                          <TableCell>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button size="sm" variant="flat">
                                  Actions
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu aria-label="Guest actions">
                                <DropdownItem key="view-details">View Details</DropdownItem>
                                <DropdownItem key="extend-1" onClick={() => handleExtendStay(guest, 1)}>
                                  Extend 1 Night
                                </DropdownItem>
                                <DropdownItem key="extend-2" onClick={() => handleExtendStay(guest, 2)}>
                                  Extend 2 Nights
                                </DropdownItem>
                                <DropdownItem key="early-checkout" onClick={() => handleEarlyCheckout(guest)}>
                                  Early Checkout
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                        <h3 className="text-lg font-semibold">Guest Status</h3>
            </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          {Array.from(new Set(guests.map(g => g.status))).map(status => {
                            const count = guests.filter(g => g.status === status).length;
                            return (
                              <div key={status} className="flex justify-between items-center">
                                <span className="text-sm">{getStatusText(status)}</span>
                                <Badge color={getStatusColor(status)} variant="flat">{count}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Guest Management Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="2xl">
          <ModalContent>
            <ModalHeader>Manage Guest</ModalHeader>
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
                      <p className="text-lg">{new Date(selectedGuest.checkInDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date</label>
                      <p className="text-lg">{new Date(selectedGuest.checkOutDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nights Stayed</label>
                      <p className="text-lg">{selectedGuest.nightsStayed}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Revenue</label>
                      <p className="text-lg font-semibold text-green-600">₵{selectedGuest.totalCharges.toLocaleString()}</p>
                    </div>
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
              <Button variant="flat" onClick={onClose}>
                Close
              </Button>
              <Button 
                color="primary" 
                onClick={() => selectedGuest && handleExtendStay(selectedGuest, 1)}
              >
                Extend Stay
              </Button>
              <Button 
                color="danger" 
                variant="flat"
                onClick={() => selectedGuest && handleEarlyCheckout(selectedGuest)}
              >
                Early Checkout
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </PageLayout>
  );
}
