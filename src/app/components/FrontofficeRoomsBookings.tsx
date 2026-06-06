'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Select,
  SelectItem,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tabs,
  Tab
} from "@heroui/react";
import OfflineIndicator from './OfflineIndicator';
import FrontofficeReservations from './FrontofficeReservations';
import FrontofficeRoomGrid from './FrontofficeRoomGrid';

interface Room {
  number: string;
  type: string;
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'reserved';
  guest?: string;
  checkIn?: string;
  checkOut?: string;
  rate: string;
  floor: string;
}

interface Booking {
  id: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  amount: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
  source: string;
}

export default function FrontofficeRoomsBookings() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTab, setSelectedTab] = useState("rooms");

  const rooms: Room[] = []; // Clean slate - no rooms configured

  const bookings: Booking[] = [
    {
      id: 'B001',
      guestName: 'Michael Brown',
      roomType: 'Deluxe Room',
      checkIn: '2024-01-16',
      checkOut: '2024-01-19',
      status: 'confirmed',
      amount: '₵2,400',
      paymentStatus: 'paid',
      source: 'Direct Booking'
    },
    {
      id: 'B002',
      guestName: 'Lisa Wang',
      roomType: 'Standard Room',
      checkIn: '2024-01-17',
      checkOut: '2024-01-20',
      status: 'pending',
      amount: '₵1,800',
      paymentStatus: 'pending',
      source: 'Booking.com'
    },
    {
      id: 'B003',
      guestName: 'David Osei',
      roomType: 'Suite',
      checkIn: '2024-01-18',
      checkOut: '2024-01-22',
      status: 'confirmed',
      amount: '₵4,500',
      paymentStatus: 'partial',
      source: 'Corporate'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'occupied': return 'danger';
      case 'maintenance': return 'warning';
      case 'cleaning': return 'secondary';
      case 'reserved': return 'primary';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Available';
      case 'occupied': return 'Occupied';
      case 'maintenance': return 'Maintenance';
      case 'cleaning': return 'Cleaning';
      case 'reserved': return 'Reserved';
      default: return status;
    }
  };

  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'partial': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ghana-black">🏠 Rooms & Bookings</h1>
              <p className="text-gray-600 mt-2">Complete room management and booking system</p>
            </div>
            
            {/* System Status Indicators */}
            <div className="flex items-center space-x-4">
              <OfflineIndicator />
              <Button
                color="primary"
                className="bg-ghana-green text-white"
                variant="flat"
                onPress={onOpen}
              >
                📝 New Booking
              </Button>
            </div>
          </div>
        </div>

        {/* Room Status Overview */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <h2 className="text-xl font-semibold text-ghana-black">🏨 Room Status Overview</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-3xl mb-2">🟢</div>
                <p className="text-2xl font-bold text-green-600">0</p>
                <p className="text-sm text-green-700">Available</p>
              </div>
              
              <div className="text-center p-2 bg-red-50 rounded-lg border border-red-200">
                <div className="text-3xl mb-2">🔴</div>
                <p className="text-2xl font-bold text-red-600">0</p>
                <p className="text-sm text-red-700">Occupied</p>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-3xl mb-2">🟡</div>
                <p className="text-2xl font-bold text-yellow-600">0</p>
                <p className="text-sm text-yellow-700">Maintenance</p>
              </div>

              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl mb-2">🔵</div>
                <p className="text-2xl font-bold text-blue-600">0</p>
                <p className="text-sm text-blue-700">Today's Check-ins</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Main Content Tabs */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <Tabs 
              selectedKey={selectedTab} 
              onSelectionChange={(key) => setSelectedTab(key as string)}
              className="w-full"
            >
              <Tab key="rooms" title="🏠 Room Management" />
              <Tab key="bookings" title="📅 Bookings" />
              <Tab key="reservations" title="📋 Reservations" />
              <Tab key="grid" title="🗂️ Room Grid" />
            </Tabs>
          </CardHeader>
          <CardBody>
            {selectedTab === 'rooms' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">Room Status</h3>
                  <Button color="primary" variant="flat" size="sm">
                    🔄 Refresh
                  </Button>
                </div>
                <Table aria-label="Room status table">
                  <TableHeader>
                    <TableColumn>Room</TableColumn>
                    <TableColumn>Type</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Guest</TableColumn>
                    <TableColumn>Check In</TableColumn>
                    <TableColumn>Check Out</TableColumn>
                    <TableColumn>Rate</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {rooms.map((room) => (
                      <TableRow key={room.number}>
                        <TableCell className="font-semibold">{room.number}</TableCell>
                        <TableCell>{room.type}</TableCell>
                        <TableCell>
                          <Chip 
                            color={getStatusColor(room.status)}
                            size="sm"
                          >
                            {getStatusText(room.status)}
                          </Chip>
                        </TableCell>
                        <TableCell>{room.guest || '-'}</TableCell>
                        <TableCell>{room.checkIn || '-'}</TableCell>
                        <TableCell>{room.checkOut || '-'}</TableCell>
                        <TableCell className="font-semibold">{room.rate}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">
                              View
                            </Button>
                            {room.status === 'available' && (
                              <Button size="sm" color="success" variant="flat">
                                Book
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedTab === 'bookings' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">Recent Bookings</h3>
                  <Button color="primary" variant="flat" size="sm">
                    📊 View All
                  </Button>
                </div>
                <Table aria-label="Bookings table">
                  <TableHeader>
                    <TableColumn>Booking ID</TableColumn>
                    <TableColumn>Guest</TableColumn>
                    <TableColumn>Room Type</TableColumn>
                    <TableColumn>Check In</TableColumn>
                    <TableColumn>Check Out</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Payment</TableColumn>
                    <TableColumn>Amount</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-semibold">{booking.id}</TableCell>
                        <TableCell>{booking.guestName}</TableCell>
                        <TableCell>{booking.roomType}</TableCell>
                        <TableCell>{booking.checkIn}</TableCell>
                        <TableCell>{booking.checkOut}</TableCell>
                        <TableCell>
                          <Chip 
                            color={getBookingStatusColor(booking.status)}
                            size="sm"
                          >
                            {booking.status}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            color={getPaymentStatusColor(booking.paymentStatus)}
                            size="sm"
                          >
                            {booking.paymentStatus}
                          </Chip>
                        </TableCell>
                        <TableCell className="font-semibold">{booking.amount}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">
                              Edit
                            </Button>
                            <Button size="sm" color="secondary" variant="flat">
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedTab === 'reservations' && (
              <div>
                <FrontofficeReservations />
              </div>
            )}

            {selectedTab === 'grid' && (
              <div>
                <FrontofficeRoomGrid />
              </div>
            )}
          </CardBody>
        </Card>

        {/* New Booking Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="2xl">
          <ModalContent>
            <ModalHeader>📝 New Booking</ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Guest Name" placeholder="Enter guest name" />
                <Input label="Phone Number" placeholder="+233 XX XXX XXXX" />
                <Input label="Email" placeholder="guest@email.com" />
                <Select label="Room Type" placeholder="Select room type">
                  <SelectItem key="standard">Standard Room</SelectItem>
                  <SelectItem key="deluxe">Deluxe Room</SelectItem>
                  <SelectItem key="suite">Suite</SelectItem>
                </Select>
                <Input label="Check In Date" type="date" />
                <Input label="Check Out Date" type="date" />
                <Input label="Number of Guests" type="number" />
                <Select label="Payment Method" placeholder="Select payment method">
                  <SelectItem key="cash">Cash</SelectItem>
                  <SelectItem key="card">Credit Card</SelectItem>
                  <SelectItem key="mobile">Mobile Money</SelectItem>
                </Select>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={onClose}>
                Create Booking
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
