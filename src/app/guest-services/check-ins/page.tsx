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

import React, { useState, useEffect, Suspense } from 'react';
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
  Pagination,
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
import dynamic from 'next/dynamic';
// Embed existing pages via dynamic import to avoid module resolution issues
const CheckOutsPage = dynamic(() => import('../check-outs/page'), { ssr: false });
const InvoicesPaymentsPage = dynamic(() => import('../client-services/invoices-payments/page'), { ssr: false });

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

function CheckInsPageContent() {
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
  // Pagination states per table
  const [page, setPage] = useState(1); // pending check-ins
  const [inhousePage, setInhousePage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckInData | null>(null);
  const [selectedTab, setSelectedTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'inhouse') return 'inhouse';
    if (tabParam === 'walkin') return 'walkin';
    if (tabParam === 'checkouts') return 'checkouts';
    if (tabParam === 'billing') return 'billing';
    return checkInType === 'walkin' ? 'walkin' : 'reservations';
  });
  
  // Room assignment state
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Room transfer state
  const [selectedGuestForTransfer, setSelectedGuestForTransfer] = useState<string>('');
  const [selectedNewRoom, setSelectedNewRoom] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  
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
    loadAvailableRooms();
    const unsubscribe = frontOfficeStore.subscribe(loadCheckIns);
    return unsubscribe;
  }, []);

  useEffect(() => {
    filterCheckIns();
  }, [checkIns, searchTerm, statusFilter]);

  // Reset to first page whenever the filtered list changes size
  useEffect(() => { setPage(1); }, [filteredCheckIns.length]);
  useEffect(() => { setInhousePage(1); }, [checkIns.filter(ci => ci.status === 'checked-in').length]);

  const loadCheckIns = () => {
    // Prevent build-time errors by checking if we're in browser
    if (typeof window === 'undefined') return;
    
    const reservations = frontOfficeStore.reservations;
    const today = new Date().toISOString().split('T')[0];
    
    const checkInsData: CheckInData[] = reservations
      .filter(reservation => {
        // Include confirmed reservations for today (pending check-ins)
        const isTodayArrival = reservation.arrival === today && reservation.status === 'confirmed';
        // Include already checked-in reservations (for in-house management)
        const isCheckedIn = reservation.status === 'checked-in';
        return isTodayArrival || isCheckedIn;
      })
      .map(reservation => {
        const isCheckedIn = reservation.status === 'checked-in';
        return {
        id: reservation.id,
          uniqueCheckInId: `checkin-${reservation.id}`, // Use reservation ID for consistency
        guestProfileId: undefined, // Will be added when guest profiles are implemented
        guestName: reservation.guestName,
        roomNumber: reservation.roomId || 'TBD',
        roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Standard',
        roomRate: reservation.rateBreakdown?.[0]?.total || 0,
        arrivalDate: reservation.arrival,
        departureDate: reservation.departure,
          checkInDateTime: isCheckedIn ? reservation.updatedAt : undefined, // Set check-in time if already checked in
          status: isCheckedIn ? 'checked-in' as const : 'pending' as const,
        adults: reservation.adults || 1,
        children: reservation.children || 0,
        paymentMethod: reservation.paymentMethod || 'Not specified',
        specialRequests: reservation.remarksToGuest,
        billingPerson: reservation.billingPersonName,
        phone: reservation.guestPhone,
        email: reservation.guestEmail,
        source: reservation.source || 'reservation',
          staffId: isCheckedIn ? 'staff-001' : 'pending', // Set staff ID if checked in
          staffUsername: isCheckedIn ? 'john.doe' : 'Pending', // Set staff username if checked in
        folioId: reservation.id, // Using reservation ID as folio ID for now
        createdAt: reservation.createdAt || new Date().toISOString(),
        updatedAt: reservation.updatedAt || new Date().toISOString(),
          processedAt: isCheckedIn ? reservation.updatedAt : undefined
        };
      });

    setCheckIns(checkInsData);
  };

  const loadAvailableRooms = () => {
    // Load available rooms from the store
    const rooms = frontOfficeStore.rooms || [];
    const roomTypes = frontOfficeStore.roomTypes || [];
    
    // Get rooms that are not currently occupied
    const availableRoomsData = rooms.map(room => {
      const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
      return {
        id: room.id,
        roomNumber: room.id,
        roomType: roomType?.name || 'Standard',
        roomTypeId: room.roomTypeId,
        floor: room.floor,
        rate: roomType?.baseRate || 0,
        isAvailable: true // For now, assume all rooms are available
      };
    });
    
    setAvailableRooms(availableRoomsData);
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
      
      // Reload check-ins to reflect the new reservation
      loadCheckIns();
      
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
      
      // Reload check-ins to reflect the status change
      loadCheckIns();
      
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

  // Enhanced early checkout with proper status update
  const handleEarlyCheckout = async (checkIn: CheckInData) => {
    try {
      console.log(`[CHECK-IN] Processing early checkout for guest: ${checkIn.guestName}`);
      
      // Use the store method for checkout
      const result = frontOfficeStore.processCheckout(checkIn.id, 'Early checkout processed from check-in management');
      
      if (result) {
        console.log(`[CHECK-IN] Guest ${checkIn.guestName} checked out successfully`);
        alert('Guest checked out successfully!');
        // Reload check-ins to reflect the status change
        loadCheckIns();
      } else {
        console.error(`[CHECK-IN] Failed to process checkout for guest: ${checkIn.guestName}`);
        alert('Failed to process checkout. Please try again.');
      }

      onClose();
      setSelectedCheckIn(null);
    } catch (error) {
      console.error('[CHECK-IN] Error processing early checkout:', error);
      alert('Error processing early checkout. Please try again.');
    }
  };

  // Enhanced extend stay with proper date update
  const handleExtendStay = async (checkIn: CheckInData, additionalNights: number) => {
    try {
      console.log(`[CHECK-IN] Extending stay for guest: ${checkIn.guestName} by ${additionalNights} nights`);
      
      // Use the store method for extending stay
      const result = frontOfficeStore.extendStay(checkIn.id, additionalNights);
      
      if (result) {
        console.log(`[CHECK-IN] Guest ${checkIn.guestName} stay extended successfully`);
        alert(`Stay extended by ${additionalNights} night(s) successfully!`);
        // Reload check-ins to reflect the date change
        loadCheckIns();
      } else {
        console.error(`[CHECK-IN] Failed to extend stay for guest: ${checkIn.guestName}`);
        alert('Failed to extend stay. Please try again.');
      }

      onClose();
      setSelectedCheckIn(null);
    } catch (error) {
      console.error('[CHECK-IN] Error extending stay:', error);
      alert('Error extending stay. Please try again.');
    }
  };

  // Room assignment function
  const handleRoomAssignment = async (checkIn: CheckInData, roomId: string) => {
    try {
      console.log(`[CHECK-IN] Assigning room ${roomId} to guest: ${checkIn.guestName}`);
      
      // Update the reservation with the assigned room
      const reservation = frontOfficeStore.reservations.find(r => r.id === checkIn.id);
      if (reservation) {
        reservation.roomId = roomId;
        frontOfficeStore.updateReservation(reservation);
        console.log(`[CHECK-IN] Room ${roomId} assigned successfully`);
        alert(`Room ${roomId} assigned successfully!`);
        loadCheckIns();
      }
    } catch (error) {
      console.error('[CHECK-IN] Error assigning room:', error);
      alert('Error assigning room. Please try again.');
    }
  };

  // Edit check-in function
  const handleEditCheckIn = (checkIn: CheckInData) => {
    setSelectedCheckIn(checkIn);
    setIsEditing(true);
    onOpen();
  };

  // Complete check-in with room assignment
  const handleCompleteCheckIn = async (checkIn: CheckInData, roomId?: string) => {
    try {
      console.log(`[CHECK-IN] Completing check-in for guest: ${checkIn.guestName}`);
      
      // Update reservation status to checked-in
      const updatedReservation = frontOfficeStore.updateReservationStatus(checkIn.id, 'checked-in');
      
      // Assign room if provided
      if (roomId) {
        const reservation = frontOfficeStore.reservations.find(r => r.id === checkIn.id);
        if (reservation) {
          reservation.roomId = roomId;
          frontOfficeStore.updateReservation(reservation);
        }
      }
      
      // Reload check-ins to reflect the status change
      loadCheckIns();
      
      trackEvent('FO.Reservation.CheckedIn', { 
        reservationId: checkIn.id,
        guestName: checkIn.guestName,
        roomId: roomId || checkIn.roomNumber,
        staffId: currentStaff.id,
        staffUsername: currentStaff.username,
        timestamp: new Date().toISOString()
      });

      console.log('[CHECK-IN] Check-in completed successfully');
      alert('Check-in completed successfully!');
      onClose();
      setSelectedCheckIn(null);
      setIsEditing(false);
    } catch (error) {
      console.error('[CHECK-IN] Error completing check-in:', error);
      alert('Error completing check-in. Please try again.');
    }
  };

  // Room transfer functions
  const handleRoomTransfer = async () => {
    if (!selectedGuestForTransfer || !selectedNewRoom || !transferReason) {
      alert('Please select a guest, new room, and transfer reason.');
      return;
    }

    try {
      console.log(`[ROOM-TRANSFER] Initiating transfer for guest: ${selectedGuestForTransfer} to room: ${selectedNewRoom}`);
      
      const guest = checkIns.find(c => c.id === selectedGuestForTransfer);
      const newRoom = availableRooms.find(r => r.id === selectedNewRoom);
      
      if (!guest || !newRoom) {
        alert('Guest or room not found. Please refresh and try again.');
        return;
      }

      // Update the reservation with new room
      frontOfficeStore.assignRoom(guest.id, selectedNewRoom);

      // Track the transfer event
      trackEvent('FO.RoomTransfer.Completed' as any, {
        guestId: guest.id,
        guestName: guest.guestName,
        fromRoom: guest.roomNumber,
        toRoom: newRoom.roomNumber,
        reason: transferReason,
        notes: transferNotes,
        timestamp: new Date().toISOString()
      });

      // Refresh data
      loadCheckIns();
      loadAvailableRooms();

      // Reset form
      setSelectedGuestForTransfer('');
      setSelectedNewRoom('');
      setTransferReason('');
      setTransferNotes('');

      alert(`✅ Room transfer completed! ${guest.guestName} moved from Room ${guest.roomNumber} to Room ${newRoom.roomNumber}.`);
      
    } catch (error) {
      console.error('[ROOM-TRANSFER] Error processing transfer:', error);
      alert('Error processing room transfer. Please try again.');
    }
  };

  const handleTransferPreview = () => {
    if (!selectedGuestForTransfer || !selectedNewRoom) {
      alert('Please select both a guest and new room to preview the transfer.');
      return;
    }

    const guest = checkIns.find(c => c.id === selectedGuestForTransfer);
    const newRoom = availableRooms.find(r => r.id === selectedNewRoom);
    
    if (!guest || !newRoom) {
      alert('Guest or room not found. Please refresh and try again.');
      return;
    }

    const previewMessage = `
🔄 ROOM TRANSFER PREVIEW

Guest: ${guest.guestName}
Current Room: ${guest.roomNumber}
New Room: ${newRoom.roomNumber} (${newRoom.roomType})
Rate: ₵${newRoom.rate}/night
Transfer Reason: ${transferReason || 'Not specified'}
Notes: ${transferNotes || 'None'}

This transfer will:
• Update the guest's room assignment
• Add transfer details to guest remarks
• Log the transfer for audit purposes

Proceed with transfer?
    `;

    if (confirm(previewMessage)) {
      handleRoomTransfer();
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
              🔑 Guest Check-In & In-House Management
            </h1>
            <p className="text-gray-600 mt-2">
              Process check-ins for reservations and walk-ins, then manage guests during their stay
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
          <Tab key="reservations" title="📅 Check-In Reservations">
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
                                <Button
                                  size="sm"
                                  color="secondary"
                                  variant="flat"
                                  onClick={() => {
                                    setSelectedCheckIn({
                                      id: reservation.id,
                                      uniqueCheckInId: `checkin-${reservation.id}`,
                                      guestName: reservation.guestName,
                                      roomNumber: reservation.roomId || 'TBD',
                                      roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Standard',
                                      roomRate: reservation.rateBreakdown?.[0]?.total || 0,
                                      arrivalDate: reservation.arrival,
                                      departureDate: reservation.departure,
                                      status: 'pending',
                                      adults: reservation.adults || 1,
                                      children: reservation.children || 0,
                                      paymentMethod: reservation.paymentMethod || 'Not specified',
                                      specialRequests: reservation.remarksToGuest,
                                      billingPerson: reservation.billingPersonName,
                                      phone: reservation.guestPhone,
                                      email: reservation.guestEmail,
                                      source: reservation.source || 'reservation',
                                      staffId: 'pending',
                                      staffUsername: 'Pending',
                                      folioId: reservation.id,
                                      createdAt: reservation.createdAt || new Date().toISOString(),
                                      updatedAt: reservation.updatedAt || new Date().toISOString()
                                    });
                                    onOpen();
                                  }}
                                >
                                  🏠 Assign
                                </Button>
                                <Button
                                  size="sm"
                                  color="default"
                                  variant="flat"
                                  onClick={() => {
                                    setSelectedCheckIn({
                                      id: reservation.id,
                                      uniqueCheckInId: `checkin-${reservation.id}`,
                                      guestName: reservation.guestName,
                                      roomNumber: reservation.roomId || 'TBD',
                                      roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Standard',
                                      roomRate: reservation.rateBreakdown?.[0]?.total || 0,
                                      arrivalDate: reservation.arrival,
                                      departureDate: reservation.departure,
                                      status: 'pending',
                                      adults: reservation.adults || 1,
                                      children: reservation.children || 0,
                                      paymentMethod: reservation.paymentMethod || 'Not specified',
                                      specialRequests: reservation.remarksToGuest,
                                      billingPerson: reservation.billingPersonName,
                                      phone: reservation.guestPhone,
                                      email: reservation.guestEmail,
                                      source: reservation.source || 'reservation',
                                      staffId: 'pending',
                                      staffUsername: 'Pending',
                                      folioId: reservation.id,
                                      createdAt: reservation.createdAt || new Date().toISOString(),
                                      updatedAt: reservation.updatedAt || new Date().toISOString()
                                    });
                                    setIsEditing(true);
                                    onOpen();
                                  }}
                                >
                                  ✏️ Edit
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
                          {filteredCheckIns
                            .slice((page - 1) * rowsPerPage, page * rowsPerPage)
                            .map((checkIn) => (
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
                                <div className="flex space-x-2">
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
                                  <Button
                                    size="sm"
                                    color="secondary"
                                    variant="flat"
                                    onClick={() => {
                                      setSelectedCheckIn(checkIn);
                                      onOpen();
                                    }}
                                  >
                                    🏠 Assign
                                  </Button>
                                  <Button
                                    size="sm"
                                    color="default"
                                    variant="flat"
                                    onClick={() => {
                                      setSelectedCheckIn(checkIn);
                                      setIsEditing(true);
                                      onOpen();
                                    }}
                                  >
                                    ✏️ Edit
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
                      total={Math.max(1, Math.ceil(filteredCheckIns.length / rowsPerPage))}
                      onChange={setPage}
                      showControls
                      size="sm"
                    />
                  </div>
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

          <Tab key="inhouse" title="🏠 In-House Management">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-xl font-semibold text-ghana-black">Manage Current Guests</h3>
                <p className="text-gray-600">View and manage guests who are currently checked in</p>
              </CardHeader>
              <CardBody>
                {/* In-House Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card className="border-0 shadow-md">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Guests</p>
                          <p className="text-2xl font-bold text-ghana-black">{checkIns.filter(ci => ci.status === 'checked-in').length}</p>
                        </div>
                        <div className="text-2xl">👥</div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="border-0 shadow-md">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                          <p className="text-2xl font-bold text-ghana-black">₵{checkIns.filter(ci => ci.status === 'checked-in').reduce((sum, ci) => sum + ci.roomRate, 0).toLocaleString()}</p>
                        </div>
                        <div className="text-2xl">💰</div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="border-0 shadow-md">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Avg Revenue/Guest</p>
                          <p className="text-2xl font-bold text-ghana-black">₵{checkIns.filter(ci => ci.status === 'checked-in').length > 0 ? Math.round(checkIns.filter(ci => ci.status === 'checked-in').reduce((sum, ci) => sum + ci.roomRate, 0) / checkIns.filter(ci => ci.status === 'checked-in').length) : 0}</p>
                        </div>
                        <div className="text-2xl">📊</div>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="border-0 shadow-md">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Pending Check-ins</p>
                          <p className="text-2xl font-bold text-ghana-black">{checkIns.filter(ci => ci.status === 'pending').length}</p>
                        </div>
                        <div className="text-2xl">⏳</div>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* In-House Guests Table */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Currently Checked-In Guests</h4>
                  <Table aria-label="In-house guests table">
                    <TableHeader>
                      <TableColumn>Guest Name</TableColumn>
                      <TableColumn>Room</TableColumn>
                      <TableColumn>Check-in Date</TableColumn>
                      <TableColumn>Departure Date</TableColumn>
                      <TableColumn>Rate</TableColumn>
                      <TableColumn>Status</TableColumn>
                      <TableColumn>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {checkIns
                        .filter(checkIn => checkIn.status === 'checked-in')
                        .slice((inhousePage - 1) * rowsPerPage, inhousePage * rowsPerPage)
                        .map((checkIn) => (
                          <TableRow key={checkIn.id}>
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <Avatar name={checkIn.guestName} size="sm" />
                                <div>
                                  <p className="font-medium">{checkIn.guestName}</p>
                                  <p className="text-sm text-gray-600">{checkIn.phone}</p>
                                </div>
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
                                <p className="font-medium">{formatDate(checkIn.arrivalDate)}</p>
                                {checkIn.checkInDateTime && (
                                  <p className="text-sm text-gray-600">{formatTime(checkIn.checkInDateTime)}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{formatDate(checkIn.departureDate)}</p>
                                <p className="text-sm text-gray-600">{checkIn.adults} adults, {checkIn.children} children</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-green-600">₵{checkIn.roomRate}</p>
                                <p className="text-sm text-gray-600">per night</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge color="success" variant="flat">Checked In</Badge>
                            </TableCell>
                            <TableCell>
                              <Dropdown>
                                <DropdownTrigger>
                                  <Button size="sm" variant="flat">
                                    Manage
                                  </Button>
                                </DropdownTrigger>
                                <DropdownMenu aria-label="Guest management actions">
                                  <DropdownItem key="view-details" onClick={() => {
                                    setSelectedCheckIn(checkIn);
                                    onOpen();
                                  }}>
                                    View Details
                                  </DropdownItem>
                                  <DropdownItem key="extend-1" onClick={() => handleExtendStay(checkIn, 1)}>
                                    Extend 1 Night
                                  </DropdownItem>
                                  <DropdownItem key="extend-2" onClick={() => handleExtendStay(checkIn, 2)}>
                                    Extend 2 Nights
                                  </DropdownItem>
                                  <DropdownItem key="early-checkout" onClick={() => handleEarlyCheckout(checkIn)}>
                                    Early Checkout
                                  </DropdownItem>
                                </DropdownMenu>
                              </Dropdown>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end mt-3">
                    <Pagination 
                      page={inhousePage}
                      total={Math.max(1, Math.ceil(checkIns.filter(ci => ci.status === 'checked-in').length / rowsPerPage))}
                      onChange={setInhousePage}
                      showControls
                      size="sm"
                    />
                  </div>
                </div>
              </CardBody>
            </Card>
          </Tab>

          <Tab key="roomtransfer" title="🔄 Room Transfer">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-xl font-semibold text-ghana-black">Room Transfer Management</h3>
                <p className="text-gray-600">Transfer guests between rooms during their stay</p>
              </CardHeader>
              <CardBody>
                <div className="space-y-6">
                  {/* Room Transfer Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-blue-50 border-blue-200">
                      <CardBody className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <span className="text-2xl">🔄</span>
                          </div>
                          <div>
                            <p className="text-sm text-blue-600 font-medium">Transfer Requests</p>
                            <p className="text-2xl font-bold text-blue-800">0</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                    
                    <Card className="bg-green-50 border-green-200">
                      <CardBody className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <span className="text-2xl">✅</span>
                          </div>
                          <div>
                            <p className="text-sm text-green-600 font-medium">Completed Today</p>
                            <p className="text-2xl font-bold text-green-800">0</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                    
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardBody className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-yellow-100 rounded-lg">
                            <span className="text-2xl">⏳</span>
                          </div>
                          <div>
                            <p className="text-sm text-yellow-600 font-medium">Pending</p>
                            <p className="text-2xl font-bold text-yellow-800">0</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                    
                    <Card className="bg-purple-50 border-purple-200">
                      <CardBody className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <span className="text-2xl">🏠</span>
                          </div>
                          <div>
                            <p className="text-sm text-purple-600 font-medium">Available Rooms</p>
                            <p className="text-2xl font-bold text-purple-800">{availableRooms.length}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  {/* Room Transfer Form */}
                  <Card className="bg-gray-50">
                    <CardHeader>
                      <h4 className="text-lg font-semibold">Initiate Room Transfer</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Guest Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Select Guest</label>
                          <Select
                            placeholder="Choose a guest to transfer"
                            className="w-full"
                            selectedKeys={selectedGuestForTransfer ? [selectedGuestForTransfer] : []}
                            onSelectionChange={(keys) => {
                              const selectedKey = Array.from(keys)[0] as string;
                              setSelectedGuestForTransfer(selectedKey);
                            }}
                          >
                            {checkIns
                              .filter(checkIn => checkIn.status === 'checked-in')
                              .map((checkIn) => (
                                <SelectItem key={checkIn.id}>
                                  {checkIn.guestName} - Room {checkIn.roomNumber}
                                </SelectItem>
                              ))}
                          </Select>
                        </div>

                        {/* Current Room Display */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Current Room</label>
                          <Input
                            placeholder="Current room will appear here"
                            readOnly
                            className="bg-gray-100"
                            value={selectedGuestForTransfer ? 
                              checkIns.find(c => c.id === selectedGuestForTransfer)?.roomNumber || '' 
                              : ''}
                          />
                        </div>

                        {/* New Room Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Transfer To Room</label>
                          <Select
                            placeholder="Select new room"
                            className="w-full"
                            selectedKeys={selectedNewRoom ? [selectedNewRoom] : []}
                            onSelectionChange={(keys) => {
                              const selectedKey = Array.from(keys)[0] as string;
                              setSelectedNewRoom(selectedKey);
                            }}
                          >
                            {availableRooms.map((room) => (
                              <SelectItem key={room.id}>
                                {room.roomNumber} - {room.roomType} (₵{room.rate}/night)
                              </SelectItem>
                            ))}
                          </Select>
                        </div>

                        {/* Transfer Reason */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Transfer Reason</label>
                          <Select
                            placeholder="Select reason"
                            className="w-full"
                            selectedKeys={transferReason ? [transferReason] : []}
                            onSelectionChange={(keys) => {
                              const selectedKey = Array.from(keys)[0] as string;
                              setTransferReason(selectedKey);
                            }}
                          >
                            <SelectItem key="maintenance">Maintenance Required</SelectItem>
                            <SelectItem key="upgrade">Room Upgrade</SelectItem>
                            <SelectItem key="downgrade">Room Downgrade</SelectItem>
                            <SelectItem key="guest-request">Guest Request</SelectItem>
                            <SelectItem key="overbooking">Overbooking Resolution</SelectItem>
                            <SelectItem key="other">Other</SelectItem>
                          </Select>
                        </div>
                      </div>

                      {/* Transfer Notes */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Transfer Notes</label>
                        <textarea
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                          placeholder="Add any additional notes about the transfer..."
                          value={transferNotes}
                          onChange={(e) => setTransferNotes(e.target.value)}
                        />
                      </div>

                      {/* Transfer Actions */}
                      <div className="flex space-x-3 mt-6">
                        <Button
                          color="primary"
                          className="flex-1"
                          onClick={handleRoomTransfer}
                          isDisabled={!selectedGuestForTransfer || !selectedNewRoom || !transferReason}
                        >
                          🔄 Initiate Transfer
                        </Button>
                        <Button
                          color="secondary"
                          variant="flat"
                          onClick={handleTransferPreview}
                          isDisabled={!selectedGuestForTransfer || !selectedNewRoom}
                        >
                          👁️ Preview Transfer
                        </Button>
                      </div>
                    </CardBody>
                  </Card>

                  {/* Recent Transfers */}
                  <Card>
                    <CardHeader>
                      <h4 className="text-lg font-semibold">Recent Room Transfers</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="text-center py-8 text-gray-500">
                        <span className="text-4xl mb-4 block">🔄</span>
                        <p className="text-lg font-medium">No recent transfers</p>
                        <p className="text-sm">Room transfer history will appear here</p>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </CardBody>
            </Card>
          </Tab>
          
          <Tab key="checkouts" title="🚪 Check-outs">
            {/* Embed existing Check-outs page inside tab for consolidated workflow */}
            <div className="pt-2">
              <CheckOutsPage />
            </div>
          </Tab>
          
          <Tab key="billing" title="💳 Invoices & Payments">
            {/* Embed existing Invoices & Payments page inside tab for consolidated workflow */}
            <div className="pt-2">
              <InvoicesPaymentsPage />
            </div>
          </Tab>
        </Tabs>

        {/* Enhanced Check-in Processing Modal */}
        <Modal isOpen={isOpen} onClose={() => {
          onClose();
          setIsEditing(false);
          setSelectedRoom('');
        }} size="3xl">
          <ModalContent>
            <ModalHeader>
              {isEditing ? 'Edit Check-In' : selectedCheckIn?.status === 'checked-in' ? 'Manage Guest' : 'Process Check-In'}
            </ModalHeader>
            <ModalBody>
              {selectedCheckIn && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <Avatar name={selectedCheckIn.guestName} size="lg" />
                    <div>
                      <h3 className="text-xl font-semibold">{selectedCheckIn.guestName}</h3>
                      <p className="text-gray-600">{selectedCheckIn.phone}</p>
                      <p className="text-gray-600">{selectedCheckIn.email}</p>
                      <Badge 
                        color={selectedCheckIn.status === 'checked-in' ? 'success' : 'warning'} 
                        variant="flat"
                        className="mt-2"
                      >
                        {selectedCheckIn.status === 'checked-in' ? 'Checked In' : 'Pending Check-in'}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Room Assignment Section */}
                  <div className="border-t pt-4">
                    <h4 className="text-lg font-semibold mb-3">Room Assignment</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-600">Current Room</p>
                        <p className="font-medium">{selectedCheckIn.roomNumber === 'TBD' ? 'Not Assigned' : selectedCheckIn.roomNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Room Type</p>
                      <p className="font-medium">{selectedCheckIn.roomType}</p>
                    </div>
                    </div>
                    
                    {/* Room Selection */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign Room</label>
                      <Select
                        placeholder="Select a room"
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                        className="w-full"
                      >
                        {availableRooms
                          .filter(room => room.roomTypeId === frontOfficeStore.roomTypes.find(rt => rt.name === selectedCheckIn.roomType)?.id)
                          .map((room) => (
                            <SelectItem key={room.id}>
                              {room.roomNumber} - {room.roomType} (₵{room.rate}/night)
                            </SelectItem>
                          ))}
                      </Select>
                      {selectedRoom && (
                        <Button
                          size="sm"
                          color="secondary"
                          className="mt-2"
                          onClick={() => selectedCheckIn && handleRoomAssignment(selectedCheckIn, selectedRoom)}
                        >
                          Assign Room
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Guest Details */}
                  <div className="border-t pt-4">
                    <h4 className="text-lg font-semibold mb-3">Stay Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Arrival</p>
                        <p className="font-medium">{formatDate(selectedCheckIn.arrivalDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Departure</p>
                        <p className="font-medium">{formatDate(selectedCheckIn.departureDate)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Rate</p>
                        <p className="font-medium text-green-600">₵{selectedCheckIn.roomRate}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Guests</p>
                        <p className="font-medium">{selectedCheckIn.adults} adults, {selectedCheckIn.children} children</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Special Requests */}
                  {selectedCheckIn.specialRequests && (
                    <div className="border-t pt-4">
                      <h4 className="text-lg font-semibold mb-3">Special Requests</h4>
                      <p className="text-gray-600">{selectedCheckIn.specialRequests}</p>
                    </div>
                  )}

                  {/* Check-in Time */}
                  {selectedCheckIn.status === 'checked-in' && selectedCheckIn.checkInDateTime && (
                    <div className="border-t pt-4">
                      <h4 className="text-lg font-semibold mb-3">Check-in Information</h4>
                      <p className="text-gray-600">Checked in at: {formatDateTime(selectedCheckIn.checkInDateTime)}</p>
                    </div>
                  )}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onClick={() => {
                onClose();
                setIsEditing(false);
                setSelectedRoom('');
              }}>
                Cancel
              </Button>
              {selectedCheckIn?.status === 'checked-in' ? (
                <div className="flex space-x-2">
              <Button 
                color="primary" 
                    variant="flat"
                    onClick={() => selectedCheckIn && handleExtendStay(selectedCheckIn, 1)}
                  >
                    Extend 1 Night
                  </Button>
                  <Button 
                    color="danger" 
                    variant="flat"
                    onClick={() => selectedCheckIn && handleEarlyCheckout(selectedCheckIn)}
                  >
                    Early Checkout
                  </Button>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <Button 
                    color="primary" 
                    onClick={() => selectedCheckIn && handleCompleteCheckIn(selectedCheckIn, selectedRoom)}
                isLoading={isProcessing}
              >
                ✅ Complete Check-In
              </Button>
                  {selectedRoom && (
                    <Button 
                      color="secondary" 
                      variant="flat"
                      onClick={() => selectedCheckIn && handleCompleteCheckIn(selectedCheckIn, selectedRoom)}
                      isLoading={isProcessing}
                    >
                      🏠 Assign & Check-In
                    </Button>
                  )}
                </div>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </PageLayout>
  );
}

export default function CheckInsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckInsPageContent />
    </Suspense>
  );
}
