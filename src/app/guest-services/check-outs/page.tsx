'use client';

/**
 * Guest Check-Out Management Page
 * (Restored as an embeddable component for consolidated tabs)
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
  // remove duplicate page declaration if present
  const [rowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedCheckOut, setSelectedCheckOut] = useState<CheckOutData | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [quickSettlementMethod, setQuickSettlementMethod] = useState<'Cash'|'Card'|'Mobile Money'>('Cash');

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

  const getFolioTotals = (reservationId: string) => {
    const folio = frontOfficeStore.getOrCreateFolio(reservationId);
    const totalCharges = folio.charges.reduce((s, c) => s + c.amount + (c.tax || 0), 0);
    const totalPayments = folio.payments.reduce((s, p) => s + p.amount, 0);
    return { totalCharges, totalPayments, outstandingBalance: Math.max(0, totalCharges - totalPayments) };
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
        
        return {
          id: reservation.id,
          uniqueCheckOutId: `checkout-${Date.now()}`,
          folioId: reservation.id,
          guestProfileId: undefined,
          guestName: reservation.guestName,
          roomNumber: reservation.roomId || 'TBD',
          roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Standard',
          roomRate: reservation.rateBreakdown?.[0]?.total || 0,
          checkInDate: reservation.arrival,
          checkInDateTime: reservation.arrival,
          checkOutDate: reservation.departure,
          checkoutDateTime: undefined,
          status: 'pending',
          nightsStayed: Math.ceil((new Date(reservation.departure).getTime() - new Date(reservation.arrival).getTime()) / (1000 * 60 * 60 * 24)),
          totalCharges: folioTotals.totalCharges,
          totalPayments: folioTotals.totalPayments,
          outstandingBalance: folioTotals.outstandingBalance,
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

    setFilteredCheckOuts(filtered);
  };

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
    frontOfficeStore.addPayment(checkOut.id, quickSettlementMethod, outstandingBalance);
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
                </Select>
              </div>
            </CardBody>
          </Card>

          <Table aria-label="Check-outs table">
            <TableHeader>
              <TableColumn>GUEST</TableColumn>
              <TableColumn>ROOM</TableColumn>
              <TableColumn>NIGHTS</TableColumn>
              <TableColumn>CHARGES</TableColumn>
              <TableColumn>PAYMENTS</TableColumn>
              <TableColumn>BALANCE</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredCheckOuts
                .slice((page - 1) * rowsPerPage, page * rowsPerPage)
                .map((checkOut) => (
                <TableRow 
                  key={checkOut.id}
                  {...getAnalyticsData(checkOut)}
                >
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar name={checkOut.guestName} size="sm" className="bg-ghana-gold text-white" />
                      <div>
                        <p className="font-medium">{checkOut.guestName}</p>
                        <p className="text-xs text-gray-500">Res: {checkOut.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-center">{checkOut.roomNumber}</p>
                      <p className="text-xs text-gray-500 text-center">{checkOut.roomType}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-center">{checkOut.nightsStayed}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-red-600 text-center">₵{checkOut.totalCharges.toLocaleString()}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-green-600 text-center">₵{checkOut.totalPayments.toLocaleString()}</p>
                  </TableCell>
                  <TableCell>
                    <p className={`font-medium text-center ${checkOut.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>₵{checkOut.outstandingBalance.toLocaleString()}</p>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <Badge color={getStatusColor(checkOut.status)} variant="flat">{getStatusText(checkOut.status)}</Badge>
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
                      {checkOut.outstandingBalance > 0 && (
                        <Button size="sm" color="success" variant="flat" onClick={() => handleQuickSettlement(checkOut)}>
                          Settle ₵{checkOut.outstandingBalance.toFixed(2)}
                        </Button>
                      )}
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
                                </TableHeader>
                                <TableBody>
                                  {folio.payments.map(p => (
                                    <TableRow key={p.id}>
                                      <TableCell>{new Date(p.date).toLocaleDateString()}</TableCell>
                                      <TableCell>{p.method}</TableCell>
                                      <TableCell>₵{p.amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            );
                          })()}
                        </div>
                      </AccordionItem>
                    </Accordion>
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
  );
}


