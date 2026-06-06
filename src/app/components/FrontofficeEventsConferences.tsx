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
  Tab,
  Autocomplete,
  AutocompleteItem
} from "@heroui/react";
import OfflineIndicator from './OfflineIndicator';
import { trackEvent } from '../lib/analytics/trackEvent';
import { enhancedFrontOfficeStore } from '../lib/frontoffice/enhancedStore';
import { frontOfficeStore } from '../lib/frontoffice/store';

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
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orgSearch, setOrgSearch] = useState('');

  const [form, setForm] = useState({
    title: '',
    organizer: '',
    corporateClientId: '' as string,
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    type: '' as 'conference' | 'wedding' | 'corporate' | 'seminar' | 'exhibition' | '',
    hallId: '',
    hallName: '',
    attendees: 0,
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    catering: false,
    audioVisual: false,
    decoration: false,
    specialRequirements: '',
    budget: ''
  });

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

  const [events, setEvents] = useState<Event[]>([
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
  ]);

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = 'Event title is required';
    if (!form.organizer.trim()) nextErrors.organizer = 'Organizer is required';
    if (!form.contactPerson.trim()) nextErrors.contactPerson = 'Contact person is required';
    if (!form.contactPhone.trim()) nextErrors.contactPhone = 'Contact phone is required';
    if (!form.contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) nextErrors.contactEmail = 'Valid email is required';
    if (!form.type) nextErrors.type = 'Event type is required';
    if (!form.hallId) nextErrors.hallId = 'Conference hall is required';
    if (!form.attendees || form.attendees <= 0) nextErrors.attendees = 'Attendees must be greater than 0';
    if (!form.startDate) nextErrors.startDate = 'Start date is required';
    if (!form.endDate) nextErrors.endDate = 'End date is required';
    if (!form.startTime) nextErrors.startTime = 'Start time is required';
    if (!form.endTime) nextErrors.endTime = 'End time is required';

    const hall = conferenceHalls.find(h => h.id === form.hallId);
    if (hall && form.attendees > hall.capacity) {
      nextErrors.attendees = `Attendees exceed hall capacity (${hall.capacity})`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setForm({
      title: '', organizer: '', corporateClientId: '', contactPerson: '', contactPhone: '', contactEmail: '',
      type: '', hallId: '', hallName: '', attendees: 0, startDate: '', endDate: '', startTime: '', endTime: '',
      catering: false, audioVisual: false, decoration: false, specialRequirements: '', budget: ''
    });
    setErrors({});
    setOrgSearch('');
  };

  const handleCreateEvent = () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const eventTypeMap: Record<string, 'conference' | 'training' | 'wedding' | 'corporate' | 'social'> = {
        conference: 'conference',
        seminar: 'conference',
        corporate: 'corporate',
        wedding: 'wedding',
        exhibition: 'social'
      };

      const mappedType = eventTypeMap[form.type] || 'conference';

      const newBooking = enhancedFrontOfficeStore.createEventBooking({
        eventName: form.title,
        eventType: mappedType,
        startDate: form.startDate,
        endDate: form.endDate,
        attendees: form.attendees,
        // No rate plan/package yet; can be linked later
        resources: form.hallId ? [{ resourceId: form.hallId, quantity: 1, startTime: form.startTime, endTime: form.endTime }] : [],
        rooms: [],
        costBreakdown: {
          accommodation: { baseCost: 0, corporateDiscount: 0, seasonalAdjustment: 0, finalCost: 0 },
          package: { baseCost: 0, corporateDiscount: 0, seasonalAdjustment: 0, finalCost: 0 },
          services: {
            dinner: form.catering ? 0 : 0,
            shuttle: 0,
            equipment: form.audioVisual ? 0 : 0,
            other: form.decoration ? 0 : 0
          },
          taxes: 0,
          totalCost: 0
        },
        totalCost: 0,
        depositPaid: 0,
        status: 'pending',
        clientId: `client_${Date.now()}`,
        clientName: form.organizer,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        specialRequirements: form.specialRequirements
      });

      // Update UI list immediately
      const hall = conferenceHalls.find(h => h.id === form.hallId);
      const uiEvent: Event = {
        id: newBooking.id,
        title: form.title,
        organizer: form.organizer,
        contactPerson: form.contactPerson,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        hallId: form.hallId,
        hallName: hall?.name || '',
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        attendees: form.attendees,
        status: 'pending',
        type: form.type || 'conference',
        catering: form.catering,
        audioVisual: form.audioVisual,
        decoration: form.decoration,
        totalCost: form.budget && form.budget.trim() ? form.budget : '₵0.00'
      };
      setEvents(prev => [uiEvent, ...prev]);

      trackEvent('FO.UI.NewEventForm.Submit', {
        id: newBooking.id,
        type: mappedType,
        attendees: form.attendees,
        hallId: form.hallId
      });

      onClose();
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

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
                <Input label="Event Title" placeholder="Enter event title" value={form.title} onChange={(e)=> setForm({ ...form, title: e.target.value })} />
                <Autocomplete
                  label="Organizer (Organization)"
                  placeholder="Type at least 2 letters to search..."
                  selectedKey={form.corporateClientId || undefined}
                  inputValue={form.organizer}
                  onSelectionChange={(key) => {
                    const id = typeof key === 'string' ? key : (key as any) || '';
                    if (!id) {
                      setForm({ ...form, corporateClientId: '', organizer: orgSearch });
                      return;
                    }
                    if (id.startsWith('custom:')) {
                      const value = id.replace('custom:', '');
                      setForm({ ...form, corporateClientId: '', organizer: value });
                      setOrgSearch(value);
                      return;
                    }
                    const g = frontOfficeStore.guests.find(c => c.id === id);
                    if (g) {
                      const org = g.employerCompany || g.company || g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim();
                      setForm({
                        ...form,
                        corporateClientId: g.id,
                        organizer: org,
                        contactPerson: g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim(),
                        contactPhone: g.companyPhone || g.phone || '',
                        contactEmail: g.email || ''
                      });
                      setOrgSearch(org);
                    }
                  }}
                  onInputChange={(value) => {
                    setOrgSearch(value);
                    setForm({ ...form, organizer: value, corporateClientId: '' });
                  }}
                >
                  {(() => {
                    const q = (orgSearch || '').trim();
                    const guests = frontOfficeStore.guests || [];
                    const results = q.length >= 2
                      ? guests.filter(g => {
                          const org = (g.employerCompany || g.company || '').toLowerCase();
                          const name = (g.name || `${g.firstName || ''} ${g.lastName || ''}`).toLowerCase();
                          const phone = (g.companyPhone || g.phone || '').toLowerCase();
                          return org.includes(q.toLowerCase()) || name.includes(q.toLowerCase()) || phone.includes(q.toLowerCase());
                        }).slice(0, 20)
                      : [];
                    const items = [] as React.ReactElement[];
                    if (q.length >= 2) {
                      items.push(
                        <AutocompleteItem key={`custom:${q}`} textValue={q}>
                          <div className="flex justify-between items-center w-full">
                            <span className="font-medium">Use "{q}"</span>
                            <span className="text-xs text-gray-500">Click to confirm</span>
                          </div>
                        </AutocompleteItem>
                      );
                    }
                    results.forEach(g => {
                      const org = g.employerCompany || g.company || (g.name || `${g.firstName || ''} ${g.lastName || ''}`).trim();
                      const person = g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim();
                      items.push(
                        <AutocompleteItem key={g.id} textValue={`${org} ${person}`}>
                          <div className="flex flex-col">
                            <span className="font-medium">{org}</span>
                            <span className="text-xs text-gray-600">{person} • {(g.companyPhone || g.phone || '')}</span>
                          </div>
                        </AutocompleteItem>
                      );
                    });
                    return items;
                  })()}
                </Autocomplete>
                <Input label="Contact Person" placeholder="Enter contact person" value={form.contactPerson} onChange={(e)=> setForm({ ...form, contactPerson: e.target.value })} />
                <Input label="Contact Phone" placeholder="+233 XX XXX XXXX" value={form.contactPhone} onChange={(e)=> setForm({ ...form, contactPhone: e.target.value })} />
                <Input label="Contact Email" placeholder="contact@email.com" value={form.contactEmail} onChange={(e)=> setForm({ ...form, contactEmail: e.target.value })} />
                <Select label="Event Type" placeholder="Select event type" selectedKeys={form.type ? [form.type] : []} onSelectionChange={(keys)=> setForm({ ...form, type: Array.from(keys)[0] as any })}>
                  <SelectItem key="conference">Conference</SelectItem>
                  <SelectItem key="wedding">Wedding</SelectItem>
                  <SelectItem key="corporate">Corporate</SelectItem>
                  <SelectItem key="seminar">Seminar</SelectItem>
                  <SelectItem key="exhibition">Exhibition</SelectItem>
                </Select>
                <Select label="Conference Hall" placeholder="Select hall" selectedKeys={form.hallId ? [form.hallId] : []} onSelectionChange={(keys)=> { const id = Array.from(keys)[0] as string; const hall = conferenceHalls.find(h => h.id === id); setForm({ ...form, hallId: id, hallName: hall?.name || '' }); }}>
                  {conferenceHalls.map(h => (
                    <SelectItem key={h.id}>{`${h.name} (${h.capacity} people)`}</SelectItem>
                  ))}
                </Select>
                <Input label="Expected Attendees" type="number" placeholder="Number of attendees" value={form.attendees ? String(form.attendees) : ''} onChange={(e)=> setForm({ ...form, attendees: parseInt(e.target.value || '0', 10) || 0 })} />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <Input label="Start Date" type="date" value={form.startDate} onChange={(e)=> setForm({ ...form, startDate: e.target.value })} />
                <Input label="End Date" type="date" value={form.endDate} onChange={(e)=> setForm({ ...form, endDate: e.target.value })} />
                <Input label="Start Time" type="time" value={form.startTime} onChange={(e)=> setForm({ ...form, startTime: e.target.value })} />
                <Input label="End Time" type="time" value={form.endTime} onChange={(e)=> setForm({ ...form, endTime: e.target.value })} />
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">Additional Services</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="catering" checked={form.catering} onChange={(e)=> setForm({ ...form, catering: e.target.checked })} />
                    <label htmlFor="catering">Catering Service</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="audiovisual" checked={form.audioVisual} onChange={(e)=> setForm({ ...form, audioVisual: e.target.checked })} />
                    <label htmlFor="audiovisual">Audio/Visual Equipment</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="decoration" checked={form.decoration} onChange={(e)=> setForm({ ...form, decoration: e.target.checked })} />
                    <label htmlFor="decoration">Decoration</label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input label="Special Requirements" placeholder="Any special requirements" value={form.specialRequirements} onChange={(e)=> setForm({ ...form, specialRequirements: e.target.value })} />
                <Input label="Estimated Budget" placeholder="₵0.00" value={form.budget} onChange={(e)=> setForm({ ...form, budget: e.target.value })} />
              </div>

              {/* Simple inline errors */}
              {Object.keys(errors).length > 0 && (
                <div className="mt-4 text-sm text-red-600">
                  {Object.values(errors).map((msg, idx) => (
                    <div key={idx}>{msg}</div>
                  ))}
              </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" isDisabled={submitting} onPress={handleCreateEvent}>
                {submitting ? 'Creating...' : 'Create Event'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
