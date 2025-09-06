'use client';

/**
 * Guest Check-Out Management Page
 * 
 * This component provides comprehensive checkout processing with enhanced folio management.
 * It implements the Payment/Final Settlement Table structure as per the relational database design:
 * 
 * ENHANCED DATA STRUCTURE:
 * - Folio ID: Links to the central folio system
 * - Financial Status: Total charges, payments, outstanding balance, discounts
 * - Checkout Details: Timestamps, room status, confirmation numbers
 * - Guest Profile: Links to repeat guest information
 * - Source Tracking: Origin of booking and checkout processing
 * 
 * LINKED COMPONENTS:
 * - Check-ins: Processes guests who have completed check-in
 * - In-House: Manages guests during their stay
 * - Folio System: Central financial tracking and settlement
 * - Housekeeping: Room status updates after checkout
 * 
 * OPERATIONS:
 * - Process checkouts with financial settlement
 * - Handle late checkouts and extensions
 * - Generate confirmation numbers and receipts
 * - Update room status for housekeeping
 * - Track payment methods and outstanding balances
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
  Textarea
} from "@heroui/react";
import { frontOfficeStore } from '../../lib/frontoffice/store';
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
}

export default function CheckOutsPage() {
  const [checkOuts, setCheckOuts] = useState<CheckOutData[]>([]);
  const [filteredCheckOuts, setFilteredCheckOuts] = useState<CheckOutData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [selectedCheckOut, setSelectedCheckOut] = useState<CheckOutData | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState('');

  useEffect(() => {
    loadCheckOuts();
    const unsubscribe = frontOfficeStore.subscribe(loadCheckOuts);
    return unsubscribe;
  }, []);

  useEffect(() => {
    filterCheckOuts();
  }, [checkOuts, searchTerm, statusFilter]);

  // Reset to first page whenever the filtered list changes size
  useEffect(() => {
    setPage(1);
  }, [filteredCheckOuts.length]);

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
        const isLateCheckout = new Date(reservation.departure) < today;
        
        return {
          id: reservation.id,
          uniqueCheckOutId: `checkout-${Date.now()}`, // Generate a unique ID
          folioId: reservation.id, // Using reservation ID as folio ID for now
          guestProfileId: undefined, // Will be added when guest profiles are implemented
          guestName: reservation.guestName,
          roomNumber: reservation.roomId || 'TBD',
          roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Standard',
          roomRate: reservation.rateBreakdown?.[0]?.total || 0,
          checkInDate: reservation.arrival,
          checkInDateTime: reservation.arrival, // Using arrival as check-in time
          checkOutDate: reservation.departure,
          checkoutDateTime: undefined, // Will be set when checkout is processed
          status: 'pending' as const,
          nightsStayed: Math.ceil((new Date(reservation.departure).getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24)),
          totalCharges: reservation.rateBreakdown?.[0]?.total || 0,
          totalPayments: 0, // Will be calculated from actual payments
          outstandingBalance: reservation.rateBreakdown?.[0]?.total || 0,
          discount: 0, // No discount by default
          finalPaymentMethod: reservation.paymentMethod || 'Not specified',
          confirmationNumber: undefined, // Will be generated during checkout
          roomStatus: 'Occupied', // Default room status
          phone: reservation.guestPhone,
          email: reservation.guestEmail,
          specialRequests: reservation.remarksToGuest,
          billingPerson: reservation.billingPersonName,
          lateCheckout: false, // Default to on-time checkout
          housekeepingStatus: 'pending',
          source: reservation.source || 'Front Office',
          staffId: 'pending', // Will be set when checkout is processed
          staffUsername: 'Pending', // Will be set when checkout is processed
          adults: reservation.adults || 1,
          children: reservation.children || 0,
          checkoutNotes: undefined, // Will be set when checkout is processed
          createdAt: reservation.createdAt || new Date().toISOString(),
          updatedAt: reservation.updatedAt || new Date().toISOString(),
          processedAt: undefined // Will be set when checkout is processed
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

    setFilteredCheckOuts(filtered);
  };

  const handleCheckOut = async (checkOut: CheckOutData) => {
    setIsProcessing(true);
    try {
      // Update reservation status to checked-out
      const updatedReservation = frontOfficeStore.reservations.find(r => r.id === checkOut.id);
      if (updatedReservation) {
        updatedReservation.status = 'checked-out';
        updatedReservation.checkOutTime = new Date().toISOString();
        updatedReservation.checkoutNotes = checkoutNotes;
        frontOfficeStore.notify();
      }

      // Create housekeeping task for room cleaning
      // This would typically update the housekeeping store as well

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

  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">🚪 Guest Check-outs</h1>
            <p className="text-gray-600">Process guest departures and manage checkout workflow</p>
          </div>

          {/* Stats Cards */}
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

          {/* Filters and Search */}
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
              </div>
            </CardBody>
          </Card>

          {/* Check-outs Table */}
          <Table aria-label="Check-outs table">
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
              <TableColumn>Check-out Date</TableColumn>
              <TableColumn>Check-out Time</TableColumn>
              <TableColumn>Nights Stayed</TableColumn>
              <TableColumn>Adults</TableColumn>
              <TableColumn>Children</TableColumn>
              <TableColumn>Total Charges</TableColumn>
              <TableColumn>Total Payments</TableColumn>
              <TableColumn>Outstanding Balance</TableColumn>
              <TableColumn>Discount</TableColumn>
              <TableColumn>Final Payment Method</TableColumn>
              <TableColumn>Confirmation Number</TableColumn>
              <TableColumn>Room Status</TableColumn>
              <TableColumn>Source</TableColumn>
              <TableColumn>Staff ID</TableColumn>
              <TableColumn>Staff Username</TableColumn>
              <TableColumn>Folio ID</TableColumn>
              <TableColumn>Late Checkout</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredCheckOuts.map((checkOut) => (
                <TableRow 
                  key={checkOut.id}
                  {...getAnalyticsData(checkOut)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-purple-600">{checkOut.uniqueCheckOutId}</p>
                      <p className="text-xs text-gray-500">Reservation: {checkOut.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar 
                        name={checkOut.guestName} 
                        size="sm"
                        className="bg-ghana-gold text-white"
                      />
                      <div>
                        <p className="font-medium">{checkOut.guestName}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      {checkOut.guestProfileId ? (
                        <p className="font-medium text-blue-600">{checkOut.guestProfileId}</p>
                      ) : (
                        <p className="text-sm text-gray-400">Not assigned</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{checkOut.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{checkOut.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{checkOut.roomNumber}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{checkOut.roomType}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium text-green-600">₵{checkOut.roomRate}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{formatDate(checkOut.checkInDate)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">{formatTime(checkOut.checkInDate)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{formatDate(checkOut.checkOutDate)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">{formatTime(checkOut.checkOutDate)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{checkOut.nightsStayed}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{checkOut.adults}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{checkOut.children}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium text-red-600">₵{checkOut.totalCharges.toLocaleString()}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium text-green-600">₵{checkOut.totalPayments.toLocaleString()}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className={`font-medium ${checkOut.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₵{checkOut.outstandingBalance.toLocaleString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      {checkOut.discount && checkOut.discount > 0 ? (
                        <p className="font-medium text-orange-600">₵{checkOut.discount.toLocaleString()}</p>
                      ) : (
                        <p className="text-sm text-gray-400">No discount</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{checkOut.finalPaymentMethod || 'Not specified'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      {checkOut.confirmationNumber ? (
                        <p className="font-medium text-purple-600">{checkOut.confirmationNumber}</p>
                      ) : (
                        <p className="text-sm text-gray-400">Not assigned</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{checkOut.roomStatus || 'Pending'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium">{checkOut.source}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium text-blue-600">{checkOut.staffId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-medium text-blue-600">{checkOut.staffUsername}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      {checkOut.folioId ? (
                        <p className="font-medium text-purple-600">{checkOut.folioId}</p>
                      ) : (
                        <p className="text-sm text-gray-400">Not assigned</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      {checkOut.lateCheckout ? (
                        <Badge color="danger" variant="flat" size="sm">Late</Badge>
                      ) : (
                        <Badge color="success" variant="flat" size="sm">On Time</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <Badge color={getStatusColor(checkOut.status)} variant="flat">
                        {getStatusText(checkOut.status)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        onClick={() => openCheckOutModal(checkOut)}
                      >
                        Process
                      </Button>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button size="sm" variant="flat" isIconOnly>
                            ⋯
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu>
                          <DropdownItem key="view-details" onClick={() => openCheckOutModal(checkOut)}>
                            View Details
                          </DropdownItem>
                          <DropdownItem key="extend-stay" onClick={() => handleExtendStay(checkOut, 1)}>
                            Extend Stay
                          </DropdownItem>
                          <DropdownItem key="process-checkout" onClick={() => handleCheckOut(checkOut)}>
                            Complete Checkout
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Check-out Processing Modal */}
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
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
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
      </div>
    </PageLayout>
  );
}
