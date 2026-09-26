'use client';

import React, { useState, useEffect } from 'react';
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
  AutocompleteItem,
  Textarea
} from "@heroui/react";
import OfflineIndicator from './OfflineIndicator';
import { trackEvent } from '../lib/analytics/trackEvent';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { fetchConferenceHalls, saveConferenceHall, fetchCateringItems, saveCateringItem, fetchEventBookings, saveEventBooking } from '../lib/frontoffice/eventsApi';
import { useSettingsStore } from '../lib/settings/store';

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

  const [conferenceHalls, setConferenceHalls] = useState<ConferenceHall[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const reloadHalls = () => {
    fetchConferenceHalls().then((rows: any[]) => setConferenceHalls(rows.map((h) => ({
      id: h.id,
      name: h.name,
      capacity: h.capacity,
      type: h.type,
      status: h.status,
      price: `₵${Number(h.price || 0).toLocaleString()}/day`,
      features: h.features || [],
      // currentEvent is computed at render time from live `events` state (see the
      // Halls table below) rather than baked in here, to avoid a stale closure.
    }))));
  };
  const reloadEvents = () => {
    fetchEventBookings().then((rows: any[]) => setEvents(rows.map((b) => ({
      id: b.id,
      title: b.title,
      organizer: b.organizer,
      contactPerson: b.contactPerson || '',
      contactPhone: b.contactPhone || '',
      contactEmail: b.contactEmail || '',
      hallId: b.hallId || '',
      hallName: b.hallName || '',
      startDate: (b.startDate || '').slice(0, 10),
      endDate: (b.endDate || '').slice(0, 10),
      startTime: b.startTime || '',
      endTime: b.endTime || '',
      attendees: b.attendees,
      status: b.status,
      type: b.type || 'conference',
      catering: b.catering,
      audioVisual: b.audioVisual,
      decoration: b.decoration,
      totalCost: `₵${Number(b.totalCost || 0).toLocaleString()}`,
    }))));
  };
  useEffect(() => { reloadHalls(); reloadEvents(); reloadCatering(); }, []);

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

  const handleCreateEvent = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const hall = conferenceHalls.find(h => h.id === form.hallId);
      const id = useSettingsStore.getState().getNextModuleNumber('events', 'eventBooking');
      const budget = Number((form.budget || '0').replace(/[^\d.]/g, '')) || 0;

      const booking = await saveEventBooking({
        id,
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
        totalCost: budget,
      });

      trackEvent('FO.UI.NewEventForm.Submit', {
        id: booking.id,
        type: form.type,
        attendees: form.attendees,
        hallId: form.hallId
      });

      reloadEvents();
      onClose();
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const [cateringServices, setCateringServices] = useState<CateringService[]>([]);
  const reloadCatering = () => {
    fetchCateringItems().then((rows: any[]) => setCateringServices(rows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      price: `₵${Number(c.price || 0).toLocaleString()}/person`,
      category: c.category,
      minimumOrder: c.minimumOrder,
      available: c.available,
    }))));
  };

  // Add Hall modal
  const { isOpen: isHallOpen, onOpen: onHallOpen, onClose: onHallClose } = useDisclosure();
  const [hallForm, setHallForm] = useState({ name: '', capacity: '50', type: 'meeting' as ConferenceHall['type'], price: '0', features: '' });
  const submitHall = async () => {
    if (!hallForm.name) return;
    await saveConferenceHall({
      id: `HALL-${Date.now().toString().slice(-8)}`,
      name: hallForm.name,
      capacity: Number(hallForm.capacity) || 0,
      type: hallForm.type,
      status: 'available',
      price: Number(hallForm.price) || 0,
      features: hallForm.features.split(',').map((f) => f.trim()).filter(Boolean),
    });
    setHallForm({ name: '', capacity: '50', type: 'meeting', price: '0', features: '' });
    onHallClose();
    reloadHalls();
  };

  // Add Catering Item modal
  const { isOpen: isCateringOpen, onOpen: onCateringOpen, onClose: onCateringClose } = useDisclosure();
  const [cateringForm, setCateringForm] = useState({ name: '', description: '', price: '0', category: 'breakfast' as CateringService['category'], minimumOrder: '1' });
  const submitCatering = async () => {
    if (!cateringForm.name) return;
    await saveCateringItem({
      id: `CAT-${Date.now().toString().slice(-8)}`,
      name: cateringForm.name,
      description: cateringForm.description,
      price: Number(cateringForm.price) || 0,
      category: cateringForm.category,
      minimumOrder: Number(cateringForm.minimumOrder) || 1,
      available: true,
    });
    setCateringForm({ name: '', description: '', price: '0', category: 'breakfast', minimumOrder: '1' });
    onCateringClose();
    reloadCatering();
  };

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
                  <Button color="primary" variant="flat" size="sm" onPress={onHallOpen}>
                    ➕ Add Hall
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
                          {(() => {
                            const current = events.find((e) => e.hallId === hall.id && e.status === 'confirmed');
                            return current ? (
                              <span className="text-sm text-gray-600">{current.title}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            );
                          })()}
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
                            <p className="font-mono text-xs text-gray-500">{event.id}</p>
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
                  <Button color="primary" variant="flat" size="sm" onPress={onCateringOpen}>
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
                          if (g.isActive === false) return false;
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

        <Modal isOpen={isHallOpen} onClose={onHallClose}>
          <ModalContent>
            <ModalHeader>Add Conference Hall</ModalHeader>
            <ModalBody>
              <Input label="Name" value={hallForm.name} onChange={(e) => setHallForm({ ...hallForm, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Capacity" type="number" value={hallForm.capacity} onChange={(e) => setHallForm({ ...hallForm, capacity: e.target.value })} />
                <Select label="Type" selectedKeys={[hallForm.type]} onSelectionChange={(k) => setHallForm({ ...hallForm, type: (Array.from(k)[0] as any) || 'meeting' })}>
                  <SelectItem key="conference">Conference</SelectItem>
                  <SelectItem key="meeting">Meeting</SelectItem>
                  <SelectItem key="banquet">Banquet</SelectItem>
                  <SelectItem key="auditorium">Auditorium</SelectItem>
                </Select>
              </div>
              <Input label="Price per day (₵)" type="number" value={hallForm.price} onChange={(e) => setHallForm({ ...hallForm, price: e.target.value })} />
              <Input label="Features (comma-separated)" placeholder="Projector, WiFi, Air Conditioning" value={hallForm.features} onChange={(e) => setHallForm({ ...hallForm, features: e.target.value })} />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onHallClose}>Cancel</Button>
              <Button color="primary" onPress={submitHall} isDisabled={!hallForm.name}>Add Hall</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={isCateringOpen} onClose={onCateringClose}>
          <ModalContent>
            <ModalHeader>Add Catering Service</ModalHeader>
            <ModalBody>
              <Input label="Name" value={cateringForm.name} onChange={(e) => setCateringForm({ ...cateringForm, name: e.target.value })} />
              <Textarea label="Description" value={cateringForm.description} onChange={(e) => setCateringForm({ ...cateringForm, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Price per person (₵)" type="number" value={cateringForm.price} onChange={(e) => setCateringForm({ ...cateringForm, price: e.target.value })} />
                <Select label="Category" selectedKeys={[cateringForm.category]} onSelectionChange={(k) => setCateringForm({ ...cateringForm, category: (Array.from(k)[0] as any) || 'breakfast' })}>
                  <SelectItem key="breakfast">Breakfast</SelectItem>
                  <SelectItem key="lunch">Lunch</SelectItem>
                  <SelectItem key="dinner">Dinner</SelectItem>
                  <SelectItem key="snacks">Snacks</SelectItem>
                  <SelectItem key="beverages">Beverages</SelectItem>
                </Select>
              </div>
              <Input label="Minimum Order (people)" type="number" value={cateringForm.minimumOrder} onChange={(e) => setCateringForm({ ...cateringForm, minimumOrder: e.target.value })} />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onCateringClose}>Cancel</Button>
              <Button color="primary" onPress={submitCatering} isDisabled={!cateringForm.name}>Add Service</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
