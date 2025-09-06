'use client';

/**
 * Guest Check-In Management Page
 * 
 * This component provides comprehensive check-in processing with enhanced reservation management.
 * It implements the Check-in (Reservation/Guest Table) structure as per the relational database design:
 * 
 * ENHANCED DATA STRUCTURE:
 * - Reservation ID: Unique identifier for the booking
 * - Guest Profile ID: Links to repeat guest information
 * - Room & Rate: Comprehensive room assignment and pricing
 * - Stay Details: Arrival/departure dates, guest count, duration
 * - Payment & Source: Payment methods and booking origin
 * - Folio Integration: Links to central financial tracking
 * 
 * LINKED COMPONENTS:
 * - Reservations: Processes existing confirmed bookings
 * - Walk-ins: Creates new reservations for immediate check-in
 * - In-House: Automatically appears in guest management
 * - Folio System: Initiates financial tracking for the stay
 * 
 * OPERATIONS:
 * - Process reservation check-ins
 * - Handle walk-in guest check-ins
 * - Assign rooms and generate folios
 * - Update guest status and timestamps
 * - Link to guest profiles for repeat visits
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
  Tab,
  Divider
} from "@heroui/react";
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { useSearchParams } from 'next/navigation';

interface CheckInData {
  id: string; // Reservation ID
  uniqueCheckInId: string; // Unique check-in identifier
  guestProfileId?: string; // Guest Profile ID for repeat visits
  guestName: string;
  roomNumber: string;
  roomType: string;
  roomRate: number;
  arrivalDate: string;
  departureDate: string;
  checkInDateTime?: string;
  status: 'pending' | 'checked-in' | 'no-show';
  adults: number;
  children: number;
  paymentMethod?: string;
  specialRequests?: string;
  billingPerson?: string;
  phone?: string;
  email?: string;
  source: string; // Source of booking
  staffId: string; // Front desk agent ID
  staffUsername: string; // Staff username for accountability
  folioId?: string; // Links to folio/transaction table
  createdAt: string; // When the check-in record was created
  updatedAt: string; // When the check-in record was last updated
  processedAt?: string; // When the check-in was actually processed
}

interface WalkInData {
  guestName: string;
  phone: string;
  email?: string;
  roomType: string;
  roomRate: number;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  paymentMethod: string;
  specialRequests?: string;
  source: string;
}

export default function CheckInsPage() {
  const searchParams = useSearchParams();
  const checkInType = searchParams.get('type') || 'reservation';
  const isQuickMode = searchParams.get('quick') === 'true';
  
  // Staff authentication state
  const [currentStaff, setCurrentStaff] = useState({
    id: 'staff-001',
    username: 'john.doe',
    name: 'John Doe',
    role: 'Front Desk Agent'
  });
  
  const [checkIns, setCheckIns] = useState<CheckInData[]>([]);
  const [filteredCheckIns, setFilteredCheckIns] = useState<CheckInData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckInData | null>(null);
  const [selectedTab, setSelectedTab] = useState(checkInType === 'walkin' ? 'walkin' : 'reservations');
  
  // Walk-in form state
  const [walkInForm, setWalkInForm] = useState<WalkInData>({
    guestName: '',
    phone: '',
    email: '',
    roomType: 'Standard',
    roomRate: 0,
    arrivalDate: new Date().toISOString().split('T')[0],
    departureDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    adults: 1,
    children: 0,
    paymentMethod: 'Cash',
    specialRequests: '',
    source: 'walk-in'
  });
  
  // Reservation search state
  const [reservationSearchTerm, setReservationSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadCheckIns();
    const unsubscribe = frontOfficeStore.subscribe(loadCheckIns);
    return unsubscribe;
  }, []);

  useEffect(() => {
    filterCheckIns();
  }, [checkIns, searchTerm, statusFilter]);

  // Reset to first page whenever the filtered list changes size
  useEffect(() => {
    setPage(1);
  }, [filteredCheckIns.length]);

  const loadCheckIns = () => {
    const reservations = frontOfficeStore.reservations;
    const today = new Date().toISOString().split('T')[0];
    
    const checkInsData: CheckInData[] = reservations
      .filter(reservation => 
        reservation.arrival === today && 
        reservation.status === 'confirmed'
      )
      .map(reservation => ({
        id: reservation.id,
        uniqueCheckInId: `checkin-${Date.now()}`, // Generate a unique ID
        guestProfileId: undefined, // Will be added when guest profiles are implemented
        guestName: reservation.guestName,
        roomNumber: reservation.roomId || 'TBD',
        roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Standard',
        roomRate: reservation.rateBreakdown?.[0]?.total || 0,
        arrivalDate: reservation.arrival,
        departureDate: reservation.departure,
        checkInDateTime: undefined, // Will be set when check-in is processed
        status: 'pending' as const,
        adults: reservation.adults || 1,
        children: reservation.children || 0,
        paymentMethod: reservation.paymentMethod || 'Not specified',
        specialRequests: reservation.remarksToGuest,
        billingPerson: reservation.billingPersonName,
        phone: reservation.guestPhone,
        email: reservation.guestEmail,
        source: reservation.source || 'reservation',
        staffId: 'pending', // Will be set when check-in is processed
        staffUsername: 'Pending', // Will be set when check-in is processed
        folioId: reservation.id, // Using reservation ID as folio ID for now
        createdAt: reservation.createdAt || new Date().toISOString(),
        updatedAt: reservation.updatedAt || new Date().toISOString(),
        processedAt: undefined
      }));

    setCheckIns(checkInsData);
  };

  const filterCheckIns = () => {
    let filtered = checkIns;

    if (searchTerm) {
      filtered = filtered.filter(checkIn => 
        checkIn.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checkIn.phone?.includes(searchTerm) ||
        checkIn.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(checkIn => checkIn.status === statusFilter);
    }

    setFilteredCheckIns(filtered);
  };

  const searchReservations = async () => {
    if (!reservationSearchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      console.log(`[CHECK-IN] Searching reservations for: "${reservationSearchTerm}"`);
      
      // Search in reservations store
      const reservations = frontOfficeStore.reservations;
      const results = reservations.filter(reservation => 
        reservation.guestName.toLowerCase().includes(reservationSearchTerm.toLowerCase()) ||
        reservation.guestPhone?.includes(reservationSearchTerm) ||
        reservation.id.includes(reservationSearchTerm)
      );
      
      console.log(`[CHECK-IN] Search results: ${results.length} reservations found`);
      console.log('[CHECK-IN] Search results:', results);
      
      setSearchResults(results);
      trackEvent('FO.Reservation.Updated', { query: reservationSearchTerm, results: results.length });
    } catch (error) {
      console.error('[CHECK-IN] Error searching reservations:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const processWalkInCheckIn = async () => {
    setIsProcessing(true);
    try {
      console.log('[CHECK-IN] Processing walk-in check-in for:', walkInForm.guestName);
      console.log('[CHECK-IN] Walk-in form data:', walkInForm);
      console.log('[CHECK-IN] Processing staff:', currentStaff.username);
      
      // Create a new reservation for walk-in
      const walkInReservation = {
        id: `walkin-${Date.now()}`,
        guestName: walkInForm.guestName,
        guestPhone: walkInForm.phone,
        guestEmail: walkInForm.email,
        roomType: walkInForm.roomType,
        arrival: walkInForm.arrivalDate,
        departure: walkInForm.departureDate,
        adults: walkInForm.adults,
        children: walkInForm.children,
        paymentMethod: walkInForm.paymentMethod,
        specialRequests: walkInForm.specialRequests,
        status: 'checked-in' as const,
        source: 'walk-in',
        createdAt: new Date().toISOString()
      };

      console.log('[CHECK-IN] Created walk-in reservation object:', walkInReservation);

      // Add to store and process check-in
      const addedReservation = frontOfficeStore.addReservation(walkInReservation);
      console.log('[CHECK-IN] Reservation added to store:', addedReservation);
      
      // Update the check-in record with staff information and timestamps
      const checkInRecord = checkIns.find(ci => ci.id === addedReservation.id);
      if (checkInRecord) {
        checkInRecord.staffId = currentStaff.id;
        checkInRecord.staffUsername = currentStaff.username;
        checkInRecord.processedAt = new Date().toISOString();
        checkInRecord.updatedAt = new Date().toISOString();
        console.log('[CHECK-IN] Check-in record updated with staff info:', checkInRecord);
      }
      
      trackEvent('FO.Reservation.CheckedIn', { 
        guestName: walkInForm.guestName,
        roomType: walkInForm.roomType,
        duration: Math.ceil((new Date(walkInForm.departureDate).getTime() - new Date(walkInForm.arrivalDate).getTime()) / (1000 * 60 * 60 * 24)),
        staffId: currentStaff.id,
        staffUsername: currentStaff.username,
        timestamp: new Date().toISOString()
      });

      // Reset form
      setWalkInForm({
        guestName: '',
        phone: '',
        email: '',
        roomType: 'Standard',
        roomRate: 0,
        arrivalDate: new Date().toISOString().split('T')[0],
        departureDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        adults: 1,
        children: 0,
        paymentMethod: 'Cash',
        specialRequests: '',
        source: 'walk-in'
      });

      console.log('[CHECK-IN] Walk-in check-in completed successfully');
      alert('Walk-in check-in completed successfully!');
    } catch (error) {
      console.error('[CHECK-IN] Error processing walk-in check-in:', error);
      alert('Error processing check-in. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processReservationCheckIn = async (reservation: any) => {
    setIsProcessing(true);
    try {
      console.log('[CHECK-IN] Processing reservation check-in for:', reservation.guestName);
      console.log('[CHECK-IN] Reservation details:', reservation);
      console.log('[CHECK-IN] Processing staff:', currentStaff.username);
      
      // Update reservation status to checked-in
      const updatedReservation = frontOfficeStore.updateReservationStatus(reservation.id, 'checked-in');
      console.log('[CHECK-IN] Reservation status updated:', updatedReservation);
      
      // Update the check-in record with staff information and timestamps
      const checkInRecord = checkIns.find(ci => ci.id === reservation.id);
      if (checkInRecord) {
        checkInRecord.staffId = currentStaff.id;
        checkInRecord.staffUsername = currentStaff.username;
        checkInRecord.processedAt = new Date().toISOString();
        checkInRecord.updatedAt = new Date().toISOString();
        console.log('[CHECK-IN] Check-in record updated with staff info:', checkInRecord);
      }
      
      trackEvent('FO.Reservation.CheckedIn', { 
        reservationId: reservation.id,
        guestName: reservation.guestName,
        roomType: reservation.roomType,
        staffId: currentStaff.id,
        staffUsername: currentStaff.username,
        timestamp: new Date().toISOString()
      });

      console.log('[CHECK-IN] Reservation check-in completed successfully');
      alert('Check-in completed successfully!');
      onClose();
    } catch (error) {
      console.error('[CHECK-IN] Error processing check-in:', error);
      alert('Error processing check-in. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper functions for date/time formatting
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Analytics-friendly data attributes
  const getAnalyticsData = (checkIn: CheckInData) => ({
    'data-checkin-id': checkIn.uniqueCheckInId,
    'data-reservation-id': checkIn.id,
    'data-staff-id': checkIn.staffId,
    'data-staff-username': checkIn.staffUsername,
    'data-created-date': checkIn.createdAt,
    'data-processed-date': checkIn.processedAt,
    'data-status': checkIn.status,
    'data-room-type': checkIn.roomType,
    'data-source': checkIn.source
  });

  return (
    <PageLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-ghana-black">
              {checkInType === 'walkin' ? '🚶‍♂️ Walk-In Check-In' : '🔑 Guest Check-In'}
            </h1>
            <p className="text-gray-600 mt-2">
              {checkInType === 'walkin' 
                ? 'Check in guests without prior reservations' 
                : 'Process check-ins for existing reservations or walk-ins'
              }
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Staff Authentication Display */}
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Logged in as:</p>
              <p className="font-semibold text-ghana-black">{currentStaff.name}</p>
              <p className="text-xs text-gray-500">{currentStaff.role} • {currentStaff.username}</p>
            </div>
            <Button
              color="primary"
              variant="flat"
              onClick={() => window.history.back()}
            >
              ← Back
            </Button>
          </div>
        </div>

        <Tabs 
          selectedKey={selectedTab} 
          onSelectionChange={(key) => setSelectedTab(key as string)}
          className="w-full"
        >
          <Tab key="reservations" title="📅 Existing Reservations">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-xl font-semibold text-ghana-black">Search & Process Reservations</h3>
              </CardHeader>
              <CardBody>
                {/* Search Bar */}
                <div className="flex gap-4 mb-6">
                  <Input
                    placeholder="Search by guest name, phone, or confirmation number..."
                    value={reservationSearchTerm}
                    onChange={(e) => setReservationSearchTerm(e.target.value)}
                    className="flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && searchReservations()}
                  />
                  <Button
                    color="primary"
                    onClick={searchReservations}
                    isLoading={isSearching}
                  >
                    🔍 Search
                  </Button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold mb-3">Search Results</h4>
                    <div className="space-y-3">
                      {searchResults.map((reservation) => (
                        <Card key={reservation.id} className="border border-gray-200">
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <Avatar name={reservation.guestName} size="md" />
                  <div>
                                  <h5 className="font-semibold">{reservation.guestName}</h5>
                                  <p className="text-sm text-gray-600">
                                    {reservation.guestPhone} • {reservation.guestEmail}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {reservation.roomType} • {reservation.arrival} to {reservation.departure}
                    </p>
                  </div>
                </div>
                              <div className="flex items-center space-x-2">
                                <Badge color="success" variant="flat">Confirmed</Badge>
                                <Button
                                  size="sm"
                                  color="primary"
                                  onClick={() => processReservationCheckIn(reservation)}
                                  isLoading={isProcessing}
                                >
                                  ✅ Check In
                                </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
                      ))}
          </div>
              </div>
                )}

                {/* Today's Check-ins */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Today's Pending Check-ins</h4>
                  <Table aria-label="Pending check-ins table">
                    <TableHeader>
                      <TableColumn>Unique ID</TableColumn>
                      <TableColumn>Guest Name</TableColumn>
                      <TableColumn>Contact</TableColumn>
                      <TableColumn>Room</TableColumn>
                      <TableColumn>Rate</TableColumn>
                      <TableColumn>Stay Details</TableColumn>
                      <TableColumn>Payment & Source</TableColumn>
                      <TableColumn>Staff ID</TableColumn>
                      <TableColumn>Staff Username</TableColumn>
                      <TableColumn>Created Date</TableColumn>
                      <TableColumn>Created Time</TableColumn>
                      <TableColumn>Updated Date</TableColumn>
                      <TableColumn>Updated Time</TableColumn>
                      <TableColumn>Processed Date</TableColumn>
                      <TableColumn>Processed Time</TableColumn>
                      <TableColumn>Status</TableColumn>
                      <TableColumn>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                          {filteredCheckIns.map((checkIn) => (
                            <TableRow 
                              key={checkIn.id}
                              {...getAnalyticsData(checkIn)}
                            >
                              <TableCell>
                                <div>
                                  <p className="font-medium text-purple-600">{checkIn.uniqueCheckInId}</p>
                                  <p className="text-xs text-gray-500">Reservation: {checkIn.id}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-3">
                                  <Avatar name={checkIn.guestName} size="sm" />
                                  <div>
                                    <p className="font-medium">{checkIn.guestName}</p>
                                    {checkIn.guestProfileId && (
                                      <p className="text-xs text-blue-600">Profile: {checkIn.guestProfileId}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{checkIn.phone}</p>
                                  <p className="text-sm text-gray-600">{checkIn.email}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{checkIn.roomNumber}</p>
                                  <p className="text-sm text-gray-600">{checkIn.roomType}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-green-600">₵{checkIn.roomRate}</p>
                                  <p className="text-sm text-gray-600">per night</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{formatDate(checkIn.arrivalDate)} to {formatDate(checkIn.departureDate)}</p>
                                  <p className="text-sm text-gray-600">{checkIn.adults} adults, {checkIn.children} children</p>
                                  {checkIn.checkInDateTime && (
                                    <p className="text-xs text-blue-600">Checked in: {formatDate(checkIn.checkInDateTime)}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{checkIn.paymentMethod || 'Not specified'}</p>
                                  <p className="text-sm text-gray-600">Source: {checkIn.source}</p>
                                  {checkIn.folioId && (
                                    <p className="text-xs text-purple-600">Folio: {checkIn.folioId}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-center">
                                  <p className="font-medium text-blue-600">{checkIn.staffId}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-center">
                                  <p className="font-medium text-blue-600">{checkIn.staffUsername}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-center">
                                  <p className="font-medium">{formatDate(checkIn.createdAt)}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">{formatTime(checkIn.createdAt)}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-center">
                                  <p className="font-medium">{formatDate(checkIn.updatedAt)}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">{formatTime(checkIn.updatedAt)}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-center">
                                  {checkIn.processedAt ? (
                                    <p className="font-medium text-green-600">{formatDate(checkIn.processedAt)}</p>
                                  ) : (
                                    <p className="text-sm text-gray-400">Not processed</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-center">
                                  {checkIn.processedAt ? (
                                    <p className="text-sm text-green-600">{formatTime(checkIn.processedAt)}</p>
                                  ) : (
                                    <p className="text-sm text-gray-400">-</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge color="warning" variant="flat">Pending</Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  color="primary"
                                  onClick={() => {
                                    setSelectedCheckIn(checkIn);
                                    onOpen();
                                  }}
                                >
                                  Process
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                  </Table>
                </div>
            </CardBody>
          </Card>
          </Tab>

          <Tab key="walkin" title="🚶‍♂️ Walk-In Check-In">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-xl font-semibold text-ghana-black">Walk-In Guest Check-In</h3>
                <p className="text-gray-600">Check in guests without prior reservations</p>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Guest Information */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Guest Information</h4>
                    
                    <Input
                      label="Full Name *"
                      placeholder="Enter guest's full name"
                      value={walkInForm.guestName}
                      onChange={(e) => setWalkInForm({...walkInForm, guestName: e.target.value})}
                      isRequired
                    />
                    
                    <Input
                      label="Phone Number *"
                      placeholder="Enter phone number"
                      value={walkInForm.phone}
                      onChange={(e) => setWalkInForm({...walkInForm, phone: e.target.value})}
                      isRequired
                    />
                    
                    <Input
                      label="Email (Optional)"
                      placeholder="Enter email address"
                      value={walkInForm.email}
                      onChange={(e) => setWalkInForm({...walkInForm, email: e.target.value})}
                      type="email"
                    />
                  </div>

                  {/* Stay Details */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Stay Details</h4>
                    
                    <Select
                      label="Room Type"
                      placeholder="Select room type"
                      value={walkInForm.roomType}
                      onChange={(e) => setWalkInForm({...walkInForm, roomType: e.target.value})}
                    >
                      <SelectItem key="Standard">Standard Room</SelectItem>
                      <SelectItem key="Deluxe">Deluxe Room</SelectItem>
                      <SelectItem key="Suite">Suite</SelectItem>
                      <SelectItem key="Executive">Executive Room</SelectItem>
                    </Select>
                    
                    <Input
                      label="Arrival Date"
                      type="date"
                      value={walkInForm.arrivalDate}
                      onChange={(e) => setWalkInForm({...walkInForm, arrivalDate: e.target.value})}
                    />
                    
                    <Input
                      label="Departure Date"
                      type="date"
                      value={walkInForm.departureDate}
                      onChange={(e) => setWalkInForm({...walkInForm, departureDate: e.target.value})}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Adults"
                        type="number"
                        min="1"
                        value={walkInForm.adults.toString()}
                        onChange={(e) => setWalkInForm({...walkInForm, adults: parseInt(e.target.value)})}
                      />
                      <Input
                        label="Children"
                        type="number"
                        min="0"
                        value={walkInForm.children.toString()}
                        onChange={(e) => setWalkInForm({...walkInForm, children: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <Divider className="my-6" />

                {/* Special Requests */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">Special Requests</h4>
                  <Input
                    label="Special Requests (Optional)"
                    placeholder="Any special requests or notes..."
                    value={walkInForm.specialRequests}
                    onChange={(e) => setWalkInForm({...walkInForm, specialRequests: e.target.value})}
                  />
        </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 mt-6">
                  <Button
                    variant="flat"
                    onClick={() => setSelectedTab('reservations')}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    onClick={processWalkInCheckIn}
                    isLoading={isProcessing}
                    isDisabled={!walkInForm.guestName || !walkInForm.phone}
                  >
                    ✅ Complete Check-In
                  </Button>
                </div>
              </CardBody>
            </Card>
          </Tab>
        </Tabs>

        {/* Check-in Processing Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="2xl">
          <ModalContent>
            <ModalHeader>Process Check-In</ModalHeader>
            <ModalBody>
              {selectedCheckIn && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Avatar name={selectedCheckIn.guestName} size="lg" />
                    <div>
                      <h3 className="text-xl font-semibold">{selectedCheckIn.guestName}</h3>
                      <p className="text-gray-600">{selectedCheckIn.phone}</p>
                      <p className="text-gray-600">{selectedCheckIn.email}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Room</p>
                      <p className="font-medium">{selectedCheckIn.roomNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Room Type</p>
                      <p className="font-medium">{selectedCheckIn.roomType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Arrival</p>
                      <p className="font-medium">{selectedCheckIn.arrivalDate}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Departure</p>
                      <p className="font-medium">{selectedCheckIn.departureDate}</p>
                    </div>
                  </div>
                  
                  {selectedCheckIn.specialRequests && (
                    <div>
                      <p className="text-sm text-gray-600">Special Requests</p>
                      <p className="font-medium">{selectedCheckIn.specialRequests}</p>
                    </div>
                  )}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                color="primary" 
                onClick={() => selectedCheckIn && processReservationCheckIn(selectedCheckIn)}
                isLoading={isProcessing}
              >
                ✅ Complete Check-In
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </PageLayout>
  );
}
