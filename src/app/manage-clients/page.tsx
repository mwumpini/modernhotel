'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Input,
  Select,
  SelectItem,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Badge,
  Avatar,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tabs,
  Tab,
  Divider,
  Pagination
} from "@heroui/react";
import { frontOfficeStore } from '../lib/frontoffice/store';
import { GuestProfile, Nationality, IdType, Reservation } from '../lib/frontoffice/types';
import { trackEvent } from '../lib/analytics/trackEvent';
import PageLayout from '../components/PageLayout';

interface ClientFormData {
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  email: string;
  nationality: Nationality;
  idType: IdType;
  idNumber: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
    email: string;
  };
  address: string;
  city: string;
  country: string;
  notes: string;
  source: 'reservation' | 'direct' | 'walk_in' | 'corporate';
  reservationId?: string;
}

interface ClientWithReservations extends GuestProfile {
  reservationCount: number;
  totalSpent: number;
  lastVisit: string;
  averageStay: number;
  preferences: string[];
}

export default function ManageClientsPage() {
  const [clients, setClients] = useState<ClientWithReservations[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientWithReservations[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<GuestProfile | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
    email: '',
    nationality: 'ghanaian',
    idType: 'ghana_card',
    idNumber: '',
    dateOfBirth: '',
    gender: 'male',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      email: ''
    },
    address: '',
    city: '',
    country: 'Ghana',
    notes: '',
    source: 'direct'
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    filterClients();
  }, [searchTerm, clients]);

  const loadClients = () => {
    const guests = frontOfficeStore.guests;
    const reservations = frontOfficeStore.reservations;
    
    const clientsWithData: ClientWithReservations[] = guests.map(guest => {
      const guestReservations = reservations.filter(r => r.guestId === guest.id);
      const totalSpent = guestReservations.reduce((sum, r) => {
        if (r.rateBreakdown && r.rateBreakdown.length > 0) {
          return sum + r.rateBreakdown.reduce((dailySum, day) => dailySum + day.total, 0);
        }
        return sum;
      }, 0);
      const lastVisit = guestReservations.length > 0 
        ? Math.max(...guestReservations.map(r => new Date(r.createdAt).getTime()))
        : 0;
      const averageStay = guestReservations.length > 0 
        ? guestReservations.reduce((sum, r) => {
            const arrival = new Date(r.arrival);
            const departure = new Date(r.departure);
            return sum + Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / guestReservations.length
        : 0;

      return {
        ...guest,
        reservationCount: guestReservations.length,
        totalSpent,
        lastVisit: lastVisit ? new Date(lastVisit).toISOString() : '',
        averageStay: Math.round(averageStay),
        preferences: guestReservations
          .filter(r => r.stayReason)
          .map(r => r.stayReason!)
          .filter((value, index, self) => self.indexOf(value) === index)
      };
    });

    setClients(clientsWithData);
  };

  const filterClients = () => {
    if (!searchTerm.trim()) {
      setFilteredClients(clients);
      return;
    }

    const filtered = clients.filter(client =>
      client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.middleName && client.middleName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      client.phone?.includes(searchTerm) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.nationality.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.idNumber?.includes(searchTerm) ||
      client.serialNumber?.includes(searchTerm)
    );
    setFilteredClients(filtered);
  };

  const handleCreateClient = () => {
    setIsCreating(true);
    setSelectedClient(null);
    setSelectedReservation(null);
    setFormData({
      firstName: '',
      lastName: '',
      middleName: '',
      phone: '',
      email: '',
      nationality: 'ghanaian',
      idType: 'ghana_card',
      idNumber: '',
      dateOfBirth: '',
      gender: 'male',
      emergencyContact: {
        name: '',
        relationship: '',
        phone: '',
        email: ''
      },
      address: '',
      city: '',
      country: 'Ghana',
      notes: '',
      source: 'direct'
    });
    setIsModalOpen(true);
  };

  const handleCreateFromReservation = (reservation: Reservation) => {
    setIsCreating(true);
    setSelectedClient(null);
    setSelectedReservation(reservation);
    setFormData({
      firstName: reservation.guestName?.split(' ')[0] || '',
      lastName: reservation.guestName?.split(' ').slice(-1)[0] || '',
      middleName: reservation.guestName?.split(' ').slice(1, -1).join(' ') || '',
      phone: '',
      email: '',
      nationality: 'ghanaian',
      idType: 'ghana_card',
      idNumber: '',
      dateOfBirth: '',
      gender: 'male',
      emergencyContact: {
        name: '',
        relationship: '',
        phone: '',
        email: ''
      },
      address: '',
      city: '',
      country: 'Ghana',
      notes: `Created from reservation ${reservation.id}`,
      source: 'reservation',
      reservationId: reservation.id
    });
    setIsModalOpen(true);
  };

  const handleEditClient = (client: GuestProfile) => {
    setIsCreating(false);
    setSelectedClient(client);
    setSelectedReservation(null);
    setFormData({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      middleName: client.middleName || '',
      phone: client.phone || '',
      email: client.email || '',
      nationality: client.nationality || 'ghanaian',
      idType: client.idType || 'ghana_card',
      idNumber: client.idNumber || '',
      dateOfBirth: client.dateOfBirth || '',
      gender: client.gender || 'male',
      emergencyContact: {
        name: client.emergencyContact?.name || '',
        relationship: client.emergencyContact?.relationship || '',
        phone: client.emergencyContact?.phone || '',
        email: client.emergencyContact?.email || ''
      },
      address: client.address || '',
      city: client.city || '',
      country: client.country || 'Ghana',
      notes: client.notes || '',
      source: 'direct'
    });
    setIsModalOpen(true);
  };

  const handleSaveClient = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert('First name and last name are required');
      return;
    }

    try {
      if (isCreating) {
        if (selectedReservation && formData.reservationId) {
          // Create client from reservation
          const newClient = frontOfficeStore.createClientFromReservation(formData.reservationId, {
            firstName: formData.firstName,
            lastName: formData.lastName,
            middleName: formData.middleName,
            phone: formData.phone,
            email: formData.email,
            nationality: formData.nationality,
            idType: formData.idType,
            idNumber: formData.idNumber,
            dateOfBirth: formData.dateOfBirth,
            gender: formData.gender,
            emergencyContact: formData.emergencyContact,
            address: formData.address,
            city: formData.city,
            country: formData.country,
            notes: formData.notes
          });
          
          trackEvent('FO.Client.CreatedFromReservation', {
            id: newClient.id,
            name: `${newClient.firstName} ${newClient.lastName}`,
            nationality: newClient.nationality,
            reservationId: formData.reservationId
          });
        } else {
          // Create new client directly
          const newClient = frontOfficeStore.createGuest({
            firstName: formData.firstName,
            lastName: formData.lastName,
            middleName: formData.middleName,
            phone: formData.phone,
            email: formData.email,
            nationality: formData.nationality,
            idType: formData.idType,
            idNumber: formData.idNumber,
            dateOfBirth: formData.dateOfBirth,
            gender: formData.gender,
            emergencyContact: formData.emergencyContact,
            address: formData.address,
            city: formData.city,
            country: formData.country,
            notes: formData.notes
          });
          
          trackEvent('FO.Client.Created', {
            id: newClient.id,
            name: `${newClient.firstName} ${newClient.lastName}`,
            nationality: newClient.nationality,
            source: formData.source
          });
        }
      } else if (selectedClient) {
        const updatedClient = frontOfficeStore.updateGuest(selectedClient.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName,
          phone: formData.phone,
          email: formData.email,
          nationality: formData.nationality,
          idType: formData.idType,
          idNumber: formData.idNumber,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          emergencyContact: formData.emergencyContact,
          address: formData.address,
          city: formData.city,
          country: formData.country,
          notes: formData.notes
        });
        
        if (updatedClient) {
          trackEvent('FO.Client.Updated', {
            id: updatedClient.id,
            name: `${updatedClient.firstName} ${updatedClient.lastName}`,
            nationality: updatedClient.nationality
          });
        }
      }

      setIsModalOpen(false);
      loadClients();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Failed to save client. Please try again.');
    }
  };

  const handleDeleteClient = (client: GuestProfile) => {
    if (confirm(`Are you sure you want to delete ${client.firstName} ${client.lastName}?`)) {
      const deletedClient = frontOfficeStore.deleteGuest(client.id);
      if (deletedClient) {
        trackEvent('FO.Client.Deleted', {
          id: deletedClient.id,
          name: `${deletedClient.firstName} ${deletedClient.lastName}`
        });
        loadClients();
      }
    }
  };

  const getNationalityFlag = (nationality: Nationality) => {
    const flags: Record<Nationality, string> = {
      ghanaian: '🇬🇭',
      nigerian: '🇳🇬',
      kenyan: '🇰🇪',
      south_african: '🇿🇦',
      egyptian: '🇪🇬',
      moroccan: '🇲🇦',
      ethiopian: '🇪🇹',
      ugandan: '🇺🇬',
      tanzanian: '🇹🇿',
      rwandan: '🇷🇼',
      ghanaian_diaspora: '🇬🇭',
      other: '🌍'
    };
    return flags[nationality] || '🌍';
  };

  const getClientValue = (client: ClientWithReservations) => {
    if (client.totalSpent > 10000) return 'high';
    if (client.totalSpent > 5000) return 'medium';
    return 'low';
  };

  const getValueColor = (value: string) => {
    switch (value) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getValueLabel = (value: string) => {
    switch (value) {
      case 'high': return 'VIP';
      case 'medium': return 'Regular';
      case 'low': return 'New';
      default: return 'New';
    }
  };

  const paginatedClients = filteredClients.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">👥 Manage Clients</h1>
            <p className="text-sm sm:text-base text-gray-600">Comprehensive client profile management and analytics</p>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              color="primary"
              variant="flat"
              onClick={handleCreateClient}
              className="text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-3"
            >
              ➕ New Client
            </Button>
            <Button
              color="secondary"
              variant="flat"
              onClick={() => {
                // TODO: Import clients from external source
                alert('Import functionality coming soon!');
              }}
              className="text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-3"
            >
              📥 Import Clients
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Card className="bg-blue-50 border-blue-200">
            <CardBody className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600">Total Clients</p>
                  <p className="text-xl font-bold text-blue-900">{clients.length}</p>
                </div>
                <div className="text-2xl">👥</div>
              </div>
            </CardBody>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardBody className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600">Active Clients</p>
                  <p className="text-xl font-bold text-green-900">
                    {clients.filter(c => c.reservationCount > 0).length}
                  </p>
                </div>
                <div className="text-2xl">✅</div>
              </div>
            </CardBody>
          </Card>

          <Card className="bg-purple-50 border-purple-200">
            <CardBody className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600">VIP Clients</p>
                  <p className="text-xl font-bold text-purple-900">
                    {clients.filter(c => getClientValue(c) === 'high').length}
                  </p>
                </div>
                <div className="text-2xl">👑</div>
              </div>
            </CardBody>
          </Card>

          <Card className="bg-orange-50 border-orange-200">
            <CardBody className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-600">Total Revenue</p>
                  <p className="text-xl font-bold text-orange-900">
                    ₵{clients.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-2xl">💰</div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by first name, last name, phone, email, ID number, or serial number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                startContent={<span className="text-gray-400">🔍</span>}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Tip: You can search by first name, last name, or middle name separately for better results
              </p>
            </div>
            <div className="flex gap-2">
              <Select
                placeholder="Filter by nationality"
                className="w-40"
                onChange={(e) => {
                  if (e.target.value) {
                    setFilteredClients(clients.filter(c => c.nationality === e.target.value));
                  } else {
                    setFilteredClients(clients);
                  }
                }}
              >
                <SelectItem key="">All Nationalities</SelectItem>
                <SelectItem key="ghanaian">🇬🇭 Ghanaian</SelectItem>
                <SelectItem key="nigerian">🇳🇬 Nigerian</SelectItem>
                <SelectItem key="kenyan">🇰🇪 Kenyan</SelectItem>
                <SelectItem key="other">🌍 Other</SelectItem>
              </Select>
              <Select
                placeholder="Filter by value"
                className="w-32"
                onChange={(e) => {
                  if (e.target.value) {
                    setFilteredClients(clients.filter(c => getClientValue(c) === e.target.value));
                  } else {
                    setFilteredClients(clients);
                  }
                }}
              >
                <SelectItem key="">All Values</SelectItem>
                <SelectItem key="high">VIP</SelectItem>
                <SelectItem key="medium">Regular</SelectItem>
                <SelectItem key="low">New</SelectItem>
              </Select>
            </div>
          </div>
        </div>

        {/* Reservations Without Clients */}
        {(() => {
          const reservationsWithoutClients = frontOfficeStore.getReservationsWithoutClients();
          if (reservationsWithoutClients.length > 0) {
            return (
              <Card className="mb-6 border-orange-200 bg-orange-50">
                <CardHeader className="pb-3">
                  <h3 className="text-lg font-semibold text-orange-900">⚠️ Reservations Without Client Profiles</h3>
                  <p className="text-sm text-orange-700">
                    {reservationsWithoutClients.length} reservation(s) need client profiles to be created
                  </p>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    <Table aria-label="Reservations without clients">
                      <TableHeader>
                        <TableColumn>Reservation ID</TableColumn>
                        <TableColumn>Guest Name</TableColumn>
                        <TableColumn>Dates</TableColumn>
                        <TableColumn>Room Type</TableColumn>
                        <TableColumn>Action</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {reservationsWithoutClients.slice(0, 5).map((reservation) => (
                          <TableRow key={reservation.id}>
                            <TableCell>
                              <span className="font-mono text-sm">{reservation.id}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{reservation.guestName || 'Unnamed Guest'}</span>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>Arrival: {new Date(reservation.arrival).toLocaleDateString()}</p>
                                <p>Departure: {new Date(reservation.departure).toLocaleDateString()}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{reservation.roomTypeId}</span>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                onClick={() => handleCreateFromReservation(reservation)}
                              >
                                ➕ Create Client
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {reservationsWithoutClients.length > 5 && (
                    <div className="p-4 text-center text-sm text-orange-600">
                      And {reservationsWithoutClients.length - 5} more reservations...
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          }
          return null;
        })()}

        {/* Clients Table */}
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <Table aria-label="Clients table">
                <TableHeader>
                  <TableColumn>Client</TableColumn>
                  <TableColumn className="hidden sm:table-cell">Contact</TableColumn>
                  <TableColumn className="hidden md:table-cell">Nationality</TableColumn>
                  <TableColumn className="hidden lg:table-cell">Reservations</TableColumn>
                  <TableColumn className="hidden xl:table-cell">Value & Spending</TableColumn>
                  <TableColumn className="hidden lg:table-cell">Last Visit</TableColumn>
                  <TableColumn>Actions</TableColumn>
                </TableHeader>
                <TableBody>
                  {paginatedClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar
                            name={`${client.firstName} ${client.lastName}`}
                            size="sm"
                            className="bg-blue-100 text-blue-800"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{`${client.firstName} ${client.lastName}`}</p>
                            <p className="text-sm text-gray-500">#{client.serialNumber}</p>
                            <Badge 
                              color={getValueColor(getClientValue(client))} 
                              variant="flat"
                              size="sm"
                            >
                              {getValueLabel(getClientValue(client))}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="hidden sm:table-cell">
                        <div className="space-y-1">
                          {client.phone && (
                            <p className="text-sm text-gray-600">📱 {client.phone}</p>
                          )}
                          {client.email && (
                            <p className="text-sm text-gray-600">📧 {client.email}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getNationalityFlag(client.nationality)}</span>
                          <Chip size="sm" variant="flat" color="primary">
                            {client.nationality.replace('_', ' ').toUpperCase()}
                          </Chip>
                        </div>
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-900">
                            {client.reservationCount} reservations
                          </p>
                          <p className="text-xs text-gray-500">
                            Avg stay: {client.averageStay} days
                          </p>
                          {client.preferences.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {client.preferences.slice(0, 2).map((pref, idx) => (
                                <Chip key={idx} size="sm" variant="flat" color="secondary">
                                  {pref}
                                </Chip>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="hidden xl:table-cell">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-900">
                            ₵{client.totalSpent.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            Total spent
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">
                        {client.lastVisit ? (
                          <div className="text-sm text-gray-600">
                            {new Date(client.lastVisit).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Never</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Dropdown>
                          <DropdownTrigger>
                            <Button variant="light" size="sm">
                              ⋯
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu>
                            <DropdownItem onClick={() => handleEditClient(client)}>
                              ✏️ Edit
                            </DropdownItem>
                            <DropdownItem onClick={() => handleDeleteClient(client)}>
                              🗑️ Delete
                            </DropdownItem>
                            <DropdownItem>
                              📊 View History
                            </DropdownItem>
                            <DropdownItem>
                              🔑 Generate Check-in Link
                            </DropdownItem>
                            <DropdownItem>
                              💳 View Billing
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardBody>
        </Card>

        {/* Pagination */}
        {filteredClients.length > rowsPerPage && (
          <div className="flex justify-center mt-6">
            <Pagination
              total={Math.ceil(filteredClients.length / rowsPerPage)}
              page={page}
              onChange={setPage}
              showControls
              color="primary"
            />
          </div>
        )}

        {/* Client Modal */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          size="4xl"
          className="mx-2 sm:mx-4"
        >
          <ModalContent>
            <ModalHeader>
              <h2 className="text-xl font-semibold">
                {isCreating ? '➕ Create New Client' : '✏️ Edit Client'}
                {selectedReservation && (
                  <span className="text-sm text-gray-500 ml-2">
                    (from reservation {selectedReservation.id})
                  </span>
                )}
              </h2>
            </ModalHeader>
            <ModalBody>
              <Tabs aria-label="Client information tabs">
                <Tab key="basic" title="👤 Basic Information">
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                        <Input
                          value={formData.firstName}
                          onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                          placeholder="First name"
                          isRequired
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                        <Input
                          value={formData.lastName}
                          onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                          placeholder="Last name"
                          isRequired
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                        <Input
                          value={formData.middleName}
                          onChange={(e) => setFormData({...formData, middleName: e.target.value})}
                          placeholder="Middle name (optional)"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          placeholder="Phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <Input
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          placeholder="Email address"
                          type="email"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                        <Select
                          value={formData.gender}
                          onChange={(e) => setFormData({...formData, gender: e.target.value as 'male' | 'female' | 'other'})}
                        >
                          <SelectItem key="male">👨 Male</SelectItem>
                          <SelectItem key="female">👩 Female</SelectItem>
                          <SelectItem key="other">👤 Other</SelectItem>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                        <Input
                          value={formData.dateOfBirth}
                          onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                          type="date"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                        <Select
                          value={formData.nationality}
                          onChange={(e) => setFormData({...formData, nationality: e.target.value as Nationality})}
                        >
                          <SelectItem key="ghanaian">🇬🇭 Ghanaian</SelectItem>
                          <SelectItem key="nigerian">🇳🇬 Nigerian</SelectItem>
                          <SelectItem key="kenyan">🇰🇪 Kenyan</SelectItem>
                          <SelectItem key="south_african">🇿🇦 South African</SelectItem>
                          <SelectItem key="egyptian">🇪🇬 Egyptian</SelectItem>
                          <SelectItem key="moroccan">🇲🇦 Moroccan</SelectItem>
                          <SelectItem key="ethiopian">🇪🇹 Ethiopian</SelectItem>
                          <SelectItem key="ugandan">🇺🇬 Ugandan</SelectItem>
                          <SelectItem key="tanzanian">🇹🇿 Tanzanian</SelectItem>
                          <SelectItem key="rwandan">🇷🇼 Rwandan</SelectItem>
                          <SelectItem key="ghanaian_diaspora">🇬🇭 Ghanaian Diaspora</SelectItem>
                          <SelectItem key="other">🌍 Other</SelectItem>
                        </Select>
                      </div>
                    </div>

                    {isCreating && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                        <Select
                          value={formData.source}
                          onChange={(e) => setFormData({...formData, source: e.target.value as any})}
                        >
                          <SelectItem key="direct">👤 Direct Registration</SelectItem>
                          <SelectItem key="reservation">📅 From Reservation</SelectItem>
                          <SelectItem key="walk_in">🚶 Walk-in</SelectItem>
                          <SelectItem key="corporate">🏢 Corporate</SelectItem>
                        </Select>
                      </div>
                    )}
                  </div>
                </Tab>

                <Tab key="identification" title="🆔 Identification">
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ID Type</label>
                        <Select
                          value={formData.idType}
                          onChange={(e) => setFormData({...formData, idType: e.target.value as IdType})}
                        >
                          <SelectItem key="ghana_card">🆔 Ghana Card</SelectItem>
                          <SelectItem key="passport">📘 Passport</SelectItem>
                          <SelectItem key="drivers_license">🚗 Driver's License</SelectItem>
                          <SelectItem key="voters_id">🗳️ Voter's ID</SelectItem>
                          <SelectItem key="nhis_card">🏥 NHIS Card</SelectItem>
                          <SelectItem key="other">📋 Other</SelectItem>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                        <Input
                          value={formData.idNumber}
                          onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                          placeholder="Enter ID number"
                        />
                      </div>
                    </div>
                  </div>
                </Tab>

                <Tab key="emergency" title="🚨 Emergency Contact">
                  <div className="space-y-4 pt-4">
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                          <Input
                            value={formData.emergencyContact.name}
                            onChange={(e) => setFormData({
                              ...formData, 
                              emergencyContact: {...formData.emergencyContact, name: e.target.value}
                            })}
                            placeholder="Emergency contact name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                          <Select
                            value={formData.emergencyContact.relationship}
                            onChange={(e) => setFormData({
                              ...formData, 
                              emergencyContact: {...formData.emergencyContact, relationship: e.target.value}
                            })}
                          >
                            <SelectItem key="spouse">💑 Spouse</SelectItem>
                            <SelectItem key="parent">👨‍👩‍👧‍👦 Parent</SelectItem>
                            <SelectItem key="sibling">👥 Sibling</SelectItem>
                            <SelectItem key="friend">👫 Friend</SelectItem>
                            <SelectItem key="colleague">💼 Colleague</SelectItem>
                            <SelectItem key="other">📋 Other</SelectItem>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                          <Input
                            value={formData.emergencyContact.phone}
                            onChange={(e) => setFormData({
                              ...formData, 
                              emergencyContact: {...formData.emergencyContact, phone: e.target.value}
                            })}
                            placeholder="Emergency contact phone"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <Input
                            value={formData.emergencyContact.email}
                            onChange={(e) => setFormData({
                              ...formData, 
                              emergencyContact: {...formData.emergencyContact, email: e.target.value}
                            })}
                            placeholder="Emergency contact email"
                            type="email"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Tab>

                <Tab key="address" title="📍 Address">
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <Textarea
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        placeholder="Full address"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <Input
                          value={formData.city}
                          onChange={(e) => setFormData({...formData, city: e.target.value})}
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                        <Input
                          value={formData.country}
                          onChange={(e) => setFormData({...formData, country: e.target.value})}
                          placeholder="Country"
                        />
                      </div>
                    </div>
                  </div>
                </Tab>

                <Tab key="notes" title="📝 Notes">
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Any additional information, preferences, or special requirements..."
                        rows={5}
                      />
                    </div>
                  </div>
                </Tab>
              </Tabs>
            </ModalBody>
            <ModalFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-end">
              <Button color="primary" onClick={handleSaveClient} className="w-full sm:w-auto">
                {isCreating ? '💾 Create Client' : '💾 Update Client'}
              </Button>
              <Button variant="light" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
         </Modal>
       </div>
     </div>
     </PageLayout>
   );
 }
