'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Input, 
  Select, 
  SelectItem, 
  Textarea,
  Chip,
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tabs,
  Tab,
  Divider,
  Progress,
  Switch,
  Checkbox
} from '@heroui/react';
import { enhancedFrontOfficeStore } from '../lib/frontoffice/enhancedStore';
import { trackEvent } from '../lib/analytics/trackEvent';

interface GuestPreferences {
  roomPreferences: {
    quietRoom: boolean;
    accessibleRoom: boolean;
    highFloor: boolean;
    nearElevator: boolean;
    connectingRooms: boolean;
  };
  dietaryRestrictions: string[];
  specialRequests: string[];
  preferredLanguage: string;
  vipStatus: boolean;
  arrivalPreferences: {
    airportTransfer: boolean;
    earlyCheckIn: boolean;
    lateArrival: boolean;
    specialArrival: string;
  };
  stayPreferences: {
    housekeepingFrequency: 'daily' | 'on-request' | 'eco-friendly';
    turndownService: boolean;
    minibarRestocking: boolean;
    newspaper: boolean;
    pillowType: 'soft' | 'medium' | 'firm';
  };
}

interface ConciergeService {
  id: string;
  name: string;
  description: string;
  category: 'transport' | 'tours' | 'restaurants' | 'entertainment' | 'business' | 'wellness';
  price: number;
  duration: string;
  availability: 'available' | 'limited' | 'unavailable';
  image: string;
}

interface PreArrivalService {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  requestedDate: string;
  confirmedDate?: string;
  notes: string;
}

export default function GuestExperienceManager() {
  const [selectedGuest, setSelectedGuest] = useState<string>('');
  const [guestPreferences, setGuestPreferences] = useState<GuestPreferences | null>(null);
  const [selectedService, setSelectedService] = useState<ConciergeService | null>(null);
  const [preArrivalServices, setPreArrivalServices] = useState<PreArrivalService[]>([]);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const guests = enhancedFrontOfficeStore.guests;
  const guestPrefs = enhancedFrontOfficeStore.guestPreferences;

  // Concierge services data
  const conciergeServices: ConciergeService[] = [
    {
      id: 'cs-1',
      name: 'Airport Transfer Service',
      description: 'Professional airport pickup and drop-off service',
      category: 'transport',
      price: 150,
      duration: '45-60 minutes',
      availability: 'available',
      image: '🚗'
    },
    {
      id: 'cs-2',
      name: 'Accra City Tour',
      description: 'Guided tour of Accra\'s historical and cultural sites',
      category: 'tours',
      price: 200,
      duration: '4 hours',
      availability: 'available',
      image: '🏛️'
    },
    {
      id: 'cs-3',
      name: 'Cape Coast Castle Tour',
      description: 'Day trip to UNESCO World Heritage site',
      category: 'tours',
      price: 350,
      duration: '8 hours',
      availability: 'limited',
      image: '🏰'
    },
    {
      id: 'cs-4',
      name: 'Restaurant Reservations',
      description: 'Priority booking at Accra\'s finest restaurants',
      category: 'restaurants',
      price: 0,
      duration: 'Varies',
      availability: 'available',
      image: '🍽️'
    },
    {
      id: 'cs-5',
      name: 'Business Center Access',
      description: 'Full access to business facilities and meeting rooms',
      category: 'business',
      price: 50,
      duration: 'Daily',
      availability: 'available',
      image: '💼'
    },
    {
      id: 'cs-6',
      name: 'Spa & Wellness Package',
      description: 'Relaxing spa treatments and wellness consultations',
      category: 'wellness',
      price: 300,
      duration: '2-3 hours',
      availability: 'available',
      image: '🧘'
    }
  ];

  useEffect(() => {
    if (selectedGuest) {
      const prefs = guestPrefs.get(selectedGuest);
      setGuestPreferences(prefs || null);
    }
  }, [selectedGuest, guestPrefs]);

  const handleGuestSelection = (guestId: string) => {
    setSelectedGuest(guestId);
    trackEvent('GuestExperience.GuestSelected', { guestId });
  };

  const handlePreArrivalService = (service: ConciergeService) => {
    const preArrivalService: PreArrivalService = {
      id: `pas-${Date.now()}`,
      name: service.name,
      description: service.description,
      status: 'pending',
      requestedDate: new Date().toISOString(),
      notes: ''
    };

    setPreArrivalServices(prev => [...prev, preArrivalService]);
    trackEvent('GuestExperience.PreArrivalService.Requested', { 
      serviceId: service.id, 
      serviceName: service.name 
    });
  };

  const handleServiceBooking = (service: ConciergeService) => {
    setSelectedService(service);
    onOpen();
    trackEvent('GuestExperience.Service.BookingInitiated', { 
      serviceId: service.id, 
      serviceName: service.name 
    });
  };

  const confirmServiceBooking = () => {
    if (selectedService) {
      trackEvent('GuestExperience.Service.BookingConfirmed', { 
        serviceId: selectedService.id, 
        serviceName: selectedService.name 
      });
      onClose();
      setSelectedService(null);
    }
  };

  const updateGuestPreferences = (updates: Partial<GuestPreferences>) => {
    if (selectedGuest && guestPreferences) {
      const updatedPrefs = { ...guestPreferences, ...updates };
      setGuestPreferences(updatedPrefs);
      
      // In a real system, this would update the store
      trackEvent('GuestExperience.Preferences.Updated', { 
        guestId: selectedGuest, 
        updates: Object.keys(updates) 
      });
    }
  };

  const renderPreArrivalServices = () => (
    <div className="pre-arrival-services">
      <h3 className="text-xl font-semibold text-ghana-black mb-4">🌟 Pre-Arrival Services</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {conciergeServices
          .filter(service => ['transport', 'tours'].includes(service.category))
          .map(service => (
            <Card key={service.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardBody className="p-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">{service.image}</div>
                  <h4 className="font-semibold text-ghana-black mb-2">{service.name}</h4>
                  <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-ghana-black">₵{service.price}</span>
                    <Badge 
                      color={service.availability === 'available' ? 'success' : 'warning'}
                      variant="flat"
                    >
                      {service.availability}
                    </Badge>
                  </div>
                  <Button
                    color="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => handlePreArrivalService(service)}
                    disabled={service.availability === 'unavailable'}
                  >
                    Request Service
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
      </div>
    </div>
  );

  const renderConciergeServices = () => (
    <div className="concierge-services">
      <h3 className="text-xl font-semibold text-ghana-black mb-4">🛎️ Concierge Services</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {conciergeServices.map(service => (
          <Card key={service.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardBody className="p-4">
              <div className="text-center">
                <div className="text-4xl mb-2">{service.image}</div>
                <h4 className="font-semibold text-ghana-black mb-2">{service.name}</h4>
                <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-ghana-black">₵{service.price}</span>
                  <Badge 
                    color={service.availability === 'available' ? 'success' : 'warning'}
                    variant="flat"
                  >
                    {service.availability}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 mb-3">{service.duration}</div>
                <Button
                  color="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleServiceBooking(service)}
                  disabled={service.availability === 'unavailable'}
                >
                  Book Service
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderGuestPreferences = () => (
    <div className="guest-preferences">
      <h3 className="text-xl font-semibold text-ghana-black mb-4">⚙️ Guest Preferences</h3>
      {guestPreferences ? (
        <div className="space-y-6">
          {/* Room Preferences */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h4 className="text-lg font-semibold text-ghana-black">🏠 Room Preferences</h4>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Switch
                    isSelected={guestPreferences.roomPreferences.quietRoom}
                    onValueChange={(value) => updateGuestPreferences({
                      roomPreferences: { ...guestPreferences.roomPreferences, quietRoom: value }
                    })}
                  />
                  <span>Quiet Room</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    isSelected={guestPreferences.roomPreferences.accessibleRoom}
                    onValueChange={(value) => updateGuestPreferences({
                      roomPreferences: { ...guestPreferences.roomPreferences, accessibleRoom: value }
                    })}
                  />
                  <span>Accessible Room</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    isSelected={guestPreferences.roomPreferences.highFloor}
                    onValueChange={(value) => updateGuestPreferences({
                      roomPreferences: { ...guestPreferences.roomPreferences, highFloor: value }
                    })}
                  />
                  <span>High Floor</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    isSelected={guestPreferences.roomPreferences.nearElevator}
                    onValueChange={(value) => updateGuestPreferences({
                      roomPreferences: { ...guestPreferences.roomPreferences, nearElevator: value }
                    })}
                  />
                  <span>Near Elevator</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Stay Preferences */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h4 className="text-lg font-semibold text-ghana-black">🛏️ Stay Preferences</h4>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Housekeeping Frequency
                  </label>
                  <Select
                    selectedKeys={[guestPreferences.stayPreferences.housekeepingFrequency]}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;
                      updateGuestPreferences({
                        stayPreferences: { 
                          ...guestPreferences.stayPreferences, 
                          housekeepingFrequency: value as any 
                        }
                      });
                    }}
                  >
                    <SelectItem key="daily">Daily</SelectItem>
                    <SelectItem key="on-request">On Request</SelectItem>
                    <SelectItem key="eco-friendly">Eco-Friendly</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Pillow Type
                  </label>
                  <Select
                    selectedKeys={[guestPreferences.stayPreferences.pillowType]}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;
                      updateGuestPreferences({
                        stayPreferences: { 
                          ...guestPreferences.stayPreferences, 
                          pillowType: value as any 
                        }
                      });
                    }}
                  >
                    <SelectItem key="soft">Soft</SelectItem>
                    <SelectItem key="medium">Medium</SelectItem>
                    <SelectItem key="firm">Firm</SelectItem>
                  </Select>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <Switch
                    isSelected={guestPreferences.stayPreferences.turndownService}
                    onValueChange={(value) => updateGuestPreferences({
                      stayPreferences: { ...guestPreferences.stayPreferences, turndownService: value }
                    })}
                  />
                  <span>Turndown Service</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    isSelected={guestPreferences.stayPreferences.minibarRestocking}
                    onValueChange={(value) => updateGuestPreferences({
                      stayPreferences: { ...guestPreferences.stayPreferences, minibarRestocking: value }
                    })}
                  />
                  <span>Minibar Restocking</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    isSelected={guestPreferences.stayPreferences.newspaper}
                    onValueChange={(value) => updateGuestPreferences({
                      stayPreferences: { ...guestPreferences.stayPreferences, newspaper: value }
                    })}
                  />
                  <span>Daily Newspaper</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Special Requests */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h4 className="text-lg font-semibold text-ghana-black">📝 Special Requests</h4>
            </CardHeader>
            <CardBody>
              <Textarea
                placeholder="Enter any special requests or preferences..."
                value={guestPreferences.specialRequests.join('\n')}
                onChange={(e) => updateGuestPreferences({
                  specialRequests: e.target.value.split('\n').filter(line => line.trim())
                })}
                className="w-full"
                rows={4}
              />
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          Select a guest to view and manage preferences
        </div>
      )}
    </div>
  );

  const renderPreArrivalRequests = () => (
    <div className="pre-arrival-requests">
      <h3 className="text-xl font-semibold text-ghana-black mb-4">📋 Pre-Arrival Requests</h3>
      {preArrivalServices.length > 0 ? (
        <div className="space-y-3">
          {preArrivalServices.map(service => (
            <Card key={service.id} className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-semibold text-ghana-black">{service.name}</h5>
                    <p className="text-sm text-gray-600">{service.description}</p>
                    <p className="text-xs text-gray-500">
                      Requested: {new Date(service.requestedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge 
                      color={
                        service.status === 'confirmed' ? 'success' : 
                        service.status === 'pending' ? 'warning' : 
                        service.status === 'completed' ? 'primary' : 'danger'
                      }
                      variant="flat"
                    >
                      {service.status}
                    </Badge>
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      onClick={() => {
                        const updated = preArrivalServices.map(s => 
                          s.id === service.id ? { ...s, status: 'confirmed' as any } : s
                        );
                        setPreArrivalServices(updated);
                      }}
                      disabled={service.status !== 'pending'}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          No pre-arrival service requests yet
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🌟 Guest Experience Manager</h1>
          <p className="text-gray-600">Personalized guest services and preferences management</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">VIP Services</Badge>
          <Badge color="primary">Concierge</Badge>
        </div>
      </div>

      {/* Guest Selection */}
      <Card className="border-0 shadow-lg mb-6">
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold text-ghana-black">👥 Select Guest</h3>
        </CardHeader>
        <CardBody>
          <Select
            placeholder="Choose a guest to manage..."
            selectedKeys={selectedGuest ? [selectedGuest] : []}
            onSelectionChange={(keys) => {
              const guestId = Array.from(keys)[0] as string;
              handleGuestSelection(guestId);
            }}
            className="w-full md:w-80"
          >
            {guests.map(guest => (
              <SelectItem key={guest.id} value={guest.id}>
                <div className="flex items-center space-x-3">
                  <Avatar 
                    name={guest.name} 
                    size="sm"
                    className="bg-ghana-black text-white"
                  />
                  <div>
                    <div className="font-medium">{guest.name}</div>
                    <div className="text-sm text-gray-500">ID: {guest.id}</div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </Select>
        </CardBody>
      </Card>

      {/* Main Content Tabs */}
      <Tabs 
        selectedKey="pre-arrival" 
        className="w-full"
        color="primary"
        variant="underlined"
      >
        <Tab key="pre-arrival" title="🚀 Pre-Arrival Services" />
        <Tab key="concierge" title="🛎️ Concierge Services" />
        <Tab key="preferences" title="⚙️ Guest Preferences" />
        <Tab key="requests" title="📋 Service Requests" />
      </Tabs>

      <div className="mt-6">
        <Tab key="pre-arrival" title="🚀 Pre-Arrival Services">
          {renderPreArrivalServices()}
        </Tab>
        <Tab key="concierge" title="🛎️ Concierge Services">
          {renderConciergeServices()}
        </Tab>
        <Tab key="preferences" title="⚙️ Guest Preferences">
          {renderGuestPreferences()}
        </Tab>
        <Tab key="requests" title="📋 Service Requests">
          {renderPreArrivalRequests()}
        </Tab>
      </div>

      {/* Service Booking Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            <h3 className="text-xl font-semibold text-ghana-black">
              Book {selectedService?.name}
            </h3>
          </ModalHeader>
          <ModalBody>
            {selectedService && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-6xl mb-4">{selectedService.image}</div>
                  <h4 className="text-xl font-semibold text-ghana-black mb-2">
                    {selectedService.name}
                  </h4>
                  <p className="text-gray-600 mb-4">{selectedService.description}</p>
                  <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                    <span>💰 ₵{selectedService.price}</span>
                    <span>⏱️ {selectedService.duration}</span>
                  </div>
                </div>
                <Divider />
                <div className="space-y-3">
                  <Input
                    label="Preferred Date"
                    type="date"
                    placeholder="Select date"
                  />
                  <Input
                    label="Preferred Time"
                    type="time"
                    placeholder="Select time"
                  />
                  <Textarea
                    label="Special Requirements"
                    placeholder="Any special requirements or notes..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="flat" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={confirmServiceBooking}>
              Confirm Booking
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
