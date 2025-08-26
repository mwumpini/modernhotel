'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, Textarea,
  Tabs, Tab, Divider, Progress, Avatar, useDisclosure, Tooltip, Switch, Alert
} from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import type { Reservation, GuestProfile } from '../lib/frontoffice/types';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  action: () => void;
  requiresModule?: string;
}

export default function FrontOfficeOperationsDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  const settings = useSettingsStore();
  const [tick, setTick] = useState(0);
  
  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = frontOfficeStore.subscribe(() => setTick(t => t + 1));
    return unsubscribe;
  }, []);

  // Get data from stores
  const reservations = frontOfficeStore.reservations;
  const guests = frontOfficeStore.guests;
  const rooms = frontOfficeStore.rooms;

  // Calculate key metrics
  const totalReservations = reservations.length;
  const checkedInReservations = reservations.filter(r => r.status === 'checked-in').length;
  const pendingCheckIns = reservations.filter(r => r.status === 'confirmed').length;
  const pendingCheckOuts = reservations.filter(r => r.status === 'checked-in').length;
  const totalRevenue = reservations.reduce((sum, r) => {
    const folio = frontOfficeStore.getOrCreateFolio(r.id);
    return sum + folio.charges.reduce((s, c) => s + c.amount, 0);
  }, 0);

  // Quick Actions
  const quickActions: QuickAction[] = [
    {
      id: 'new-reservation',
      title: 'New Reservation',
      description: 'Create a new guest reservation',
      icon: '📅',
      color: 'ghana-green',
      action: () => setIsReservationModalOpen(true)
    },
    {
      id: 'check-in',
      title: 'Check In',
      description: 'Process guest check-in',
      icon: '🔑',
      color: 'ghana-gold',
      action: () => setIsCheckInModalOpen(true),
      requiresModule: 'frontOffice'
    },
    {
      id: 'check-out',
      title: 'Check Out',
      description: 'Process guest check-out',
      icon: '🚪',
      color: 'ghana-red',
      action: () => setIsCheckOutModalOpen(true),
      requiresModule: 'frontOffice'
    },
    {
      id: 'payment',
      title: 'Payment',
      description: 'Process guest payments',
      icon: '💰',
      color: 'blue-500',
      action: () => setIsPaymentModalOpen(true),
      requiresModule: 'frontOffice'
    },
    {
      id: 'room-assignment',
      title: 'Room Assignment',
      description: 'Assign rooms to guests',
      icon: '🏠',
      color: 'purple-500',
      action: () => setSelectedTab('room-assignment'),
      requiresModule: 'frontOffice'
    },
    {
      id: 'guest-search',
      title: 'Guest Search',
      description: 'Search guest history',
      icon: '🔍',
      color: 'gray-600',
      action: () => setSelectedTab('guest-search'),
      requiresModule: 'frontOffice'
    }
  ];

  const handleCheckIn = (reservationId: string, roomId: string) => {
    frontOfficeStore.assignRoom(reservationId, roomId);
    frontOfficeStore.checkIn(reservationId);
    trackEvent('FO.Guest.CheckedIn', { reservationId, roomId });
    setIsCheckInModalOpen(false);
  };

  const handleCheckOut = (reservationId: string) => {
    frontOfficeStore.checkOut(reservationId);
    trackEvent('FO.Guest.CheckedOut', { reservationId });
    setIsCheckOutModalOpen(false);
  };

  const handlePayment = (reservationId: string, amount: number, method: string) => {
    frontOfficeStore.addPayment(reservationId, method as 'cash' | 'card' | 'mobile_money' | 'bank_transfer', amount);
    trackEvent('FO.Payment.Received', { reservationId, amount, method });
    setIsPaymentModalOpen(false);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Reservations</p>
                <p className="text-2xl font-bold text-ghana-black">{totalReservations}</p>
              </div>
              <div className="text-3xl">📅</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Checked In</p>
                <p className="text-2xl font-bold text-ghana-black">{checkedInReservations}</p>
              </div>
              <div className="text-3xl">🔑</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Check-ins</p>
                <p className="text-2xl font-bold text-ghana-black">{pendingCheckIns}</p>
              </div>
              <div className="text-3xl">⏳</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-ghana-black">₵{totalRevenue.toLocaleString()}</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🚀 Quick Actions</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((action) => {
              const isEnabled = !action.requiresModule || settings.moduleSettings[action.requiresModule as keyof typeof settings.moduleSettings];
              return (
                <Button
                  key={action.id}
                  variant="flat"
                  className={`h-24 flex flex-col items-center justify-center space-y-2 ${
                    isEnabled ? `bg-${action.color} text-white` : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  size="lg"
                  onClick={isEnabled ? action.action : undefined}
                  disabled={!isEnabled}
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-xs font-medium text-center">{action.title}</span>
                </Button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Recent Activity */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">�� Recent Activity</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {reservations.slice(0, 5).map((reservation) => (
              <div key={reservation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`h-3 w-3 rounded-full ${
                    reservation.status === 'checked-in' ? 'bg-green-500' :
                    reservation.status === 'confirmed' ? 'bg-blue-500' :
                    reservation.status === 'checked-out' ? 'bg-gray-500' :
                    'bg-yellow-500'
                  }`}></div>
                  <span className="text-sm text-gray-800">
                    {reservation.guestName} - {reservation.status} 
                    {reservation.roomId && ` (Room ${reservation.roomId})`}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    {new Date(reservation.arrival).toLocaleDateString()} → {new Date(reservation.departure).toLocaleDateString()}
                  </span>
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onClick={() => {
                      setSelectedReservation(reservation);
                      setIsReservationModalOpen(true);
                    }}
                  >
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderReservations = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📅 Reservations</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsReservationModalOpen(true)}
            >
              ➕ New Reservation
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Reservations table">
            <TableHeader>
              <TableColumn>Guest</TableColumn>
              <TableColumn>Dates</TableColumn>
              <TableColumn>Room</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Source</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{reservation.guestName}</div>
                      <div className="text-sm text-gray-500">
                        {reservation.adults} adult{reservation.adults > 1 ? 's' : ''}
                        {reservation.children > 0 && `, ${reservation.children} child${reservation.children > 1 ? 'ren' : ''}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Check-in: {new Date(reservation.arrival).toLocaleDateString()}</div>
                      <div>Check-out: {new Date(reservation.departure).toLocaleDateString()}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {reservation.roomId ? (
                      <Badge color="success" size="sm">Room {reservation.roomId}</Badge>
                    ) : (
                      <Badge color="warning" size="sm">Unassigned</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        reservation.status === 'checked-in' ? 'success' :
                        reservation.status === 'confirmed' ? 'primary' :
                        reservation.status === 'checked-out' ? 'default' :
                        'warning'
                      } 
                      size="sm"
                    >
                      {reservation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Chip color="primary" size="sm" variant="flat">
                      {reservation.source || 'Direct'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {reservation.status === 'confirmed' && (
                        <>
                          <Button size="sm" variant="flat" color="primary" onClick={() => setIsCheckInModalOpen(true)}>
                            Check In
                          </Button>
                          <Button size="sm" variant="flat" color="warning" onClick={() => setIsCheckOutModalOpen(true)}>
                            Cancel
                          </Button>
                        </>
                      )}
                      {reservation.status === 'checked-in' && (
                        <>
                          <Button size="sm" variant="flat" color="success" onClick={() => setIsCheckOutModalOpen(true)}>
                            Check Out
                          </Button>
                          <Button size="sm" variant="flat" color="primary" onClick={() => setIsPaymentModalOpen(true)}>
                            Payment
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="flat" color="secondary" onClick={() => {
                        setSelectedReservation(reservation);
                        setIsReservationModalOpen(true);
                      }}>
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderRoomAssignment = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🏠 Room Assignment</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Available Rooms */}
            <div>
              <h4 className="font-semibold mb-3">Available Rooms</h4>
              <div className="space-y-2">
                {rooms.filter(room => {
                  const isAssigned = reservations.some(r => r.roomId === room.id && r.status === 'checked-in');
                  return !isAssigned;
                }).map(room => (
                  <div key={room.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div>
                      <span className="font-semibold">Room {room.id}</span>
                      <span className="text-sm text-gray-600 ml-2">Floor {room.floor}</span>
                    </div>
                    <Badge color="success" size="sm">Available</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Assigned Rooms */}
            <div>
              <h4 className="font-semibold mb-3">Assigned Rooms</h4>
              <div className="space-y-2">
                {reservations.filter(r => r.roomId && r.status === 'checked-in').map(reservation => (
                  <div key={reservation.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <span className="font-semibold">Room {reservation.roomId}</span>
                      <span className="text-sm text-gray-600 ml-2">{reservation.guestName}</span>
                    </div>
                    <Badge color="primary" size="sm">Occupied</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderGuestSearch = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🔍 Guest Search</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <Input
              label="Search Guests"
              placeholder="Search by name, phone, email, or Ghana Card..."
              className="w-full"
            />
            
            <Table aria-label="Guest search results">
              <TableHeader>
                <TableColumn>Guest</TableColumn>
                <TableColumn>Contact</TableColumn>
                <TableColumn>Last Stay</TableColumn>
                <TableColumn>Total Stays</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody>
                {guests.slice(0, 10).map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell>
                      <div>
                        <div className="font-semibold">{guest.name}</div>
                        <div className="text-sm text-gray-500">{guest.nationality}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{guest.phone}</div>
                        <div>{guest.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {guest.lastVisit ? new Date(guest.lastVisit).toLocaleDateString() : 'Never'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge color="primary" size="sm">
                        {guest.totalStays || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="flat" color="primary">
                        View History
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🏨 Front Office Operations</h1>
          <p className="text-gray-600">Complete guest lifecycle management from reservation to check-out</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">SaaS Ready</Badge>
        </div>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="Overview" />
        <Tab key="reservations" title="Reservations" />
        <Tab key="room-assignment" title="Room Assignment" />
        <Tab key="guest-search" title="Guest Search" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'reservations' && renderReservations()}
        {selectedTab === 'room-assignment' && renderRoomAssignment()}
        {selectedTab === 'guest-search' && renderGuestSearch()}
      </div>

      {/* Reservation Modal */}
      <Modal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} size="4xl">
        <ModalContent>
          <ModalHeader>
            {selectedReservation ? 'Edit Reservation' : 'New Reservation'}
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Reservation form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsReservationModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsReservationModalOpen(false)}>
              {selectedReservation ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Check-in Modal */}
      <Modal isOpen={isCheckInModalOpen} onClose={() => setIsCheckInModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Check In Guest</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Room</label>
                <Select placeholder="Choose available room">
                  {rooms.filter(room => {
                    const isAssigned = reservations.some(r => r.roomId === room.id && r.status === 'checked-in');
                    return !isAssigned;
                  }).map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      Room {room.id} - Floor {room.floor}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea placeholder="Any special requests or notes..." />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsCheckInModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsCheckInModalOpen(false)}>
              Check In
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Check-out Modal */}
      <Modal isOpen={isCheckOutModalOpen} onClose={() => setIsCheckOutModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Check Out Guest</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Final Amount</label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <Select placeholder="Select payment method">
                  <SelectItem key="cash" value="cash">Cash</SelectItem>
                  <SelectItem key="card" value="card">Card</SelectItem>
                  <SelectItem key="mobile-money" value="mobile-money">Mobile Money</SelectItem>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea placeholder="Any feedback or notes..." />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsCheckOutModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsCheckOutModalOpen(false)}>
              Check Out
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Process Payment</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <Select placeholder="Select payment method">
                  <SelectItem key="cash" value="cash">Cash</SelectItem>
                  <SelectItem key="card" value="card">Card</SelectItem>
                  <SelectItem key="mobile-money" value="mobile-money">Mobile Money</SelectItem>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Reference</label>
                <Input placeholder="Transaction reference or notes..." />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsPaymentModalOpen(false)}>
              Process Payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
