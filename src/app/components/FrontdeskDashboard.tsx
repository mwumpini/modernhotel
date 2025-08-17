'use client';

import React, { useState } from 'react';
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
  Chip,
  Progress,
  Avatar,
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

interface Guest {
  id: string;
  name: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: 'checked-in' | 'checked-out' | 'extended' | 'vip';
  phone: string;
  email: string;
  nationality: string;
  ghanaCard: string;
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

export default function FrontdeskDashboard() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTab, setSelectedTab] = useState("overview");

  const guests: Guest[] = [
    {
      id: 'G001',
      name: 'John Doe',
      roomNumber: '205',
      checkIn: '2024-01-15',
      checkOut: '2024-01-18',
      status: 'checked-in',
      phone: '+233 24 123 4567',
      email: 'john.doe@email.com',
      nationality: 'Ghanaian',
      ghanaCard: 'GHA-123456789-0'
    },
    {
      id: 'G002',
      name: 'Sarah Johnson',
      roomNumber: '312',
      checkIn: '2024-01-14',
      checkOut: '2024-01-20',
      status: 'extended',
      phone: '+233 20 987 6543',
      email: 'sarah.j@email.com',
      nationality: 'American',
      ghanaCard: 'N/A'
    },
    {
      id: 'G003',
      name: 'Kwame Asante',
      roomNumber: '401',
      checkIn: '2024-01-10',
      checkOut: '2024-01-25',
      status: 'vip',
      phone: '+233 26 555 1234',
      email: 'kasante@company.com',
      nationality: 'Ghanaian',
      ghanaCard: 'GHA-987654321-0'
    }
  ];

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

  const rooms: Room[] = [
    { number: '101', type: 'Standard', status: 'available', rate: '₵600', floor: '1st' },
    { number: '102', type: 'Standard', status: 'occupied', guest: 'John Doe', checkIn: '2024-01-15', checkOut: '2024-01-18', rate: '₵600', floor: '1st' },
    { number: '103', type: 'Standard', status: 'cleaning', rate: '₵600', floor: '1st' },
    { number: '201', type: 'Deluxe', status: 'available', rate: '₵800', floor: '2nd' },
    { number: '202', type: 'Deluxe', status: 'reserved', rate: '₵800', floor: '2nd' },
    { number: '203', type: 'Deluxe', status: 'maintenance', rate: '₵800', floor: '2nd' },
    { number: '301', type: 'Suite', status: 'occupied', guest: 'Kwame Asante', checkIn: '2024-01-10', checkOut: '2024-01-25', rate: '₵1,200', floor: '3rd' },
    { number: '302', type: 'Suite', status: 'available', rate: '₵1,200', floor: '3rd' }
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

  const getGuestStatusColor = (status: string) => {
    switch (status) {
      case 'checked-in': return 'success';
      case 'checked-out': return 'default';
      case 'extended': return 'warning';
      case 'vip': return 'secondary';
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
              <h1 className="text-3xl font-bold text-ghana-black">🏨 Front Office Operations</h1>
              <p className="text-gray-600 mt-2">Guest Services & Room Management Center</p>
            </div>
            
            {/* System Status Indicators */}
            <div className="flex items-center space-x-4">
              <OfflineIndicator />
              <div className="text-center">
                <div className="h-3 w-3 bg-green-500 rounded-full mb-1"></div>
                <span className="text-sm font-medium text-green-600">Front Desk Open</span>
              </div>
              <div className="text-center">
                <div className="h-3 w-3 bg-blue-500 rounded-full mb-1"></div>
                <span className="text-sm font-medium text-blue-600">24/7 Service</span>
              </div>
            </div>
          </div>
        </div>

        {/* Room Status Overview */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <h2 className="text-xl font-semibold text-ghana-black">🏠 Room Status Overview - Ghana Hotel (50 Rooms)</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-lg font-semibold text-green-800">Available Rooms</span>
                </div>
                <p className="text-3xl font-bold text-green-600">28</p>
                <div className="text-sm text-green-700 mt-2">
                  <p>18 Standard Rooms</p>
                  <p>8 Deluxe Rooms</p>
                  <p>2 Suite Rooms</p>
                </div>
              </div>
              
              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <span className="text-lg font-semibold text-red-800">Occupied Rooms</span>
                </div>
                <p className="text-3xl font-bold text-red-600">20</p>
                <div className="text-sm text-red-700 mt-2">
                  <p>5 Checking Out Today</p>
                  <p>12 Extended Stays</p>
                  <p>3 VIP Guests</p>
                </div>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-lg font-semibold text-yellow-800">Maintenance & Cleaning</span>
                </div>
                <p className="text-3xl font-bold text-yellow-600">2</p>
                <div className="text-sm text-yellow-700 mt-2">
                  <p>1 Under Maintenance</p>
                  <p>1 Deep Cleaning</p>
                  <p>0 Ready Soon</p>
                </div>
              </div>
            </div>

            {/* Today's Room Operations */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-ghana-black mb-4">📅 Today's Room Operations</h3>
              <div className="flex items-center justify-between">
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-green-500 rounded"></div>
                    <span className="text-sm font-medium text-green-600">8 Check-ins</span>
                    <span className="text-xs text-gray-500">Starting 2:00 PM</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-blue-500 rounded"></div>
                    <span className="text-sm font-medium text-blue-600">5 Check-outs</span>
                    <span className="text-xs text-gray-500">By 12:00 PM</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-yellow-500 rounded"></div>
                    <span className="text-sm font-medium text-yellow-600">2 Maintenance</span>
                    <span className="text-xs text-gray-500">Scheduled</span>
                  </div>
                </div>
                <Button
                  color="primary"
                  className="bg-ghana-green text-white"
                  variant="flat"
                >
                  🏢 View Full Status
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Hotel Facilities & Services */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <h3 className="text-lg font-semibold text-ghana-black">🏨 Ghana Hotel Facilities & Services</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl mb-2">🛏️</div>
                <h4 className="font-semibold text-blue-800">50 Rooms</h4>
                <p className="text-sm text-blue-600">Accommodation</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-3xl mb-2">🏢</div>
                <h4 className="font-semibold text-purple-800">3 Conference Halls</h4>
                <p className="text-sm text-purple-600">Events & Meetings</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-3xl mb-2">☕</div>
                <h4 className="font-semibold text-green-800">Restaurant & Bar</h4>
                <p className="text-sm text-green-600">Dining</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-3xl mb-2">🏊</div>
                <h4 className="font-semibold text-orange-800">Swimming Pool</h4>
                <p className="text-sm text-orange-600">Recreation</p>
              </div>
              <div className="text-center p-4 bg-pink-50 rounded-lg border border-pink-200">
                <div className="text-3xl mb-2">✨</div>
                <h4 className="font-semibold text-pink-800">Massage Parlor</h4>
                <p className="text-sm text-pink-600">Wellness</p>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="text-3xl mb-2">🎵</div>
                <h4 className="font-semibold text-indigo-800">Nightclub</h4>
                <p className="text-sm text-indigo-600">Entertainment</p>
              </div>
              <div className="text-center p-4 bg-teal-50 rounded-lg border border-teal-200">
                <div className="text-3xl mb-2">🚗</div>
                <h4 className="font-semibold text-teal-800">Vehicle Rental</h4>
                <p className="text-sm text-teal-600">Transport</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-3xl mb-2">🛍️</div>
                <h4 className="font-semibold text-gray-800">Mini Shop</h4>
                <p className="text-sm text-gray-600">Essentials</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Free WiFi Internet</span>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Airport Pickup Service</span>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Tour Services</span>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">24/7 Front Desk</span>
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
              <Tab key="overview" title="📊 Overview" />
              <Tab key="rooms" title="🏠 Room Management" />
              <Tab key="guests" title="👥 Guest Services" />
              <Tab key="bookings" title="📅 Bookings" />
              <Tab key="conference" title="🏢 Conference Halls" />
            </Tabs>
          </CardHeader>
          <CardBody>
            {selectedTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Quick Actions */}
                <div>
                  <h3 className="text-lg font-semibold text-ghana-black mb-4">🚀 Quick Actions</h3>
                  <div className="space-y-3">
                    <Button
                      variant="flat"
                      className="w-full justify-start bg-ghana-green text-white h-12"
                      size="lg"
                    >
                      <span className="mr-3">📅</span>
                      Create New Booking
                    </Button>
                    <Button
                      variant="flat"
                      className="w-full justify-start bg-blue-500 text-white h-12"
                      size="lg"
                    >
                      <span className="mr-3">📄</span>
                      Generate Invoice
                    </Button>
                    <Button
                      variant="flat"
                      className="w-full justify-start bg-ghana-gold text-white h-12"
                      size="lg"
                    >
                      <span className="mr-3">👤</span>
                      Add New Client
                    </Button>
                    <Button
                      variant="flat"
                      className="w-full justify-start bg-purple-500 text-white h-12"
                      size="lg"
                    >
                      <span className="mr-3">🏢</span>
                      Book Conference Hall
                    </Button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h3 className="text-lg font-semibold text-ghana-black mb-4">📋 Recent Activity</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-800">Invoice #INV-001 sent (2 minutes ago)</span>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-800">New booking from John Doe (5 minutes ago)</span>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="h-3 w-3 bg-purple-500 rounded-full"></div>
                      <span className="text-sm text-gray-800">Hall 1 booked for conference (10 minutes ago)</span>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-800">Payment received (1 hour ago)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === "rooms" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">🏠 Room Status Grid</h3>
                  <Button
                    color="primary"
                    className="bg-ghana-green text-white"
                    variant="flat"
                    onClick={onOpen}
                  >
                    🔧 Manage Rooms
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {rooms.map((room) => (
                    <div
                      key={room.number}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                        room.status === 'available' ? 'bg-green-50 border-green-200' :
                        room.status === 'occupied' ? 'bg-red-50 border-red-200' :
                        room.status === 'maintenance' ? 'bg-yellow-50 border-yellow-200' :
                        room.status === 'cleaning' ? 'bg-blue-50 border-blue-200' :
                        'bg-purple-50 border-purple-200'
                      }`}
                    >
                      <div className="text-center">
                        <p className="font-bold text-lg text-ghana-black">{room.number}</p>
                        <p className="text-xs text-gray-600">{room.type}</p>
                        <Badge
                          color={getStatusColor(room.status)}
                          variant="flat"
                          size="sm"
                          className="mt-1"
                        >
                          {getStatusText(room.status)}
                        </Badge>
                        {room.guest && (
                          <p className="text-xs text-gray-600 mt-1 truncate">{room.guest}</p>
                        )}
                        <p className="text-xs font-semibold text-ghana-black mt-1">{room.rate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTab === "guests" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">👥 Current Guests</h3>
                  <Button
                    color="primary"
                    className="bg-ghana-green text-white"
                    variant="flat"
                  >
                    🔑 Check In/Out
                  </Button>
                </div>
                
                <Table aria-label="Current guests table">
                  <TableHeader>
                    <TableColumn>Guest</TableColumn>
                    <TableColumn>Room</TableColumn>
                    <TableColumn>Check In</TableColumn>
                    <TableColumn>Check Out</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Ghana Card</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {guests.map((guest) => (
                      <TableRow key={guest.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar
                              name={guest.name}
                              className="h-8 w-8 bg-gradient-to-br from-ghana-green to-ghana-gold text-white"
                            />
                            <div>
                              <p className="font-semibold text-ghana-black">{guest.name}</p>
                              <p className="text-xs text-gray-500">{guest.phone}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge color="primary" variant="flat">{guest.roomNumber}</Badge>
                        </TableCell>
                        <TableCell>{guest.checkIn}</TableCell>
                        <TableCell>{guest.checkOut}</TableCell>
                        <TableCell>
                          <Badge
                            color={getGuestStatusColor(guest.status)}
                            variant="flat"
                          >
                            {guest.status.replace('-', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                            {guest.ghanaCard}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="light">👁️</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedTab === "bookings" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">📅 Recent Bookings</h3>
                  <Button
                    color="primary"
                    className="bg-ghana-green text-white"
                    variant="flat"
                  >
                    📅 New Booking
                  </Button>
                </div>
                
                <Table aria-label="Bookings table">
                  <TableHeader>
                    <TableColumn>Guest</TableColumn>
                    <TableColumn>Room Type</TableColumn>
                    <TableColumn>Check In</TableColumn>
                    <TableColumn>Check Out</TableColumn>
                    <TableColumn>Amount</TableColumn>
                    <TableColumn>Payment</TableColumn>
                    <TableColumn>Source</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <p className="font-semibold text-ghana-black">{booking.guestName}</p>
                        </TableCell>
                        <TableCell>{booking.roomType}</TableCell>
                        <TableCell>{booking.checkIn}</TableCell>
                        <TableCell>{booking.checkOut}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-ghana-black">{booking.amount}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            color={getPaymentStatusColor(booking.paymentStatus)}
                            variant="flat"
                          >
                            {booking.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Chip variant="flat" color="primary" size="sm">
                            {booking.source}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedTab === "conference" && (
              <div>
                <h3 className="text-lg font-semibold text-ghana-black mb-4">🏢 Conference Halls Status</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="border-0 shadow-lg">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-ghana-black">Hall 1</h4>
                        <Badge color="success" variant="flat">Available</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Capacity: 70 people</p>
                      <p className="text-sm text-gray-600 mb-3">Next Booking: Tomorrow 9:00 AM</p>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">• Projector</p>
                        <p className="text-xs text-gray-500">• Sound System</p>
                        <p className="text-xs text-gray-500">• AC</p>
                        <p className="text-xs text-gray-500">• WiFi</p>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-ghana-black">Hall 2</h4>
                        <Badge color="danger" variant="flat">Occupied</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Capacity: 30 people</p>
                      <p className="text-sm text-gray-600 mb-3">Current Event: Board Meeting</p>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">• Projector</p>
                        <p className="text-xs text-gray-500">• Whiteboard</p>
                        <p className="text-xs text-gray-500">• AC</p>
                        <p className="text-xs text-gray-500">• WiFi</p>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-ghana-black">Hall 3</h4>
                        <Badge color="success" variant="flat">Available</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Capacity: 15 people</p>
                      <p className="text-sm text-gray-600 mb-3">Next Booking: Friday 2:00 PM</p>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">• Smart Board</p>
                        <p className="text-xs text-gray-500">• Video Conf</p>
                        <p className="text-xs text-gray-500">• AC</p>
                        <p className="text-xs text-gray-500">• WiFi</p>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Room Management Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>🔧 Room Management</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Room Number" placeholder="e.g., 101" />
                <Select label="Room Type" placeholder="Select type">
                  <SelectItem key="standard">Standard</SelectItem>
                  <SelectItem key="deluxe">Deluxe</SelectItem>
                  <SelectItem key="suite">Suite</SelectItem>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Status" placeholder="Select status">
                  <SelectItem key="available">Available</SelectItem>
                  <SelectItem key="occupied">Occupied</SelectItem>
                  <SelectItem key="maintenance">Maintenance</SelectItem>
                  <SelectItem key="cleaning">Cleaning</SelectItem>
                </Select>
                <Input label="Rate (₵)" placeholder="e.g., 600" />
              </div>
              <Input label="Floor" placeholder="e.g., 1st" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>Cancel</Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={onClose}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
