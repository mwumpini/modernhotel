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

interface ConferenceHall {
  id: string;
  name: string;
  capacity: number;
  type: 'conference' | 'meeting' | 'banquet' | 'auditorium';
  status: 'available' | 'booked' | 'maintenance' | 'setup';
  price: string;
  features: string[];
  currentEvent?: string;
}

interface Event {
  id: string;
  title: string;
  organizer: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  hallId: string;
  hallName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  attendees: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  type: 'conference' | 'wedding' | 'corporate' | 'seminar' | 'exhibition';
  catering: boolean;
  audioVisual: boolean;
  decoration: boolean;
  totalCost: string;
}

interface CateringService {
  id: string;
  name: string;
  description: string;
  price: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'beverages';
  minimumOrder: number;
  available: boolean;
}

export default function FrontofficeEventsConferences() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTab, setSelectedTab] = useState("halls");

  const conferenceHalls: ConferenceHall[] = [
    {
      id: 'H001',
      name: 'Accra Conference Hall',
      capacity: 200,
      type: 'conference',
      status: 'booked',
      price: '₵5,000/day',
      features: ['Projector', 'Sound System', 'Air Conditioning', 'WiFi'],
      currentEvent: 'Tech Conference 2024'
    },
    {
      id: 'H002',
      name: 'Kumasi Meeting Room',
      capacity: 50,
      type: 'meeting',
      status: 'available',
      price: '₵2,000/day',
      features: ['Projector', 'Whiteboard', 'Coffee Service']
    },
    {
      id: 'H003',
      name: 'Ghana Banquet Hall',
      capacity: 300,
      type: 'banquet',
      status: 'setup',
      price: '₵8,000/day',
      features: ['Dance Floor', 'Bar Setup', 'Catering Kitchen', 'Parking'],
      currentEvent: 'Wedding Reception'
    },
    {
      id: 'H004',
      name: 'Accra Auditorium',
      capacity: 500,
      type: 'auditorium',
      status: 'available',
      price: '₵12,000/day',
      features: ['Stage', 'Professional Sound', 'Lighting', 'VIP Seating']
    }
  ];

  const events: Event[] = [
    {
      id: 'E001',
      title: 'Tech Conference 2024',
      organizer: 'Ghana Tech Hub',
      contactPerson: 'Kwame Mensah',
      contactPhone: '+233 24 123 4567',
      contactEmail: 'kwame@ghana-tech.com',
      hallId: 'H001',
      hallName: 'Accra Conference Hall',
      startDate: '2024-01-20',
      endDate: '2024-01-22',
      startTime: '09:00',
      endTime: '17:00',
      attendees: 180,
      status: 'confirmed',
      type: 'conference',
      catering: true,
      audioVisual: true,
      decoration: false,
      totalCost: '₵25,000'
    },
    {
      id: 'E002',
      title: 'Wedding Reception - Sarah & John',
      organizer: 'Sarah Johnson',
      contactPerson: 'Sarah Johnson',
      contactPhone: '+233 20 987 6543',
      contactEmail: 'sarah.j@email.com',
      hallId: 'H003',
      hallName: 'Ghana Banquet Hall',
      startDate: '2024-01-25',
      endDate: '2024-01-25',
      startTime: '18:00',
      endTime: '23:00',
      attendees: 250,
      status: 'confirmed',
      type: 'wedding',
      catering: true,
      audioVisual: true,
      decoration: true,
      totalCost: '₵35,000'
    },
    {
      id: 'E003',
      title: 'Corporate Training - ABC Company',
      organizer: 'ABC Company Ltd.',
      contactPerson: 'David Osei',
      contactPhone: '+233 26 555 1234',
      contactEmail: 'david@abc-company.com',
      hallId: 'H002',
      hallName: 'Kumasi Meeting Room',
      startDate: '2024-01-28',
      endDate: '2024-01-29',
      startTime: '08:00',
      endTime: '16:00',
      attendees: 40,
      status: 'pending',
      type: 'corporate',
      catering: true,
      audioVisual: true,
      decoration: false,
      totalCost: '₵8,000'
    }
  ];

  const cateringServices: CateringService[] = [
    {
      id: 'C001',
      name: 'Continental Breakfast',
      description: 'Assorted pastries, fresh fruits, coffee, tea, and juice',
      price: '₵50/person',
      category: 'breakfast',
      minimumOrder: 10,
      available: true
    },
    {
      id: 'C002',
      name: 'Ghanaian Lunch Buffet',
      description: 'Jollof rice, grilled chicken, plantains, and local vegetables',
      price: '₵80/person',
      category: 'lunch',
      minimumOrder: 15,
      available: true
    },
    {
      id: 'C003',
      name: 'Elegant Dinner Service',
      description: 'Three-course meal with wine pairing options',
      price: '₵120/person',
      category: 'dinner',
      minimumOrder: 20,
      available: true
    },
    {
      id: 'C004',
      name: 'Coffee & Tea Break',
      description: 'Assorted coffee, tea, cookies, and light snacks',
      price: '₵25/person',
      category: 'snacks',
      minimumOrder: 5,
      available: true
    }
  ];

  const getHallStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'booked': return 'danger';
      case 'maintenance': return 'warning';
      case 'setup': return 'secondary';
      default: return 'default';
    }
  };

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'danger';
      case 'completed': return 'default';
      default: return 'default';
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'conference': return 'primary';
      case 'wedding': return 'secondary';
      case 'corporate': return 'success';
      case 'seminar': return 'warning';
      case 'exhibition': return 'danger';
      default: return 'default';
    }
  };

  const getCateringCategoryColor = (category: string) => {
    switch (category) {
      case 'breakfast': return 'warning';
      case 'lunch': return 'success';
      case 'dinner': return 'secondary';
      case 'snacks': return 'primary';
      case 'beverages': return 'danger';
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
              <h1 className="text-3xl font-bold text-ghana-black">🏢 Events & Conferences</h1>
              <p className="text-gray-600 mt-2">Complete event management and conference facilities</p>
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
                📅 New Event
              </Button>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <h2 className="text-xl font-semibold text-ghana-black">📊 Events & Conferences Overview</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl mb-2">🏢</div>
                <p className="text-2xl font-bold text-blue-600">4</p>
                <p className="text-sm text-blue-700">Conference Halls</p>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-3xl mb-2">📅</div>
                <p className="text-2xl font-bold text-green-600">12</p>
                <p className="text-sm text-green-700">Events This Month</p>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-3xl mb-2">💰</div>
                <p className="text-2xl font-bold text-purple-600">₵68,000</p>
                <p className="text-sm text-purple-700">Revenue This Month</p>
              </div>

              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-3xl mb-2">👥</div>
                <p className="text-2xl font-bold text-orange-600">470</p>
                <p className="text-sm text-orange-700">Total Attendees</p>
              </div>
            </div>

            {/* Hall Capacity Overview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-ghana-black mb-4">🏢 Hall Capacity Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl mb-1">🎤</div>
                  <p className="text-lg font-bold text-blue-600">200</p>
                  <p className="text-sm text-gray-600">Accra Conference</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl mb-1">💼</div>
                  <p className="text-lg font-bold text-green-600">50</p>
                  <p className="text-sm text-gray-600">Kumasi Meeting</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl mb-1">🎉</div>
                  <p className="text-lg font-bold text-purple-600">300</p>
                  <p className="text-sm text-gray-600">Ghana Banquet</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl mb-1">🎭</div>
                  <p className="text-lg font-bold text-orange-600">500</p>
                  <p className="text-sm text-gray-600">Accra Auditorium</p>
                </div>
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
              <Tab key="halls" title="🏢 Conference Halls" />
              <Tab key="events" title="📅 Events" />
              <Tab key="catering" title="🍽️ Catering Services" />
            </Tabs>
          </CardHeader>
          <CardBody>
            {selectedTab === 'halls' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">Conference Hall Management</h3>
                  <Button color="primary" variant="flat" size="sm">
                    📊 Availability
                  </Button>
                </div>
                <Table aria-label="Conference halls table">
                  <TableHeader>
                    <TableColumn>Hall Name</TableColumn>
                    <TableColumn>Type</TableColumn>
                    <TableColumn>Capacity</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Price</TableColumn>
                    <TableColumn>Features</TableColumn>
                    <TableColumn>Current Event</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {conferenceHalls.map((hall) => (
                      <TableRow key={hall.id}>
                        <TableCell className="font-semibold">{hall.name}</TableCell>
                        <TableCell>
                          <Chip size="sm" color="primary">{hall.type}</Chip>
                        </TableCell>
                        <TableCell>{hall.capacity} people</TableCell>
                        <TableCell>
                          <Chip 
                            color={getHallStatusColor(hall.status)}
                            size="sm"
                          >
                            {hall.status}
                          </Chip>
                        </TableCell>
                        <TableCell className="font-semibold">{hall.price}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {hall.features.slice(0, 2).map((feature, index) => (
                              <Chip key={index} size="sm" variant="flat">{feature}</Chip>
                            ))}
                            {hall.features.length > 2 && (
                              <Chip size="sm" variant="flat">+{hall.features.length - 2} more</Chip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {hall.currentEvent ? (
                            <span className="text-sm text-gray-600">{hall.currentEvent}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">
                              View
                            </Button>
                            {hall.status === 'available' && (
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

            {selectedTab === 'events' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">Event Management</h3>
                  <Button color="primary" variant="flat" size="sm">
                    📊 Calendar
                  </Button>
                </div>
                <Table aria-label="Events table">
                  <TableHeader>
                    <TableColumn>Event</TableColumn>
                    <TableColumn>Organizer</TableColumn>
                    <TableColumn>Hall</TableColumn>
                    <TableColumn>Date & Time</TableColumn>
                    <TableColumn>Attendees</TableColumn>
                    <TableColumn>Type</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Total Cost</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold">{event.title}</p>
                            <p className="text-sm text-gray-500">{event.contactPerson}</p>
                          </div>
                        </TableCell>
                        <TableCell>{event.organizer}</TableCell>
                        <TableCell>{event.hallName}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{event.startDate}</p>
                            <p className="text-sm text-gray-500">{event.startTime} - {event.endTime}</p>
                          </div>
                        </TableCell>
                        <TableCell>{event.attendees} people</TableCell>
                        <TableCell>
                          <Chip 
                            color={getEventTypeColor(event.type)}
                            size="sm"
                          >
                            {event.type}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            color={getEventStatusColor(event.status)}
                            size="sm"
                          >
                            {event.status}
                          </Chip>
                        </TableCell>
                        <TableCell className="font-semibold">{event.totalCost}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">
                              View
                            </Button>
                            <Button size="sm" color="secondary" variant="flat">
                              Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedTab === 'catering' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">Catering Services</h3>
                  <Button color="primary" variant="flat" size="sm">
                    ➕ Add Service
                  </Button>
                </div>
                <Table aria-label="Catering services table">
                  <TableHeader>
                    <TableColumn>Service</TableColumn>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Description</TableColumn>
                    <TableColumn>Price</TableColumn>
                    <TableColumn>Minimum Order</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {cateringServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-semibold">{service.name}</TableCell>
                        <TableCell>
                          <Chip 
                            color={getCateringCategoryColor(service.category)}
                            size="sm"
                          >
                            {service.category}
                          </Chip>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{service.description}</TableCell>
                        <TableCell className="font-semibold">{service.price}</TableCell>
                        <TableCell>{service.minimumOrder} people</TableCell>
                        <TableCell>
                          <Chip 
                            color={service.available ? 'success' : 'danger'}
                            size="sm"
                          >
                            {service.available ? 'Available' : 'Unavailable'}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">
                              Edit
                            </Button>
                            <Button size="sm" color="success" variant="flat">
                              Order
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* New Event Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="4xl">
          <ModalContent>
            <ModalHeader>📅 Create New Event</ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Input label="Event Title" placeholder="Enter event title" />
                <Input label="Organizer" placeholder="Enter organizer name" />
                <Input label="Contact Person" placeholder="Enter contact person" />
                <Input label="Contact Phone" placeholder="+233 XX XXX XXXX" />
                <Input label="Contact Email" placeholder="contact@email.com" />
                <Select label="Event Type" placeholder="Select event type">
                  <SelectItem key="conference">Conference</SelectItem>
                  <SelectItem key="wedding">Wedding</SelectItem>
                  <SelectItem key="corporate">Corporate</SelectItem>
                  <SelectItem key="seminar">Seminar</SelectItem>
                  <SelectItem key="exhibition">Exhibition</SelectItem>
                </Select>
                <Select label="Conference Hall" placeholder="Select hall">
                  <SelectItem key="H001">Accra Conference Hall (200 people)</SelectItem>
                  <SelectItem key="H002">Kumasi Meeting Room (50 people)</SelectItem>
                  <SelectItem key="H003">Ghana Banquet Hall (300 people)</SelectItem>
                  <SelectItem key="H004">Accra Auditorium (500 people)</SelectItem>
                </Select>
                <Input label="Expected Attendees" type="number" placeholder="Number of attendees" />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <Input label="Start Date" type="date" />
                <Input label="End Date" type="date" />
                <Input label="Start Time" type="time" />
                <Input label="End Time" type="time" />
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">Additional Services</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="catering" />
                    <label htmlFor="catering">Catering Service</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="audiovisual" />
                    <label htmlFor="audiovisual">Audio/Visual Equipment</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="decoration" />
                    <label htmlFor="decoration">Decoration</label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input label="Special Requirements" placeholder="Any special requirements" />
                <Input label="Estimated Budget" placeholder="₵0.00" />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={onClose}>
                Create Event
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
