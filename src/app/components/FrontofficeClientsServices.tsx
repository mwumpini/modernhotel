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
// GuestForm removed in favor of canonical client form redirect
import { frontOfficeStore } from '../lib/frontoffice/store';

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

  const clients: Client[] = [
    {
      id: 'G-123456',
      serialNumber: 'C001',
      name: 'John Doe',
      email: 'john.doe@email.com',
      phone: '+233 24 123 4567',
      nationality: 'Ghanaian',
      ghanaCard: 'GHA-123456789-0',
      vipStatus: 'gold',
      totalStays: 15,
      totalSpent: '₵45,000',
      lastVisit: '2024-01-15',
      preferences: ['High Floor', 'Non-smoking', 'Extra Towels']
    },
    {
      id: 'G-654321',
      serialNumber: 'C002',
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      phone: '+233 20 987 6543',
      nationality: 'American',
      passport: 'US123456789',
      vipStatus: 'silver',
      totalStays: 8,
      totalSpent: '₵24,000',
      lastVisit: '2024-01-14',
      preferences: ['Pool View', 'Late Check-out']
    },
    {
      id: 'C003',
      name: 'Kwame Asante',
      email: 'kasante@company.com',
      phone: '+233 26 555 1234',
      nationality: 'Ghanaian',
      ghanaCard: 'GHA-987654321-0',
      vipStatus: 'platinum',
      totalStays: 45,
      totalSpent: '₵180,000',
      lastVisit: '2024-01-10',
      preferences: ['Suite', 'Airport Pickup', 'Business Center']
    }
  ];

  const services: Service[] = [
    {
      id: 'S001',
      name: 'Airport Pickup',
      category: 'Transportation',
      description: 'Professional airport transfer service',
      price: '₵200',
      status: 'available',
      provider: 'Ghana Transport Co.'
    },
    {
      id: 'S002',
      name: 'Laundry Service',
      category: 'Housekeeping',
      description: 'Same-day laundry and dry cleaning',
      price: '₵50',
      status: 'available',
      provider: 'In-house'
    },
    {
      id: 'S003',
      name: 'Spa Treatment',
      category: 'Wellness',
      description: 'Relaxing spa and massage services',
      price: '₵300',
      status: 'available',
      provider: 'Ghana Wellness Spa'
    },
    {
      id: 'S004',
      name: 'Tour Guide',
      category: 'Entertainment',
      description: 'Professional tour guide for Accra',
      price: '₵400',
      status: 'available',
      provider: 'Ghana Tours Ltd.'
    }
  ];

  const serviceRequests: ServiceRequest[] = [
    {
      id: 'SR001',
      clientName: 'John Doe',
      serviceName: 'Airport Pickup',
      roomNumber: '205',
      requestDate: '2024-01-15',
      status: 'completed',
      priority: 'high',
      notes: 'Pickup from Kotoka International Airport'
    },
    {
      id: 'SR002',
      clientName: 'Sarah Johnson',
      serviceName: 'Laundry Service',
      roomNumber: '312',
      requestDate: '2024-01-16',
      status: 'in_progress',
      priority: 'medium',
      notes: 'Business suits - urgent'
    },
    {
      id: 'SR003',
      clientName: 'Kwame Asante',
      serviceName: 'Spa Treatment',
      roomNumber: '401',
      requestDate: '2024-01-17',
      status: 'pending',
      priority: 'low',
      notes: 'Couple massage - evening appointment'
    }
  ];

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
                <p className="text-2xl font-bold text-blue-600">1,250</p>
                <p className="text-sm text-blue-700">Total Clients</p>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-3xl mb-2">⭐</div>
                <p className="text-2xl font-bold text-green-600">45</p>
                <p className="text-sm text-green-700">VIP Clients</p>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-3xl mb-2">🛎️</div>
                <p className="text-2xl font-bold text-purple-600">12</p>
                <p className="text-sm text-purple-700">Active Services</p>
              </div>

              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-2xl font-bold text-orange-600">8</p>
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
                  <Button color="primary" variant="flat" size="sm">
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
                            <Button size="sm" color="primary" variant="flat">
                              Edit
                            </Button>
                            <Button size="sm" color="success" variant="flat">
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
      </div>
    </div>
  );
}
