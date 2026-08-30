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
  Chip,
  Avatar,
  useDisclosure,
  Tabs,
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Select,
  SelectItem,
  Textarea
} from "@heroui/react";
import OfflineIndicator from './OfflineIndicator';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { getFolioDisplayTotals } from '../lib/frontoffice/helpers/folio';
import { fetchGuestServices, saveGuestService, fetchServiceRequests, saveServiceRequest } from '../lib/frontoffice/guestServicesApi';
// GuestForm removed in favor of canonical client form redirect

interface Client {
  id: string;
  serialNumber: string;
  name: string;
  email: string;
  phone: string;
  nationality: string;
  ghanaCard?: string;
  passport?: string;
  vipStatus: 'regular' | 'silver' | 'gold' | 'platinum';
  totalStays: number;
  totalSpent: string;
  lastVisit: string;
  preferences: string[];
}

interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  status: 'available' | 'unavailable' | 'maintenance';
  provider: string;
}

interface ServiceRequest {
  id: string;
  clientName: string;
  serviceName: string;
  roomNumber: string;
  requestDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  notes: string;
}

export default function FrontofficeClientsServices() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTab, setSelectedTab] = useState("clients");
  const [, setTick] = useState(0);
  React.useEffect(() => {
    const unsub = frontOfficeStore.subscribe(() => setTick((t) => t + 1));
    return () => unsub();
  }, []);

  const clients: Client[] = frontOfficeStore.guests.map((g) => {
    const guestReservations = frontOfficeStore.reservations.filter((r) => r.guestId === g.id);
    const totalSpent = guestReservations.reduce((sum, r) => {
      const folio = frontOfficeStore.folios.find((f) => f.reservationId === r.id);
      return sum + (folio ? getFolioDisplayTotals(folio).totalCharges : 0);
    }, 0);
    const lastVisit = guestReservations
      .map((r) => r.arrival)
      .sort()
      .slice(-1)[0];
    return {
      id: g.id,
      serialNumber: g.serialNumber,
      name: g.name || `${g.firstName} ${g.lastName}`.trim(),
      email: g.email || '',
      phone: g.phone || '',
      nationality: g.nationality,
      ghanaCard: g.idType === 'ghana_card' ? g.idNumber : undefined,
      passport: g.idType === 'passport' ? g.idNumber : undefined,
      vipStatus: (g.vipStatus as Client['vipStatus']) || 'regular',
      totalStays: guestReservations.length,
      totalSpent: `₵${totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      lastVisit: lastVisit ? lastVisit.slice(0, 10) : 'Never',
      preferences: g.specialRequests || [],
    };
  });

  const [rawServices, setRawServices] = useState<any[]>([]);
  const [rawRequests, setRawRequests] = useState<any[]>([]);

  const reloadServices = () => { fetchGuestServices().then(setRawServices); };
  const reloadRequests = () => { fetchServiceRequests().then(setRawRequests); };
  useEffect(() => { reloadServices(); reloadRequests(); }, []);

  const services: Service[] = rawServices.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description || '',
    price: `₵${Number(s.price || 0).toLocaleString()}`,
    status: s.status,
    provider: s.provider || '',
  }));

  const serviceRequests: ServiceRequest[] = rawRequests.map((r) => ({
    id: r.id,
    clientName: r.clientName,
    serviceName: rawServices.find((s) => s.id === r.serviceId)?.name || 'Unknown service',
    roomNumber: r.roomNumber || '',
    requestDate: (r.requestDate || '').slice(0, 10),
    status: r.status,
    priority: r.priority,
    notes: r.notes || '',
  }));

  // Add Service modal
  const { isOpen: isServiceOpen, onOpen: onServiceOpen, onClose: onServiceClose } = useDisclosure();
  const [serviceForm, setServiceForm] = useState({ name: '', category: '', description: '', price: '0', provider: '' });
  const submitService = async () => {
    if (!serviceForm.name || !serviceForm.category) return;
    await saveGuestService({
      id: `SVC-${Date.now().toString().slice(-8)}`,
      name: serviceForm.name,
      category: serviceForm.category,
      description: serviceForm.description,
      price: Number(serviceForm.price) || 0,
      status: 'available',
      provider: serviceForm.provider,
    });
    setServiceForm({ name: '', category: '', description: '', price: '0', provider: '' });
    onServiceClose();
    reloadServices();
  };

  // Log Service Request modal
  const { isOpen: isRequestOpen, onOpen: onRequestOpen, onClose: onRequestClose } = useDisclosure();
  const [requestServiceId, setRequestServiceId] = useState('');
  const [requestForm, setRequestForm] = useState({ clientName: '', roomNumber: '', priority: 'medium' as 'low' | 'medium' | 'high', notes: '' });
  const openRequestModal = (serviceId: string) => { setRequestServiceId(serviceId); onRequestOpen(); };
  const submitRequest = async () => {
    if (!requestServiceId || !requestForm.clientName) return;
    await saveServiceRequest({
      id: `SR-${Date.now().toString().slice(-8)}`,
      serviceId: requestServiceId,
      clientName: requestForm.clientName,
      roomNumber: requestForm.roomNumber,
      requestDate: new Date().toISOString(),
      status: 'pending',
      priority: requestForm.priority,
      notes: requestForm.notes,
    });
    setRequestForm({ clientName: '', roomNumber: '', priority: 'medium', notes: '' });
    onRequestClose();
    reloadRequests();
  };

  const getVipStatusColor = (status: string) => {
    switch (status) {
      case 'platinum': return 'secondary';
      case 'gold': return 'warning';
      case 'silver': return 'default';
      case 'regular': return 'primary';
      default: return 'default';
    }
  };

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'unavailable': return 'danger';
      case 'maintenance': return 'warning';
      default: return 'default';
    }
  };

  const getRequestStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'pending': return 'primary';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'success';
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
              <h1 className="text-3xl font-bold text-ghana-black">👥 Clients & Services</h1>
              <p className="text-gray-600 mt-2">Guest profile management and hotel services</p>
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
                👤 New Client
              </Button>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <h2 className="text-xl font-semibold text-ghana-black">📊 Client & Service Overview</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl mb-2">👥</div>
                <p className="text-2xl font-bold text-blue-600">{clients.length}</p>
                <p className="text-sm text-blue-700">Total Clients</p>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-3xl mb-2">⭐</div>
                <p className="text-2xl font-bold text-green-600">{clients.filter(c => c.vipStatus !== 'regular').length}</p>
                <p className="text-sm text-green-700">VIP Clients</p>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-3xl mb-2">🛎️</div>
                <p className="text-2xl font-bold text-purple-600">{services.filter(s => s.status === 'available').length}</p>
                <p className="text-sm text-purple-700">Active Services</p>
              </div>

              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-2xl font-bold text-orange-600">{serviceRequests.filter(r => r.status === 'pending').length}</p>
                <p className="text-sm text-orange-700">Pending Requests</p>
              </div>
            </div>

            {/* Ghana Card Integration */}
            <div className="bg-gradient-to-r from-ghana-red/10 to-ghana-gold/10 rounded-lg p-4 border border-ghana-red/20">
              <h3 className="text-lg font-semibold text-ghana-black mb-2">🇬🇭 Ghana Card Integration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Ghana Card Scanner</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Auto ID Verification</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Digital Check-in</span>
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
              <Tab key="clients" title="👥 Clients" />
              <Tab key="services" title="🛎️ Services" />
              <Tab key="requests" title="📋 Service Requests" />
            </Tabs>
          </CardHeader>
          <CardBody>
            {selectedTab === 'clients' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">Client Management</h3>
                  <Button color="primary" variant="flat" size="sm">
                    📊 Export
                  </Button>
                </div>
                <Table aria-label="Clients table">
                  <TableHeader>
                    <TableColumn>Serial #</TableColumn>
                    <TableColumn>Client</TableColumn>
                    <TableColumn>Contact</TableColumn>
                    <TableColumn>Nationality</TableColumn>
                    <TableColumn>ID Number</TableColumn>
                    <TableColumn>VIP Status</TableColumn>
                    <TableColumn>Total Stays</TableColumn>
                    <TableColumn>Total Spent</TableColumn>
                    <TableColumn>Last Visit</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <Chip size="sm" color="primary" variant="flat">
                            {client.serialNumber}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar name={client.name} size="sm" />
                            <div>
                              <p className="font-semibold">{client.name}</p>
                              <p className="text-sm text-gray-500">{client.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{client.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>{client.nationality}</TableCell>
                        <TableCell>
                          {client.ghanaCard ? (
                            <Chip size="sm" color="success">🇬🇭 {client.ghanaCard}</Chip>
                          ) : (
                            <Chip size="sm" color="primary">🛂 {client.passport}</Chip>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            color={getVipStatusColor(client.vipStatus)}
                            size="sm"
                          >
                            {client.vipStatus.toUpperCase()}
                          </Chip>
                        </TableCell>
                        <TableCell>{client.totalStays}</TableCell>
                        <TableCell className="font-semibold">{client.totalSpent}</TableCell>
                        <TableCell>{client.lastVisit}</TableCell>
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

            {selectedTab === 'services' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">Hotel Services</h3>
                  <Button color="primary" variant="flat" size="sm" onPress={onServiceOpen}>
                    ➕ Add Service
                  </Button>
                </div>
                <Table aria-label="Services table">
                  <TableHeader>
                    <TableColumn>Service</TableColumn>
                    <TableColumn>Category</TableColumn>
                    <TableColumn>Description</TableColumn>
                    <TableColumn>Price</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Provider</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {services.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-semibold">{service.name}</TableCell>
                        <TableCell>
                          <Chip size="sm" color="primary">{service.category}</Chip>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{service.description}</TableCell>
                        <TableCell className="font-semibold">{service.price}</TableCell>
                        <TableCell>
                          <Chip 
                            color={getServiceStatusColor(service.status)}
                            size="sm"
                          >
                            {service.status}
                          </Chip>
                        </TableCell>
                        <TableCell>{service.provider}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="success" variant="flat" onPress={() => openRequestModal(service.id)}>
                              Book
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedTab === 'requests' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-ghana-black">Service Requests</h3>
                  <Button color="primary" variant="flat" size="sm">
                    🔄 Refresh
                  </Button>
                </div>
                <Table aria-label="Service requests table">
                  <TableHeader>
                    <TableColumn>Request ID</TableColumn>
                    <TableColumn>Client</TableColumn>
                    <TableColumn>Service</TableColumn>
                    <TableColumn>Room</TableColumn>
                    <TableColumn>Date</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Priority</TableColumn>
                    <TableColumn>Notes</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {serviceRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-semibold">{request.id}</TableCell>
                        <TableCell>{request.clientName}</TableCell>
                        <TableCell>{request.serviceName}</TableCell>
                        <TableCell>{request.roomNumber}</TableCell>
                        <TableCell>{request.requestDate}</TableCell>
                        <TableCell>
                          <Chip 
                            color={getRequestStatusColor(request.status)}
                            size="sm"
                          >
                            {request.status.replace('_', ' ')}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            color={getPriorityColor(request.priority)}
                            size="sm"
                          >
                            {request.priority}
                          </Chip>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{request.notes}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" color="primary" variant="flat">
                              View
                            </Button>
                            {request.status === 'pending' && (
                              <Button size="sm" color="success" variant="flat">
                                Start
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
          </CardBody>
        </Card>

        {/* New Client → use canonical form */}
        <div className="fixed bottom-6 right-6 z-20">
          <Button color="primary" onPress={() => {
            window.location.href = '/guest-services/client-services/clients-services?new=1';
          }}>➕ New Client</Button>
              </div>

        <Modal isOpen={isServiceOpen} onClose={onServiceClose}>
          <ModalContent>
            <ModalHeader>Add Service</ModalHeader>
            <ModalBody>
              <Input label="Name" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} />
              <Input label="Category" placeholder="e.g. Transportation, Housekeeping, Wellness" value={serviceForm.category} onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })} />
              <Textarea label="Description" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} />
              <Input label="Price (₵)" type="number" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} />
              <Input label="Provider" value={serviceForm.provider} onChange={(e) => setServiceForm({ ...serviceForm, provider: e.target.value })} />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onServiceClose}>Cancel</Button>
              <Button color="primary" onPress={submitService} isDisabled={!serviceForm.name || !serviceForm.category}>Add Service</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={isRequestOpen} onClose={onRequestClose}>
          <ModalContent>
            <ModalHeader>Log Service Request — {rawServices.find((s) => s.id === requestServiceId)?.name}</ModalHeader>
            <ModalBody>
              <Input label="Client Name" value={requestForm.clientName} onChange={(e) => setRequestForm({ ...requestForm, clientName: e.target.value })} />
              <Input label="Room Number" value={requestForm.roomNumber} onChange={(e) => setRequestForm({ ...requestForm, roomNumber: e.target.value })} />
              <Select label="Priority" selectedKeys={[requestForm.priority]} onSelectionChange={(k) => setRequestForm({ ...requestForm, priority: (Array.from(k)[0] as any) || 'medium' })}>
                <SelectItem key="low">Low</SelectItem>
                <SelectItem key="medium">Medium</SelectItem>
                <SelectItem key="high">High</SelectItem>
              </Select>
              <Textarea label="Notes" value={requestForm.notes} onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })} />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onRequestClose}>Cancel</Button>
              <Button color="primary" onPress={submitRequest} isDisabled={!requestForm.clientName}>Log Request</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
